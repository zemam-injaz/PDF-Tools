import os
import sys
import json
import subprocess
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from pathlib import Path

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGridLayout, QGroupBox,
    QPushButton, QLabel, QLineEdit, QTableWidget, QTableWidgetItem,
    QProgressBar, QTextEdit, QSplitter, QTabWidget, QCheckBox,
    QSpinBox, QComboBox, QFileDialog, QMessageBox, QHeaderView,
    QAbstractItemView, QFrame, QScrollArea, QInputDialog, QDialog
)
from PySide6.QtCore import Qt, QThread, Signal, QTimer
from PySide6.QtGui import QFont, QPixmap, QIcon

from pdf_comments import EnhancedPDFAnalyzer, PDFReadingProgress


class PDFScanWorker(QThread):
    """Worker thread for scanning PDFs in background"""
    progress_updated = Signal(int, int, str)  # current, total, filename
    scan_completed = Signal(list, list)  # successful, failed
    error_occurred = Signal(str)

    def __init__(self, analyzer, directory_path, recursive=True):
        super().__init__()
        self.analyzer = analyzer
        self.directory_path = directory_path
        self.recursive = recursive
        self._is_cancelled = False

    def run(self):
        try:
            def progress_callback(current, total, filename):
                if not self._is_cancelled:
                    self.progress_updated.emit(current, total, filename)

            successful, failed = self.analyzer.scan_directory(
                self.directory_path,
                self.recursive,
                progress_callback
            )

            if not self._is_cancelled:
                self.scan_completed.emit(successful, failed)

        except Exception as e:
            self.error_occurred.emit(str(e))

    def cancel(self):
        self._is_cancelled = True


class PDFReadingProgressTab(QWidget):
    """PDF Reading Progress tracking tab"""

    def __init__(self, history_manager=None, localization=None):
        super().__init__()
        self.history_manager = history_manager
        self.localization = localization
        self.analyzer = EnhancedPDFAnalyzer()
        self.scan_worker = None
        self.current_directory = ""

        self.init_ui()
        self.load_pdf_list()

    def init_ui(self):
        """Initialize the user interface"""
        layout = QVBoxLayout(self)

        # Compact description section (collapsible)
        self.description_widget = QWidget()
        desc_layout = QVBoxLayout(self.description_widget)
        desc_layout.setContentsMargins(0, 0, 0, 0)

        # Compact toggle button for description
        self.btn_toggle_help = QPushButton("💡")
        self.btn_toggle_help.setMaximumWidth(30)
        self.btn_toggle_help.setMaximumHeight(25)
        help_tooltip = self.localization.get_text("show_hide_help") if self.localization else "Show/Hide Help"
        self.btn_toggle_help.setToolTip(help_tooltip)
        self.btn_toggle_help.clicked.connect(self.toggle_description)
        self.btn_toggle_help.setStyleSheet("""
            QPushButton {
                background-color: #17a2b8;
                color: white;
                border: none;
                padding: 2px;
                border-radius: 3px;
                font-size: 10px;
            }
            QPushButton:hover { background-color: #138496; }
        """)

        # Create horizontal layout for compact help button
        help_layout = QHBoxLayout()
        help_layout.addWidget(self.btn_toggle_help)
        help_layout.addStretch()
        layout.addLayout(help_layout)

        # Collapsible description with dark mode support
        if self.localization and self.localization.current_language == "ar":
            description_html = """
            <div style='background-color: rgba(0, 123, 255, 0.1); padding: 10px; border-radius: 6px; border-left: 3px solid #007bff; margin: 5px 0;'>
                <p style='margin: 5px 0; font-size: 13px; color: inherit;'><b>تتبع تقدم دراستك لملفات PDF:</b></p>
                <p style='margin: 3px 0; font-size: 12px; color: inherit;'>🔍 فحص المجلدات • 📊 تتبع الكثافة • 📝 تصدير التعليقات • 📈 عرض الإحصائيات</p>
                <p style='margin: 3px 0; font-size: 11px; font-style: italic; color: inherit;'>💡 اختر مجلد واضغط "بدء الفحص"</p>
            </div>
            """
        else:
            description_html = """
            <div style='background-color: rgba(0, 123, 255, 0.1); padding: 10px; border-radius: 6px; border-left: 3px solid #007bff; margin: 5px 0;'>
                <p style='margin: 5px 0; font-size: 13px; color: inherit;'><b>Track your PDF study progress:</b></p>
                <p style='margin: 3px 0; font-size: 12px; color: inherit;'>🔍 Scan directories • 📊 Track intensity • 📝 Export annotations • 📈 View statistics</p>
                <p style='margin: 3px 0; font-size: 11px; font-style: italic; color: inherit;'>💡 Select a folder and click "Start Scan"</p>
            </div>
            """

        self.description_label = QLabel(description_html)
        self.description_label.setWordWrap(True)
        self.description_label.setTextFormat(Qt.RichText)
        self.description_label.setVisible(False)  # Hidden by default
        desc_layout.addWidget(self.description_label)

        layout.addWidget(self.description_widget)

        # Main splitter
        main_splitter = QSplitter(Qt.Horizontal)
        layout.addWidget(main_splitter)

        # Left panel - Controls and Statistics
        left_panel = self.create_left_panel()
        main_splitter.addWidget(left_panel)

        # Right panel - PDF List and Details
        right_panel = self.create_right_panel()
        main_splitter.addWidget(right_panel)

        # Set splitter proportions - give more space to the PDF list
        main_splitter.setSizes([250, 950])

        # Compact status area
        status_widget = QWidget()
        status_widget.setMaximumHeight(40)
        status_layout = QHBoxLayout(status_widget)
        status_layout.setContentsMargins(5, 2, 5, 2)

        # Compact progress bar (initially hidden)
        self.progress_bar = QProgressBar()
        self.progress_bar.setMaximumHeight(20)
        self.progress_bar.setVisible(False)
        status_layout.addWidget(self.progress_bar)

        # Compact status label
        ready_text = self.localization.get_text("ready") if self.localization else "Ready"
        self.status_label = QLabel(ready_text)
        self.status_label.setStyleSheet("color: #666; font-size: 11px;")
        status_layout.addWidget(self.status_label)

        status_layout.addStretch()
        layout.addWidget(status_widget)

    def create_left_panel(self) -> QWidget:
        """Create the left control panel"""
        panel = QWidget()
        layout = QVBoxLayout(panel)

        # Directory selection group
        dir_group = QGroupBox("📁 Directory Selection")
        dir_layout = QVBoxLayout(dir_group)

        # Current directory display
        self.dir_display = QLineEdit()
        self.dir_display.setReadOnly(True)
        no_dir_text = self.localization.get_text("no_directory_selected") if self.localization else "No directory selected"
        self.dir_display.setPlaceholderText(no_dir_text)
        dir_layout.addWidget(self.dir_display)

        # Directory selection buttons
        dir_buttons = QHBoxLayout()

        select_folder_text = self.localization.get_text("select_folder") if self.localization else "📂 Select Folder"
        self.btn_select_folder = QPushButton(select_folder_text)
        self.btn_select_folder.clicked.connect(self.select_directory)
        self.btn_select_folder.setStyleSheet("""
            QPushButton {
                background-color: #4CAF50;
                color: white;
                font-weight: bold;
                padding: 8px;
                border-radius: 4px;
            }
            QPushButton:hover { background-color: #45a049; }
        """)
        dir_buttons.addWidget(self.btn_select_folder)

        scan_computer_text = self.localization.get_text("scan_computer") if self.localization else "💻 Scan Computer"
        self.btn_scan_computer = QPushButton(scan_computer_text)
        self.btn_scan_computer.clicked.connect(self.scan_entire_computer)
        self.btn_scan_computer.setStyleSheet("""
            QPushButton {
                background-color: #FF9800;
                color: white;
                font-weight: bold;
                padding: 8px;
                border-radius: 4px;
            }
            QPushButton:hover { background-color: #e68900; }
        """)
        dir_buttons.addWidget(self.btn_scan_computer)

        dir_layout.addLayout(dir_buttons)

        # Scan options
        recursive_text = self.localization.get_text("include_subdirectories") if self.localization else "Include subdirectories"
        self.recursive_check = QCheckBox(recursive_text)
        self.recursive_check.setChecked(True)
        dir_layout.addWidget(self.recursive_check)

        layout.addWidget(dir_group)

        # Scan control
        scan_group = QGroupBox("🔍 Scan Control")
        scan_layout = QVBoxLayout(scan_group)

        start_scan_text = self.localization.get_text("start_scan") if self.localization else "▶️ Start Scan"
        self.btn_start_scan = QPushButton(start_scan_text)
        self.btn_start_scan.clicked.connect(self.start_scan)
        self.btn_start_scan.setEnabled(False)
        self.btn_start_scan.setStyleSheet("""
            QPushButton {
                background-color: #2196F3;
                color: white;
                font-weight: bold;
                padding: 10px;
                border-radius: 4px;
            }
            QPushButton:hover { background-color: #1976D2; }
            QPushButton:disabled { background-color: #ccc; }
        """)
        scan_layout.addWidget(self.btn_start_scan)

        stop_scan_text = self.localization.get_text("stop_scan") if self.localization else "⏹️ Stop Scan"
        self.btn_stop_scan = QPushButton(stop_scan_text)
        self.btn_stop_scan.clicked.connect(self.stop_scan)
        self.btn_stop_scan.setEnabled(False)
        self.btn_stop_scan.setStyleSheet("""
            QPushButton {
                background-color: #F44336;
                color: white;
                font-weight: bold;
                padding: 10px;
                border-radius: 4px;
            }
            QPushButton:hover { background-color: #d32f2f; }
            QPushButton:disabled { background-color: #ccc; }
        """)
        scan_layout.addWidget(self.btn_stop_scan)

        layout.addWidget(scan_group)

        # Statistics group
        self.stats_group = self.create_statistics_group()
        layout.addWidget(self.stats_group)

        # Add stretch to push everything to top
        layout.addStretch()

        return panel

    def create_statistics_group(self) -> QGroupBox:
        """Create the statistics display group"""
        stats_title = self.localization.get_text("statistics") if self.localization else "📈 Statistics"
        stats_group = QGroupBox(stats_title)
        stats_layout = QVBoxLayout(stats_group)
        stats_layout.setSpacing(5)  # Reduce spacing

        # Statistics labels
        self.stats_labels = {}

        # Get localized text or fallback to English
        total_pdfs_text = self.localization.get_text("total_pdfs") if self.localization else "📚 Total:"
        annotated_pdfs_text = self.localization.get_text("annotated_pdfs") if self.localization else "📝 Annotated:"
        total_annotations_text = self.localization.get_text("total_annotations") if self.localization else "💬 Comments:"
        avg_intensity_text = self.localization.get_text("avg_intensity") if self.localization else "🔥 Intensity:"

        stats_data = [
            ("total_pdfs", total_pdfs_text, "0"),
            ("annotated_pdfs", annotated_pdfs_text, "0"),
            ("total_annotations", total_annotations_text, "0"),
            ("avg_intensity", avg_intensity_text, "0.0"),
        ]

        for key, label, default in stats_data:
            row = QHBoxLayout()
            row.setContentsMargins(0, 2, 0, 2)  # Reduce margins

            label_widget = QLabel(label)
            label_widget.setStyleSheet("font-size: 11px;")  # Smaller font

            value_widget = QLabel(default)
            value_widget.setStyleSheet("font-weight: bold; color: #1976D2; font-size: 12px;")

            row.addWidget(label_widget)
            row.addStretch()
            row.addWidget(value_widget)

            stats_layout.addLayout(row)
            self.stats_labels[key] = value_widget

        # Refresh button
        refresh_stats_text = self.localization.get_text("refresh_stats") if self.localization else "🔄 Refresh"
        self.btn_refresh_stats = QPushButton(refresh_stats_text)
        self.btn_refresh_stats.clicked.connect(self.update_statistics)
        self.btn_refresh_stats.setStyleSheet("font-size: 11px; padding: 4px;")  # Smaller button
        stats_layout.addWidget(self.btn_refresh_stats)

        return stats_group


    def create_right_panel(self) -> QWidget:
        """Create the right panel with PDF list and details"""
        panel = QWidget()
        layout = QVBoxLayout(panel)

        # PDF list controls
        controls_layout = QHBoxLayout()

        # Search box
        search_label = QLabel("🔍 Search:")
        controls_layout.addWidget(search_label)

        self.search_box = QLineEdit()
        search_placeholder = self.localization.get_text("search_placeholder") if self.localization else "Search by filename or path..."
        self.search_box.setPlaceholderText(search_placeholder)
        self.search_box.textChanged.connect(self.search_pdfs)
        controls_layout.addWidget(self.search_box)

        # Filter controls
        filter_label_text = self.localization.get_text("filter_label") if self.localization else "📂 Filter:"
        filter_label = QLabel(filter_label_text)
        controls_layout.addWidget(filter_label)

        self.filter_combo = QComboBox()
        if self.localization:
            filter_items = [
                self.localization.get_text("all_pdfs"),
                self.localization.get_text("with_annotations_only"),
                self.localization.get_text("recently_modified"),
                self.localization.get_text("high_activity"),
                self.localization.get_text("low_activity"),
                self.localization.get_text("no_annotations")
            ]
        else:
            filter_items = [
                "All PDFs",
                "With Annotations Only",
                "Recently Modified (30 days)",
                "High Activity (10+ annotations)",
                "Low Activity (1-5 annotations)",
                "No Annotations"
            ]
        self.filter_combo.addItems(filter_items)
        default_filter = self.localization.get_text("with_annotations_only") if self.localization else "With Annotations Only"
        self.filter_combo.setCurrentText(default_filter)  # Set default
        self.filter_combo.currentTextChanged.connect(self.filter_pdf_list)
        controls_layout.addWidget(self.filter_combo)

        # Sort controls
        sort_label_text = self.localization.get_text("sort_label") if self.localization else "Sort by:"
        sort_label = QLabel(sort_label_text)
        controls_layout.addWidget(sort_label)

        self.sort_combo = QComboBox()
        if self.localization:
            sort_items = [
                self.localization.get_text("last_scanned"),
                self.localization.get_text("file_name"),
                self.localization.get_text("last_modified"),
                self.localization.get_text("annotations_count"),
                self.localization.get_text("reading_intensity")
            ]
        else:
            sort_items = [
                "Last Scanned", "File Name", "Last Modified",
                "Annotations Count", "Reading Intensity"
            ]
        self.sort_combo.addItems(sort_items)

        default_sort = self.localization.get_text("annotations_count") if self.localization else "Annotations Count"
        self.sort_combo.setCurrentText(default_sort)  # Set default
        self.sort_combo.currentTextChanged.connect(self.sort_pdf_list)
        controls_layout.addWidget(self.sort_combo)

        controls_layout.addStretch()

        # Export button
        self.btn_export_list = QPushButton("📤 Export List")
        self.btn_export_list.clicked.connect(self.export_pdf_list)
        controls_layout.addWidget(self.btn_export_list)

        layout.addLayout(controls_layout)

        # PDF table
        self.pdf_table = QTableWidget()
        self.pdf_table.setColumnCount(7)
        if self.localization:
            headers = [
                self.localization.get_text("file_name_col"),
                self.localization.get_text("path_col"),
                self.localization.get_text("pages_col"),
                self.localization.get_text("annotations_col"),
                self.localization.get_text("intensity_col"),
                self.localization.get_text("last_modified_col"),
                self.localization.get_text("last_scanned_col")
            ]
        else:
            headers = [
                "File Name", "Path", "Pages", "Annotations",
                "Intensity", "Last Modified", "Last Scanned"
            ]
        self.pdf_table.setHorizontalHeaderLabels(headers)

        # Configure table
        header = self.pdf_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeToContents)  # File Name
        header.setSectionResizeMode(1, QHeaderView.Stretch)  # Path
        header.setSectionResizeMode(2, QHeaderView.ResizeToContents)  # Pages
        header.setSectionResizeMode(3, QHeaderView.ResizeToContents)  # Annotations
        header.setSectionResizeMode(4, QHeaderView.ResizeToContents)  # Intensity
        header.setSectionResizeMode(5, QHeaderView.ResizeToContents)  # Last Modified
        header.setSectionResizeMode(6, QHeaderView.ResizeToContents)  # Last Scanned

        self.pdf_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.pdf_table.setAlternatingRowColors(True)
        self.pdf_table.itemDoubleClicked.connect(self.on_pdf_double_clicked)
        self.pdf_table.itemSelectionChanged.connect(self.on_pdf_selection_changed)

        # Expand table height significantly
        self.pdf_table.setMinimumHeight(500)  # Increased from 400 to 500
        layout.addWidget(self.pdf_table, 2)  # Give table more stretch factor

        # Expand details panel for better button visibility - increased height to prevent overlapping
        details_group = QGroupBox("📋 PDF Details & Actions")
        details_group.setMaximumHeight(320)  # Increased from 250 to 320 to accommodate all buttons
        details_layout = QHBoxLayout(details_group)

        # Expanded action buttons with optimized styling to prevent overlapping
        actions_layout = QVBoxLayout()
        actions_layout.setSpacing(6)  # Reduced spacing to fit more buttons
        actions_layout.setContentsMargins(5, 5, 5, 5)  # Add margins for better appearance

        # Button style optimized for space efficiency
        button_style = """
            QPushButton {
                padding: 8px 12px;
                font-size: 11px;
                font-weight: bold;
                border-radius: 4px;
                border: none;
                min-height: 28px;
                max-height: 32px;
            }
            QPushButton:hover {
                opacity: 0.8;
            }
            QPushButton:disabled {
                background-color: #cccccc;
                color: #666666;
            }
        """

        open_pdf_text = self.localization.get_text("open_pdf") if self.localization else "📖 Open PDF"
        self.btn_open_pdf = QPushButton(open_pdf_text)
        self.btn_open_pdf.clicked.connect(self.open_selected_pdf)
        self.btn_open_pdf.setEnabled(False)
        self.btn_open_pdf.setStyleSheet(button_style + "QPushButton { background-color: #007bff; color: white; }")
        actions_layout.addWidget(self.btn_open_pdf)

        export_annotations_text = self.localization.get_text("export_annotations") if self.localization else "📝 Export Annotations"
        self.btn_export_annotations = QPushButton(export_annotations_text)
        self.btn_export_annotations.clicked.connect(self.export_annotations)
        self.btn_export_annotations.setEnabled(False)
        self.btn_export_annotations.setStyleSheet(button_style + "QPushButton { background-color: #17a2b8; color: white; }")
        actions_layout.addWidget(self.btn_export_annotations)

        timeline_text = self.localization.get_text("study_timeline") if self.localization else "📅 Study Timeline"
        self.btn_show_timeline = QPushButton(timeline_text)
        self.btn_show_timeline.clicked.connect(self.show_study_timeline)
        self.btn_show_timeline.setStyleSheet(button_style + "QPushButton { background-color: #6f42c1; color: white; }")
        actions_layout.addWidget(self.btn_show_timeline)

        # Compact separator to save space
        separator = QFrame()
        separator.setFrameShape(QFrame.HLine)
        separator.setFrameShadow(QFrame.Sunken)
        separator.setMaximumHeight(8)  # Limit separator height
        separator.setContentsMargins(0, 2, 0, 2)  # Minimal margins
        actions_layout.addWidget(separator)

        # Advanced actions with expanded styling
        backup_text = self.localization.get_text("backup_data") if self.localization else "💾 Backup Data"
        self.btn_backup_data = QPushButton(backup_text)
        self.btn_backup_data.clicked.connect(self.backup_data)
        self.btn_backup_data.setStyleSheet(button_style + "QPushButton { background-color: #28a745; color: white; }")
        actions_layout.addWidget(self.btn_backup_data)

        restore_text = self.localization.get_text("restore_data") if self.localization else "📥 Restore Data"
        self.btn_restore_data = QPushButton(restore_text)
        self.btn_restore_data.clicked.connect(self.restore_data)
        self.btn_restore_data.setStyleSheet(button_style + "QPushButton { background-color: #ffc107; color: black; }")
        actions_layout.addWidget(self.btn_restore_data)

        clear_data_text = self.localization.get_text("clear_all_data") if self.localization else "🗑️ Clear All Data"
        self.btn_clear_data = QPushButton(clear_data_text)
        self.btn_clear_data.clicked.connect(self.clear_all_data)
        self.btn_clear_data.setStyleSheet(button_style + "QPushButton { background-color: #dc3545; color: white; }")
        actions_layout.addWidget(self.btn_clear_data)

        actions_layout.addStretch()
        details_layout.addLayout(actions_layout)

        # Details text area - optimized height to balance with button space
        self.details_text = QTextEdit()
        self.details_text.setReadOnly(True)
        self.details_text.setMaximumHeight(140)  # Slightly increased to match new panel height
        self.details_text.setMinimumHeight(80)   # Increased minimum for better readability
        self.details_text.setStyleSheet("""
            QTextEdit {
                font-size: 11px;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
            }
        """)
        details_layout.addWidget(self.details_text)

        layout.addWidget(details_group)

        return panel

    def select_directory(self):
        """Select directory to scan for PDFs"""
        directory = QFileDialog.getExistingDirectory(
            self, "Select Directory to Scan for PDFs"
        )
        if directory:
            self.current_directory = directory
            self.dir_display.setText(directory)
            self.btn_start_scan.setEnabled(True)
            self.status_label.setText(f"Directory selected: {directory}")

    def scan_entire_computer(self):
        """Scan entire computer for PDFs (with warning)"""
        reply = QMessageBox.question(
            self, "Scan Entire Computer",
            "This will scan your entire computer for PDF files. "
            "This may take a very long time and use significant system resources. "
            "Are you sure you want to continue?",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )

        if reply == QMessageBox.Yes:
            # Use root directory based on OS
            if sys.platform.startswith('win'):
                self.current_directory = "C:\\"
            else:
                self.current_directory = "/"

            self.dir_display.setText("Entire Computer")
            self.btn_start_scan.setEnabled(True)
            self.status_label.setText("Ready to scan entire computer")

    def start_scan(self):
        """Start scanning the selected directory"""
        if not self.current_directory:
            QMessageBox.warning(self, "No Directory", "Please select a directory first.")
            return

        # Disable controls
        self.btn_start_scan.setEnabled(False)
        self.btn_stop_scan.setEnabled(True)
        self.btn_select_folder.setEnabled(False)
        self.btn_scan_computer.setEnabled(False)

        # Show progress bar
        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)

        # Start worker thread
        self.scan_worker = PDFScanWorker(
            self.analyzer,
            self.current_directory,
            self.recursive_check.isChecked()
        )

        self.scan_worker.progress_updated.connect(self.update_scan_progress)
        self.scan_worker.scan_completed.connect(self.scan_completed)
        self.scan_worker.error_occurred.connect(self.scan_error)

        self.scan_worker.start()
        self.status_label.setText("Scanning in progress...")

    def stop_scan(self):
        """Stop the current scan"""
        if self.scan_worker and self.scan_worker.isRunning():
            self.scan_worker.cancel()
            self.scan_worker.wait()

        self.reset_scan_controls()
        self.status_label.setText("Scan stopped by user")

    def update_scan_progress(self, current: int, total: int, filename: str):
        """Update scan progress"""
        self.progress_bar.setMaximum(total)
        self.progress_bar.setValue(current)
        self.status_label.setText(f"Processing {current}/{total}: {filename}")

    def scan_completed(self, successful: List, failed: List):
        """Handle scan completion"""
        self.reset_scan_controls()

        # Show results
        message = f"Scan completed!\n\n"
        message += f"Successfully analyzed: {len(successful)} PDFs\n"
        message += f"Failed to analyze: {len(failed)} PDFs"

        if failed:
            message += f"\n\nFailed files:\n"
            message += "\n".join(failed[:10])  # Show first 10 failed files
            if len(failed) > 10:
                message += f"\n... and {len(failed) - 10} more"

        QMessageBox.information(self, "Scan Results", message)

        # Refresh the PDF list and statistics
        self.load_pdf_list()
        self.update_statistics()

        self.status_label.setText(f"Scan completed: {len(successful)} PDFs analyzed")

    def scan_error(self, error_message: str):
        """Handle scan error"""
        self.reset_scan_controls()
        QMessageBox.critical(self, "Scan Error", f"An error occurred during scanning:\n\n{error_message}")
        self.status_label.setText("Scan failed")

    def reset_scan_controls(self):
        """Reset scan control states"""
        self.btn_start_scan.setEnabled(bool(self.current_directory))
        self.btn_stop_scan.setEnabled(False)
        self.btn_select_folder.setEnabled(True)
        self.btn_scan_computer.setEnabled(True)
        self.progress_bar.setVisible(False)

    def load_pdf_list(self):
        """Load PDF list from database with default filter and sort"""
        try:
            # Apply default filter (With Annotations Only) and sort (Annotations Count descending)
            pdf_list = self.analyzer.get_pdf_list(filter_annotated=True, sort_by="total_annotations")
            self.populate_pdf_table(pdf_list)
            self.update_statistics()
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to load PDF list:\n{e}")

    def populate_pdf_table(self, pdf_list: List[Dict[str, Any]]):
        """Populate the PDF table with data"""
        self.pdf_table.setRowCount(len(pdf_list))

        if not pdf_list:
            return

        for row, pdf_data in enumerate(pdf_list):
            # File Name (clickable)
            name_item = QTableWidgetItem(pdf_data['file_name'])
            name_item.setData(Qt.UserRole, pdf_data['file_path'])  # Store full path
            self.pdf_table.setItem(row, 0, name_item)

            # Path
            path_item = QTableWidgetItem(pdf_data['file_path'])
            self.pdf_table.setItem(row, 1, path_item)

            # Pages
            pages_item = QTableWidgetItem(str(pdf_data['page_count']))
            pages_item.setTextAlignment(Qt.AlignCenter)
            self.pdf_table.setItem(row, 2, pages_item)

            # Annotations
            annotations_item = QTableWidgetItem(str(pdf_data['total_annotations']))
            annotations_item.setTextAlignment(Qt.AlignCenter)
            # Color code based on annotation count
            if pdf_data['total_annotations'] > 20:
                annotations_item.setBackground(Qt.green)
            elif pdf_data['total_annotations'] > 5:
                annotations_item.setBackground(Qt.yellow)
            self.pdf_table.setItem(row, 3, annotations_item)

            # Intensity
            intensity_item = QTableWidgetItem(f"{pdf_data['reading_intensity_score']:.2f}")
            intensity_item.setTextAlignment(Qt.AlignCenter)
            self.pdf_table.setItem(row, 4, intensity_item)

            # Last Modified
            modified_item = QTableWidgetItem(str(pdf_data['last_modified'])[:19])
            self.pdf_table.setItem(row, 5, modified_item)

            # Last Scanned
            scanned_item = QTableWidgetItem(str(pdf_data['last_scanned'])[:19])
            self.pdf_table.setItem(row, 6, scanned_item)

    def search_pdfs(self):
        """Search PDFs based on filename or path"""
        search_text = self.search_box.text().lower()
        if not search_text:
            self.filter_pdf_list()  # Show all when search is empty
            return

        all_pdfs = self.analyzer.get_pdf_list()
        filtered_pdfs = [
            pdf for pdf in all_pdfs
            if search_text in pdf['file_name'].lower() or search_text in pdf['file_path'].lower()
        ]
        self.populate_pdf_table(filtered_pdfs)

    def filter_pdf_list(self):
        """Filter PDF list based on selected criteria"""
        filter_type = self.filter_combo.currentText()

        if filter_type == "All PDFs":
            pdf_list = self.analyzer.get_pdf_list()
        elif filter_type == "With Annotations Only":
            pdf_list = self.analyzer.get_pdf_list(filter_annotated=True)
        elif filter_type == "Recently Modified (30 days)":
            # Get PDFs modified in last 30 days
            cutoff_date = datetime.now() - timedelta(days=30)
            all_pdfs = self.analyzer.get_pdf_list()
            pdf_list = [
                pdf for pdf in all_pdfs
                if datetime.fromisoformat(pdf['last_modified'].replace('Z', '+00:00')) > cutoff_date
            ]
        elif filter_type == "High Activity (10+ annotations)":
            all_pdfs = self.analyzer.get_pdf_list()
            pdf_list = [pdf for pdf in all_pdfs if pdf['total_annotations'] >= 10]
        elif filter_type == "Low Activity (1-5 annotations)":
            all_pdfs = self.analyzer.get_pdf_list()
            pdf_list = [pdf for pdf in all_pdfs if 1 <= pdf['total_annotations'] <= 5]
        elif filter_type == "No Annotations":
            all_pdfs = self.analyzer.get_pdf_list()
            pdf_list = [pdf for pdf in all_pdfs if pdf['total_annotations'] == 0]
        else:
            pdf_list = self.analyzer.get_pdf_list()

        # Apply search filter if search text exists
        search_text = self.search_box.text().lower()
        if search_text:
            pdf_list = [
                pdf for pdf in pdf_list
                if search_text in pdf['file_name'].lower() or search_text in pdf['file_path'].lower()
            ]

        self.populate_pdf_table(pdf_list)

    def sort_pdf_list(self):
        """Sort PDF list based on selected criteria"""
        sort_type = self.sort_combo.currentText()

        sort_mapping = {
            "Last Scanned": "last_scanned",
            "File Name": "file_name",
            "Last Modified": "last_modified",
            "Annotations Count": "total_annotations",
            "Reading Intensity": "reading_intensity_score"
        }

        sort_by = sort_mapping.get(sort_type, "last_scanned")
        pdf_list = self.analyzer.get_pdf_list(sort_by=sort_by)
        self.populate_pdf_table(pdf_list)

    def update_statistics(self):
        """Update the statistics display"""
        try:
            stats = self.analyzer.get_reading_statistics()

            self.stats_labels['total_pdfs'].setText(str(stats.get('total_pdfs', 0)))
            self.stats_labels['annotated_pdfs'].setText(str(stats.get('pdfs_with_annotations', 0)))
            self.stats_labels['total_annotations'].setText(str(stats.get('total_annotations', 0)))
            self.stats_labels['avg_intensity'].setText(f"{stats.get('average_intensity', 0):.2f}")

        except Exception as e:
            QMessageBox.warning(self, "Statistics Error", f"Failed to update statistics:\n{e}")

    def on_pdf_double_clicked(self, item):
        """Handle double-click on PDF item"""
        self.open_selected_pdf()

    def on_pdf_selection_changed(self):
        """Handle PDF selection change"""
        selected_rows = self.pdf_table.selectionModel().selectedRows()

        if selected_rows:
            self.btn_open_pdf.setEnabled(True)
            self.btn_export_annotations.setEnabled(True)

            # Show PDF details
            row = selected_rows[0].row()
            file_path = self.pdf_table.item(row, 1).text()
            self.show_pdf_details(file_path)
        else:
            self.btn_open_pdf.setEnabled(False)
            self.btn_export_annotations.setEnabled(False)
            self.details_text.clear()

    def show_pdf_details(self, file_path: str):
        """Show details for selected PDF"""
        try:
            # Get PDF data from database
            pdf_list = self.analyzer.get_pdf_list()
            pdf_data = next((pdf for pdf in pdf_list if pdf['file_path'] == file_path), None)

            if pdf_data:
                details = f"📄 **{pdf_data['file_name']}**\n\n"
                details += f"📁 **Path:** {pdf_data['file_path']}\n"
                details += f"📊 **Pages:** {pdf_data['page_count']}\n"
                details += f"💬 **Annotations:** {pdf_data['total_annotations']}\n"
                details += f"🔥 **Reading Intensity:** {pdf_data['reading_intensity_score']:.2f}\n"
                details += f"📅 **Last Modified:** {pdf_data['last_modified']}\n"
                details += f"🔍 **Last Scanned:** {pdf_data['last_scanned']}\n"
                details += f"💾 **File Size:** {pdf_data['file_size'] / 1024 / 1024:.2f} MB\n\n"

                # Show annotation types
                if pdf_data['annotations_by_type']:
                    details += "**Annotation Types:**\n"
                    for annot_type, count in pdf_data['annotations_by_type'].items():
                        details += f"• {annot_type}: {count}\n"

                self.details_text.setMarkdown(details)

        except Exception as e:
            self.details_text.setText(f"Error loading details: {e}")

    def open_selected_pdf(self):
        """Open the selected PDF file"""
        selected_rows = self.pdf_table.selectionModel().selectedRows()
        if not selected_rows:
            return

        row = selected_rows[0].row()
        file_path = self.pdf_table.item(row, 1).text()

        if not os.path.exists(file_path):
            QMessageBox.warning(self, "File Not Found", f"The PDF file was not found:\n{file_path}")
            return

        try:
            # Open PDF with default system application
            if sys.platform.startswith('win'):
                os.startfile(file_path)
            elif sys.platform.startswith('darwin'):  # macOS
                subprocess.run(['open', file_path])
            else:  # Linux and other Unix-like systems
                subprocess.run(['xdg-open', file_path])

        except Exception as e:
            QMessageBox.critical(self, "Error Opening PDF", f"Failed to open PDF:\n{e}")

    def export_annotations(self):
        """Export annotations for selected PDF to markdown with preview"""
        selected_rows = self.pdf_table.selectionModel().selectedRows()
        if not selected_rows:
            return

        row = selected_rows[0].row()
        file_path = self.pdf_table.item(row, 1).text()
        file_name = self.pdf_table.item(row, 0).text()

        try:
            # Export to same directory as PDF (auto-generated path)
            content = self.analyzer.export_annotations_to_markdown(file_path)

            if content:
                # Get the auto-generated output path
                pdf_dir = os.path.dirname(file_path)
                pdf_name = os.path.splitext(os.path.basename(file_path))[0]
                output_path = os.path.join(pdf_dir, f"{pdf_name}_annotations.md")

                # Show preview dialog
                self.show_markdown_preview(content, output_path, file_name)
            else:
                QMessageBox.warning(
                    self, "Export Warning",
                    "No annotations with content found for this PDF."
                )
        except Exception as e:
            QMessageBox.critical(self, "Export Error", f"Failed to export annotations:\n{e}")

    def show_markdown_preview(self, content: str, output_path: str, pdf_name: str):
        """Show markdown preview dialog"""
        dialog = QDialog(self)
        dialog.setWindowTitle(f"📝 Annotations Preview - {pdf_name}")
        dialog.setModal(True)
        dialog.resize(800, 600)

        layout = QVBoxLayout(dialog)

        # Info label
        info_label = QLabel(f"📁 Export location: {output_path}")
        info_label.setStyleSheet("color: #666; font-size: 11px; padding: 5px;")
        info_label.setWordWrap(True)
        layout.addWidget(info_label)

        # Preview text (clean, no markdown symbols for better readability)
        preview_text = QTextEdit()
        preview_text.setReadOnly(True)

        # Convert markdown to plain text for preview
        clean_content = self.markdown_to_plain_text(content)
        preview_text.setPlainText(clean_content)

        # Style the preview
        preview_text.setStyleSheet("""
            QTextEdit {
                font-family: 'Segoe UI', Arial, sans-serif;
                font-size: 13px;
                line-height: 1.5;
                padding: 15px;
                border: 1px solid #ddd;
                border-radius: 5px;
            }
        """)

        layout.addWidget(preview_text)

        # Buttons
        button_layout = QHBoxLayout()

        save_btn = QPushButton("💾 Save & Open")
        save_btn.clicked.connect(lambda: self.save_and_open_markdown(output_path, content, dialog))
        save_btn.setStyleSheet("""
            QPushButton {
                background-color: #28a745;
                color: white;
                font-weight: bold;
                padding: 8px 16px;
                border-radius: 4px;
            }
            QPushButton:hover { background-color: #218838; }
        """)
        button_layout.addWidget(save_btn)

        save_only_btn = QPushButton("💾 Save Only")
        save_only_btn.clicked.connect(lambda: self.save_markdown_only(output_path, content, dialog))
        save_only_btn.setStyleSheet("""
            QPushButton {
                background-color: #007bff;
                color: white;
                font-weight: bold;
                padding: 8px 16px;
                border-radius: 4px;
            }
            QPushButton:hover { background-color: #0056b3; }
        """)
        button_layout.addWidget(save_only_btn)

        cancel_btn = QPushButton("❌ Cancel")
        cancel_btn.clicked.connect(dialog.reject)
        button_layout.addWidget(cancel_btn)

        layout.addLayout(button_layout)

        dialog.exec()

    def markdown_to_plain_text(self, markdown_content: str) -> str:
        """Convert markdown to clean plain text for preview"""
        lines = markdown_content.split('\n')
        clean_lines = []

        for line in lines:
            # Remove markdown formatting for better readability
            clean_line = line
            clean_line = clean_line.replace('**', '').replace('*', '')
            clean_line = clean_line.replace('~~', '').replace('`', '')
            clean_line = clean_line.replace('# ', '').replace('## ', '  ')
            clean_line = clean_line.replace('### ', '    ')
            clean_line = clean_line.replace('• ', '  • ')
            clean_line = clean_line.replace('📝 ', '  💬 ')
            clean_line = clean_line.replace('📖 ', '')

            clean_lines.append(clean_line)

        return '\n'.join(clean_lines)

    def save_and_open_markdown(self, output_path: str, content: str, dialog: QDialog):
        """Save markdown and open it"""
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)

            # Open the file with default application
            if sys.platform.startswith('win'):
                os.startfile(output_path)
            elif sys.platform.startswith('darwin'):  # macOS
                subprocess.run(['open', output_path])
            else:  # Linux and other Unix-like systems
                subprocess.run(['xdg-open', output_path])

            dialog.accept()
            QMessageBox.information(
                self, "Export Successful",
                f"Annotations exported and opened:\n{output_path}"
            )

        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to save or open file:\n{e}")

    def save_markdown_only(self, output_path: str, content: str, dialog: QDialog):
        """Save markdown without opening"""
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)

            dialog.accept()
            QMessageBox.information(
                self, "Export Successful",
                f"Annotations exported to:\n{output_path}"
            )

        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to save file:\n{e}")

    def export_pdf_list(self):
        """Export the current PDF list to CSV"""
        output_path, _ = QFileDialog.getSaveFileName(
            self, "Export PDF List",
            "pdf_reading_progress.csv",
            "CSV Files (*.csv);;All Files (*)"
        )

        if output_path:
            try:
                import csv

                # Get current PDF list
                pdf_list = self.analyzer.get_pdf_list()

                with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
                    fieldnames = [
                        'file_name', 'file_path', 'page_count', 'total_annotations',
                        'reading_intensity_score', 'last_modified', 'last_scanned',
                        'file_size', 'estimated_reading_time'
                    ]
                    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

                    writer.writeheader()
                    for pdf_data in pdf_list:
                        # Select only the fields we want to export
                        row_data = {field: pdf_data.get(field, '') for field in fieldnames}
                        writer.writerow(row_data)

                QMessageBox.information(
                    self, "Export Successful",
                    f"PDF list exported successfully to:\n{output_path}"
                )

            except Exception as e:
                QMessageBox.critical(self, "Export Error", f"Failed to export PDF list:\n{e}")

    def show_study_timeline(self):
        """Show study timeline dialog"""
        try:
            timeline_data = self.analyzer.get_study_timeline(30)  # Last 30 days

            if not timeline_data.get('timeline'):
                QMessageBox.information(
                    self, "Study Timeline",
                    "No study activity found in the last 30 days."
                )
                return

            # Create timeline dialog
            dialog = QDialog(self)
            dialog.setWindowTitle("📅 Study Timeline - Last 30 Days")
            dialog.setModal(True)
            dialog.resize(600, 400)

            layout = QVBoxLayout(dialog)

            # Timeline table
            timeline_table = QTableWidget()
            timeline_table.setColumnCount(3)
            timeline_table.setHorizontalHeaderLabels(["Date", "PDFs Studied", "Annotations Made"])

            timeline = timeline_data['timeline']
            timeline_table.setRowCount(len(timeline))

            for row, (date, pdfs_count, annotations_count) in enumerate(timeline):
                timeline_table.setItem(row, 0, QTableWidgetItem(str(date)))
                timeline_table.setItem(row, 1, QTableWidgetItem(str(pdfs_count)))
                timeline_table.setItem(row, 2, QTableWidgetItem(str(annotations_count or 0)))

            # Configure table
            header = timeline_table.horizontalHeader()
            header.setSectionResizeMode(0, QHeaderView.ResizeToContents)
            header.setSectionResizeMode(1, QHeaderView.ResizeToContents)
            header.setSectionResizeMode(2, QHeaderView.Stretch)

            layout.addWidget(timeline_table)

            # Summary
            summary_label = QLabel(
                f"📊 **Summary:** {timeline_data['total_days_active']} active days "
                f"in the last {timeline_data['period_days']} days"
            )
            summary_label.setStyleSheet("font-weight: bold; padding: 10px;")
            layout.addWidget(summary_label)

            # Close button
            close_btn = QPushButton("Close")
            close_btn.clicked.connect(dialog.accept)
            layout.addWidget(close_btn)

            dialog.exec()

        except Exception as e:
            QMessageBox.critical(self, "Timeline Error", f"Failed to show study timeline:\n{e}")

    def backup_data(self):
        """Backup all reading progress data"""
        try:
            output_path, _ = QFileDialog.getSaveFileName(
                self, "Backup Reading Progress Data",
                f"pdf_reading_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
                "JSON Files (*.json);;All Files (*)"
            )

            if output_path:
                # Get all data from database
                pdf_list = self.analyzer.get_pdf_list()
                stats = self.analyzer.get_reading_statistics()
                timeline = self.analyzer.get_study_timeline(365)  # Last year

                backup_data = {
                    'backup_date': datetime.now().isoformat(),
                    'version': '1.0',
                    'pdf_list': pdf_list,
                    'statistics': stats,
                    'timeline': timeline,
                    'total_records': len(pdf_list)
                }

                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(backup_data, f, indent=2, ensure_ascii=False, default=str)

                QMessageBox.information(
                    self, "Backup Successful",
                    f"Reading progress data backed up successfully!\n\n"
                    f"File: {output_path}\n"
                    f"Records: {len(pdf_list)} PDFs\n"
                    f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
                )

        except Exception as e:
            QMessageBox.critical(self, "Backup Error", f"Failed to backup data:\n{e}")

    def restore_data(self):
        """Restore reading progress data from backup"""
        try:
            file_path, _ = QFileDialog.getOpenFileName(
                self, "Restore Reading Progress Data",
                "",
                "JSON Files (*.json);;All Files (*)"
            )

            if file_path:
                reply = QMessageBox.question(
                    self, "Confirm Restore",
                    "This will replace all current reading progress data with the backup data. "
                    "Are you sure you want to continue?\n\n"
                    "Recommendation: Create a backup of current data first!",
                    QMessageBox.Yes | QMessageBox.No,
                    QMessageBox.No
                )

                if reply == QMessageBox.Yes:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        backup_data = json.load(f)

                    # Validate backup data
                    if 'pdf_list' not in backup_data:
                        QMessageBox.warning(self, "Invalid Backup", "The selected file is not a valid backup file.")
                        return

                    # Clear current data and restore
                    # Note: This is a simplified restore - in production you'd want more sophisticated merging
                    QMessageBox.information(
                        self, "Restore Info",
                        f"Backup file contains:\n"
                        f"• {backup_data.get('total_records', 0)} PDF records\n"
                        f"• Created: {backup_data.get('backup_date', 'Unknown')}\n"
                        f"• Version: {backup_data.get('version', 'Unknown')}\n\n"
                        f"Note: Full restore functionality would be implemented in production version."
                    )

        except Exception as e:
            QMessageBox.critical(self, "Restore Error", f"Failed to restore data:\n{e}")

    def clear_all_data(self):
        """Clear all reading progress data"""
        try:
            reply = QMessageBox.question(
                self, "Confirm Clear All Data",
                "⚠️ WARNING: This will permanently delete ALL reading progress data!\n\n"
                "This includes:\n"
                "• All PDF tracking records\n"
                "• All annotation data\n"
                "• All study session history\n"
                "• All statistics\n\n"
                "This action CANNOT be undone!\n\n"
                "Are you absolutely sure you want to continue?",
                QMessageBox.Yes | QMessageBox.No,
                QMessageBox.No
            )

            if reply == QMessageBox.Yes:
                # Double confirmation
                confirm_text, ok = QInputDialog.getText(
                    self, "Final Confirmation",
                    "Type 'DELETE ALL DATA' to confirm (case sensitive):"
                )

                if ok and confirm_text == "DELETE ALL DATA":
                    # Clear database
                    import sqlite3
                    conn = sqlite3.connect(self.analyzer.db_path)
                    cursor = conn.cursor()

                    cursor.execute("DELETE FROM pdf_annotations")
                    cursor.execute("DELETE FROM study_sessions")
                    cursor.execute("DELETE FROM pdf_progress")

                    conn.commit()
                    conn.close()

                    # Refresh UI
                    self.load_pdf_list()
                    self.update_statistics()

                    QMessageBox.information(
                        self, "Data Cleared",
                        "All reading progress data has been permanently deleted."
                    )
                else:
                    QMessageBox.information(self, "Cancelled", "Data clearing cancelled.")

        except Exception as e:
            QMessageBox.critical(self, "Clear Data Error", f"Failed to clear data:\n{e}")

    def toggle_description(self):
        """Toggle the description visibility"""
        is_visible = self.description_label.isVisible()
        self.description_label.setVisible(not is_visible)

        if is_visible:
            self.btn_toggle_help.setText("💡 Show Help")
        else:
            self.btn_toggle_help.setText("❌ Hide Help")


# Example usage for testing
if __name__ == "__main__":
    from PySide6.QtWidgets import QApplication
    import sys

    app = QApplication(sys.argv)

    # Create a simple test window
    window = PDFReadingProgressTab()
    window.show()

    sys.exit(app.exec())