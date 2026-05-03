"""Enhanced Watermark Service - Add text/image watermarks and advanced removal"""
import os
from typing import Dict, Any, Optional, List
import fitz  # pymupdf


class WatermarkService:
    """Comprehensive watermark operations for PDF files"""

    POSITIONS = {
        'center': (0.5, 0.5),
        'top-left': (0.1, 0.1),
        'top-center': (0.5, 0.1),
        'top-right': (0.9, 0.1),
        'middle-left': (0.1, 0.5),
        'middle-right': (0.9, 0.5),
        'bottom-left': (0.1, 0.9),
        'bottom-center': (0.5, 0.9),
        'bottom-right': (0.9, 0.9),
    }

    # Known watermark keywords to detect
    WATERMARK_KEYWORDS = [
        "watermark", "trial", "demo", "sample", "confidential", "draft", 
        "preview", "evaluation", "unregistered", "free version", "trial version",
        "updf", "www.updf.com", "foxit", "nitro", "pdf-xchange"
    ]

    @staticmethod
    def add_text_watermark(pdf_path: str, output_path: str, text: str,
                           position: str = 'center', opacity: float = 0.5,
                           font_size: int = 50, color: str = '#808080',
                           rotation: int = 45, pages: str = 'all') -> Dict[str, Any]:
        """
        Add text watermark to PDF pages.
        
        Args:
            pdf_path: Source PDF
            output_path: Output PDF
            text: Watermark text
            position: Position (center, top-left, etc.)
            opacity: Opacity 0.0-1.0
            font_size: Font size in points
            color: Hex color string
            rotation: Rotation angle in degrees
            pages: 'all' or comma-separated page numbers
        """
        try:
            doc = fitz.open(pdf_path)

            # Parse color from hex
            color = color.lstrip('#')
            r = int(color[0:2], 16) / 255
            g = int(color[2:4], 16) / 255
            b = int(color[4:6], 16) / 255

            # Get position ratios
            pos_ratios = WatermarkService.POSITIONS.get(position, (0.5, 0.5))

            # Parse page range
            if pages == 'all':
                page_indices = range(doc.page_count)
            else:
                page_indices = []
                for p in pages.split(','):
                    p = p.strip()
                    if '-' in p:
                        start, end = p.split('-')
                        page_indices.extend(range(int(start)-1, int(end)))
                    else:
                        page_indices.append(int(p)-1)

            watermarked = 0
            for page_idx in page_indices:
                if 0 <= page_idx < doc.page_count:
                    page = doc[page_idx]
                    rect = page.rect
                    x = rect.width * pos_ratios[0]
                    y = rect.height * pos_ratios[1]

                    # Create text with rotation
                    page.insert_text(
                        (x, y),
                        text,
                        fontsize=font_size,
                        color=(r, g, b),
                        rotate=rotation,
                        overlay=True,
                    )
                    watermarked += 1

            doc.save(output_path)
            doc.close()
            return {
                "pages_watermarked": watermarked,
                "text": text,
                "position": position
            }
        except Exception as e:
            raise Exception(f"Add text watermark failed: {str(e)}")

    @staticmethod
    def add_image_watermark(pdf_path: str, output_path: str, image_path: str,
                            position: str = 'center', opacity: float = 0.5,
                            scale: float = 0.3, pages: str = 'all') -> Dict[str, Any]:
        """
        Add image watermark to PDF pages.
        
        Args:
            pdf_path: Source PDF
            output_path: Output PDF
            image_path: Path to watermark image (PNG, JPG)
            position: Position on page
            opacity: Transparency level
            scale: Scale factor (0.1-1.0)
            pages: 'all' or page numbers
        """
        try:
            doc = fitz.open(pdf_path)
            
            # Read image dimensions
            img_doc = fitz.open(image_path)
            if len(img_doc) > 0:
                img_rect = img_doc[0].rect
            else:
                # Fallback for non-PDF images
                img_rect = fitz.Rect(0, 0, 200, 200)
            img_doc.close()

            pos_ratios = WatermarkService.POSITIONS.get(position, (0.5, 0.5))

            # Parse page range
            if pages == 'all':
                page_indices = range(doc.page_count)
            else:
                page_indices = [int(p.strip())-1 for p in pages.split(',') if p.strip().isdigit()]

            watermarked = 0
            for page_idx in page_indices:
                if 0 <= page_idx < doc.page_count:
                    page = doc[page_idx]
                    rect = page.rect

                    # Calculate scaled image size
                    img_width = rect.width * scale
                    img_height = img_width * (img_rect.height / max(img_rect.width, 1))

                    # Calculate position
                    x = rect.width * pos_ratios[0] - img_width / 2
                    y = rect.height * pos_ratios[1] - img_height / 2

                    watermark_rect = fitz.Rect(x, y, x + img_width, y + img_height)
                    page.insert_image(watermark_rect, filename=image_path, overlay=True)
                    watermarked += 1

            doc.save(output_path)
            doc.close()
            return {
                "pages_watermarked": watermarked,
                "image": os.path.basename(image_path)
            }
        except Exception as e:
            raise Exception(f"Add image watermark failed: {str(e)}")

    @staticmethod
    def remove_watermark(pdf_path: str, output_path: str,
                         aggressive: bool = False,
                         target_updf: bool = True,
                         target_urls: bool = True,
                         remove_corner_images: bool = True) -> Dict[str, Any]:
        """
        Enhanced watermark removal using multiple detection methods.
        
        Args:
            pdf_path: Source PDF
            output_path: Output PDF
            aggressive: If True, use more aggressive removal (may affect content)
            target_updf: Target UPDF and similar watermarks
            target_urls: Remove URL-like text
            remove_corner_images: Remove small images in corners
        """
        try:
            doc = fitz.open(pdf_path)
            removed_count = 0
            details = []

            # Build keyword list
            keywords = list(WatermarkService.WATERMARK_KEYWORDS)
            if target_urls:
                keywords.extend(["www.", ".com", ".net", ".org", "http://", "https://"])

            for page_num in range(doc.page_count):
                page = doc[page_num]
                page_rect = page.rect
                page_removed = 0

                # Method 1: Remove watermark annotations
                annots_to_delete = []
                for annot in page.annots():
                    annot_type = annot.type[0]
                    # Stamp, FreeText, and similar annotation types often used for watermarks
                    if annot_type in [8, 9, 10, 13]:  # Stamp, FreeText, etc.
                        annots_to_delete.append(annot)

                for annot in annots_to_delete:
                    page.delete_annot(annot)
                    page_removed += 1

                # Method 2: Remove small corner images (likely logos/watermarks)
                if remove_corner_images:
                    image_list = page.get_images()
                    for img in image_list:
                        try:
                            img_rects = page.get_image_rects(img[0])
                            for rect in img_rects:
                                img_width = rect.width
                                img_height = rect.height

                                # Check if in corner and small
                                is_corner = (
                                    (rect.x0 < page_rect.width * 0.3 and rect.y0 < page_rect.height * 0.2) or  # Top-left
                                    (rect.x1 > page_rect.width * 0.7 and rect.y0 < page_rect.height * 0.2) or  # Top-right
                                    (rect.x0 < page_rect.width * 0.3 and rect.y1 > page_rect.height * 0.8) or  # Bottom-left
                                    (rect.x1 > page_rect.width * 0.7 and rect.y1 > page_rect.height * 0.8)     # Bottom-right
                                )
                                is_small = img_width < 200 and img_height < 150

                                if is_corner and is_small:
                                    # Cover with white rectangle
                                    page.draw_rect(rect, color=(1, 1, 1), fill=(1, 1, 1))
                                    page_removed += 1
                        except:
                            continue

                # Method 3: Remove text matching watermark patterns
                text_instances = page.get_text("dict")
                for block in text_instances.get("blocks", []):
                    if "lines" in block:
                        for line in block["lines"]:
                            for span in line.get("spans", []):
                                text = span.get("text", "").strip().lower()
                                font_size = span.get("size", 12)

                                # Check if matches watermark patterns
                                is_watermark = any(kw in text for kw in keywords)
                                is_small_url = target_urls and len(text) < 50 and ("www." in text or ".com" in text)

                                # In aggressive mode, also remove small isolated text
                                is_suspicious = aggressive and font_size < 10 and len(text) < 30

                                if is_watermark or is_small_url or is_suspicious:
                                    bbox = span.get("bbox")
                                    if bbox:
                                        rect = fitz.Rect(bbox)
                                        rect.x0 -= 2
                                        rect.y0 -= 2
                                        rect.x1 += 2
                                        rect.y1 += 2
                                        page.draw_rect(rect, color=(1, 1, 1), fill=(1, 1, 1))
                                        page_removed += 1

                if page_removed > 0:
                    details.append(f"Page {page_num + 1}: {page_removed} items")
                removed_count += page_removed

            # Clean and optimize output
            doc.save(output_path, garbage=4, deflate=True, clean=True)
            doc.close()

            return {
                "items_removed": removed_count,
                "aggressive_mode": aggressive,
                "pages_processed": doc.page_count,
                "details": details if details else None
            }
        except Exception as e:
            raise Exception(f"Remove watermark failed: {str(e)}")

    @staticmethod
    def detect_watermarks(pdf_path: str) -> Dict[str, Any]:
        """
        Analyze PDF to detect potential watermarks.
        Returns information about detected watermark-like elements.
        """
        try:
            doc = fitz.open(pdf_path)
            detections = []
            keywords = WatermarkService.WATERMARK_KEYWORDS

            for page_num in range(min(5, doc.page_count)):  # Check first 5 pages
                page = doc[page_num]
                page_rect = page.rect

                # Check for corner images
                for img in page.get_images():
                    try:
                        for rect in page.get_image_rects(img[0]):
                            is_corner = (rect.x0 < 100 or rect.x1 > page_rect.width - 100)
                            is_small = rect.width < 200 and rect.height < 150
                            if is_corner and is_small:
                                detections.append({
                                    "type": "corner_image",
                                    "page": page_num + 1,
                                    "position": "corner"
                                })
                    except:
                        continue

                # Check for watermark text
                text_instances = page.get_text("dict")
                for block in text_instances.get("blocks", []):
                    if "lines" in block:
                        for line in block["lines"]:
                            for span in line.get("spans", []):
                                text = span.get("text", "").strip().lower()
                                if any(kw in text for kw in keywords):
                                    detections.append({
                                        "type": "watermark_text",
                                        "page": page_num + 1,
                                        "text": span.get("text", "")[:50]
                                    })

            doc.close()
            return {
                "has_watermarks": len(detections) > 0,
                "detections": detections[:20],  # Limit to 20
                "pages_scanned": min(5, doc.page_count)
            }
        except Exception as e:
            raise Exception(f"Detect watermarks failed: {str(e)}")
