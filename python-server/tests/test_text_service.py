import os
import pytest
import fitz
from services.text_service import TextService


def test_extract_text_basic(temp_dir, create_dummy_pdf):
    pdf_path = os.path.join(temp_dir, "test.pdf")
    create_dummy_pdf(pdf_path, num_pages=3, text_content="Hello World")

    result = TextService.extract_text(pdf_path)
    assert result["pages_extracted"] == 3
    assert result["total_pages"] == 3
    assert result["word_count"] > 0
    assert "Hello World" in result["text"]
    assert "Page 1" in result["text"]
    assert "Page 2" in result["text"]
    assert "Page 3" in result["text"]


def test_extract_text_page_range(temp_dir, create_dummy_pdf):
    pdf_path = os.path.join(temp_dir, "range_test.pdf")
    create_dummy_pdf(pdf_path, num_pages=5, text_content="PageRange")

    # Extract only page 2 and 4
    result = TextService.extract_text(pdf_path, "2,4")
    assert result["pages_extracted"] == 2
    assert "Page 2" in result["text"]
    assert "Page 4" in result["text"]
    assert "Page 3" not in result["text"]


def test_extract_text_range_with_hyphen(temp_dir, create_dummy_pdf):
    pdf_path = os.path.join(temp_dir, "range_hyphen.pdf")
    create_dummy_pdf(pdf_path, num_pages=5, text_content="Hyphen")

    result = TextService.extract_text(pdf_path, "2-4")
    assert result["pages_extracted"] == 3
    for i in [2, 3, 4]:
        assert f"Page {i}" in result["text"]
    assert "Page 1" not in result["text"]
    assert "Page 5" not in result["text"]


def test_extract_text_all_default(temp_dir, create_dummy_pdf):
    pdf_path = os.path.join(temp_dir, "default_all.pdf")
    create_dummy_pdf(pdf_path, num_pages=2, text_content="Default")

    result = TextService.extract_text(pdf_path)
    assert result["pages_extracted"] == 2


def test_extract_text_invalid_page_range(temp_dir, create_dummy_pdf):
    pdf_path = os.path.join(temp_dir, "invalid_range.pdf")
    create_dummy_pdf(pdf_path, num_pages=3)

    # Page 99 doesn't exist, should safely clamp
    result = TextService.extract_text(pdf_path, "1,99")
    assert result["pages_extracted"] == 1


def test_extract_text_non_existent_file():
    with pytest.raises(Exception, match="Text extraction failed"):
        TextService.extract_text("/nonexistent/path.pdf")


def test_get_word_index_count(temp_dir, create_dummy_pdf):
    pdf_path = os.path.join(temp_dir, "index_test.pdf")
    create_dummy_pdf(pdf_path, num_pages=4, text_content="Index Each Page")

    index = TextService.get_word_index(pdf_path)
    assert len(index) == 4

    for entry in index:
        assert "page" in entry
        assert "word_count" in entry
        assert entry["word_count"] > 0


def test_get_word_index_page_numbers(temp_dir, create_dummy_pdf):
    pdf_path = os.path.join(temp_dir, "index_pages.pdf")
    create_dummy_pdf(pdf_path, num_pages=3)

    index = TextService.get_word_index(pdf_path)
    assert index[0]["page"] == 1
    assert index[1]["page"] == 2
    assert index[2]["page"] == 3


def test_get_word_index_empty_page(temp_dir, create_dummy_pdf):
    pdf_path = os.path.join(temp_dir, "empty_page.pdf")
    doc = fitz.open()
    doc.new_page()  # Blank page with no text
    doc.save(pdf_path)
    doc.close()

    index = TextService.get_word_index(pdf_path)
    assert len(index) == 1
    assert index[0]["word_count"] == 0


def test_parse_page_range_various():
    total = 10

    assert TextService.parse_page_range("all", total) == [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    assert TextService.parse_page_range("1,3,5", total) == [0, 2, 4]
    assert TextService.parse_page_range("1-3", total) == [0, 1, 2]
    assert TextService.parse_page_range("10-10", total) == [9]
    assert TextService.parse_page_range("", total) == list(range(total))


def test_extract_to_file_txt(temp_dir, create_dummy_pdf):
    pdf_path = os.path.join(temp_dir, "to_txt.pdf")
    txt_path = os.path.join(temp_dir, "output.txt")
    create_dummy_pdf(pdf_path, num_pages=2, text_content="ExtractToFile")

    result = TextService.extract_to_file(pdf_path, txt_path, format="txt")
    assert result["format"] == "txt"
    assert result["pages_extracted"] == 2
    assert os.path.exists(txt_path)

    with open(txt_path, "r", encoding="utf-8") as f:
        content = f.read()
    assert "ExtractToFile" in content


def test_extract_to_file_md(temp_dir, create_dummy_pdf):
    pdf_path = os.path.join(temp_dir, "to_md.pdf")
    md_path = os.path.join(temp_dir, "output.md")
    create_dummy_pdf(pdf_path, num_pages=1, text_content="Markdown Output")

    result = TextService.extract_to_file(pdf_path, md_path, format="md")
    assert result["format"] == "md"
    assert os.path.exists(md_path)


def test_extract_to_file_docx(temp_dir, create_dummy_pdf):
    pdf_path = os.path.join(temp_dir, "to_docx.pdf")
    docx_path = os.path.join(temp_dir, "output.docx")
    create_dummy_pdf(pdf_path, num_pages=1, text_content="Docx Output")

    result = TextService.extract_to_file(pdf_path, docx_path, format="docx")
    assert result["format"] == "docx"
    assert os.path.exists(docx_path)


def test_extract_to_file_custom_font(temp_dir, create_dummy_pdf):
    pdf_path = os.path.join(temp_dir, "font_test.pdf")
    docx_path = os.path.join(temp_dir, "font_output.docx")
    create_dummy_pdf(pdf_path, num_pages=1, text_content="Custom Font")

    result = TextService.extract_to_file(
        pdf_path, docx_path, format="docx",
        font_family="Arial", font_size=14
    )
    assert result["format"] == "docx"


def test_batch_extract(temp_dir, create_dummy_pdf):
    pdf1 = os.path.join(temp_dir, "batch1.pdf")
    pdf2 = os.path.join(temp_dir, "batch2.pdf")
    create_dummy_pdf(pdf1, num_pages=2, text_content="Batch One")
    create_dummy_pdf(pdf2, num_pages=3, text_content="Batch Two")

    result = TextService.batch_extract([pdf1, pdf2], temp_dir, format="txt")
    assert result["successful"] == 2
    assert result["failed"] == 0
    assert len(result["output_files"]) == 2

    for f in result["output_files"]:
        assert os.path.exists(f)


def test_extract_text_preserves_pages(temp_dir, create_dummy_pdf):
    """Ensure extracted text content matches per-page original."""
    pdf_path = os.path.join(temp_dir, "preserve.pdf")
    create_dummy_pdf(pdf_path, num_pages=3, text_content="UniqueText")

    result = TextService.extract_text(pdf_path)
    for i in range(1, 4):
        assert f"UniqueText - Page {i}" in result["text"]


def test_get_word_index_non_existent_file():
    with pytest.raises(Exception, match="Failed to index PDF"):
        TextService.get_word_index("/nonexistent/path.pdf")
