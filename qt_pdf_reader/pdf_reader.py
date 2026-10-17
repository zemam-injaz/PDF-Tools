"""
High-performance PDF reader + annotation layer for PyQt6 + PyMuPDF (fitz).

Performance architecture (unchanged from the renderer):
1. ``RenderWorker`` / ``RenderSignals`` — page rendering on a ``QThreadPool``; the GUI
   thread never calls ``page.get_pixmap()``. Each worker thread owns its own
   ``fitz.Document`` handle.
2. ``PageCacheManager`` — memory-bounded LRU cache with predictive pre-fetching and
   generation tracking so stale renders are discarded.
3. ``PDFViewport`` — texture-scaling zoom with a debounced high-fidelity re-render.

Annotation layer (added on top of the above, without regressing it):
- Highlight by dragging over text; the drag is snapped to words via
  ``page.get_text("words")`` and stored as quads (multi-line aware).
- Sticky notes placed by clicking.
- Comments dock listing every annotation; click to navigate, delete to remove.
- Save as **native PDF annotations** so they open in Adobe Acrobat / any reader.

Key design: pages are rendered with ``annots=False`` and annotations are drawn as a
separate overlay in the scene. This keeps rendering off-thread and makes editing
instant (no page re-render), while saving still writes real PDF annotation objects.

Run:  python pdf_reader.py [file.pdf]
Requires: PyQt6, PyMuPDF (fitz).
"""

from __future__ import annotations

import bisect
import os
import sys
import threading
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import fitz  # PyMuPDF

from PyQt6.QtCore import (
    QByteArray,
    QObject,
    QPoint,
    QPointF,
    QRectF,
    QRunnable,
    QSize,
    Qt,
    QThreadPool,
    QTimer,
    pyqtSignal,
)
from PyQt6.QtGui import (
    QAction,
    QColor,
    QFont,
    QFontDatabase,
    QIcon,
    QImage,
    QKeySequence,
    QPainter,
    QPen,
    QBrush,
    QPixmap,
    QTransform,
)
from PyQt6.QtSvg import QSvgRenderer
from PyQt6.QtWidgets import (
    QApplication,
    QColorDialog,
    QComboBox,
    QDockWidget,
    QFileDialog,
    QFrame,
    QGraphicsDropShadowEffect,
    QGraphicsEllipseItem,
    QGraphicsLineItem,
    QGraphicsPixmapItem,
    QGraphicsRectItem,
    QGraphicsScene,
    QGraphicsSimpleTextItem,
    QGraphicsView,
    QHBoxLayout,
    QInputDialog,
    QLabel,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QSpinBox,
    QStatusBar,
    QToolBar,
    QToolButton,
    QTreeWidget,
    QTreeWidgetItem,
    QVBoxLayout,
    QWidget,
)

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #

PAGE_MARGIN = 18.0          # scene units (PDF points) around the page column
PAGE_GAP = 24.0             # vertical gap between pages
MIN_SCALE = 0.05
MAX_SCALE = 12.0
MAX_RENDER_SCALE = 8.0
MAX_RENDER_PIXELS = 40_000_000
CACHE_MAX_BYTES = 512 * 1024 * 1024
CACHE_MAX_PAGES = 24
PREFETCH_OFFSETS = (1, -1, 2, -2)
PRIORITY_CURRENT = 10
PRIORITY_PREFETCH = 0
ZOOM_DEBOUNCE_MS = 200
VISIBLE_UPDATE_MS = 25
NOTE_MARKER_SIZE = 16.0

HIGHLIGHT_DEFAULT = (1.0, 0.92, 0.23)
NOTE_DEFAULT = (0.10, 0.50, 0.90)
UNDERLINE_DEFAULT = (0.23, 0.51, 0.96)
AREA_DEFAULT = (1.0, 0.92, 0.23)
BENEFIT_DEFAULT = (0.98, 0.75, 0.14)

TEXT_MARKUP_TOOLS = ("highlight", "underline")
DRAG_RECT_TOOLS = ("area",)
CLICK_TOOLS = ("note", "freetext", "stamp", "benefit")

# Palette offered for area highlight and the other color-capable tools.
COLOR_PALETTE = [
    ("أصفر", (1.00, 0.92, 0.23)),
    ("أخضر", (0.36, 0.84, 0.40)),
    ("سماوي", (0.23, 0.51, 0.96)),
    ("تركوازي", (0.13, 0.74, 0.71)),
    ("بنفسجي", (0.61, 0.35, 0.90)),
    ("زهري", (0.93, 0.30, 0.66)),
    ("برتقالي", (0.98, 0.57, 0.14)),
    ("أحمر", (0.94, 0.27, 0.27)),
]


def render_bucket(scale: float) -> float:
    return round(scale, 3)


def page_display_size(page: fitz.Page) -> Tuple[float, float]:
    rect = page.rect
    if page.rotation % 180 == 90:
        return rect.height, rect.width
    return rect.width, rect.height


def qcolor(rgb: Tuple[float, float, float], alpha: int = 255) -> QColor:
    return QColor(
        int(max(0.0, min(1.0, rgb[0])) * 255),
        int(max(0.0, min(1.0, rgb[1])) * 255),
        int(max(0.0, min(1.0, rgb[2])) * 255),
        alpha,
    )


# --------------------------------------------------------------------------- #
# Modern high-density dark theme (QSS)
# --------------------------------------------------------------------------- #

MODERN_DARK_STYLE = """
QWidget {
    color: #e2e8f0;
    font-size: 13px;
}
QMainWindow, QDialog {
    background-color: #090a0f;
}

/* --- Top toolbar ------------------------------------------------------- */
QToolBar {
    background-color: #12141c;
    border-bottom: 1px solid #1e2230;
    spacing: 4px;
    padding: 6px 8px;
}
QToolBar::separator {
    background-color: #27272a;
    width: 1px;
    margin: 6px 8px;
}
QToolButton {
    background-color: transparent;
    color: #cbd5e1;
    border: none;
    border-radius: 6px;
    padding: 6px 8px;
}
QToolButton:hover {
    background-color: #27272a;
    color: #ffffff;
}
QToolButton:pressed {
    background-color: #1e2230;
}
QToolButton:checked {
    background-color: #2563eb;
    color: #ffffff;
}
QToolButton:disabled {
    color: #4b5563;
}

/* --- Comments dock ----------------------------------------------------- */
QDockWidget {
    color: #94a3b8;
    font-weight: 700;
    font-size: 12px;
}
QDockWidget::title {
    background-color: #12141c;
    padding: 9px 14px;
    border-bottom: 1px solid #1e2230;
    text-align: right;
}
QDockWidget::close-button, QDockWidget::float-button {
    background: transparent;
    border: none;
    padding: 2px;
}
QListWidget {
    background-color: #12141c;
    border: none;
    padding: 8px;
    outline: 0;
}

/* --- Comment cards (sidebar) ------------------------------------------ */
QFrame#card {
    background-color: #181c28;
    border: 1px solid #1e2230;
    border-radius: 8px;
}
QFrame#card:hover {
    background-color: #1f2434;
    border-color: #2d3348;
}
QLabel#badge {
    border-radius: 4px;
}
QLabel#snippet {
    color: #f1f5f9;
    font-size: 13px;
    font-weight: 500;
    background: transparent;
}
QLabel#meta {
    color: #64748b;
    font-size: 11px;
    font-weight: 500;
    background: transparent;
}
QToolButton#cardTrash {
    background: transparent;
    border: none;
    border-radius: 5px;
    padding: 3px;
    color: #94a3b8;
}
QToolButton#cardTrash:hover {
    background-color: #3f1d24;
    color: #f87171;
}

/* --- Buttons ----------------------------------------------------------- */
QPushButton {
    background-color: #1e2230;
    color: #f1f5f9;
    border: 1px solid #2d3348;
    border-radius: 7px;
    padding: 9px 14px;
    font-size: 13px;
    font-weight: 600;
}
QPushButton:hover {
    background-color: #262c3d;
    border-color: #3b82f6;
}
QPushButton:pressed {
    background-color: #1b2030;
}
QPushButton#dangerButton {
    color: #fca5a5;
    border-color: #5b2730;
    background-color: #241820;
}
QPushButton#dangerButton:hover {
    background-color: #ef4444;
    border-color: #dc2626;
    color: #ffffff;
}

/* --- Canvas ------------------------------------------------------------ */
QGraphicsView {
    background-color: #090a0f;
    border: none;
}

/* --- Labels / pills ---------------------------------------------------- */
QLabel {
    color: #94a3b8;
    font-weight: 600;
    padding: 0 4px;
}
QLabel#pill {
    color: #e2e8f0;
    background-color: #12141c;
    border: 1px solid #1e2230;
    border-radius: 11px;
    padding: 3px 12px;
    font-weight: 700;
}
QFrame#pill {
    background-color: #12141c;
    border: 1px solid #1e2230;
    border-radius: 12px;
}
QLabel#totalPages {
    color: #64748b;
    background: transparent;
    padding: 0 8px 0 2px;
    font-weight: 600;
}

/* --- Inputs (note dialog) --------------------------------------------- */
QLineEdit, QPlainTextEdit, QTextEdit {
    background-color: #12141c;
    color: #e2e8f0;
    border: 1px solid #2d3348;
    border-radius: 7px;
    padding: 7px 10px;
    selection-background-color: #2563eb;
}
QLineEdit:focus, QPlainTextEdit:focus, QTextEdit:focus {
    border-color: #3b82f6;
}
QSpinBox {
    background-color: transparent;
    color: #e2e8f0;
    border: none;
    padding: 3px 2px;
    min-width: 40px;
    font-weight: 700;
}

/* --- Status bar -------------------------------------------------------- */
QStatusBar {
    background-color: #12141c;
    color: #94a3b8;
    border-top: 1px solid #1e2230;
}

/* --- Scrollbars -------------------------------------------------------- */
QScrollBar:vertical {
    background: transparent;
    width: 12px;
    margin: 2px;
}
QScrollBar::handle:vertical {
    background: #2f3648;
    border-radius: 5px;
    min-height: 32px;
}
QScrollBar::handle:vertical:hover {
    background: #3b82f6;
}
QScrollBar:horizontal {
    background: transparent;
    height: 12px;
    margin: 2px;
}
QScrollBar::handle:horizontal {
    background: #2f3648;
    border-radius: 5px;
    min-width: 32px;
}
QScrollBar::handle:horizontal:hover {
    background: #3b82f6;
}
QScrollBar::add-line, QScrollBar::sub-line {
    height: 0; width: 0;
}
QScrollBar::add-page, QScrollBar::sub-page {
    background: transparent;
}

QToolTip {
    background-color: #1e2230;
    color: #e2e8f0;
    border: 1px solid #3b82f6;
    padding: 4px 8px;
    border-radius: 5px;
}

/* --- Grouped comments tree -------------------------------------------- */
QTreeWidget {
    background-color: #12141c;
    border: none;
    padding: 6px;
    outline: 0;
    show-decoration-selected: 1;
}
QTreeWidget::item {
    padding: 7px 6px;
    border-radius: 6px;
    color: #cbd5e1;
}
QTreeWidget::item:hover {
    background-color: #1f2434;
}
QTreeWidget::item:selected {
    background-color: #1e293b;
    color: #ffffff;
}
QTreeWidget::branch {
    background: transparent;
}

/* --- Color palette combo ---------------------------------------------- */
QComboBox {
    background-color: #12141c;
    color: #e2e8f0;
    border: 1px solid #1e2230;
    border-radius: 7px;
    padding: 4px 8px;
    min-width: 104px;
    font-weight: 600;
}
QComboBox:hover { border-color: #3b82f6; }
QComboBox::drop-down { border: none; width: 18px; }
QComboBox QAbstractItemView {
    background-color: #161922;
    color: #e2e8f0;
    border: 1px solid #1e2230;
    selection-background-color: #2563eb;
    outline: 0;
}
"""

ARABIC_FONT_FAMILY = "IBM Plex Sans Arabic"


def load_arabic_font() -> str:
    """Register the bundled IBM Plex Sans Arabic fonts and return the family name.

    Falls back to the family name lookup (or Qt's default) if the files are absent.
    """
    here = os.path.dirname(os.path.abspath(__file__))
    roots = [
        os.environ.get("MATN_FONT_DIR", ""),
        os.path.join(os.path.dirname(here), "python-server", "assets", "fonts"),
        os.path.join(here, "assets", "fonts"),
        os.path.join(os.path.dirname(here), "public", "fonts"),
    ]
    for root in roots:
        if not root:
            continue
        for name in ("IBMPlexSansArabic-Regular.ttf", "IBMPlexSansArabic-Bold.ttf"):
            path = os.path.join(root, name)
            if os.path.isfile(path):
                QFontDatabase.addApplicationFont(path)
    return ARABIC_FONT_FAMILY


# --------------------------------------------------------------------------- #
# Vector icons (Feather-style SVG, rendered via QtSvg — no external assets)
# --------------------------------------------------------------------------- #

_SVG_HEAD = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" '
             'stroke="{c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">')
SVG_ICONS = {
    "open": _SVG_HEAD + '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    "pan": _SVG_HEAD + ('<polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/>'
                        '<polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/>'
                        '<line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>'),
    "highlight": _SVG_HEAD + ('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3'
                              'L7 19l-4 1 1-4 12.5-12.5z"/></svg>'),
    "note": _SVG_HEAD + ('<path d="M5 3h9l5 5v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>'
                         '<path d="M14 3v5h5"/><line x1="8" y1="14" x2="16" y2="14"/>'
                         '<line x1="8" y1="17.5" x2="13" y2="17.5"/></svg>'),
    "zoom_in": _SVG_HEAD + ('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'
                            '<line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>'),
    "zoom_out": _SVG_HEAD + ('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'
                             '<line x1="8" y1="11" x2="14" y2="11"/></svg>'),
    "fit_width": _SVG_HEAD + ('<line x1="3" y1="12" x2="21" y2="12"/><polyline points="7 8 3 12 7 16"/>'
                              '<polyline points="17 8 21 12 17 16"/></svg>'),
    "fit_page": _SVG_HEAD + ('<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3'
                             'M3 16v3a2 2 0 0 0 2 2h3"/></svg>'),
    "actual": _SVG_HEAD + ('<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3.4M12 18.6V22M2 12h3.4M18.6 12H22"/></svg>'),
    "prev": _SVG_HEAD + '<polyline points="15 18 9 12 15 6"/></svg>',
    "next": _SVG_HEAD + '<polyline points="9 18 15 12 9 6"/></svg>',
    "save": _SVG_HEAD + ('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>'
                         '<polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>'),
    "export": _SVG_HEAD + ('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>'
                           '<polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'),
    "page": _SVG_HEAD + ('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>'
                         '<polyline points="14 2 14 8 20 8"/></svg>'),
    "underline": _SVG_HEAD + ('<path d="M6 4v6a6 6 0 0 0 12 0V4"/>'
                              '<line x1="4" y1="20" x2="20" y2="20"/></svg>'),
    "area": _SVG_HEAD + ('<rect x="4" y="5" width="16" height="14" rx="1.5"/>'
                         '<line x1="8" y1="10" x2="16" y2="10"/></svg>'),
    "type": _SVG_HEAD + ('<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/>'
                         '<line x1="12" y1="4" x2="12" y2="20"/></svg>'),
    "clock": _SVG_HEAD + ('<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>'),
    "star": _SVG_HEAD + ('<polygon points="12 2 15 9 22 9.3 16.5 13.9 18.5 21 12 16.8 5.5 21 7.5 13.9 2 9.3 9 9"/></svg>'),
    "paint": _SVG_HEAD + ('<path d="M12 2.5s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>'
                          '<circle cx="12" cy="14" r="2.2" fill="{c}" stroke="none"/></svg>'),
    "trash": _SVG_HEAD + ('<polyline points="3 6 5 6 21 6"/>'
                          '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>'
                          '<path d="M10 11v6M14 11v6"/>'
                          '<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>'),
}

_ICON_CACHE: Dict[Tuple[str, str, int], QIcon] = {}


def make_icon(name: str, color: str = "#cbd5e1", size: int = 44) -> QIcon:
    key = (name, color, size)
    cached = _ICON_CACHE.get(key)
    if cached is not None:
        return cached
    svg = SVG_ICONS[name].format(c=color)
    renderer = QSvgRenderer(QByteArray(svg.encode("utf-8")))
    pixmap = QPixmap(size, size)
    pixmap.fill(Qt.GlobalColor.transparent)
    painter = QPainter(pixmap)
    renderer.render(painter)
    painter.end()
    icon = QIcon(pixmap)
    _ICON_CACHE[key] = icon
    return icon


def make_color_icon(rgb: Tuple[float, float, float], size: int = 16) -> QIcon:
    pixmap = QPixmap(size, size)
    pixmap.fill(Qt.GlobalColor.transparent)
    painter = QPainter(pixmap)
    painter.setRenderHint(QPainter.RenderHint.Antialiasing)
    painter.setBrush(QBrush(qcolor(rgb, 255)))
    painter.setPen(QPen(QColor("#0f1117"), 1))
    painter.drawRoundedRect(QRectF(0.5, 0.5, size - 1, size - 1), 4, 4)
    painter.end()
    return QIcon(pixmap)


def arabic_plural(count: int) -> str:
    if count == 1:
        return "تعليق واحد"
    if count == 2:
        return "تعليقان"
    if 3 <= count <= 10:
        return f"{count} تعليقات"
    return f"{count} تعليقًا"


def format_pdf_date(raw: str) -> str:
    if not raw:
        return ""
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) >= 12:
        return f"{digits[0:4]}-{digits[4:6]}-{digits[6:8]} {digits[8:10]}:{digits[10:12]}"
    return raw




# --------------------------------------------------------------------------- #
# Annotation model (display-space geometry, page-local)
# --------------------------------------------------------------------------- #

@dataclass
class Annotation:
    page: int
    kind: str                                  # highlight | underline | strikeout | note
    color: Tuple[float, float, float]
    text: str = ""
    quads: Optional[List[Tuple[float, float, float, float]]] = None
    point: Optional[Tuple[float, float]] = None
    rect: Optional[Tuple[float, float, float, float]] = None
    created: str = ""
    xref: Optional[int] = None                 # set when imported from the file
    deleted: bool = False


# --------------------------------------------------------------------------- #
# Document registry (thread-safe)
# --------------------------------------------------------------------------- #

class DocumentRegistry:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._path: Optional[str] = None
        self._main: Optional[fitz.Document] = None
        self._thread_local = threading.local()
        self._handles: List[fitz.Document] = []
        self._closed = True

    def open(self, path: str) -> fitz.Document:
        with self._lock:
            self._close_locked()
            doc = fitz.open(path)
            if doc.needs_pass:
                doc.close()
                raise PermissionError("The PDF is password protected.")
            self._path = path
            self._main = doc
            self._handles.append(doc)
            self._closed = False
            return doc

    @property
    def main(self) -> Optional[fitz.Document]:
        return self._main

    def worker_doc(self) -> Optional[fitz.Document]:
        with self._lock:
            if self._closed or self._path is None:
                return None
            path = self._path
        doc = getattr(self._thread_local, "doc", None)
        if doc is not None and getattr(self._thread_local, "path", None) == path:
            try:
                if not doc.is_closed:
                    return doc
            except Exception:
                pass
        doc = fitz.open(path)
        with self._lock:
            self._handles.append(doc)
        self._thread_local.doc = doc
        self._thread_local.path = path
        return doc

    def close(self) -> None:
        with self._lock:
            self._close_locked()

    def _close_locked(self) -> None:
        self._closed = True
        self._path = None
        for handle in self._handles:
            try:
                handle.close()
            except Exception:
                pass
        self._handles.clear()
        self._main = None
        try:
            self._thread_local.__dict__.clear()
        except Exception:
            pass


# --------------------------------------------------------------------------- #
# Background rendering
# --------------------------------------------------------------------------- #

@dataclass(frozen=True)
class RenderKey:
    page: int
    bucket: float


class RenderSignals(QObject):
    finished = pyqtSignal(object, int, object)   # RenderKey, generation, QImage
    failed = pyqtSignal(object, int, str)


class RenderWorker(QRunnable):
    def __init__(self, registry, manager, signals, key, generation, matrix_scale) -> None:
        super().__init__()
        self.setAutoDelete(True)
        self._registry = registry
        self._manager = manager
        self._signals = signals
        self._key = key
        self._generation = generation
        self._matrix_scale = matrix_scale

    def run(self) -> None:
        if not self._manager.is_current(self._generation):
            return
        doc = self._registry.worker_doc()
        if doc is None:
            return
        try:
            if self._key.page < 0 or self._key.page >= doc.page_count:
                return
            page = doc.load_page(self._key.page)
            scale = min(self._matrix_scale, MAX_RENDER_SCALE)
            width_pts, height_pts = page_display_size(page)
            if width_pts > 0 and height_pts > 0:
                scale = min(scale, (MAX_RENDER_PIXELS / (width_pts * height_pts)) ** 0.5)
            scale = max(0.05, scale)
            # annots=False: the annotation overlay is drawn in the scene, so the
            # page texture stays pure content (and editing is instant).
            pix = page.get_pixmap(
                matrix=fitz.Matrix(scale, scale), alpha=False,
                colorspace=fitz.csRGB, annots=False,
            )
            image = QImage(
                pix.samples, pix.width, pix.height, pix.stride,
                QImage.Format.Format_RGB888,
            ).copy()
        except Exception as exc:
            if self._manager.is_current(self._generation):
                self._signals.failed.emit(self._key, self._generation, str(exc))
            return
        if not self._manager.is_current(self._generation):
            return
        self._signals.finished.emit(self._key, self._generation, image)


# --------------------------------------------------------------------------- #
# Sliding-window LRU cache manager
# --------------------------------------------------------------------------- #

class PageCacheManager(QObject):
    page_ready = pyqtSignal(object, object)
    render_failed = pyqtSignal(str)

    def __init__(self, registry, pool, parent=None) -> None:
        super().__init__(parent)
        self._registry = registry
        self._pool = pool
        self._signals = RenderSignals(self)
        self._signals.finished.connect(self._on_finished)
        self._signals.failed.connect(self._on_failed)

        self._cache: Dict[RenderKey, QPixmap] = {}
        self._order: List[RenderKey] = []
        self._bytes = 0
        self._inflight: set[RenderKey] = set()
        self._visible: List[int] = []
        self._current_page = 0

        self._generation = 0
        self._scale = 1.0
        self._dpr = 1.0
        self._shutting_down = False
        self._lock = threading.Lock()

    def is_current(self, generation: int) -> bool:
        with self._lock:
            return (not self._shutting_down) and generation == self._generation

    def reset(self) -> None:
        with self._lock:
            self._generation += 1
        self._cache.clear()
        self._order.clear()
        self._bytes = 0
        self._inflight.clear()
        self._visible = []
        self._current_page = 0

    def shutdown(self) -> None:
        with self._lock:
            self._shutting_down = True
            self._generation += 1
        self._inflight.clear()

    def set_scale(self, scale: float, dpr: float) -> None:
        if render_bucket(scale) == render_bucket(self._scale) and dpr == self._dpr:
            return
        with self._lock:
            self._generation += 1
        self._scale = scale
        self._dpr = dpr

    def set_visible(self, pages: List[int], current: int) -> None:
        self._visible = sorted(set(pages))
        self._current_page = current
        for page in self._visible:
            self._submit(page, PRIORITY_CURRENT)
        for offset in PREFETCH_OFFSETS:
            candidate = current + offset
            if candidate >= 0:
                self._submit(candidate, PRIORITY_PREFETCH)

    def _matrix_scale(self) -> float:
        return self._scale * max(1.0, self._dpr)

    def _submit(self, page: int, priority: int) -> None:
        key = RenderKey(page, render_bucket(self._scale))
        if key in self._cache or key in self._inflight:
            return
        self._inflight.add(key)
        worker = RenderWorker(
            self._registry, self, self._signals, key,
            self._generation, self._matrix_scale(),
        )
        self._pool.start(worker, priority)

    def _on_finished(self, key: RenderKey, generation: int, image: QImage) -> None:
        self._inflight.discard(key)
        if generation != self._generation:
            return
        if key.bucket != render_bucket(self._scale):
            return
        pixmap = QPixmap.fromImage(image)
        self._store(key, pixmap)
        self.page_ready.emit(key, pixmap)

    def _on_failed(self, key: RenderKey, generation: int, message: str) -> None:
        self._inflight.discard(key)
        if generation == self._generation:
            self.render_failed.emit(message)

    def _store(self, key: RenderKey, pixmap: QPixmap) -> None:
        if key in self._cache:
            old = self._cache[key]
            self._bytes -= old.width() * old.height() * 4
            self._order.remove(key)
        self._cache[key] = pixmap
        self._order.append(key)
        self._bytes += pixmap.width() * pixmap.height() * 4
        self._evict()

    def _evict(self) -> None:
        visible = set(self._visible)
        while self._order and (self._bytes > CACHE_MAX_BYTES or len(self._order) > CACHE_MAX_PAGES):
            victim = next((key for key in self._order if key.page not in visible), None)
            if victim is None:
                victim = self._order[0]
            self._order.remove(victim)
            pixmap = self._cache.pop(victim, None)
            if pixmap is not None:
                self._bytes -= pixmap.width() * pixmap.height() * 4


# --------------------------------------------------------------------------- #
# Viewport (rendering + annotation interaction + overlay)
# --------------------------------------------------------------------------- #

class PDFViewport(QGraphicsView):
    zoomChanged = pyqtSignal(float)
    currentPageChanged = pyqtSignal(int)
    # kind, page index, payload (QRectF for drag tools, QPointF for click tools)
    tool_gesture = pyqtSignal(str, int, object)

    def __init__(self, manager: PageCacheManager, parent: Optional[QWidget] = None) -> None:
        super().__init__(parent)
        self._manager = manager
        self._scene = QGraphicsScene(self)
        self.setScene(self._scene)
        self.setBackgroundBrush(QColor("#090a0f"))
        self.setRenderHints(QPainter.RenderHint.Antialiasing | QPainter.RenderHint.SmoothPixmapTransform)
        self.setTransformationAnchor(QGraphicsView.ViewportAnchor.NoAnchor)
        self.setResizeAnchor(QGraphicsView.ViewportAnchor.NoAnchor)
        self.setAlignment(Qt.AlignmentFlag.AlignHCenter | Qt.AlignmentFlag.AlignTop)
        self.setViewportUpdateMode(QGraphicsView.ViewportUpdateMode.FullViewportUpdate)
        self.setFrameShape(QFrame.Shape.NoFrame)

        self._page_sizes: List[Tuple[float, float]] = []
        self._page_rects: List[QRectF] = []
        self._page_tops: List[float] = []
        self._page_items: Dict[int, QGraphicsPixmapItem] = {}
        self._overlay_items: List[QGraphicsRectItem] = []
        self._flash_items: List[QGraphicsRectItem] = []

        self._annotations: List[Annotation] = []
        self._mode = "pan"

        self._committed_scale = 1.0
        self._transient_factor = 1.0
        self._max_page_width = 1.0
        self._auto_fit = True

        self._drag_page: Optional[int] = None
        self._drag_origin: Optional[QPointF] = None
        self._drag_kind: Optional[str] = None
        self._temp_item = None

        self._zoom_anchor = QPoint()
        self._zoom_timer = QTimer(self)
        self._zoom_timer.setSingleShot(True)
        self._zoom_timer.setInterval(ZOOM_DEBOUNCE_MS)
        self._zoom_timer.timeout.connect(self._commit_zoom)

        self._fit_timer = QTimer(self)
        self._fit_timer.setSingleShot(True)
        self._fit_timer.setInterval(60)
        self._fit_timer.timeout.connect(self.fit_width)

        self._visible_timer = QTimer(self)
        self._visible_timer.setSingleShot(True)
        self._visible_timer.setInterval(VISIBLE_UPDATE_MS)
        self._visible_timer.timeout.connect(self._update_visible)

        self._flash_timer = QTimer(self)
        self._flash_timer.setSingleShot(True)
        self._flash_timer.timeout.connect(self._clear_flash)

        self._manager.page_ready.connect(self._on_page_ready)
        self.verticalScrollBar().valueChanged.connect(self._schedule_visible_update)
        self.horizontalScrollBar().valueChanged.connect(self._schedule_visible_update)
        self.set_mode("pan")

    # -- document lifecycle ------------------------------------------------- #
    def load_pages(self, sizes: List[Tuple[float, float]]) -> None:
        self._scene.clear()
        self._page_items.clear()
        self._overlay_items.clear()
        self._page_sizes = list(sizes)
        self._page_rects = []
        self._page_tops = []
        self._max_page_width = max((w for w, _ in sizes), default=1.0)

        y = PAGE_MARGIN
        for width, height in sizes:
            x = PAGE_MARGIN + (self._max_page_width - width) / 2.0
            rect = QRectF(x, y, width, height)
            self._page_rects.append(rect)
            self._page_tops.append(y)
            rect_item = QGraphicsRectItem(rect)
            rect_item.setBrush(QColor("#ffffff"))
            rect_item.setPen(QColor("#00000020"))
            rect_item.setZValue(0)
            self._scene.addItem(rect_item)
            y += height + PAGE_GAP

        self._scene.setSceneRect(QRectF(0, 0, self._max_page_width + 2 * PAGE_MARGIN, max(y, PAGE_MARGIN)))
        self.resetTransform()
        self._committed_scale = 1.0
        self._transient_factor = 1.0
        self.fit_width(request_render=False)
        self.refresh_overlay()
        self._update_visible()

    def clear(self) -> None:
        self._scene.clear()
        self._page_items.clear()
        self._overlay_items.clear()
        self._page_rects.clear()
        self._page_tops.clear()
        self._page_sizes.clear()

    @property
    def page_count(self) -> int:
        return len(self._page_rects)

    # -- annotation overlay ------------------------------------------------- #
    def set_mode(self, mode: str) -> None:
        self._mode = mode
        if mode == "pan":
            self.setDragMode(QGraphicsView.DragMode.ScrollHandDrag)
            self.viewport().setCursor(Qt.CursorShape.OpenHandCursor)
        else:
            self.setDragMode(QGraphicsView.DragMode.NoDrag)
            self.viewport().setCursor(
                Qt.CursorShape.IBeamCursor if mode == "freetext" else Qt.CursorShape.CrossCursor
            )

    def set_annotations(self, annotations: List[Annotation]) -> None:
        self._annotations = annotations
        self.refresh_overlay()

    def refresh_overlay(self) -> None:
        for item in self._overlay_items:
            self._scene.removeItem(item)
        self._overlay_items.clear()
        for annot in self._annotations:
            if annot.deleted or annot.page >= len(self._page_rects):
                continue
            origin = self._page_rects[annot.page].topLeft()
            if annot.kind in ("highlight", "underline", "strikeout"):
                for quad in annot.quads or []:
                    x0, y0, x1, y1 = quad
                    rect = QRectF(origin.x() + x0, origin.y() + y0, x1 - x0, y1 - y0)
                    if annot.kind == "highlight":
                        item = QGraphicsRectItem(rect)
                        item.setZValue(2)
                        item.setBrush(QBrush(qcolor(annot.color, 95)))
                        item.setPen(QPen(Qt.PenStyle.NoPen))
                    else:
                        # Underline / strikeout are a single horizontal line, not an
                        # enclosing rectangle (a box would surround each word and clip
                        # Arabic diacritics).
                        y = rect.bottom() if annot.kind == "underline" else rect.center().y()
                        width = max(1.5, (y1 - y0) * 0.09)
                        item = QGraphicsLineItem(rect.left(), y, rect.right(), y)
                        item.setZValue(2)
                        item.setPen(QPen(qcolor(annot.color, 235), width,
                                         Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap))
                    self._scene.addItem(item)
                    self._overlay_items.append(item)
            elif annot.kind in ("note", "benefit") and annot.point is not None:
                px, py = annot.point
                if annot.kind == "benefit":
                    size = NOTE_MARKER_SIZE + 4
                    rect = QRectF(origin.x() + px - size / 2, origin.y() + py - size / 2, size, size)
                    item = QGraphicsEllipseItem(rect)
                    item.setZValue(2)
                    item.setBrush(QBrush(qcolor(annot.color, 240)))
                    item.setPen(QPen(QColor("#7c2d12"), 1.0))
                    item.setToolTip(annot.text or "فائدة")
                    self._scene.addItem(item)
                    self._overlay_items.append(item)
                    star = QGraphicsSimpleTextItem("★")
                    star.setBrush(QBrush(QColor("#ffffff")))
                    star.setPos(rect.center().x() - 6, rect.center().y() - 9)
                    star.setZValue(2.1)
                    self._scene.addItem(star)
                    self._overlay_items.append(star)
                else:
                    rect = QRectF(origin.x() + px, origin.y() + py, NOTE_MARKER_SIZE, NOTE_MARKER_SIZE)
                    item = QGraphicsRectItem(rect)
                    item.setZValue(2)
                    item.setBrush(QBrush(qcolor(annot.color, 235)))
                    item.setPen(QPen(QColor("#ffffff"), 1.0))
                    item.setToolTip(annot.text or "ملاحظة")
                    self._scene.addItem(item)
                    self._overlay_items.append(item)
            elif annot.kind in ("freetext", "stamp") and annot.rect:
                x0, y0, x1, y1 = annot.rect
                rect = QRectF(origin.x() + x0, origin.y() + y0, x1 - x0, y1 - y0)
                box = QGraphicsRectItem(rect)
                box.setZValue(2)
                box.setBrush(QBrush(QColor(255, 255, 255, 235)))
                box.setPen(QPen(qcolor(annot.color, 200), 1.0))
                box.setToolTip(annot.text)
                self._scene.addItem(box)
                self._overlay_items.append(box)
                label = QGraphicsSimpleTextItem(annot.text)
                label.setBrush(QBrush(QColor("#1f2937")))
                label.setFont(QFont(ARABIC_FONT_FAMILY, 9))
                label.setPos(rect.left() + 4, rect.top() + 3)
                label.setZValue(2.1)
                self._scene.addItem(label)
                self._overlay_items.append(label)
            elif annot.kind == "area" and annot.rect:
                x0, y0, x1, y1 = annot.rect
                rect = QRectF(origin.x() + x0, origin.y() + y0, x1 - x0, y1 - y0)
                item = QGraphicsRectItem(rect)
                item.setZValue(2)
                item.setBrush(QBrush(qcolor(annot.color, 80)))
                item.setPen(QPen(qcolor(annot.color, 200), 1.0))
                item.setToolTip(annot.text or "تظليل مساحة")
                self._scene.addItem(item)
                self._overlay_items.append(item)

    # -- zoom --------------------------------------------------------------- #
    def wheelEvent(self, event) -> None:
        if event.modifiers() & Qt.KeyboardModifier.ControlModifier:
            angle = event.angleDelta().y()
            if angle:
                self._apply_transient_zoom(1.0015 ** angle, event.position().toPoint())
            event.accept()
        else:
            super().wheelEvent(event)

    def zoom_in(self) -> None:
        self._apply_transient_zoom(1.25, self.viewport().rect().center())
        self._commit_zoom()

    def zoom_out(self) -> None:
        self._apply_transient_zoom(0.8, self.viewport().rect().center())
        self._commit_zoom()

    def set_auto_fit(self, value: bool) -> None:
        self._auto_fit = value

    def set_scale_absolute(self, scale: float) -> None:
        scale = max(MIN_SCALE, min(MAX_SCALE, scale))
        anchor = self.viewport().rect().center()
        anchor_scene = self.mapToScene(anchor)
        self._transient_factor = 1.0
        self._committed_scale = scale
        self.setTransform(QTransform().scale(scale, scale))
        self._restore_anchor(anchor, anchor_scene)
        self.zoomChanged.emit(self._committed_scale)
        self._manager.set_scale(self._committed_scale, self.devicePixelRatioF())
        self._update_visible()

    def fit_width(self, request_render: bool = True) -> None:
        self._auto_fit = True
        available = self.viewport().width() - 2 * PAGE_MARGIN
        if available > 10 and self._max_page_width > 0:
            self.set_scale_absolute(available / self._max_page_width)
        elif request_render:
            self.set_scale_absolute(self._committed_scale)

    def fit_page(self) -> None:
        self._auto_fit = False
        if not self._page_sizes:
            return
        width, height = self._page_sizes[0]
        avail_w = self.viewport().width() - 2 * PAGE_MARGIN
        avail_h = self.viewport().height() - 2 * PAGE_MARGIN
        if width > 0 and height > 0 and avail_w > 10 and avail_h > 10:
            self.set_scale_absolute(min(avail_w / width, avail_h / height))

    def flash_annotation(self, annot: Annotation) -> None:
        """Briefly outline an annotation's position (used when navigating from the tree)."""
        self._clear_flash()
        if annot.page >= len(self._page_rects):
            return
        origin = self._page_rects[annot.page].topLeft()
        pen = QPen(QColor("#38bdf8"), 2.0)
        rects: List[QRectF] = []
        if annot.quads:
            rects = [QRectF(origin.x() + x0, origin.y() + y0, x1 - x0, y1 - y0)
                     for (x0, y0, x1, y1) in annot.quads]
        elif annot.point is not None:
            x, y = annot.point
            rects = [QRectF(origin.x() + x - 5, origin.y() + y - 5, NOTE_MARKER_SIZE + 10, NOTE_MARKER_SIZE + 10)]
        for rect in rects:
            item = QGraphicsRectItem(rect)
            item.setPen(pen)
            item.setBrush(QBrush(QColor(56, 189, 248, 45)))
            item.setZValue(4)
            self._scene.addItem(item)
            self._flash_items.append(item)
        if self._flash_items:
            self._flash_timer.start(1500)

    def _clear_flash(self) -> None:
        for item in self._flash_items:
            self._scene.removeItem(item)
        self._flash_items.clear()

    def _apply_transient_zoom(self, factor: float, anchor_view: QPoint) -> None:
        self._auto_fit = False
        total = self._committed_scale * self._transient_factor * factor
        if total < MIN_SCALE:
            factor = MIN_SCALE / (self._committed_scale * self._transient_factor)
        elif total > MAX_SCALE:
            factor = MAX_SCALE / (self._committed_scale * self._transient_factor)
        anchor_scene = self.mapToScene(anchor_view)
        self._zoom_anchor = anchor_view
        self.scale(factor, factor)
        self._transient_factor *= factor
        self._restore_anchor(anchor_view, anchor_scene)
        self._zoom_timer.start()

    def _commit_zoom(self) -> None:
        if abs(self._transient_factor - 1.0) < 1e-6:
            return
        new_scale = max(MIN_SCALE, min(MAX_SCALE, self._committed_scale * self._transient_factor))
        anchor = self._zoom_anchor
        anchor_scene = self.mapToScene(anchor)
        self._committed_scale = new_scale
        self._transient_factor = 1.0
        self.setTransform(QTransform().scale(new_scale, new_scale))
        self._restore_anchor(anchor, anchor_scene)
        self.zoomChanged.emit(new_scale)
        self._manager.set_scale(new_scale, self.devicePixelRatioF())
        self._update_visible()

    def _restore_anchor(self, anchor_view: QPoint, anchor_scene: QPointF) -> None:
        current = self.mapFromScene(anchor_scene)
        delta = current - anchor_view
        self.horizontalScrollBar().setValue(self.horizontalScrollBar().value() + delta.x())
        self.verticalScrollBar().setValue(self.verticalScrollBar().value() + delta.y())

    # -- rendering callbacks ------------------------------------------------ #
    def _on_page_ready(self, key: RenderKey, pixmap: QPixmap) -> None:
        if key.page < 0 or key.page >= len(self._page_rects):
            return
        if key.bucket != render_bucket(self._committed_scale):
            return
        item = self._page_items.get(key.page)
        if item is None:
            item = QGraphicsPixmapItem()
            item.setTransformationMode(Qt.TransformationMode.SmoothTransformation)
            item.setZValue(1)
            shadow = QGraphicsDropShadowEffect()
            shadow.setBlurRadius(24)
            shadow.setOffset(0, 7)
            shadow.setColor(QColor(0, 0, 0, 175))
            item.setGraphicsEffect(shadow)
            self._scene.addItem(item)
            self._page_items[key.page] = item
        item.setPixmap(pixmap)
        item.setScale(1.0 / (self._committed_scale * max(1.0, self.devicePixelRatioF())))
        item.setPos(self._page_rects[key.page].topLeft())

    # -- visibility --------------------------------------------------------- #
    def _schedule_visible_update(self) -> None:
        self._visible_timer.start()

    def resizeEvent(self, event) -> None:
        super().resizeEvent(event)
        self._manager.set_scale(self._committed_scale, self.devicePixelRatioF())
        if self._auto_fit:
            self._fit_timer.start()
        self._schedule_visible_update()

    def scrollContentsBy(self, dx: int, dy: int) -> None:
        super().scrollContentsBy(dx, dy)
        self._schedule_visible_update()

    def _visible_pages(self, scene_rect: QRectF) -> List[int]:
        if not self._page_rects:
            return []
        top, bottom = scene_rect.top(), scene_rect.bottom()
        start = max(0, bisect.bisect_right(self._page_tops, top) - 1)
        pages: List[int] = []
        for index in range(start, len(self._page_rects)):
            rect = self._page_rects[index]
            if rect.top() > bottom:
                break
            if rect.bottom() >= top:
                pages.append(index)
        return pages

    def _update_visible(self) -> None:
        if not self._page_rects:
            return
        scene_rect = self.mapToScene(self.viewport().rect()).boundingRect()
        pages = self._visible_pages(scene_rect)
        if not pages:
            return
        center_y = scene_rect.center().y()
        current = pages[0]
        for index in pages:
            if self._page_rects[index].top() <= center_y <= self._page_rects[index].bottom():
                current = index
                break
        self.currentPageChanged.emit(current)
        self._manager.set_visible(pages, current)

    def _page_at(self, scene_pt: QPointF) -> Optional[int]:
        if not self._page_rects:
            return None
        index = bisect.bisect_right(self._page_tops, scene_pt.y()) - 1
        if 0 <= index < len(self._page_rects) and self._page_rects[index].contains(scene_pt):
            return index
        return index if 0 <= index < len(self._page_rects) else None

    # -- annotation interaction -------------------------------------------- #
    def _make_temp_item(self, kind: str, pt: QPointF):
        if kind == "underline":
            item = QGraphicsLineItem(pt.x(), pt.y(), pt.x(), pt.y())
            item.setPen(QPen(QColor("#38bdf8"), 2.5))
        else:
            item = QGraphicsRectItem(QRectF(pt, pt))
            item.setPen(QPen(QColor(56, 189, 248, 220), 1.2))
            item.setBrush(QBrush(QColor(56, 189, 248, 60)))
        item.setZValue(3)
        self._scene.addItem(item)
        return item

    def _update_temp_item(self, kind: str, origin: QPointF, current: QPointF) -> None:
        rect = QRectF(origin, current).normalized()
        if kind == "underline":
            y = rect.bottom()
            self._temp_item.setLine(rect.left(), y, rect.right(), y)
        else:
            self._temp_item.setRect(rect)

    def mousePressEvent(self, event) -> None:
        if event.button() == Qt.MouseButton.LeftButton and self._page_rects:
            scene_pt = self.mapToScene(event.pos())
            page = self._page_at(scene_pt)
            if page is not None and self._mode in (TEXT_MARKUP_TOOLS + DRAG_RECT_TOOLS):
                self._drag_page = page
                self._drag_origin = scene_pt
                self._drag_kind = self._mode
                self._temp_item = self._make_temp_item(self._mode, scene_pt)
                return
            if page is not None and self._mode in CLICK_TOOLS:
                self.tool_gesture.emit(self._mode, page, scene_pt - self._page_rects[page].topLeft())
                return
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event) -> None:
        if self._temp_item is not None and self._drag_origin is not None:
            self._update_temp_item(self._drag_kind or "highlight", self._drag_origin,
                                   self.mapToScene(event.pos()))
            return
        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event) -> None:
        if self._temp_item is not None and self._drag_page is not None:
            rect = QRectF(self._drag_origin, self.mapToScene(event.pos())).normalized()
            self._scene.removeItem(self._temp_item)
            self._temp_item = None
            origin = self._page_rects[self._drag_page].topLeft()
            local = rect.translated(-origin.x(), -origin.y())
            page = self._drag_page
            kind = self._drag_kind or "highlight"
            self._drag_page = None
            self._drag_origin = None
            self._drag_kind = None
            if local.width() > 3 and local.height() > 3:
                self.tool_gesture.emit(kind, page, local)
            return
        super().mouseReleaseEvent(event)

    # -- navigation --------------------------------------------------------- #
    def goto_page(self, page: int) -> None:
        if not self._page_rects:
            return
        page = max(0, min(page, len(self._page_rects) - 1))
        self.ensureVisible(self._page_rects[page], 0, 0)
        self._update_visible()

    def current_page(self) -> int:
        if not self._page_rects:
            return 0
        scene_rect = self.mapToScene(self.viewport().rect()).boundingRect()
        pages = self._visible_pages(scene_rect)
        if not pages:
            return 0
        center_y = scene_rect.center().y()
        for index in pages:
            if self._page_rects[index].top() <= center_y <= self._page_rects[index].bottom():
                return index
        return pages[0]


# --------------------------------------------------------------------------- #
# Main window (toolbar, comments dock, native save)
# --------------------------------------------------------------------------- #

class CommentCard(QFrame):
    """Compact modern card used as an item widget in the comments tree."""

    activated = pyqtSignal(int)
    delete_requested = pyqtSignal(int)

    def __init__(self, index: int, snippet: str, meta: str,
                 color: QColor, parent: Optional[QWidget] = None) -> None:
        super().__init__(parent)
        self._index = index
        self.setObjectName("card")
        self.setCursor(Qt.CursorShape.PointingHandCursor)

        row = QHBoxLayout(self)
        row.setContentsMargins(10, 8, 8, 8)
        row.setSpacing(8)

        badge = QLabel()
        badge.setFixedSize(14, 14)
        badge.setStyleSheet(
            f"background-color: {color.name()}; border-radius: 4px;"
            " border: 1px solid rgba(255,255,255,0.15);"
        )
        row.addWidget(badge, 0, Qt.AlignmentFlag.AlignTop)

        column = QVBoxLayout()
        column.setSpacing(2)
        snippet_label = QLabel(snippet)
        snippet_label.setObjectName("snippet")
        snippet_label.setWordWrap(True)
        meta_label = QLabel(meta)
        meta_label.setObjectName("meta")
        column.addWidget(snippet_label)
        column.addWidget(meta_label)
        row.addLayout(column, 1)

        self._trash = QToolButton()
        self._trash.setObjectName("cardTrash")
        self._trash.setIcon(make_icon("trash", "#94a3b8", 32))
        self._trash.setIconSize(QSize(15, 15))
        self._trash.setToolTip("حذف التعليق")
        self._trash.setCursor(Qt.CursorShape.PointingHandCursor)
        self._trash.setVisible(False)
        self._trash.clicked.connect(lambda: self.delete_requested.emit(self._index))
        row.addWidget(self._trash, 0, Qt.AlignmentFlag.AlignTop)

    def enterEvent(self, event) -> None:
        self._trash.setVisible(True)
        super().enterEvent(event)

    def leaveEvent(self, event) -> None:
        self._trash.setVisible(False)
        super().leaveEvent(event)

    def mousePressEvent(self, event) -> None:
        self.activated.emit(self._index)
        super().mousePressEvent(event)


class PDFReaderWindow(QMainWindow):
    def __init__(self, path: Optional[str] = None, book_id: Optional[str] = None) -> None:
        super().__init__()
        self.setWindowTitle("مَتن — محرر وعارض المستندات")
        self.setLayoutDirection(Qt.LayoutDirection.RightToLeft)
        self.setFont(QFont(ARABIC_FONT_FAMILY, 10))
        self.setStyleSheet(MODERN_DARK_STYLE)
        self.resize(1340, 880)
        self.book_id = book_id

        self._registry = DocumentRegistry()
        self._pool = QThreadPool(self)
        self._pool.setMaxThreadCount(max(2, (os.cpu_count() or 4) - 1))
        self._manager = PageCacheManager(self._registry, self._pool, self)
        self._manager.render_failed.connect(self._on_render_failed)

        self._annotations: List[Annotation] = []
        self._current_path: Optional[str] = None
        self._dirty = False
        self._active_color: Optional[Tuple[float, float, float]] = None
        self._selected_index: Optional[int] = None
        self._item_by_index: Dict[int, QTreeWidgetItem] = {}

        self.viewport = PDFViewport(self._manager, self)
        self.viewport.zoomChanged.connect(self._on_zoom_changed)
        self.viewport.currentPageChanged.connect(self._on_page_changed)
        self.viewport.tool_gesture.connect(self._on_tool_gesture)
        self.setCentralWidget(self.viewport)

        self._build_toolbar()
        self._build_comments_dock()
        self.setStatusBar(QStatusBar(self))
        self._status("جاهز")

        if path:
            self.open_document(path)

    # -- UI ----------------------------------------------------------------- #
    def _build_toolbar(self) -> None:
        toolbar = QToolBar("Main", self)
        toolbar.setMovable(False)
        toolbar.setIconSize(QSize(19, 19))
        toolbar.setToolButtonStyle(Qt.ToolButtonStyle.ToolButtonIconOnly)
        self.addToolBar(toolbar)

        def add(icon: str, tip: str, slot, checkable: bool = False, shortcut=None) -> QAction:
            action = QAction(make_icon(icon, "#cbd5e1", 44), "", self)
            action.setToolTip(tip)
            action.setCheckable(checkable)
            if shortcut is not None:
                action.setShortcut(shortcut)
            action.triggered.connect(slot)
            toolbar.addAction(action)
            return action

        def pill(*widgets: QWidget) -> QFrame:
            frame = QFrame()
            frame.setObjectName("pill")
            lay = QHBoxLayout(frame)
            lay.setContentsMargins(6, 1, 6, 1)
            lay.setSpacing(2)
            for widget in widgets:
                lay.addWidget(widget)
            return frame

        # --- Island 1: file & navigation --------------------------------- #
        add("open", "افتح مستند PDF", self._choose_file, shortcut=QKeySequence.StandardKey.Open)
        add("save", "حفظ التعديلات كتعليقات PDF أصلية",
            lambda: self.save_native(overwrite=True), shortcut=QKeySequence.StandardKey.Save)
        add("export", "حفظ باسم / تصدير نسخة", lambda: self.save_native(overwrite=False))

        add("prev", "الصفحة السابقة", lambda: self.viewport.goto_page(self.viewport.current_page() - 1))
        self.page_spin = QSpinBox(self)
        self.page_spin.setMinimum(1)
        self.page_spin.setMaximum(1)
        self.page_spin.setToolTip("انتقل إلى صفحة")
        self.page_spin.valueChanged.connect(lambda v: self.viewport.goto_page(v - 1))
        self.page_label = QLabel(" / 0 ", self)
        self.page_label.setObjectName("totalPages")
        toolbar.addWidget(pill(self.page_spin, self.page_label))
        add("next", "الصفحة التالية", lambda: self.viewport.goto_page(self.viewport.current_page() + 1))

        toolbar.addSeparator()

        # --- Island 2: view & zoom --------------------------------------- #
        add("zoom_out", "تصغير العرض", self.viewport.zoom_out)
        self.zoom_label = QLabel(" 100% ", self)
        self.zoom_label.setObjectName("pill")
        toolbar.addWidget(self.zoom_label)
        add("zoom_in", "تكبير العرض", self.viewport.zoom_in)
        add("fit_width", "ملاءمة العرض للنافذة", lambda: self.viewport.fit_width())
        add("fit_page", "ملاءمة الصفحة كاملة", self.viewport.fit_page)
        add("actual", "الحجم الطبيعي (100%)", self._zoom_actual)

        toolbar.addSeparator()

        # --- Island 3: annotation tools ---------------------------------- #
        self.pan_act = add("pan", "أداة التحريك (يد)", lambda _checked=False: self._switch_mode("pan"), checkable=True)
        self.pan_act.setChecked(True)
        self._tool_actions = {"pan": self.pan_act}

        def add_tool(mode: str, icon: str, tip: str) -> None:
            action = add(icon, tip, lambda _checked=False, m=mode: self._switch_mode(m), checkable=True)
            self._tool_actions[mode] = action

        add_tool("highlight", "highlight", "تظليل نصي: اسحب فوق النص (تُلتقط الكلمات تلقائيًا)")
        add_tool("underline", "underline", "تسطير النص المحدد")
        add_tool("area", "area", "تظليل مساحة: ارسم مستطيلًا حرًا فوق أي جزء من الصفحة")
        add_tool("note", "note", "ملاحظة ملصقة: انقر في أي موضع")
        add_tool("benefit", "star", "تسجيل فائدة: نقطة سريعة لفائدة أو خاطرة")
        add_tool("freetext", "type", "كتابة على الصفحة: انقر ثم اكتب (Typewriter)")
        add_tool("stamp", "clock", "ختم التاريخ والوقت الحالي")

        self.color_combo = QComboBox(self)
        self.color_combo.setToolTip("لون التعليقات الجديدة (التظليل، التسطير، المساحة، الملاحظات...)")
        self.color_combo.addItem(make_color_icon((0.6, 0.6, 0.6)), "افتراضي", None)
        for name, rgb in COLOR_PALETTE:
            self.color_combo.addItem(make_color_icon(rgb), name, rgb)
        self.color_combo.addItem(make_color_icon((0.8, 0.8, 0.8)), "مخصص…", "custom")
        self.color_combo.currentIndexChanged.connect(self._on_color_changed)
        toolbar.addWidget(self.color_combo)
        add("paint", "تطبيق اللون الحالي على التعليق المحدد", self._recolor_selected)

    def _build_comments_dock(self) -> None:
        dock = QDockWidget("سجل التعليقات والملاحظات", self)
        dock.setAllowedAreas(Qt.DockWidgetArea.LeftDockWidgetArea | Qt.DockWidgetArea.RightDockWidgetArea)

        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.setSpacing(8)

        self.comments_tree = QTreeWidget()
        self.comments_tree.setHeaderHidden(True)
        self.comments_tree.setRootIsDecorated(True)
        self.comments_tree.setIconSize(QSize(17, 17))
        self.comments_tree.setUniformRowHeights(False)
        self.comments_tree.setIndentation(14)
        self.comments_tree.itemClicked.connect(self._on_comment_activated)
        layout.addWidget(self.comments_tree)

        dock.setWidget(panel)
        self.addDockWidget(Qt.DockWidgetArea.LeftDockWidgetArea, dock)

    def _switch_mode(self, mode: str) -> None:
        for name, action in self._tool_actions.items():
            action.setChecked(name == mode)
        self.viewport.set_mode(mode)

    def _zoom_actual(self) -> None:
        self.viewport.set_auto_fit(False)
        self.viewport.set_scale_absolute(1.0)

    def _on_color_changed(self, index: int) -> None:
        data = self.color_combo.currentData()
        if data == "custom":
            current = self._active_color or HIGHLIGHT_DEFAULT
            chosen = QColorDialog.getColor(qcolor(current, 255), self, "اختر لون التعليق")
            if chosen.isValid():
                self._active_color = (chosen.redF(), chosen.greenF(), chosen.blueF())
                self._status("لون التعليق النشط: مخصص")
            return
        self._active_color = tuple(data) if data else None
        self._status(f"لون التعليق النشط: {self.color_combo.currentText()}")

    def _color_for(self, default: Tuple[float, float, float]) -> Tuple[float, float, float]:
        return self._active_color if self._active_color else default

    def _recolor_selected(self) -> None:
        index = self._selected_index
        if index is None or not (0 <= index < len(self._annotations)):
            self._status("حدّد تعليقًا من القائمة لتلوينه")
            return
        color = self._active_color
        if color is None:
            self._status("اختر لونًا من القائمة أولًا")
            return
        annot = self._annotations[index]
        replacement = Annotation(
            page=annot.page, kind=annot.kind, color=color, text=annot.text,
            quads=annot.quads, point=annot.point, rect=annot.rect, created=annot.created,
        )
        if annot.xref is not None:
            annot.deleted = True          # old native annotation removed on save
        else:
            self._annotations.pop(index)
        self._annotations.append(replacement)
        self._selected_index = len(self._annotations) - 1
        self._mark_dirty()
        self.viewport.set_annotations(self._annotations)
        self._reload_comments()
        self.viewport.flash_annotation(replacement)
        self._status("تم تلوين التعليق المحدد")

    # -- document loading --------------------------------------------------- #
    def _choose_file(self) -> None:
        path, _ = QFileDialog.getOpenFileName(self, "افتح ملف PDF", "", "PDF (*.pdf)")
        if path:
            self.open_document(path)

    def open_document(self, path: str, preserve: Optional[dict] = None) -> None:
        if not os.path.isfile(path):
            QMessageBox.critical(self, "خطأ", f"الملف غير موجود:\n{path}")
            return
        self._manager.reset()
        self._pool.clear()
        self._pool.waitForDone(3000)
        self.viewport.clear()

        try:
            doc = self._registry.open(path)
            sizes = [page_display_size(doc.load_page(i)) for i in range(doc.page_count)]
        except Exception as exc:
            QMessageBox.critical(self, "خطأ", f"تعذّر فتح الملف:\n{exc}")
            return

        self._current_path = path
        self._dirty = False
        self._manager.reset()
        self.viewport.load_pages(sizes)
        self._import_annotations()

        self.page_spin.blockSignals(True)
        self.page_spin.setMaximum(max(1, len(sizes)))
        self.page_spin.blockSignals(False)
        self._on_page_changed(self.viewport.current_page())
        self.page_label.setText(f" / {len(sizes)} ")

        if preserve:
            self.viewport.set_auto_fit(False)
            self.viewport.set_scale_absolute(preserve.get("scale", 1.0))
            self.viewport.goto_page(preserve.get("page", 0))

        self._update_title()
        self._status(f"{len(sizes)} صفحة · {os.path.basename(path)}")

    def _update_title(self) -> None:
        name = os.path.basename(self._current_path) if self._current_path else ""
        star = " *" if self._dirty else ""
        self.setWindowTitle(f"مَتن - {name}{star}")

    # -- annotations <-> document ------------------------------------------ #
    def _import_annotations(self) -> None:
        self._annotations = []
        doc = self._registry.main
        if doc is None:
            self.viewport.set_annotations(self._annotations)
            self._reload_comments()
            return
        kind_map = {
            "Highlight": "highlight", "Underline": "underline",
            "StrikeOut": "strikeout", "Squiggly": "underline",
            "Text": "note", "FreeText": "freetext", "Square": "area",
        }
        for pno in range(doc.page_count):
            page = doc.load_page(pno)
            rot = page.rotation_matrix
            for annot in page.annots() or []:
                atype = annot.type[1]
                if atype not in kind_map:
                    continue
                kind = kind_map[atype]
                stroke = (annot.colors or {}).get("stroke")
                default_color = {
                    "note": NOTE_DEFAULT, "benefit": BENEFIT_DEFAULT,
                    "freetext": (0.10, 0.15, 0.20), "stamp": (0.10, 0.30, 0.60),
                    "area": AREA_DEFAULT, "underline": UNDERLINE_DEFAULT,
                }.get(kind, HIGHLIGHT_DEFAULT)
                color = tuple(stroke) if stroke and len(stroke) == 3 else default_color
                text = (annot.info or {}).get("content", "") or ""
                created = format_pdf_date((annot.info or {}).get("creationDate", ""))

                if kind == "note":
                    pt = (annot.rect.tl) * rot
                    # A leading marker restores the "benefit" category on reload.
                    if text.startswith("★"):
                        self._annotations.append(Annotation(
                            pno, "benefit", color, text.lstrip("★ ").strip(),
                            point=(pt.x, pt.y), created=created, xref=annot.xref))
                    else:
                        self._annotations.append(Annotation(
                            pno, "note", color, text,
                            point=(pt.x, pt.y), created=created, xref=annot.xref))
                    continue

                if kind in ("freetext", "stamp", "area"):
                    r = annot.rect * rot
                    self._annotations.append(Annotation(
                        pno, kind, color, text,
                        rect=(r.x0, r.y0, r.x1, r.y1), created=created, xref=annot.xref))
                    continue

                quads = []
                verts = annot.vertices
                if verts:
                    pts = []
                    for v in verts:
                        if hasattr(v, "x"):
                            pts.append((v.x, v.y))
                        else:
                            pts.append((v[0], v[1]))
                    for i in range(0, len(pts) - 3, 4):
                        xs = [pts[i + k][0] for k in range(4)]
                        ys = [pts[i + k][1] for k in range(4)]
                        quads.append((min(xs), min(ys), max(xs), max(ys)))
                if not quads:
                    r = annot.rect
                    quads.append((r.x0, r.y0, r.x1, r.y1))
                disp = []
                for (x0, y0, x1, y1) in quads:
                    r = fitz.Rect(x0, y0, x1, y1) * rot
                    disp.append((r.x0, r.y0, r.x1, r.y1))
                self._annotations.append(Annotation(pno, kind, color, text,
                                                    quads=disp, created=created, xref=annot.xref))
        self.viewport.set_annotations(self._annotations)
        self._reload_comments()

    @staticmethod
    def _line_quads(page: fitz.Page, drag: fitz.Rect) -> List[fitz.Rect]:
        """Merge the selected words of each text line into one straight band.

        Arabic diacritics make individual word boxes uneven (jagged, unequal
        heights). Grouping by (block, line) and normalizing every line to a
        common height yields clean, uniform highlight bars like Adobe/Foxit.
        """
        try:
            words = page.get_text("words", clip=drag)
        except Exception:
            return []
        if not words:
            return []
        groups: Dict[Tuple[int, int], list] = {}
        for w in words:
            groups.setdefault((w[5], w[6]), []).append(w)

        bands = []
        for group in groups.values():
            x0 = min(w[0] for w in group)
            x1 = max(w[2] for w in group)
            y0 = min(w[1] for w in group)
            y1 = max(w[3] for w in group)
            bands.append((x0, y0, x1, y1))

        target = max((b[3] - b[1] for b in bands), default=0.0)
        quads: List[fitz.Rect] = []
        for (x0, y0, x1, y1) in bands:
            center = (y0 + y1) / 2.0
            quads.append(fitz.Rect(x0, center - target / 2.0, x1, center + target / 2.0))
        return quads

    def _on_tool_gesture(self, kind: str, page: int, payload) -> None:
        try:
            if kind in ("highlight", "underline"):
                self._create_markup(page, payload, kind)
            elif kind == "area":
                self._create_area(page, payload)
            elif kind == "note":
                self._create_note(page, payload)
            elif kind == "benefit":
                self._create_benefit(page, payload)
            elif kind == "freetext":
                self._create_freetext(page, payload)
            elif kind == "stamp":
                self._create_stamp(page, payload)
        except Exception as exc:
            self._status(f"تعذّر إنشاء التعليق: {exc}")

    def _push(self, annot: Annotation) -> None:
        self._annotations.append(annot)
        self._mark_dirty()
        self.viewport.set_annotations(self._annotations)
        self._reload_comments()
        self.viewport.flash_annotation(annot)

    @staticmethod
    def _now() -> str:
        return datetime.now().strftime("%Y-%m-%d %H:%M")

    def _create_markup(self, page: int, rect: QRectF, kind: str) -> None:
        doc = self._registry.main
        if doc is None:
            return
        fitz_page = doc.load_page(page)
        drag = fitz.Rect(rect.left(), rect.top(), rect.right(), rect.bottom()) * fitz_page.derotation_matrix
        quads_fitz = self._line_quads(fitz_page, drag) or [drag]
        rot = fitz_page.rotation_matrix
        disp = []
        quote_parts = []
        for q in quads_fitz:
            r = q * rot
            disp.append((r.x0, r.y0, r.x1, r.y1))
            try:
                words = fitz_page.get_text("words", clip=q)
                line = " ".join(w[4] for w in words).strip()
            except Exception:
                line = ""
            if line:
                quote_parts.append(line)
        color = self._color_for(HIGHLIGHT_DEFAULT if kind == "highlight" else UNDERLINE_DEFAULT)
        self._push(Annotation(page, kind, color, " ".join(quote_parts).strip(),
                              created=self._now(), quads=disp))

    def _create_area(self, page: int, rect: QRectF) -> None:
        self._push(Annotation(page, "area", self._color_for(AREA_DEFAULT), created=self._now(),
                              rect=(rect.left(), rect.top(), rect.right(), rect.bottom())))

    def _create_note(self, page: int, point: QPointF) -> None:
        text, ok = QInputDialog.getMultiLineText(self, "إضافة ملاحظة", "اكتب ملاحظتك هنا:")
        if not ok or not text.strip():
            return
        self._push(Annotation(page, "note", self._color_for(NOTE_DEFAULT), text.strip(),
                              point=(point.x(), point.y()), created=self._now()))

    def _create_benefit(self, page: int, point: QPointF) -> None:
        text, ok = QInputDialog.getMultiLineText(self, "تسجيل فائدة", "اكتب الفائدة أو الخاطرة:")
        if not ok or not text.strip():
            return
        self._push(Annotation(page, "benefit", self._color_for(BENEFIT_DEFAULT), text.strip(),
                              point=(point.x(), point.y()), created=self._now()))

    def _create_freetext(self, page: int, point: QPointF) -> None:
        text, ok = QInputDialog.getMultiLineText(self, "الكتابة على الصفحة", "اكتب النص:")
        if not ok or not text.strip():
            return
        lines = text.strip().count("\n") + 1
        rect = (point.x(), point.y(), point.x() + 240.0, point.y() + 18.0 * lines + 10.0)
        self._push(Annotation(page, "freetext", self._color_for((0.10, 0.15, 0.20)), text.strip(),
                              rect=rect, created=self._now()))

    def _create_stamp(self, page: int, point: QPointF) -> None:
        stamp = datetime.now().strftime("%Y-%m-%d %H:%M")
        rect = (point.x(), point.y(), point.x() + 150.0, point.y() + 22.0)
        self._push(Annotation(page, "stamp", self._color_for((0.10, 0.30, 0.60)), stamp,
                              rect=rect, created=self._now()))
        self._status(f"أُدرج ختم التاريخ والوقت: {stamp}")

    def _reload_comments(self) -> None:
        names = {
            "highlight": "تظليل نصي", "underline": "تسطير", "strikeout": "شطب",
            "note": "ملاحظة", "benefit": "فائدة", "area": "تظليل مساحة",
            "freetext": "كتابة", "stamp": "ختم وقت",
        }
        markup = ("highlight", "underline", "strikeout")
        # Release previously attached item widgets explicitly so repeated
        # refreshes do not leak card widgets.
        for i in range(self.comments_tree.topLevelItemCount()):
            root_item = self.comments_tree.topLevelItem(i)
            for j in range(root_item.childCount()):
                child_item = root_item.child(j)
                widget = self.comments_tree.itemWidget(child_item, 0)
                if widget is not None:
                    self.comments_tree.removeItemWidget(child_item, 0)
                    widget.setParent(None)
                    widget.deleteLater()
        self.comments_tree.clear()
        self._item_by_index = {}

        by_page: Dict[int, List[int]] = {}
        for index, annot in enumerate(self._annotations):
            if annot.deleted:
                continue
            by_page.setdefault(annot.page, []).append(index)

        for page in sorted(by_page):
            indices = by_page[page]
            root = QTreeWidgetItem(self.comments_tree)
            root.setText(0, f"صفحة {page + 1}   ·   {arabic_plural(len(indices))}")
            root.setIcon(0, make_icon("page", "#94a3b8", 32))
            root.setData(0, Qt.ItemDataRole.UserRole, ("page", page))
            root_font = root.font(0)
            root_font.setBold(True)
            root.setFont(0, root_font)

            for index in indices:
                annot = self._annotations[index]
                child = QTreeWidgetItem(root)
                default_snippet = "تظليل" if annot.kind in markup else "بدون نص"
                snippet = annot.text.strip() or default_snippet
                meta = f"صفحة {annot.page + 1}   ·   {names.get(annot.kind, annot.kind)}"
                if annot.created:
                    meta += f"   ·   {annot.created}"
                card = CommentCard(index, snippet[:120], meta, qcolor(annot.color, 255))
                card.activated.connect(self._focus_annotation_index)
                card.delete_requested.connect(self._delete_annotation_index)
                child.setSizeHint(0, QSize(0, 62))
                self.comments_tree.setItemWidget(child, 0, card)
                self._item_by_index[index] = child
            root.setExpanded(True)

    def _on_comment_activated(self, item: QTreeWidgetItem, column: int) -> None:
        data = item.data(0, Qt.ItemDataRole.UserRole)
        if data and data[0] == "page":
            self.viewport.goto_page(data[1])

    def _focus_annotation_index(self, index: int) -> None:
        if not (0 <= index < len(self._annotations)):
            return
        self._selected_index = index
        annot = self._annotations[index]
        self.viewport.goto_page(annot.page)
        self.viewport.flash_annotation(annot)
        item = self._item_by_index.get(index)
        if item is not None:
            self.comments_tree.setCurrentItem(item)

    def _delete_annotation_index(self, index: int) -> None:
        if not (0 <= index < len(self._annotations)):
            return
        annot = self._annotations[index]
        if annot.xref is not None:
            annot.deleted = True          # removed from the file on next save
        else:
            self._annotations.pop(index)  # never committed yet
        self._selected_index = None
        self._mark_dirty()
        self.viewport.set_annotations(self._annotations)
        self._reload_comments()

    def _mark_dirty(self) -> None:
        self._dirty = True
        self._update_title()

    # -- native save -------------------------------------------------------- #
    @staticmethod
    def _model_rects_fitz(page: fitz.Page, annot: Annotation) -> List[fitz.Rect]:
        derot = page.derotation_matrix
        if annot.quads:
            return [fitz.Rect(*q) * derot for q in annot.quads]
        if annot.rect:
            return [fitz.Rect(*annot.rect) * derot]
        if annot.point is not None:
            x, y = annot.point
            return [fitz.Rect(x, y, x + 24, y + 24) * derot]
        return []

    def _add_model_annotation(self, doc: fitz.Document, annot: Annotation) -> None:
        page = doc.load_page(annot.page)
        derot = page.derotation_matrix
        if annot.kind in ("highlight", "underline", "strikeout") and annot.quads:
            rects = [fitz.Rect(*q) * derot for q in annot.quads]
            if annot.kind == "highlight":
                a = page.add_highlight_annot(rects)
            elif annot.kind == "underline":
                a = page.add_underline_annot(rects)
            else:
                a = page.add_strikeout_annot(rects)
            a.set_colors(stroke=annot.color)
            if annot.text:
                a.set_info(content=annot.text)
            a.update()
        elif annot.kind == "area" and annot.rect:
            rect = fitz.Rect(*annot.rect) * derot
            a = page.add_rect_annot(rect)
            a.set_colors(stroke=annot.color, fill=annot.color)
            a.set_opacity(0.35)
            a.set_border(width=1)
            if annot.text:
                a.set_info(content=annot.text)
            a.update()
        elif annot.kind in ("freetext", "stamp") and annot.rect:
            rect = fitz.Rect(*annot.rect) * derot
            fill = (1, 1, 1) if annot.kind == "freetext" else (0.9, 0.95, 1.0)
            a = page.add_freetext_annot(
                rect, annot.text, fontsize=12, fontname="helv",
                text_color=(0, 0, 0), fill_color=fill, border_color=annot.color,
            )
            a.set_info(content=annot.text)
            a.update()
        elif annot.kind in ("note", "benefit") and annot.point is not None:
            pt = fitz.Point(*annot.point) * derot
            content = annot.text
            if annot.kind == "benefit":
                content = "★ " + annot.text
            a = page.add_text_annot(pt, content)
            a.set_colors(stroke=annot.color)
            a.update()

    def _delete_by_xref(self, doc: fitz.Document) -> None:
        deleted = {a.xref for a in self._annotations if a.deleted and a.xref is not None}
        if not deleted:
            return
        for pno in range(doc.page_count):
            page = doc.load_page(pno)
            for annot in list(page.annots() or []):
                if annot.xref in deleted:
                    page.delete_annot(annot)

    def _delete_by_geometry(self, doc: fitz.Document) -> None:
        for annot in self._annotations:
            if not annot.deleted:
                continue
            page = doc.load_page(annot.page)
            targets = self._model_rects_fitz(page, annot)
            for existing in list(page.annots() or []):
                if any(existing.rect.intersects(t) for t in targets):
                    page.delete_annot(existing)

    def _write_annotations(self, doc: fitz.Document, exact_delete: bool) -> None:
        if exact_delete:
            self._delete_by_xref(doc)
        else:
            self._delete_by_geometry(doc)
        for annot in self._annotations:
            if annot.deleted or annot.xref is not None:
                continue
            self._add_model_annotation(doc, annot)

    @staticmethod
    def _rebuild_clean(source: str) -> fitz.Document:
        """Rebuild a damaged document into a clean, saveable copy."""
        fresh = fitz.open(source)
        clean = fitz.open()
        clean.insert_pdf(fresh, annots=True, links=True)
        try:
            toc = fresh.get_toc()
            if toc:
                clean.set_toc(toc)
        except Exception:
            pass
        fresh.close()
        return clean

    def save_native(self, overwrite: bool) -> None:
        doc = self._registry.main
        if doc is None:
            return
        source = self._current_path
        if overwrite and source:
            target = source
        else:
            default = (os.path.splitext(source)[0] + "_annotated.pdf") if source else ""
            target, _ = QFileDialog.getSaveFileName(self, "حفظ مع التعليقات", default, "PDF (*.pdf)")
            if not target:
                return

        scale = self.viewport._committed_scale
        page = self.viewport.current_page()

        self._manager.reset()
        self._pool.clear()
        self._pool.waitForDone(3000)

        try:
            self._write_annotations(doc, exact_delete=True)
            if overwrite and target == source:
                tmp = target + ".~annot.tmp"
                doc.save(tmp, garbage=3, deflate=True, encryption=fitz.PDF_ENCRYPT_KEEP)
                self._registry.close()
                os.replace(tmp, target)
            else:
                doc.save(target, garbage=3, deflate=True, encryption=fitz.PDF_ENCRYPT_KEEP)
                self._registry.close()
            self.open_document(target, preserve={"scale": scale, "page": page})
            self._status("تم حفظ المستند مع التعليقات الأصلية.")
            return
        except Exception:
            pass  # fall through to the repair path

        try:
            self._registry.close()
            clean = self._rebuild_clean(source)
            self._write_annotations(clean, exact_delete=False)
            if overwrite and target == source:
                tmp = target + ".~annot.tmp"
                clean.save(tmp, garbage=3, deflate=True)
                clean.close()
                os.replace(tmp, target)
            else:
                clean.save(target, garbage=3, deflate=True)
                clean.close()
            self.open_document(target, preserve={"scale": scale, "page": page})
            self._status("تم الحفظ بعد إصلاح بنية الملف.")
        except Exception as exc:
            QMessageBox.critical(self, "خطأ", f"تعذّر الحفظ:\n{exc}")
            if source:
                self.open_document(source, preserve={"scale": scale, "page": page})

    # -- signals ------------------------------------------------------------ #
    def _on_zoom_changed(self, scale: float) -> None:
        self.zoom_label.setText(f" {scale * 100:.0f}% ")

    def _on_page_changed(self, page: int) -> None:
        self.page_spin.blockSignals(True)
        self.page_spin.setValue(page + 1)
        self.page_spin.blockSignals(False)

    def _on_render_failed(self, message: str) -> None:
        self._status(f"تعذّر عرض صفحة: {message}")

    def _status(self, text: str) -> None:
        self.statusBar().showMessage(text, 5000)

    # -- shutdown ----------------------------------------------------------- #
    def closeEvent(self, event) -> None:
        if self._dirty:
            reply = QMessageBox.question(
                self, "تغييرات غير محفوظة",
                "هل تريد حفظ التعليقات قبل الإغلاق؟",
                QMessageBox.StandardButton.Save | QMessageBox.StandardButton.Discard
                | QMessageBox.StandardButton.Cancel,
            )
            if reply == QMessageBox.StandardButton.Cancel:
                event.ignore()
                return
            if reply == QMessageBox.StandardButton.Save:
                self.save_native(overwrite=True)
        self.viewport._zoom_timer.stop()
        self.viewport._visible_timer.stop()
        self.viewport._fit_timer.stop()
        self._manager.shutdown()
        self._pool.clear()
        self._pool.waitForDone(3000)
        self._registry.close()
        super().closeEvent(event)


# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #

def _parse_args(argv: List[str]) -> Tuple[Optional[str], Optional[str]]:
    path: Optional[str] = None
    book_id: Optional[str] = None
    args = argv[1:]
    index = 0
    while index < len(args):
        arg = args[index]
        if arg == "--book-id" and index + 1 < len(args):
            book_id = args[index + 1]
            index += 2
            continue
        if not arg.startswith("--") and path is None:
            path = arg
        index += 1
    return path, book_id


def main() -> int:
    app = QApplication(sys.argv)
    app.setApplicationName("Matn PDF Reader")
    app.setFont(QFont(load_arabic_font(), 10))
    app.setLayoutDirection(Qt.LayoutDirection.RightToLeft)
    app.setStyleSheet(MODERN_DARK_STYLE)
    path, book_id = _parse_args(sys.argv)
    window = PDFReaderWindow(path, book_id)
    window.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
