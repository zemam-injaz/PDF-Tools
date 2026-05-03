"""
Enhanced Reading Statistics Dashboard with Charts and Comprehensive Analytics
"""

import sys
import os
import json
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
from matplotlib.figure import Figure
import numpy as np

try:
    import arabic_reshaper
    from bidi.algorithm import get_display
    ARABIC_SUPPORT = True
except ImportError:
    ARABIC_SUPPORT = False
    print("Warning: arabic-reshaper and python-bidi not available. Arabic text in charts may not display correctly.")

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton, QScrollArea,
    QFrame, QGridLayout, QTabWidget, QTextEdit, QMessageBox, QFileDialog,
    QProgressBar, QComboBox, QSpinBox, QDateEdit, QGroupBox, QSplitter,
    QTableWidget, QTableWidgetItem, QHeaderView, QDialog, QDialogButtonBox
)
from PySide6.QtCore import Qt, QDate, QTimer, Signal
from PySide6.QtGui import QFont, QPixmap, QPainter, QColor, QPen

# Import app paths utility
try:
    from app_paths import get_settings_path
except ImportError:
    # Fallback if app_paths is not available
    def get_settings_path(settings_name):
        return settings_name


@dataclass
class ReadingSession:
    """Represents a reading session"""
    date: datetime
    book_path: str
    book_title: str
    pages_read: int
    duration_minutes: int
    category: str


@dataclass
class WeeklyReport:
    """Weekly reading report data"""
    week_start: datetime
    books_completed: int
    total_pages: int
    reading_time_minutes: int
    categories_read: List[str]
    goals_achieved: Dict[str, bool]


class ReadingStatisticsManager:
    """Manages reading statistics and analytics"""

    def __init__(self, books_manager=None):
        self.books_manager = books_manager
        self.stats_file = get_settings_path("reading_statistics.json")
        print(f"📈 Reading statistics file: {self.stats_file}")
        self.sessions: List[ReadingSession] = []
        self.load_statistics()
    
    def load_statistics(self):
        """Load reading statistics from file and sync with existing books"""
        try:
            if os.path.exists(self.stats_file):
                with open(self.stats_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.sessions = [
                        ReadingSession(
                            date=datetime.fromisoformat(session['date']),
                            book_path=session['book_path'],
                            book_title=session['book_title'],
                            pages_read=session['pages_read'],
                            duration_minutes=session['duration_minutes'],
                            category=session.get('category', 'Uncategorized')
                        )
                        for session in data.get('sessions', [])
                    ]
        except Exception as e:
            print(f"Error loading statistics: {e}")
            self.sessions = []

        # Sync with existing books data if books_manager is available
        self.sync_with_existing_books()
    
    def save_statistics(self):
        """Save reading statistics to file"""
        try:
            data = {
                'sessions': [
                    {
                        'date': session.date.isoformat(),
                        'book_path': session.book_path,
                        'book_title': session.book_title,
                        'pages_read': session.pages_read,
                        'duration_minutes': session.duration_minutes,
                        'category': session.category
                    }
                    for session in self.sessions
                ]
            }
            with open(self.stats_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error saving statistics: {e}")

    def sync_with_existing_books(self):
        """Sync statistics with existing books from RecentBooksManager"""
        if not self.books_manager:
            return

        try:
            # Get all books from the books manager (using correct method name)
            books = self.books_manager.get_books()
            print(f"📊 Syncing statistics with {len(books)} existing books")

            # Track which books we've already created sessions for
            existing_book_paths = {session.book_path for session in self.sessions}

            # Create reading sessions for books that have progress but no sessions
            for book in books:
                if book.file_path not in existing_book_paths and book.pages_read > 0:
                    # Get existing analytics data from the books manager
                    try:
                        analytics = self.books_manager.get_reading_analytics(book.file_path)
                        daily_stats = self.books_manager.get_daily_reading_stats(book.file_path, 30)

                        # If we have detailed analytics, use that data
                        if analytics.get('total_sessions', 0) > 0 and daily_stats:
                            # Create sessions based on daily stats
                            for stat in daily_stats:
                                if stat['pages_read'] > 0:
                                    session_date = datetime.strptime(stat['date'], '%Y-%m-%d')
                                    session = ReadingSession(
                                        date=session_date,
                                        book_path=book.file_path,
                                        book_title=book.display_name or book.title,
                                        pages_read=stat['pages_read'],
                                        duration_minutes=stat['pages_read'] * 2,  # Estimate 2 minutes per page
                                        category=book.category or 'Uncategorized'
                                    )
                                    self.sessions.append(session)
                            print(f"📊 Created {len([s for s in daily_stats if s['pages_read'] > 0])} sessions from analytics for {book.title}")
                        else:
                            # Create a basic session for books with progress but no detailed analytics
                            session = ReadingSession(
                                date=book.last_opened,
                                book_path=book.file_path,
                                book_title=book.display_name or book.title,
                                pages_read=book.pages_read,
                                duration_minutes=book.pages_read * 2,  # Estimate 2 minutes per page
                                category=book.category or 'Uncategorized'
                            )
                            self.sessions.append(session)
                            print(f"📚 Added basic session for: {book.title} ({book.pages_read} pages)")
                    except Exception as e:
                        # Fallback to basic session if analytics fail
                        session = ReadingSession(
                            date=book.last_opened,
                            book_path=book.file_path,
                            book_title=book.display_name or book.title,
                            pages_read=book.pages_read,
                            duration_minutes=book.pages_read * 2,  # Estimate 2 minutes per page
                            category=book.category or 'Uncategorized'
                        )
                        self.sessions.append(session)
                        print(f"📚 Added fallback session for: {book.title} ({book.pages_read} pages)")

            # Save the updated statistics
            if len(self.sessions) > len(existing_book_paths):
                self.save_statistics()
                print(f"💾 Saved {len(self.sessions) - len(existing_book_paths)} new reading sessions")

        except Exception as e:
            print(f"❌ Error syncing with existing books: {e}")
            import traceback
            traceback.print_exc()
    
    def add_reading_session(self, book_path: str, pages_read: int, duration_minutes: int = 0):
        """Add a new reading session"""
        if self.books_manager:
            book = self.books_manager.get_book_by_path(book_path)
            if book:
                session = ReadingSession(
                    date=datetime.now(),
                    book_path=book_path,
                    book_title=book.title,
                    pages_read=pages_read,
                    duration_minutes=duration_minutes,
                    category=book.category or 'Uncategorized'
                )
                self.sessions.append(session)
                self.save_statistics()
    
    def get_reading_progress_over_time(self, days: int = 30) -> Tuple[List[datetime], List[int]]:
        """Get reading progress over time"""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # Group sessions by date
        daily_pages = {}
        for session in self.sessions:
            if start_date <= session.date <= end_date:
                date_key = session.date.date()
                daily_pages[date_key] = daily_pages.get(date_key, 0) + session.pages_read
        
        # Create continuous date range
        dates = []
        pages = []
        current_date = start_date.date()
        
        while current_date <= end_date.date():
            dates.append(datetime.combine(current_date, datetime.min.time()))
            pages.append(daily_pages.get(current_date, 0))
            current_date += timedelta(days=1)
        
        return dates, pages
    
    def get_category_distribution(self) -> Dict[str, int]:
        """Get reading distribution by category"""
        category_pages = {}
        for session in self.sessions:
            category = session.category or 'Uncategorized'
            category_pages[category] = category_pages.get(category, 0) + session.pages_read
        return category_pages
    
    def get_weekly_stats(self, weeks: int = 4) -> List[WeeklyReport]:
        """Get weekly reading statistics"""
        reports = []
        end_date = datetime.now()
        
        for week in range(weeks):
            week_start = end_date - timedelta(weeks=week, days=end_date.weekday())
            week_end = week_start + timedelta(days=6)
            
            week_sessions = [
                session for session in self.sessions
                if week_start <= session.date <= week_end
            ]
            
            books_completed = len(set(session.book_path for session in week_sessions))
            total_pages = sum(session.pages_read for session in week_sessions)
            reading_time = sum(session.duration_minutes for session in week_sessions)
            categories = list(set(session.category for session in week_sessions))
            
            report = WeeklyReport(
                week_start=week_start,
                books_completed=books_completed,
                total_pages=total_pages,
                reading_time_minutes=reading_time,
                categories_read=categories,
                goals_achieved={'pages': total_pages >= 50, 'books': books_completed >= 1}
            )
            reports.append(report)
        
        return reports
    
    def get_reading_speed(self) -> float:
        """Calculate average reading speed (pages per minute)"""
        total_pages = sum(session.pages_read for session in self.sessions if session.duration_minutes > 0)
        total_time = sum(session.duration_minutes for session in self.sessions if session.duration_minutes > 0)
        
        if total_time > 0:
            return total_pages / total_time
        return 0.0


class ChartWidget(QWidget):
    """Custom widget for displaying charts"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.figure = Figure(figsize=(10, 6), dpi=100)
        self.canvas = FigureCanvas(self.figure)
        
        layout = QVBoxLayout(self)
        layout.addWidget(self.canvas)
        
        # Set dark theme for charts
        self.figure.patch.set_facecolor('#2d2d2d')
    
    def clear(self):
        """Clear the chart"""
        self.figure.clear()
        self.canvas.draw()

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
    
    def plot_reading_progress(self, dates: List[datetime], pages: List[int], localization=None):
        """Plot reading progress over time with Arabic text support"""
        self.figure.clear()
        ax = self.figure.add_subplot(111)

        # Plot data
        ax.plot(dates, pages, color='#1976D2', linewidth=2, marker='o', markersize=6)
        ax.fill_between(dates, pages, alpha=0.3, color='#1976D2')

        # Styling
        ax.set_facecolor('#1e1e1e')
        ax.tick_params(colors='white')
        ax.spines['bottom'].set_color('white')
        ax.spines['top'].set_color('white')
        ax.spines['right'].set_color('white')
        ax.spines['left'].set_color('white')

        # Labels with Arabic text support
        title = "Reading Progress Over Time" if not localization else localization.get_text('reading_progress_chart')
        ylabel = "Pages Read" if not localization else localization.get_text('pages_read')

        # Fix Arabic text
        fixed_title = self.fix_arabic_text(title)
        fixed_ylabel = self.fix_arabic_text(ylabel)

        ax.set_title(fixed_title, color='white', fontsize=14, fontweight='bold')
        ax.set_ylabel(fixed_ylabel, color='white', fontsize=12)
        ax.grid(True, alpha=0.3, color='white')

        # Format dates
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d'))
        ax.xaxis.set_major_locator(mdates.DayLocator(interval=5))
        plt.setp(ax.xaxis.get_majorticklabels(), rotation=45, ha='right', color='white')

        self.figure.tight_layout()
        self.canvas.draw()
    
    def plot_category_distribution(self, categories: Dict[str, int], localization=None):
        """Plot category distribution pie chart with Arabic text support"""
        self.figure.clear()
        ax = self.figure.add_subplot(111)

        if not categories:
            no_data_text = self.fix_arabic_text('No data available' if not localization else localization.get_text('no_data_available'))
            ax.text(0.5, 0.5, no_data_text, ha='center', va='center',
                   transform=ax.transAxes, color='white', fontsize=12)
            self.canvas.draw()
            return

        # Prepare data with Arabic text support
        labels = [self.fix_arabic_text(str(label)) for label in categories.keys()]
        sizes = list(categories.values())
        colors = plt.cm.Set3(np.linspace(0, 1, len(labels)))

        # Create pie chart
        wedges, texts, autotexts = ax.pie(sizes, labels=labels, autopct='%1.1f%%',
                                         colors=colors, startangle=90)

        # Styling
        ax.set_facecolor('#1e1e1e')
        for text in texts:
            text.set_color('white')
            text.set_fontsize(11)
        for autotext in autotexts:
            autotext.set_color('white')
            autotext.set_fontweight('bold')
            autotext.set_fontsize(10)

        title = "Reading by Category" if not localization else localization.get_text('category_distribution_chart')
        fixed_title = self.fix_arabic_text(title)
        ax.set_title(fixed_title, color='white', fontsize=14, fontweight='bold')

        self.figure.tight_layout()
        self.canvas.draw()


class EnhancedReadingStatistics(QWidget):
    """Enhanced reading statistics dashboard with charts and comprehensive analytics"""
    
    def __init__(self, books_manager=None, localization=None, parent=None):
        super().__init__(parent)
        self.books_manager = books_manager
        self.localization = localization
        self.stats_manager = ReadingStatisticsManager(books_manager)

        # Force a sync with existing books when dashboard is opened
        print("🔄 Refreshing statistics dashboard with latest book data...")
        self.stats_manager.sync_with_existing_books()

        self.init_ui()
        self.load_statistics()
        
        # Auto-refresh timer
        self.refresh_timer = QTimer()
        self.refresh_timer.timeout.connect(self.refresh_statistics)
        self.refresh_timer.start(60000)  # Refresh every minute
    
    def init_ui(self):
        """Initialize the user interface"""
        layout = QVBoxLayout(self)
        layout.setSpacing(15)
        layout.setContentsMargins(20, 20, 20, 20)
        
        # Header
        self.create_header(layout)
        
        # Main content with tabs
        self.create_main_content(layout)
        
        # Action buttons
        self.create_action_buttons(layout)
    
    def create_header(self, layout):
        """Create simplified header section"""
        header_frame = QFrame()
        header_frame.setObjectName("StatsHeader")
        header_layout = QHBoxLayout(header_frame)
        
        # Title with icon
        title_text = "📊 Reading Statistics Dashboard"
        if self.localization:
            title_text = f"📊 {self.localization.get_text('reading_statistics_dashboard')}"
        
        title = QLabel(title_text)
        title.setFont(QFont("Segoe UI", 18, QFont.Bold))  # Better font for Arabic support
        title.setStyleSheet("color: white; padding: 10px;")
        header_layout.addWidget(title)
        
        header_layout.addStretch()
        
        # Quick stats
        self.create_quick_stats(header_layout)
        
        layout.addWidget(header_frame)

    def create_quick_stats(self, layout):
        """Create quick statistics display"""
        # Total books
        total_books = len(set(session.book_path for session in self.stats_manager.sessions))
        books_text = "Total Books Read" if not self.localization else self.localization.get_text('total_books_read')
        books_label = QLabel(f"📚 {books_text}: {total_books}")
        books_label.setFont(QFont("Segoe UI", 12, QFont.Bold))
        books_label.setStyleSheet("color: white; padding: 5px;")
        layout.addWidget(books_label)

        # Total pages
        total_pages = sum(session.pages_read for session in self.stats_manager.sessions)
        pages_text = "Total Pages Read" if not self.localization else self.localization.get_text('total_pages_read')
        pages_label = QLabel(f"📄 {pages_text}: {total_pages}")
        pages_label.setFont(QFont("Segoe UI", 12, QFont.Bold))
        pages_label.setStyleSheet("color: white; padding: 5px;")
        layout.addWidget(pages_label)

        # Reading streak
        streak = self.calculate_reading_streak()
        streak_text = "Reading Streak (Days)" if not self.localization else self.localization.get_text('reading_streak_days')
        streak_label = QLabel(f"🔥 {streak_text}: {streak}")
        streak_label.setFont(QFont("Segoe UI", 12, QFont.Bold))
        streak_label.setStyleSheet("color: white; padding: 5px;")
        layout.addWidget(streak_label)

    def create_main_content(self, layout):
        """Create main content with tabs"""
        self.tab_widget = QTabWidget()
        self.tab_widget.setStyleSheet("""
            QTabWidget::pane {
                border: 1px solid #555555;
                background-color: #1e1e1e;
            }
            QTabBar::tab {
                background-color: #2d2d2d;
                color: white;
                padding: 8px 16px;
                margin: 2px;
                border-radius: 4px;
            }
            QTabBar::tab:selected {
                background-color: #1976D2;
            }
        """)

        # Charts tab
        self.create_charts_tab()

        # Weekly reports tab
        self.create_weekly_reports_tab()

        # Detailed analytics tab
        self.create_detailed_analytics_tab()

        layout.addWidget(self.tab_widget)

    def create_charts_tab(self):
        """Create charts tab"""
        charts_widget = QWidget()
        charts_layout = QVBoxLayout(charts_widget)

        # Chart controls
        controls_layout = QHBoxLayout()

        # Time range selector
        range_label = QLabel("Time Range:" if not self.localization else f"{self.localization.get_text('time_range')}:")
        range_label.setStyleSheet("color: white; font-weight: bold;")
        controls_layout.addWidget(range_label)

        self.time_range_combo = QComboBox()
        self.time_range_combo.addItems(["7 Days", "30 Days", "90 Days", "1 Year"])
        if self.localization:
            self.time_range_combo.clear()
            self.time_range_combo.addItems([
                self.localization.get_text('7_days'),
                self.localization.get_text('30_days'),
                self.localization.get_text('90_days'),
                self.localization.get_text('1_year')
            ])
        self.time_range_combo.setCurrentIndex(1)  # Default to 30 days
        self.time_range_combo.currentTextChanged.connect(self.update_charts)
        controls_layout.addWidget(self.time_range_combo)

        controls_layout.addStretch()

        # Export chart button
        export_btn = QPushButton("📊 Export Charts" if not self.localization else f"📊 {self.localization.get_text('export_charts')}")
        export_btn.clicked.connect(self.export_charts)
        export_btn.setStyleSheet("""
            QPushButton {
                background-color: #4CAF50;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #45a049;
            }
        """)
        controls_layout.addWidget(export_btn)

        charts_layout.addLayout(controls_layout)

        # Charts container
        charts_container = QSplitter(Qt.Horizontal)

        # Reading progress chart
        self.progress_chart = ChartWidget()
        charts_container.addWidget(self.progress_chart)

        # Category distribution chart
        self.category_chart = ChartWidget()
        charts_container.addWidget(self.category_chart)

        charts_layout.addWidget(charts_container)

        tab_title = "📈 Charts" if not self.localization else f"📈 {self.localization.get_text('charts')}"
        self.tab_widget.addTab(charts_widget, tab_title)

    def create_weekly_reports_tab(self):
        """Create weekly reports tab"""
        reports_widget = QWidget()
        reports_layout = QVBoxLayout(reports_widget)

        # Reports header
        reports_header = QLabel("📅 Weekly Reading Reports" if not self.localization else f"📅 {self.localization.get_text('weekly_reading_reports')}")
        reports_header.setFont(QFont("Segoe UI", 14, QFont.Bold))
        reports_header.setStyleSheet("color: white; padding: 10px;")
        reports_layout.addWidget(reports_header)

        # Reports scroll area
        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setStyleSheet("""
            QScrollArea {
                border: none;
                background-color: #1e1e1e;
            }
        """)

        self.reports_container = QWidget()
        self.reports_layout = QVBoxLayout(self.reports_container)
        scroll_area.setWidget(self.reports_container)

        reports_layout.addWidget(scroll_area)

        # Generate report button
        generate_btn = QPushButton("📋 Generate New Report" if not self.localization else f"📋 {self.localization.get_text('generate_new_report')}")
        generate_btn.clicked.connect(self.generate_weekly_report)
        generate_btn.setStyleSheet("""
            QPushButton {
                background-color: #2196F3;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #1976D2;
            }
        """)
        reports_layout.addWidget(generate_btn)

        tab_title = "📅 Weekly Reports" if not self.localization else f"📅 {self.localization.get_text('weekly_reports')}"
        self.tab_widget.addTab(reports_widget, tab_title)

    def create_detailed_analytics_tab(self):
        """Create detailed analytics tab"""
        analytics_widget = QWidget()
        analytics_layout = QVBoxLayout(analytics_widget)

        # Analytics table
        self.analytics_table = QTableWidget()
        self.analytics_table.setStyleSheet("""
            QTableWidget {
                background-color: #2d2d2d;
                color: white;
                gridline-color: #555555;
                border: 1px solid #555555;
            }
            QTableWidget::item {
                padding: 8px;
            }
            QTableWidget::item:selected {
                background-color: #1976D2;
            }
            QHeaderView::section {
                background-color: #404040;
                color: white;
                padding: 8px;
                border: 1px solid #555555;
                font-weight: bold;
            }
        """)

        # Set up table headers
        headers = ["Date", "Book", "Pages", "Category", "Duration"]
        if self.localization:
            headers = [
                self.localization.get_text('date'),
                self.localization.get_text('book'),
                self.localization.get_text('pages'),
                self.localization.get_text('category'),
                self.localization.get_text('duration')
            ]

        self.analytics_table.setColumnCount(len(headers))
        self.analytics_table.setHorizontalHeaderLabels(headers)
        self.analytics_table.horizontalHeader().setStretchLastSection(True)

        analytics_layout.addWidget(self.analytics_table)

        tab_title = "📊 Detailed Analytics" if not self.localization else f"📊 {self.localization.get_text('detailed_analytics')}"
        self.tab_widget.addTab(analytics_widget, tab_title)

    def create_action_buttons(self, layout):
        """Create action buttons"""
        buttons_layout = QHBoxLayout()

        # Refresh button
        refresh_btn = QPushButton("🔄 Refresh" if not self.localization else f"🔄 {self.localization.get_text('refresh')}")
        refresh_btn.clicked.connect(self.refresh_statistics)
        refresh_btn.setStyleSheet("""
            QPushButton {
                background-color: #FF9800;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #F57C00;
            }
        """)
        buttons_layout.addWidget(refresh_btn)

        buttons_layout.addStretch()

        # Export all data button
        export_all_btn = QPushButton("💾 Export All Data" if not self.localization else f"💾 {self.localization.get_text('export_all_data')}")
        export_all_btn.clicked.connect(self.export_all_data)
        export_all_btn.setStyleSheet("""
            QPushButton {
                background-color: #9C27B0;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #7B1FA2;
            }
        """)
        buttons_layout.addWidget(export_all_btn)

        layout.addLayout(buttons_layout)

    def calculate_reading_streak(self) -> int:
        """Calculate current reading streak in days"""
        if not self.stats_manager.sessions:
            return 0

        # Get unique reading dates
        reading_dates = set()
        for session in self.stats_manager.sessions:
            reading_dates.add(session.date.date())

        # Calculate streak from today backwards
        streak = 0
        current_date = datetime.now().date()

        while current_date in reading_dates:
            streak += 1
            current_date -= timedelta(days=1)

        return streak

    def load_statistics(self):
        """Load and display statistics"""
        self.update_charts()
        self.update_weekly_reports()
        self.update_analytics_table()

    def refresh_statistics(self):
        """Refresh all statistics"""
        self.stats_manager.load_statistics()
        self.load_statistics()

    def update_charts(self):
        """Update all charts"""
        # Get time range
        range_text = self.time_range_combo.currentText()
        days = 30  # Default

        if "7" in range_text:
            days = 7
        elif "30" in range_text:
            days = 30
        elif "90" in range_text:
            days = 90
        elif "1" in range_text:
            days = 365

        # Update progress chart
        dates, pages = self.stats_manager.get_reading_progress_over_time(days)
        self.progress_chart.plot_reading_progress(dates, pages, self.localization)

        # Update category chart
        categories = self.stats_manager.get_category_distribution()
        self.category_chart.plot_category_distribution(categories, self.localization)

    def update_weekly_reports(self):
        """Update weekly reports display"""
        # Clear existing reports
        for i in reversed(range(self.reports_layout.count())):
            child = self.reports_layout.itemAt(i).widget()
            if child:
                child.setParent(None)

        # Get weekly reports
        reports = self.stats_manager.get_weekly_stats(4)

        for report in reports:
            self.create_weekly_report_widget(report)

    def create_weekly_report_widget(self, report: WeeklyReport):
        """Create a widget for a weekly report"""
        report_frame = QFrame()
        report_frame.setStyleSheet("""
            QFrame {
                background-color: #2d2d2d;
                border: 1px solid #555555;
                border-radius: 8px;
                padding: 15px;
                margin: 5px;
            }
        """)

        layout = QVBoxLayout(report_frame)

        # Week header
        week_str = report.week_start.strftime("%B %d, %Y")
        header = QLabel(f"📅 Week of {week_str}")
        header.setFont(QFont("Segoe UI", 12, QFont.Bold))
        header.setStyleSheet("color: #1976D2; margin-bottom: 10px;")
        layout.addWidget(header)

        # Stats grid
        stats_layout = QGridLayout()

        # Books completed
        books_label = QLabel("Books Completed:" if not self.localization else f"{self.localization.get_text('books_completed')}:")
        books_value = QLabel(str(report.books_completed))
        books_value.setStyleSheet("color: white; font-weight: bold;")
        stats_layout.addWidget(books_label, 0, 0)
        stats_layout.addWidget(books_value, 0, 1)

        # Total pages
        pages_label = QLabel("Total Pages:" if not self.localization else f"{self.localization.get_text('total_pages')}:")
        pages_value = QLabel(str(report.total_pages))
        pages_value.setStyleSheet("color: white; font-weight: bold;")
        stats_layout.addWidget(pages_label, 1, 0)
        stats_layout.addWidget(pages_value, 1, 1)

        # Reading time
        time_label = QLabel("Reading Time:" if not self.localization else f"{self.localization.get_text('reading_time')}:")
        time_value = QLabel(f"{report.reading_time_minutes} min")
        time_value.setStyleSheet("color: white; font-weight: bold;")
        stats_layout.addWidget(time_label, 2, 0)
        stats_layout.addWidget(time_value, 2, 1)

        # Categories
        categories_label = QLabel("Categories:" if not self.localization else f"{self.localization.get_text('categories')}:")
        categories_value = QLabel(", ".join(report.categories_read) if report.categories_read else "None")
        categories_value.setStyleSheet("color: white; font-weight: bold;")
        stats_layout.addWidget(categories_label, 3, 0)
        stats_layout.addWidget(categories_value, 3, 1)

        layout.addLayout(stats_layout)

        # Goals achievement
        goals_layout = QHBoxLayout()
        goals_label = QLabel("Goals:" if not self.localization else f"{self.localization.get_text('goals')}:")
        goals_layout.addWidget(goals_label)

        for goal, achieved in report.goals_achieved.items():
            goal_icon = "✅" if achieved else "❌"
            goal_widget = QLabel(f"{goal_icon} {goal}")
            goal_widget.setStyleSheet("color: white; margin-left: 10px;")
            goals_layout.addWidget(goal_widget)

        layout.addLayout(goals_layout)

        self.reports_layout.addWidget(report_frame)

    def update_analytics_table(self):
        """Update the detailed analytics table"""
        sessions = sorted(self.stats_manager.sessions, key=lambda x: x.date, reverse=True)

        self.analytics_table.setRowCount(len(sessions))

        for row, session in enumerate(sessions):
            # Date
            date_item = QTableWidgetItem(session.date.strftime("%Y-%m-%d %H:%M"))
            self.analytics_table.setItem(row, 0, date_item)

            # Book title
            book_item = QTableWidgetItem(session.book_title)
            self.analytics_table.setItem(row, 1, book_item)

            # Pages
            pages_item = QTableWidgetItem(str(session.pages_read))
            self.analytics_table.setItem(row, 2, pages_item)

            # Category
            category_item = QTableWidgetItem(session.category)
            self.analytics_table.setItem(row, 3, category_item)

            # Duration
            duration_text = f"{session.duration_minutes} min" if session.duration_minutes > 0 else "N/A"
            duration_item = QTableWidgetItem(duration_text)
            self.analytics_table.setItem(row, 4, duration_item)

    def generate_weekly_report(self):
        """Generate and display a new weekly report"""
        current_week = self.stats_manager.get_weekly_stats(1)[0]

        # Create detailed report dialog
        dialog = QDialog(self)
        dialog.setWindowTitle("Weekly Report" if not self.localization else self.localization.get_text('weekly_report'))
        dialog.setFixedSize(500, 400)

        layout = QVBoxLayout(dialog)

        # Report content
        report_text = QTextEdit()
        report_text.setReadOnly(True)
        report_text.setStyleSheet("""
            QTextEdit {
                background-color: #2d2d2d;
                color: white;
                border: 1px solid #555555;
                border-radius: 4px;
                padding: 10px;
            }
        """)

        # Generate report content
        report_content = self.generate_report_content(current_week)
        report_text.setHtml(report_content)

        layout.addWidget(report_text)

        # Buttons
        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Save)
        buttons.accepted.connect(dialog.accept)
        buttons.button(QDialogButtonBox.Save).clicked.connect(lambda: self.save_report(report_content))
        layout.addWidget(buttons)

        dialog.exec()

    def generate_report_content(self, report: WeeklyReport) -> str:
        """Generate HTML content for weekly report"""
        week_str = report.week_start.strftime("%B %d, %Y")

        content = f"""
        <h2 style="color: #1976D2;">📅 Weekly Reading Report</h2>
        <h3 style="color: white;">Week of {week_str}</h3>

        <h4 style="color: #4CAF50;">📊 Summary</h4>
        <ul style="color: white;">
            <li><strong>Books Completed:</strong> {report.books_completed}</li>
            <li><strong>Total Pages Read:</strong> {report.total_pages}</li>
            <li><strong>Reading Time:</strong> {report.reading_time_minutes} minutes</li>
            <li><strong>Categories Explored:</strong> {', '.join(report.categories_read) if report.categories_read else 'None'}</li>
        </ul>

        <h4 style="color: #FF9800;">🎯 Goals Achievement</h4>
        <ul style="color: white;">
        """

        for goal, achieved in report.goals_achieved.items():
            status = "✅ Achieved" if achieved else "❌ Not Achieved"
            content += f"<li><strong>{goal.title()}:</strong> {status}</li>"

        content += """
        </ul>

        <h4 style="color: #9C27B0;">💡 Recommendations</h4>
        <ul style="color: white;">
        """

        # Add recommendations based on performance
        if report.total_pages < 50:
            content += "<li>Try to read at least 10 pages per day to reach weekly goals</li>"
        if report.books_completed == 0:
            content += "<li>Consider setting aside dedicated reading time each day</li>"
        if len(report.categories_read) <= 1:
            content += "<li>Explore different book categories to diversify your reading</li>"

        content += """
        </ul>

        <p style="color: #CCCCCC; font-style: italic; margin-top: 20px;">
        Keep up the great work! Reading is a journey of continuous learning and growth.
        </p>
        """

        return content

    def save_report(self, content: str):
        """Save weekly report to file"""
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            "Save Weekly Report" if not self.localization else self.localization.get_text('save_weekly_report'),
            f"weekly_report_{datetime.now().strftime('%Y%m%d')}.html",
            "HTML Files (*.html);;PDF Files (*.pdf)"
        )

        if file_path:
            try:
                if file_path.endswith('.html'):
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                elif file_path.endswith('.pdf'):
                    # Convert HTML to PDF (requires additional library)
                    QMessageBox.information(self, "Info", "PDF export requires additional setup. Saved as HTML instead.")
                    file_path = file_path.replace('.pdf', '.html')
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(content)

                QMessageBox.information(self, "Success", f"Report saved to {file_path}")
            except Exception as e:
                QMessageBox.warning(self, "Error", f"Failed to save report: {e}")

    def export_charts(self):
        """Export charts as images"""
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            "Export Charts" if not self.localization else self.localization.get_text('export_charts'),
            f"reading_charts_{datetime.now().strftime('%Y%m%d')}.png",
            "PNG Files (*.png);;PDF Files (*.pdf)"
        )

        if file_path:
            try:
                # Create a combined figure with both charts
                fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 8))
                fig.patch.set_facecolor('#2d2d2d')

                # Get data for charts
                range_text = self.time_range_combo.currentText()
                days = 30
                if "7" in range_text:
                    days = 7
                elif "90" in range_text:
                    days = 90
                elif "1" in range_text:
                    days = 365

                dates, pages = self.stats_manager.get_reading_progress_over_time(days)
                categories = self.stats_manager.get_category_distribution()

                # Plot reading progress
                ax1.plot(dates, pages, color='#1976D2', linewidth=2, marker='o', markersize=4)
                ax1.fill_between(dates, pages, alpha=0.3, color='#1976D2')
                ax1.set_facecolor('#1e1e1e')
                ax1.tick_params(colors='white')
                ax1.set_title('Reading Progress Over Time', color='white', fontsize=14, fontweight='bold')
                ax1.set_ylabel('Pages Read', color='white')
                ax1.grid(True, alpha=0.3, color='white')

                # Plot category distribution
                if categories:
                    labels = list(categories.keys())
                    sizes = list(categories.values())
                    colors = plt.cm.Set3(np.linspace(0, 1, len(labels)))

                    wedges, texts, autotexts = ax2.pie(sizes, labels=labels, autopct='%1.1f%%',
                                                     colors=colors, startangle=90)
                    ax2.set_facecolor('#1e1e1e')
                    for text in texts:
                        text.set_color('white')
                    for autotext in autotexts:
                        autotext.set_color('white')
                        autotext.set_fontweight('bold')
                    ax2.set_title('Reading by Category', color='white', fontsize=14, fontweight='bold')

                plt.tight_layout()
                plt.savefig(file_path, facecolor='#2d2d2d', dpi=300, bbox_inches='tight')
                plt.close()

                QMessageBox.information(self, "Success", f"Charts exported to {file_path}")
            except Exception as e:
                QMessageBox.warning(self, "Error", f"Failed to export charts: {e}")

    def export_all_data(self):
        """Export all reading data to CSV"""
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            "Export All Data" if not self.localization else self.localization.get_text('export_all_data'),
            f"reading_data_{datetime.now().strftime('%Y%m%d')}.csv",
            "CSV Files (*.csv)"
        )

        if file_path:
            try:
                import csv

                with open(file_path, 'w', newline='', encoding='utf-8') as csvfile:
                    writer = csv.writer(csvfile)

                    # Write header
                    headers = ['Date', 'Book Title', 'Book Path', 'Pages Read', 'Duration (minutes)', 'Category']
                    writer.writerow(headers)

                    # Write data
                    for session in sorted(self.stats_manager.sessions, key=lambda x: x.date):
                        writer.writerow([
                            session.date.strftime('%Y-%m-%d %H:%M:%S'),
                            session.book_title,
                            session.book_path,
                            session.pages_read,
                            session.duration_minutes,
                            session.category
                        ])

                QMessageBox.information(self, "Success", f"Data exported to {file_path}")
            except Exception as e:
                QMessageBox.warning(self, "Error", f"Failed to export data: {e}")


# Dialog for displaying enhanced reading statistics
class ReadingStatisticsDialog(QDialog):
    """Dialog for displaying enhanced reading statistics"""

    def __init__(self, books_manager=None, localization=None, parent=None):
        super().__init__(parent)
        self.books_manager = books_manager
        self.localization = localization

        self.setWindowTitle("Reading Statistics" if not localization else localization.get_text('reading_statistics'))
        self.setFixedSize(1200, 800)

        # Create main layout
        layout = QVBoxLayout(self)

        # Add enhanced statistics widget
        self.stats_widget = EnhancedReadingStatistics(books_manager, localization, self)
        layout.addWidget(self.stats_widget)

        # Close button
        close_btn = QPushButton("Close" if not localization else localization.get_text('close'))
        close_btn.clicked.connect(self.accept)
        close_btn.setStyleSheet("""
            QPushButton {
                background-color: #f44336;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #d32f2f;
            }
        """)
        layout.addWidget(close_btn)
