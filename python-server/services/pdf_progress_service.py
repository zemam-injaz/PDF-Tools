"""PDF Progress Service - Track reading progress and annotations across multiple PDFs"""
import os
import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import fitz  # PyMuPDF

# Database path - stored in user's app data
DB_DIR = os.path.join(os.path.expanduser("~"), ".pdf-tools")
DB_PATH = os.path.join(DB_DIR, "pdf_reading_progress.db")


def get_db_connection():
    """Get database connection, creating database if needed"""
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    return conn


def init_database():
    """Initialize the database schema"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pdf_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT UNIQUE NOT NULL,
            file_name TEXT NOT NULL,
            page_count INTEGER DEFAULT 0,
            total_annotations INTEGER DEFAULT 0,
            reading_intensity_score REAL DEFAULT 0.0,
            last_modified TEXT,
            last_scanned TEXT,
            file_size INTEGER DEFAULT 0,
            annotations_by_type TEXT,
            estimated_reading_time INTEGER DEFAULT 0
        )
    ''')
    
    conn.commit()
    conn.close()


# Initialize on import
init_database()


class PDFProgressService:
    """Service for tracking PDF reading progress and annotations"""
    
    @staticmethod
    def analyze_pdf_fast(file_path: str) -> Dict[str, Any]:
        """Analyze a single PDF file for annotations - optimized for speed"""
        try:
            doc = fitz.open(file_path)
            
            # Basic file info
            file_name = os.path.basename(file_path)
            page_count = len(doc)
            file_size = os.path.getsize(file_path)
            last_modified = datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat()
            
            # Fast annotation count - use has_annots() first as a quick check
            total_annotations = 0
            annotations_by_type: Dict[str, int] = {}
            
            for page in doc:
                if page.first_annot:  # Only iterate if page has annotations
                    annot = page.first_annot
                    while annot:
                        total_annotations += 1
                        annot_type = annot.type[1]
                        annotations_by_type[annot_type] = annotations_by_type.get(annot_type, 0) + 1
                        annot = annot.next
            
            # Calculate reading intensity
            reading_intensity = min(total_annotations / max(page_count, 1) * 10, 10.0)
            estimated_reading_time = page_count * 2
            
            doc.close()
            
            return {
                "file_path": file_path,
                "file_name": file_name,
                "page_count": page_count,
                "total_annotations": total_annotations,
                "reading_intensity_score": reading_intensity,
                "last_modified": last_modified,
                "last_scanned": datetime.now().isoformat(),
                "file_size": file_size,
                "annotations_by_type": annotations_by_type,
                "estimated_reading_time": estimated_reading_time
            }
            
        except Exception as e:
            return None  # Return None for failed files
    
    @staticmethod
    def analyze_pdf(file_path: str) -> Dict[str, Any]:
        """Analyze a single PDF file for annotations"""
        result = PDFProgressService.analyze_pdf_fast(file_path)
        if result is None:
            raise Exception(f"Failed to analyze {file_path}")
        PDFProgressService._save_progress(result)
        return result
    
    @staticmethod
    def _save_progress_batch(data_list: List[Dict[str, Any]]):
        """Save multiple PDF progress records in a single transaction"""
        if not data_list:
            return
            
        conn = get_db_connection()
        cursor = conn.cursor()
        
        for data in data_list:
            cursor.execute('''
                INSERT OR REPLACE INTO pdf_progress
                (file_path, file_name, page_count, total_annotations, reading_intensity_score,
                 last_modified, last_scanned, file_size, annotations_by_type, estimated_reading_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                data["file_path"],
                data["file_name"],
                data["page_count"],
                data["total_annotations"],
                data["reading_intensity_score"],
                data["last_modified"],
                data["last_scanned"],
                data["file_size"],
                json.dumps(data["annotations_by_type"]),
                data["estimated_reading_time"]
            ))
        
        conn.commit()
        conn.close()
    
    @staticmethod
    def _save_progress(data: Dict[str, Any]):
        """Save PDF progress to database"""
        PDFProgressService._save_progress_batch([data])
    
    @staticmethod
    def scan_directory(directory_path: str, recursive: bool = True) -> Dict[str, Any]:
        """Scan directory for PDF files and analyze them - OPTIMIZED with parallel processing"""
        from concurrent.futures import ThreadPoolExecutor, as_completed
        
        if not os.path.exists(directory_path):
            raise FileNotFoundError(f"Directory not found: {directory_path}")
        
        # Collect PDF files
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
        
        successful = []
        failed = []
        results = []
        
        # Use ThreadPoolExecutor for parallel processing (4 workers)
        max_workers = min(8, len(pdf_files) or 1)
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_path = {
                executor.submit(PDFProgressService.analyze_pdf_fast, path): path 
                for path in pdf_files
            }
            
            for future in as_completed(future_to_path):
                path = future_to_path[future]
                try:
                    result = future.result()
                    if result:
                        results.append(result)
                        successful.append(path)
                    else:
                        failed.append({"path": path, "error": "Analysis returned None"})
                except Exception as e:
                    failed.append({"path": path, "error": str(e)})
        
        # Batch save all results in one transaction
        PDFProgressService._save_progress_batch(results)
        
        return {
            "successful": successful,
            "failed": failed,
            "total_found": len(pdf_files),
            "successful_count": len(successful),
            "failed_count": len(failed)
        }
    
    @staticmethod
    def get_pdf_list(
        filter_annotated: bool = False,
        sort_by: str = "last_scanned",
        order: str = "desc",
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get list of PDFs from database"""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = "SELECT * FROM pdf_progress WHERE 1=1"
        params = []
        
        if filter_annotated:
            query += " AND total_annotations > 0"
        
        if search:
            query += " AND (file_name LIKE ? OR file_path LIKE ?)"
            params.extend([f"%{search}%", f"%{search}%"])
        
        # Validate sort column
        valid_sorts = ["last_scanned", "file_name", "total_annotations", "reading_intensity_score", "last_modified", "page_count"]
        if sort_by not in valid_sorts:
            sort_by = "last_scanned"
        
        query += f" ORDER BY {sort_by}"
        query += " DESC" if order.lower() == "desc" else " ASC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        pdf_list = []
        for row in rows:
            pdf_list.append({
                "id": row["id"],
                "file_path": row["file_path"],
                "file_name": row["file_name"],
                "page_count": row["page_count"],
                "total_annotations": row["total_annotations"],
                "reading_intensity_score": row["reading_intensity_score"],
                "last_modified": row["last_modified"],
                "last_scanned": row["last_scanned"],
                "file_size": row["file_size"],
                "annotations_by_type": json.loads(row["annotations_by_type"]) if row["annotations_by_type"] else {},
                "estimated_reading_time": row["estimated_reading_time"]
            })
        
        return pdf_list
    
    @staticmethod
    def get_statistics() -> Dict[str, Any]:
        """Get reading statistics"""
        conn = get_db_connection()
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
            "total_pdfs": total_pdfs,
            "pdfs_with_annotations": pdfs_with_annotations,
            "total_annotations": total_annotations,
            "average_intensity": round(avg_intensity, 2)
        }
    
    @staticmethod
    def export_to_markdown(file_path: str) -> str:
        """Export annotations from a PDF to markdown format"""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        try:
            doc = fitz.open(file_path)
            file_name = os.path.basename(file_path)
            
            # Clean text helper
            def clean_text(text: str) -> str:
                """Remove control characters and normalize whitespace"""
                import re
                # Remove control characters (except newlines)
                text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', text)
                # Normalize multiple spaces/tabs to single space
                text = re.sub(r'[ \t]+', ' ', text)
                # Normalize multiple newlines to max 2
                text = re.sub(r'\n{3,}', '\n\n', text)
                # Strip leading/trailing whitespace per line
                lines = [line.strip() for line in text.split('\n')]
                return '\n'.join(lines).strip()
            
            # Header
            content = f"# 📖 {file_name}\n\n"
            content += "---\n\n"
            content += f"📅 **تاريخ التصدير:** {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n"
            content += f"📄 **عدد الصفحات:** {len(doc)}\n\n"
            content += "---\n\n"
            
            all_annotations = []
            
            for page_num in range(len(doc)):
                page = doc[page_num]
                annot = page.first_annot
                
                while annot:
                    annot_content = clean_text(annot.info.get("content", ""))
                    annot_subject = clean_text(annot.info.get("subject", ""))
                    annot_type = annot.type[1]
                    
                    if annot_content:
                        all_annotations.append({
                            "page": page_num + 1,
                            "type": annot_type,
                            "content": annot_content,
                            "subject": annot_subject
                        })
                    annot = annot.next
            
            doc.close()
            
            if not all_annotations:
                return "لا توجد تعليقات في هذا الملف."
            
            # Summary
            content += f"## 📊 ملخص التعليقات\n\n"
            content += f"إجمالي التعليقات: **{len(all_annotations)}**\n\n"
            
            # Group by type
            types = {}
            for a in all_annotations:
                types[a["type"]] = types.get(a["type"], 0) + 1
            for t, count in sorted(types.items()):
                content += f"- {t}: {count}\n"
            content += "\n---\n\n"
            
            # Annotations by page
            content += "## 📝 التعليقات\n\n"
            
            current_page = None
            for annot in all_annotations:
                if annot["page"] != current_page:
                    current_page = annot["page"]
                    content += f"### صفحة {current_page}\n\n"
                
                # Format based on content length
                if '\n' in annot["content"] or len(annot["content"]) > 80:
                    # Multi-line or long content - use blockquote
                    content += f"> {annot['content'].replace(chr(10), chr(10) + '> ')}\n\n"
                else:
                    # Short content - inline
                    content += f"- {annot['content']}\n"
                
                if current_page != (all_annotations[-1]["page"] if all_annotations else 0):
                    # Check if next annotation is on a different page
                    idx = all_annotations.index(annot)
                    if idx < len(all_annotations) - 1 and all_annotations[idx + 1]["page"] != current_page:
                        content += "\n"
            
            content += "\n---\n\n"
            content += f"*تم التصدير بواسطة PDF Tools*\n"
            
            return content
            
        except Exception as e:
            raise Exception(f"Error exporting annotations: {e}")
    
    @staticmethod
    def delete_pdf(file_path: str) -> bool:
        """Delete a PDF from the database (not the file itself)"""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM pdf_progress WHERE file_path = ?", (file_path,))
        deleted = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return deleted
    
    @staticmethod
    def clear_all() -> int:
        """Clear all PDF progress data"""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM pdf_progress")
        count = cursor.rowcount
        conn.commit()
        conn.close()
        return count
