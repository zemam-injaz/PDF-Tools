"""Book Library Service - SQLite-based book management with thumbnails"""
import os
import sqlite3
import base64
from datetime import datetime
from typing import List, Optional, Dict, Any
import fitz  # PyMuPDF

# Database path - stored in user's app data
DB_DIR = os.path.join(os.path.expanduser("~"), ".pdf-tools")
DB_PATH = os.path.join(DB_DIR, "library.db")
THUMBNAILS_DIR = os.path.join(DB_DIR, "thumbnails")


def get_db_connection():
    """Get database connection, creating database if needed"""
    os.makedirs(DB_DIR, exist_ok=True)
    os.makedirs(THUMBNAILS_DIR, exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_database():
    """Initialize the database schema"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            total_pages INTEGER DEFAULT 0,
            pages_read INTEGER DEFAULT 0,
            reading_percentage REAL DEFAULT 0,
            thumbnail_path TEXT,
            is_starred INTEGER DEFAULT 0,
            priority TEXT DEFAULT 'Medium',
            category TEXT DEFAULT 'غير مصنف',
            notes TEXT DEFAULT '',
            file_size INTEGER DEFAULT 0,
            date_added TEXT NOT NULL,
            last_opened TEXT,
            status TEXT DEFAULT 'To Read'
        )
    """)
    
    conn.commit()
    
    # Run migrations
    try:
        _migrate_database(conn)
    except Exception as e:
        print(f"Migration warning: {e}")
    
    conn.commit()
    conn.close()


def _migrate_database(conn):
    """Run simple migrations for schema updates"""
    cursor = conn.cursor()
    
    # Check for 'status' column (Added in v0.3.0)
    try:
        cursor.execute("SELECT status FROM books LIMIT 1")
    except sqlite3.OperationalError:
        # Column missing, add it
        print("Migrating database: Adding 'status' column...")
        cursor.execute("ALTER TABLE books ADD COLUMN status TEXT DEFAULT 'To Read'")


# Initialize on import
init_database()


def generate_thumbnail(pdf_path: str, book_id: int) -> Optional[str]:
    """Generate thumbnail from first page of PDF"""
    try:
        doc = fitz.open(pdf_path)
        if doc.page_count == 0:
            doc.close()
            return None
        
        page = doc[0]
        # Render at 150 DPI for a nice thumbnail
        mat = fitz.Matrix(150/72, 150/72)
        pix = page.get_pixmap(matrix=mat)
        
        # Scale down if too large
        max_width = 300
        if pix.width > max_width:
            scale = max_width / pix.width
            mat = fitz.Matrix(scale, scale)
            pix = page.get_pixmap(matrix=fitz.Matrix(150/72, 150/72) * mat)
        
        thumbnail_filename = f"thumb_{book_id}.png"
        thumbnail_path = os.path.join(THUMBNAILS_DIR, thumbnail_filename)
        pix.save(thumbnail_path)
        
        doc.close()
        return thumbnail_path
    except Exception as e:
        print(f"Error generating thumbnail: {e}")
        return None


def get_thumbnail_base64(thumbnail_path: Optional[str]) -> Optional[str]:
    """Convert thumbnail file to base64 string"""
    if not thumbnail_path or not os.path.exists(thumbnail_path):
        return None
    try:
        with open(thumbnail_path, "rb") as f:
            return f"data:image/png;base64,{base64.b64encode(f.read()).decode()}"
    except Exception:
        return None


class BookLibraryService:
    """Service for managing book library with SQLite"""
    
    @staticmethod
    def add_book(file_path: str) -> Dict[str, Any]:
        """Add a book to the library"""
        # Normalize path
        file_path = os.path.normpath(file_path)
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if already exists
        cursor.execute("SELECT id FROM books WHERE file_path = ?", (file_path,))
        existing = cursor.fetchone()
        if existing:
            conn.close()
            raise ValueError("Book already exists in library")
        
        # Get PDF info
        try:
            doc = fitz.open(file_path)
            total_pages = doc.page_count
            # Try to get title from metadata, fallback to filename
            title = doc.metadata.get("title", "")
            if not title or title.strip() == "":
                title = os.path.splitext(os.path.basename(file_path))[0]
            doc.close()
        except Exception as e:
            raise ValueError(f"Cannot open PDF: {e}")
        
        # Get file size
        file_size = os.path.getsize(file_path)
        date_added = datetime.now().isoformat()
        
        # Insert book
        cursor.execute("""
            INSERT INTO books (file_path, title, total_pages, file_size, date_added)
            VALUES (?, ?, ?, ?, ?)
        """, (file_path, title, total_pages, file_size, date_added))
        
        book_id = cursor.lastrowid
        conn.commit()
        
        # Generate thumbnail
        thumbnail_path = generate_thumbnail(file_path, book_id)
        if thumbnail_path:
            cursor.execute("UPDATE books SET thumbnail_path = ? WHERE id = ?", (thumbnail_path, book_id))
            conn.commit()
        
        # Fetch and return the book
        cursor.execute("SELECT * FROM books WHERE id = ?", (book_id,))
        row = cursor.fetchone()
        conn.close()
        
        return BookLibraryService._row_to_dict(row)
    
    @staticmethod
    def add_books(file_paths: List[str]) -> Dict[str, Any]:
        """Add multiple books to the library"""
        added = []
        skipped = []
        errors = []
        
        for path in file_paths:
            try:
                book = BookLibraryService.add_book(path)
                added.append(book)
            except ValueError as e:
                if "already exists" in str(e):
                    skipped.append(path)
                else:
                    errors.append({"path": path, "error": str(e)})
            except Exception as e:
                errors.append({"path": path, "error": str(e)})
        
        return {
            "added": added,
            "skipped": skipped,
            "errors": errors,
            "added_count": len(added),
            "skipped_count": len(skipped),
            "error_count": len(errors)
        }
    
    @staticmethod
    def get_all_books(
        sort_by: str = "date_added",
        order: str = "desc",
        category: Optional[str] = None,
        starred_only: bool = False
    ) -> List[Dict[str, Any]]:
        """Get all books with optional filtering and sorting"""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = "SELECT * FROM books WHERE 1=1"
        params = []
        
        if starred_only:
            query += " AND is_starred = 1"
        
        if category and category != "all":
            query += " AND category = ?"
            params.append(category)
        
        # Validate sort column
        valid_sorts = ["date_added", "title", "reading_percentage", "priority", "last_opened"]
        if sort_by not in valid_sorts:
            sort_by = "date_added"
        
        # Handle priority sorting specially
        if sort_by == "priority":
            query += " ORDER BY CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Low' THEN 3 END"
        else:
            query += f" ORDER BY {sort_by}"
        
        if order.lower() == "desc":
            query += " DESC"
        else:
            query += " ASC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        return [BookLibraryService._row_to_dict(row) for row in rows]
    
    @staticmethod
    def get_book(book_id: int) -> Optional[Dict[str, Any]]:
        """Get a single book by ID"""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM books WHERE id = ?", (book_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return BookLibraryService._row_to_dict(row)
        return None
    
    @staticmethod
    def update_book(book_id: int, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update book metadata"""
        allowed_fields = ["title", "pages_read", "is_starred", "priority", "category", "notes", "status"]
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        set_clauses = []
        params = []
        
        for field, value in updates.items():
            if field in allowed_fields:
                set_clauses.append(f"{field} = ?")
                params.append(value)
        
        # Recalculate reading percentage if pages_read is updated
        if "pages_read" in updates:
            cursor.execute("SELECT total_pages FROM books WHERE id = ?", (book_id,))
            row = cursor.fetchone()
            if row and row["total_pages"] > 0:
                percentage = (updates["pages_read"] / row["total_pages"]) * 100
                set_clauses.append("reading_percentage = ?")
                params.append(percentage)
        
        if set_clauses:
            query = f"UPDATE books SET {', '.join(set_clauses)} WHERE id = ?"
            params.append(book_id)
            cursor.execute(query, params)
            conn.commit()
        
        conn.close()
        
        return BookLibraryService.get_book(book_id)
    
    @staticmethod
    def toggle_star(book_id: int) -> Dict[str, Any]:
        """Toggle the starred status of a book"""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("UPDATE books SET is_starred = 1 - is_starred WHERE id = ?", (book_id,))
        conn.commit()
        
        cursor.execute("SELECT is_starred FROM books WHERE id = ?", (book_id,))
        row = cursor.fetchone()
        conn.close()
        
        return {"is_starred": bool(row["is_starred"])} if row else {}
    
    @staticmethod
    def update_last_opened(book_id: int) -> None:
        """Update the last opened timestamp"""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE books SET last_opened = ? WHERE id = ?",
            (datetime.now().isoformat(), book_id)
        )
        conn.commit()
        conn.close()
    
    @staticmethod
    def delete_book(book_id: int) -> bool:
        """Delete a book from the library"""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get thumbnail path to delete
        cursor.execute("SELECT thumbnail_path FROM books WHERE id = ?", (book_id,))
        row = cursor.fetchone()
        if row and row["thumbnail_path"]:
            try:
                os.remove(row["thumbnail_path"])
            except Exception:
                pass
        
        cursor.execute("DELETE FROM books WHERE id = ?", (book_id,))
        deleted = cursor.rowcount > 0
        conn.commit()
        conn.close()
        
        return deleted
    
    @staticmethod
    def get_categories() -> List[str]:
        """Get all unique categories"""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT category FROM books ORDER BY category")
        rows = cursor.fetchall()
        conn.close()
        
        return [row["category"] for row in rows]
    
    @staticmethod
    def search_books(query: str) -> List[Dict[str, Any]]:
        """Search books by title"""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM books WHERE title LIKE ? ORDER BY date_added DESC",
            (f"%{query}%",)
        )
        rows = cursor.fetchall()
        conn.close()
        
        return [BookLibraryService._row_to_dict(row) for row in rows]
    
    @staticmethod
    def _row_to_dict(row) -> Dict[str, Any]:
        """Convert database row to dictionary with thumbnail base64"""
        return {
            "id": row["id"],
            "file_path": row["file_path"],
            "title": row["title"],
            "total_pages": row["total_pages"],
            "pages_read": row["pages_read"],
            "reading_percentage": row["reading_percentage"],
            "thumbnail_base64": get_thumbnail_base64(row["thumbnail_path"]),
            "is_starred": bool(row["is_starred"]),
            "priority": row["priority"],
            "category": row["category"],
            "notes": row["notes"],
            "file_size": row["file_size"],
            "date_added": row["date_added"],
            "last_opened": row["last_opened"],
            "status": row["status"] if "status" in getattr(row, "keys", lambda: [])() else "To Read"
        }
