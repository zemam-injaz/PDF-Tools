"""PDF Tools Backend Server - Organized with service modules"""
import os
import sys
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Import services
from services import (
    PDFService, TextService, BookmarkService, 
    PageService, WatermarkService, SecurityService,
    BookLibraryService, AnnotationService, AnnotationModifierService,
    PDFProgressService, task_service
)
from api.subscription_routes import router as subscription_router
from api.payment_routes import router as payment_router
from api.tahweel_routes import router as tahweel_router
from api.task_routes import router as task_router

app = FastAPI(title="PDF Tools API", version="0.2.0")

app.include_router(subscription_router)
app.include_router(payment_router)
app.include_router(tahweel_router)
app.include_router(task_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== Request Models ==========

# Core PDF operations
class MergeRequest(BaseModel):
    paths: List[str]
    output_path: str
    is_async: bool = False

class SplitRequest(BaseModel):
    input_path: str
    split_pages: List[int]
    output_dir: str
    is_async: bool = False

class CompressRequest(BaseModel):
    input_path: str
    output_path: str
    compression_level: int = 2
    is_async: bool = False

class ExtractImagesRequest(BaseModel):
    input_path: str
    output_dir: str
    is_async: bool = False

class PDFInfoRequest(BaseModel):
    path: str

# Text extraction
class TextExtractRequest(BaseModel):
    pdf_path: str
    page_range: str = 'all'

class TextExtractToFileRequest(BaseModel):
    pdf_path: str
    output_path: str
    page_range: str = 'all'
    format: str = 'txt'
    merge_lines: bool = True
    font_family: str = 'Calibri'
    font_size: int = 11

# Bookmark operations
class BookmarkExtractRequest(BaseModel):
    pdf_path: str

class BookmarkSaveRequest(BaseModel):
    text: str
    output_path: str

class SplitByBookmarksRequest(BaseModel):
    pdf_path: str
    output_dir: str
    level_1_only: bool = True
    preserve_bookmarks: bool = True
    selected_indices: Optional[List[int]] = None
    ignore_hierarchy: bool = False
    target_level: Optional[int] = None

class TransferBookmarksRequest(BaseModel):
    source_path: str
    target_path: str
    output_path: str

# Page operations
class RotatePagesRequest(BaseModel):
    pdf_path: str
    output_path: str
    pages: str
    rotation: int = 90

class DeletePagesRequest(BaseModel):
    pdf_path: str
    output_path: str
    pages: str

class ExtractPagesRequest(BaseModel):
    pdf_path: str
    output_path: str
    pages: str

class ReorderPagesRequest(BaseModel):
    pdf_path: str
    output_path: str
    new_order: List[int]

class InsertPagesRequest(BaseModel):
    target_pdf: str
    source_pdf: str
    output_path: str
    insert_after_page: int
    source_pages: str = 'all'

# Watermark operations
class TextWatermarkRequest(BaseModel):
    pdf_path: str
    output_path: str
    text: str
    position: str = 'center'
    opacity: float = 0.5
    font_size: int = 50
    color: str = '#808080'
    rotation: int = 45

class ImageWatermarkRequest(BaseModel):
    pdf_path: str
    output_path: str
    image_path: str
    position: str = 'center'
    opacity: float = 0.5
    scale: float = 0.3

class RemoveWatermarkRequest(BaseModel):
    pdf_path: str
    output_path: str
    aggressive: bool = False
    remove_images: bool = False

# Security operations
class SecurityCheckRequest(BaseModel):
    pdf_path: str

class RemoveSecurityRequest(BaseModel):
    pdf_path: str
    output_path: str
    password: Optional[str] = None

# Book Library operations
class AddBookRequest(BaseModel):
    file_path: str

class AddBooksRequest(BaseModel):
    file_paths: List[str]

class UpdateBookRequest(BaseModel):
    title: Optional[str] = None
    pages_read: Optional[int] = None
    is_starred: Optional[bool] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None

class AnnotationExtractRequest(BaseModel):
    pdf_path: str

# New Tools Requests
class ImagesToPDFRequest(BaseModel):
    image_paths: List[str]
    output_path: str

class PDFToImagesRequest(BaseModel):
    pdf_path: str
    output_dir: str
    format: str = 'png'
    dpi: int = 150

class MetadataUpdateRequest(BaseModel):
    pdf_path: str
    output_path: str
    metadata: Dict[str, str]

# Annotations
class AddAnnotationRequest(BaseModel):
    id: Optional[str] = None
    book_id: str
    page: int
    type: str # 'text' | 'dot' | 'timestamp'
    x: float
    y: float
    data: Dict[str, Any]

class BurnAnnotationsRequest(BaseModel):
    pdf_path: str
    output_path: str
    annotations: List[Dict[str, Any]]


# PDF Progress/Activity Tracking operations
class ScanDirectoryRequest(BaseModel):
    directory: str
    recursive: bool = True

class ExportMarkdownRequest(BaseModel):
    pdf_path: str

class RenderPageRequest(BaseModel):
    pdf_path: str
    page: int = 1
    dpi: int = 150

class SaveFileRequest(BaseModel):
    file_path: str
    content: str
    encoding: str = "utf-8"

class OpenFileRequest(BaseModel):
    file_path: str

class ExtractBookmarksRequest(BaseModel):
    pdf_path: str

class ParseTocTextRequest(BaseModel):
    text: str
    consider_levels: bool = True

# ========== API Endpoints ==========

@app.get("/health")
def health_check():
    return {"status": "ok", "version": "0.2.0"}

# --- System Operations ---
@app.post("/api/system/save-file")
def save_file(request: SaveFileRequest):
    """Save content to a file"""
    try:
        # Validate path (security check - allow only specific extensions or paths if needed)
        # For now, we trust the local user but ensure directory exists
        os.makedirs(os.path.dirname(request.file_path), exist_ok=True)
        
        with open(request.file_path, "w", encoding=request.encoding) as f:
            f.write(request.content)
            
        return {"status": "success", "message": "File saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

@app.post("/api/system/open-url")
def open_system_url(request: OpenFileRequest):
    """Open a URL with the system default browser"""
    try:
        import webbrowser
        webbrowser.open(request.file_path)
        return {"status": "success", "message": "URL opened"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open URL: {str(e)}")

@app.post("/api/system/open-file")
def open_system_file(request: OpenFileRequest):
    """Open a file with the system default application"""
    try:
        if not os.path.exists(request.file_path):
            raise HTTPException(status_code=404, detail="File not found")
            
        if os.name == 'nt':  # Windows
            os.startfile(request.file_path)
        elif os.name == 'posix':  # macOS and Linux
            import subprocess
            if sys.platform == 'darwin':
                subprocess.call(('open', request.file_path))
            else:
                subprocess.call(('xdg-open', request.file_path))
                
        return {"status": "success", "message": "File opened"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open file: {str(e)}")


@app.post("/api/pdf/render-page")
def render_page(request: RenderPageRequest):
    """Render a PDF page as a base64 PNG image"""
    import fitz
    import base64
    try:
        doc = fitz.open(request.pdf_path)
        total_pages = doc.page_count  # Store before closing
        
        if request.page < 1 or request.page > total_pages:
            doc.close()
            raise HTTPException(status_code=400, detail="Invalid page number")
        
        page = doc[request.page - 1]  # 0-indexed
        mat = fitz.Matrix(request.dpi / 72, request.dpi / 72)
        pix = page.get_pixmap(matrix=mat)
        
        img_data = pix.tobytes("png")
        base64_img = f"data:image/png;base64,{base64.b64encode(img_data).decode()}"
        
        width = pix.width
        height = pix.height
        
        doc.close()
        return {
            "status": "success",
            "data": {
                "image": base64_img,
                "page": request.page,
                "total_pages": total_pages,
                "width": width,
                "height": height
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Core PDF Operations ---
@app.post("/api/merge")
def merge_pdfs(request: MergeRequest):
    try:
        if request.is_async:
            task_id = task_service.create_task("merge")
            task_service.run_background_task(task_id, PDFService.merge_pdfs, request.paths, request.output_path)
            return {"status": "success", "task_id": task_id}
        PDFService.merge_pdfs(request.paths, request.output_path)
        return {"status": "success", "message": "PDFs merged successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/split")
def split_pdf(request: SplitRequest):
    try:
        if request.is_async:
            task_id = task_service.create_task("split")
            task_service.run_background_task(task_id, PDFService.split_pdf, request.input_path, request.split_pages, request.output_dir)
            return {"status": "success", "task_id": task_id}
        files = PDFService.split_pdf(request.input_path, request.split_pages, request.output_dir)
        return {"status": "success", "files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/compress")
def compress_pdf(request: CompressRequest):
    try:
        if request.is_async:
            task_id = task_service.create_task("compress")
            task_service.run_background_task(task_id, PDFService.compress_pdf, request.input_path, request.output_path, request.compression_level)
            return {"status": "success", "task_id": task_id}
        PDFService.compress_pdf(request.input_path, request.output_path, request.compression_level)
        return {"status": "success", "message": "PDF compressed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/extract-images")
def extract_images(request: ExtractImagesRequest):
    try:
        if request.is_async:
            task_id = task_service.create_task("extract_images")
            task_service.run_background_task(task_id, PDFService.extract_images, request.input_path, request.output_dir)
            return {"status": "success", "task_id": task_id}
        files = PDFService.extract_images(request.input_path, request.output_dir)
        return {"status": "success", "files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/info")
def get_info(request: PDFInfoRequest):
    try:
        return PDFService.get_pdf_info(request.path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/create/from-images")
def create_from_images(request: ImagesToPDFRequest):
    try:
        PDFService.create_from_images(request.image_paths, request.output_path)
        return {"status": "success", "message": "PDF created successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/convert/to-images")
def convert_to_images(request: PDFToImagesRequest):
    try:
        files = PDFService.convert_to_images(request.pdf_path, request.output_dir, request.format, request.dpi)
        return {"status": "success", "files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/metadata/update")
def update_metadata(request: MetadataUpdateRequest):
    try:
        PDFService.update_metadata(request.pdf_path, request.output_path, request.metadata)
        return {"status": "success", "message": "Metadata updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Text Extraction ---
@app.post("/api/text/extract")
def extract_text(request: TextExtractRequest):
    try:
        result = TextService.extract_text(request.pdf_path, request.page_range)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/text/extract-to-file")
def extract_text_to_file(request: TextExtractToFileRequest):
    try:
        result = TextService.extract_to_file(
            request.pdf_path, request.output_path, 
            request.page_range, request.format,
            request.merge_lines, request.font_family, request.font_size
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Bookmark Operations ---
@app.post("/api/bookmarks/extract")
def extract_bookmarks(request: BookmarkExtractRequest):
    try:
        result = BookmarkService.extract_bookmarks(request.pdf_path)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/bookmarks/save")
def save_bookmarks(request: BookmarkSaveRequest):
    try:
        BookmarkService.save_bookmarks(request.text, request.output_path)
        return {"status": "success", "message": "Bookmarks saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/bookmarks/split")
def split_by_bookmarks(request: SplitByBookmarksRequest):
    try:
        result = BookmarkService.split_by_bookmarks(
            request.pdf_path, request.output_dir,
            request.level_1_only, request.preserve_bookmarks,
            request.selected_indices,
            ignore_hierarchy=request.ignore_hierarchy,
            target_level=request.target_level
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class BookmarkItem(BaseModel):
    title: str
    page: int
    level: int = 1

class InsertBookmarksRequest(BaseModel):
    pdf_path: str
    bookmarks: List[BookmarkItem]
    output_path: str
    page_offset: int = 0

@app.post("/api/bookmarks/insert")
def insert_bookmarks(request: InsertBookmarksRequest):
    try:
        bookmarks_list = [{"title": bm.title, "page": bm.page, "level": bm.level} for bm in request.bookmarks]
        result = BookmarkService.insert_bookmarks(
            request.pdf_path, bookmarks_list, request.output_path, request.page_offset
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/bookmarks/parse-text")
def parse_toc_text(request: ParseTocTextRequest):
    try:
        bookmarks = BookmarkService.parse_toc_text(request.text, request.consider_levels)
        # Convert Bookmark objects to dicts
        result = [{"title": b.title, "page": b.page, "level": b.level} for b in bookmarks]
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/bookmarks/transfer")
def transfer_bookmarks(request: TransferBookmarksRequest):
    try:
        result = BookmarkService.transfer_bookmarks(
            request.source_path, request.target_path, request.output_path
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/bookmarks/levels")
def get_bookmark_levels(request: ExtractBookmarksRequest):
    try:
        result = BookmarkService.get_bookmark_levels(request.pdf_path)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Page Operations ---
@app.post("/api/pages/rotate")
def rotate_pages(request: RotatePagesRequest):
    try:
        result = PageService.rotate_pages(
            request.pdf_path, request.output_path, 
            request.pages, request.rotation
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/pages/delete")
def delete_pages(request: DeletePagesRequest):
    try:
        result = PageService.delete_pages(
            request.pdf_path, request.output_path, request.pages
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/pages/extract")
def extract_pages(request: ExtractPagesRequest):
    try:
        result = PageService.extract_pages(
            request.pdf_path, request.output_path, request.pages
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/pages/reorder")
def reorder_pages(request: ReorderPagesRequest):
    try:
        result = PageService.reorder_pages(
            request.pdf_path, request.output_path, request.new_order
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/pages/insert")
def insert_pages(request: InsertPagesRequest):
    try:
        result = PageService.insert_pages(
            request.target_pdf, request.source_pdf, request.output_path,
            request.insert_after_page, request.source_pages
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Watermark Operations ---
@app.post("/api/watermark/text")
def add_text_watermark(request: TextWatermarkRequest):
    try:
        result = WatermarkService.add_text_watermark(
            request.pdf_path, request.output_path, request.text,
            request.position, request.opacity, request.font_size,
            request.color, request.rotation
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/watermark/image")
def add_image_watermark(request: ImageWatermarkRequest):
    try:
        result = WatermarkService.add_image_watermark(
            request.pdf_path, request.output_path, request.image_path,
            request.position, request.opacity, request.scale
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/watermark/remove")
def remove_watermark(request: RemoveWatermarkRequest):
    try:
        result = WatermarkService.remove_watermark(
            request.pdf_path, request.output_path,
            request.aggressive, request.remove_images
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Security Operations ---
@app.post("/api/security/check")
def check_security(request: SecurityCheckRequest):
    try:
        result = SecurityService.check_security(request.pdf_path)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/security/remove")
def remove_security(request: RemoveSecurityRequest):
    try:
        result = SecurityService.remove_security(
            request.pdf_path, request.output_path, request.password
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Annotation Operations ---
@app.post("/api/annotations/extract")
def extract_annotations(request: AnnotationExtractRequest):
    """Extract annotations/comments from a PDF"""
    try:
        annotations = AnnotationService.extract_annotations(request.pdf_path)
        return {"status": "success", "data": annotations}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/annotations/book/{book_id}")
def get_annotations(book_id: str):
    """Get stored annotations for a specific book"""
    try:
        print(f"[DEBUG] Fetching annotations for book: {book_id}")
        annotations = AnnotationService.get_annotations_for_book(book_id)
        return {"status": "success", "data": annotations}
    except Exception as e:
        print(f"[ERROR] get_annotations failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/annotations/save")
def add_annotation(request: AddAnnotationRequest):
    """Add a new annotation to the database"""
    try:
        data_dict = request.model_dump()
        print(f"[DEBUG] Saving annotation: {data_dict}")
        from models.annotation import Annotation
        from datetime import datetime
        from uuid import uuid4
        
        id_val = request.id or str(uuid4())
        
        annotation = Annotation(
            id=id_val,
            book_id=request.book_id,
            page=request.page,
            type=request.type,
            x=request.x,
            y=request.y,
            data=request.data,
            created_at=datetime.utcnow()
        )
        
        result = AnnotationService.add_annotation(annotation)
        res_dict = result.model_dump()
        res_dict['created_at'] = result.created_at.isoformat()
        print(f"[DEBUG] Annotation saved successfully: {id_val}")
        return {"status": "success", "data": res_dict}
    except Exception as e:
        print(f"[ERROR] add_annotation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/annotations/{annotation_id}")
def update_annotation(annotation_id: str, request: Dict[str, Any]):
    """Update an existing annotation's data"""
    try:
        # Expecting 'data' in request
        if "data" not in request:
            raise HTTPException(status_code=400, detail="Missing 'data' field")
            
        success = AnnotationService.update_annotation_data(annotation_id, request["data"])
        if success:
            return {"status": "success"}
        else:
            raise HTTPException(status_code=404, detail="Annotation not found")
    except Exception as e:
        print(f"[ERROR] update_annotation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/annotations/{annotation_id}")
def delete_annotation(annotation_id: str):
    """Delete an annotation by ID"""
    try:
        success = AnnotationService.delete_annotation(annotation_id)
        if not success:
            raise HTTPException(status_code=404, detail="Annotation not found")
        return {"status": "success", "message": "Annotation deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/annotations/burn")
def burn_annotations(request: BurnAnnotationsRequest):
    """Burn decorations (dots, labels) into a copy of the PDF"""
    try:
        success = AnnotationModifierService.burn_annotations(
            request.pdf_path, request.output_path, request.annotations
        )
        if not success:
            raise HTTPException(status_code=500, detail="Failed to burn annotations")
        return {"status": "success", "message": "Annotations burned into PDF successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Book Library Operations ---
@app.get("/api/books")
def get_all_books(
    sort_by: str = "date_added",
    order: str = "desc",
    category: Optional[str] = None,
    starred_only: bool = False
):
    """Get all books from the library"""
    try:
        books = BookLibraryService.get_all_books(sort_by, order, category, starred_only)
        return {"status": "success", "data": {"books": books, "total_count": len(books)}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/books")
def add_book(request: AddBookRequest):
    """Add a single book to the library"""
    try:
        book = BookLibraryService.add_book(request.file_path)
        return {"status": "success", "data": book}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/books/batch")
def add_books(request: AddBooksRequest):
    """Add multiple books to the library"""
    try:
        result = BookLibraryService.add_books(request.file_paths)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/books/{book_id}")
def get_book(book_id: int):
    """Get a single book by ID"""
    try:
        book = BookLibraryService.get_book(book_id)
        if not book:
            raise HTTPException(status_code=404, detail="Book not found")
        return {"status": "success", "data": book}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/books/{book_id}")
def update_book(book_id: int, request: UpdateBookRequest):
    """Update book metadata"""
    try:
        updates = {k: v for k, v in request.model_dump().items() if v is not None}
        book = BookLibraryService.update_book(book_id, updates)
        if not book:
            raise HTTPException(status_code=404, detail="Book not found")
        return {"status": "success", "data": book}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/books/{book_id}/toggle-star")
def toggle_star(book_id: int):
    """Toggle the starred status of a book"""
    try:
        result = BookLibraryService.toggle_star(book_id)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/books/{book_id}/opened")
def mark_book_opened(book_id: int):
    """Update the last opened timestamp"""
    try:
        BookLibraryService.update_last_opened(book_id)
        return {"status": "success", "message": "Last opened updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/books/{book_id}")
def delete_book(book_id: int):
    """Delete a book from the library"""
    try:
        deleted = BookLibraryService.delete_book(book_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Book not found")
        return {"status": "success", "message": "Book deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/books/categories/list")
def get_categories():
    """Get all unique categories"""
    try:
        categories = BookLibraryService.get_categories()
        return {"status": "success", "data": {"categories": categories}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/books/search/{query}")
def search_books(query: str):
    """Search books by title"""
    try:
        books = BookLibraryService.search_books(query)
        return {"status": "success", "data": {"books": books}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




@app.post("/api/system/reveal-file")
def system_reveal_file(request: AddBookRequest):
    """Reveal a file in the system file explorer"""
    try:
        file_path = request.file_path
        # Normalize path but keep it absolute
        file_path = os.path.abspath(file_path)
        
        if os.name == 'nt':  # Windows
            import subprocess
            # Use Popen to detach process
            subprocess.Popen(f'explorer /select,"{file_path}"')
        elif os.name == 'posix':  # macOS / Linux
            import subprocess
            if os.uname().sysname == 'Darwin':
                subprocess.call(('open', '-R', file_path))
            else:
                subprocess.call(('xdg-open', os.path.dirname(file_path)))
            
        return {"status": "success", "message": "File revealed"}
    except Exception as e:
        print(f"Error revealing file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- PDF Progress/Activity Tracking Operations ---
@app.post("/api/progress/scan")
def scan_directory(request: ScanDirectoryRequest):
    """Scan a directory for PDF files and analyze annotations"""
    try:
        result = PDFProgressService.scan_directory(request.directory, request.recursive)
        return {"status": "success", "data": result}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/progress/list")
def get_pdf_list(
    filter_annotated: bool = False,
    sort_by: str = "last_scanned",
    order: str = "desc",
    search: Optional[str] = None
):
    """Get list of scanned PDFs"""
    try:
        pdf_list = PDFProgressService.get_pdf_list(filter_annotated, sort_by, order, search)
        return {"status": "success", "data": {"pdfs": pdf_list, "total_count": len(pdf_list)}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/progress/statistics")
def get_statistics():
    """Get PDF reading statistics"""
    try:
        stats = PDFProgressService.get_statistics()
        return {"status": "success", "data": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/progress/export/markdown")
def export_markdown(request: ExportMarkdownRequest):
    """Export annotations from a PDF to markdown"""
    try:
        content = PDFProgressService.export_to_markdown(request.pdf_path)
        return {"status": "success", "data": {"markdown": content}}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/progress/pdf")
def delete_pdf_record(pdf_path: str):
    """Delete a PDF from the progress database (not the file itself)"""
    try:
        deleted = PDFProgressService.delete_pdf(pdf_path)
        if not deleted:
            raise HTTPException(status_code=404, detail="PDF not found in database")
        return {"status": "success", "message": "PDF record deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/progress/clear")
def clear_all_progress():
    """Clear all PDF progress data"""
    try:
        count = PDFProgressService.clear_all()
        return {"status": "success", "message": f"Cleared {count} PDF records"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8002))
    uvicorn.run(app, host="127.0.0.1", port=port)

