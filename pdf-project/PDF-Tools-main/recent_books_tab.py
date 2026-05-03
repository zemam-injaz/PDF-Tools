from __future__ import annotations

import os
from typing import Callable, List, Optional, Dict

from PySide6.QtCore import Qt, QSize, Signal, QTimer
from PySide6.QtGui import QPixmap, QFont, QFontMetrics
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton, QScrollArea,
    QFrame, QGridLayout, QMenu, QDialog, QDialogButtonBox, QLineEdit, QSpinBox,
    QMessageBox, QComboBox, QProgressBar, QFileDialog, QButtonGroup, QRadioButton,
    QTextEdit, QSlider, QGroupBox
)

# Local
from recent_books_manager import RecentBooksManager, RecentBook


class BookCard(QWidget):
    """A simple, self-contained book card.
    No Qt signals for property updates; uses callbacks passed by parent.
    This avoids complex signal webs and prevents accidental window opens.
    """

    def __init__(
        self,
        book: RecentBook,
        on_open: Callable[[str], None],
        on_update: Callable[[str, Dict], None],
        localization=None,
        on_measure_speed: Optional[Callable[[str], None]] = None,
        parent: Optional[QWidget] = None,
    ) -> None:
        super().__init__(parent)
        self.book = book
        self.on_open = on_open
        self.on_update = on_update
        self.on_measure_speed = on_measure_speed
        self.localization = localization
        self._modal_open = False  # guards against click-through when menus/dialogs open

        self.setObjectName("BookCard")
        # Default size - will be updated based on grid size
        self.setMinimumSize(280, 400)
        self.setMaximumWidth(320)

        # Store grid size for dynamic styling
        self.grid_size = "medium"  # Default
        self.setStyleSheet(self._get_card_style())

        root = QVBoxLayout(self)
        root.setContentsMargins(6, 6, 6, 6)  # Reduced card margins
        root.setSpacing(4)  # Further reduced vertical spacing within cards

        # Cover / thumbnail - Enhanced and larger
        self.cover = QLabel()
        self.cover.setAlignment(Qt.AlignCenter)
        self.cover.setStyleSheet(self._get_cover_style())
        self._set_cover_size("medium")  # Default size
        self.cover.setPixmap(self._load_pixmap(book))

        # Add minimal padding container for cover to maximize cover size
        cover_container = QWidget()
        cover_layout = QHBoxLayout(cover_container)
        cover_layout.setContentsMargins(4, 2, 4, 2)  # Minimal padding
        cover_layout.addWidget(self.cover, alignment=Qt.AlignCenter)
        root.addWidget(cover_container)

        # Title / display name - Enhanced readability, clean filename, single line with ellipsis
        display_title = self._clean_book_title(book.display_name or book.title)
        self.title = QLabel(display_title)
        self.title.setWordWrap(False)  # Disable word wrap for single line
        self.title.setAlignment(Qt.AlignCenter)
        self.title.setFont(QFont("Arial", 11, QFont.Bold))
        self.title.setStyleSheet(self._get_title_style())

        # Set minimum height and enable text truncation with ellipsis
        self.title.setMinimumHeight(24)  # Increased height for better visibility
        self.title.setMaximumHeight(48)  # Allow for potential wrapping
        self.title.setTextFormat(Qt.PlainText)

        # Add tooltip with full title on hover
        self.title.setToolTip(display_title)

        # Set the text directly - elision will be handled in resize event
        self.title.setText(display_title)

        root.addWidget(self.title)

        # Category, Star, and Status line - Reorganized layout with star in middle
        status_category_line = QHBoxLayout()

        # Category (left side)
        category_text = book.category or self._get_localized_text("uncategorized", "Uncategorized")
        self.cat_lbl = QLabel(f"📚 {category_text}" if book.category else "")
        self.cat_lbl.setStyleSheet(self._get_category_style())
        status_category_line.addWidget(self.cat_lbl)

        status_category_line.addStretch(1)  # Space between category and star

        # Star/Favorite icon (middle) - moved from footer for space efficiency
        star = "⭐" if book.is_starred else "☆"
        self.star_lbl = QLabel(star)
        self.star_lbl.setStyleSheet(self._get_star_style())
        self.star_lbl.setAlignment(Qt.AlignCenter)
        self.star_lbl.setMaximumWidth(20)  # Limit width to save space
        status_category_line.addWidget(self.star_lbl)

        status_category_line.addStretch(1)  # Space between star and status

        # Status (right side)
        status_text = self._get_localized_status_text(book.reading_status)
        self.status_lbl = QLabel(status_text)
        self.status_lbl.setStyleSheet(self._get_status_style())
        status_category_line.addWidget(self.status_lbl)

        root.addLayout(status_category_line)

        # Progress bar - Theme-aware with minimal padding
        progress_container = QWidget()
        progress_layout = QHBoxLayout(progress_container)
        progress_layout.setContentsMargins(4, 2, 4, 2)  # Minimal padding

        self.progress = QProgressBar()
        self.progress.setMaximum(100)
        self.progress.setValue(int(book.reading_percentage))
        self.progress.setTextVisible(True)
        self.progress.setFormat(f"{book.reading_percentage:.1f}%")
        self.progress.setStyleSheet(self._get_progress_style())

        progress_layout.addWidget(self.progress)
        root.addWidget(progress_container)

        # Footer removed - star moved to category/status line for space efficiency

    # --------- UI helpers ---------
    def _load_pixmap(self, book: RecentBook) -> QPixmap:
        if book.cover_image_path and os.path.exists(book.cover_image_path):
            p = QPixmap(book.cover_image_path)
        elif book.thumbnail_path and os.path.exists(book.thumbnail_path):
            p = QPixmap(book.thumbnail_path)
        else:
            p = QPixmap(260, 180)
            p.fill(Qt.darkGray)
        # Scale to current cover size
        cover_size = self.cover.size()
        return p.scaled(cover_size.width(), cover_size.height(), Qt.KeepAspectRatio, Qt.SmoothTransformation)

    def _get_localized_text(self, key: str, fallback: str) -> str:
        """Get localized text with fallback"""
        if self.localization:
            text = self.localization.get_text(key)
            return text if text != key else fallback  # Use fallback if key not found
        return fallback

    def _clean_book_title(self, title: str) -> str:
        """Remove .pdf extension from book titles"""
        if title.lower().endswith('.pdf'):
            return title[:-4]  # Remove last 4 characters (.pdf)
        return title

    def _update_title_elision(self):
        """Update title text with ellipsis based on current card width"""
        if hasattr(self, 'title') and hasattr(self, 'book'):
            display_title = self._clean_book_title(self.book.display_name or self.book.title)
            font_metrics = QFontMetrics(self.title.font())
            available_width = self.title.width() - 10  # Account for padding
            if available_width > 0:
                elided_text = font_metrics.elidedText(display_title, Qt.ElideRight, available_width)
                self.title.setText(elided_text)
                self.title.setToolTip(display_title)  # Always show full title in tooltip

    def _get_localized_status_text(self, status: str) -> str:
        """Get localized status text"""
        status_map = {
            "reading": ("📖", "reading", "Reading"),
            "to_read": ("📋", "to_read", "To Read"),
            "completed": ("✅", "completed", "Completed")
        }

        if status in status_map:
            icon, key, fallback = status_map[status]
            text = self._get_localized_text(key, fallback)
            return f"{icon} {text}"

        return f"📖 {status.replace('_', ' ').title()}"

    def _set_cover_size(self, grid_size: str):
        """Set cover size based on grid size - covers are the dominant element"""
        sizes = {
            "small": (160, 220),    # Smaller but still prominent
            "medium": (200, 280),   # Balanced size
            "large": (260, 360)     # Large and dominant
        }
        width, height = sizes.get(grid_size, sizes["medium"])
        self.cover.setFixedSize(width, height)

    def update_grid_size(self, grid_size: str):
        """Update card for new grid size"""
        self.grid_size = grid_size
        self._set_cover_size(grid_size)
        self.setStyleSheet(self._get_card_style())
        # Update title elision when card size changes
        self._update_title_elision()

    def resizeEvent(self, event):
        """Handle resize events to update title elision"""
        super().resizeEvent(event)
        # Update title elision after resize
        QTimer.singleShot(0, self._update_title_elision)

    def _get_theme_colors(self):
        """Get theme-aware colors - supports both light and dark modes"""
        # Check if we're in dark mode by looking at the application palette
        from PySide6.QtWidgets import QApplication
        from PySide6.QtGui import QPalette

        app = QApplication.instance()
        if app:
            palette = app.palette()
            is_dark = palette.color(QPalette.Window).lightness() < 128
        else:
            is_dark = False

        if is_dark:
            return {
                "card_bg": "#1E1E1E",
                "card_border": "#3A3A3A",
                "card_hover_border": "#1976D2",
                "card_hover_bg": "#252525",
                "title_color": "#FFFFFF",  # White text for dark mode
                "filename_color": "#CCCCCC",
                "status_color": "#9AD27C",
                "category_color": "#6FB1FF",
                "star_color": "#FFD700",
                "cover_bg": "#2A2A2A",
                "progress_bg": "#2A2A2A",
                "progress_chunk": "#1976D2",
                "progress_border": "#3A3A3A"
            }
        else:
            return {
                "card_bg": "#FFFFFF",
                "card_border": "#E0E0E0",
                "card_hover_border": "#1976D2",
                "card_hover_bg": "#F5F5F5",
                "title_color": "#333333",  # Dark text for light mode
                "filename_color": "#666666",
                "status_color": "#2E7D32",
                "category_color": "#1976D2",
                "star_color": "#FF9800",
                "cover_bg": "#F9F9F9",
                "progress_bg": "#F0F0F0",
                "progress_chunk": "#1976D2",  # Blue progress for light mode
                "progress_border": "#DDD"
            }

    def _get_card_style(self):
        """Get theme-aware card styling with borders"""
        colors = self._get_theme_colors()
        return f"""
            QWidget#BookCard {{
                background: {colors["card_bg"]};
                border: 1px solid {colors["card_border"]};
                border-radius: 12px;
                margin: 2px;
            }}
            QWidget#BookCard:hover {{
                border: 2px solid {colors["card_hover_border"]};
                background: {colors["card_hover_bg"]};
            }}
        """

    def _get_cover_style(self):
        """Get cover styling"""
        colors = self._get_theme_colors()
        return f"""
            background: {colors["cover_bg"]};
            border: 1px solid {colors["card_border"]};
            border-radius: 8px;
        """

    def _get_title_style(self):
        """Get title styling with enhanced readability"""
        colors = self._get_theme_colors()
        return f"""
            color: {colors["title_color"]};
            background: transparent;
            margin: 4px 2px;
            padding: 2px 4px;
            font-weight: bold;
            text-align: center;
        """

    def _get_filename_style(self):
        """Get filename styling with enhanced readability"""
        colors = self._get_theme_colors()
        return f"""
            color: {colors["filename_color"]};
            background: transparent;
        """

    def _get_status_style(self):
        """Get status styling"""
        colors = self._get_theme_colors()
        return f"""
            color: {colors["status_color"]};
            font-weight: bold;
            background: transparent;
        """

    def _get_category_style(self):
        """Get category styling"""
        colors = self._get_theme_colors()
        return f"""
            color: {colors["category_color"]};
            background: transparent;
        """

    def _get_star_style(self):
        """Get star styling"""
        colors = self._get_theme_colors()
        return f"""
            color: {colors["star_color"]};
            background: transparent;
            font-size: 14px;
        """

    def _get_progress_style(self):
        """Get theme-aware progress bar styling"""
        colors = self._get_theme_colors()
        return f"""
            QProgressBar {{
                border: none;
                border-radius: 6px;
                text-align: center;
                background: {colors["progress_bg"]};
                color: {colors["title_color"]};
                font-size: 10px;
                padding: 2px;
            }}
            QProgressBar::chunk {{
                background: {colors["progress_chunk"]};
                border-radius: 4px;
            }}
        """

    # --------- Mouse / context menu ---------
    def mousePressEvent(self, e):
        """Handle mouse press events with book info support"""
        # Check if widget is being deleted
        try:
            if self._modal_open:
                return  # Ignore clicks when modal is open

            if e.button() == Qt.LeftButton:
                # Check if click is on star
                star_rect = self.star_lbl.geometry()
                if star_rect.contains(e.pos()):
                    self._toggle_star()
                    return

                # Check if Ctrl is pressed for book info dialog
                if e.modifiers() & Qt.ControlModifier:
                    self._show_book_info()
                    return

                # Otherwise open book externally
                self._open_externally(self.book.file_path)
            elif e.button() == Qt.RightButton:
                # Use the main context menu event
                from PySide6.QtGui import QContextMenuEvent
                context_event = QContextMenuEvent(QContextMenuEvent.Mouse, e.pos(), e.globalPos())
                self.contextMenuEvent(context_event)

            super().mousePressEvent(e)
        except RuntimeError:
            # Widget has been deleted, ignore the event
            pass

    def _toggle_star(self):
        """Toggle the star/favorite status"""
        new_starred = not self.book.is_starred
        self.on_update(self.book.file_path, {"is_starred": new_starred})
        # Update the star display
        star = "⭐" if new_starred else "☆"
        self.star_lbl.setText(star)



    def _show_book_info(self):
        """Show comprehensive book information dialog"""
        from PySide6.QtWidgets import QDialog, QVBoxLayout, QHBoxLayout, QLabel, QPushButton, QScrollArea, QFrame, QGridLayout, QProgressBar
        from PySide6.QtCore import Qt
        from PySide6.QtGui import QFont
        import os
        import datetime

        self._modal_open = True
        try:
            dialog = QDialog(self)
            dialog.setWindowTitle(self._get_localized_text("book_information", "Book Information"))
            dialog.setModal(True)
            dialog.resize(700, 600)

            # Main layout
            main_layout = QVBoxLayout(dialog)

            # Header with book title
            header_layout = QHBoxLayout()
            title_label = QLabel(self.book.display_name or self.book.title)
            title_label.setFont(QFont("Arial", 16, QFont.Bold))
            title_label.setWordWrap(True)
            header_layout.addWidget(title_label)

            # Star status in header
            star_label = QLabel("⭐" if self.book.is_starred else "☆")
            star_label.setFont(QFont("Arial", 20))
            header_layout.addWidget(star_label)

            main_layout.addLayout(header_layout)

            # Scroll area for content
            scroll_area = QScrollArea()
            scroll_area.setWidgetResizable(True)
            scroll_area.setHorizontalScrollBarPolicy(Qt.ScrollBarAsNeeded)
            scroll_area.setVerticalScrollBarPolicy(Qt.ScrollBarAsNeeded)

            # Content widget
            content_widget = QWidget()
            content_layout = QVBoxLayout(content_widget)

            # Reading Progress Section
            self._add_info_section(content_layout, "📊 " + self._get_localized_text("reading_progress", "Reading Progress"))
            progress_frame = self._create_info_frame()
            progress_layout = QGridLayout(progress_frame)

            # Progress bar
            progress_bar = QProgressBar()
            progress_bar.setMaximum(100)
            progress_bar.setValue(int(self.book.reading_percentage))
            progress_bar.setFormat(f"{self.book.reading_percentage:.1f}%")
            progress_layout.addWidget(QLabel(self._get_localized_text("progress", "Progress") + ":"), 0, 0)
            progress_layout.addWidget(progress_bar, 0, 1)

            # Pages info
            pages_read = getattr(self.book, 'pages_read', 0)
            total_pages = getattr(self.book, 'total_pages', 0)
            progress_layout.addWidget(QLabel(self._get_localized_text("pages_read", "Pages Read") + ":"), 1, 0)
            progress_layout.addWidget(QLabel(f"{pages_read} / {total_pages}"), 1, 1)

            content_layout.addWidget(progress_frame)

            # Reading Statistics Section
            self._add_info_section(content_layout, "📈 " + self._get_localized_text("reading_statistics", "Reading Statistics"))
            stats_frame = self._create_info_frame()
            stats_layout = QGridLayout(stats_frame)

            # Reading time
            reading_time = getattr(self.book, 'total_reading_time', 0)
            reading_time_str = self._format_reading_time(reading_time)
            stats_layout.addWidget(QLabel(self._get_localized_text("total_reading_time", "Total Reading Time") + ":"), 0, 0)
            stats_layout.addWidget(QLabel(reading_time_str), 0, 1)

            # Reading speed
            avg_wpm = getattr(self.book, 'average_wpm', 0)
            stats_layout.addWidget(QLabel(self._get_localized_text("average_speed", "Average Speed") + ":"), 1, 0)
            stats_layout.addWidget(QLabel(f"{avg_wpm:.0f} WPM" if avg_wpm > 0 else self._get_localized_text("no_data", "No data")), 1, 1)

            # Sessions count
            sessions_count = getattr(self.book, 'sessions_count', 0)
            stats_layout.addWidget(QLabel(self._get_localized_text("reading_sessions", "Reading Sessions") + ":"), 2, 0)
            stats_layout.addWidget(QLabel(str(sessions_count)), 2, 1)

            content_layout.addWidget(stats_frame)

            # Reading Preparation Section
            self._add_info_section(content_layout, "🚀 " + self._get_localized_text("reading_preparation", "Reading Preparation"))
            prep_frame = self._create_info_frame()
            prep_layout = QGridLayout(prep_frame)

            # Words per page (estimated)
            words_per_page = self._estimate_words_per_page()
            prep_layout.addWidget(QLabel(self._get_localized_text("words_per_page", "Words per Page") + ":"), 0, 0)
            prep_layout.addWidget(QLabel(f"~{words_per_page}" if words_per_page > 0 else self._get_localized_text("no_data", "No data")), 0, 1)

            # Estimated reading time
            if words_per_page > 0 and hasattr(self.book, 'total_pages') and self.book.total_pages:
                total_words = words_per_page * self.book.total_pages
                # Assuming average reading speed of 250 WPM
                estimated_minutes = total_words / 250
                estimated_time = self._format_reading_time(estimated_minutes * 60)
                prep_layout.addWidget(QLabel(self._get_localized_text("estimated_reading_time", "Estimated Reading Time") + ":"), 1, 0)
                prep_layout.addWidget(QLabel(estimated_time), 1, 1)

            # Reading difficulty (based on words per page)
            difficulty = self._get_reading_difficulty(words_per_page)
            prep_layout.addWidget(QLabel(self._get_localized_text("reading_difficulty", "Reading Difficulty") + ":"), 2, 0)
            prep_layout.addWidget(QLabel(difficulty), 2, 1)

            # Recommended session length
            session_length = self._get_recommended_session_length(words_per_page)
            prep_layout.addWidget(QLabel(self._get_localized_text("recommended_session", "Recommended Session") + ":"), 3, 0)
            prep_layout.addWidget(QLabel(session_length), 3, 1)

            content_layout.addWidget(prep_frame)

            # Book Details Section
            self._add_info_section(content_layout, "📚 " + self._get_localized_text("book_details", "Book Details"))
            details_frame = self._create_info_frame()
            details_layout = QGridLayout(details_frame)

            # Category
            category = self.book.category or self._get_localized_text("uncategorized", "Uncategorized")
            details_layout.addWidget(QLabel(self._get_localized_text("category", "Category") + ":"), 0, 0)
            details_layout.addWidget(QLabel(category), 0, 1)

            # Reading status
            status = self._get_localized_status_text(self.book.reading_status)
            details_layout.addWidget(QLabel(self._get_localized_text("status", "Status") + ":"), 1, 0)
            details_layout.addWidget(QLabel(status), 1, 1)

            # Last opened
            if self.book.last_opened:
                try:
                    if isinstance(self.book.last_opened, str):
                        last_opened = datetime.datetime.fromisoformat(self.book.last_opened).strftime("%Y-%m-%d %H:%M")
                    else:
                        last_opened = str(self.book.last_opened)
                    details_layout.addWidget(QLabel(self._get_localized_text("last_opened", "Last Opened") + ":"), 2, 0)
                    details_layout.addWidget(QLabel(last_opened), 2, 1)
                except (ValueError, TypeError):
                    details_layout.addWidget(QLabel(self._get_localized_text("last_opened", "Last Opened") + ":"), 2, 0)
                    details_layout.addWidget(QLabel(self._get_localized_text("no_data", "No data")), 2, 1)

            # First added
            if hasattr(self.book, 'date_added') and self.book.date_added:
                try:
                    if isinstance(self.book.date_added, str):
                        first_added = datetime.datetime.fromisoformat(self.book.date_added).strftime("%Y-%m-%d")
                    else:
                        first_added = str(self.book.date_added)
                    details_layout.addWidget(QLabel(self._get_localized_text("first_added", "First Added") + ":"), 3, 0)
                    details_layout.addWidget(QLabel(first_added), 3, 1)
                except (ValueError, TypeError):
                    details_layout.addWidget(QLabel(self._get_localized_text("first_added", "First Added") + ":"), 3, 0)
                    details_layout.addWidget(QLabel(self._get_localized_text("no_data", "No data")), 3, 1)

            content_layout.addWidget(details_frame)

            # File Information Section
            self._add_info_section(content_layout, "📁 " + self._get_localized_text("file_information", "File Information"))
            file_frame = self._create_info_frame()
            file_layout = QGridLayout(file_frame)

            # File path
            file_layout.addWidget(QLabel(self._get_localized_text("file_path", "File Path") + ":"), 0, 0)
            path_label = QLabel(self.book.file_path)
            path_label.setWordWrap(True)
            colors = self._get_theme_colors()
            path_label.setStyleSheet(f"color: {colors['filename_color']}; font-family: monospace;")
            file_layout.addWidget(path_label, 0, 1)

            # File size
            if os.path.exists(self.book.file_path):
                file_size = os.path.getsize(self.book.file_path)
                file_size_str = self._format_file_size(file_size)
                file_layout.addWidget(QLabel(self._get_localized_text("file_size", "File Size") + ":"), 1, 0)
                file_layout.addWidget(QLabel(file_size_str), 1, 1)

            # Bookmarks count
            bookmarks_count = getattr(self.book, 'bookmarks_count', 0)
            file_layout.addWidget(QLabel(self._get_localized_text("bookmarks", "Bookmarks") + ":"), 2, 0)
            file_layout.addWidget(QLabel(str(bookmarks_count)), 2, 1)

            content_layout.addWidget(file_frame)

            # Set content to scroll area
            scroll_area.setWidget(content_widget)
            main_layout.addWidget(scroll_area)

            # Close button
            button_layout = QHBoxLayout()
            button_layout.addStretch()
            close_btn = QPushButton(self._get_localized_text("close", "Close"))
            close_btn.clicked.connect(dialog.close)
            close_btn.setStyleSheet("""
                QPushButton {
                    background-color: #1976D2;
                    color: white;
                    font-weight: bold;
                    padding: 8px 16px;
                    border-radius: 5px;
                    border: none;
                }
                QPushButton:hover {
                    background-color: #1565C0;
                }
            """)
            button_layout.addWidget(close_btn)
            main_layout.addLayout(button_layout)

            # Apply theme
            self._apply_dialog_theme(dialog)

            dialog.exec()

        finally:
            self._modal_open = False

    def _add_info_section(self, layout, title):
        """Add a section header to the info dialog"""
        from PySide6.QtWidgets import QLabel
        from PySide6.QtGui import QFont

        section_label = QLabel(title)
        section_label.setFont(QFont("Arial", 14, QFont.Bold))

        # Theme-aware section header styling
        colors = self._get_theme_colors()
        section_label.setStyleSheet(f"color: {colors['card_hover_border']}; margin-top: 15px; margin-bottom: 5px;")
        layout.addWidget(section_label)

    def _create_info_frame(self):
        """Create a styled frame for info sections"""
        from PySide6.QtWidgets import QFrame

        frame = QFrame()
        frame.setFrameStyle(QFrame.Box)

        # Theme-aware frame styling
        colors = self._get_theme_colors()
        frame.setStyleSheet(f"""
            QFrame {{
                border: 1px solid {colors['card_border']};
                border-radius: 8px;
                padding: 10px;
                background-color: {colors['card_hover_bg']};
                margin-bottom: 10px;
            }}
        """)
        return frame

    def _format_reading_time(self, seconds):
        """Format reading time in a human-readable format"""
        if seconds < 60:
            return f"{seconds:.0f} " + self._get_localized_text("seconds", "seconds")
        elif seconds < 3600:
            minutes = seconds / 60
            return f"{minutes:.1f} " + self._get_localized_text("minutes", "minutes")
        else:
            hours = seconds / 3600
            return f"{hours:.1f} " + self._get_localized_text("hours", "hours")

    def _format_file_size(self, bytes_size):
        """Format file size in human-readable format"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if bytes_size < 1024.0:
                return f"{bytes_size:.1f} {unit}"
            bytes_size /= 1024.0
        return f"{bytes_size:.1f} TB"

    def _apply_dialog_theme(self, dialog):
        """Apply theme to the dialog based on current theme"""
        colors = self._get_theme_colors()

        dialog.setStyleSheet(f"""
            QDialog {{
                background-color: {colors['card_bg']};
                color: {colors['title_color']};
            }}
            QLabel {{
                color: {colors['title_color']};
            }}
            QFrame {{
                border: 1px solid {colors['card_border']};
                background-color: {colors['card_hover_bg']};
            }}
            QScrollArea {{
                background-color: {colors['card_bg']};
                border: none;
            }}
            QProgressBar {{
                border: 1px solid {colors['card_border']};
                border-radius: 3px;
                background-color: {colors['progress_bg']};
                text-align: center;
                color: {colors['title_color']};
            }}
            QProgressBar::chunk {{
                background-color: {colors['progress_chunk']};
                border-radius: 2px;
            }}
            QPushButton {{
                background-color: {colors['card_hover_border']};
                color: white;
                font-weight: bold;
                padding: 8px 16px;
                border-radius: 5px;
                border: none;
            }}
            QPushButton:hover {{
                background-color: {colors['progress_chunk']};
            }}
        """)

    def _estimate_words_per_page(self):
        """Estimate words per page based on PDF analysis"""
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(self.book.file_path)
            if len(doc) == 0:
                return 0

            # Sample first few pages to estimate
            sample_pages = min(3, len(doc))
            total_words = 0

            for page_num in range(sample_pages):
                page = doc[page_num]
                text = page.get_text()
                words = len(text.split())
                total_words += words

            doc.close()

            if sample_pages > 0:
                avg_words = total_words / sample_pages
                return int(avg_words)
            return 0

        except Exception:
            # Fallback estimation based on typical PDF
            return 300  # Average words per page for typical documents

    def _get_reading_difficulty(self, words_per_page):
        """Determine reading difficulty based on words per page"""
        if words_per_page == 0:
            return self._get_localized_text("unknown", "Unknown")
        elif words_per_page < 200:
            return self._get_localized_text("easy", "Easy") + " 📗"
        elif words_per_page < 400:
            return self._get_localized_text("medium", "Medium") + " 📘"
        elif words_per_page < 600:
            return self._get_localized_text("hard", "Hard") + " 📙"
        else:
            return self._get_localized_text("very_hard", "Very Hard") + " 📕"

    def _get_recommended_session_length(self, words_per_page):
        """Get recommended reading session length"""
        if words_per_page == 0:
            return self._get_localized_text("no_data", "No data")
        elif words_per_page < 200:
            return "45-60 " + self._get_localized_text("minutes", "minutes")
        elif words_per_page < 400:
            return "30-45 " + self._get_localized_text("minutes", "minutes")
        elif words_per_page < 600:
            return "20-30 " + self._get_localized_text("minutes", "minutes")
        else:
            return "15-25 " + self._get_localized_text("minutes", "minutes")

    def _open_externally(self, file_path: str):
        """Open PDF in external reader, attempting to open at last read page"""
        import subprocess
        import platform

        try:
            system = platform.system()
            if system == "Windows":
                # Try to open with default PDF reader
                subprocess.run(['start', '', file_path], shell=True, check=True)
            elif system == "Darwin":  # macOS
                subprocess.run(['open', file_path], check=True)
            elif system == "Linux":
                subprocess.run(['xdg-open', file_path], check=True)
            else:
                # Fallback to internal viewer
                self.on_open(file_path)
                return

            # Update last opened time
            if hasattr(self, 'on_update'):
                self.on_update(file_path, {"last_opened": True})

        except (subprocess.CalledProcessError, FileNotFoundError):
            # Fallback to internal viewer if external opening fails
            self.on_open(file_path)

    def contextMenuEvent(self, e):
        self._modal_open = True
        try:
            menu = QMenu(self)

            # Set RTL direction for Arabic
            if self.localization and hasattr(self.localization, 'current_language') and self.localization.current_language == "ar":
                menu.setLayoutDirection(Qt.RightToLeft)

            # Open externally (default behavior)
            open_text = f"📖 {self._get_localized_text('open', 'Open')}"
            open_act = menu.addAction(open_text)

            # Preview internally (new option)
            preview_text = f"👁️ {self._get_localized_text('preview', 'Preview')}"
            preview_act = menu.addAction(preview_text)

            # Measure Reading Speed (new option)
            speed_text = f"⏱️ {self._get_localized_text('measure_reading_speed', 'Measure Reading Speed')}"
            speed_act = menu.addAction(speed_text) if self.on_measure_speed else None

            # Book Information (new option)
            info_text = f"📊 {self._get_localized_text('book_information', 'Book Information')}"
            info_act = menu.addAction(info_text)

            menu.addSeparator()

            # Rename
            rename_text = f"✏️ {self._get_localized_text('rename', 'Rename')}"
            name_act = menu.addAction(rename_text)

            # Category
            category_text = f"🏷️ {self._get_localized_text('edit_category', 'Edit Category')}…"
            cat_act = menu.addAction(category_text)

            # Update Progress
            progress_text = f"📈 {self._get_localized_text('update_progress', 'Update Progress')}…"
            prog_act = menu.addAction(progress_text)

            menu.addSeparator()

            # Reading Status submenu
            status_menu_text = f"📚 {self._get_localized_text('reading_status', 'Reading Status')}"
            stat_menu = menu.addMenu(status_menu_text)

            reading_text = self._get_localized_text('reading', 'Reading')
            to_read_text = self._get_localized_text('to_read', 'To Read')
            completed_text = self._get_localized_text('completed', 'Completed')

            st_read = stat_menu.addAction(reading_text)
            st_todo = stat_menu.addAction(to_read_text)
            st_done = stat_menu.addAction(completed_text)

            # Toggle Star
            star_text = f"⭐ {self._get_localized_text('toggle_star', 'Toggle Star')}"
            star_act = menu.addAction(star_text)

            # Priority submenu
            priority_text = f"⚡ {self._get_localized_text('priority', 'Priority')}"
            pr_menu = menu.addMenu(priority_text)

            normal_text = self._get_localized_text('normal', 'Normal')
            high_text = self._get_localized_text('high', 'High')
            urgent_text = self._get_localized_text('urgent', 'Urgent')

            pr_norm = pr_menu.addAction(normal_text)
            pr_high = pr_menu.addAction(high_text)
            pr_urg = pr_menu.addAction(urgent_text)

            menu.addSeparator()

            # Remove
            remove_text = f"🗑️ {self._get_localized_text('remove', 'Remove')}"
            remove_act = menu.addAction(remove_text)

            act = menu.exec(e.globalPos())
            if act is None:
                return
            if act is open_act:
                # Open externally (default behavior)
                self._open_externally(self.book.file_path)
                return
            if act is preview_act:
                # Preview internally (old behavior)
                self.on_open(self.book.file_path)
                return
            if speed_act and act is speed_act:
                # Measure reading speed
                if self.on_measure_speed:
                    self.on_measure_speed(self.book.file_path)
                return
            if act is info_act:
                # Show book information
                self._show_book_info()
                return
            if act is name_act:
                self._rename()
                return
            if act is cat_act:
                self._edit_category()
                return
            if act is prog_act:
                self._edit_progress()
                return
            if act in (st_read, st_todo, st_done):
                new_status = "reading" if act is st_read else ("to_read" if act is st_todo else "completed")
                self.on_update(self.book.file_path, {"status": new_status})
                return
            if act is star_act:
                self.on_update(self.book.file_path, {"toggle_star": True})
                return
            if act in (pr_norm, pr_high, pr_urg):
                pr = 0 if act is pr_norm else (1 if act is pr_high else 2)
                self.on_update(self.book.file_path, {"priority": pr})
                return
            if act is remove_act:
                self.on_update(self.book.file_path, {"remove": True})
                return
        finally:
            self._modal_open = False

    # --------- Dialog helpers (simple) ---------
    def _rename(self):
        self._modal_open = True
        try:
            dlg = QDialog(self)
            dlg.setWindowTitle("Rename Book")
            lay = QVBoxLayout(dlg)
            inp = QLineEdit(self.book.display_name or self.book.title)
            lay.addWidget(QLabel("New display name:"))
            lay.addWidget(inp)
            btns = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
            lay.addWidget(btns)
            btns.accepted.connect(dlg.accept)
            btns.rejected.connect(dlg.reject)
            if dlg.exec() == QDialog.Accepted:
                text = inp.text().strip()
                if text:
                    self.on_update(self.book.file_path, {"display_name": text})
        finally:
            self._modal_open = False

    def _edit_category(self):
        self._modal_open = True
        try:
            dlg = QDialog(self)
            # Localized title
            title_text = self._get_localized_text('edit_category', 'Edit Category')
            dlg.setWindowTitle(title_text)

            lay = QVBoxLayout(dlg)

            # Localized label
            label_text = self._get_localized_text('category', 'Category:')
            lay.addWidget(QLabel(label_text))

            inp = QLineEdit(self.book.category)
            lay.addWidget(inp)

            btns = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
            lay.addWidget(btns)
            btns.accepted.connect(dlg.accept)
            btns.rejected.connect(dlg.reject)

            if dlg.exec() == QDialog.Accepted:
                self.on_update(self.book.file_path, {"category": inp.text().strip()})
        finally:
            self._modal_open = False

    def _edit_progress(self):
        self._modal_open = True
        try:
            dlg = QDialog(self)
            dlg.setWindowTitle("Update Progress")
            lay = QVBoxLayout(dlg)
            lay.addWidget(QLabel(f"Total pages: {self.book.total_pages}"))
            spin = QSpinBox()
            spin.setRange(0, max(0, self.book.total_pages))
            spin.setValue(self.book.pages_read)
            lay.addWidget(spin)
            btns = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
            lay.addWidget(btns)
            btns.accepted.connect(dlg.accept)
            btns.rejected.connect(dlg.reject)
            if dlg.exec() == QDialog.Accepted:
                self.on_update(self.book.file_path, {"pages_read": spin.value()})
        finally:
            self._modal_open = False


class RecentBooksTab(QWidget):
    """Comprehensive Recent Books page with all features.
    - Multiple grid sizes and view options
    - Add books functionality
    - Advanced filtering and sorting
    - Single window behavior guaranteed: updates never trigger opens
    """

    open_book_requested = Signal(str)

    def __init__(
        self,
        manager: Optional[RecentBooksManager] = None,
        localization=None,
        on_open_book: Optional[Callable[[str], None]] = None,
        on_measure_speed: Optional[Callable[[str], None]] = None,
        parent: Optional[QWidget] = None,
    ) -> None:
        super().__init__(parent)
        self.manager = manager or RecentBooksManager()
        self.localization = localization
        self.on_open_book = on_open_book
        self.on_measure_speed = on_measure_speed
        self.cards: List[BookCard] = []

        # Grid settings - Prioritize cover scaling over card padding
        self.current_grid_size = "medium"  # small, medium, large
        self.grid_sizes = {
            "small": {"card_size": (180, 320), "columns": 6, "cover_size": (170, 240)},
            "medium": {"card_size": (220, 400), "columns": 4, "cover_size": (210, 300)},
            "large": {"card_size": (280, 520), "columns": 3, "cover_size": (270, 380)}
        }

        # Filters and search
        self.current_status_filter = "all"
        self.current_category_filter = "all"
        self.current_sort_by = "recent"  # recent, title, progress, rating
        self.search_text = ""

        self._build_ui()
        self.refresh()

    def resizeEvent(self, event):
        """Handle resize events to update grid layout responsively"""
        super().resizeEvent(event)
        # Refresh grid layout after resize to recalculate columns
        QTimer.singleShot(100, self.refresh)  # Small delay to avoid excessive refreshes

    def _get_localized_text(self, key: str, fallback: str) -> str:
        """Get localized text with fallback"""
        if self.localization:
            text = self.localization.get_text(key)
            return text if text != key else fallback  # Use fallback if key not found
        return fallback

    def _get_theme_colors(self):
        """Get theme-aware colors for styling - comprehensive version"""
        # Check if we're in dark mode by looking at the application palette
        from PySide6.QtWidgets import QApplication
        from PySide6.QtGui import QPalette
        app = QApplication.instance()
        if app:
            palette = app.palette()
            bg_color = palette.color(QPalette.Window)
            is_dark = bg_color.lightness() < 128
        else:
            is_dark = False

        if is_dark:
            return {
                "card_bg": "#1E1E1E",
                "card_border": "#3A3A3A",
                "card_hover_border": "#1976D2",
                "card_hover_bg": "#252525",
                "title_color": "#FFFFFF",  # White text for dark mode
                "title_bg": "transparent",
                "border_color": "#424242",
                "filename_color": "#CCCCCC",
                "status_color": "#81C784",
                "category_color": "#FFB74D",
                "star_color": "#FFD700",
                "cover_bg": "#2A2A2A",
                "progress_bg": "#2A2A2A",
                "progress_chunk": "#1976D2",
                "progress_border": "#3A3A3A"
            }
        else:
            return {
                "card_bg": "#FFFFFF",
                "card_border": "#E0E0E0",
                "card_hover_border": "#1976D2",
                "card_hover_bg": "#F5F5F5",
                "title_color": "#333333",  # Dark text for light mode
                "title_bg": "transparent",
                "border_color": "#E0E0E0",
                "filename_color": "#666666",
                "status_color": "#4CAF50",
                "category_color": "#FF9800",
                "star_color": "#FFD700",
                "cover_bg": "#F8F8F8",
                "progress_bg": "#f0f0f0",
                "progress_chunk": "#1976D2",  # Blue progress for light mode
                "progress_border": "#DDD"
            }

    def _clean_book_title(self, title: str) -> str:
        """Remove .pdf extension from book titles"""
        if title.lower().endswith('.pdf'):
            return title[:-4]  # Remove last 4 characters (.pdf)
        return title

    def _update_title_styling(self):
        """Update title styling based on current theme"""
        if hasattr(self, 'main_title'):
            colors = self._get_theme_colors()
            self.main_title.setStyleSheet(f"""
                QLabel {{
                    color: {colors["title_color"]};
                    background: {colors["title_bg"]};
                    padding: 15px 0;
                    margin-bottom: 10px;
                    border-bottom: none;
                    margin-bottom: 15px;
                }}
            """)

    # --------- UI ---------
    def _build_ui(self):
        root = QVBoxLayout(self)
        root.setContentsMargins(10, 10, 10, 10)
        root.setSpacing(8)

        # Main title/header for Recent Books section
        title_text = self._get_localized_text("recent_books", "Recent Books")
        self.main_title = QLabel(f"📚 {title_text}")
        self.main_title.setAlignment(Qt.AlignCenter)
        self.main_title.setFont(QFont("Arial", 20, QFont.Bold))
        self._update_title_styling()
        root.addWidget(self.main_title)

        # Top toolbar with main actions
        top_bar = QHBoxLayout()

        # Add Books button - Localized
        add_text = self._get_localized_text("add_books", "Add Books")
        add_btn = QPushButton(f"📚 {add_text}")
        add_btn.setStyleSheet("""
            QPushButton {
                background: #1976D2;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                font-weight: bold;
            }
            QPushButton:hover {
                background: #1565C0;
            }
        """)
        add_btn.clicked.connect(self._add_books)
        top_bar.addWidget(add_btn)

        top_bar.addStretch()

        # Grid size controls - Localized
        grid_group = QButtonGroup(self)
        self.grid_buttons = {}
        size_labels = {
            "small": self._get_localized_text("small_grid", "Small"),
            "medium": self._get_localized_text("medium_grid", "Medium"),
            "large": self._get_localized_text("large_grid", "Large")
        }

        for size in ["small", "medium", "large"]:
            btn = QRadioButton(size_labels[size])
            btn.setChecked(size == self.current_grid_size)
            btn.toggled.connect(lambda checked, s=size: self._change_grid_size(s) if checked else None)
            self.grid_buttons[size] = btn
            grid_group.addButton(btn)
            top_bar.addWidget(btn)

        root.addLayout(top_bar)

        # Filter and search toolbar - Fully localized
        filter_bar = QHBoxLayout()

        # Search
        filter_bar.addWidget(QLabel("🔍"))
        self.search_input = QLineEdit()
        search_placeholder = self._get_localized_text("search_books", "Search books...")
        self.search_input.setPlaceholderText(search_placeholder)
        self.search_input.textChanged.connect(self._on_search_changed)
        filter_bar.addWidget(self.search_input)

        # Status filter
        status_label = self._get_localized_text("status", "Status:")
        filter_bar.addWidget(QLabel(status_label))
        self.status_combo = QComboBox()
        # Enhanced styling with theme-aware borders
        colors = self._get_theme_colors()
        self.status_combo.setStyleSheet(f"""
            QComboBox {{
                font-size: 14px;
                padding: 6px 12px;
                min-width: 120px;
                border: 2px solid {colors['card_border']};
                border-radius: 4px;
                background-color: {colors['card_bg']};
                color: {colors['title_color']};
            }}
            QComboBox:hover {{
                border-color: {colors['card_hover_border']};
            }}
            QComboBox::drop-down {{
                width: 20px;
                border: none;
                background: transparent;
            }}
            QComboBox::down-arrow {{
                image: none;
                border: none;
                width: 0px;
                height: 0px;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-top: 5px solid {colors['title_color']};
                margin-right: 5px;
            }}
            QComboBox QAbstractItemView {{
                font-size: 14px;
                min-width: 150px;
                border: 1px solid {colors['card_border']};
                background-color: {colors['card_bg']};
                color: {colors['title_color']};
                selection-background-color: {colors['card_hover_bg']};
            }}
        """)
        status_items = [
            self._get_localized_text("all", "All"),
            self._get_localized_text("reading", "Reading"),
            self._get_localized_text("to_read", "To Read"),
            self._get_localized_text("completed", "Completed")
        ]
        self.status_combo.addItems(status_items)
        self.status_combo.currentTextChanged.connect(self._on_status_filter_changed)
        filter_bar.addWidget(self.status_combo)

        # Category filter
        category_label = self._get_localized_text("category", "Category:")
        filter_bar.addWidget(QLabel(category_label))
        self.category_combo = QComboBox()
        # Enhanced styling with theme-aware borders
        self.category_combo.setStyleSheet(f"""
            QComboBox {{
                font-size: 14px;
                padding: 6px 12px;
                min-width: 150px;
                border: 2px solid {colors['card_border']};
                border-radius: 4px;
                background-color: {colors['card_bg']};
                color: {colors['title_color']};
            }}
            QComboBox:hover {{
                border-color: {colors['card_hover_border']};
            }}
            QComboBox::drop-down {{
                width: 20px;
                border: none;
                background: transparent;
            }}
            QComboBox::down-arrow {{
                image: none;
                border: none;
                width: 0px;
                height: 0px;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-top: 5px solid {colors['title_color']};
                margin-right: 5px;
            }}
            QComboBox QAbstractItemView {{
                font-size: 14px;
                min-width: 200px;
                border: 1px solid {colors['card_border']};
                background-color: {colors['card_bg']};
                color: {colors['title_color']};
                selection-background-color: {colors['card_hover_bg']};
            }}
        """)
        self.category_combo.currentTextChanged.connect(self._on_category_filter_changed)
        filter_bar.addWidget(self.category_combo)

        # Sort by
        sort_label = self._get_localized_text("sort", "Sort:")
        filter_bar.addWidget(QLabel(sort_label))
        self.sort_combo = QComboBox()
        # Enhanced styling with theme-aware borders
        self.sort_combo.setStyleSheet(f"""
            QComboBox {{
                font-size: 14px;
                padding: 6px 12px;
                min-width: 120px;
                border: 2px solid {colors['card_border']};
                border-radius: 4px;
                background-color: {colors['card_bg']};
                color: {colors['title_color']};
            }}
            QComboBox:hover {{
                border-color: {colors['card_hover_border']};
            }}
            QComboBox::drop-down {{
                width: 20px;
                border: none;
                background: transparent;
            }}
            QComboBox::down-arrow {{
                image: none;
                border: none;
                width: 0px;
                height: 0px;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-top: 5px solid {colors['title_color']};
                margin-right: 5px;
            }}
            QComboBox QAbstractItemView {{
                font-size: 14px;
                min-width: 150px;
                border: 1px solid {colors['card_border']};
                background-color: {colors['card_bg']};
                color: {colors['title_color']};
                selection-background-color: {colors['card_hover_bg']};
            }}
        """)
        sort_items = [
            self._get_localized_text("recent", "Recent"),
            self._get_localized_text("title", "Title"),
            self._get_localized_text("progress", "Progress"),
            self._get_localized_text("rating", "Rating")
        ]
        self.sort_combo.addItems(sort_items)
        self.sort_combo.currentTextChanged.connect(self._on_sort_changed)
        filter_bar.addWidget(self.sort_combo)

        # Refresh button
        refresh_btn = QPushButton("🔄")
        refresh_btn.clicked.connect(self.refresh)
        filter_bar.addWidget(refresh_btn)

        # Clear Filters button
        clear_text = self._get_localized_text("clear_filters", "Clear Filters")
        clear_btn = QPushButton(f"🧹 {clear_text}")
        clear_btn.setStyleSheet("""
            QPushButton {
                background: #FF6B6B;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background: #FF5252;
            }
        """)
        clear_btn.clicked.connect(self._clear_filters)
        filter_bar.addWidget(clear_btn)

        filter_bar.addStretch()
        root.addLayout(filter_bar)

        # Books count label - Localized
        self.count_label = QLabel("0 books")
        self.count_label.setStyleSheet("color: #888; font-size: 12px;")
        root.addWidget(self.count_label)

        # Scrollable grid
        self.scroll = QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.scroll.setVerticalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        self.scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        self.scroll.setStyleSheet("""
            QScrollArea {
                border: none;
                background: transparent;
            }
        """)
        root.addWidget(self.scroll)

        # Grid container - Further reduced spacing for maximum compactness
        self.grid_widget = QWidget()
        self.grid_layout = QGridLayout(self.grid_widget)
        self.grid_layout.setHorizontalSpacing(3)  # Further reduced horizontal spacing between cards
        self.grid_layout.setVerticalSpacing(6)    # Further reduced vertical spacing between rows
        self.grid_layout.setContentsMargins(8, 8, 8, 8)  # Further reduced margins around grid
        self.grid_layout.setAlignment(Qt.AlignLeft | Qt.AlignTop)  # Left alignment
        self.scroll.setWidget(self.grid_widget)

    # --------- Event Handlers ---------
    def _add_books(self):
        """Add new books to the library"""
        file_paths, _ = QFileDialog.getOpenFileNames(
            self,
            "Select PDF Books to Add",
            "",
            "PDF Files (*.pdf);;All Files (*)"
        )

        if file_paths:
            added_count = 0
            for file_path in file_paths:
                if os.path.exists(file_path) and file_path.lower().endswith('.pdf'):
                    self.manager.add_book(file_path)
                    added_count += 1

            if added_count > 0:
                QMessageBox.information(
                    self,
                    "Books Added",
                    f"Successfully added {added_count} book(s) to your library."
                )
                self.refresh()
            else:
                QMessageBox.warning(
                    self,
                    "No Books Added",
                    "No valid PDF files were selected or found."
                )

    def _change_grid_size(self, size: str):
        """Change the grid size"""
        if size != self.current_grid_size:
            self.current_grid_size = size
            self._update_card_sizes()
            self.refresh()

    def _update_card_sizes(self):
        """Update card sizes based on current grid size - prioritize cover scaling"""
        size_info = self.grid_sizes[self.current_grid_size]
        card_size = size_info["card_size"]

        for card in self.cards:
            # Update card size
            card.setMinimumSize(*card_size)
            card.setMaximumSize(card_size[0] + 20, card_size[1] + 20)

            # Update cover size (the dominant element)
            if hasattr(card, 'update_grid_size'):
                card.update_grid_size(self.current_grid_size)

    def _on_search_changed(self, text: str):
        """Handle search text changes"""
        self.search_text = text.lower().strip()
        self.refresh()

    def _on_status_filter_changed(self, status: str):
        """Handle status filter changes"""
        # Map localized text to database values
        status_mapping = {
            self._get_localized_text("all", "All"): "all",
            self._get_localized_text("reading", "Reading"): "reading",
            self._get_localized_text("to_read", "To Read"): "to_read",
            self._get_localized_text("completed", "Completed"): "completed"
        }

        # Use mapping if available, otherwise fallback to old logic
        if status in status_mapping:
            self.current_status_filter = status_mapping[status]
        else:
            # Fallback for non-localized text
            self.current_status_filter = status.lower().replace(" ", "_") if status != "All" else "all"

        print(f"DEBUG: Status filter changed to: '{status}' -> '{self.current_status_filter}'")
        self.refresh()

    def _on_category_filter_changed(self, category: str):
        """Handle category filter changes"""
        self.current_category_filter = category if category != "All" else "all"
        self.refresh()

    def _on_sort_changed(self, sort_by: str):
        """Handle sort option changes - Fixed sorting functionality"""
        # Map localized text back to internal sort keys
        sort_map = {
            self._get_localized_text("recent", "Recent").lower(): "recent",
            self._get_localized_text("title", "Title").lower(): "title",
            self._get_localized_text("progress", "Progress").lower(): "progress",
            self._get_localized_text("rating", "Rating").lower(): "rating",
            "recent": "recent",
            "title": "title",
            "progress": "progress",
            "rating": "rating"
        }

        self.current_sort_by = sort_map.get(sort_by.lower(), "recent")
        self.refresh()

    def _clear_filters(self):
        """Clear all filters and reset to default state"""
        # Reset search
        self.search_input.clear()
        self.search_text = ""

        # Reset status filter
        self.status_combo.setCurrentIndex(0)  # "All"
        self.current_status_filter = "all"

        # Reset category filter
        self.category_combo.setCurrentIndex(0)  # "All"
        self.current_category_filter = "all"

        # Reset sort
        self.sort_combo.setCurrentIndex(0)  # "Recent"
        self.current_sort_by = "recent"

        # Refresh grid
        self.refresh()

    # --------- Data / rendering ---------
    def _filtered_books(self) -> List[RecentBook]:
        """Get filtered and sorted books"""
        books = self.manager.get_books()

        # Apply search filter
        if self.search_text:
            books = [b for b in books if (
                self.search_text in b.title.lower() or
                self.search_text in b.file_name.lower() or
                self.search_text in (b.category or "").lower()
            )]

        # Apply status filter
        if self.current_status_filter != "all":
            print(f"DEBUG: Filtering by status '{self.current_status_filter}'")
            print(f"DEBUG: Available book statuses: {[b.reading_status for b in books[:5]]}")  # Show first 5
            books = [b for b in books if b.reading_status == self.current_status_filter]
            print(f"DEBUG: After status filter: {len(books)} books remaining")

        # Apply category filter
        if self.current_category_filter != "all":
            books = [b for b in books if (b.category or "") == self.current_category_filter]

        # Apply sorting - Fixed and enhanced
        if self.current_sort_by == "title":
            books.sort(key=lambda b: (b.display_name or b.title).lower())
        elif self.current_sort_by == "progress":
            # Sort by reading percentage
            books.sort(key=lambda b: getattr(b, 'reading_percentage', 0), reverse=True)
        elif self.current_sort_by == "rating":
            # Sort by star rating (starred books first)
            books.sort(key=lambda b: (1 if getattr(b, 'is_starred', False) else 0, getattr(b, 'rating', 0)), reverse=True)
        else:  # recent (default)
            # Sort by last opened, then by date added
            books.sort(key=lambda b: getattr(b, 'last_opened', None) or getattr(b, 'date_added', None) or '', reverse=True)

        return books

    def _rebuild_categories(self):
        cats = ["All"] + self.manager.get_all_categories()
        cur = self.category_combo.currentText() if self.category_combo.count() else "All"
        self.category_combo.blockSignals(True)
        self.category_combo.clear()
        self.category_combo.addItems(cats)
        if cur in cats:
            self.category_combo.setCurrentText(cur)
        self.category_combo.blockSignals(False)

    def refresh(self):
        """Refresh the grid with current books"""
        self._rebuild_categories()

        # Clear existing cards
        while self.grid_layout.count():
            item = self.grid_layout.takeAt(0)
            w = item.widget()
            if w:
                w.setParent(None)
        self.cards.clear()

        # Get filtered books
        books = self._filtered_books()

        # Update count label with localization
        if len(books) == 0:
            count_text = self._get_localized_text("no_books", "No books")
        elif len(books) == 1:
            count_text = self._get_localized_text("one_book", "1 book")
        else:
            books_text = self._get_localized_text("books", "books")
            count_text = f"{len(books)} {books_text}"
        self.count_label.setText(count_text)

        # Calculate columns based on grid size - left-aligned layout
        size_info = self.grid_sizes[self.current_grid_size]
        max_columns = size_info["columns"]

        # Calculate optimal columns to fill the page with minimal spacing
        available_width = self.scroll.width() - 20  # Further reduced margin account
        card_width = size_info["card_size"][0]
        min_spacing = 2  # Minimal spacing between cards for maximum density

        # Calculate how many columns can fit with minimum spacing
        columns_with_min_spacing = available_width // (card_width + min_spacing)
        actual_columns = min(max_columns, max(1, columns_with_min_spacing))

        # If we can fit the maximum columns, use them
        if available_width >= (card_width * max_columns + min_spacing * (max_columns - 1)):
            actual_columns = max_columns

        # Calculate actual spacing to distribute remaining space evenly
        if actual_columns > 1:
            total_card_width = card_width * actual_columns
            remaining_space = available_width - total_card_width
            actual_spacing = max(min_spacing, remaining_space // (actual_columns - 1))
        else:
            actual_spacing = min_spacing

        # Create and layout cards with equal spacing
        for i, book in enumerate(books):
            card = BookCard(
                book,
                on_open=self._open_book,
                on_update=self._apply_update,
                localization=self.localization,
                on_measure_speed=self.on_measure_speed
            )

            # Update card size and cover size
            card.setFixedSize(*size_info["card_size"])  # Fixed size for consistent layout
            card.update_grid_size(self.current_grid_size)

            # Add spacing wrapper for equal distribution
            card_wrapper = QWidget()
            wrapper_layout = QHBoxLayout(card_wrapper)
            wrapper_layout.setContentsMargins(0, 0, 0, 0)
            wrapper_layout.addWidget(card, alignment=Qt.AlignCenter)

            self.cards.append(card)

            row = i // actual_columns
            col = i % actual_columns
            self.grid_layout.addWidget(card_wrapper, row, col, Qt.AlignCenter)

        # Set up equal spacing and proper alignment
        if books:
            # Reset all stretch factors first
            for col in range(15):  # Clear any existing stretch factors
                self.grid_layout.setColumnStretch(col, 0)
            for row in range(15):
                self.grid_layout.setRowStretch(row, 0)

            # Set equal stretch factors for all used columns to distribute space evenly
            for col in range(actual_columns):
                self.grid_layout.setColumnStretch(col, 1)

            # Add extra stretch to the right if there's remaining space
            if actual_columns < max_columns:
                self.grid_layout.setColumnStretch(actual_columns, 2)

            # Add row stretch to push content to top
            last_row = (len(books) - 1) // actual_columns
            self.grid_layout.setRowStretch(last_row + 1, 1)

    def resizeEvent(self, e):
        """Handle window resize to adjust grid layout"""
        super().resizeEvent(e)
        if hasattr(self, 'cards') and self.cards:
            # Use timer to avoid excessive refreshes during resize
            QTimer.singleShot(100, self.refresh)

    def update_theme(self):
        """Update theme styling for all components"""
        self._update_title_styling()
        # Update card themes will be handled by their own theme update methods
        for card in self.cards:
            if hasattr(card, 'update_theme'):
                card.update_theme()

    # --------- Callbacks from cards ---------
    def _open_book(self, file_path: str):
        # Only called on direct user open; property updates never call this.
        if self.on_open_book:
            self.on_open_book(file_path)
        else:
            self.open_book_requested.emit(file_path)

    def _apply_update(self, file_path: str, change: Dict):
        # Apply a single, explicit update then refresh. Never opens a window.
        try:
            if "pages_read" in change:
                self.manager.update_progress(file_path, int(change["pages_read"]))
            elif "display_name" in change:
                self.manager.update_display_name(file_path, change["display_name"].strip())
            elif "category" in change:
                self.manager.update_category(file_path, change["category"].strip())
            elif "status" in change:
                self.manager.update_reading_status(file_path, change["status"]) 
            elif "toggle_star" in change:
                self.manager.toggle_star(file_path)
            elif "priority" in change:
                self.manager.set_priority(file_path, int(change["priority"]))
            elif "remove" in change:
                if QMessageBox.question(self, "Remove", "Remove this book?", QMessageBox.Yes | QMessageBox.No) == QMessageBox.Yes:
                    self.manager.remove_book(file_path)
        finally:
            self.refresh()

