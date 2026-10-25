"""PDF Core Service - Merge, Split, Compress, Extract Images, Info"""
import os
import shutil
from typing import List, Dict, Any
import fitz  # pymupdf


class PDFService:
    @staticmethod
    def get_pdf_info(path: str) -> Dict[str, Any]:
        """Get basic PDF information."""
        try:
            doc = fitz.open(path)
            info = {
                "page_count": doc.page_count,
                "metadata": doc.metadata,
                "is_encrypted": doc.is_encrypted
            }
            doc.close()
            return info
        except Exception as e:
            raise Exception(f"Failed to read PDF info: {str(e)}")

    @staticmethod
    def merge_pdfs(input_paths: List[str], output_path: str) -> bool:
        """Merge multiple PDFs into one."""
        try:
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            result = fitz.open()
            for path in input_paths:
                with fitz.open(path) as mfile:
                    result.insert_pdf(mfile)
            result.save(output_path)
            result.close()
            return True
        except Exception as e:
            raise Exception(f"Merge failed: {str(e)}")

    @staticmethod
    def split_pdf(input_path: str, split_pages: List[int], output_dir: str) -> List[str]:
        """
        Split a PDF file at specific page numbers.
        split_pages: List of page numbers (1-based) where new files should start.
        """
        try:
            os.makedirs(output_dir, exist_ok=True)
            doc = fitz.open(input_path)
            total_pages = doc.page_count
            base_name = os.path.splitext(os.path.basename(input_path))[0]
            output_files = []
            
            sorted_splits = sorted(list(set(p for p in split_pages if 1 < p <= total_pages)))
            
            start_index = 0
            part_num = 1
            
            for split_page in sorted_splits:
                end_index = split_page - 2
                
                if start_index <= end_index:
                    new_doc = fitz.open()
                    new_doc.insert_pdf(doc, from_page=start_index, to_page=end_index)
                    out_path = os.path.join(output_dir, f"{base_name}_part{part_num}.pdf")
                    new_doc.save(out_path)
                    new_doc.close()
                    output_files.append(out_path)
                
                start_index = end_index + 1
                part_num += 1
            
            # Last part
            if start_index < total_pages:
                new_doc = fitz.open()
                new_doc.insert_pdf(doc, from_page=start_index, to_page=total_pages - 1)
                out_path = os.path.join(output_dir, f"{base_name}_part{part_num}.pdf")
                new_doc.save(out_path)
                new_doc.close()
                output_files.append(out_path)
                
            doc.close()
            return output_files
        except Exception as e:
            raise Exception(f"Split failed: {str(e)}")

    @staticmethod
    def compress_pdf(input_path: str, output_path: str, compression_level: int = 2) -> bool:
        """Compress a PDF using structural optimization.

        The previous implementation only re-saved the file and could even make it
        larger (notably ``linear=True``). This version:
          * enables image/font deflate, object streams and compression effort,
          * subsets fonts for higher levels,
          * falls back to rebuilding a clean copy for damaged PDFs,
          * guarantees the output is never larger than the input.

        Levels:
          0: copy without optimization
          1: basic      (garbage=1, deflate)
          2: balanced   (garbage=3, deflate images/fonts, object streams)  [recommended]
          3: strong     (garbage=4, clean, font subsetting)
          4: maximum    (strong + compression_effort=100)
        """
        if not os.path.isfile(input_path):
            raise FileNotFoundError(f"File not found: {input_path}")

        out_dir = os.path.dirname(os.path.abspath(output_path))
        os.makedirs(out_dir, exist_ok=True)
        original_size = os.path.getsize(input_path)
        level = max(0, min(4, int(compression_level)))
        same_file = os.path.abspath(input_path) == os.path.abspath(output_path)
        tmp_path = os.path.join(out_dir, f".{os.path.basename(output_path)}.compressing")

        doc = None
        try:
            doc = fitz.open(input_path)
            if doc.needs_pass:
                raise PermissionError("PDF is password protected. Remove its security first.")

            if level == 0:
                doc.save(tmp_path, garbage=0, deflate=False, encryption=fitz.PDF_ENCRYPT_KEEP)
            else:
                garbage = {1: 1, 2: 3, 3: 4, 4: 4}[level]
                effort = {1: 50, 2: 80, 3: 100, 4: 100}[level]
                if level >= 3:
                    try:
                        doc.subset_fonts()
                    except Exception:
                        pass
                doc.save(
                    tmp_path,
                    garbage=garbage,
                    clean=level >= 3,
                    deflate=True,
                    deflate_images=True,
                    deflate_fonts=True,
                    use_objstms=1,
                    compression_effort=effort,
                    encryption=fitz.PDF_ENCRYPT_KEEP,
                )
            doc.close()
            doc = None
        except Exception as primary_error:
            if doc is not None:
                try:
                    doc.close()
                except Exception:
                    pass
                doc = None
            # Fallback for damaged PDFs: rebuild a clean document via insert_pdf.
            try:
                fresh = fitz.open(input_path)
                clean_doc = fitz.open()
                clean_doc.insert_pdf(fresh, annots=True, links=True)
                try:
                    toc = fresh.get_toc()
                    if toc:
                        clean_doc.set_toc(toc)
                except Exception:
                    pass
                fresh.close()
                clean_doc.save(
                    tmp_path, garbage=3, deflate=True,
                    deflate_images=True, deflate_fonts=True, use_objstms=1,
                )
                clean_doc.close()
            except Exception:
                if os.path.exists(tmp_path):
                    try:
                        os.remove(tmp_path)
                    except OSError:
                        pass
                raise Exception(f"Compression failed: {primary_error}")

        compressed_size = os.path.getsize(tmp_path) if os.path.exists(tmp_path) else -1

        # Never hand back a bigger file than the source.
        if level > 0 and (compressed_size < 0 or compressed_size >= original_size):
            try:
                os.remove(tmp_path)
            except OSError:
                pass
            if not same_file:
                shutil.copyfile(input_path, output_path)
        else:
            os.replace(tmp_path, output_path)
        return True

    @staticmethod
    def extract_images(input_path: str, output_dir: str) -> List[str]:
        """Extract all images from PDF."""
        try:
            doc = fitz.open(input_path)
            saved_files = []
            
            for page_index in range(len(doc)):
                page = doc[page_index]
                image_list = page.get_images()
                
                for image_index, img in enumerate(image_list):
                    xref = img[0]
                    pix = fitz.Pixmap(doc, xref)
                    
                    if pix.n - pix.alpha > 3:
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                    
                    image_filename = f"page{page_index+1}_img{image_index+1}.png"
                    image_path = os.path.join(output_dir, image_filename)
                    pix.save(image_path)
                    saved_files.append(image_path)
                    pix = None
                    
            doc.close()
            return saved_files
        except Exception as e:
            raise Exception(f"Image extraction failed: {str(e)}")

    @staticmethod
    def create_from_images(image_paths: List[str], output_path: str) -> bool:
        """Create a PDF from a list of images."""
        try:
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            doc = fitz.open()
            for img_path in image_paths:
                img = fitz.open(img_path)
                rect = img[0].rect
                pdfbytes = img.convert_to_pdf()
                img.close()
                imgPDF = fitz.open("pdf", pdfbytes)
                page = doc.new_page(width=rect.width, height=rect.height)
                page.show_pdf_page(rect, imgPDF, 0)
            
            doc.save(output_path)
            doc.close()
            return True
        except Exception as e:
            raise Exception(f"Failed to create PDF from images: {str(e)}")

    @staticmethod
    def convert_to_images(pdf_path: str, output_dir: str, format: str = 'png', dpi: int = 150) -> List[str]:
        """Convert PDF pages to images (PNG/JPG)."""
        try:
            os.makedirs(output_dir, exist_ok=True)
            doc = fitz.open(pdf_path)
            base_name = os.path.splitext(os.path.basename(pdf_path))[0]
            saved_files = []
            
            for i in range(len(doc)):
                page = doc[i]
                mat = fitz.Matrix(dpi / 72, dpi / 72)
                pix = page.get_pixmap(matrix=mat)
                
                output_file = os.path.join(output_dir, f"{base_name}_page_{i+1}.{format}")
                pix.save(output_file)
                saved_files.append(output_file)
                
            doc.close()
            return saved_files
        except Exception as e:
            raise Exception(f"Failed to convert PDF to images: {str(e)}")

    @staticmethod
    def update_metadata(pdf_path: str, output_path: str, metadata: Dict[str, str]) -> bool:
        """Update PDF metadata."""
        try:
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            doc = fitz.open(pdf_path)
            current_metadata = doc.metadata
            
            # Update only provided keys
            for key, value in metadata.items():
                current_metadata[key] = value
            
            doc.set_metadata(current_metadata)
            doc.save(output_path)
            doc.close()
            return True
        except Exception as e:
            raise Exception(f"Failed to update metadata: {str(e)}")
