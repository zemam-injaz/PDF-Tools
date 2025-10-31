from typing import Dict, Any, Optional
from PySide6.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QPushButton, QStackedWidget
from PySide6.QtCore import Qt, Signal, QUrl
from PySide6.QtGui import QFont, QDesktopServices

from home_page_widget import HomePageWidget


class SectionWrapper(QWidget):
    """Wrapper widget for section pages with back button, help button, and bug report button"""

    back_requested = Signal()

    def __init__(self, section_widget: QWidget, section_title: str, section_key: str = "", localization=None):
        super().__init__()
        self.section_widget = section_widget
        self.section_title = section_title
        self.section_key = section_key
        self.localization = localization
        self.init_ui()

    def init_ui(self):
        """Initialize the wrapper UI"""
        layout = QVBoxLayout(self)
        layout.setSpacing(0)
        layout.setContentsMargins(0, 0, 0, 0)

        # Header with back button and bug report button
        header_layout = QHBoxLayout()
        header_layout.setContentsMargins(10, 5, 10, 5)

        # Back button
        self.back_btn = QPushButton("← Back to Home")
        if self.localization:
            self.back_btn.setText(f"← {self.localization.get_text('back_to_home')}")

        self.back_btn.clicked.connect(self.back_requested.emit)
        self.back_btn.setStyleSheet("""
            QPushButton {
                background-color: #1976D2;
                color: #ffffff;
                border: 2px solid #555555;
                padding: 8px 16px;
                border-radius: 6px;
                font-weight: bold;
                font-size: 11px;
                min-height: 20px;
            }
            QPushButton:hover {
                background-color: #404040;
                border-color: #777777;
                color: #ffffff;
            }
        """)
        header_layout.addWidget(self.back_btn)
        header_layout.addStretch()

        # Help button - opens website feature page with text
        help_text = self.localization.get_text('help') if self.localization else "Help"
        self.help_btn = QPushButton(f"ℹ️ {help_text}")
        self.help_btn.clicked.connect(self.open_help_page)
        self.help_btn.setToolTip(
            self.localization.get_text('help') if self.localization else "Help"
        )
        self.help_btn.setStyleSheet("""
            QPushButton {
                background-color: #4CAF50;
                color: #ffffff;
                border: 2px solid #555555;
                padding: 8px 16px;
                border-radius: 6px;
                font-weight: bold;
                font-size: 11px;
                min-height: 20px;
            }
            QPushButton:hover {
                background-color: #45a049;
                border-color: #777777;
                color: #ffffff;
            }
        """)
        header_layout.addWidget(self.help_btn)

        # Add spacing between help button and bug report button
        header_layout.addSpacing(8)

        # Bug Report / Suggestion button
        self.bug_report_btn = QPushButton("🐛💡 Report Bug / Suggestion")
        if self.localization:
            self.bug_report_btn.setText(self.localization.get_text('report_bug'))

        self.bug_report_btn.clicked.connect(self.show_bug_report_dialog)
        self.bug_report_btn.setStyleSheet("""
            QPushButton {
                background-color: #FF9800;
                color: #ffffff;
                border: 2px solid #555555;
                padding: 8px 16px;
                border-radius: 6px;
                font-weight: bold;
                font-size: 11px;
                min-height: 20px;
            }
            QPushButton:hover {
                background-color: #F57C00;
                border-color: #777777;
                color: #ffffff;
            }
        """)
        header_layout.addWidget(self.bug_report_btn)

        layout.addLayout(header_layout)

        # Section content
        layout.addWidget(self.section_widget)

    def open_help_page(self):
        """Open the corresponding website help page for this feature"""
        # Map section keys to website feature URLs
        feature_map = {
            "pdf_viewer": "pdf_viewer",
            "recent_books": "recent_books",
            "reading_speed": "reading_speed",
            "extract_text": "extract_text",
            "bookmark_manager": "bookmark_manager",
            "bookmark_extractor": "bookmark_extractor",
            "split_by_bookmarks": "divide_by_bookmarks",
            "chapter_weight": "bookmark_weight",
            "reading_progress": "comments",
            "page_operations": "page_operations",
            "watermark": "watermark",
            "extract_images": "extract_images",
            "merge_pdfs": "merge_pdfs",
            "compress": "compress",
            "page_editing": "page_operations",  # moved features into Page Operations
            "security_removal": "remove_security",
            "statistics_dashboard": "reading_speed",  # Stats related to reading
        }

        # Get the feature URL slug
        feature_slug = feature_map.get(self.section_key, "")

        if feature_slug:
            # Open the Arabic version of the feature page (Firebase hosting)
            # Note: Trailing slash is important for proper routing
            url = f"https://reader-toolkits.web.app/ar/features/{feature_slug}/"
            QDesktopServices.openUrl(QUrl(url))
        else:
            # Fallback to general help page
            url = "https://reader-toolkits.web.app/ar/help/"
            QDesktopServices.openUrl(QUrl(url))

    def show_bug_report_dialog(self):
        """Show the bug report dialog"""
        try:
            from bug_report_dialog import BugReportDialog

            dialog = BugReportDialog(
                page_name=self.section_title,
                localization=self.localization,
                parent=self
            )
            dialog.exec()
        except Exception as e:
            print(f"Error showing bug report dialog: {e}")
            from PySide6.QtWidgets import QMessageBox
            QMessageBox.warning(
                self,
                "Error",
                f"Failed to open bug report dialog:\n{str(e)}"
            )


class NavigationManager(QWidget):
    """Manages navigation between home page and section pages with lazy loading support"""

    def __init__(self, localization=None):
        super().__init__()
        self.localization = localization
        self.sections: Dict[str, QWidget] = {}
        self.section_wrappers: Dict[str, SectionWrapper] = {}
        self.section_metadata: Dict[str, Dict[str, Any]] = {}  # Store section info for lazy loading
        self.init_ui()

    def init_ui(self):
        """Initialize the navigation UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Stacked widget for navigation
        self.stacked_widget = QStackedWidget()
        layout.addWidget(self.stacked_widget)

        # Create home page
        self.home_page = HomePageWidget(self.localization)
        self.home_page.section_selected.connect(self.navigate_to_section)
        self.stacked_widget.addWidget(self.home_page)

        # Show home page by default
        self.stacked_widget.setCurrentWidget(self.home_page)

    def add_section(self, section_key: str, section_widget: QWidget, section_title: str):
        """
        Add a section to the navigation manager with lazy wrapper creation

        The section widget is stored but the wrapper is only created when first navigated to.
        This improves startup performance by deferring UI creation.
        """
        # Store section widget and metadata
        self.sections[section_key] = section_widget
        self.section_metadata[section_key] = {
            'title': section_title,
            'widget': section_widget,
            'factory': None  # No factory for direct widget
        }

        # Don't create wrapper yet - it will be created on first navigation
        # This defers the overhead of creating the wrapper UI

    def add_section_lazy(self, section_key: str, widget_factory, section_title: str):
        """
        Add a section with a factory function for truly lazy loading

        The widget factory is called only when the section is first navigated to.
        This provides maximum startup performance by deferring both widget and wrapper creation.

        Args:
            section_key: Unique key for the section
            widget_factory: Callable that returns the widget when called
            section_title: Display title for the section
        """
        # Store factory function and metadata
        self.section_metadata[section_key] = {
            'title': section_title,
            'widget': None,  # Will be created by factory
            'factory': widget_factory
        }

        # Don't create anything yet - both widget and wrapper created on first navigation

    def _ensure_wrapper_created(self, section_key: str):
        """Ensure wrapper is created for a section (lazy creation)"""
        if section_key not in self.section_wrappers and section_key in self.section_metadata:
            metadata = self.section_metadata[section_key]
            section_title = metadata['title']

            # Get or create the widget
            section_widget = metadata.get('widget')
            if section_widget is None and metadata.get('factory'):
                # Widget needs to be created from factory
                print(f"📦 Creating widget for section: {section_key}")
                section_widget = metadata['factory']()
                metadata['widget'] = section_widget
                self.sections[section_key] = section_widget

            # Skip if widget is None (factory returned None)
            if section_widget is None:
                print(f"⚠️  Skipping section {section_key} - widget is None")
                return

            # Create wrapper now
            print(f"📦 Creating wrapper for section: {section_key}")
            wrapper = SectionWrapper(section_widget, section_title, section_key, self.localization)
            wrapper.back_requested.connect(self.navigate_to_home)

            self.section_wrappers[section_key] = wrapper
            self.stacked_widget.addWidget(wrapper)

    def navigate_to_section(self, section_key: str):
        """Navigate to a specific section (creates wrapper if needed)"""
        if section_key in self.section_metadata:
            # Ensure wrapper is created before navigating
            self._ensure_wrapper_created(section_key)

            if section_key in self.section_wrappers:
                self.stacked_widget.setCurrentWidget(self.section_wrappers[section_key])
    
    def navigate_to_home(self):
        """Navigate back to home page"""
        self.stacked_widget.setCurrentWidget(self.home_page)
    
    def get_current_section(self) -> Optional[str]:
        """Get the currently active section key"""
        current_widget = self.stacked_widget.currentWidget()
        
        if current_widget == self.home_page:
            return "home"
        
        for section_key, wrapper in self.section_wrappers.items():
            if current_widget == wrapper:
                return section_key
        
        return None
    
    def update_localization(self, localization):
        """Update localization for all components"""
        self.localization = localization

        # Update home page
        self.home_page.update_localization(localization)

        # Update section wrappers
        for wrapper in self.section_wrappers.values():
            wrapper.localization = localization
            if localization:
                wrapper.back_btn.setText(f"← {localization.get_text('back_to_home')}")
                wrapper.bug_report_btn.setText(localization.get_text('report_bug'))
            else:
                wrapper.back_btn.setText("← Back to Home")
                wrapper.bug_report_btn.setText("🐛💡 Report Bug / Suggestion")
    
    def get_section_widget(self, section_key: str) -> Optional[QWidget]:
        """Get the original section widget (without wrapper)"""
        return self.sections.get(section_key)
    
    def remove_section(self, section_key: str):
        """Remove a section from navigation"""
        if section_key in self.section_wrappers:
            wrapper = self.section_wrappers[section_key]
            self.stacked_widget.removeWidget(wrapper)
            wrapper.setParent(None)
            del self.section_wrappers[section_key]
        
        if section_key in self.sections:
            del self.sections[section_key]
    
    def get_all_sections(self) -> Dict[str, QWidget]:
        """Get all registered sections"""
        return self.sections.copy()
    
    def is_on_home_page(self) -> bool:
        """Check if currently on home page"""
        return self.stacked_widget.currentWidget() == self.home_page
    
    def get_section_count(self) -> int:
        """Get total number of registered sections"""
        return len(self.sections)
    
    def clear_sections(self):
        """Clear all sections (useful for rebuilding)"""
        # Remove all section wrappers
        for wrapper in self.section_wrappers.values():
            self.stacked_widget.removeWidget(wrapper)
            wrapper.setParent(None)
        
        self.sections.clear()
        self.section_wrappers.clear()
    
    def set_home_as_current(self):
        """Explicitly set home page as current"""
        self.stacked_widget.setCurrentWidget(self.home_page)
    
    def get_stacked_widget(self) -> QStackedWidget:
        """Get the underlying stacked widget for advanced operations"""
        return self.stacked_widget
