import fitz
import os
from typing import Dict, Any, List, Tuple
from filelock import FileLock


def _hex_to_rgb(value: str) -> Tuple[float, float, float]:
    """Convert '#rrggbb' to a (r, g, b) tuple in 0..1."""
    fallback = (0.98, 0.80, 0.08)
    if not value or not isinstance(value, str):
        return fallback
    v = value.strip().lstrip('#')
    if len(v) == 3:
        v = ''.join(ch * 2 for ch in v)
    if len(v) != 6:
        return fallback
    try:
        return (int(v[0:2], 16) / 255.0, int(v[2:4], 16) / 255.0, int(v[4:6], 16) / 255.0)
    except ValueError:
        return fallback


class AnnotationModifierService:
    """Embed Matn annotations into a PDF copy using PyMuPDF.

    Two modes are supported and both preserve existing callers by defaulting to
    ``native``:

    * ``native``  — add real PDF annotation objects (highlight/underline/free
      text/circle/sticky note) that remain extractable and editable in standard
      readers.
    * ``flatten`` — draw the annotations into the page content so they become
      part of the page itself (no annotation objects).
    """

    # -- geometry helpers ---------------------------------------------------
    @staticmethod
    def _center_rect(page: fitz.Page, nx: float, ny: float, w_pts: float, h_pts: float) -> fitz.Rect:
        pw, ph = page.rect.width, page.rect.height
        cx, cy = nx * pw, ny * ph
        return fitz.Rect(cx - w_pts / 2, cy - h_pts / 2, cx + w_pts / 2, cy + h_pts / 2)

    @staticmethod
    def _norm_rect(page: fitz.Page, r: Dict[str, Any]) -> fitz.Rect:
        pw, ph = page.rect.width, page.rect.height
        x0 = r.get('x', 0.0) * pw
        y0 = r.get('y', 0.0) * ph
        x1 = (r.get('x', 0.0) + r.get('w', 0.0)) * pw
        y1 = (r.get('y', 0.0) + r.get('h', 0.0)) * ph
        return fitz.Rect(min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1))

    @staticmethod
    def _passage_rects(page: fitz.Page, data: Dict[str, Any]) -> List[fitz.Rect]:
        rects = data.get('rects') or []
        out = []
        for r in rects:
            rect = AnnotationModifierService._norm_rect(page, r)
            if rect.width > 0 and rect.height > 0:
                out.append(rect)
        return out

    # -- public API ---------------------------------------------------------
    @staticmethod
    def burn_annotations(
        pdf_path: str,
        output_path: str,
        annotations: List[Dict[str, Any]],
        mode: str = 'native',
    ) -> bool:
        import hashlib
        import tempfile

        path_hash = hashlib.md5(pdf_path.encode('utf-8')).hexdigest()
        lock_path = os.path.join(tempfile.gettempdir(), f"pdf_tools_{path_hash}.lock")

        with FileLock(lock_path):
            doc = None
            try:
                doc = fitz.open(pdf_path)
                if mode == 'flatten':
                    AnnotationModifierService._flatten(doc, annotations)
                else:
                    AnnotationModifierService._native(doc, annotations)
                doc.save(output_path, incremental=False, encryption=fitz.PDF_ENCRYPT_KEEP)
                doc.close()
                return True
            except Exception as e:
                print(f"Error exporting annotations: {e}")
                if doc is not None:
                    try:
                        doc.close()
                    except Exception:
                        pass
                return False

    # -- native annotation objects -----------------------------------------
    @staticmethod
    def _native(doc: fitz.Document, annotations: List[Dict[str, Any]]) -> None:
        for annot_data in annotations:
            page_num = annot_data.get('page')
            if not page_num or page_num > len(doc):
                continue

            page = doc[page_num - 1]
            nx, ny = annot_data.get('x', 0.0), annot_data.get('y', 0.0)
            atype = annot_data.get('type')
            data = annot_data.get('data', {}) or {}

            if atype == 'dot':
                rect = AnnotationModifierService._center_rect(page, nx, ny, 12, 12)
                color = (1, 0, 0) if data.get('color') == 'red' else (0, 0, 0)
                annot = page.add_circle_annot(rect)
                annot.set_colors(stroke=color, fill=color)
                annot.set_border(width=0)
                annot.update()

            elif atype == 'text':
                rect = AnnotationModifierService._center_rect(page, nx, ny, 180, 40)
                text = data.get('text', '')
                annot = page.add_freetext_annot(
                    rect, text, fontsize=10, fontname="helv",
                    text_color=(0, 0, 0), fill_color=(1, 1, 0.8)
                )
                if data.get('language') == 'ar':
                    annot.set_info(content=text)
                annot.update()

            elif atype == 'timestamp':
                rect = AnnotationModifierService._center_rect(page, nx, ny, 220, 25)
                label = f"{data.get('timestamp', '')} | Reading #{data.get('reading_count', 1)}"
                annot = page.add_freetext_annot(
                    rect, label, fontsize=8, text_color=(1, 1, 1), fill_color=(0.1, 0.1, 0.2)
                )
                annot.update()

            elif atype == 'highlight':
                rects = AnnotationModifierService._passage_rects(page, data)
                if rects:
                    annot = page.add_highlight_annot(rects)
                    annot.set_colors(stroke=_hex_to_rgb(data.get('colorHex') or '#facc15'))
                    annot.set_info(content=data.get('text') or data.get('quote') or '')
                    annot.update()

            elif atype == 'underline':
                rects = AnnotationModifierService._passage_rects(page, data)
                if rects:
                    annot = page.add_underline_annot(rects)
                    annot.set_colors(stroke=_hex_to_rgb(data.get('colorHex') or '#38bdf8'))
                    annot.set_info(content=data.get('text') or data.get('quote') or '')
                    annot.update()

            elif atype == 'note':
                pt = fitz.Point(nx * page.rect.width, ny * page.rect.height)
                annot = page.add_text_annot(pt, data.get('text') or data.get('quote') or '')
                annot.update()

    # -- flattened / burned appearance -------------------------------------
    @staticmethod
    def _flatten(doc: fitz.Document, annotations: List[Dict[str, Any]]) -> None:
        for annot_data in annotations:
            page_num = annot_data.get('page')
            if not page_num or page_num > len(doc):
                continue

            page = doc[page_num - 1]
            nx, ny = annot_data.get('x', 0.0), annot_data.get('y', 0.0)
            atype = annot_data.get('type')
            data = annot_data.get('data', {}) or {}

            if atype == 'dot':
                color = (1, 0, 0) if data.get('color') == 'red' else (0, 0, 0)
                shape = page.new_shape()
                shape.draw_circle(fitz.Point(nx * page.rect.width, ny * page.rect.height), 6)
                shape.finish(color=color, fill=color)
                shape.commit()

            elif atype == 'highlight':
                color = _hex_to_rgb(data.get('colorHex') or '#facc15')
                rects = AnnotationModifierService._passage_rects(page, data)
                if rects:
                    shape = page.new_shape()
                    for rect in rects:
                        shape.draw_rect(rect)
                    shape.finish(color=color, fill=color, fill_opacity=0.35)
                    shape.commit()

            elif atype == 'underline':
                color = _hex_to_rgb(data.get('colorHex') or '#38bdf8')
                rects = AnnotationModifierService._passage_rects(page, data)
                if rects:
                    shape = page.new_shape()
                    for rect in rects:
                        shape.draw_line(
                            fitz.Point(rect.x0, rect.y1),
                            fitz.Point(rect.x1, rect.y1),
                        )
                    shape.finish(color=color, width=2)
                    shape.commit()

            elif atype == 'text':
                rect = AnnotationModifierService._center_rect(page, nx, ny, 180, 40)
                page.insert_textbox(
                    rect, data.get('text', ''), fontsize=10, fontname="helv",
                    color=(0, 0, 0), fill=(1, 1, 0.8)
                )

            elif atype == 'timestamp':
                rect = AnnotationModifierService._center_rect(page, nx, ny, 220, 25)
                label = f"{data.get('timestamp', '')} | Reading #{data.get('reading_count', 1)}"
                page.insert_textbox(
                    rect, label, fontsize=8, fontname="helv",
                    color=(1, 1, 1), fill=(0.1, 0.1, 0.2)
                )

            elif atype == 'note':
                rect = AnnotationModifierService._center_rect(page, nx, ny, 160, 36)
                page.insert_textbox(
                    rect, data.get('text') or data.get('quote') or '', fontsize=9,
                    fontname="helv", color=(0, 0, 0), fill=(0.85, 0.98, 0.9)
                )
