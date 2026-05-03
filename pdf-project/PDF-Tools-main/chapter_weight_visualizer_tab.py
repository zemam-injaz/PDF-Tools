#!/usr/bin/env python3
"""
Chapter Weight Visualizer Tab - UI for Smart Chapter Weight & Reading Planner
Provides visualization and analysis of bookmark-based chapter weights
"""

import os
import sys
from typing import List, Optional
from datetime import datetime

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGroupBox, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QFileDialog, QMessageBox, QSpinBox,
    QComboBox, QTextEdit, QSplitter, QCheckBox, QDateEdit, QProgressBar,
    QFrame, QScrollArea, QDialog, QDialogButtonBox, QListWidget, QListWidgetItem
)
from PySide6.QtCore import Qt, QDate, Signal, QSize
from PySide6.QtGui import QFont, QIcon
from PySide6.QtWidgets import QApplication

try:
    import fitz  # PyMuPDF
except ImportError:
    print("Warning: PyMuPDF not available")

try:
    from chapter_weight_analyzer import (
        Bookmark, ChapterWeightAnalyzer, ReadingPlanGenerator,
        ChapterWeight, ReadingPlanEntry
    )
except ImportError:
    print("Warning: chapter_weight_analyzer module not available")

# New: direct proportional pages-based calculator
try:
    from direct_study_plan_calculator import DirectStudyPlanCalculator  # type: ignore
except Exception:
    DirectStudyPlanCalculator = None  # graceful fallback if module missing

try:
    from chapter_weight_charts import ChapterWeightChartGenerator, is_matplotlib_available
    CHARTS_AVAILABLE = is_matplotlib_available()
except ImportError:
    CHARTS_AVAILABLE = False
    print("Warning: chapter_weight_charts module not available")


class ChapterSelectionDialog(QDialog):
    """Dialog for selecting which chapters to include in the study plan"""

    def __init__(self, chapter_weights: List, localization, parent=None):
        super().__init__(parent)
        self.chapter_weights = chapter_weights
        self.localization = localization
        self.selected_chapters = []

        self.setWindowTitle(localization.get_text("select_chapters") if localization else "Select Chapters")
        self.setMinimumWidth(600)
        self.setMinimumHeight(400)

        self.init_ui()

    def init_ui(self):
        """Initialize the dialog UI"""
        layout = QVBoxLayout(self)

        # Instructions label
        instructions = QLabel(
            self.localization.get_text("select_chapters_instruction")
            if self.localization
            else "Select the chapters you want to include in your study plan.\nUncheck chapters like TOC, prefaces, etc. that you want to skip."
        )
        instructions.setWordWrap(True)
        instructions.setStyleSheet("padding: 10px; background-color: #f0f0f0; border-radius: 5px;")
        layout.addWidget(instructions)

        # Chapter list with checkboxes
        self.chapter_list = QListWidget()
        self.chapter_list.setAlternatingRowColors(True)

        for chapter in self.chapter_weights:
            item = QListWidgetItem(f"{chapter.title} ({chapter.start_page}-{chapter.end_page}, {chapter.page_count} pages)")
            item.setFlags(item.flags() | Qt.ItemIsUserCheckable)
            item.setCheckState(Qt.Checked)  # All checked by default
            item.setData(Qt.UserRole, chapter)  # Store chapter object
            self.chapter_list.addItem(item)

        layout.addWidget(self.chapter_list)

        # Select/Deselect all buttons
        button_layout = QHBoxLayout()
        select_all_btn = QPushButton(self.localization.get_text("select_all") if self.localization else "Select All")
        deselect_all_btn = QPushButton(self.localization.get_text("deselect_all") if self.localization else "Deselect All")

        select_all_btn.clicked.connect(self.select_all)
        deselect_all_btn.clicked.connect(self.deselect_all)

        button_layout.addWidget(select_all_btn)
        button_layout.addWidget(deselect_all_btn)
        button_layout.addStretch()

        layout.addLayout(button_layout)

        # Dialog buttons
        button_box = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        button_box.accepted.connect(self.accept)
        button_box.rejected.connect(self.reject)
        layout.addWidget(button_box)

    def select_all(self):
        """Select all chapters"""
        for i in range(self.chapter_list.count()):
            item = self.chapter_list.item(i)
            item.setCheckState(Qt.Checked)

    def deselect_all(self):
        """Deselect all chapters"""
        for i in range(self.chapter_list.count()):
            item = self.chapter_list.item(i)
            item.setCheckState(Qt.Unchecked)

    def get_selected_chapters(self):
        """Get list of selected chapters"""
        selected = []
        for i in range(self.chapter_list.count()):
            item = self.chapter_list.item(i)
            if item.checkState() == Qt.Checked:
                chapter = item.data(Qt.UserRole)
                selected.append(chapter)
        return selected


class ChapterWeightVisualizerTab(QWidget):
    """Tab for analyzing chapter weights and generating reading plans"""

    def __init__(self, localization=None, settings=None, parent=None):
        super().__init__(parent)
        self.localization = localization
        self.settings = settings
        self.pdf_path = ""
        self.bookmarks: List[Bookmark] = []
        self.total_pages = 0
        self.analyzer: Optional[ChapterWeightAnalyzer] = None
        self.plan_generator: Optional[ReadingPlanGenerator] = None
        self.chapter_weights: List[ChapterWeight] = []
        self.reading_plan: List[ReadingPlanEntry] = []

        self.init_ui()

    def load_pdf_from_external(self, pdf_path: str):
        """Load PDF from external source (e.g., PDF viewer)"""
        if pdf_path and os.path.exists(pdf_path):
            self.pdf_path = pdf_path
            self.pdf_label.setText(os.path.basename(pdf_path))
            # Auto-load bookmarks
            self.load_bookmarks()

    def get_auto_filename(self, suffix: str, extension: str) -> str:
        """
        Generate automatic filename based on PDF name and timestamp.
        Returns full path in the same directory as the PDF file.
        """
        if self.pdf_path:
            # Get PDF directory and base name
            pdf_dir = os.path.dirname(self.pdf_path)
            pdf_name = os.path.splitext(os.path.basename(self.pdf_path))[0]
        else:
            # Fallback to current directory if no PDF loaded
            pdf_dir = os.getcwd()
            pdf_name = "export"

        # Short timestamp: YYYYMMDD_HHMM
        timestamp = datetime.now().strftime("%Y%m%d_%H%M")

        # Generate filename
        filename = f"{pdf_name}_{suffix}_{timestamp}.{extension}"

        # Return full path in PDF's directory
        return os.path.join(pdf_dir, filename)

    def init_ui(self):
        """Initialize the UI"""
        layout = QVBoxLayout(self)
        layout.setSpacing(15)
        layout.setContentsMargins(20, 20, 20, 20)

        # Title
        title = QLabel(self.localization.get_text("chapter_weight_analyzer"))
        title.setFont(QFont("Arial", 16, QFont.Bold))
        title.setAlignment(Qt.AlignCenter)
        layout.addWidget(title)

        # Description
        desc = QLabel(self.localization.get_text("chapter_weight_desc"))
        desc.setWordWrap(True)
        desc.setAlignment(Qt.AlignCenter)
        desc.setStyleSheet("color: #666; padding: 10px;")
        layout.addWidget(desc)

        # Input section
        input_group = self.create_input_section()
        layout.addWidget(input_group)

        # Analysis options
        options_group = self.create_options_section()
        layout.addWidget(options_group)

        # Results section (splitter for weights and plan)
        results_splitter = QSplitter(Qt.Horizontal)

        # Chapter weights table
        weights_group = self.create_weights_section()
        results_splitter.addWidget(weights_group)

        # Reading plan section
        plan_group = self.create_plan_section()
        results_splitter.addWidget(plan_group)

        results_splitter.setSizes([500, 500])
        layout.addWidget(results_splitter, 1)

        # Statistics section
        stats_group = self.create_statistics_section()
        layout.addWidget(stats_group)

        # Export section
        export_group = self.create_export_section()
        layout.addWidget(export_group)

    def create_input_section(self) -> QGroupBox:
        """Create PDF input section"""
        group = QGroupBox(self.localization.get_text("file_selection"))
        layout = QVBoxLayout(group)

        # File selection
        file_layout = QHBoxLayout()

        self.pdf_label = QLabel(self.localization.get_text("select_pdf_placeholder"))
        self.pdf_label.setStyleSheet("padding: 5px; background: #f0f0f0; border-radius: 3px;")
        file_layout.addWidget(self.pdf_label, 1)

        browse_btn = QPushButton("📂 " + self.localization.get_text("browse"))
        browse_btn.clicked.connect(self.browse_pdf)
        browse_btn.setStyleSheet("""
            QPushButton {
                background-color: #4CAF50;
                color: white;
                padding: 8px 16px;
                font-weight: bold;
                border-radius: 4px;
                font-size: 11pt;
            }
            QPushButton:hover {
                background-color: #45a049;
            }
        """)
        file_layout.addWidget(browse_btn)

        layout.addLayout(file_layout)

        # Info labels
        info_layout = QHBoxLayout()
        self.pages_label = QLabel(self.localization.get_text("total_pages") + " -")
        self.bookmarks_label = QLabel(self.localization.get_text("extracted_bookmarks") + " -")
        info_layout.addWidget(self.pages_label)
        info_layout.addWidget(self.bookmarks_label)
        info_layout.addStretch()
        layout.addLayout(info_layout)

        return group

    def create_options_section(self) -> QGroupBox:
        """Create analysis options section"""
        group = QGroupBox(self.localization.get_text("analysis_options"))
        layout = QHBoxLayout(group)

        # Level selection
        level_label = QLabel(self.localization.get_text("include_levels"))
        layout.addWidget(level_label)

        self.level_combo = QComboBox()
        self.level_combo.addItems([
            self.localization.get_text("level_1_only"),
            self.localization.get_text("levels_1_2"),
            self.localization.get_text("all_levels")
        ])
        layout.addWidget(self.level_combo)

        layout.addSpacing(20)

        # Analyze button
        analyze_btn = QPushButton(self.localization.get_text("analyze_weights_btn"))
        analyze_btn.clicked.connect(self.analyze_weights)
        analyze_btn.setStyleSheet("background-color: #2196F3; color: white; padding: 8px 16px; font-weight: bold;")
        layout.addWidget(analyze_btn)

        layout.addStretch()

        return group

    def create_weights_section(self) -> QGroupBox:
        """Create chapter weights display section"""
        group = QGroupBox(self.localization.get_text("bookmark_weight_distribution"))
        layout = QVBoxLayout(group)

        # Weights table
        self.weights_table = QTableWidget()
        self.weights_table.setColumnCount(6)
        self.weights_table.setHorizontalHeaderLabels([
            self.localization.get_text("chapter_title"),
            self.localization.get_text("level"),
            self.localization.get_text("start_page"),
            self.localization.get_text("end_page"),
            self.localization.get_text("page_count"),
            self.localization.get_text("weight_percent")
        ])
        self.weights_table.setAlternatingRowColors(True)
        self.weights_table.horizontalHeader().setStretchLastSection(True)

        # Improve scrolling
        self.weights_table.setVerticalScrollMode(QTableWidget.ScrollPerPixel)
        self.weights_table.setHorizontalScrollMode(QTableWidget.ScrollPerPixel)
        self.weights_table.verticalScrollBar().setSingleStep(20)

        # Better sizing
        self.weights_table.setMinimumHeight(300)

        # Add click navigation functionality
        self.weights_table.cellClicked.connect(self.on_bookmark_cell_clicked)

        layout.addWidget(self.weights_table)

        return group

    def create_plan_section(self) -> QGroupBox:
        """Create reading plan section"""
        group = QGroupBox(self.localization.get_text("reading_plan_section"))
        layout = QVBoxLayout(group)

        # Plan controls
        controls_layout = QHBoxLayout()

        # Duration label
        duration_label = QLabel(self.localization.get_text("plan_duration"))
        duration_label.setStyleSheet("font-weight: bold; font-size: 11pt;")
        controls_layout.addWidget(duration_label)

        # Duration spinbox with improved styling
        self.duration_spin = QSpinBox()
        self.duration_spin.setRange(1, 365)
        self.duration_spin.setValue(30)
        self.duration_spin.setAlignment(Qt.AlignRight)  # Right-align the number
        self.duration_spin.setMinimumWidth(100)
        self.duration_spin.setFixedHeight(32)  # Fixed height to match other widgets
        self.duration_spin.setButtonSymbols(QSpinBox.UpDownArrows)
        self.duration_spin.setStyleSheet("""
            QSpinBox {
                padding: 4px 8px;
                font-size: 11pt;
                font-weight: bold;
                border: 2px solid #2196F3;
                border-radius: 6px;
                background-color: white;
                color: #1976D2;
            }
            QSpinBox:hover {
                border: 2px solid #1976D2;
                background-color: #E3F2FD;
            }
            QSpinBox:focus {
                border: 2px solid #0D47A1;
                background-color: #BBDEFB;
            }
            QSpinBox::up-button {
                subcontrol-origin: border;
                subcontrol-position: top right;
                width: 24px;
                border-left: 1px solid #2196F3;
                border-bottom: 1px solid #2196F3;
                border-top-right-radius: 4px;
                background-color: #E3F2FD;
            }
            QSpinBox::up-button:hover {
                background-color: #2196F3;
            }
            QSpinBox::up-arrow {
                image: none;
                width: 0px;
                height: 0px;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-bottom: 6px solid #1976D2;
            }
            QSpinBox::up-arrow:hover {
                border-bottom: 6px solid white;
            }
            QSpinBox::down-button {
                subcontrol-origin: border;
                subcontrol-position: bottom right;
                width: 24px;
                border-left: 1px solid #2196F3;
                border-top: 1px solid #2196F3;
                border-bottom-right-radius: 4px;
                background-color: #E3F2FD;
            }
            QSpinBox::down-button:hover {
                background-color: #2196F3;
            }
            QSpinBox::down-arrow {
                image: none;
                width: 0px;
                height: 0px;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-top: 6px solid #1976D2;
            }
            QSpinBox::down-arrow:hover {
                border-top: 6px solid white;
            }
        """)
        self.duration_spin.setToolTip("⬆️ Increase / ⬇️ Decrease days")
        controls_layout.addWidget(self.duration_spin)

        controls_layout.addSpacing(10)

        # Algorithm selector
        algo_label = QLabel(self.localization.get_text("algorithm"))
        algo_label.setFixedHeight(32)
        controls_layout.addWidget(algo_label)

        self.algorithm_combo = QComboBox()
        self.algorithm_combo.addItems([
            self.localization.get_text("algorithm_weight_based"),
            self.localization.get_text("algorithm_direct_pages"),
        ])
        self.algorithm_combo.setFixedHeight(32)
        controls_layout.addWidget(self.algorithm_combo)

        controls_layout.addSpacing(10)

        start_date_label = QLabel(self.localization.get_text("start_date"))
        start_date_label.setFixedHeight(32)  # Match spinbox height
        controls_layout.addWidget(start_date_label)

        self.start_date_edit = QDateEdit()
        self.start_date_edit.setDate(QDate.currentDate())
        self.start_date_edit.setCalendarPopup(True)
        self.start_date_edit.setFixedHeight(32)  # Match spinbox height
        controls_layout.addWidget(self.start_date_edit)

        controls_layout.addSpacing(10)

        # Skip Weekends checkbox
        self.skip_weekends_checkbox = QCheckBox(self.localization.get_text("skip_weekends"))
        self.skip_weekends_checkbox.setStyleSheet("""
            QCheckBox {
                font-weight: bold;
                font-size: 10pt;
                spacing: 8px;
            }
            QCheckBox::indicator {
                width: 22px;
                height: 22px;
                border: 2px solid #2196F3;
                border-radius: 4px;
                background-color: white;
            }
            QCheckBox::indicator:hover {
                border: 2px solid #1976D2;
                background-color: #E3F2FD;
            }
            QCheckBox::indicator:checked {
                background-color: #2196F3;
                border: 2px solid #1976D2;
            }
            QCheckBox::indicator:checked {
                background-color: #2196F3;
                border: 2px solid #1976D2;
                background-image: url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEzLjMzMzMgNEw2IDExLjMzMzNMMi42NjY2NyA4IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4K);
                background-repeat: no-repeat;
                background-position: center;
            }
        """)
        self.skip_weekends_checkbox.setToolTip("Skip Saturdays and Sundays in the study plan")
        self.skip_weekends_checkbox.setFixedHeight(32)  # Match spinbox height
        controls_layout.addWidget(self.skip_weekends_checkbox)

        controls_layout.addSpacing(10)

        generate_btn = QPushButton(self.localization.get_text("generate_plan_btn"))
        generate_btn.clicked.connect(self.generate_reading_plan)
        generate_btn.setStyleSheet("background-color: #4CAF50; color: white; padding: 6px 12px; font-weight: bold;")
        generate_btn.setFixedHeight(32)  # Match spinbox height
        controls_layout.addWidget(generate_btn)

        controls_layout.addStretch()
        layout.addLayout(controls_layout)

        # Plan table
        self.plan_table = QTableWidget()
        self.plan_table.setColumnCount(7)
        self.plan_table.setHorizontalHeaderLabels([
            self.localization.get_text("chapter_title"),
            self.localization.get_text("pages"),
            self.localization.get_text("page_count"),
            self.localization.get_text("weight_percent"),
            self.localization.get_text("assigned_days"),
            self.localization.get_text("start_date"),
            self.localization.get_text("end_date")
        ])
        self.plan_table.setAlternatingRowColors(True)
        self.plan_table.horizontalHeader().setStretchLastSection(True)

        # Improve scrolling
        self.plan_table.setVerticalScrollMode(QTableWidget.ScrollPerPixel)
        self.plan_table.setHorizontalScrollMode(QTableWidget.ScrollPerPixel)
        self.plan_table.verticalScrollBar().setSingleStep(20)

        # Better sizing
        self.plan_table.setMinimumHeight(300)

        layout.addWidget(self.plan_table)

        # Daily average label
        self.daily_avg_label = QLabel(self.localization.get_text("avg_pages_day") + " -")
        self.daily_avg_label.setStyleSheet("font-weight: bold; padding: 5px;")
        layout.addWidget(self.daily_avg_label)

        return group

    def create_statistics_section(self) -> QGroupBox:
        """Create statistics display section"""
        group = QGroupBox(self.localization.get_text("statistics_insights"))
        layout = QVBoxLayout(group)

        self.stats_text = QTextEdit()
        self.stats_text.setReadOnly(True)
        self.stats_text.setMaximumHeight(150)
        layout.addWidget(self.stats_text)

        return group

    def create_export_section(self) -> QGroupBox:
        """Create export options section"""
        group = QGroupBox(self.localization.get_text("export_options"))
        layout = QVBoxLayout(group)

        # Data export row - Icon buttons
        data_layout = QHBoxLayout()

        # Load custom icons for Excel and Obsidian (fallback to emoji if missing)
        icon_base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        icon_dir = os.path.join(icon_base_dir, "new_icons")
        excel_icon_path = os.path.join(icon_dir, "Microsoft_Office_Excel_Logo_512px.png")
        obsidian_icon_path = os.path.join(icon_dir, "2023_Obsidian_logo.svg.png")

        # Export weights section
        weights_label = QLabel(self.localization.get_text("bookmark_weight_distribution") + ":")
        weights_label.setStyleSheet("font-weight: bold; font-size: 11pt;")
        data_layout.addWidget(weights_label)

        # Excel button with icon (moved first for priority)
        export_weights_excel_btn = QPushButton()
        export_weights_excel_btn.setToolTip(self.localization.get_text("export_weights_excel"))
        export_weights_excel_btn.clicked.connect(lambda: self.export_weights("excel"))
        export_weights_excel_btn.setFixedSize(40, 40)
        if os.path.exists(excel_icon_path):
            export_weights_excel_btn.setIcon(QIcon(excel_icon_path))
            export_weights_excel_btn.setIconSize(QSize(24, 24))
            export_weights_excel_btn.setStyleSheet("background-color: #217346; border-radius: 5px;")
        else:
            export_weights_excel_btn.setText("📊")
            export_weights_excel_btn.setStyleSheet("font-size: 18pt; background-color: #217346; color: white; border-radius: 5px;")
        data_layout.addWidget(export_weights_excel_btn)

        # JSON button with icon
        export_weights_json_btn = QPushButton("{ }")
        export_weights_json_btn.setToolTip(self.localization.get_text("export_weights_json"))
        export_weights_json_btn.clicked.connect(lambda: self.export_weights("json"))
        export_weights_json_btn.setFixedSize(40, 40)
        export_weights_json_btn.setStyleSheet("font-size: 14pt; font-weight: bold; background-color: #FF9800; color: white; border-radius: 5px;")
        data_layout.addWidget(export_weights_json_btn)

        # Markdown button with icon
        export_weights_md_btn = QPushButton("📝")
        export_weights_md_btn.setToolTip(self.localization.get_text("export_weights_markdown"))
        export_weights_md_btn.clicked.connect(lambda: self.export_weights("markdown"))
        export_weights_md_btn.setFixedSize(40, 40)
        export_weights_md_btn.setStyleSheet("font-size: 18pt; background-color: #2196F3; color: white; border-radius: 5px;")
        data_layout.addWidget(export_weights_md_btn)

        data_layout.addSpacing(30)

        # Export plan section
        plan_label = QLabel(self.localization.get_text("reading_plan_section") + ":")
        plan_label.setStyleSheet("font-weight: bold; font-size: 11pt;")
        data_layout.addWidget(plan_label)

        # Excel button (moved first for priority)
        export_plan_excel_btn = QPushButton()
        export_plan_excel_btn.setToolTip(self.localization.get_text("tooltip_export_plan_excel"))
        export_plan_excel_btn.clicked.connect(lambda: self.export_plan("excel"))
        export_plan_excel_btn.setFixedSize(40, 40)
        if os.path.exists(excel_icon_path):
            export_plan_excel_btn.setIcon(QIcon(excel_icon_path))
            export_plan_excel_btn.setIconSize(QSize(24, 24))
            export_plan_excel_btn.setStyleSheet("background-color: #217346; border-radius: 5px;")
        else:
            export_plan_excel_btn.setText("📊")
            export_plan_excel_btn.setStyleSheet("font-size: 18pt; background-color: #217346; color: white; border-radius: 5px;")
        data_layout.addWidget(export_plan_excel_btn)

        # JSON button
        export_plan_json_btn = QPushButton("{ }")
        export_plan_json_btn.setToolTip(self.localization.get_text("tooltip_export_plan_json"))
        export_plan_json_btn.clicked.connect(lambda: self.export_plan("json"))
        export_plan_json_btn.setFixedSize(40, 40)
        # Obsidian Markdown button (custom icon)
        export_plan_obsidian_btn = QPushButton()
        export_plan_obsidian_btn.setToolTip(self.localization.get_text("tooltip_export_plan_obsidian"))
        export_plan_obsidian_btn.clicked.connect(lambda: self.export_plan("obsidian"))
        export_plan_obsidian_btn.setFixedSize(40, 40)
        if os.path.exists(obsidian_icon_path):
            export_plan_obsidian_btn.setIcon(QIcon(obsidian_icon_path))
            export_plan_obsidian_btn.setIconSize(QSize(24, 24))
            export_plan_obsidian_btn.setStyleSheet("background-color: #5B4BE0; border-radius: 5px;")
        else:
            export_plan_obsidian_btn.setText("🗒️")
            export_plan_obsidian_btn.setStyleSheet("font-size: 18pt; background-color: #5B4BE0; color: white; border-radius: 5px;")
        data_layout.addWidget(export_plan_obsidian_btn)

        export_plan_json_btn.setStyleSheet("font-size: 14pt; font-weight: bold; background-color: #FF9800; color: white; border-radius: 5px;")
        data_layout.addWidget(export_plan_json_btn)

        # Text button
        export_plan_txt_btn = QPushButton("📄")
        export_plan_txt_btn.setToolTip(self.localization.get_text("tooltip_export_plan_text"))
        export_plan_txt_btn.clicked.connect(lambda: self.export_plan("txt"))
        export_plan_txt_btn.setFixedSize(40, 40)
        export_plan_txt_btn.setStyleSheet("font-size: 18pt; background-color: #9E9E9E; color: white; border-radius: 5px;")
        data_layout.addWidget(export_plan_txt_btn)

        # Markdown button
        export_plan_md_btn = QPushButton("📝")
        export_plan_md_btn.setToolTip(self.localization.get_text("tooltip_export_plan_markdown"))
        export_plan_md_btn.clicked.connect(lambda: self.export_plan("markdown"))
        export_plan_md_btn.setFixedSize(40, 40)
        export_plan_md_btn.setStyleSheet("font-size: 18pt; background-color: #2196F3; color: white; border-radius: 5px;")
        data_layout.addWidget(export_plan_md_btn)

        # Copy to clipboard button
        copy_plan_btn = QPushButton("📋")
        copy_plan_btn.setToolTip(self.localization.get_text("tooltip_copy_plan"))
        copy_plan_btn.clicked.connect(self.copy_plan_to_clipboard)
        copy_plan_btn.setFixedSize(40, 40)
        copy_plan_btn.setStyleSheet("font-size: 18pt; background-color: #673AB7; color: white; border-radius: 5px;")
        data_layout.addWidget(copy_plan_btn)

        data_layout.addStretch()
        layout.addLayout(data_layout)

        # Export all formats button
        export_all_layout = QHBoxLayout()
        export_all_btn = QPushButton(self.localization.get_text("export_all_formats"))
        export_all_btn.clicked.connect(self.export_all_formats)
        export_all_btn.setStyleSheet("background-color: #4CAF50; color: white; font-weight: bold; padding: 10px;")
        export_all_layout.addWidget(export_all_btn)

        # Calendar visualization button
        if CHARTS_AVAILABLE:
            calendar_viz_btn = QPushButton("📅 " + self.localization.get_text("export_calendar_visualization"))
            calendar_viz_btn.clicked.connect(self.export_calendar_visualization)
            calendar_viz_btn.setStyleSheet("background-color: #9C27B0; color: white; font-weight: bold; padding: 10px;")
            calendar_viz_btn.setToolTip(self.localization.get_text("tooltip_calendar_visualization"))
            export_all_layout.addWidget(calendar_viz_btn)

        export_all_layout.addStretch()
        layout.addLayout(export_all_layout)

        # Charts export row - Icon buttons
        if CHARTS_AVAILABLE:
            charts_layout = QHBoxLayout()

            charts_label = QLabel(self.localization.get_text("visual_analytics") + ":")
            charts_label.setStyleSheet("font-weight: bold; font-size: 11pt;")
            charts_layout.addWidget(charts_label)

            # Pie chart button
            export_pie_btn = QPushButton("🥧")
            export_pie_btn.setToolTip(self.localization.get_text("export_pie_chart"))
            export_pie_btn.clicked.connect(lambda: self.export_chart("pie"))
            export_pie_btn.setFixedSize(40, 40)
            export_pie_btn.setStyleSheet("font-size: 18pt; background-color: #E91E63; color: white; border-radius: 5px;")
            charts_layout.addWidget(export_pie_btn)

            # Bar chart button
            export_bar_btn = QPushButton("📊")
            export_bar_btn.setToolTip(self.localization.get_text("export_bar_chart"))
            export_bar_btn.clicked.connect(lambda: self.export_chart("bar"))
            export_bar_btn.setFixedSize(40, 40)
            export_bar_btn.setStyleSheet("font-size: 18pt; background-color: #3F51B5; color: white; border-radius: 5px;")
            charts_layout.addWidget(export_bar_btn)

            # Weight chart button
            export_weight_btn = QPushButton("📈")
            export_weight_btn.setToolTip(self.localization.get_text("export_weight_chart"))
            export_weight_btn.clicked.connect(lambda: self.export_chart("weight"))
            export_weight_btn.setFixedSize(40, 40)
            export_weight_btn.setStyleSheet("font-size: 18pt; background-color: #009688; color: white; border-radius: 5px;")
            charts_layout.addWidget(export_weight_btn)

            # Export all charts button
            export_all_charts_btn = QPushButton("📁 " + self.localization.get_text("all_files"))
            export_all_charts_btn.clicked.connect(self.export_all_charts)
            export_all_charts_btn.setStyleSheet("background-color: #FF9800; color: white; font-weight: bold; padding: 8px 16px; border-radius: 5px;")
            charts_layout.addWidget(export_all_charts_btn)

            charts_layout.addStretch()
            layout.addLayout(charts_layout)
        else:
            no_charts_label = QLabel(self.localization.get_text("matplotlib_not_available"))
            no_charts_label.setStyleSheet("color: #FF9800; font-style: italic;")
            layout.addWidget(no_charts_label)

        return group

    # ========== Event Handlers ==========

    def browse_pdf(self):
        """Browse for PDF file"""
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "Select PDF File",
            "",
            "PDF Files (*.pdf);;All Files (*)"
        )

        if file_path:
            self.pdf_path = file_path
            self.pdf_label.setText(os.path.basename(file_path))

            # Auto-load bookmarks
            self.load_bookmarks()

    def load_bookmarks(self):
        """Load bookmarks from the selected PDF"""
        if not self.pdf_path or not os.path.exists(self.pdf_path):
            QMessageBox.warning(self, self.localization.get_text("warning"), self.localization.get_text("select_pdf_placeholder"))
            return

        try:
            doc = fitz.open(self.pdf_path)
            self.total_pages = doc.page_count

            # Extract bookmarks
            toc = doc.get_toc()
            self.bookmarks = []

            for level, title, page in toc:
                bookmark = Bookmark(title=title, page=page, level=level)
                self.bookmarks.append(bookmark)

            doc.close()

            # Update UI
            self.pages_label.setText(f"{self.localization.get_text('total_pages')} {self.total_pages}")
            self.bookmarks_label.setText(f"{self.localization.get_text('extracted_bookmarks')} {len(self.bookmarks)}")

            if len(self.bookmarks) == 0:
                QMessageBox.warning(
                    self,
                    self.localization.get_text("warning"),
                    f"{self.localization.get_text('no_bookmarks_found')}\n\n"
                    f"⚠️ {self.localization.get_text('pdf_no_bookmarks_error')}"
                )
                # Clear any previous analysis
                self.chapter_weights = []
                self.reading_plan = []
                self.weights_table.setRowCount(0)
                self.plan_table.setRowCount(0)
                self.stats_text.clear()
            else:
                QMessageBox.information(
                    self,
                    self.localization.get_text("success"),
                    self.localization.get_text("bookmarks_extracted")
                )

        except Exception as e:
            QMessageBox.critical(self, self.localization.get_text("error"), f"{self.localization.get_text('error')}:\n{str(e)}")

    def analyze_weights(self):
        """Analyze chapter weights"""
        if not self.pdf_path or not os.path.exists(self.pdf_path):
            QMessageBox.warning(
                self,
                self.localization.get_text("warning"),
                self.localization.get_text("select_pdf_placeholder")
            )
            return

        if not self.bookmarks:
            QMessageBox.warning(
                self,
                self.localization.get_text("warning"),
                f"{self.localization.get_text('no_bookmarks_found')}\n\n"
                f"⚠️ {self.localization.get_text('pdf_no_bookmarks_error')}"
            )
            return

        try:
            # Create analyzer
            self.analyzer = ChapterWeightAnalyzer(self.bookmarks, self.total_pages)

            # Determine level to include
            level_index = self.level_combo.currentIndex()
            if level_index == 0:
                include_level = 1
            elif level_index == 1:
                include_level = 2
            else:
                include_level = 10  # All levels

            # Calculate weights
            self.chapter_weights = self.analyzer.calculate_weights(include_level=include_level)

            # Update weights table
            self.update_weights_table()

            # Update statistics
            self.update_statistics()

            QMessageBox.information(
                self,
                self.localization.get_text("success"),
                self.localization.get_text("weights_exported")
            )

        except Exception as e:
            QMessageBox.critical(self, self.localization.get_text("error"), f"{self.localization.get_text('error')}:\n{str(e)}")

    def generate_reading_plan(self):
        """Generate reading plan"""
        if not self.chapter_weights:
            QMessageBox.warning(self, self.localization.get_text("warning"), self.localization.get_text("no_weights_to_export"))
            return

        try:
            # Show chapter selection dialog
            dialog = ChapterSelectionDialog(self.chapter_weights, self.localization, self)
            if dialog.exec() != QDialog.Accepted:
                return  # User cancelled

            # Get selected chapters
            selected_chapters = dialog.get_selected_chapters()

            if not selected_chapters:
                QMessageBox.warning(
                    self,
                    self.localization.get_text("warning"),
                    self.localization.get_text("no_chapters_selected") if self.localization else "No chapters selected. Please select at least one chapter."
                )
                return

            # Get parameters
            total_days = self.duration_spin.value()
            start_date = self.start_date_edit.date().toPython()
            start_datetime = datetime(start_date.year, start_date.month, start_date.day)
            skip_weekends = self.skip_weekends_checkbox.isChecked()

            # Get weekend days from settings
            weekend_days = [5, 6]  # Default to Saturday and Sunday
            if self.settings:
                weekend_days = self.settings.get("weekend_days", [5, 6])

            # Create plan generator according to selected algorithm
            # Use only selected chapters instead of all chapter_weights
            algo_index = getattr(self, 'algorithm_combo', None).currentIndex() if hasattr(self, 'algorithm_combo') else 0
            if algo_index == 1 and DirectStudyPlanCalculator is not None:
                # Direct pages proportional algorithm
                self.plan_generator = DirectStudyPlanCalculator(
                    selected_chapters,
                    total_days,
                    start_datetime,
                    weekends_off=skip_weekends,
                    weekend_days=weekend_days,
                )
            else:
                # Default: weight-based with smart merge (existing)
                self.plan_generator = ReadingPlanGenerator(
                    selected_chapters,
                    total_days,
                    start_datetime,
                    weekends_off=skip_weekends,
                    weekend_days=weekend_days,
                )

            # Generate plan
            self.reading_plan = self.plan_generator.generate_plan()

            # Update plan table
            self.update_plan_table()

            # Update daily average
            daily_avg = self.plan_generator.get_daily_pages()
            self.daily_avg_label.setText(f"{self.localization.get_text('avg_pages_day')} {daily_avg:.1f}")

            QMessageBox.information(
                self,
                self.localization.get_text("success"),
                self.localization.get_text("plan_exported")
            )

        except Exception as e:
            QMessageBox.critical(self, self.localization.get_text("error"), f"{self.localization.get_text('error')}:\n{str(e)}")

    def update_weights_table(self):
        """Update the chapter weights table"""
        self.weights_table.setRowCount(len(self.chapter_weights))

        for row, cw in enumerate(self.chapter_weights):
            # Chapter title
            title_item = QTableWidgetItem(cw.title)
            self.weights_table.setItem(row, 0, title_item)

            # Level
            level_item = QTableWidgetItem(str(cw.level))
            level_item.setTextAlignment(Qt.AlignCenter)
            self.weights_table.setItem(row, 1, level_item)

            # Start page
            start_item = QTableWidgetItem(str(cw.start_page))
            start_item.setTextAlignment(Qt.AlignCenter)
            self.weights_table.setItem(row, 2, start_item)

            # End page
            end_item = QTableWidgetItem(str(cw.end_page))
            end_item.setTextAlignment(Qt.AlignCenter)
            self.weights_table.setItem(row, 3, end_item)

            # Page count
            pages_item = QTableWidgetItem(str(cw.page_count))
            pages_item.setTextAlignment(Qt.AlignCenter)
            self.weights_table.setItem(row, 4, pages_item)

            # Weight percentage
            weight_item = QTableWidgetItem(f"{cw.weight_percentage:.2f}%")
            weight_item.setTextAlignment(Qt.AlignCenter)
            self.weights_table.setItem(row, 5, weight_item)

        self.weights_table.resizeColumnsToContents()

    def update_plan_table(self):
        """Update the reading plan table"""
        self.plan_table.setRowCount(len(self.reading_plan))

        for row, entry in enumerate(self.reading_plan):
            # Chapter title
            title_item = QTableWidgetItem(entry.chapter_title)
            self.plan_table.setItem(row, 0, title_item)

            # Pages range
            pages_item = QTableWidgetItem(f"{entry.start_page}-{entry.end_page}")
            pages_item.setTextAlignment(Qt.AlignCenter)
            self.plan_table.setItem(row, 1, pages_item)

            # Page count
            count_item = QTableWidgetItem(str(entry.page_count))
            count_item.setTextAlignment(Qt.AlignCenter)
            self.plan_table.setItem(row, 2, count_item)

            # Weight percentage
            weight_item = QTableWidgetItem(f"{entry.weight_percentage:.2f}%")
            weight_item.setTextAlignment(Qt.AlignCenter)
            self.plan_table.setItem(row, 3, weight_item)

            # Assigned days
            days_item = QTableWidgetItem(str(entry.assigned_days))
            days_item.setTextAlignment(Qt.AlignCenter)
            self.plan_table.setItem(row, 4, days_item)

            # Start date
            start_item = QTableWidgetItem(entry.start_date)
            start_item.setTextAlignment(Qt.AlignCenter)
            self.plan_table.setItem(row, 5, start_item)

            # End date
            end_item = QTableWidgetItem(entry.end_date)
            end_item.setTextAlignment(Qt.AlignCenter)
            self.plan_table.setItem(row, 6, end_item)

        self.plan_table.resizeColumnsToContents()

    def update_statistics(self):
        """Update statistics display"""
        if not self.analyzer:
            return

        stats = self.analyzer.get_statistics()

        if not stats:
            self.stats_text.setPlainText("No statistics available.")
            return

        # Format statistics text
        text = "📊 CHAPTER WEIGHT STATISTICS\n"
        text += "=" * 60 + "\n\n"

        text += f"Total Chapters: {stats['total_chapters']}\n"
        text += f"Total Pages: {stats['total_pages']}\n"
        text += f"Average Pages per Chapter: {stats['average_pages_per_chapter']:.1f}\n"
        text += f"Average Weight: {stats['average_weight_percentage']:.2f}%\n\n"

        text += "📖 LONGEST CHAPTER:\n"
        text += f"  • {stats['longest_chapter']['title']}\n"
        text += f"  • {stats['longest_chapter']['pages']} pages ({stats['longest_chapter']['percentage']:.2f}%)\n\n"

        text += "📄 SHORTEST CHAPTER:\n"
        text += f"  • {stats['shortest_chapter']['title']}\n"
        text += f"  • {stats['shortest_chapter']['pages']} pages ({stats['shortest_chapter']['percentage']:.2f}%)\n\n"

        text += "🏆 TOP 5 LARGEST CHAPTERS:\n"
        for i, chapter in enumerate(stats['top_5_largest'], 1):
            text += f"  {i}. {chapter['title']}\n"
            text += f"     {chapter['pages']} pages ({chapter['percentage']:.2f}%)\n"

        self.stats_text.setPlainText(text)

    def export_weights(self, format_type: str):
        """Export chapter weights"""
        if not self.analyzer or not self.chapter_weights:
            QMessageBox.warning(self, self.localization.get_text("warning"), self.localization.get_text("no_weights_to_export"))
            return

        # Generate automatic filename
        if format_type == "excel":
            default_name = self.get_auto_filename("weights", "xlsx")
            file_path, _ = QFileDialog.getSaveFileName(
                self, self.localization.get_text("export_weights_excel"), default_name, "Excel Files (*.xlsx)"
            )
        elif format_type == "json":
            default_name = self.get_auto_filename("weights", "json")
            file_path, _ = QFileDialog.getSaveFileName(
                self, self.localization.get_text("export_weights_json"), default_name, "JSON Files (*.json)"
            )
        elif format_type == "markdown":
            default_name = self.get_auto_filename("weights", "md")
            file_path, _ = QFileDialog.getSaveFileName(
                self, self.localization.get_text("export_weights_markdown"), default_name, "Markdown Files (*.md)"
            )
        else:
            return

        if not file_path:
            return

        try:
            if format_type == "excel":
                success = self.analyzer.export_to_excel(file_path)
                if not success:
                    # Check if openpyxl is available
                    try:
                        import openpyxl
                    except ImportError:
                        QMessageBox.warning(
                            self,
                            self.localization.get_text("error"),
                            self.localization.get_text("openpyxl_not_available")
                        )
                        return
            elif format_type == "json":
                success = self.analyzer.export_to_json(file_path)
            elif format_type == "markdown":
                success = self.analyzer.export_to_markdown(file_path)
            else:
                success = False

            if success:
                QMessageBox.information(
                    self,
                    self.localization.get_text("success"),
                    self.localization.get_text("weights_exported")
                )
            else:
                QMessageBox.warning(
                    self,
                    self.localization.get_text("error"),
                    f"{self.localization.get_text('export_failed')}\n\n"
                    f"{self.localization.get_text('check_file_permissions')}"
                )

        except PermissionError as e:
            QMessageBox.critical(
                self,
                self.localization.get_text("error"),
                str(e)  # Already has detailed message from analyzer
            )
        except OSError as e:
            QMessageBox.critical(
                self,
                self.localization.get_text("error"),
                str(e)  # Already has detailed message from analyzer
            )
        except Exception as e:
            error_msg = str(e)
            if "openpyxl" in error_msg.lower():
                QMessageBox.critical(
                    self,
                    self.localization.get_text("error"),
                    self.localization.get_text("openpyxl_not_available")
                )
            else:
                QMessageBox.critical(
                    self,
                    self.localization.get_text("error"),
                    f"{self.localization.get_text('error')}:\n{error_msg}"
                )

    def export_plan(self, format_type: str):
        """Export reading plan"""
        if not self.plan_generator or not self.reading_plan:
            QMessageBox.warning(self, self.localization.get_text("warning"), self.localization.get_text("no_plan_to_export"))
            return

        # Generate automatic filename
        if format_type == "excel":
            default_name = self.get_auto_filename("plan", "xlsx")
            file_path, _ = QFileDialog.getSaveFileName(
                self, self.localization.get_text("export_plan_excel"), default_name, "Excel Files (*.xlsx)"
            )
        elif format_type == "json":
            default_name = self.get_auto_filename("plan", "json")
            file_path, _ = QFileDialog.getSaveFileName(
                self, self.localization.get_text("export_plan_json"), default_name, "JSON Files (*.json)"
            )
        elif format_type == "txt":
            default_name = self.get_auto_filename("plan", "txt")
            file_path, _ = QFileDialog.getSaveFileName(
                self, self.localization.get_text("export_plan_text"), default_name, "Text Files (*.txt)"
            )
        elif format_type == "markdown":
            default_name = self.get_auto_filename("plan", "md")
            file_path, _ = QFileDialog.getSaveFileName(
                self, self.localization.get_text("export_plan_markdown"), default_name, "Markdown Files (*.md)"
            )
        elif format_type == "obsidian":
            default_name = self.get_auto_filename("plan_obsidian", "md")
            file_path, _ = QFileDialog.getSaveFileName(
                self, self.localization.get_text("export_plan_obsidian"), default_name, "Markdown Files (*.md)"
            )
        else:
            return

        if not file_path:
            return

        try:
            if format_type == "excel":
                success = self.plan_generator.export_to_excel(file_path, self.localization)
                if not success:
                    # Check if openpyxl is available
                    try:
                        import openpyxl
                    except ImportError:
                        QMessageBox.warning(
                            self,
                            self.localization.get_text("error"),
                            self.localization.get_text("openpyxl_not_available")
                        )
                        return
            elif format_type == "json":
                success = self.plan_generator.export_to_json(file_path)
            elif format_type == "txt":
                success = self.plan_generator.export_to_text(file_path, self.localization)
            elif format_type == "markdown":
                success = self.plan_generator.export_to_markdown(file_path, self.localization)
            elif format_type == "obsidian":
                success = False
                try:
                    try:
                        # Some implementations accept only filepath
                        success = self.plan_generator.export_to_obsidian_markdown(file_path)  # type: ignore[attr-defined]
                    except TypeError:
                        # Others accept (schedule, filepath)
                        success = self.plan_generator.export_to_obsidian_markdown(self.reading_plan, file_path)  # type: ignore[attr-defined]
                except AttributeError:
                    # Fallback to standard markdown export if Obsidian-specific not available
                    success = self.plan_generator.export_to_markdown(file_path, self.localization)
            else:
                success = False

            if success:
                QMessageBox.information(
                    self,
                    self.localization.get_text("success"),
                    self.localization.get_text("plan_exported")
                )
            else:
                QMessageBox.warning(
                    self,
                    self.localization.get_text("error"),
                    f"{self.localization.get_text('export_failed')}\n\n"
                    f"{self.localization.get_text('check_file_permissions')}"
                )

        except PermissionError as e:
            QMessageBox.critical(
                self,
                self.localization.get_text("error"),
                str(e)  # Already has detailed message from analyzer
            )
        except OSError as e:
            QMessageBox.critical(
                self,
                self.localization.get_text("error"),
                str(e)  # Already has detailed message from analyzer
            )
        except Exception as e:
            error_msg = str(e)
            if "openpyxl" in error_msg.lower():
                QMessageBox.critical(
                    self,
                    self.localization.get_text("error"),
                    self.localization.get_text("openpyxl_not_available")
                )
            else:
                QMessageBox.critical(
                    self,
                    self.localization.get_text("error"),
                    f"{self.localization.get_text('error')}:\n{error_msg}"
                )

    def copy_plan_to_clipboard(self):
        """Copy reading plan to clipboard as formatted text"""
        if not self.plan_generator or not self.reading_plan:
            QMessageBox.warning(
                self,
                self.localization.get_text("warning"),
                self.localization.get_text("no_plan_to_export")
            )
            return

        try:
            # Helper function to get localized text
            def get_text(key: str, fallback: str = "") -> str:
                if self.localization and hasattr(self.localization, 'get_text'):
                    return self.localization.get_text(key)
                return fallback if fallback else key

            # Build formatted text
            text_lines = []
            text_lines.append("=" * 80)
            text_lines.append(get_text("report_reading_plan", "READING PLAN"))
            text_lines.append("=" * 80)
            text_lines.append("")
            text_lines.append(f"{get_text('report_total_target_duration', 'Total Target Duration')}: {self.plan_generator.total_target_days} {get_text('report_days', 'days')}")
            text_lines.append(f"{get_text('report_actual_assigned_duration', 'Actual Assigned Duration')}: {sum(e.assigned_days for e in self.reading_plan)} {get_text('report_days', 'days')}")
            text_lines.append(f"{get_text('report_start_date', 'Start Date')}: {self.plan_generator.start_date.strftime('%Y-%m-%d')}")
            text_lines.append(f"{get_text('report_average_daily_pages', 'Average Daily Pages (Active Days)')}: {self.plan_generator.get_daily_pages():.1f}")
            text_lines.append("")
            text_lines.append("-" * 80)
            text_lines.append("")

            current_reading_day_counter = 1
            for i, entry in enumerate(self.reading_plan, 1):
                days_label = get_text('report_days', 'Days')
                text_lines.append(f"{get_text('report_block', 'Block')} {i} ({days_label} {current_reading_day_counter}-{current_reading_day_counter + entry.assigned_days - 1}) - {entry.start_date} {get_text('report_to', 'to')} {entry.end_date}")
                text_lines.append(f"{get_text('report_chapter', 'Chapter')}: {entry.chapter_title}")
                if entry.merged_chapter_titles:
                    text_lines.append(f"  ({get_text('report_includes', 'Includes')}: {', '.join(entry.merged_chapter_titles)})")
                text_lines.append(f"{get_text('report_pages', 'Pages')}: {entry.start_page}-{entry.end_page} ({entry.page_count} {get_text('report_pages', 'pages')})")
                text_lines.append(f"{get_text('report_duration', 'Duration')}: {entry.assigned_days} {get_text('report_days_unit', 'day(s)')}")
                text_lines.append(f"{get_text('report_weight', 'Weight')}: {entry.weight_percentage:.2f}%")
                text_lines.append("")
                current_reading_day_counter += entry.assigned_days

            text_lines.append("=" * 80)
            text_lines.append(f"{get_text('report_plan_created', 'Plan created')}: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

            # Copy to clipboard
            clipboard = QApplication.clipboard()
            clipboard.setText("\n".join(text_lines))

            QMessageBox.information(
                self,
                self.localization.get_text("success"),
                self.localization.get_text("plan_copied_to_clipboard")
            )
        except Exception as e:
            QMessageBox.critical(
                self,
                self.localization.get_text("error"),
                f"{self.localization.get_text('error')}:\n{str(e)}"
            )

    def export_calendar_visualization(self):
        """Export calendar visualization with study days marked"""
        if not CHARTS_AVAILABLE:
            QMessageBox.warning(
                self,
                self.localization.get_text("warning"),
                self.localization.get_text("matplotlib_not_available")
            )
            return

        if not self.plan_generator or not self.reading_plan:
            QMessageBox.warning(
                self,
                self.localization.get_text("warning"),
                self.localization.get_text("no_plan_to_export")
            )
            return

        # Generate automatic filename
        default_name = self.get_auto_filename("calendar", "png")
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            self.localization.get_text("export_calendar_visualization"),
            default_name,
            "PNG Files (*.png)"
        )

        if not file_path:
            return

        try:
            import matplotlib.pyplot as plt
            import matplotlib.patches as mpatches
            from matplotlib.patches import Rectangle
            from datetime import datetime, timedelta
            import calendar

            # Helper function to get localized text
            def get_text(key: str, fallback: str = "") -> str:
                if self.localization and hasattr(self.localization, 'get_text'):
                    return self.localization.get_text(key)
                return fallback if fallback else key

            # Collect all study dates
            study_dates = set()
            for entry in self.reading_plan:
                start = datetime.strptime(entry.start_date, '%Y-%m-%d')
                end = datetime.strptime(entry.end_date, '%Y-%m-%d')
                current = start
                while current <= end:
                    # Skip weekends if configured
                    if not (self.plan_generator.weekends_off and current.weekday() in self.plan_generator.weekend_days):
                        study_dates.add(current.date())
                    current += timedelta(days=1)

            # Get date range
            all_dates = sorted(study_dates)
            if not all_dates:
                QMessageBox.warning(
                    self,
                    self.localization.get_text("warning"),
                    "No study dates found"
                )
                return

            start_date = all_dates[0]
            end_date = all_dates[-1]

            # Create figure
            fig = plt.figure(figsize=(14, 10))

            # Calculate number of months to display
            months_to_display = []
            current_month = start_date.replace(day=1)
            end_month = end_date.replace(day=1)
            while current_month <= end_month:
                months_to_display.append(current_month)
                # Move to next month
                if current_month.month == 12:
                    current_month = current_month.replace(year=current_month.year + 1, month=1)
                else:
                    current_month = current_month.replace(month=current_month.month + 1)

            # Create subplots for each month
            num_months = len(months_to_display)
            cols = min(3, num_months)
            rows = (num_months + cols - 1) // cols

            for idx, month_date in enumerate(months_to_display):
                ax = plt.subplot(rows + 1, cols, idx + 1)

                # Get calendar for this month
                year = month_date.year
                month = month_date.month
                cal = calendar.monthcalendar(year, month)

                # Month title
                month_name = month_date.strftime('%B %Y')
                ax.text(0.5, 1.05, month_name, ha='center', va='bottom',
                       fontsize=12, fontweight='bold', transform=ax.transAxes)

                # Draw calendar grid
                ax.set_xlim(0, 7)
                ax.set_ylim(0, len(cal))
                ax.set_aspect('equal')
                ax.axis('off')

                # Day headers
                day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                for i, day_name in enumerate(day_names):
                    ax.text(i + 0.5, len(cal) - 0.2, day_name, ha='center', va='center',
                           fontsize=8, fontweight='bold')

                # Draw days
                for week_idx, week in enumerate(cal):
                    for day_idx, day in enumerate(week):
                        if day == 0:
                            continue

                        y_pos = len(cal) - week_idx - 1
                        x_pos = day_idx

                        # Check if this day is a study day
                        current_date = datetime(year, month, day).date()
                        is_study_day = current_date in study_dates

                        # Draw cell background
                        if is_study_day:
                            rect = Rectangle((x_pos, y_pos), 1, 1,
                                           facecolor='#4CAF50', edgecolor='black', linewidth=1)
                        else:
                            rect = Rectangle((x_pos, y_pos), 1, 1,
                                           facecolor='white', edgecolor='gray', linewidth=0.5)
                        ax.add_patch(rect)

                        # Draw day number
                        text_color = 'white' if is_study_day else 'black'
                        ax.text(x_pos + 0.5, y_pos + 0.5, str(day),
                               ha='center', va='center', fontsize=10,
                               color=text_color, fontweight='bold' if is_study_day else 'normal')

            # Add statistics below the calendar
            stats_ax = plt.subplot(rows + 1, 1, rows * cols + 1)
            stats_ax.axis('off')

            # Calculate statistics
            total_days = len(study_dates)
            total_pages = sum(e.page_count for e in self.reading_plan)
            avg_pages = self.plan_generator.get_daily_pages()

            stats_text = f"""
{get_text('report_reading_plan', 'READING PLAN')} - {get_text('statistics_insights', 'Statistics & Insights')}

• {get_text('report_total_target_duration', 'Total Target Duration')}: {self.plan_generator.total_target_days} {get_text('report_days', 'days')}
• {get_text('total_study_days', 'Total Study Days')}: {total_days} {get_text('report_days', 'days')}
• {get_text('total_pages', 'Total Pages')}: {total_pages}
• {get_text('report_average_daily_pages', 'Average Daily Pages')}: {avg_pages:.1f}
• {get_text('report_start_date', 'Start Date')}: {start_date.strftime('%Y-%m-%d')}
• {get_text('end_date', 'End Date')}: {end_date.strftime('%Y-%m-%d')}
• {get_text('total_chapters', 'Total Chapters')}: {len(self.reading_plan)}

Legend: 🟩 = {get_text('study_day', 'Study Day')}  ⬜ = {get_text('rest_day', 'Rest Day')}
            """

            stats_ax.text(0.5, 0.5, stats_text.strip(), ha='center', va='center',
                         fontsize=11, family='monospace',
                         bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))

            plt.tight_layout()
            plt.savefig(file_path, dpi=150, bbox_inches='tight')
            plt.close()

            QMessageBox.information(
                self,
                self.localization.get_text("success"),
                self.localization.get_text("calendar_exported")
            )
        except Exception as e:
            QMessageBox.critical(
                self,
                self.localization.get_text("error"),
                f"{self.localization.get_text('error')}:\n{str(e)}"
            )

    def export_chart(self, chart_type: str):
        """Export visualization chart"""
        if not CHARTS_AVAILABLE:
            QMessageBox.warning(
                self,
                self.localization.get_text("warning"),
                self.localization.get_text("matplotlib_not_available")
            )
            return

        if not self.chapter_weights:
            QMessageBox.warning(self, self.localization.get_text("warning"), self.localization.get_text("no_weights_to_export"))
            return

        # Generate automatic filename
        default_name = self.get_auto_filename("chart", "png")
        file_path, _ = QFileDialog.getSaveFileName(
            self, self.localization.get_text("export_pie_chart"), default_name, "PNG Images (*.png)"
        )

        if not file_path:
            return

        try:
            # Create chart generator
            chart_gen = ChapterWeightChartGenerator(self.chapter_weights)

            # Generate appropriate chart
            if chart_type == "pie":
                success = chart_gen.generate_pie_chart(file_path)
            elif chart_type == "bar":
                success = chart_gen.generate_bar_chart(file_path)
            elif chart_type == "weight":
                success = chart_gen.generate_weight_comparison_chart(file_path)
            else:
                success = False

            if success:
                QMessageBox.information(
                    self,
                    self.localization.get_text("success"),
                    self.localization.get_text("chart_exported")
                )
            else:
                QMessageBox.warning(self, self.localization.get_text("error"), self.localization.get_text("error"))

        except Exception as e:
            QMessageBox.critical(self, self.localization.get_text("error"), f"{self.localization.get_text('error')}:\n{str(e)}")

    def export_all_charts(self):
        """Export all charts to a directory"""
        if not CHARTS_AVAILABLE:
            QMessageBox.warning(
                self,
                self.localization.get_text("warning"),
                self.localization.get_text("matplotlib_not_available")
            )
            return

        if not self.chapter_weights:
            QMessageBox.warning(self, self.localization.get_text("warning"), self.localization.get_text("no_weights_to_export"))
            return

        # Get directory
        output_dir = QFileDialog.getExistingDirectory(
            self, self.localization.get_text("output")
        )

        if not output_dir:
            return

        try:
            # Create chart generator
            chart_gen = ChapterWeightChartGenerator(self.chapter_weights)

            # Generate all charts
            success = chart_gen.generate_combined_report(output_dir, "chapter_analysis")

            if success:
                QMessageBox.information(
                    self,
                    self.localization.get_text("success"),
                    self.localization.get_text("chart_exported")
                )
            else:
                QMessageBox.warning(self, self.localization.get_text("error"), self.localization.get_text("error"))

        except Exception as e:
            QMessageBox.critical(self, self.localization.get_text("error"), f"{self.localization.get_text('error')}:\n{str(e)}")

    def export_all_formats(self):
        """Export all data in all available formats with timestamped naming"""
        if not self.analyzer or not self.chapter_weights:
            QMessageBox.warning(self, self.localization.get_text("warning"), self.localization.get_text("no_weights_to_export"))
            return

        # Get directory
        output_dir = QFileDialog.getExistingDirectory(
            self, self.localization.get_text("select_export_folder")
        )

        if not output_dir:
            return

        try:
            import os
            from datetime import datetime

            # Generate base filename from PDF name and timestamp
            pdf_name = os.path.splitext(os.path.basename(self.pdf_path))[0] if self.pdf_path else "chapter_analysis"
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            base_name = f"{pdf_name}_{timestamp}"

            exported_files = []

            # Export chapter weights in all formats
            weights_csv = os.path.join(output_dir, f"{base_name}_weights.csv")
            if self.analyzer.export_to_csv(weights_csv):
                exported_files.append("weights.csv")

            weights_json = os.path.join(output_dir, f"{base_name}_weights.json")
            if self.analyzer.export_to_json(weights_json):
                exported_files.append("weights.json")

            weights_excel = os.path.join(output_dir, f"{base_name}_weights.xlsx")
            if self.analyzer.export_to_excel(weights_excel):
                exported_files.append("weights.xlsx")

            weights_md = os.path.join(output_dir, f"{base_name}_weights.md")
            if self.analyzer.export_to_markdown(weights_md):
                exported_files.append("weights.md")

            # Export reading plan if available
            if self.plan_generator and self.reading_plan:
                plan_csv = os.path.join(output_dir, f"{base_name}_plan.csv")
                if self.plan_generator.export_to_csv(plan_csv):
                    exported_files.append("plan.csv")

                plan_json = os.path.join(output_dir, f"{base_name}_plan.json")
                if self.plan_generator.export_to_json(plan_json):
                    exported_files.append("plan.json")

                plan_txt = os.path.join(output_dir, f"{base_name}_plan.txt")
                if self.plan_generator.export_to_text(plan_txt, self.localization):
                    exported_files.append("plan.txt")

                plan_excel = os.path.join(output_dir, f"{base_name}_plan.xlsx")
                if self.plan_generator.export_to_excel(plan_excel, self.localization):
                    exported_files.append("plan.xlsx")

                plan_md = os.path.join(output_dir, f"{base_name}_plan.md")
                if self.plan_generator.export_to_markdown(plan_md, self.localization):
                    exported_files.append("plan.md")

            # Export charts if available
            if CHARTS_AVAILABLE:
                try:
                    chart_gen = ChapterWeightChartGenerator(self.chapter_weights)

                    pie_chart = os.path.join(output_dir, f"{base_name}_pie_chart.png")
                    if chart_gen.generate_pie_chart(pie_chart):
                        exported_files.append("pie_chart.png")

                    bar_chart = os.path.join(output_dir, f"{base_name}_bar_chart.png")
                    if chart_gen.generate_bar_chart(bar_chart):
                        exported_files.append("bar_chart.png")

                    weight_chart = os.path.join(output_dir, f"{base_name}_weight_chart.png")
                    if chart_gen.generate_weight_comparison_chart(weight_chart):
                        exported_files.append("weight_chart.png")
                except Exception as e:
                    print(f"Warning: Failed to export charts: {e}")

            # Show success message
            if exported_files:
                files_list = "\n".join([f"  • {f}" for f in exported_files])
                QMessageBox.information(
                    self,
                    self.localization.get_text("success"),
                    f"{self.localization.get_text('all_formats_exported')}\n\n{files_list}"
                )
            else:
                QMessageBox.warning(self, self.localization.get_text("warning"), self.localization.get_text("error"))

        except Exception as e:
            QMessageBox.critical(self, self.localization.get_text("error"), f"{self.localization.get_text('error')}:\n{str(e)}")

    def on_bookmark_cell_clicked(self, row: int, column: int):
        """Handle click on bookmark weight table cell to navigate to page"""
        try:
            if row < len(self.chapter_weights):
                chapter_weight = self.chapter_weights[row]

                # Get the page to navigate to based on the clicked column
                if column == 2:  # Start page column
                    target_page = chapter_weight.start_page
                elif column == 3:  # End page column
                    target_page = chapter_weight.end_page
                else:
                    # For other columns, navigate to start page
                    target_page = chapter_weight.start_page

                # Show navigation dialog
                reply = QMessageBox.question(
                    self,
                    self.localization.get_text("go_to_page"),
                    f"{self.localization.get_text('click_to_go_to_page')} {target_page}?\n\n"
                    f"{self.localization.get_text('chapter_title')}: {chapter_weight.title}",
                    QMessageBox.Yes | QMessageBox.No,
                    QMessageBox.Yes
                )

                if reply == QMessageBox.Yes:
                    # Try to navigate to the page in the main PDF viewer
                    self.navigate_to_page(target_page)

        except Exception as e:
            print(f"Error handling bookmark cell click: {e}")

    def navigate_to_page(self, page_number: int):
        """Navigate to a specific page in the PDF viewer"""
        try:
            # Try to find the main window and PDF viewer
            main_window = self.parent()
            while main_window and not hasattr(main_window, 'pdf_viewer_tab'):
                main_window = main_window.parent()

            if main_window and hasattr(main_window, 'pdf_viewer_tab'):
                pdf_viewer = main_window.pdf_viewer_tab

                # Check if the same PDF is loaded
                if hasattr(pdf_viewer, 'pdf_path') and pdf_viewer.pdf_path == self.pdf_path:
                    # Navigate to the page
                    if hasattr(pdf_viewer, 'go_to_page'):
                        pdf_viewer.go_to_page(page_number)

                        # Switch to PDF viewer tab
                        if hasattr(main_window, 'navigation_manager'):
                            main_window.navigation_manager.navigate_to_section("pdf_viewer")

                        # Show success message
                        main_window.statusBar().showMessage(
                            f"{self.localization.get_text('resumed_from_page')} {page_number}"
                        )
                    else:
                        QMessageBox.information(
                            self,
                            self.localization.get_text("info"),
                            f"{self.localization.get_text('go_to_page')} {page_number}\n"
                            f"{self.localization.get_text('enter_page_number')}"
                        )
                else:
                    # Different PDF or no PDF loaded
                    QMessageBox.information(
                        self,
                        self.localization.get_text("info"),
                        f"{self.localization.get_text('go_to_page')} {page_number}\n\n"
                        f"Please load the same PDF in the PDF Viewer first."
                    )
            else:
                # No PDF viewer found
                QMessageBox.information(
                    self,
                    self.localization.get_text("info"),
                    f"{self.localization.get_text('go_to_page')} {page_number}"
                )

        except Exception as e:
            print(f"Error navigating to page: {e}")
            QMessageBox.information(
                self,
                self.localization.get_text("info"),
                f"{self.localization.get_text('go_to_page')} {page_number}"
            )

