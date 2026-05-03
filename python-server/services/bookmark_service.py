"""Enhanced Bookmark Service - Extract, Insert, Split by Bookmarks"""
import os
import re
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import fitz  # pymupdf
# from pydantic import BaseModel # Removed as it's not used and Bookmark is a dataclass


@dataclass
class Bookmark:
    """Bookmark data class"""
    title: str
    page: int
    level: int = 1


class BookmarkService:
    """Comprehensive bookmark operations for PDF files"""

    @staticmethod
    def extract_bookmarks(pdf_path: str) -> Dict[str, Any]:
        """
        Extract all bookmarks/TOC from PDF with hierarchical structure.
        Returns both structured data and formatted text.
        """
        try:
            doc = fitz.open(pdf_path)
            toc = doc.get_toc()  # Returns list of [level, title, page]
            total_pages = doc.page_count
            doc.close()

            bookmarks = []
            formatted_lines = []

            for item in toc:
                level, title, page = item[0], item[1], item[2]
                indent = "  " * (level - 1)
                bookmarks.append({
                    "level": level,
                    "title": title,
                    "page": page
                })
                formatted_lines.append(f"{indent}{title} - {page}")

            # Calculate page ranges for each bookmark
            bookmarks_with_ranges = BookmarkService._calculate_page_ranges(bookmarks, total_pages)

            return {
                "bookmarks": bookmarks_with_ranges,
                "formatted_text": '\n'.join(formatted_lines),
                "count": len(bookmarks),
                "total_pages": total_pages,
                "has_bookmarks": len(bookmarks) > 0
            }
        except Exception as e:
            raise Exception(f"Bookmark extraction failed: {str(e)}")

    @staticmethod
    def _calculate_page_ranges(bookmarks: List[Dict], total_pages: int) -> List[Dict]:
        """Calculate end page for each bookmark based on next bookmark's start."""
        result = []
        for i, bm in enumerate(bookmarks):
            bm_copy = bm.copy()
            # Find next bookmark at same or higher level
            end_page = total_pages
            for next_bm in bookmarks[i + 1:]:
                if next_bm["level"] <= bm["level"]:
                    end_page = next_bm["page"] - 1
                    break
            bm_copy["end_page"] = max(bm["page"], end_page)
            bm_copy["page_count"] = bm_copy["end_page"] - bm["page"] + 1
            result.append(bm_copy)
        return result

    @staticmethod
    def save_bookmarks(text: str, output_path: str) -> bool:
        """Save bookmarks text to file."""
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(text)
            return True
        except Exception as e:
            raise Exception(f"Save bookmarks failed: {str(e)}")

    @staticmethod
    def load_bookmarks_from_text(file_path: str) -> List[Bookmark]:
        """
        Load bookmarks from text file with 'Title - Page' format.
        Supports automatic level detection based on indentation and numbering.
        """
        bookmarks = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            for line_num, line in enumerate(lines, 1):
                original_line = line
                line = line.rstrip('\n\r')
                if not line.strip():
                    continue

                # Parse "Title - Page" format
                if ' - ' in line:
                    parts = line.rsplit(' - ', 1)
                    if len(parts) == 2:
                        title = parts[0].strip()
                        try:
                            page = int(parts[1].strip())

                            # Determine level based on title format
                            level = BookmarkService._detect_level(original_line, title)
                            bookmarks.append(Bookmark(title=title, page=page, level=level))

                        except ValueError:
                            print(f"Warning: Invalid page number on line {line_num}: {line}")
                else:
                    # Try to parse using regex for other formats
                    parsed = BookmarkService._parse_line_parts(line)
                    if parsed[0] and parsed[1]:
                        title, page_str = parsed
                        try:
                            page = int(page_str)
                            level = BookmarkService._detect_level(original_line, title)
                            bookmarks.append(Bookmark(title=title, page=page, level=level))
                        except ValueError:
                            pass

            return bookmarks
        except Exception as e:
            raise Exception(f"Error loading bookmarks from text: {str(e)}")

    @staticmethod
    def _detect_level(original_line: str, title: str) -> int:
        """Detect bookmark level based on indentation and numbering patterns."""
        # Check indentation
        stripped = original_line.lstrip()
        indent = len(original_line) - len(stripped)
        
        # Tab = level 2+, spaces (2+) = level 2+
        if indent >= 4 or '\t' in original_line[:indent]:
            base_level = 2 if indent < 8 else 3
        else:
            base_level = 1

        # Check numbering patterns
        title_stripped = title.strip()
        
        # Level 1: Simple chapter (الفصل الأول, Chapter 1, 1., etc.)
        if re.match(r'^(الفصل|الباب|Chapter|Part)\s+\d+', title_stripped, re.IGNORECASE):
            return 1
        
        # Level 2: Sub-section (1.1, 1.1.1, etc.)
        if re.match(r'^\d+\.\d+', title_stripped):
            dots = title_stripped.split('.')[0:3]
            return min(len([d for d in dots if d.isdigit()]), 3)
        
        return base_level

    @staticmethod
    def _parse_line_parts(line: str) -> Tuple[str, str]:
        """
        Parse a line to separate title from page number.
        Handles multiple formats: "Title - Page", "Title ... Page", "Title Page"
        """
        try:
            # Handle format: "Title - PageNumber"
            if ' - ' in line:
                parts = line.strip().rsplit(' - ', 1)
                return parts[0].strip(), parts[1].strip()

            # Remove excessive dots and normalize spaces
            cleaned_line = re.sub(r'\.{2,}', ' ', line)
            cleaned_line = re.sub(r'\s+', ' ', cleaned_line).strip()

            # Try to find page number at the end
            match = re.search(r'(.+?)\s+(\d+)$', cleaned_line)
            if match:
                return match.group(1).strip(), match.group(2).strip()

            # Try to find page number at the beginning
            match = re.search(r'^(\d+)\s+(.+)$', cleaned_line)
            if match:
                return match.group(2).strip(), match.group(1).strip()

            return line.strip(), ""

        except Exception:
            return line.strip(), ""

    @staticmethod
    def parse_toc_text(toc_text: str, consider_levels: bool = True) -> List[Bookmark]:
        """
        Parse TOC text with optional level detection.
        If consider_levels is False, all items become Level 1.
        """
        bookmarks = []
        if not toc_text.strip():
            return bookmarks

        all_lines = toc_text.split('\n')

        for i, line in enumerate(all_lines):
            line_content = line.strip()
            if not line_content:
                continue

            title, page_str = BookmarkService._parse_line_parts(line)
            if not title or not page_str:
                continue

            try:
                page = int(page_str)
            except ValueError:
                continue

            if not consider_levels:
                level = 1
            else:
                # Determine level based on position and preceding lines
                is_level1 = False
                if i == 0 or all(not all_lines[j].strip() for j in range(i)):
                    is_level1 = True
                elif i > 0 and not all_lines[i-1].strip():
                    is_level1 = True
                level = 1 if is_level1 else 2
            
            bookmarks.append(Bookmark(title=title, page=page, level=level))

        return bookmarks

    @staticmethod
    def insert_bookmarks(pdf_path: str, bookmarks: List[Dict[str, Any]], output_path: str, 
                        page_offset: int = 0) -> Dict[str, Any]:
        """
        Insert bookmarks into PDF file.
        
        Args:
            pdf_path: Source PDF path
            bookmarks: List of bookmark dicts with 'title', 'page', 'level'
            output_path: Output PDF path
            page_offset: Offset to add to all page numbers
        """
        try:
            # Ensure output directory exists
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            
            # Check if we are overwriting the input file
            input_abs = os.path.abspath(pdf_path)
            output_abs = os.path.abspath(output_path)
            is_overwrite = input_abs == output_abs
            
            final_output_path = output_path
            if is_overwrite:
                import uuid
                # Save to a temp file first
                temp_filename = f"{os.path.dirname(output_abs)}/temp_{uuid.uuid4().hex}.pdf"
                final_output_path = temp_filename

            doc = fitz.open(pdf_path)
            total_pages = doc.page_count

            # Convert to TOC format, filtering invalid pages
            toc = []
            skipped = 0
            for bm in bookmarks:
                try:
                    level = int(bm.get('level', 1))
                    title = str(bm.get('title', '')).replace('\x00', '') # Remove null bytes
                    page = int(bm.get('page', 1)) + page_offset

                    # Validate page number
                    if page < 1 or page > total_pages:
                        skipped += 1
                        continue

                    toc.append([level, title, page])
                except (ValueError, TypeError):
                    skipped += 1
                    continue
            
            if toc:
                # Use robust normalization
                toc = BookmarkService.normalize_toc_levels(toc)
                doc.set_toc(toc)
                
                # Use garbage collection and deflate for safe, efficient saving
                doc.save(final_output_path, garbage=4, deflate=True)
                doc.close()
                
                # If overwriting, replace original with temp
                if is_overwrite:
                    import shutil
                    # Force move/replace
                    shutil.move(final_output_path, output_abs)
                
                return {
                    "inserted": len(toc),
                    "skipped": skipped,
                    "output_path": output_path
                }
            else:
                doc.close()
                raise Exception("No valid bookmarks to insert")

        except Exception as e:
            # Ensure doc is closed (if opened) happens via garbage collection usually, 
            # but explicit close in finally block is hard with locally scoped `doc`.
            # We rely on fitz's RAII here or the fact that this raises.
            print(f"Insertion Error: {e}")
            raise Exception(f"Insert bookmarks failed: {str(e)}")

    @staticmethod
    def split_by_bookmarks(pdf_path: str, output_dir: str,
                           level_1_only: bool = True,
                           preserve_bookmarks: bool = True,
                           selected_indices: Optional[List[int]] = None,
                           use_bookmark_titles: bool = True,
                           ignore_hierarchy: bool = False,
                           target_level: Optional[int] = None) -> Dict[str, Any]:
        """
        Split PDF by bookmark structure into separate files.
        
        Args:
            pdf_path: Source PDF path
            output_dir: Directory to save split files
            level_1_only: Only split by level 1 (main chapters)
            preserve_bookmarks: Include sub-bookmarks in split files
            selected_indices: Only split selected bookmarks by index
            use_bookmark_titles: Use bookmark titles as filenames
            ignore_hierarchy: Force all split sections to Level 1
        """
        try:
            if not output_dir:
                raise Exception("Output directory is required")
            doc = fitz.open(pdf_path)
            toc = doc.get_toc()
            total_pages = doc.page_count
            base_name = os.path.splitext(os.path.basename(pdf_path))[0]

            if not toc:
                doc.close()
                raise Exception("No bookmarks found in PDF")

            # Sequential level mapping to satisfy PyMuPDF
            toc = BookmarkService.normalize_toc_levels(toc)

            # Filter by level if needed
            if ignore_hierarchy:
                sections = list(enumerate(toc))
                # Force all sections to level 1 for the split logic
                sections = [(i, [1, item[1], item[2]]) for i, item in sections]
            elif target_level is not None:
                sections = [(i, item) for i, item in enumerate(toc) if item[0] == target_level]
            elif level_1_only:
                sections = [(i, item) for i, item in enumerate(toc) if item[0] == 1]
            else:
                sections = list(enumerate(toc))

            # Filter by selected indices if provided
            if selected_indices is not None:
                sections = [(i, item) for i, item in sections if i in selected_indices]

            if not sections:
                doc.close()
                raise Exception("No bookmarks match the selection criteria")

            output_files = []
            os.makedirs(output_dir, exist_ok=True)

            for idx, (toc_idx, section) in enumerate(sections):
                level, title, start_page = section[0], section[1], section[2]

                # Find end page
                # If ignore_hierarchy is True, we split exactly at the next bookmark
                # If ignore_hierarchy is False (respecting levels), we find the next bookmark at the SAME or HIGHER level
                end_page = total_pages
                for next_item in toc[toc_idx + 1:]:
                    if ignore_hierarchy or next_item[0] <= level:
                        end_page = next_item[2] - 1
                        break

                # Ensure valid page range
                start_page = max(1, start_page)
                end_page = min(total_pages, max(start_page, end_page))

                # Create safe filename
                if use_bookmark_titles:
                    safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_', 'أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي', 'ء', 'ى', 'ة')).strip()
                    safe_title = safe_title[:50]  # Limit length
                    output_filename = f"{idx+1:02d}_{safe_title}.pdf"
                else:
                    output_filename = f"{base_name}_part{idx+1:03d}.pdf"

                output_path = os.path.join(output_dir, output_filename)

                # Extract pages (convert to 0-based index)
                new_doc = fitz.open()
                new_doc.insert_pdf(doc, from_page=start_page - 1, to_page=end_page - 1)

                # Optionally preserve sub-bookmarks
                if preserve_bookmarks:
                    sub_toc = []
                    for item in toc:
                        if start_page <= item[2] <= end_page:
                             # Adjust page number relative to new document
                            new_page = item[2] - start_page + 1
                            sub_toc.append([item[0], item[1], new_page])
                    
                    if sub_toc:
                        # CRITICAL: Re-normalize sub_toc using the robust sequential mapping
                        # This fixes "hierarchy level of item 0 must be 1" AND level jumps > 1
                        sub_toc = BookmarkService.normalize_toc_levels(sub_toc)
                        new_doc.set_toc(sub_toc)

                new_doc.save(output_path)
                new_doc.close()
                output_files.append({
                    "path": output_path,
                    "title": title,
                    "start_page": start_page,
                    "end_page": end_page,
                    "page_count": end_page - start_page + 1
                })

            doc.close()
            return {
                "files_created": [f["path"] for f in output_files],
                "files_info": output_files,
                "total_files": len(output_files)
            }
        except Exception as e:
            raise Exception(f"Split by bookmarks failed: {str(e)}")

    @staticmethod
    def transfer_bookmarks(source_pdf: str, target_pdf: str, output_path: str) -> Dict[str, Any]:
        """
        Transfer bookmarks from source PDF to target PDF.
        """
        try:
            # Ensure output directory exists
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            
            # Open source to get TOC
            with fitz.open(source_pdf) as src_doc:
                toc = src_doc.get_toc()
            
            if not toc:
                raise Exception("No bookmarks found in source PDF")
                
            # Open target and set TOC
            with fitz.open(target_pdf) as tgt_doc:
                # Normalize TOC before setting to ensure PyMuPDF compatibility
                normalized_toc = BookmarkService.normalize_toc_levels(toc)
                tgt_doc.set_toc(normalized_toc)
                tgt_doc.save(output_path, garbage=4, deflate=True)
            
            return {
                "count": len(toc),
                "output_path": output_path
            }
        except Exception as e:
            raise Exception(f"Bookmark transfer failed: {str(e)}")

    @staticmethod
    def normalize_toc_levels(toc: List[List[Any]]) -> List[List[Any]]:
        """
        PyMuPDF TOC requirements:
        1. Item 0 must be Level 1.
        2. Any item's level cannot exceed previous item's level by more than 1.
        
        This method maps existing unique levels to sequential 1, 2, 3...
        preserving the relative order and hierarchy.
        """
        if not toc:
            return []
            
        # Get unique levels and sort them
        # Map them to 1, 2, 3... based on their rank
        unique_levels = sorted(list(set(item[0] for item in toc)))
        level_map = {old: i + 1 for i, old in enumerate(unique_levels)}
        
        normalized = []
        for item in toc:
            # item is [level, title, page, ...]
            new_item = list(item)
            new_item[0] = level_map[item[0]]
            normalized.append(new_item)
            
        # Double check: sometimes item 0 is NOT the min level
        # PyMuPDF MANDATES item 0 is level 1
        if normalized and normalized[0][0] != 1:
            diff = normalized[0][0] - 1
            for i in range(len(normalized)):
                normalized[i][0] = max(1, normalized[i][0] - diff)
                
        return normalized

    @staticmethod
    def get_bookmark_levels(pdf_path: str) -> Dict[str, Any]:
        """Get bookmark statistics by level."""
        try:
            doc = fitz.open(pdf_path)
            toc = doc.get_toc()
            doc.close()

            if not toc:
                return {"levels": {}, "total": 0}

            # Normalize levels before counting so they match backend split expectations (1, 2, 3...)
            toc = BookmarkService.normalize_toc_levels(toc)

            level_counts = {}
            for item in toc:
                level = item[0]
                level_counts[level] = level_counts.get(level, 0) + 1

            return {
                "levels": level_counts,
                "total": len(toc),
                "max_level": max(level_counts.keys()) if level_counts else 0
            }
        except Exception as e:
            raise Exception(f"Get bookmark levels failed: {str(e)}")
