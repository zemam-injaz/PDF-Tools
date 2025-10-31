import os
import sqlite3
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import fitz  # PyMuPDF

# Import app paths utility
try:
    from app_paths import get_database_path
except ImportError:
    # Fallback if app_paths is not available
    def get_database_path(db_name):
        return db_name


@dataclass
class PDFReadingProgress:
    """Data class for PDF reading progress"""
    file_path: str
    file_name: str
    page_count: int
    total_annotations: int
    reading_intensity_score: float
    last_modified: datetime
    last_scanned: datetime
    file_size: int
    annotations_by_type: Dict[str, int]
    estimated_reading_time: int


class EnhancedPDFAnalyzer:
    """Enhanced PDF analyzer for tracking reading progress and comments with lazy initialization"""

    def __init__(self, db_path: str = None):
        # Use app data directory for database
        if db_path is None:
            self.db_path = get_database_path("pdf_reading_progress.db")
        else:
            self.db_path = db_path

        # Defer database initialization for faster startup
        self._db_initialized = False
        print(f"📊 PDF Comments Analyzer initialized (database will be loaded on first use)")
        print(f"   Database path: {self.db_path}")

    def ensure_initialized(self):
        """Ensure database is initialized (lazy initialization)"""
        if not self._db_initialized:
            print(f"📦 Initializing PDF Comments database...")
            self.init_database()
            self._db_initialized = True
            print(f"✅ PDF Comments database initialized")
    
    def init_database(self):
        """Initialize the SQLite database"""
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        cursor = conn.cursor()

        # Drop existing table if it has wrong schema
        cursor.execute("DROP TABLE IF EXISTS pdf_progress")

        # Create tables with correct schema
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS pdf_progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT UNIQUE NOT NULL,
                file_name TEXT NOT NULL,
                page_count INTEGER,
                total_annotations INTEGER DEFAULT 0,
                reading_intensity_score REAL DEFAULT 0.0,
                last_modified TEXT,
                last_scanned TEXT,
                file_size INTEGER,
                annotations_by_type TEXT,
                estimated_reading_time INTEGER DEFAULT 0
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS pdf_annotations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                page_number INTEGER,
                annotation_type TEXT,
                content TEXT,
                created_date TEXT,
                FOREIGN KEY (file_path) REFERENCES pdf_progress (file_path)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS study_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                session_date TEXT,
                annotations_made INTEGER DEFAULT 0,
                FOREIGN KEY (file_path) REFERENCES pdf_progress (file_path)
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def scan_directory(self, directory_path: str, recursive: bool = True, progress_callback=None) -> Tuple[List[str], List[str]]:
        """Scan directory for PDF files and analyze them"""
        self.ensure_initialized()  # Lazy database initialization
        successful = []
        failed = []
        
        pdf_files = []
        if recursive:
            for root, dirs, files in os.walk(directory_path):
                for file in files:
                    if file.lower().endswith('.pdf'):
                        pdf_files.append(os.path.join(root, file))
        else:
            for file in os.listdir(directory_path):
                if file.lower().endswith('.pdf'):
                    pdf_files.append(os.path.join(directory_path, file))
        
        total_files = len(pdf_files)
        
        for i, pdf_path in enumerate(pdf_files):
            if progress_callback:
                progress_callback(i + 1, total_files, os.path.basename(pdf_path))
            
            try:
                self.analyze_pdf(pdf_path)
                successful.append(pdf_path)
            except Exception as e:
                print(f"Failed to analyze {pdf_path}: {e}")
                failed.append(pdf_path)
        
        return successful, failed
    
    def analyze_pdf(self, file_path: str) -> PDFReadingProgress:
        """Analyze a single PDF file"""
        self.ensure_initialized()  # Lazy database initialization
        try:
            doc = fitz.open(file_path)
            
            # Basic file info
            file_name = os.path.basename(file_path)
            page_count = len(doc)
            file_size = os.path.getsize(file_path)
            last_modified = datetime.fromtimestamp(os.path.getmtime(file_path))
            
            # Analyze annotations
            total_annotations = 0
            annotations_by_type = {}
            
            for page_num in range(page_count):
                page = doc[page_num]
                annotations = page.annots()
                
                for annot in annotations:
                    total_annotations += 1
                    annot_type = annot.type[1]  # Get annotation type name
                    annotations_by_type[annot_type] = annotations_by_type.get(annot_type, 0) + 1
            
            # Calculate reading intensity (simple formula)
            reading_intensity = min(total_annotations / max(page_count, 1) * 10, 10.0)
            
            # Estimate reading time (rough calculation)
            estimated_reading_time = page_count * 2  # 2 minutes per page
            
            doc.close()
            
            # Save to database
            progress = PDFReadingProgress(
                file_path=file_path,
                file_name=file_name,
                page_count=page_count,
                total_annotations=total_annotations,
                reading_intensity_score=reading_intensity,
                last_modified=last_modified,
                last_scanned=datetime.now(),
                file_size=file_size,
                annotations_by_type=annotations_by_type,
                estimated_reading_time=estimated_reading_time
            )
            
            self.save_pdf_progress(progress)
            return progress
            
        except Exception as e:
            raise Exception(f"Error analyzing PDF {file_path}: {e}")
    
    def save_pdf_progress(self, progress: PDFReadingProgress):
        """Save PDF progress to database"""
        self.ensure_initialized()  # Lazy database initialization
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        cursor = conn.cursor()

        cursor.execute('''
            INSERT OR REPLACE INTO pdf_progress
            (file_path, file_name, page_count, total_annotations, reading_intensity_score,
             last_modified, last_scanned, file_size, annotations_by_type, estimated_reading_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            progress.file_path,
            progress.file_name,
            progress.page_count,
            progress.total_annotations,
            progress.reading_intensity_score,
            progress.last_modified.isoformat(),
            progress.last_scanned.isoformat(),
            progress.file_size,
            json.dumps(progress.annotations_by_type),
            progress.estimated_reading_time
        ))

        conn.commit()
        conn.close()
    
    def get_pdf_list(self, filter_annotated: bool = False, sort_by: str = "last_scanned") -> List[Dict[str, Any]]:
        """Get list of PDFs from database"""
        self.ensure_initialized()  # Lazy database initialization
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        cursor = conn.cursor()

        query = "SELECT * FROM pdf_progress"
        if filter_annotated:
            query += " WHERE total_annotations > 0"

        query += f" ORDER BY {sort_by} DESC"

        cursor.execute(query)
        rows = cursor.fetchall()
        
        pdf_list = []
        for row in rows:
            pdf_data = {
                'file_path': row[1],
                'file_name': row[2],
                'page_count': row[3],
                'total_annotations': row[4],
                'reading_intensity_score': row[5],
                'last_modified': row[6],
                'last_scanned': row[7],
                'file_size': row[8],
                'annotations_by_type': json.loads(row[9]) if row[9] else {},
                'estimated_reading_time': row[10]
            }
            pdf_list.append(pdf_data)
        
        conn.close()
        return pdf_list
    
    def get_reading_statistics(self) -> Dict[str, Any]:
        """Get reading statistics"""
        self.ensure_initialized()  # Lazy database initialization
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM pdf_progress")
        total_pdfs = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM pdf_progress WHERE total_annotations > 0")
        pdfs_with_annotations = cursor.fetchone()[0]
        
        cursor.execute("SELECT SUM(total_annotations) FROM pdf_progress")
        total_annotations = cursor.fetchone()[0] or 0
        
        cursor.execute("SELECT AVG(reading_intensity_score) FROM pdf_progress")
        avg_intensity = cursor.fetchone()[0] or 0.0
        
        conn.close()
        
        return {
            'total_pdfs': total_pdfs,
            'pdfs_with_annotations': pdfs_with_annotations,
            'total_annotations': total_annotations,
            'average_intensity': avg_intensity
        }
    
    def get_study_timeline(self, days: int = 30) -> Dict[str, Any]:
        """Get study timeline for the last N days"""
        # Simple implementation - in a real app this would be more sophisticated
        return {
            'timeline': [],
            'total_days_active': 0,
            'period_days': days
        }
    
    def export_annotations_to_markdown(self, file_path: str) -> str:
        """Export annotations to markdown format"""
        try:
            doc = fitz.open(file_path)
            content = f"# Annotations for {os.path.basename(file_path)}\n\n"
            content += f"**File:** {file_path}\n"
            content += f"**Export Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
            
            for page_num in range(len(doc)):
                page = doc[page_num]
                annotations = page.annots()
                
                if annotations:
                    content += f"## Page {page_num + 1}\n\n"
                    
                    for annot in annotations:
                        annot_content = annot.info.get("content", "")
                        if annot_content:
                            content += f"- **{annot.type[1]}:** {annot_content}\n"
                    
                    content += "\n"
            
            doc.close()
            return content if "Page" in content else ""
            
        except Exception as e:
            raise Exception(f"Error exporting annotations: {e}")
