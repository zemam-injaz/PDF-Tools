import os
import sqlite3
import json
import time
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import fitz  # PyMuPDF
from PIL import Image
import io

# Import app paths utility
try:
    from app_paths import get_database_path, get_thumbnails_dir
except ImportError:
    # Fallback if app_paths is not available
    def get_database_path(db_name):
        return db_name
    def get_thumbnails_dir():
        return "thumbnails"


@dataclass
class RecentBook:
    """Data class for recent book information"""
    id: Optional[int]
    file_path: str
    file_name: str
    title: str
    total_pages: int
    pages_read: int
    reading_percentage: float
    file_size: int
    date_added: datetime
    last_opened: datetime
    thumbnail_path: Optional[str] = None
    is_starred: bool = False
    priority: int = 0  # 0=normal, 1=high, 2=urgent
    notes: str = ""
    display_name: str = ""  # Custom display name (defaults to title)
    category: str = ""  # Book category (Academic, Fiction, Technical, etc.)
    cover_image_path: str = ""  # Path to custom cover image
    reading_status: str = "reading"  # reading, to_read, completed


class RecentBooksManager:
    """Manager for recent books functionality with lazy database initialization"""

    def __init__(self, db_path: str = None):
        # Use app data directory for database and thumbnails
        if db_path is None:
            self.db_path = get_database_path("recent_books.db")
            self.thumbnails_dir = get_thumbnails_dir()
        else:
            self.db_path = db_path
            self.thumbnails_dir = "thumbnails"

        # Defer database initialization for faster startup
        self._db_initialized = False
        print(f"📚 Recent Books Manager initialized (database will be loaded on first use)")
        print(f"   Database path: {self.db_path}")
        print(f"   Thumbnails directory: {self.thumbnails_dir}")

    def ensure_initialized(self):
        """Ensure database is initialized (lazy initialization)"""
        if not self._db_initialized:
            print(f"📦 Initializing Recent Books database...")
            self.init_database()
            self.ensure_thumbnails_dir()
            self._db_initialized = True
            print(f"✅ Recent Books database initialized")
    
    def init_database(self):
        """Initialize the SQLite database"""
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        cursor = conn.cursor()

        # Create table with basic structure first
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS recent_books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT UNIQUE NOT NULL,
                file_name TEXT NOT NULL,
                title TEXT NOT NULL,
                total_pages INTEGER NOT NULL,
                pages_read INTEGER DEFAULT 0,
                reading_percentage REAL DEFAULT 0.0,
                file_size INTEGER NOT NULL,
                date_added TEXT NOT NULL,
                last_opened TEXT NOT NULL,
                thumbnail_path TEXT
            )
        ''')

        # Add new columns if they don't exist (for migration)
        try:
            cursor.execute('ALTER TABLE recent_books ADD COLUMN is_starred INTEGER DEFAULT 0')
        except sqlite3.OperationalError:
            pass  # Column already exists

        try:
            cursor.execute('ALTER TABLE recent_books ADD COLUMN priority INTEGER DEFAULT 0')
        except sqlite3.OperationalError:
            pass  # Column already exists

        try:
            cursor.execute('ALTER TABLE recent_books ADD COLUMN notes TEXT DEFAULT ""')
        except sqlite3.OperationalError:
            pass  # Column already exists

        try:
            cursor.execute('ALTER TABLE recent_books ADD COLUMN display_name TEXT DEFAULT ""')
        except sqlite3.OperationalError:
            pass  # Column already exists

        try:
            cursor.execute('ALTER TABLE recent_books ADD COLUMN category TEXT DEFAULT ""')
        except sqlite3.OperationalError:
            pass  # Column already exists

        try:
            cursor.execute('ALTER TABLE recent_books ADD COLUMN cover_image_path TEXT DEFAULT ""')
        except sqlite3.OperationalError:
            pass  # Column already exists

        try:
            cursor.execute('ALTER TABLE recent_books ADD COLUMN reading_status TEXT DEFAULT "reading"')
        except sqlite3.OperationalError:
            pass  # Column already exists

        # Create reading sessions table for analytics
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS reading_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                session_date TEXT NOT NULL,
                pages_read INTEGER NOT NULL,
                session_duration INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (file_path) REFERENCES recent_books (file_path)
            )
        ''')

        # Add new columns to reading_sessions if they don't exist
        try:
            cursor.execute('ALTER TABLE reading_sessions ADD COLUMN words_per_minute REAL DEFAULT 0.0')
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute('ALTER TABLE reading_sessions ADD COLUMN avg_words_per_page REAL DEFAULT 0.0')
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute('ALTER TABLE reading_sessions ADD COLUMN comprehension_score REAL DEFAULT 0.0')
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute('ALTER TABLE reading_sessions ADD COLUMN session_notes TEXT DEFAULT ""')
        except sqlite3.OperationalError:
            pass

        # Create reading speed book configurations table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS reading_speed_configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT UNIQUE NOT NULL,
                total_pages INTEGER NOT NULL,
                avg_words_per_page REAL NOT NULL,
                words_per_page_list TEXT DEFAULT "",
                sample_text TEXT DEFAULT "",
                analysis_date REAL NOT NULL,
                preparation_method TEXT DEFAULT "auto",
                is_prepared BOOLEAN DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (file_path) REFERENCES recent_books (file_path)
            )
        ''')

        conn.commit()
        conn.close()
    
    def ensure_thumbnails_dir(self):
        """Ensure thumbnails directory exists"""
        if not os.path.exists(self.thumbnails_dir):
            os.makedirs(self.thumbnails_dir)
    
    def generate_thumbnail(self, pdf_path: str) -> Optional[str]:
        """Generate thumbnail from first page of PDF"""
        try:
            doc = fitz.open(pdf_path)
            if doc.page_count == 0:
                doc.close()
                return None
            
            # Get first page
            page = doc[0]
            
            # Render page to image
            mat = fitz.Matrix(0.5, 0.5)  # Scale down for thumbnail
            pix = page.get_pixmap(matrix=mat)
            
            # Convert to PIL Image
            img_data = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_data))
            
            # Resize to standard thumbnail size
            img.thumbnail((200, 280), Image.Resampling.LANCZOS)
            
            # Save thumbnail
            filename = os.path.basename(pdf_path)
            thumbnail_name = f"{os.path.splitext(filename)[0]}_thumb.png"
            thumbnail_path = os.path.join(self.thumbnails_dir, thumbnail_name)
            
            img.save(thumbnail_path, "PNG")
            
            doc.close()
            return thumbnail_path
            
        except Exception as e:
            print(f"Error generating thumbnail for {pdf_path}: {e}")
            return None
    
    def add_book(self, file_path: str) -> bool:
        """Add a new book to the recent books list"""
        self.ensure_initialized()  # Lazy database initialization
        try:
            if not os.path.exists(file_path):
                return False
            
            # Get file info
            file_name = os.path.basename(file_path)
            file_size = os.path.getsize(file_path)
            
            # Get PDF info
            doc = fitz.open(file_path)
            total_pages = doc.page_count
            title = doc.metadata.get('title', file_name)
            if not title or title.strip() == "":
                title = os.path.splitext(file_name)[0]
            doc.close()
            
            # Generate thumbnail
            thumbnail_path = self.generate_thumbnail(file_path)
            
            # Create book object
            book = RecentBook(
                id=None,
                file_path=file_path,
                file_name=file_name,
                title=title,
                total_pages=total_pages,
                pages_read=0,
                reading_percentage=0.0,
                file_size=file_size,
                date_added=datetime.now(),
                last_opened=datetime.now(),
                thumbnail_path=thumbnail_path
            )
            
            # Save to database
            return self.save_book(book)
            
        except Exception as e:
            print(f"Error adding book {file_path}: {e}")
            return False
    
    def save_book(self, book: RecentBook) -> bool:
        """Save book to database"""
        self.ensure_initialized()  # Lazy database initialization
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT OR REPLACE INTO recent_books
                (file_path, file_name, title, total_pages, pages_read, reading_percentage,
                 file_size, date_added, last_opened, thumbnail_path, is_starred, priority, notes, display_name, category, cover_image_path, reading_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                book.file_path,
                book.file_name,
                book.title,
                book.total_pages,
                book.pages_read,
                book.reading_percentage,
                book.file_size,
                book.date_added.isoformat(),
                book.last_opened.isoformat(),
                book.thumbnail_path,
                1 if book.is_starred else 0,
                book.priority,
                book.notes,
                book.display_name,
                book.category,
                book.cover_image_path,
                book.reading_status
            ))
            
            conn.commit()
            conn.close()
            return True
            
        except Exception as e:
            print(f"Error saving book: {e}")
            return False
    
    def get_books(self, limit: int = None) -> List[RecentBook]:
        """Get list of recent books"""
        self.ensure_initialized()  # Lazy database initialization
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()

            if limit is None:
                # Get all books
                cursor.execute('''
                    SELECT * FROM recent_books
                    ORDER BY is_starred DESC, priority DESC, last_opened DESC
                ''')
            else:
                cursor.execute('''
                    SELECT * FROM recent_books
                    ORDER BY is_starred DESC, priority DESC, last_opened DESC
                    LIMIT ?
                ''', (limit,))
            
            rows = cursor.fetchall()
            books = []
            
            for row in rows:
                book = RecentBook(
                    id=row[0],
                    file_path=row[1],
                    file_name=row[2],
                    title=row[3],
                    total_pages=row[4],
                    pages_read=row[5],
                    reading_percentage=row[6],
                    file_size=row[7],
                    date_added=datetime.fromisoformat(row[8]),
                    last_opened=datetime.fromisoformat(row[9]),
                    thumbnail_path=row[10],
                    is_starred=bool(row[11]) if len(row) > 11 else False,
                    priority=row[12] if len(row) > 12 else 0,
                    notes=row[13] if len(row) > 13 else "",
                    display_name=row[14] if len(row) > 14 else "",
                    category=row[15] if len(row) > 15 else "",
                    cover_image_path=row[16] if len(row) > 16 else "",
                    reading_status=row[17] if len(row) > 17 else "reading"
                )
                books.append(book)
            
            conn.close()
            return books
            
        except Exception as e:
            print(f"Error getting books: {e}")
            return []
    
    def update_progress(self, file_path: str, pages_read: int, track_session: bool = True) -> bool:
        """Update reading progress for a book"""
        self.ensure_initialized()  # Lazy database initialization
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()

            # Get current book info
            cursor.execute('SELECT total_pages, pages_read FROM recent_books WHERE file_path = ?', (file_path,))
            result = cursor.fetchone()

            if not result:
                conn.close()
                return False

            total_pages, current_pages_read = result
            reading_percentage = min((pages_read / total_pages) * 100, 100.0) if total_pages > 0 else 0.0

            # Update progress and last opened
            cursor.execute('''
                UPDATE recent_books
                SET pages_read = ?, reading_percentage = ?, last_opened = ?
                WHERE file_path = ?
            ''', (pages_read, reading_percentage, datetime.now().isoformat(), file_path))

            conn.commit()
            conn.close()

            # Track reading session if pages increased and tracking is enabled
            if track_session and pages_read > current_pages_read:
                pages_in_session = pages_read - current_pages_read
                self.add_reading_session(file_path, pages_in_session)

            return True

        except Exception as e:
            print(f"Error updating progress: {e}")
            return False
    
    def remove_book(self, file_path: str) -> bool:
        """Remove a book from the recent books list"""
        self.ensure_initialized()  # Lazy database initialization
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()
            
            # Get thumbnail path before deletion
            cursor.execute('SELECT thumbnail_path FROM recent_books WHERE file_path = ?', (file_path,))
            result = cursor.fetchone()
            
            if result and result[0]:
                thumbnail_path = result[0]
                if os.path.exists(thumbnail_path):
                    os.remove(thumbnail_path)
            
            # Delete from database
            cursor.execute('DELETE FROM recent_books WHERE file_path = ?', (file_path,))
            
            conn.commit()
            conn.close()
            return True
            
        except Exception as e:
            print(f"Error removing book: {e}")
            return False
    
    def get_book_by_path(self, file_path: str) -> Optional[RecentBook]:
        """Get a specific book by file path"""
        self.ensure_initialized()  # Lazy database initialization
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()
            
            cursor.execute('SELECT * FROM recent_books WHERE file_path = ?', (file_path,))
            row = cursor.fetchone()
            
            if row:
                book = RecentBook(
                    id=row[0],
                    file_path=row[1],
                    file_name=row[2],
                    title=row[3],
                    total_pages=row[4],
                    pages_read=row[5],
                    reading_percentage=row[6],
                    file_size=row[7],
                    date_added=datetime.fromisoformat(row[8]),
                    last_opened=datetime.fromisoformat(row[9]),
                    thumbnail_path=row[10]
                )
                conn.close()
                return book
            
            conn.close()
            return None
            
        except Exception as e:
            print(f"Error getting book: {e}")
            return None

    def toggle_star(self, file_path: str) -> bool:
        """Toggle star status for a book"""
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()

            # Get current star status
            cursor.execute('SELECT is_starred FROM recent_books WHERE file_path = ?', (file_path,))
            result = cursor.fetchone()

            if not result:
                conn.close()
                return False

            new_starred = 0 if result[0] else 1

            # Update star status
            cursor.execute('''
                UPDATE recent_books
                SET is_starred = ?, last_opened = ?
                WHERE file_path = ?
            ''', (new_starred, datetime.now().isoformat(), file_path))

            conn.commit()
            conn.close()
            return True

        except Exception as e:
            print(f"Error toggling star: {e}")
            return False

    def set_priority(self, file_path: str, priority: int) -> bool:
        """Set priority for a book (0=normal, 1=high, 2=urgent)"""
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()

            cursor.execute('''
                UPDATE recent_books
                SET priority = ?, last_opened = ?
                WHERE file_path = ?
            ''', (priority, datetime.now().isoformat(), file_path))

            conn.commit()
            conn.close()
            return True

        except Exception as e:
            print(f"Error setting priority: {e}")
            return False

    def update_notes(self, file_path: str, notes: str) -> bool:
        """Update notes for a book"""
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()

            cursor.execute('''
                UPDATE recent_books
                SET notes = ?, last_opened = ?
                WHERE file_path = ?
            ''', (notes, datetime.now().isoformat(), file_path))

            conn.commit()
            conn.close()
            return True

        except Exception as e:
            print(f"Error updating notes: {e}")
            return False

    def update_display_name(self, file_path: str, display_name: str) -> bool:
        """Update display name for a book"""
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()

            cursor.execute('''
                UPDATE recent_books
                SET display_name = ?, last_opened = ?
                WHERE file_path = ?
            ''', (display_name, datetime.now().isoformat(), file_path))

            conn.commit()
            conn.close()
            return True

        except Exception as e:
            print(f"Error updating display name: {e}")
            return False

    def add_reading_session(self, file_path: str, pages_read: int, session_duration: int = 0) -> bool:
        """Add a reading session for analytics"""
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()

            session_date = datetime.now().date().isoformat()
            created_at = datetime.now().isoformat()

            cursor.execute('''
                INSERT INTO reading_sessions
                (file_path, session_date, pages_read, session_duration, created_at)
                VALUES (?, ?, ?, ?, ?)
            ''', (file_path, session_date, pages_read, session_duration, created_at))

            conn.commit()
            conn.close()
            return True

        except Exception as e:
            print(f"Error adding reading session: {e}")
            return False

    def get_daily_reading_stats(self, file_path: str, days: int = 30) -> List[Dict]:
        """Get daily reading statistics for a book"""
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()

            # Get reading sessions for the last N days
            cursor.execute('''
                SELECT session_date, SUM(pages_read) as total_pages, COUNT(*) as sessions
                FROM reading_sessions
                WHERE file_path = ?
                AND date(session_date) >= date('now', '-{} days')
                GROUP BY session_date
                ORDER BY session_date DESC
            '''.format(days), (file_path,))

            results = cursor.fetchall()
            stats = []

            for row in results:
                stats.append({
                    'date': row[0],
                    'pages_read': row[1],
                    'sessions': row[2]
                })

            conn.close()
            return stats

        except Exception as e:
            print(f"Error getting daily reading stats: {e}")
            return []

    def get_reading_analytics(self, file_path: str) -> Dict:
        """Get comprehensive reading analytics for a book"""
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()

            # Get total sessions and pages
            cursor.execute('''
                SELECT COUNT(*) as total_sessions,
                       SUM(pages_read) as total_pages_in_sessions,
                       AVG(pages_read) as avg_pages_per_session,
                       MAX(pages_read) as max_pages_in_session,
                       MIN(session_date) as first_session,
                       MAX(session_date) as last_session
                FROM reading_sessions
                WHERE file_path = ?
            ''', (file_path,))

            result = cursor.fetchone()

            if result and result[0] > 0:
                analytics = {
                    'total_sessions': result[0],
                    'total_pages_in_sessions': result[1] or 0,
                    'avg_pages_per_session': round(result[2] or 0, 1),
                    'max_pages_in_session': result[3] or 0,
                    'first_session': result[4],
                    'last_session': result[5],
                    'days_reading': 0
                }

                # Calculate days reading
                if analytics['first_session'] and analytics['last_session']:
                    from datetime import datetime
                    first = datetime.fromisoformat(analytics['first_session'])
                    last = datetime.fromisoformat(analytics['last_session'])
                    analytics['days_reading'] = (last - first).days + 1

                # Get daily average
                if analytics['days_reading'] > 0:
                    analytics['avg_pages_per_day'] = round(
                        analytics['total_pages_in_sessions'] / analytics['days_reading'], 1
                    )
                else:
                    analytics['avg_pages_per_day'] = 0

            else:
                analytics = {
                    'total_sessions': 0,
                    'total_pages_in_sessions': 0,
                    'avg_pages_per_session': 0,
                    'max_pages_in_session': 0,
                    'first_session': None,
                    'last_session': None,
                    'days_reading': 0,
                    'avg_pages_per_day': 0
                }

            conn.close()
            return analytics

        except Exception as e:
            print(f"Error getting reading analytics: {e}")
            return {}

    def update_category(self, file_path: str, category: str) -> bool:
        """Update category for a book"""
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()

            cursor.execute('''
                UPDATE recent_books
                SET category = ?, last_opened = ?
                WHERE file_path = ?
            ''', (category, datetime.now().isoformat(), file_path))

            conn.commit()
            conn.close()
            return True

        except Exception as e:
            print(f"Error updating category: {e}")
            return False

    def get_all_categories(self) -> List[str]:
        """Get all unique categories from books"""
        self.ensure_initialized()  # Lazy database initialization
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()

            cursor.execute('''
                SELECT DISTINCT category FROM recent_books
                WHERE category != "" AND category IS NOT NULL
                ORDER BY category
            ''')

            categories = [row[0] for row in cursor.fetchall()]
            conn.close()
            return categories

        except Exception as e:
            print(f"Error getting categories: {e}")
            return []

    def get_books_by_category(self, category: str) -> List['RecentBook']:
        """Get books filtered by category"""
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()

            if category == "Uncategorized":
                cursor.execute('''
                    SELECT * FROM recent_books
                    WHERE (category = "" OR category IS NULL)
                    ORDER BY is_starred DESC, priority DESC, last_opened DESC
                ''')
            else:
                cursor.execute('''
                    SELECT * FROM recent_books
                    WHERE category = ?
                    ORDER BY is_starred DESC, priority DESC, last_opened DESC
                ''', (category,))

            books = []
            for row in cursor.fetchall():
                book = RecentBook(
                    id=row[0],
                    file_path=row[1],
                    file_name=row[2],
                    title=row[3],
                    total_pages=row[4],
                    pages_read=row[5],
                    reading_percentage=row[6],
                    file_size=row[7],
                    date_added=datetime.fromisoformat(row[8]),
                    last_opened=datetime.fromisoformat(row[9]),
                    thumbnail_path=row[10],
                    is_starred=bool(row[11]) if len(row) > 11 else False,
                    priority=row[12] if len(row) > 12 else 0,
                    notes=row[13] if len(row) > 13 else "",
                    display_name=row[14] if len(row) > 14 else "",
                    category=row[15] if len(row) > 15 else "",
                    cover_image_path=row[16] if len(row) > 16 else ""
                )
                books.append(book)

            conn.close()
            return books

        except Exception as e:
            print(f"Error getting books by category: {e}")
            return []

    def update_cover_image(self, file_path: str, cover_image_path: str) -> bool:
        """Update cover image path for a book"""
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()

            cursor.execute('''
                UPDATE recent_books
                SET cover_image_path = ?, last_opened = ?
                WHERE file_path = ?
            ''', (cover_image_path, datetime.now().isoformat(), file_path))

            conn.commit()
            conn.close()
            return True

        except Exception as e:
            print(f"Error updating cover image: {e}")
            return False

    def extract_first_page_as_cover(self, pdf_path: str) -> str:
        """Extract first page of PDF as cover image"""
        try:
            import fitz  # PyMuPDF
            from PIL import Image

            # Create covers directory if it doesn't exist
            covers_dir = os.path.join(os.path.dirname(self.db_path), "covers")
            os.makedirs(covers_dir, exist_ok=True)

            # Generate cover filename
            pdf_name = os.path.splitext(os.path.basename(pdf_path))[0]
            cover_filename = f"{pdf_name}_cover.png"
            cover_path = os.path.join(covers_dir, cover_filename)

            # Extract first page
            doc = fitz.open(pdf_path)
            if doc.page_count > 0:
                page = doc[0]
                # Render page as image
                mat = fitz.Matrix(2.0, 2.0)  # 2x zoom for better quality
                pix = page.get_pixmap(matrix=mat)

                # Convert to PIL Image and save
                img_data = pix.tobytes("png")
                with open(cover_path, "wb") as f:
                    f.write(img_data)

                doc.close()
                return cover_path
            else:
                doc.close()
                return ""

        except Exception as e:
            print(f"Error extracting cover from PDF: {e}")
            return ""

    def generate_default_cover(self, title: str, author: str = "") -> str:
        """Generate a default cover with title and author"""
        try:
            from PIL import Image, ImageDraw, ImageFont
            import textwrap

            # Create covers directory if it doesn't exist
            covers_dir = os.path.join(os.path.dirname(self.db_path), "covers")
            os.makedirs(covers_dir, exist_ok=True)

            # Generate cover filename
            safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).rstrip()
            cover_filename = f"{safe_title[:50]}_generated.png"
            cover_path = os.path.join(covers_dir, cover_filename)

            # Create image (book proportions)
            width, height = 400, 600
            img = Image.new('RGB', (width, height), color='#2196F3')
            draw = ImageDraw.Draw(img)

            # Try to use a nice font, fallback to default
            try:
                title_font = ImageFont.truetype("arial.ttf", 36)
                author_font = ImageFont.truetype("arial.ttf", 24)
            except:
                title_font = ImageFont.load_default()
                author_font = ImageFont.load_default()

            # Draw title
            title_lines = textwrap.wrap(title, width=20)
            y_offset = height // 3

            for line in title_lines:
                bbox = draw.textbbox((0, 0), line, font=title_font)
                text_width = bbox[2] - bbox[0]
                x = (width - text_width) // 2
                draw.text((x, y_offset), line, fill='white', font=title_font)
                y_offset += 50

            # Draw author if provided
            if author:
                author_lines = textwrap.wrap(f"by {author}", width=25)
                y_offset += 30

                for line in author_lines:
                    bbox = draw.textbbox((0, 0), line, font=author_font)
                    text_width = bbox[2] - bbox[0]
                    x = (width - text_width) // 2
                    draw.text((x, y_offset), line, fill='#E3F2FD', font=author_font)
                    y_offset += 35

            # Save image
            img.save(cover_path, 'PNG')
            return cover_path

        except Exception as e:
            print(f"Error generating default cover: {e}")
            return ""

    def update_reading_status(self, file_path: str, status: str) -> bool:
        """Update reading status for a book"""
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()

            cursor.execute('''
                UPDATE recent_books
                SET reading_status = ?, last_opened = ?
                WHERE file_path = ?
            ''', (status, datetime.now().isoformat(), file_path))

            conn.commit()
            conn.close()
            return True

        except Exception as e:
            print(f"Error updating reading status: {e}")
            return False

    def update_book_field(self, file_path: str, field_name: str, field_value: str) -> bool:
        """Update a specific field for a book"""
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()

            # Validate field name to prevent SQL injection
            allowed_fields = ['notes', 'display_name', 'category', 'reading_status', 'priority']
            if field_name not in allowed_fields:
                print(f"Field '{field_name}' is not allowed for update")
                return False

            # Update the specific field
            query = f"UPDATE recent_books SET {field_name} = ? WHERE file_path = ?"
            cursor.execute(query, (field_value, file_path))

            conn.commit()
            conn.close()
            return True

        except Exception as e:
            print(f"Error updating book field {field_name}: {e}")
            return False

    def save_reading_session(self, file_path: str, pages_read: int, time_spent_seconds: int,
                           wpm: float, avg_words_per_page: float, comprehension_score: float = 0.0,
                           notes: str = "") -> bool:
        """Save a reading session to the database"""
        self.ensure_initialized()  # Lazy database initialization
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()

            session_date = datetime.now().isoformat()

            cursor.execute('''
                INSERT INTO reading_sessions
                (file_path, session_date, pages_read, session_duration, created_at,
                 words_per_minute, avg_words_per_page, comprehension_score, session_notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (file_path, session_date, pages_read, time_spent_seconds, session_date,
                  wpm, avg_words_per_page, comprehension_score, notes))

            conn.commit()
            conn.close()
            return True

        except Exception as e:
            print(f"Error saving reading session: {e}")
            return False

    def get_reading_sessions(self, file_path: str) -> List[dict]:
        """Get all reading sessions for a specific book"""
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()

            cursor.execute('''
                SELECT id, session_date, pages_read, session_duration, words_per_minute,
                       avg_words_per_page, comprehension_score, session_notes, created_at
                FROM reading_sessions
                WHERE file_path = ?
                ORDER BY session_date DESC
            ''', (file_path,))

            sessions = []
            for row in cursor.fetchall():
                session = {
                    'id': row[0],
                    'session_date': row[1],
                    'pages_read': row[2],
                    'session_duration': row[3],
                    'words_per_minute': row[4] if len(row) > 4 else 0.0,
                    'avg_words_per_page': row[5] if len(row) > 5 else 0.0,
                    'comprehension_score': row[6] if len(row) > 6 else 0.0,
                    'session_notes': row[7] if len(row) > 7 else "",
                    'created_at': row[8] if len(row) > 8 else row[1]
                }
                sessions.append(session)

            conn.close()
            return sessions

        except Exception as e:
            print(f"Error getting reading sessions: {e}")
            return []

    def get_reading_statistics(self, file_path: str) -> dict:
        """Get reading statistics for a specific book"""
        try:
            sessions = self.get_reading_sessions(file_path)
            if not sessions:
                return {}

            total_sessions = len(sessions)
            total_pages = sum(s['pages_read'] for s in sessions)
            total_time = sum(s['session_duration'] for s in sessions)

            # Calculate averages
            avg_wpm = sum(s['words_per_minute'] for s in sessions) / total_sessions
            avg_comprehension = sum(s['comprehension_score'] for s in sessions) / total_sessions

            # Find best and worst sessions
            best_wpm = max(s['words_per_minute'] for s in sessions)
            worst_wpm = min(s['words_per_minute'] for s in sessions)

            return {
                'total_sessions': total_sessions,
                'total_pages_read': total_pages,
                'total_time_seconds': total_time,
                'average_wpm': avg_wpm,
                'best_wpm': best_wpm,
                'worst_wpm': worst_wpm,
                'average_comprehension': avg_comprehension,
                'sessions': sessions
            }

        except Exception as e:
            print(f"Error getting reading statistics: {e}")
            return {}

    def get_all_reading_sessions(self) -> List[dict]:
        """Get all reading sessions from all books"""
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()

            cursor.execute('''
                SELECT file_path, session_date, pages_read, session_duration,
                       words_per_minute, avg_words_per_page, comprehension_score,
                       session_notes, created_at
                FROM reading_sessions
                ORDER BY session_date DESC
            ''')

            sessions = []
            for row in cursor.fetchall():
                session = {
                    'file_path': row[0],
                    'timestamp': row[1],  # Use timestamp for consistency with UI
                    'pages_read': row[2],
                    'time_spent_seconds': row[3],
                    'wpm': row[4] if len(row) > 4 else 0.0,
                    'avg_words_per_page': row[5] if len(row) > 5 else 0.0,
                    'comprehension_score': row[6] if len(row) > 6 else 0.0,
                    'session_notes': row[7] if len(row) > 7 else "",
                    'created_at': row[8] if len(row) > 8 else row[1]
                }
                sessions.append(session)

            conn.close()
            return sessions

        except Exception as e:
            print(f"Error getting all reading sessions: {e}")
            return []

    def get_books_by_status(self, status: str) -> List['RecentBook']:
        """Get books filtered by reading status"""
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()

            cursor.execute('''
                SELECT * FROM recent_books
                WHERE reading_status = ?
                ORDER BY is_starred DESC, priority DESC, last_opened DESC
            ''', (status,))

            books = []
            for row in cursor.fetchall():
                book = RecentBook(
                    id=row[0],
                    file_path=row[1],
                    file_name=row[2],
                    title=row[3],
                    total_pages=row[4],
                    pages_read=row[5],
                    reading_percentage=row[6],
                    file_size=row[7],
                    date_added=datetime.fromisoformat(row[8]),
                    last_opened=datetime.fromisoformat(row[9]),
                    thumbnail_path=row[10],
                    is_starred=bool(row[11]) if len(row) > 11 else False,
                    priority=row[12] if len(row) > 12 else 0,
                    notes=row[13] if len(row) > 13 else "",
                    display_name=row[14] if len(row) > 14 else "",
                    category=row[15] if len(row) > 15 else "",
                    cover_image_path=row[16] if len(row) > 16 else "",
                    reading_status=row[17] if len(row) > 17 else "reading"
                )
                books.append(book)

            conn.close()
            return books

        except Exception as e:
            print(f"Error getting books by status: {e}")
            return []

    def export_books_data(self, export_path: str) -> bool:
        """Export all books data to JSON file"""
        try:
            books = self.get_books()
            export_data = {
                "export_date": datetime.now().isoformat(),
                "total_books": len(books),
                "books": []
            }

            for book in books:
                book_data = {
                    "file_path": book.file_path,
                    "file_name": book.file_name,
                    "title": book.title,
                    "total_pages": book.total_pages,
                    "pages_read": book.pages_read,
                    "reading_percentage": book.reading_percentage,
                    "file_size": book.file_size,
                    "date_added": book.date_added.isoformat(),
                    "last_opened": book.last_opened.isoformat(),
                    "thumbnail_path": book.thumbnail_path,
                    "is_starred": book.is_starred,
                    "priority": book.priority,
                    "notes": book.notes,
                    "display_name": book.display_name,
                    "category": book.category,
                    "cover_image_path": book.cover_image_path,
                    "reading_status": book.reading_status
                }
                export_data["books"].append(book_data)

            # Export reading sessions
            export_data["reading_sessions"] = []
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()

            cursor.execute('SELECT * FROM reading_sessions ORDER BY session_date DESC')
            for row in cursor.fetchall():
                session_data = {
                    "file_path": row[1],
                    "session_date": row[2],
                    "pages_read": row[3],
                    "reading_time_minutes": row[4]
                }
                export_data["reading_sessions"].append(session_data)

            conn.close()

            # Write to file
            import json
            with open(export_path, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, indent=2, ensure_ascii=False)

            return True

        except Exception as e:
            print(f"Error exporting books data: {e}")
            return False

    def import_books_data(self, import_path: str, merge: bool = True) -> bool:
        """Import books data from JSON file"""
        try:
            import json

            with open(import_path, 'r', encoding='utf-8') as f:
                import_data = json.load(f)

            if not merge:
                # Clear existing data
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                cursor.execute('DELETE FROM recent_books')
                cursor.execute('DELETE FROM reading_sessions')
                conn.commit()
                conn.close()

            # Import books
            for book_data in import_data.get("books", []):
                book = RecentBook(
                    file_path=book_data["file_path"],
                    file_name=book_data["file_name"],
                    title=book_data["title"],
                    total_pages=book_data["total_pages"],
                    pages_read=book_data["pages_read"],
                    reading_percentage=book_data["reading_percentage"],
                    file_size=book_data["file_size"],
                    date_added=datetime.fromisoformat(book_data["date_added"]),
                    last_opened=datetime.fromisoformat(book_data["last_opened"]),
                    thumbnail_path=book_data.get("thumbnail_path", ""),
                    is_starred=book_data.get("is_starred", False),
                    priority=book_data.get("priority", 0),
                    notes=book_data.get("notes", ""),
                    display_name=book_data.get("display_name", ""),
                    category=book_data.get("category", ""),
                    cover_image_path=book_data.get("cover_image_path", ""),
                    reading_status=book_data.get("reading_status", "reading")
                )
                self.save_book(book)

            # Import reading sessions
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()

            for session_data in import_data.get("reading_sessions", []):
                cursor.execute('''
                    INSERT OR REPLACE INTO reading_sessions
                    (file_path, session_date, pages_read, reading_time_minutes)
                    VALUES (?, ?, ?, ?)
                ''', (
                    session_data["file_path"],
                    session_data["session_date"],
                    session_data["pages_read"],
                    session_data.get("reading_time_minutes", 0)
                ))

            conn.commit()
            conn.close()

            return True

        except Exception as e:
            print(f"Error importing books data: {e}")
            return False

    # Reading Speed Configuration Methods
    def save_reading_speed_config(self, file_path: str, total_pages: int, avg_words_per_page: float,
                                 words_per_page_list: List[int] = None, sample_text: str = "",
                                 preparation_method: str = "auto") -> bool:
        """Save reading speed configuration for a book with enhanced error handling"""
        conn = None
        try:
            # Validate input parameters
            if not file_path or not isinstance(total_pages, int) or total_pages <= 0:
                print(f"Invalid parameters for reading speed config: file_path={file_path}, total_pages={total_pages}")
                return False

            if not isinstance(avg_words_per_page, (int, float)) or avg_words_per_page <= 0:
                print(f"Invalid avg_words_per_page: {avg_words_per_page}")
                return False

            conn = sqlite3.connect(self.db_path, timeout=30.0)
            conn.execute('BEGIN IMMEDIATE')  # Start transaction with immediate lock
            cursor = conn.cursor()

            current_time = datetime.now().isoformat()
            words_per_page_json = json.dumps(words_per_page_list) if words_per_page_list else ""

            # Check if configuration already exists
            cursor.execute('SELECT id FROM reading_speed_configs WHERE file_path = ?', (file_path,))
            existing = cursor.fetchone()

            if existing:
                # Update existing configuration
                cursor.execute('''
                    UPDATE reading_speed_configs
                    SET total_pages = ?, avg_words_per_page = ?, words_per_page_list = ?,
                        sample_text = ?, analysis_date = ?, preparation_method = ?,
                        is_prepared = ?, updated_at = ?
                    WHERE file_path = ?
                ''', (total_pages, avg_words_per_page, words_per_page_json,
                      sample_text[:500], time.time(), preparation_method, True, current_time, file_path))
            else:
                # Insert new configuration
                cursor.execute('''
                    INSERT INTO reading_speed_configs
                    (file_path, total_pages, avg_words_per_page, words_per_page_list,
                     sample_text, analysis_date, preparation_method, is_prepared,
                     created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (file_path, total_pages, avg_words_per_page, words_per_page_json,
                      sample_text[:500], time.time(), preparation_method, True,
                      current_time, current_time))

            conn.commit()
            return True

        except sqlite3.Error as e:
            print(f"Database error saving reading speed config: {e}")
            if conn:
                conn.rollback()
            return False
        except Exception as e:
            print(f"Unexpected error saving reading speed config: {e}")
            if conn:
                conn.rollback()
            return False
        finally:
            if conn:
                conn.close()

    def get_reading_speed_config(self, file_path: str) -> Optional[Dict]:
        """Get reading speed configuration for a book with enhanced error handling"""
        self.ensure_initialized()  # Lazy database initialization
        conn = None
        try:
            if not file_path:
                print("Invalid file_path provided to get_reading_speed_config")
                return None

            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()

            cursor.execute('''
                SELECT total_pages, avg_words_per_page, words_per_page_list,
                       sample_text, analysis_date, preparation_method, is_prepared,
                       created_at, updated_at
                FROM reading_speed_configs
                WHERE file_path = ?
            ''', (file_path,))

            result = cursor.fetchone()

            if result:
                words_per_page_list = []
                try:
                    if result[2]:  # words_per_page_list
                        words_per_page_list = json.loads(result[2])
                except (json.JSONDecodeError, TypeError) as e:
                    print(f"Error parsing words_per_page_list for {file_path}: {e}")
                    words_per_page_list = []

                return {
                    'total_pages': result[0],
                    'avg_words_per_page': result[1],
                    'words_per_page_list': words_per_page_list,
                    'sample_text': result[3] or '',
                    'analysis_date': result[4],
                    'preparation_method': result[5] or 'auto',
                    'is_prepared': bool(result[6]),
                    'created_at': result[7] or '',
                    'updated_at': result[8] or ''
                }

            return None

        except sqlite3.Error as e:
            print(f"Database error getting reading speed config for {file_path}: {e}")
            return None
        except Exception as e:
            print(f"Unexpected error getting reading speed config for {file_path}: {e}")
            return None
        finally:
            if conn:
                conn.close()

    def get_all_prepared_books(self) -> List[Dict]:
        """Get all books with reading speed configurations"""
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()

            cursor.execute('''
                SELECT rsc.file_path, rsc.total_pages, rsc.avg_words_per_page,
                       rsc.preparation_method, rsc.is_prepared, rsc.created_at,
                       rb.file_name, rb.title, rb.display_name
                FROM reading_speed_configs rsc
                LEFT JOIN recent_books rb ON rsc.file_path = rb.file_path
                WHERE rsc.is_prepared = 1
                ORDER BY rsc.updated_at DESC
            ''')

            results = cursor.fetchall()
            conn.close()

            prepared_books = []
            for row in results:
                # Get reading statistics for this book
                stats = self.get_reading_statistics(row[0])

                prepared_books.append({
                    'file_path': row[0],
                    'total_pages': row[1],
                    'avg_words_per_page': row[2],
                    'preparation_method': row[3],
                    'is_prepared': bool(row[4]),
                    'created_at': row[5],
                    'file_name': row[6] or os.path.basename(row[0]),
                    'title': row[7] or os.path.basename(row[0]).replace('.pdf', ''),
                    'display_name': row[8] or row[7] or os.path.basename(row[0]).replace('.pdf', ''),
                    'statistics': stats
                })

            return prepared_books

        except Exception as e:
            print(f"Error getting prepared books: {e}")
            return []

    def delete_reading_speed_config(self, file_path: str) -> bool:
        """Delete reading speed configuration for a book"""
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()

            cursor.execute('DELETE FROM reading_speed_configs WHERE file_path = ?', (file_path,))

            conn.commit()
            conn.close()
            return True

        except Exception as e:
            print(f"Error deleting reading speed config: {e}")
            return False

    def is_book_prepared_for_reading_speed(self, file_path: str) -> bool:
        """Check if a book is already prepared for reading speed measurement"""
        config = self.get_reading_speed_config(file_path)
        return config is not None and config.get('is_prepared', False)

    def verify_reading_speed_data_integrity(self) -> Dict[str, any]:
        """Verify the integrity of reading speed data and return a report"""
        report = {
            'total_configs': 0,
            'valid_configs': 0,
            'invalid_configs': 0,
            'orphaned_configs': 0,  # Configs for files that no longer exist
            'errors': []
        }

        conn = None
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()

            # Get all reading speed configurations
            cursor.execute('SELECT file_path, total_pages, avg_words_per_page FROM reading_speed_configs')
            configs = cursor.fetchall()

            report['total_configs'] = len(configs)

            for file_path, total_pages, avg_words_per_page in configs:
                try:
                    # Check if file exists
                    if not os.path.exists(file_path):
                        report['orphaned_configs'] += 1
                        report['errors'].append(f"File not found: {file_path}")
                        continue

                    # Validate data
                    if not isinstance(total_pages, int) or total_pages <= 0:
                        report['invalid_configs'] += 1
                        report['errors'].append(f"Invalid total_pages for {file_path}: {total_pages}")
                        continue

                    if not isinstance(avg_words_per_page, (int, float)) or avg_words_per_page <= 0:
                        report['invalid_configs'] += 1
                        report['errors'].append(f"Invalid avg_words_per_page for {file_path}: {avg_words_per_page}")
                        continue

                    report['valid_configs'] += 1

                except Exception as e:
                    report['invalid_configs'] += 1
                    report['errors'].append(f"Error validating {file_path}: {e}")

        except Exception as e:
            report['errors'].append(f"Database error during integrity check: {e}")
        finally:
            if conn:
                conn.close()

        return report

    def cleanup_orphaned_reading_speed_configs(self) -> int:
        """Remove reading speed configurations for files that no longer exist"""
        removed_count = 0
        conn = None

        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            conn.execute('BEGIN IMMEDIATE')
            cursor = conn.cursor()

            # Get all file paths
            cursor.execute('SELECT file_path FROM reading_speed_configs')
            file_paths = [row[0] for row in cursor.fetchall()]

            for file_path in file_paths:
                if not os.path.exists(file_path):
                    cursor.execute('DELETE FROM reading_speed_configs WHERE file_path = ?', (file_path,))
                    removed_count += 1
                    print(f"Removed orphaned config for: {file_path}")

            conn.commit()

        except Exception as e:
            print(f"Error cleaning up orphaned configs: {e}")
            if conn:
                conn.rollback()
        finally:
            if conn:
                conn.close()

        return removed_count

    def save_training_session(self, session_data: dict) -> bool:
        """Save a training session for later resume"""
        conn = None
        try:
            print(f"\n🔵 DEBUG: recent_books_manager.save_training_session() called")
            print(f"   Database path: {self.db_path}")
            print(f"   Session data keys: {list(session_data.keys())}")

            # Check if database file exists
            import os
            db_exists = os.path.exists(self.db_path)
            print(f"   Database file exists: {db_exists}")

            # Ensure database directory exists
            db_dir = os.path.dirname(self.db_path)
            if not os.path.exists(db_dir):
                print(f"   Creating database directory: {db_dir}")
                os.makedirs(db_dir, exist_ok=True)

            print(f"   Connecting to database...")
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            print(f"   ✅ Connected successfully")

            # Create training_sessions table if it doesn't exist
            print(f"   Creating/verifying training_sessions table...")
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS training_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_path TEXT NOT NULL,
                    file_name TEXT NOT NULL,
                    current_word_index INTEGER NOT NULL,
                    total_words INTEGER NOT NULL,
                    progress_percentage REAL NOT NULL,
                    wpm_setting INTEGER NOT NULL,
                    wpg_setting INTEGER NOT NULL,
                    font_family TEXT NOT NULL,
                    font_size INTEGER NOT NULL,
                    session_time TEXT NOT NULL,
                    last_updated TEXT NOT NULL,
                    UNIQUE(file_path, current_word_index)
                )
            ''')
            print(f"   ✅ Table created/verified")

            # Insert or replace session
            print(f"   Inserting session data...")
            print(f"      File: {session_data['file_name']}")
            print(f"      Word index: {session_data['current_word_index']}/{session_data['total_words']}")
            print(f"      Progress: {session_data['progress_percentage']:.1f}%")

            cursor.execute('''
                INSERT OR REPLACE INTO training_sessions
                (file_path, file_name, current_word_index, total_words, progress_percentage,
                 wpm_setting, wpg_setting, font_family, font_size, session_time, last_updated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                session_data['file_path'],
                session_data['file_name'],
                session_data['current_word_index'],
                session_data['total_words'],
                session_data['progress_percentage'],
                session_data['wpm_setting'],
                session_data['wpg_setting'],
                session_data['font_family'],
                session_data['font_size'],
                session_data['session_time'],
                session_data['last_updated']
            ))

            print(f"   ✅ INSERT executed, rows affected: {cursor.rowcount}")

            conn.commit()
            print(f"   ✅ COMMIT successful")

            # Verify the data was saved
            cursor.execute('SELECT COUNT(*) FROM training_sessions')
            count = cursor.fetchone()[0]
            print(f"   ✅ Total sessions in database: {count}")

            print(f"✅ Session saved successfully!\n")
            return True

        except Exception as e:
            print(f"\n❌ ERROR in save_training_session(): {e}")
            import traceback
            traceback.print_exc()
            print()
            return False
        finally:
            if conn:
                conn.close()

    def get_training_sessions(self) -> List[dict]:
        """Get all saved training sessions"""
        conn = None
        try:
            print(f"DEBUG: Getting sessions from database: {self.db_path}")
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Create table if it doesn't exist
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS training_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_path TEXT NOT NULL,
                    file_name TEXT NOT NULL,
                    current_word_index INTEGER NOT NULL,
                    total_words INTEGER NOT NULL,
                    progress_percentage REAL NOT NULL,
                    wpm_setting INTEGER NOT NULL,
                    wpg_setting INTEGER NOT NULL,
                    font_family TEXT NOT NULL,
                    font_size INTEGER NOT NULL,
                    session_time TEXT NOT NULL,
                    last_updated TEXT NOT NULL,
                    UNIQUE(file_path, current_word_index)
                )
            ''')

            cursor.execute('''
                SELECT file_path, file_name, current_word_index, total_words, progress_percentage,
                       wpm_setting, wpg_setting, font_family, font_size, session_time, last_updated
                FROM training_sessions
                ORDER BY last_updated DESC
            ''')

            sessions = []
            rows = cursor.fetchall()
            print(f"DEBUG: Found {len(rows)} rows in database")

            for row in rows:
                session = {
                    'file_path': row[0],
                    'file_name': row[1],
                    'current_word_index': row[2],
                    'total_words': row[3],
                    'progress_percentage': row[4],
                    'wpm_setting': row[5],
                    'wpg_setting': row[6],
                    'font_family': row[7],
                    'font_size': row[8],
                    'session_time': row[9],
                    'last_updated': row[10]
                }
                sessions.append(session)
                print(f"DEBUG: Session: {session['file_name']} - {session['progress_percentage']:.1f}%")

            print(f"DEBUG: Returning {len(sessions)} sessions")
            return sessions

        except Exception as e:
            print(f"Error getting training sessions: {e}")
            return []
        finally:
            if conn:
                conn.close()

    def delete_training_session(self, file_path: str, word_index: int) -> bool:
        """Delete a specific training session"""
        conn = None
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute('''
                DELETE FROM training_sessions
                WHERE file_path = ? AND current_word_index = ?
            ''', (file_path, word_index))

            conn.commit()
            return cursor.rowcount > 0

        except Exception as e:
            print(f"Error deleting training session: {e}")
            return False
        finally:
            if conn:
                conn.close()

    def clear_completed_sessions(self) -> int:
        """Clear all completed training sessions (100% progress)"""
        conn = None
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute('''
                DELETE FROM training_sessions
                WHERE progress_percentage >= 100.0
            ''')

            conn.commit()
            return cursor.rowcount

        except Exception as e:
            print(f"Error clearing completed sessions: {e}")
            return 0
        finally:
            if conn:
                conn.close()
