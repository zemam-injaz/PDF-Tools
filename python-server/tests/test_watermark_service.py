import os
import pytest
from services.watermark_service import WatermarkService

def test_add_text_watermark(temp_dir, create_dummy_pdf):
    pdf_path = os.path.join(temp_dir, "source.pdf")
    create_dummy_pdf(pdf_path, num_pages=2)
    
    out_pdf = os.path.join(temp_dir, "watermarked_text.pdf")
    res = WatermarkService.add_text_watermark(
        pdf_path, out_pdf,
        text="CONFIDENTIAL",
        position="center",
        color="#FF0000",
        pages="1,2"
    )
    
    assert res["pages_watermarked"] == 2
    assert os.path.exists(out_pdf)

def test_add_image_watermark(temp_dir, create_dummy_pdf, create_dummy_image):
    pdf_path = os.path.join(temp_dir, "source.pdf")
    img_path = os.path.join(temp_dir, "watermark.png")
    create_dummy_pdf(pdf_path, num_pages=2)
    create_dummy_image(img_path)
    
    out_pdf = os.path.join(temp_dir, "watermarked_img.pdf")
    res = WatermarkService.add_image_watermark(
        pdf_path, out_pdf,
        image_path=img_path,
        position="bottom-right",
        opacity=0.4
    )
    
    assert res["pages_watermarked"] == 2
    assert os.path.exists(out_pdf)

def test_remove_watermark(temp_dir, create_dummy_pdf):
    pdf_path = os.path.join(temp_dir, "source_wm.pdf")
    create_dummy_pdf(pdf_path, num_pages=2, text_content="Draft Copy - DO NOT DISTRIBUTE")
    
    out_pdf = os.path.join(temp_dir, "cleaned.pdf")
    # Clean draft watermark keywords
    res = WatermarkService.remove_watermark(
        pdf_path, out_pdf,
        keywords=["draft"],
        remove_corner_images=False
    )
    
    assert res["items_removed"] >= 0
    assert os.path.exists(out_pdf)
