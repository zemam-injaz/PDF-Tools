import os
import pytest
from services.pdf_service import PDFService

def test_get_pdf_info(temp_dir, create_dummy_pdf):
    pdf_path = os.path.join(temp_dir, "test.pdf")
    create_dummy_pdf(pdf_path, num_pages=4)
    
    info = PDFService.get_pdf_info(pdf_path)
    assert info["page_count"] == 4
    assert info["is_encrypted"] is False
    assert isinstance(info["metadata"], dict)

def test_merge_pdfs(temp_dir, create_dummy_pdf):
    pdf1 = os.path.join(temp_dir, "pdf1.pdf")
    pdf2 = os.path.join(temp_dir, "pdf2.pdf")
    out_pdf = os.path.join(temp_dir, "merged.pdf")
    
    create_dummy_pdf(pdf1, num_pages=2, text_content="First Doc")
    create_dummy_pdf(pdf2, num_pages=3, text_content="Second Doc")
    
    success = PDFService.merge_pdfs([pdf1, pdf2], out_pdf)
    assert success is True
    assert os.path.exists(out_pdf)
    
    info = PDFService.get_pdf_info(out_pdf)
    assert info["page_count"] == 5

def test_split_pdf(temp_dir, create_dummy_pdf):
    pdf_path = os.path.join(temp_dir, "to_split.pdf")
    create_dummy_pdf(pdf_path, num_pages=5)
    
    # Split at page 3 (1-based index) -> pages 1-2, and pages 3-5
    out_files = PDFService.split_pdf(pdf_path, [3], temp_dir)
    assert len(out_files) == 2
    
    # Check parts existence and page counts
    assert os.path.exists(out_files[0])
    assert os.path.exists(out_files[1])
    
    info1 = PDFService.get_pdf_info(out_files[0])
    info2 = PDFService.get_pdf_info(out_files[1])
    assert info1["page_count"] == 2
    assert info2["page_count"] == 3

def test_compress_pdf(temp_dir, create_dummy_pdf):
    pdf_path = os.path.join(temp_dir, "uncompressed.pdf")
    out_pdf = os.path.join(temp_dir, "compressed.pdf")
    create_dummy_pdf(pdf_path, num_pages=3)
    
    success = PDFService.compress_pdf(pdf_path, out_pdf, compression_level=2)
    assert success is True
    assert os.path.exists(out_pdf)
    
    info = PDFService.get_pdf_info(out_pdf)
    assert info["page_count"] == 3

def test_convert_to_images(temp_dir, create_dummy_pdf):
    pdf_path = os.path.join(temp_dir, "to_images.pdf")
    create_dummy_pdf(pdf_path, num_pages=2)
    
    img_files = PDFService.convert_to_images(pdf_path, temp_dir, format="png", dpi=72)
    assert len(img_files) == 2
    for img in img_files:
        assert os.path.exists(img)
        assert img.endswith(".png")

def test_create_and_extract_images(temp_dir, create_dummy_image):
    # 1. Create a dummy image
    img_path = os.path.join(temp_dir, "source.png")
    create_dummy_image(img_path)
    
    # 2. Create PDF from image
    pdf_path = os.path.join(temp_dir, "from_img.pdf")
    success = PDFService.create_from_images([img_path], pdf_path)
    assert success is True
    assert os.path.exists(pdf_path)
    
    # 3. Extract image back out from PDF
    extracted_dir = os.path.join(temp_dir, "extracted")
    os.makedirs(extracted_dir, exist_ok=True)
    extracted_files = PDFService.extract_images(pdf_path, extracted_dir)
    assert len(extracted_files) >= 1
    assert os.path.exists(extracted_files[0])

def test_update_metadata(temp_dir, create_dummy_pdf):
    pdf_path = os.path.join(temp_dir, "meta.pdf")
    out_pdf = os.path.join(temp_dir, "meta_updated.pdf")
    create_dummy_pdf(pdf_path, num_pages=1)
    
    new_metadata = {
        "title": "Super Cool PDF",
        "author": "Antigravity AI",
        "subject": "Testing System",
        "keywords": "test, pdf, automated"
    }
    
    success = PDFService.update_metadata(pdf_path, out_pdf, new_metadata)
    assert success is True
    
    info = PDFService.get_pdf_info(out_pdf)
    metadata = info["metadata"]
    assert metadata["title"] == "Super Cool PDF"
    assert metadata["author"] == "Antigravity AI"
    assert metadata["subject"] == "Testing System"
    assert metadata["keywords"] == "test, pdf, automated"
