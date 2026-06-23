import os
import pytest
import fitz
from services.page_service import PageService
from services.book_library_service import BookLibraryService
from services.annotation_service import AnnotationService
from services.annotation_modifier_service import AnnotationModifierService
from services.pdf_progress_service import PDFProgressService
from services.subscription_service import subscription_service
from models.annotation import Annotation
from models.subscription import SubscriptionStatus

# ----------------------------------------------------------------------
# PageService Tests
# ----------------------------------------------------------------------

def test_page_service_parse_range():
    # Test odd, even, all, custom ranges
    assert PageService.parse_page_range("all", 5) == [0, 1, 2, 3, 4]
    assert PageService.parse_page_range("odd", 5) == [0, 2, 4]  # page 1, 3, 5 (0-indexed: 0, 2, 4)
    assert PageService.parse_page_range("even", 5) == [1, 3]    # page 2, 4 (0-indexed: 1, 3)
    assert PageService.parse_page_range("1-3, 5", 5) == [0, 1, 2, 4]
    assert PageService.parse_page_range("2-2", 5) == [1]

def test_page_service_rotate(temp_dir, create_dummy_pdf):
    pdf = os.path.join(temp_dir, "to_rotate.pdf")
    out_pdf = os.path.join(temp_dir, "rotated.pdf")
    create_dummy_pdf(pdf, num_pages=3)

    res = PageService.rotate_pages(pdf, out_pdf, "1,3", 90)
    assert res["pages_rotated"] == 2
    assert res["rotation"] == 90

    # Verify rotation was applied
    doc = fitz.open(out_pdf)
    assert doc[0].rotation == 90
    assert doc[1].rotation == 0
    assert doc[2].rotation == 90
    doc.close()

def test_page_service_delete(temp_dir, create_dummy_pdf):
    pdf = os.path.join(temp_dir, "to_delete.pdf")
    out_pdf = os.path.join(temp_dir, "deleted.pdf")
    create_dummy_pdf(pdf, num_pages=4)

    res = PageService.delete_pages(pdf, out_pdf, "2,4")
    assert res["pages_deleted"] == 2
    assert res["original_pages"] == 4
    assert res["remaining_pages"] == 2

    # Verify pages remaining
    doc = fitz.open(out_pdf)
    assert doc.page_count == 2
    # Verify remaining text content
    assert "Page 1" in doc[0].get_text()
    assert "Page 3" in doc[1].get_text()
    doc.close()

def test_page_service_extract(temp_dir, create_dummy_pdf):
    pdf = os.path.join(temp_dir, "to_extract.pdf")
    out_pdf = os.path.join(temp_dir, "extracted.pdf")
    create_dummy_pdf(pdf, num_pages=5)

    res = PageService.extract_pages(pdf, out_pdf, "2-4")
    assert res["pages_extracted"] == 3

    doc = fitz.open(out_pdf)
    assert doc.page_count == 3
    assert "Page 2" in doc[0].get_text()
    assert "Page 4" in doc[2].get_text()
    doc.close()

def test_page_service_reorder(temp_dir, create_dummy_pdf):
    pdf = os.path.join(temp_dir, "to_reorder.pdf")
    out_pdf = os.path.join(temp_dir, "reordered.pdf")
    create_dummy_pdf(pdf, num_pages=3)

    res = PageService.reorder_pages(pdf, out_pdf, [3, 1, 2])
    assert res["pages_reordered"] == 3

    doc = fitz.open(out_pdf)
    assert doc.page_count == 3
    assert "Page 3" in doc[0].get_text()
    assert "Page 1" in doc[1].get_text()
    assert "Page 2" in doc[2].get_text()
    doc.close()

def test_page_service_insert(temp_dir, create_dummy_pdf):
    pdf1 = os.path.join(temp_dir, "target.pdf")
    pdf2 = os.path.join(temp_dir, "source.pdf")
    out_pdf = os.path.join(temp_dir, "inserted.pdf")
    create_dummy_pdf(pdf1, num_pages=2, text_content="Target")
    create_dummy_pdf(pdf2, num_pages=3, text_content="Source")

    res = PageService.insert_pages(pdf1, pdf2, out_pdf, insert_after_page=1, source_pages="odd")
    assert res["pages_inserted"] == 2
    assert res["insert_position"] == 1
    assert res["total_pages"] == 4

    doc = fitz.open(out_pdf)
    assert doc.page_count == 4
    assert "Target - Page 1" in doc[0].get_text()
    assert "Source - Page 1" in doc[1].get_text()
    assert "Source - Page 3" in doc[2].get_text()
    assert "Target - Page 2" in doc[3].get_text()
    doc.close()

def test_page_service_reverse(temp_dir, create_dummy_pdf):
    pdf = os.path.join(temp_dir, "to_reverse.pdf")
    out_pdf = os.path.join(temp_dir, "reversed.pdf")
    create_dummy_pdf(pdf, num_pages=3)

    res = PageService.reverse_pages(pdf, out_pdf)
    assert res["pages_reordered"] == 3

    doc = fitz.open(out_pdf)
    assert doc.page_count == 3
    assert "Page 3" in doc[0].get_text()
    assert "Page 1" in doc[2].get_text()
    doc.close()

def test_page_service_duplicate(temp_dir, create_dummy_pdf):
    pdf = os.path.join(temp_dir, "to_duplicate.pdf")
    out_pdf = os.path.join(temp_dir, "duplicated.pdf")
    create_dummy_pdf(pdf, num_pages=3)

    res = PageService.duplicate_pages(pdf, out_pdf, "1,3", copies=2)
    assert res["duplicated_pages"] == 2
    assert res["copies_per_page"] == 2
    assert res["new_page_count"] == 7  # 3 + 2*2 = 7

    doc = fitz.open(out_pdf)
    assert doc.page_count == 7
    # Original order is [1, 2, 3]
    # Duplicating 1 and 3 by 2 copies: [1, 1, 1, 2, 3, 3, 3] (since duplicate_pages inserts copies right after original)
    assert "Page 1" in doc[0].get_text()
    assert "Page 1" in doc[1].get_text()
    assert "Page 1" in doc[2].get_text()
    assert "Page 2" in doc[3].get_text()
    assert "Page 3" in doc[4].get_text()
    assert "Page 3" in doc[5].get_text()
    assert "Page 3" in doc[6].get_text()
    doc.close()

def test_page_service_split_every_n(temp_dir, create_dummy_pdf):
    pdf = os.path.join(temp_dir, "to_split_every.pdf")
    out_dir = os.path.join(temp_dir, "split_parts")
    create_dummy_pdf(pdf, num_pages=5)

    res = PageService.split_every_n_pages(pdf, out_dir, n=2)
    assert res["total_files"] == 3
    assert len(res["files_created"]) == 3
    assert res["pages_per_file"] == 2

    # Verify each part
    doc1 = fitz.open(res["files_created"][0])
    assert doc1.page_count == 2
    doc1.close()

    doc3 = fitz.open(res["files_created"][2])
    assert doc3.page_count == 1
    doc3.close()


# ----------------------------------------------------------------------
# BookLibraryService Tests
# ----------------------------------------------------------------------

def test_book_library_service(temp_dir, create_dummy_pdf):
    pdf1 = os.path.join(temp_dir, "lib_book1.pdf")
    pdf2 = os.path.join(temp_dir, "lib_book2.pdf")
    create_dummy_pdf(pdf1, num_pages=10)
    create_dummy_pdf(pdf2, num_pages=20)

    # Add book
    book1 = BookLibraryService.add_book(pdf1)
    assert book1["title"] == "lib_book1"
    assert book1["total_pages"] == 10
    assert book1["pages_read"] == 0
    assert book1["is_starred"] is False
    assert book1["category"] == "غير مصنف"

    # Add multiple
    res_batch = BookLibraryService.add_books([pdf1, pdf2])
    assert res_batch["added_count"] == 1  # pdf1 skipped (already exists)
    assert res_batch["skipped_count"] == 1
    book2 = res_batch["added"][0]
    assert book2["title"] == "lib_book2"

    # Get book by ID
    fetched_book = BookLibraryService.get_book(book1["id"])
    assert fetched_book is not None
    assert fetched_book["title"] == "lib_book1"

    # Search books
    search_res = BookLibraryService.search_books("book")
    assert len(search_res) == 2

    # Get all books
    all_books = BookLibraryService.get_all_books(sort_by="title", order="asc")
    assert len(all_books) == 2
    assert all_books[0]["title"] == "lib_book1"
    assert all_books[1]["title"] == "lib_book2"

    # Toggle star
    star_res = BookLibraryService.toggle_star(book1["id"])
    assert star_res["is_starred"] is True
    assert BookLibraryService.get_book(book1["id"])["is_starred"] is True

    # Update metadata
    updates = {"category": "أبحاث", "notes": "رائع", "pages_read": 5, "priority": "High"}
    updated_book = BookLibraryService.update_book(book1["id"], updates)
    assert updated_book["category"] == "أبحاث"
    assert updated_book["notes"] == "رائع"
    assert updated_book["pages_read"] == 5
    assert updated_book["reading_percentage"] == 50.0
    assert updated_book["priority"] == "High"

    # Get unique categories
    categories = BookLibraryService.get_categories()
    assert "أبحاث" in categories

    # Update last opened
    BookLibraryService.update_last_opened(book1["id"])
    assert BookLibraryService.get_book(book1["id"])["last_opened"] is not None

    # Delete book
    deleted = BookLibraryService.delete_book(book1["id"])
    assert deleted is True
    assert BookLibraryService.get_book(book1["id"]) is None


# ----------------------------------------------------------------------
# AnnotationService & AnnotationModifierService Tests
# ----------------------------------------------------------------------

def test_annotation_service_and_modifier(temp_dir, create_dummy_pdf):
    pdf = os.path.join(temp_dir, "annotated_src.pdf")
    out_pdf = os.path.join(temp_dir, "annotated_burned.pdf")
    create_dummy_pdf(pdf, num_pages=2)

    # 1. Test burner
    annots_to_burn = [
        {"page": 1, "type": "dot", "x": 0.5, "y": 0.5, "data": {"color": "red"}},
        {"page": 1, "type": "text", "x": 0.2, "y": 0.3, "data": {"text": "مرحبا بك", "language": "ar"}},
        {"page": 2, "type": "timestamp", "x": 0.1, "y": 0.8, "data": {"timestamp": "2026-05-22", "reading_count": 3}}
    ]

    success = AnnotationModifierService.burn_annotations(pdf, out_pdf, annots_to_burn)
    assert success is True
    assert os.path.exists(out_pdf)

    # 2. Test extraction from PDF
    extracted = AnnotationService.extract_annotations(out_pdf)
    assert len(extracted) >= 2 # Depending on viewer rendering support, freetext + circle should be there
    assert AnnotationService.has_comments(out_pdf) is True

    # 3. Test db-based annotations
    annot_db_item = Annotation(
        book_id="book_123",
        page=1,
        type="dot",
        x=0.5,
        y=0.5,
        data={"color": "red"}
    )
    
    saved_annot = AnnotationService.add_annotation(annot_db_item)
    assert saved_annot.id == annot_db_item.id

    # Retrieve
    stored = AnnotationService.get_annotations_for_book("book_123")
    assert len(stored) == 1
    assert stored[0]["id"] == annot_db_item.id

    # Update data
    update_success = AnnotationService.update_annotation_data(annot_db_item.id, {"color": "blue", "notes": "edited"})
    assert update_success is True
    updated_stored = AnnotationService.get_annotations_for_book("book_123")
    assert updated_stored[0]["data"]["color"] == "blue"

    # Delete
    del_success = AnnotationService.delete_annotation(annot_db_item.id)
    assert del_success is True
    assert len(AnnotationService.get_annotations_for_book("book_123")) == 0

    # Force garbage collection to release PyMuPDF file handles on Windows
    import gc
    gc.collect()


# ----------------------------------------------------------------------
# PDFProgressService Tests
# ----------------------------------------------------------------------

def test_pdf_progress_service(temp_dir, create_dummy_pdf):
    pdf = os.path.join(temp_dir, "progress.pdf")
    create_dummy_pdf(pdf, num_pages=4)

    # Analyze single PDF
    stats = PDFProgressService.analyze_pdf(pdf)
    assert stats["file_name"] == "progress.pdf"
    assert stats["page_count"] == 4
    assert stats["total_annotations"] == 0

    # Scan directory
    scan_res = PDFProgressService.scan_directory(temp_dir, recursive=False)
    assert scan_res["total_found"] >= 1
    assert scan_res["successful_count"] >= 1

    # Get PDF list
    pdf_list = PDFProgressService.get_pdf_list(sort_by="page_count", order="desc")
    assert len(pdf_list) >= 1
    assert pdf_list[0]["file_name"] == "progress.pdf"

    # Get stats
    global_stats = PDFProgressService.get_statistics()
    assert global_stats["total_pdfs"] >= 1

    # Export to markdown
    md = PDFProgressService.export_to_markdown(pdf)
    assert "progress.pdf" in md or "لا توجد تعليقات" in md

    # Delete PDF progress
    del_res = PDFProgressService.delete_pdf(pdf)
    assert del_res is True

    # Clear all
    clear_count = PDFProgressService.clear_all()
    assert clear_count >= 0

    # Force garbage collection to release PyMuPDF file handles on Windows
    import gc
    gc.collect()


# ----------------------------------------------------------------------
# SubscriptionService Tests
# ----------------------------------------------------------------------

def test_subscription_service():
    device_id = "test_device_uuid_999"
    
    # Get or create user (creates default trial subscription)
    user = subscription_service.get_or_create_user(device_id)
    assert user.device_id == device_id
    assert user.user_id is not None

    # Get subscription
    sub = subscription_service.get_subscription(user.user_id)
    assert sub.status == SubscriptionStatus.ACTIVE
    assert "tahweel" in sub.features_enabled
    assert "watermark_edit" in sub.features_enabled

    # Expire subscription
    subscription_service._update_status(user.user_id, SubscriptionStatus.EXPIRED)
    expired_sub = subscription_service.get_subscription(user.user_id)
    assert expired_sub.status == SubscriptionStatus.EXPIRED
    # Expired tier should only have base features
    assert "tahweel" not in expired_sub.features_enabled
    assert "pdf_merge" in expired_sub.features_enabled
