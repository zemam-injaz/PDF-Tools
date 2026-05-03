import fitz
import os
from typing import Dict, Any, List
from filelock import FileLock

class AnnotationModifierService:
    """Service for permanently embedding annotations into PDF files using PyMuPDF"""
    
    @staticmethod
    def _normalize_to_pdf_rect(page: fitz.Page, nx: float, ny: float, 
                                 w_pts: float = 20, h_pts: float = 20) -> fitz.Rect:
        """
        Convert normalized (0-1) coordinates to PDF point coordinates.
        PyMuPDF uses a top-left origin, same as the browser.
        """
        pw, ph = page.rect.width, page.rect.height
        cx = nx * pw
        cy = ny * ph
        
        # Center the rectangle on the click point
        return fitz.Rect(cx - w_pts/2, cy - h_pts/2, cx + w_pts/2, cy + h_pts/2)

    @staticmethod
    def burn_annotations(pdf_path: str, output_path: str, annotations: List[Dict[str, Any]]) -> bool:
        """
        Burn a list of annotations into a PDF file.
        Each annotation should have: page, type, x, y, data
        """
        import hashlib
        import tempfile
        
        # Use a hash-based lock in temp to avoid long path issues or dir permissions
        path_hash = hashlib.md5(pdf_path.encode('utf-8')).hexdigest()
        lock_path = os.path.join(tempfile.gettempdir(), f"pdf_tools_{path_hash}.lock")
        
        with FileLock(lock_path):
            try:
                doc = fitz.open(pdf_path)
                
                for annot_data in annotations:
                    page_num = annot_data.get('page')
                    if page_num > len(doc):
                        continue
                        
                    page = doc[page_num - 1]
                    nx, ny = annot_data.get('x'), annot_data.get('y')
                    atype = annot_data.get('type')
                    data = annot_data.get('data', {})
                    
                    if atype == 'dot':
                        # Use a small square to ensure a perfect circle
                        rect = AnnotationModifierService._normalize_to_pdf_rect(page, nx, ny, w_pts=12, h_pts=12)
                        color = (1, 0, 0) if data.get('color') == 'red' else (0, 0, 0)
                        annot = page.add_circle_annot(rect)
                        annot.set_colors(stroke=color, fill=color)
                        annot.set_border(width=0)
                        annot.update()
                        
                    elif atype == 'text':
                        # Fixed size box for text
                        rect = AnnotationModifierService._normalize_to_pdf_rect(page, nx, ny, w_pts=180, h_pts=40)
                        text = data.get('text', '')
                        language = data.get('language', 'en')
                        
                        annot = page.add_freetext_annot(
                            rect, text,
                            fontsize=10,
                            fontname="helv", # Standard font
                            text_color=(0, 0, 0),
                            fill_color=(1, 1, 0.8) # Light yellow sticky note color
                        )
                        # For Arabic, storing in content helps some readers
                        if language == 'ar':
                            annot.set_info(content=text)
                        annot.update()
                        
                    elif atype == 'timestamp':
                        rect = AnnotationModifierService._normalize_to_pdf_rect(page, nx, ny, w_pts=220, h_pts=25)
                        ts_str = data.get('timestamp', '')
                        count = data.get('reading_count', 1)
                        label = f"{ts_str} | Reading #{count}"
                        
                        annot = page.add_freetext_annot(
                            rect, label,
                            fontsize=8,
                            text_color=(1, 1, 1),
                            fill_color=(0.1, 0.1, 0.2) # Dark navy
                        )
                        annot.update()

                doc.save(output_path, incremental=False, encryption=fitz.PDF_ENCRYPT_KEEP)
                doc.close()
                return True
            except Exception as e:
                print(f"Error burning annotations: {e}")
                if 'doc' in locals(): doc.close()
                return False
