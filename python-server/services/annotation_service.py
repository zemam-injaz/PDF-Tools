import fitz
import os
import sqlite3
import json
from contextlib import closing
from datetime import datetime
from typing import List, Dict, Any, Optional
from models.annotation import Annotation

# Database path
DB_DIR = os.path.join(os.path.expanduser("~"), ".pdf-tools")
DB_PATH = os.path.join(DB_DIR, "pdf_reading_progress.db")

def get_db_connection():
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    return conn

def init_annotation_table():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS annotations (
            id TEXT PRIMARY KEY,
            book_id TEXT NOT NULL,
            page INTEGER NOT NULL,
            type TEXT NOT NULL,
            x REAL NOT NULL,
            y REAL NOT NULL,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    ''')
    
    # Index for faster lookup by book
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_annotations_book ON annotations(book_id)')
    
    conn.commit()
    conn.close()

# Initialize on import
init_annotation_table()

class AnnotationService:
    """Service for extracting, storing, and managing PDF annotations"""

    @staticmethod
    def sync_native_annotations(book_id: str, pdf_path: str, document_uid: str) -> int:
        """Mirror saved PDF annotations into Matn without touching legacy app notes.

        Geometry in pdf_rects is in PyMuPDF's unrotated PDF point space; rects
        remains normalized display geometry for older React annotation views.
        """
        if not os.path.isfile(pdf_path):
            raise FileNotFoundError(pdf_path)
        records = []
        kind_map = {"Highlight": "highlight", "Underline": "underline", "Text": "note"}
        with fitz.open(pdf_path) as doc:
            for page_number, page in enumerate(doc):
                width, height = page.rect.width, page.rect.height
                if not width or not height:
                    continue
                for annot in page.annots() or []:
                    vertices = annot.vertices or []
                    raw_rects = []
                    if annot.type[1] in ("Highlight", "Underline", "StrikeOut", "Squiggly"):
                        for index in range(0, len(vertices) - 3, 4):
                            points = [fitz.Point(vertex) for vertex in vertices[index:index + 4]]
                            raw_rects.append(fitz.Rect(
                                min(point.x for point in points), min(point.y for point in points),
                                max(point.x for point in points), max(point.y for point in points),
                            ))
                    if not raw_rects:
                        raw_rects = [annot.rect]
                    shown_rects = [rect * page.rotation_matrix for rect in raw_rects]
                    shown = shown_rects[0]
                    color = (annot.colors or {}).get("stroke")
                    color_hex = "#%02x%02x%02x" % tuple(
                        round(max(0, min(1, c)) * 255) for c in (color if color and len(color) == 3 else (1, 0.92, 0.23))
                    )
                    text = (annot.info or {}).get("content", "") or ""
                    data = {
                        "source": "qt-native", "document_uid": document_uid,
                        "pdf_xref": annot.xref,
                        "pdf_rects": [[rect.x0, rect.y0, rect.x1, rect.y1] for rect in raw_rects],
                        "pdf_page_size": [page.mediabox.width, page.mediabox.height],
                        "rects": [{"x": rect.x0 / width, "y": rect.y0 / height,
                                   "w": rect.width / width, "h": rect.height / height}
                                  for rect in shown_rects],
                        "colorHex": color_hex, "text": text, "quote": text,
                        "native_type": annot.type[1],
                    }
                    records.append((
                        f"qt-native:{book_id}:{annot.xref}", book_id, page_number + 1,
                        kind_map.get(annot.type[1], "dot"),
                        shown.x0 / width, shown.y0 / height,
                        json.dumps(data, ensure_ascii=False), datetime.utcnow().isoformat(),
                    ))
        with closing(get_db_connection()) as conn, conn:
            prior = conn.execute("SELECT id, data FROM annotations WHERE book_id = ?", (book_id,)).fetchall()
            conn.executemany("DELETE FROM annotations WHERE id = ?", [
                (row["id"],) for row in prior if json.loads(row["data"]).get("source") == "qt-native"
            ])
            conn.executemany("""
                INSERT INTO annotations (id, book_id, page, type, x, y, data, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, records)
        return len(records)
    
    @staticmethod
    def extract_annotations(pdf_path: str) -> List[Dict[str, Any]]:
        """Extract all annotations from a PDF file"""
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"File not found: {pdf_path}")
            
        doc = fitz.open(pdf_path)
        annotations = []
        
        for page_num, page in enumerate(doc):
            annot = page.first_annot
            while annot:
                info = annot.info
                content = info.get("content", "")
                subtype = annot.type[1]
                
                if content or subtype in ['Highlight', 'Underline', 'StrikeOut', 'Squiggly', 'Text', 'FreeText']:
                    annotations.append({
                        "page": page_num + 1,
                        "type": subtype,
                        "author": info.get("title", ""),
                        "content": content,
                        "subject": info.get("subject", ""),
                        "created_date": info.get("creationDate", ""),
                        "modified_date": info.get("modDate", ""),
                        "color": annot.colors.get("stroke", None)
                    })
                annot = annot.next
        doc.close()
        return annotations

    @staticmethod
    def has_comments(pdf_path: str) -> bool:
        """Quick check if a PDF has any user comments/annotations"""
        try:
            doc = fitz.open(pdf_path)
            for page in doc:
                if page.first_annot:
                    doc.close()
                    return True
            doc.close()
            return False
        except:
            return False

    @staticmethod
    def add_annotation(annotation: Annotation) -> Annotation:
        """Save a new annotation to the database"""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO annotations (id, book_id, page, type, x, y, data, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            annotation.id,
            annotation.book_id,
            annotation.page,
            annotation.type,
            annotation.x,
            annotation.y,
            json.dumps(annotation.data),
            annotation.created_at.isoformat()
        ))
        
        conn.commit()
        conn.close()
        return annotation

    @staticmethod
    def get_annotations_for_book(book_id: str) -> List[Dict[str, Any]]:
        """Get all stored annotations for a specific book"""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM annotations WHERE book_id = ? ORDER BY created_at ASC', (book_id,))
        rows = cursor.fetchall()
        conn.close()
        
        annotations = []
        for row in rows:
            annotations.append({
                "id": row["id"],
                "book_id": row["book_id"],
                "page": row["page"],
                "type": row["type"],
                "x": row["x"],
                "y": row["y"],
                "data": json.loads(row["data"]),
                "created_at": row["created_at"]
            })
        return annotations

    @staticmethod
    def update_annotation_data(annotation_id: str, data: Dict[str, Any]) -> bool:
        """Update the data JSON of an existing annotation"""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('UPDATE annotations SET data = ? WHERE id = ?', (
            json.dumps(data),
            annotation_id
        ))
        success = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return success

    @staticmethod
    def delete_annotation(annotation_id: str) -> bool:
        """Remove an annotation from the database"""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM annotations WHERE id = ?', (annotation_id,))
        success = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return success

    @staticmethod
    def delete_all_for_book(book_id: str) -> int:
        """Remove all annotations for a specific book"""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM annotations WHERE book_id = ?', (book_id,))
        count = cursor.rowcount
        conn.commit()
        conn.close()
        return count
