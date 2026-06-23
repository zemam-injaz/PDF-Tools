"""Enhanced Page Operations Service - Rotate, Delete, Extract, Reorder, Insert"""
import os
from typing import List, Dict, Any, Optional, Set
import fitz  # pymupdf


class PageService:
    """Comprehensive page manipulation operations for PDF files"""

    @staticmethod
    def parse_page_range(page_range: str, total_pages: int) -> List[int]:
        """
        Parse flexible page range string into list of page indices (0-based).
        Supports: "1-10", "1,5,10", "1-5,10,15-20", "all", "odd", "even"
        """
        page_range = page_range.strip().lower()
        
        if not page_range or page_range == 'all':
            return list(range(total_pages))
        
        if page_range == 'odd':
            return [i for i in range(total_pages) if i % 2 == 0]  # 0-indexed, so page 1 = index 0
        
        if page_range == 'even':
            return [i for i in range(total_pages) if i % 2 == 1]
        
        pages: Set[int] = set()
        parts = page_range.replace(' ', '').split(',')
        
        for part in parts:
            if '-' in part:
                try:
                    start, end = part.split('-', 1)
                    start = max(1, int(start))
                    end = min(total_pages, int(end))
                    for p in range(start, end + 1):
                        pages.add(p - 1)  # Convert to 0-based
                except ValueError:
                    continue
            else:
                try:
                    p = int(part)
                    if 1 <= p <= total_pages:
                        pages.add(p - 1)
                except ValueError:
                    continue
        
        return sorted(pages)

    @staticmethod
    def rotate_pages(pdf_path: str, output_path: str, pages: str,
                     rotation: int = 90) -> Dict[str, Any]:
        """
        Rotate specified pages by given angle.
        
        Args:
            pdf_path: Source PDF
            output_path: Output PDF
            pages: Page range string
            rotation: Rotation angle (90, 180, 270, -90)
        """
        try:
            doc = fitz.open(pdf_path)
            page_indices = PageService.parse_page_range(pages, doc.page_count)

            # Normalize rotation to 0, 90, 180, 270
            rotation = rotation % 360
            if rotation not in [0, 90, 180, 270]:
                rotation = 90

            for idx in page_indices:
                page = doc[idx]
                current_rotation = page.rotation
                new_rotation = (current_rotation + rotation) % 360
                page.set_rotation(new_rotation)

            doc.save(output_path)
            doc.close()
            return {
                "pages_rotated": len(page_indices),
                "rotation": rotation,
                "page_indices": [i + 1 for i in page_indices[:20]]  # Return first 20 for display
            }
        except Exception as e:
            raise Exception(f"Rotate pages failed: {str(e)}")

    @staticmethod
    def delete_pages(pdf_path: str, output_path: str, pages: str) -> Dict[str, Any]:
        """
        Delete specified pages from PDF.
        
        Args:
            pdf_path: Source PDF
            output_path: Output PDF
            pages: Pages to delete (uses flexible page range)
        """
        try:
            doc = fitz.open(pdf_path)
            original_count = doc.page_count
            page_indices = PageService.parse_page_range(pages, doc.page_count)

            # Validate we're not deleting all pages
            if len(page_indices) >= doc.page_count:
                raise Exception("Cannot delete all pages from PDF")

            # Delete in reverse order to maintain indices
            for idx in sorted(page_indices, reverse=True):
                doc.delete_page(idx)

            doc.save(output_path)
            remaining = doc.page_count
            doc.close()
            
            return {
                "pages_deleted": len(page_indices),
                "original_pages": original_count,
                "remaining_pages": remaining
            }
        except Exception as e:
            raise Exception(f"Delete pages failed: {str(e)}")

    @staticmethod
    def extract_pages(pdf_path: str, output_path: str, pages: str) -> Dict[str, Any]:
        """
        Extract specified pages to new PDF.
        
        Args:
            pdf_path: Source PDF
            output_path: Output PDF with extracted pages
            pages: Pages to extract
        """
        try:
            doc = fitz.open(pdf_path)
            page_indices = PageService.parse_page_range(pages, doc.page_count)

            if not page_indices:
                raise Exception("No valid pages to extract")

            new_doc = fitz.open()
            for idx in page_indices:
                new_doc.insert_pdf(doc, from_page=idx, to_page=idx)

            new_doc.save(output_path)
            new_doc.close()
            doc.close()
            
            return {
                "pages_extracted": len(page_indices),
                "output_path": output_path
            }
        except Exception as e:
            raise Exception(f"Extract pages failed: {str(e)}")

    @staticmethod
    def reorder_pages(pdf_path: str, output_path: str, new_order: List[int]) -> Dict[str, Any]:
        """
        Reorder pages according to new order.
        
        Args:
            pdf_path: Source PDF
            output_path: Output PDF
            new_order: List of page numbers (1-based) in desired order
        """
        try:
            doc = fitz.open(pdf_path)
            new_doc = fitz.open()

            valid_pages = 0
            for page_num in new_order:
                if 1 <= page_num <= doc.page_count:
                    new_doc.insert_pdf(doc, from_page=page_num - 1, to_page=page_num - 1)
                    valid_pages += 1

            if valid_pages == 0:
                raise Exception("No valid pages in new order")

            new_doc.save(output_path)
            new_doc.close()
            doc.close()
            
            return {
                "pages_reordered": valid_pages,
                "new_page_count": valid_pages
            }
        except Exception as e:
            raise Exception(f"Reorder pages failed: {str(e)}")

    @staticmethod
    def insert_pages(target_pdf: str, source_pdf: str, output_path: str,
                     insert_after_page: int, source_pages: str = 'all') -> Dict[str, Any]:
        """
        Insert pages from source PDF into target PDF.
        
        Args:
            target_pdf: Target PDF to insert into
            source_pdf: Source PDF to get pages from
            output_path: Output PDF
            insert_after_page: Insert after this page (0 = at beginning)
            source_pages: Pages to take from source PDF
        """
        try:
            target_doc = fitz.open(target_pdf)
            source_doc = fitz.open(source_pdf)

            # Parse source pages
            source_indices = PageService.parse_page_range(source_pages, source_doc.page_count)

            if not source_indices:
                raise Exception("No valid source pages to insert")

            # Clamp insert position
            insert_pos = max(0, min(insert_after_page, target_doc.page_count))

            # Insert pages
            for i, src_idx in enumerate(source_indices):
                target_doc.insert_pdf(source_doc, from_page=src_idx, to_page=src_idx,
                                      start_at=insert_pos + i)

            target_doc.save(output_path)
            total_target_pages = target_doc.page_count
            target_doc.close()
            source_doc.close()
            
            return {
                "pages_inserted": len(source_indices),
                "insert_position": insert_pos,
                "total_pages": total_target_pages
            }
        except Exception as e:
            raise Exception(f"Insert pages failed: {str(e)}")

    @staticmethod
    def reverse_pages(pdf_path: str, output_path: str) -> Dict[str, Any]:
        """Reverse the order of all pages in PDF."""
        try:
            doc = fitz.open(pdf_path)
            new_order = list(range(doc.page_count, 0, -1))
            doc.close()
            return PageService.reorder_pages(pdf_path, output_path, new_order)
        except Exception as e:
            raise Exception(f"Reverse pages failed: {str(e)}")

    @staticmethod
    def duplicate_pages(pdf_path: str, output_path: str, pages: str,
                        copies: int = 1) -> Dict[str, Any]:
        """
        Duplicate specified pages.
        
        Args:
            pdf_path: Source PDF
            output_path: Output PDF
            pages: Pages to duplicate
            copies: Number of copies for each page
        """
        try:
            doc = fitz.open(pdf_path)
            page_indices = PageService.parse_page_range(pages, doc.page_count)

            if not page_indices:
                raise Exception("No valid pages to duplicate")

            # Build new page order with duplicates
            new_order = []
            for i in range(doc.page_count):
                new_order.append(i + 1)  # Original page
                if i in page_indices:
                    for _ in range(copies):
                        new_order.append(i + 1)  # Duplicate

            doc.close()
            result = PageService.reorder_pages(pdf_path, output_path, new_order)
            result["duplicated_pages"] = len(page_indices)
            result["copies_per_page"] = copies
            return result
        except Exception as e:
            raise Exception(f"Duplicate pages failed: {str(e)}")

    @staticmethod
    def split_every_n_pages(pdf_path: str, output_dir: str, n: int = 10) -> Dict[str, Any]:
        """
        Split PDF into files of N pages each.
        
        Args:
            pdf_path: Source PDF
            output_dir: Directory for output files
            n: Number of pages per file
        """
        try:
            doc = fitz.open(pdf_path)
            total_pages = doc.page_count
            base_name = os.path.splitext(os.path.basename(pdf_path))[0]
            
            os.makedirs(output_dir, exist_ok=True)
            output_files = []
            part = 1

            for start in range(0, total_pages, n):
                end = min(start + n - 1, total_pages - 1)
                new_doc = fitz.open()
                new_doc.insert_pdf(doc, from_page=start, to_page=end)
                
                output_path = os.path.join(output_dir, f"{base_name}_part{part:03d}.pdf")
                new_doc.save(output_path)
                new_doc.close()
                output_files.append(output_path)
                part += 1

            doc.close()
            return {
                "files_created": output_files,
                "total_files": len(output_files),
                "pages_per_file": n
            }
        except Exception as e:
            raise Exception(f"Split every N pages failed: {str(e)}")
