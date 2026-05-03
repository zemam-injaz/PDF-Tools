import os
from typing import List
import fitz  # pymupdf

class PDFService:
    @staticmethod
    def get_pdf_info(path: str):
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
        try:
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
        e.g., [3] means File 1 has pages 1-2, File 2 has pages 3-End.
        """
        try:
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
        """
        Compress PDF.
        level 0: none
        level 1: clean
        level 2: clean + deflate
        level 3: clean + deflate + garbage=4
        level 4: clean + deflate + garbage=4 + linear
        """
        try:
            doc = fitz.open(input_path)
            
            garbage = 0
            deflate = False
            clean = False
            linear = False
            
            if compression_level >= 1:
                clean = True
            if compression_level >= 2:
                deflate = True
            if compression_level >= 3:
                garbage = 4
            if compression_level >= 4:
                linear = True
                
            doc.save(output_path, garbage=garbage, deflate=deflate, clean=clean, linear=linear)
            doc.close()
            return True
        except Exception as e:
            raise Exception(f"Compression failed: {str(e)}")

    @staticmethod
    def extract_images(input_path: str, output_dir: str) -> List[str]:
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
