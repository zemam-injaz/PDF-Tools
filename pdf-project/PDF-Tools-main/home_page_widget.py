import sys
from typing import Dict, Any, Callable

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGridLayout, QLabel, QPushButton,
    QScrollArea, QFrame, QSizePolicy
)
from PySide6.QtCore import Qt, QSize, Signal
from PySide6.QtGui import QFont, QPalette, QIcon


class SectionCard(QFrame):
    """Individual section card widget for the home page grid"""

    clicked = Signal(str)  # section_key

    def __init__(self, section_key: str, title: str, description: str, icon: str = "📄"):
        super().__init__()
        self.section_key = section_key
        self.title = title
        self.description = description
        self.icon = icon
        self.init_ui()

    def init_ui(self):
        """Initialize the section card UI with responsive design"""
        # Remove frame style to eliminate separators/borders
        self.setFrameStyle(QFrame.NoFrame)
        self.setLineWidth(0)

        # Use minimum size instead of fixed size for responsiveness
        self.setMinimumSize(300, 250)  # Further increased to accommodate larger text
        self.setMaximumSize(420, 330)  # Further increased to accommodate larger text

        # Set size policy for responsive behavior
        self.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)

        # Apply theme-aware styling
        self.setObjectName("SectionCard")
        self.apply_theme_styling()

        # Main layout with unified spacing (no separators)
        layout = QVBoxLayout(self)
        layout.setSpacing(8)  # Reduced spacing for unified look
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setAlignment(Qt.AlignCenter)

        # Icon - Large and prominent
        self.icon_label = QLabel(self.icon)
        self.icon_label.setAlignment(Qt.AlignCenter)
        self.icon_label.setFont(QFont("Arial", 48))  # Restored larger size
        self.icon_label.setObjectName("CardIcon")
        self.icon_label.setFixedHeight(70)  # Increased height for larger icons
        layout.addWidget(self.icon_label)

        # Title - Clear and readable with increased font size
        self.title_label = QLabel(self.title)
        self.title_label.setAlignment(Qt.AlignCenter)
        self.title_label.setFont(QFont("Arial", 19, QFont.Bold))  # Increased from 16px to 19px
        self.title_label.setObjectName("CardTitle")
        self.title_label.setWordWrap(True)
        self.title_label.setFixedHeight(60)  # Increased height to accommodate larger text
        layout.addWidget(self.title_label)

        # Description - Readable and informative with increased font size
        self.desc_label = QLabel(self.description)
        self.desc_label.setAlignment(Qt.AlignCenter)
        self.desc_label.setFont(QFont("Arial", 15))  # Increased from 13px to 15px
        self.desc_label.setObjectName("CardDescription")
        self.desc_label.setWordWrap(True)
        self.desc_label.setMinimumHeight(50)  # Increased minimum height for larger text
        layout.addWidget(self.desc_label)

        # Add stretch to push content to center
        layout.addStretch()

        # Make the card clickable
        self.setCursor(Qt.PointingHandCursor)
        self.mousePressEvent = self.on_card_clicked

    def apply_theme_styling(self, is_dark_theme=True):
        """Apply modern theme-aware styling to the card without separators"""
        if is_dark_theme:
            # Dark theme - Modern card design with subtle shadow
            self.setStyleSheet("""
                SectionCard {
                    background-color: #2d2d2d;
                    border: 1px solid #404040;
                    border-radius: 16px;
                    margin: 10px;
                    color: #ffffff;
                    padding: 4px;
                }
                SectionCard:hover {
                    background-color: #353535;
                    border-color: #1976D2;
                }
            """)
            # Unified label styles for dark theme - larger, readable text
            if hasattr(self, 'icon_label'):
                self.icon_label.setStyleSheet("""
                    color: #1976D2;
                    background: transparent;
                    border: none;
                    padding: 8px;
                    margin: 0px;
                    font-size: 48px;
                """)
            if hasattr(self, 'title_label'):
                self.title_label.setStyleSheet("""
                    color: #ffffff;
                    background: transparent;
                    border: none;
                    padding: 4px 8px;
                    margin: 0px;
                    font-weight: bold;
                    font-size: 19px;
                """)
            if hasattr(self, 'desc_label'):
                self.desc_label.setStyleSheet("""
                    color: #b0b0b0;
                    background: transparent;
                    border: none;
                    padding: 4px 8px;
                    margin: 0px;
                    line-height: 1.3;
                    font-size: 15px;
                """)
        else:
            # Light theme - Clean modern design
            self.setStyleSheet("""
                SectionCard {
                    background-color: #ffffff;
                    border: 1px solid #e0e0e0;
                    border-radius: 16px;
                    margin: 10px;
                    color: #000000;
                    padding: 4px;
                }
                SectionCard:hover {
                    background-color: #f8f9fa;
                    border-color: #1976D2;
                }
            """)
            # Unified label styles for light theme - larger, readable text
            if hasattr(self, 'icon_label'):
                self.icon_label.setStyleSheet("""
                    color: #1976D2;
                    background: transparent;
                    border: none;
                    padding: 8px;
                    margin: 0px;
                    font-size: 48px;
                """)
            if hasattr(self, 'title_label'):
                self.title_label.setStyleSheet("""
                    color: #1a1a1a;
                    background: transparent;
                    border: none;
                    padding: 4px 8px;
                    margin: 0px;
                    font-weight: bold;
                    font-size: 19px;
                """)
            if hasattr(self, 'desc_label'):
                self.desc_label.setStyleSheet("""
                    color: #666666;
                    background: transparent;
                    border: none;
                    padding: 4px 8px;
                    margin: 0px;
                    line-height: 1.3;
                    font-size: 15px;
                """)

    def on_card_clicked(self, event):
        """Handle card click"""
        if event.button() == Qt.LeftButton:
            self.clicked.emit(self.section_key)


class HomePageWidget(QWidget):
    """Home page widget with grid layout of section cards"""

    section_selected = Signal(str)  # section_key

    def __init__(self, localization=None):
        super().__init__()
        self.localization = localization
        self.section_cards = []
        self.init_ui()

    def init_ui(self):
        """Initialize the home page UI"""
        layout = QVBoxLayout(self)
        layout.setSpacing(20)
        layout.setContentsMargins(30, 30, 30, 30)

        # Header
        header_layout = QVBoxLayout()

        # Main title - Larger with increased font size
        self.title = QLabel("📚 PDF Tools Comprehensive")
        if self.localization:
            self.title.setText(f"📚 {self.localization.get_text('home_title')}")
        self.title.setAlignment(Qt.AlignCenter)
        self.title.setFont(QFont("Arial", 33, QFont.Bold))  # Increased from 28px to 33px
        self.title.setObjectName("HomeTitle")
        header_layout.addWidget(self.title)

        # Subtitle - Larger with increased font size
        self.subtitle = QLabel("Select a tool to begin working with PDFs")
        if self.localization:
            self.subtitle.setText(self.localization.get_text('home_subtitle'))
        self.subtitle.setAlignment(Qt.AlignCenter)
        self.subtitle.setFont(QFont("Arial", 19))  # Increased from 16px to 19px
        self.subtitle.setObjectName("HomeSubtitle")
        header_layout.addWidget(self.subtitle)

        layout.addLayout(header_layout)

        # Responsive sections grid (scrollable)
        self.scroll_area = QScrollArea()
        self.scroll_area.setWidgetResizable(True)
        self.scroll_area.setHorizontalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        self.scroll_area.setVerticalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        self.scroll_area.setStyleSheet("""
            QScrollArea {
                border: none;
                background-color: transparent;
            }
            QScrollBar:vertical {
                background-color: #f0f0f0;
                width: 12px;
                border-radius: 6px;
            }
            QScrollBar::handle:vertical {
                background-color: #c0c0c0;
                border-radius: 6px;
                min-height: 20px;
            }
            QScrollBar::handle:vertical:hover {
                background-color: #a0a0a0;
            }
        """)

        self.grid_widget = QWidget()
        self.grid_layout = QGridLayout(self.grid_widget)
        self.grid_layout.setSpacing(15)  # Reduced spacing for better fit
        self.grid_layout.setContentsMargins(20, 20, 20, 20)
        self.grid_layout.setAlignment(Qt.AlignTop | Qt.AlignHCenter)

        # Set size policy for responsive behavior
        self.grid_widget.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Preferred)

        self.scroll_area.setWidget(self.grid_widget)
        layout.addWidget(self.scroll_area)

        # Create section cards
        self.create_section_cards()

    def create_section_cards(self):
        """Create all section cards with responsive layout"""
        sections = self.get_sections_config()

        # Calculate initial columns based on window size
        max_cols = self.calculate_optimal_columns()

        row, col = 0, 0

        for idx, (section_key, section_info) in enumerate(sections.items()):
            # From the 4th card onward, remove duplicate icons in titles (keep only card icons)
            title = section_info['title']
            if idx >= 3:
                title = self._strip_leading_icon(title)

            card = SectionCard(
                section_key=section_key,
                title=title,
                description=section_info['description'],
                icon=section_info['icon']
            )
            card.clicked.connect(self.on_section_selected)

            self.grid_layout.addWidget(card, row, col)
            self.section_cards.append(card)

            col += 1
            if col >= max_cols:
                col = 0
                row += 1

    def _strip_leading_icon(self, title: str) -> str:
        """Strip a leading emoji/icon from the given title string."""
        try:
            if not title:
                return title
            icons = ["👁️","📚","⏱️","🔍","📖","📤","📄","📊","📈","💧","🖼️","📝","🗜️","✂️","🔓"]
            for ic in icons:
                if title.startswith(ic):
                    return title[len(ic):].lstrip()
            # Generic fallback: remove one leading non-alnum char (emoji/symbol)
            if not title[0].isalnum():
                return title[1:].lstrip()
            return title
        except Exception:
            return title


    def calculate_optimal_columns(self):
        """Calculate optimal number of columns - fixed at 4 for 4x4 grid layout"""
        # Fixed 4x4 grid layout (16 items total)
        return 4

    def get_sections_config(self) -> Dict[str, Dict[str, str]]:
        """Get configuration for all sections"""
        if self.localization:
            # Reordered: Text Extraction moved to 4th position; removed OCR card
            return {
                "pdf_viewer": {
                    "title": self.localization.get_text("pdf_viewer"),
                    "description": self.localization.get_text("pdf_viewer_desc"),
                    "icon": "👁️"
                },
                "recent_books": {
                    "title": self.localization.get_text("recent_books"),
                    "description": self.localization.get_text("recent_books_desc"),
                    "icon": "📖"
                },
                "reading_speed": {
                    "title": self.localization.get_text("reading_speed_meter"),
                    "description": self.localization.get_text("reading_speed_meter_desc"),
                    "icon": "⏱️"
                },
                "extract_text": {
                    "title": self.localization.get_text("extract_text"),
                    "description": self.localization.get_text("extract_text_desc"),
                    "icon": "📝"
                },
                "bookmark_manager": {
                    "title": self.localization.get_text("bookmark_manager"),
                    "description": self.localization.get_text("bookmark_manager_desc"),
                    "icon": "📖"
                },
                "bookmark_extractor": {
                    "title": self.localization.get_text("bookmark_extractor"),
                    "description": self.localization.get_text("bookmark_extractor_desc"),
                    "icon": "📤"
                },
                "split_by_bookmarks": {
                    "title": self.localization.get_text("split_by_bookmarks"),
                    "description": self.localization.get_text("split_by_bookmarks_desc"),
                    "icon": "📄"
                },
                "chapter_weight": {
                    "title": self.localization.get_text("chapter_weight_analyzer"),
                    "description": self.localization.get_text("chapter_weight_desc"),
                    "icon": "⚖️"
                },
                "reading_progress": {
                    "title": self.localization.get_text("reading_progress"),
                    "description": self.localization.get_text("reading_progress_desc"),
                    "icon": "💬"
                },
                "page_operations": {
                    "title": self.localization.get_text("page_operations"),
                    "description": self.localization.get_text("page_operations_desc"),
                    "icon": "📄"
                },
                "watermark": {
                    "title": self.localization.get_text("watermark"),
                    "description": self.localization.get_text("watermark_desc"),
                    "icon": "💧"
                },
                "extract_images": {
                    "title": self.localization.get_text("extract_images"),
                    "description": self.localization.get_text("extract_images_desc"),
                    "icon": "🖼️"
                },
                "merge_pdfs": {
                    "title": self.localization.get_text("merge_pdfs"),
                    "description": self.localization.get_text("merge_pdfs_desc"),
                    "icon": "🔗"
                },
                "split_pdfs": {
                    "title": self.localization.get_text("split_pdfs"),
                    "description": self.localization.get_text("split_pdfs_desc"),
                    "icon": "✂️"
                },
                "compress": {
                    "title": self.localization.get_text("compress"),
                    "description": self.localization.get_text("compress_desc"),
                    "icon": "🗜️"
                },
                "security_removal": {
                    "title": self.localization.get_text("security_removal"),
                    "description": self.localization.get_text("security_removal_desc"),
                    "icon": "🔓"
                }
                # NOTE: Settings and History removed from home page navigation
                # They are accessible only through File menu for cleaner interface
            }
        else:
            # Fallback English configuration
            # Reordered: Text Extraction moved to 4th position; removed OCR card
            return {
                "pdf_viewer": {
                    "title": "👁️ PDF Viewer & Annotator",
                    "description": "View and annotate PDF files with advanced tools",
                    "icon": "👁️"
                },
                "recent_books": {
                    "title": "📖 Recent Books",
                    "description": "Manage your personal book library and track reading progress",
                    "icon": "📖"
                },
                "reading_speed": {
                    "title": "⏱️ Reading Speed Meter",
                    "description": "Measure your reading speed in words per minute with comprehension testing",
                    "icon": "⏱️"
                },
                "extract_text": {
                    "title": "📝 Extract Text",
                    "description": "Extract text content from PDFs",
                    "icon": "📝"
                },
                "bookmark_manager": {
                    "title": "📖 Bookmark Manager",
                    "description": "Manage and organize PDF bookmarks",
                    "icon": "📖"
                },
                "bookmark_extractor": {
                    "title": "📤 Bookmark Extractor",
                    "description": "Extract bookmarks from PDF files",
                    "icon": "📤"
                },
                "split_by_bookmarks": {
                    "title": "📄 Split PDF by Bookmarks",
                    "description": "Split PDF into separate files based on bookmark structure",
                    "icon": "📄"
                },
                "reading_progress": {
                    "title": "💬 Comments & Annotations",
                    "description": "Track reading progress and annotations",
                    "icon": "💬"
                },
                "page_operations": {
                    "title": "📄 Page Operations",
                    "description": "Extract, delete, and insert pages",
                    "icon": "📄"
                },
                "watermark": {
                    "title": "💧 Watermark",
                    "description": "Add watermarks to PDF files",
                    "icon": "💧"
                },
                "extract_images": {
                    "title": "🖼️ Extract Images",
                    "description": "Extract images from PDF files",
                    "icon": "🖼️"
                },
                "merge_pdfs": {
                    "title": "🔗 Merge PDFs",
                    "description": "Merge multiple PDF files into one",
                    "icon": "🔗"
                },
                "split_pdfs": {
                    "title": "✂️ Split PDF",
                    "description": "Split a PDF file into multiple files",
                    "icon": "✂️"
                },
                "compress": {
                    "title": "🗜️ Compress",
                    "description": "Reduce PDF file size",
                    "icon": "🗜️"
                },
                "security_removal": {
                    "title": "🔓 Remove Security",
                    "description": "Remove security restrictions from PDF files",
                    "icon": "🔓"
                }
                # NOTE: Settings and History removed from home page navigation
                # They are accessible only through File menu for cleaner interface
            }

    def on_section_selected(self, section_key: str):
        """Handle section selection"""
        self.section_selected.emit(section_key)

    def apply_theme(self, is_dark_theme=True):
        """Apply modern theme to home page and all cards"""
        # Update header styling with modern design and increased font sizes
        if is_dark_theme:
            self.title.setStyleSheet("""
                color: #1976D2;
                background: transparent;
                padding: 20px 10px 10px 10px;
                margin: 0px;
                font-size: 33px;
                font-weight: bold;
                border: none;
            """)
            self.subtitle.setStyleSheet("""
                color: #b0b0b0;
                background: transparent;
                padding: 5px 10px 20px 10px;
                margin: 0px;
                font-size: 19px;
                border: none;
                line-height: 1.4;
            """)
        else:
            self.title.setStyleSheet("""
                color: #1976D2;
                background: transparent;
                padding: 20px 10px 10px 10px;
                margin: 0px;
                font-size: 33px;
                font-weight: bold;
                border: none;
            """)
            self.subtitle.setStyleSheet("""
                color: #666666;
                background: transparent;
                padding: 5px 10px 20px 10px;
                margin: 0px;
                font-size: 19px;
                border: none;
                line-height: 1.4;
            """)

        # Update all section cards with new theme
        for card in self.section_cards:
            card.apply_theme_styling(is_dark_theme)

    def update_localization(self, localization):
        """Update localization and refresh UI"""
        self.localization = localization

        # Update header text
        if hasattr(self, 'title') and self.title:
            self.title.setText(f"📚 {localization.get_text('home_title')}")
        if hasattr(self, 'subtitle') and self.subtitle:
            self.subtitle.setText(localization.get_text('home_subtitle'))

        # Clear existing cards
        for card in self.section_cards:
            card.setParent(None)
        self.section_cards.clear()

        # Recreate cards with new localization
        self.create_section_cards()

    def resizeEvent(self, event):
        """Handle window resize to update grid layout responsively"""
        super().resizeEvent(event)

        # Use a timer to avoid excessive recalculations during resize
        if not hasattr(self, '_resize_timer'):
            from PySide6.QtCore import QTimer
            self._resize_timer = QTimer()
            self._resize_timer.setSingleShot(True)
            self._resize_timer.timeout.connect(self.update_grid_layout)

        self._resize_timer.stop()
        self._resize_timer.start(100)  # 100ms delay

    def update_grid_layout(self):
        """Update grid layout based on current window size with improved responsiveness"""
        if not hasattr(self, 'section_cards') or not self.section_cards:
            return

        # Calculate optimal columns for current window size
        max_cols = self.calculate_optimal_columns()

        # Only update if column count has changed
        current_cols = self.get_current_column_count()
        if current_cols == max_cols:
            return

        # Rearrange cards in grid with new column count
        for i, card in enumerate(self.section_cards):
            row = i // max_cols
            col = i % max_cols
            self.grid_layout.addWidget(card, row, col)

    def get_current_column_count(self):
        """Get current number of columns in the grid"""
        if not self.section_cards:
            return 0

        # Check how many cards are in the first row
        cols = 0
        for col in range(self.grid_layout.columnCount()):
            if self.grid_layout.itemAtPosition(0, col):
                cols += 1
            else:
                break
        return cols if cols > 0 else 4  # Default fallback
