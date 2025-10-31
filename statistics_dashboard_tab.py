import os
import sys
from datetime import datetime, timedelta
from typing import List, Dict, Any
import sqlite3

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGridLayout, QLabel, QPushButton,
    QFrame, QScrollArea, QGroupBox, QProgressBar, QSizePolicy
)
from PySide6.QtCore import Qt, QTimer
from PySide6.QtGui import QFont, QPalette

try:
    import matplotlib.pyplot as plt
    from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
    from matplotlib.figure import Figure
    import matplotlib.dates as mdates
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False
    print("Matplotlib not available. Charts will be disabled.")

try:
    import arabic_reshaper
    from bidi.algorithm import get_display
    ARABIC_SUPPORT = True
except ImportError:
    ARABIC_SUPPORT = False
    print("Warning: arabic-reshaper and python-bidi not available. Arabic text in charts may not display correctly.")


class ModernStatisticsCard(QFrame):
    """Clean, professional statistics card with consistent layout"""

    def __init__(self, title: str, value: str, icon: str = "📊", color: str = "#2196F3",
                 subtitle: str = "", localization=None):
        super().__init__()
        self.title = title
        self.value = value
        self.icon = icon
        self.color = color
        self.subtitle = subtitle
        self.localization = localization
        self.is_dark_theme = False
        self.init_ui()

    def init_ui(self):
        """Initialize clean card UI with fixed dimensions"""
        self.setFrameStyle(QFrame.Box)
        self.setLineWidth(1)

        # Fixed dimensions for all cards - no expansion
        self.setFixedSize(220, 140)

        # Clean white background with subtle border
        self.setStyleSheet("""
            QFrame {
                background-color: white;
                border: 1px solid #E0E0E0;
                border-radius: 8px;
            }
        """)

        layout = QVBoxLayout(self)
        layout.setSpacing(8)
        layout.setContentsMargins(16, 16, 16, 16)

        # Icon and title row
        header_layout = QHBoxLayout()
        header_layout.setSpacing(10)

        # Icon
        self.icon_label = QLabel(self.icon)
        self.icon_label.setFont(QFont("Segoe UI Emoji", 24))
        self.icon_label.setFixedSize(40, 40)
        self.icon_label.setAlignment(Qt.AlignCenter)
        self.icon_label.setStyleSheet(f"""
            QLabel {{
                background-color: {self.color}20;
                border-radius: 20px;
                padding: 4px;
            }}
        """)
        header_layout.addWidget(self.icon_label)

        # Title
        self.title_label = QLabel(self.title)
        self.title_label.setFont(QFont("Segoe UI", 10))
        self.title_label.setWordWrap(True)
        self.title_label.setStyleSheet("color: #666666; background: transparent; border: none;")
        header_layout.addWidget(self.title_label, 1)

        layout.addLayout(header_layout)

        # Value (large and prominent)
        self.value_label = QLabel(self.value)
        self.value_label.setFont(QFont("Segoe UI", 28, QFont.Bold))
        self.value_label.setAlignment(Qt.AlignLeft | Qt.AlignVCenter)
        self.value_label.setStyleSheet(f"color: {self.color}; background: transparent; border: none;")
        layout.addWidget(self.value_label)

        # Subtitle (if provided)
        if self.subtitle:
            self.subtitle_label = QLabel(self.subtitle)
            self.subtitle_label.setFont(QFont("Segoe UI", 9))
            self.subtitle_label.setStyleSheet("color: #999999; background: transparent; border: none;")
            layout.addWidget(self.subtitle_label)



    def update_value(self, new_value: str):
        """Update the card value with empty state handling"""
        self.value = new_value

        # Handle empty states gracefully
        display_value = new_value
        is_empty = str(new_value).strip() in ["None", "0", "0.0", "0%", "0h 0m", "0 days", "", "Not set", "—"]

        if is_empty or new_value == "0":
            display_value = "—"
            self.value_label.setStyleSheet(f"color: #CCCCCC; background: transparent; border: none;")
        else:
            self.value_label.setStyleSheet(f"color: {self.color}; background: transparent; border: none;")

        self.value_label.setText(display_value)

    def apply_theme(self, is_dark_theme: bool):
        """Apply theme styling"""
        self.is_dark_theme = is_dark_theme

        if is_dark_theme:
            self.setStyleSheet("""
                QFrame {
                    background-color: #2b2b2b;
                    border: 1px solid #404040;
                    border-radius: 8px;
                }
            """)
            self.title_label.setStyleSheet("color: #CCCCCC; background: transparent; border: none;")
            if hasattr(self, 'subtitle_label'):
                self.subtitle_label.setStyleSheet("color: #888888; background: transparent; border: none;")
        else:
            self.setStyleSheet("""
                QFrame {
                    background-color: white;
                    border: 1px solid #E0E0E0;
                    border-radius: 8px;
                }
            """)
            self.title_label.setStyleSheet("color: #666666; background: transparent; border: none;")
            if hasattr(self, 'subtitle_label'):
                self.subtitle_label.setStyleSheet("color: #999999; background: transparent; border: none;")


class ChartWidget(QWidget):
    """Widget for displaying charts with theme support"""

    def __init__(self, title: str = "Chart", localization=None):
        super().__init__()
        self.title = title
        self.localization = localization
        self.is_dark_theme = False
        self.init_ui()

    def init_ui(self):
        """Initialize the chart widget"""
        layout = QVBoxLayout(self)

        # Title
        self.title_label = QLabel(self.title)
        self.title_label.setFont(QFont("Arial", 14, QFont.Bold))  # Increased from 12px to 14px
        self.title_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(self.title_label)

        if MATPLOTLIB_AVAILABLE:
            # Create matplotlib figure
            self.figure = Figure(figsize=(8, 4), dpi=100)
            self.canvas = FigureCanvas(self.figure)
            layout.addWidget(self.canvas)
        else:
            # Fallback message
            self.fallback_label = QLabel("📊 Charts require matplotlib\nInstall with: pip install matplotlib")
            self.fallback_label.setAlignment(Qt.AlignCenter)
            layout.addWidget(self.fallback_label)

        # Apply initial theme
        self.apply_theme(False)  # Start with light theme

    def apply_theme(self, is_dark_theme: bool):
        """Apply theme to the chart widget"""
        self.is_dark_theme = is_dark_theme

        if is_dark_theme:
            # Dark theme
            self.title_label.setStyleSheet("color: #ffffff; padding: 10px;")
            if not MATPLOTLIB_AVAILABLE:
                self.fallback_label.setStyleSheet("""
                    QLabel {
                        color: #b0b0b0;
                        background-color: #2d2d2d;
                        border: 2px dashed #555555;
                        border-radius: 10px;
                        padding: 20px;
                        font-size: 12px;
                    }
                """)
            elif MATPLOTLIB_AVAILABLE:
                # Set dark theme for matplotlib
                self.figure.patch.set_facecolor('#2d2d2d')
        else:
            # Light theme
            self.title_label.setStyleSheet("color: #333333; padding: 10px;")
            if not MATPLOTLIB_AVAILABLE:
                self.fallback_label.setStyleSheet("""
                    QLabel {
                        color: #666666;
                        background-color: #f5f5f5;
                        border: 2px dashed #cccccc;
                        border-radius: 10px;
                        padding: 20px;
                        font-size: 12px;
                    }
                """)
            elif MATPLOTLIB_AVAILABLE:
                # Set light theme for matplotlib
                self.figure.patch.set_facecolor('white')

    def update_title(self, new_title: str):
        """Update the chart title (for localization)"""
        self.title = new_title
        self.title_label.setText(new_title)

    @staticmethod
    def fix_arabic_text(text: str) -> str:
        """
        Fix Arabic text for proper display in matplotlib

        Args:
            text: Input text (may contain Arabic)

        Returns:
            Properly shaped text for display
        """
        if not ARABIC_SUPPORT:
            return text

        try:
            # Check if text contains Arabic characters
            if any('\u0600' <= char <= '\u06FF' for char in text):
                reshaped_text = arabic_reshaper.reshape(text)
                bidi_text = get_display(reshaped_text)
                return bidi_text
            return text
        except Exception as e:
            print(f"Warning: Failed to reshape Arabic text: {e}")
            return text
    
    def create_bar_chart(self, data: Dict[str, int], title: str = "Bar Chart"):
        """Create a bar chart with Arabic text support"""
        if not MATPLOTLIB_AVAILABLE:
            return

        self.figure.clear()
        ax = self.figure.add_subplot(111)

        # Fix Arabic text in categories and title
        categories = [self.fix_arabic_text(str(cat)) for cat in data.keys()]
        values = list(data.values())
        fixed_title = self.fix_arabic_text(title)

        # Apply theme colors
        if self.is_dark_theme:
            bar_colors = ['#64B5F6', '#81C784', '#FFB74D', '#E57373', '#BA68C8']
            text_color = '#ffffff'
            self.figure.patch.set_facecolor('#2d2d2d')
            ax.set_facecolor('#2d2d2d')
        else:
            bar_colors = ['#2196F3', '#4CAF50', '#FF9800', '#F44336', '#9C27B0']
            text_color = '#333333'
            self.figure.patch.set_facecolor('white')
            ax.set_facecolor('white')

        bars = ax.bar(categories, values, color=bar_colors[:len(categories)])
        ax.set_title(fixed_title, fontsize=14, fontweight='bold', color=text_color)
        ax.set_ylabel(self.fix_arabic_text('Count'), color=text_color, fontsize=12)

        # Apply theme to ticks
        ax.tick_params(colors=text_color)

        # Add value labels on bars
        for bar in bars:
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height,
                   f'{int(height)}', ha='center', va='bottom', color=text_color, fontweight='bold')

        plt.setp(ax.get_xticklabels(), rotation=45, ha='right', color=text_color)
        try:
            self.figure.tight_layout(pad=2.0)
        except:
            pass  # Ignore tight_layout warnings
        self.canvas.draw()
    
    def create_line_chart(self, dates: List[datetime], values: List[int], title: str = "Line Chart", ylabel: str = "Pages Read", xlabel: str = "Date"):
        """Create a line chart with theme support and Arabic text support"""
        if not MATPLOTLIB_AVAILABLE:
            return

        self.figure.clear()
        ax = self.figure.add_subplot(111)

        # Fix Arabic text
        fixed_title = self.fix_arabic_text(title)
        fixed_ylabel = self.fix_arabic_text(ylabel)
        fixed_xlabel = self.fix_arabic_text(xlabel)

        # Apply theme colors
        if self.is_dark_theme:
            # Dark theme colors
            line_color = '#64B5F6'  # Light blue for dark theme
            text_color = '#ffffff'
            grid_color = '#555555'
            self.figure.patch.set_facecolor('#2d2d2d')
            ax.set_facecolor('#2d2d2d')
        else:
            # Light theme colors
            line_color = '#2196F3'  # Standard blue
            text_color = '#333333'
            grid_color = '#e0e0e0'
            self.figure.patch.set_facecolor('white')
            ax.set_facecolor('white')

        ax.plot(dates, values, marker='o', linewidth=2, markersize=6, color=line_color)
        ax.set_title(fixed_title, fontsize=14, fontweight='bold', color=text_color)
        ax.set_ylabel(fixed_ylabel, color=text_color, fontsize=12)
        ax.set_xlabel(fixed_xlabel, color=text_color, fontsize=12)

        # Apply theme to ticks and grid
        ax.tick_params(colors=text_color)
        ax.grid(True, color=grid_color, alpha=0.3)

        # Format x-axis
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d'))
        ax.xaxis.set_major_locator(mdates.DayLocator(interval=1))

        plt.setp(ax.get_xticklabels(), rotation=45, ha='right', color=text_color)
        try:
            self.figure.tight_layout(pad=2.0)
        except:
            pass  # Ignore tight_layout warnings
        self.canvas.draw()

    def create_pie_chart(self, labels: List[str], values: List[int], title: str = "Pie Chart"):
        """Create a pie chart with theme support and Arabic text support"""
        if not MATPLOTLIB_AVAILABLE or not labels or not values:
            return

        self.figure.clear()
        ax = self.figure.add_subplot(111)

        # Fix Arabic text in labels and title
        fixed_labels = [self.fix_arabic_text(str(label)) for label in labels]
        fixed_title = self.fix_arabic_text(title)

        # Apply theme colors
        if self.is_dark_theme:
            # Dark theme colors - brighter colors for better visibility
            colors = ['#FF8A80', '#80CBC4', '#81C784', '#FFB74D', '#F8BBD9', '#CE93D8', '#A5D6A7']
            text_color = '#ffffff'
            self.figure.patch.set_facecolor('#2d2d2d')
            ax.set_facecolor('#2d2d2d')
        else:
            # Light theme colors
            colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8']
            text_color = '#333333'
            self.figure.patch.set_facecolor('white')
            ax.set_facecolor('white')

        wedges, texts, autotexts = ax.pie(values, labels=fixed_labels, autopct='%1.1f%%',
                                         colors=colors[:len(labels)], startangle=90)

        ax.set_title(fixed_title, fontsize=14, fontweight='bold', color=text_color)

        # Apply theme to text with increased font sizes
        for text in texts:
            text.set_color(text_color)
            text.set_fontsize(11)  # Increased font size for labels

        # Make percentage text more readable with larger font
        for autotext in autotexts:
            autotext.set_color('white' if self.is_dark_theme else 'black')
            autotext.set_fontweight('bold')
            autotext.set_fontsize(10)  # Increased font size for percentages

        try:
            self.figure.tight_layout(pad=2.0)
        except:
            pass  # Ignore tight_layout warnings
        self.canvas.draw()


class StatisticsDashboardTab(QWidget):
    """Ultra-modern statistics dashboard with comprehensive analytics and professional design"""

    def __init__(self, books_manager=None, localization=None):
        super().__init__()
        self.books_manager = books_manager
        self.localization = localization or None
        self.statistics_cards = []
        self.is_dark_theme = False
        self.init_ui()

        # Auto-refresh timer
        self.refresh_timer = QTimer()
        self.refresh_timer.timeout.connect(self.refresh_statistics)
        self.refresh_timer.start(30000)  # Refresh every 30 seconds for more responsive updates
    
    def init_ui(self):
        """Initialize the ultra-modern dashboard UI with professional layout"""
        # Main scroll area for better content management
        scroll_area = QScrollArea(self)
        scroll_area.setWidgetResizable(True)
        scroll_area.setFrameStyle(QFrame.NoFrame)

        main_widget = QWidget()
        scroll_area.setWidget(main_widget)

        layout = QVBoxLayout(main_widget)
        layout.setSpacing(24)
        layout.setContentsMargins(24, 24, 24, 24)

        # Modern header with gradient background
        header_container = QFrame()
        header_container.setFixedHeight(80)
        header_layout = QHBoxLayout(header_container)
        header_layout.setContentsMargins(32, 16, 32, 16)

        # Dashboard title with modern typography
        title_text = self.localization.get_text("statistics_dashboard") if self.localization else "📊 Analytics Dashboard"
        self.title_label = QLabel(title_text)
        self.title_label.setFont(QFont("Segoe UI", 28, QFont.Bold))
        header_layout.addWidget(self.title_label)

        header_layout.addStretch()

        # Modern action buttons
        buttons_layout = QHBoxLayout()
        buttons_layout.setSpacing(12)

        # Export button
        export_text = self.localization.get_text("export") if self.localization else "📤 Export"
        self.export_btn = QPushButton(export_text)
        self.export_btn.setFixedHeight(40)
        self.export_btn.clicked.connect(self.export_statistics)
        buttons_layout.addWidget(self.export_btn)

        # Refresh button
        refresh_text = self.localization.get_text("refresh") if self.localization else "🔄 Refresh"
        self.refresh_btn = QPushButton(refresh_text)
        self.refresh_btn.setFixedHeight(40)
        self.refresh_btn.clicked.connect(self.refresh_statistics)
        buttons_layout.addWidget(self.refresh_btn)

        header_layout.addLayout(buttons_layout)
        layout.addWidget(header_container)

        # Quick stats summary bar
        self.create_summary_bar(layout)

        # Main statistics cards grid
        self.create_statistics_cards(layout)

        # Advanced analytics section
        self.create_advanced_analytics(layout)

        # Charts section
        self.create_charts_section(layout)

        # Set up the main layout
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.addWidget(scroll_area)

        # Apply initial theme
        self.apply_theme(False)

        # Load initial data
        self.refresh_statistics()
    
    def create_summary_bar(self, parent_layout):
        """Create a quick summary bar with key metrics"""
        summary_container = QFrame()
        summary_container.setFixedHeight(60)
        summary_layout = QHBoxLayout(summary_container)
        summary_layout.setContentsMargins(24, 12, 24, 12)
        summary_layout.setSpacing(32)

        # Quick metrics
        self.total_books_summary = QLabel("📚 0 Books")
        self.total_books_summary.setFont(QFont("Segoe UI", 14, QFont.Bold))
        summary_layout.addWidget(self.total_books_summary)

        self.pages_today_summary = QLabel("📄 0 Pages Today")
        self.pages_today_summary.setFont(QFont("Segoe UI", 14, QFont.Bold))
        summary_layout.addWidget(self.pages_today_summary)

        self.streak_summary = QLabel("🔥 0 Day Streak")
        self.streak_summary.setFont(QFont("Segoe UI", 14, QFont.Bold))
        summary_layout.addWidget(self.streak_summary)

        summary_layout.addStretch()

        # Last updated indicator
        self.last_updated = QLabel("Last updated: Never")
        self.last_updated.setFont(QFont("Segoe UI", 10))
        summary_layout.addWidget(self.last_updated)

        parent_layout.addWidget(summary_container)

    def create_statistics_cards(self, parent_layout):
        """Create clean statistics cards grid with fixed layout"""
        # Main metrics section
        group_title = self.localization.get_text("key_metrics") if self.localization else "📊 Key Metrics"
        self.cards_group = QGroupBox(group_title)
        self.cards_group.setFont(QFont("Segoe UI", 14, QFont.Bold))
        self.cards_group.setStyleSheet("""
            QGroupBox {
                background-color: #F5F5F5;
                border: none;
                border-radius: 4px;
                padding: 20px;
                margin-top: 10px;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px;
            }
        """)

        cards_layout = QGridLayout(self.cards_group)
        cards_layout.setSpacing(20)
        cards_layout.setContentsMargins(20, 30, 20, 20)
        cards_layout.setAlignment(Qt.AlignTop | Qt.AlignLeft)

        # Create cards with localized titles
        total_books_title = self.localization.get_text("total_books") if self.localization else "Total Books"
        read_today_title = self.localization.get_text("read_today") if self.localization else "Read Today"
        pages_today_title = self.localization.get_text("pages_today") if self.localization else "Pages Today"
        reading_streak_title = self.localization.get_text("reading_streak") if self.localization else "Streak"
        avg_pages_title = self.localization.get_text("avg_pages_day") if self.localization else "Avg Pages/Day"
        total_time_title = self.localization.get_text("total_time") if self.localization else "Total Time"
        completion_rate_title = self.localization.get_text("completion_rate") if self.localization else "Completion"
        favorite_category_title = self.localization.get_text("favorite_category") if self.localization else "Top Category"

        # Create cards with simplified parameters
        self.total_books_card = ModernStatisticsCard(total_books_title, "—", "📚", "#2196F3", "In library", self.localization)
        self.books_read_today_card = ModernStatisticsCard(read_today_title, "—", "📖", "#4CAF50", "Active", self.localization)
        self.pages_read_today_card = ModernStatisticsCard(pages_today_title, "—", "📄", "#FF9800", "Completed", self.localization)
        self.reading_streak_card = ModernStatisticsCard(reading_streak_title, "—", "🔥", "#F44336", "Days", self.localization)
        self.avg_pages_day_card = ModernStatisticsCard(avg_pages_title, "—", "📈", "#9C27B0", "Last 7 days", self.localization)
        self.total_time_card = ModernStatisticsCard(total_time_title, "—", "⏱️", "#607D8B", "All time", self.localization)
        self.completion_rate_card = ModernStatisticsCard(completion_rate_title, "—", "✅", "#795548", "Finished", self.localization)
        self.favorite_category_card = ModernStatisticsCard(favorite_category_title, "—", "🏷️", "#E91E63", "Most read", self.localization)

        # Add cards to grid (4 columns, 2 rows)
        cards_layout.addWidget(self.total_books_card, 0, 0, Qt.AlignTop | Qt.AlignLeft)
        cards_layout.addWidget(self.books_read_today_card, 0, 1, Qt.AlignTop | Qt.AlignLeft)
        cards_layout.addWidget(self.pages_read_today_card, 0, 2, Qt.AlignTop | Qt.AlignLeft)
        cards_layout.addWidget(self.reading_streak_card, 0, 3, Qt.AlignTop | Qt.AlignLeft)
        cards_layout.addWidget(self.avg_pages_day_card, 1, 0, Qt.AlignTop | Qt.AlignLeft)
        cards_layout.addWidget(self.total_time_card, 1, 1, Qt.AlignTop | Qt.AlignLeft)
        cards_layout.addWidget(self.completion_rate_card, 1, 2, Qt.AlignTop | Qt.AlignLeft)
        cards_layout.addWidget(self.favorite_category_card, 1, 3, Qt.AlignTop | Qt.AlignLeft)

        self.statistics_cards = [
            self.total_books_card, self.books_read_today_card, self.pages_read_today_card,
            self.reading_streak_card, self.avg_pages_day_card, self.total_time_card,
            self.completion_rate_card, self.favorite_category_card
        ]

        parent_layout.addWidget(self.cards_group)

        # Add visual separator
        separator = QFrame()
        separator.setFrameShape(QFrame.HLine)
        separator.setFrameShadow(QFrame.Sunken)
        separator.setStyleSheet("QFrame { background-color: #E0E0E0; max-height: 1px; margin: 20px 0; }")
        parent_layout.addWidget(separator)

    def create_advanced_analytics(self, parent_layout):
        """Create advanced analytics section"""
        analytics_title = self.localization.get_text("advanced_analytics") if self.localization else "🔬 Advanced Analytics"
        analytics_group = QGroupBox(analytics_title)
        analytics_group.setFont(QFont("Segoe UI", 14, QFont.Bold))
        analytics_group.setStyleSheet("""
            QGroupBox {
                background-color: #F5F5F5;
                border: none;
                border-radius: 4px;
                padding: 20px;
                margin-top: 10px;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px;
            }
        """)

        analytics_layout = QGridLayout(analytics_group)
        analytics_layout.setSpacing(20)
        analytics_layout.setContentsMargins(20, 30, 20, 20)
        analytics_layout.setAlignment(Qt.AlignTop | Qt.AlignLeft)

        # Create analytics cards
        velocity_title = self.localization.get_text("reading_velocity") if self.localization else "Velocity"
        self.velocity_card = ModernStatisticsCard(velocity_title, "—", "⚡", "#FF5722", "pages/hour", self.localization)
        analytics_layout.addWidget(self.velocity_card, 0, 0, Qt.AlignTop | Qt.AlignLeft)

        goal_title = self.localization.get_text("monthly_goal") if self.localization else "Monthly Goal"
        self.goal_card = ModernStatisticsCard(goal_title, "—", "🎯", "#3F51B5", "This month", self.localization)
        analytics_layout.addWidget(self.goal_card, 0, 1, Qt.AlignTop | Qt.AlignLeft)

        productive_time_title = self.localization.get_text("productive_time") if self.localization else "Peak Time"
        self.productive_time_card = ModernStatisticsCard(productive_time_title, "—", "🕐", "#009688", "Best hours", self.localization)
        analytics_layout.addWidget(self.productive_time_card, 0, 2, Qt.AlignTop | Qt.AlignLeft)

        consistency_title = self.localization.get_text("consistency_score") if self.localization else "Consistency"
        self.consistency_card = ModernStatisticsCard(consistency_title, "—", "📊", "#8BC34A", "Last 30 days", self.localization)
        analytics_layout.addWidget(self.consistency_card, 0, 3, Qt.AlignTop | Qt.AlignLeft)

        parent_layout.addWidget(analytics_group)

        # Add visual separator
        separator2 = QFrame()
        separator2.setFrameShape(QFrame.HLine)
        separator2.setFrameShadow(QFrame.Sunken)
        separator2.setStyleSheet("QFrame { background-color: #E0E0E0; max-height: 1px; margin: 20px 0; }")
        parent_layout.addWidget(separator2)

    def create_charts_section(self, parent_layout):
        """Create charts section with clean placeholder"""
        group_title = self.localization.get_text("visual_analytics") if self.localization else "📈 Visual Analytics"
        self.charts_group = QGroupBox(group_title)
        self.charts_group.setFont(QFont("Segoe UI", 14, QFont.Bold))
        self.charts_group.setStyleSheet("""
            QGroupBox {
                background-color: #F5F5F5;
                border: none;
                border-radius: 4px;
                padding: 20px;
                margin-top: 10px;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px;
            }
        """)

        charts_layout = QHBoxLayout(self.charts_group)
        charts_layout.setSpacing(20)
        charts_layout.setContentsMargins(20, 30, 20, 20)

        if MATPLOTLIB_AVAILABLE:
            category_chart_title = self.localization.get_text("books_by_category") if self.localization else "Books by Category"
            self.category_chart = ChartWidget(category_chart_title, self.localization)
            self.category_chart.setFixedHeight(280)
            charts_layout.addWidget(self.category_chart)

            daily_chart_title = self.localization.get_text("daily_reading_progress") if self.localization else "Daily Progress"
            self.daily_reading_chart = ChartWidget(daily_chart_title, self.localization)
            self.daily_reading_chart.setFixedHeight(280)
            charts_layout.addWidget(self.daily_reading_chart)
        else:
            # Clean placeholder
            placeholder = QFrame()
            placeholder.setFixedHeight(280)
            placeholder.setStyleSheet("""
                QFrame {
                    background-color: white;
                    border: 1px solid #E0E0E0;
                    border-radius: 8px;
                }
            """)
            placeholder_layout = QVBoxLayout(placeholder)
            placeholder_layout.setAlignment(Qt.AlignCenter)

            icon_label = QLabel("📊")
            icon_label.setFont(QFont("Segoe UI Emoji", 56))
            icon_label.setAlignment(Qt.AlignCenter)
            icon_label.setStyleSheet("background: transparent; border: none;")
            placeholder_layout.addWidget(icon_label)

            message = QLabel("Charts require matplotlib library")
            message.setFont(QFont("Segoe UI", 12))
            message.setAlignment(Qt.AlignCenter)
            message.setStyleSheet("color: #666666; background: transparent; border: none; margin-top: 10px;")
            placeholder_layout.addWidget(message)

            charts_layout.addWidget(placeholder)

        parent_layout.addWidget(self.charts_group)

    def export_statistics(self):
        """Export statistics to various formats"""
        try:
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

            # Create export data
            export_data = {
                "export_date": datetime.now().isoformat(),
                "total_books": self.total_books_card.value,
                "books_read_today": self.books_read_today_card.value,
                "pages_read_today": self.pages_read_today_card.value,
                "reading_streak": self.reading_streak_card.value,
                "avg_pages_per_day": self.avg_pages_day_card.value,
                "total_reading_time": self.total_time_card.value,
                "completion_rate": self.completion_rate_card.value,
                "favorite_category": self.favorite_category_card.value
            }

            # Save as JSON
            import json
            filename = f"reading_statistics_{timestamp}.json"
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, indent=2, ensure_ascii=False)

            # Show success message
            from PySide6.QtWidgets import QMessageBox
            QMessageBox.information(self, "Export Successful",
                                  f"Statistics exported to {filename}")
        except Exception as e:
            from PySide6.QtWidgets import QMessageBox
            QMessageBox.warning(self, "Export Failed", f"Failed to export statistics: {str(e)}")

    def apply_theme(self, is_dark_theme: bool):
        """Apply ultra-modern theme to the entire dashboard"""
        self.is_dark_theme = is_dark_theme

        # Apply theme to main containers
        if is_dark_theme:
            # Dark theme with modern styling
            self.setStyleSheet("""
                QWidget {
                    background-color: #1a1a1a;
                    color: #e0e0e0;
                }
                QScrollArea {
                    border: none;
                    background-color: #1a1a1a;
                }
                QGroupBox {
                    font-weight: bold;
                    border: 2px solid #404040;
                    border-radius: 12px;
                    margin-top: 12px;
                    padding-top: 12px;
                    background-color: #242424;
                }
                QGroupBox::title {
                    subcontrol-origin: margin;
                    left: 16px;
                    padding: 0 8px 0 8px;
                    color: #ffffff;
                    background-color: #242424;
                }
            """)

            # Header styling
            self.title_label.setStyleSheet("""
                color: #ffffff;
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                    stop:0 #2196F3, stop:1 #21CBF3);
                -webkit-background-clip: text;
                font-weight: 700;
            """)

            # Button styling
            button_style = """
                QPushButton {
                    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                        stop:0 #404040, stop:1 #303030);
                    color: #ffffff;
                    border: 1px solid #505050;
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 12px;
                }
                QPushButton:hover {
                    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                        stop:0 #505050, stop:1 #404040);
                    border: 1px solid #606060;
                }
                QPushButton:pressed {
                    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                        stop:0 #303030, stop:1 #404040);
                }
            """
            self.refresh_btn.setStyleSheet(button_style)
            self.export_btn.setStyleSheet(button_style)

            # Summary bar styling
            if hasattr(self, 'total_books_summary'):
                summary_style = "color: #2196F3; background: transparent;"
                self.total_books_summary.setStyleSheet(summary_style)
                self.pages_today_summary.setStyleSheet("color: #FF9800; background: transparent;")
                self.streak_summary.setStyleSheet("color: #F44336; background: transparent;")
                self.last_updated.setStyleSheet("color: #808080; background: transparent;")
        else:
            # Light theme with modern styling
            self.setStyleSheet("""
                QWidget {
                    background-color: #f8f9fa;
                    color: #2c3e50;
                }
                QScrollArea {
                    border: none;
                    background-color: #f8f9fa;
                }
                QGroupBox {
                    font-weight: bold;
                    border: 2px solid #e1e5e9;
                    border-radius: 12px;
                    margin-top: 12px;
                    padding-top: 12px;
                    background-color: #ffffff;
                }
                QGroupBox::title {
                    subcontrol-origin: margin;
                    left: 16px;
                    padding: 0 8px 0 8px;
                    color: #2c3e50;
                    background-color: #ffffff;
                }
            """)

            # Header styling
            self.title_label.setStyleSheet("""
                color: #2c3e50;
                font-weight: 700;
            """)

            # Button styling
            button_style = """
                QPushButton {
                    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                        stop:0 #ffffff, stop:1 #f8f9fa);
                    color: #2c3e50;
                    border: 1px solid #d1d5d9;
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 12px;
                }
                QPushButton:hover {
                    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                        stop:0 #f8f9fa, stop:1 #e9ecef);
                    border: 1px solid #c1c5c9;
                }
                QPushButton:pressed {
                    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                        stop:0 #e9ecef, stop:1 #f8f9fa);
                }
            """
            self.refresh_btn.setStyleSheet(button_style)
            self.export_btn.setStyleSheet(button_style)

            # Summary bar styling
            if hasattr(self, 'total_books_summary'):
                summary_style = "color: #2196F3; background: transparent; font-weight: 600;"
                self.total_books_summary.setStyleSheet(summary_style)
                self.pages_today_summary.setStyleSheet("color: #FF9800; background: transparent; font-weight: 600;")
                self.streak_summary.setStyleSheet("color: #F44336; background: transparent; font-weight: 600;")
                self.last_updated.setStyleSheet("color: #6c757d; background: transparent;")

        # Apply theme to all statistics cards
        for card in self.statistics_cards:
            card.apply_theme(is_dark_theme)

        # Apply theme to charts
        if hasattr(self, 'category_chart'):
            self.category_chart.apply_theme(is_dark_theme)
        if hasattr(self, 'daily_reading_chart'):
            self.daily_reading_chart.apply_theme(is_dark_theme)
            # Apply dark theme to group boxes
            group_style = """
                QGroupBox {
                    color: #ffffff;
                    background-color: #2d2d2d;
                    border: 2px solid #555555;
                    border-radius: 8px;
                    margin-top: 10px;
                    padding-top: 10px;
                    font-weight: bold;
                }
                QGroupBox::title {
                    subcontrol-origin: margin;
                    left: 10px;
                    padding: 0 5px 0 5px;
                    color: #1976D2;
                }
            """
        else:
            # Light theme
            self.title_label.setStyleSheet("color: #1976D2; padding: 10px;")
            self.refresh_btn.setStyleSheet("""
                QPushButton {
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 5px;
                    font-weight: bold;
                }
                QPushButton:hover {
                    background-color: #45a049;
                }
            """)
            # Apply light theme to group boxes
            group_style = """
                QGroupBox {
                    color: #333333;
                    background-color: #ffffff;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    margin-top: 10px;
                    padding-top: 10px;
                    font-weight: bold;
                }
                QGroupBox::title {
                    subcontrol-origin: margin;
                    left: 10px;
                    padding: 0 5px 0 5px;
                    color: #1976D2;
                }
            """

        # Apply theme to group boxes
        if hasattr(self, 'cards_group'):
            self.cards_group.setStyleSheet(group_style)
        if hasattr(self, 'charts_group'):
            self.charts_group.setStyleSheet(group_style)

        # Apply theme to all statistics cards
        for card in self.statistics_cards:
            card.apply_theme(is_dark_theme)

        # Apply theme to charts
        if hasattr(self, 'category_chart'):
            self.category_chart.apply_theme(is_dark_theme)
        if hasattr(self, 'daily_reading_chart'):
            self.daily_reading_chart.apply_theme(is_dark_theme)

    def update_localization(self, localization):
        """Update localization for all components"""
        self.localization = localization

        # Update header text
        title_text = localization.get_text("statistics_dashboard") if localization else "📈 Statistics Dashboard"
        self.title_label.setText(title_text)

        refresh_text = localization.get_text("refresh") if localization else "🔄 Refresh"
        self.refresh_btn.setText(refresh_text)

        # Update group titles
        if hasattr(self, 'cards_group'):
            group_title = localization.get_text("overview_statistics") if localization else "📊 Overview Statistics"
            self.cards_group.setTitle(group_title)

        if hasattr(self, 'charts_group'):
            group_title = localization.get_text("visual_analytics") if localization else "📈 Visual Analytics"
            self.charts_group.setTitle(group_title)

        # Update card titles
        if hasattr(self, 'total_books_card'):
            self.total_books_card.update_title(localization.get_text("total_books") if localization else "Total Books")
        if hasattr(self, 'books_read_today_card'):
            self.books_read_today_card.update_title(localization.get_text("read_today") if localization else "Read Today")
        if hasattr(self, 'pages_read_today_card'):
            self.pages_read_today_card.update_title(localization.get_text("pages_today") if localization else "Pages Today")
        if hasattr(self, 'reading_streak_card'):
            self.reading_streak_card.update_title(localization.get_text("reading_streak") if localization else "Reading Streak")
        if hasattr(self, 'avg_pages_day_card'):
            self.avg_pages_day_card.update_title(localization.get_text("avg_pages_day") if localization else "Avg Pages/Day")
        if hasattr(self, 'total_categories_card'):
            self.total_categories_card.update_title(localization.get_text("categories") if localization else "Categories")

        # Update chart titles
        if hasattr(self, 'category_chart'):
            category_chart_title = localization.get_text("books_by_category") if localization else "Books by Category"
            self.category_chart.update_title(category_chart_title)

        if hasattr(self, 'daily_reading_chart'):
            daily_chart_title = localization.get_text("daily_reading_progress") if localization else "Daily Reading Progress (Last 7 Days)"
            self.daily_reading_chart.update_title(daily_chart_title)

    def refresh_statistics(self):
        """Refresh all statistics with enhanced metrics"""
        if not self.books_manager:
            return

        try:
            from datetime import datetime, timedelta

            # Get basic statistics
            books = self.books_manager.get_books() if hasattr(self.books_manager, 'get_books') else []
            total_books = len(books)

            # Today's statistics
            today = datetime.now().date()
            yesterday = today - timedelta(days=1)
            books_read_today = 0
            pages_read_today = 0
            pages_read_yesterday = 0

            # Calculate reading statistics
            total_reading_time = 0
            completed_books = 0
            category_counts = {}

            # Enhanced calculations
            for book in books:
                # Daily stats
                if hasattr(self.books_manager, 'get_daily_reading_stats'):
                    daily_stats = self.books_manager.get_daily_reading_stats(book.file_path, 2)
                    for stat in daily_stats:
                        if stat['date'] == today.isoformat():
                            books_read_today += 1
                            pages_read_today += stat['pages_read']
                        elif stat['date'] == yesterday.isoformat():
                            pages_read_yesterday += stat['pages_read']

                # Reading time and completion
                if hasattr(book, 'reading_time'):
                    total_reading_time += book.reading_time or 0
                if hasattr(book, 'is_completed') and book.is_completed:
                    completed_books += 1

                # Category tracking
                category = getattr(book, 'category', 'Uncategorized')
                category_counts[category] = category_counts.get(category, 0) + 1

            # Calculate trends
            pages_trend = pages_read_today - pages_read_yesterday
            pages_trend_percent = (pages_trend / max(pages_read_yesterday, 1)) * 100 if pages_read_yesterday > 0 else 0

            # Calculate advanced metrics
            reading_streak = self.calculate_reading_streak()
            avg_pages_per_day = self.calculate_average_pages_per_day()
            completion_rate = (completed_books / max(total_books, 1)) * 100
            favorite_category = max(category_counts, key=category_counts.get) if category_counts else "None"

            # Reading velocity (pages per hour)
            reading_velocity = (pages_read_today / max(total_reading_time / 3600, 0.1)) if total_reading_time > 0 else 0

            # Format reading time
            hours = int(total_reading_time // 3600)
            minutes = int((total_reading_time % 3600) // 60)
            time_str = f"{hours}h {minutes}m"

            # Update main cards with trends
            self.total_books_card.update_value(str(total_books))
            self.books_read_today_card.update_value(str(books_read_today))
            self.pages_read_today_card.update_value(str(pages_read_today))
            self.reading_streak_card.update_value(f"{reading_streak} days")
            self.avg_pages_day_card.update_value(f"{avg_pages_per_day:.1f}")
            self.total_time_card.update_value(time_str)
            self.completion_rate_card.update_value(f"{completion_rate:.1f}%")
            self.favorite_category_card.update_value(favorite_category)

            # Update advanced analytics cards
            if hasattr(self, 'velocity_card'):
                self.velocity_card.update_value(f"{reading_velocity:.1f} pages/hour")
            if hasattr(self, 'goal_card'):
                # Monthly goal (placeholder - would need goal setting feature)
                self.goal_card.update_value("0/10")
            if hasattr(self, 'productive_time_card'):
                self.productive_time_card.update_value("Evening")
            if hasattr(self, 'consistency_card'):
                consistency_score = min(reading_streak * 10, 100)  # Simple calculation
                self.consistency_card.update_value(f"{consistency_score:.0f}%")

            # Update summary bar
            if hasattr(self, 'total_books_summary'):
                self.total_books_summary.setText(f"📚 {total_books} Books")
                self.pages_today_summary.setText(f"📄 {pages_read_today} Pages Today")
                self.streak_summary.setText(f"🔥 {reading_streak} Day Streak")
                self.last_updated.setText(f"Last updated: {datetime.now().strftime('%H:%M:%S')}")

            # Update charts
            self.update_category_chart(category_counts)
            if hasattr(self, 'daily_reading_chart'):
                self.update_daily_reading_chart()

        except Exception as e:
            print(f"Error refreshing statistics: {e}")
            import traceback
            traceback.print_exc()
    
    def calculate_reading_streak(self) -> int:
        """Calculate current reading streak in days"""
        if not self.books_manager:
            return 0
        
        try:
            # Get all books and their reading sessions
            books = self.books_manager.get_books()
            reading_dates = set()
            
            for book in books:
                daily_stats = self.books_manager.get_daily_reading_stats(book.file_path, 30)
                for stat in daily_stats:
                    if stat['pages_read'] > 0:
                        reading_dates.add(datetime.fromisoformat(stat['date']).date())
            
            if not reading_dates:
                return 0
            
            # Calculate streak from today backwards
            today = datetime.now().date()
            streak = 0
            current_date = today
            
            while current_date in reading_dates:
                streak += 1
                current_date -= timedelta(days=1)
            
            return streak
            
        except Exception as e:
            print(f"Error calculating reading streak: {e}")
            return 0
    
    def calculate_average_pages_per_day(self) -> float:
        """Calculate average pages read per day over last 30 days"""
        if not self.books_manager:
            return 0.0
        
        try:
            books = self.books_manager.get_books()
            total_pages = 0
            reading_days = set()
            
            for book in books:
                daily_stats = self.books_manager.get_daily_reading_stats(book.file_path, 30)
                for stat in daily_stats:
                    if stat['pages_read'] > 0:
                        total_pages += stat['pages_read']
                        reading_days.add(stat['date'])
            
            if len(reading_days) == 0:
                return 0.0
            
            return total_pages / len(reading_days)
            
        except Exception as e:
            print(f"Error calculating average pages per day: {e}")
            return 0.0
    
    def update_category_chart(self, category_counts: Dict[str, int]):
        """Update category distribution chart with provided data"""
        if not category_counts:
            return

        try:
            # Filter out empty categories and limit to top 10
            filtered_counts = {k: v for k, v in category_counts.items() if v > 0}
            if len(filtered_counts) > 10:
                # Keep top 10 categories
                sorted_categories = sorted(filtered_counts.items(), key=lambda x: x[1], reverse=True)
                filtered_counts = dict(sorted_categories[:10])

            if hasattr(self, 'category_chart'):
                self.category_chart.create_bar_chart(filtered_counts, "Books by Category")

        except Exception as e:
            print(f"Error updating category chart: {e}")
    
    def update_daily_reading_chart(self):
        """Update daily reading progress chart"""
        try:
            if not hasattr(self, 'daily_reading_chart'):
                return

            # Get last 7 days of reading data
            dates = []
            pages_per_day = []

            for i in range(6, -1, -1):  # Last 7 days
                date = datetime.now().date() - timedelta(days=i)
                dates.append(datetime.combine(date, datetime.min.time()))

                daily_pages = 0
                books = self.books_manager.get_books()
                for book in books:
                    daily_stats = self.books_manager.get_daily_reading_stats(book.file_path, 7)
                    for stat in daily_stats:
                        if stat['date'] == date.isoformat():
                            daily_pages += stat['pages_read']
                            break

                pages_per_day.append(daily_pages)

            self.daily_reading_chart.create_line_chart(dates, pages_per_day, "Daily Reading Progress")

        except Exception as e:
            print(f"Error updating daily reading chart: {e}")
