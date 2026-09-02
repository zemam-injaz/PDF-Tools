import os
import gc
import pytest
import fitz
from services.bookmark_service import BookmarkService, Bookmark

def test_extract_bookmarks(temp_dir, create_dummy_pdf):
    pdf_path = os.path.join(temp_dir, "bookmarks.pdf")
    # TOC format: [level, title, page]
    toc_data = [
        [1, "Chapter 1", 1],
        [2, "Section 1.1", 1],
        [1, "Chapter 2", 2],
        [2, "Section 2.1", 3]
    ]
    create_dummy_pdf(pdf_path, num_pages=4, bookmarks=toc_data)
    
    extracted = BookmarkService.extract_bookmarks(pdf_path)
    assert extracted["has_bookmarks"] is True
    assert extracted["count"] == 4
    assert len(extracted["bookmarks"]) == 4
    
    # Check calculated page ranges
    bms = extracted["bookmarks"]
    assert bms[0]["title"] == "Chapter 1"
    assert bms[0]["end_page"] == 1
    assert bms[0]["page_count"] == 1
    
    assert bms[2]["title"] == "Chapter 2"
    assert bms[2]["end_page"] == 4  # Extends to end of doc (page 4) or next higher level
    assert bms[2]["page_count"] == 3

def test_save_and_load_bookmarks(temp_dir):
    txt_path = os.path.join(temp_dir, "bookmarks.txt")
    toc_text = "Introduction - 1\n  Chapter 1 - 2\n    Section 1.1 - 3"
    
    success = BookmarkService.save_bookmarks(toc_text, txt_path)
    assert success is True
    assert os.path.exists(txt_path)
    
    bms = BookmarkService.load_bookmarks_from_text(txt_path)
    assert len(bms) == 3
    assert bms[0].title == "Introduction"
    assert bms[0].level == 1
    assert bms[0].page == 1
    
    assert bms[1].title == "Chapter 1"
    assert bms[1].level == 2
    assert bms[1].page == 2

def test_parse_toc_text():
    raw_text = "Chapter A ... 1\nSection A.1 ... 2\nChapter B - 5"
    bms = BookmarkService.parse_toc_text(raw_text, consider_levels=True)
    assert len(bms) == 3
    assert bms[0].title == "Chapter A"
    assert bms[0].page == 1
    assert bms[1].title == "Section A.1"
    assert bms[1].page == 2
    assert bms[2].title == "Chapter B"
    assert bms[2].page == 5

def test_split_by_bookmarks_repairs_corrupt_xref(temp_dir):
    """A PDF whose pages reference objects beyond the xref table must still split
    (regression: 'code=4: source object number out of range' in insert_pdf)."""
    src_path = os.path.join(temp_dir, "corrupt_source.pdf")
    out_dir = os.path.join(temp_dir, "split_out")

    # Minimal PDF with a page /Contents pointing at object 999 while the xref
    # only covers objects 0-5 -> MuPDF raises "source object number out of range".
    objs = {
        1: b"<< /Type /Catalog /Pages 2 0 R /Outlines 4 0 R >>",
        2: b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        3: b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 999 0 R >>",
        4: b"<< /Type /Outlines /First 5 0 R /Last 5 0 R /Count 1 >>",
        5: b"<< /Title (Chapter 1) /Parent 4 0 R /Dest [3 0 R /Fit] >>",
    }
    parts = [b"%PDF-1.4\n"]
    offsets = {}
    for n in range(1, 6):
        offsets[n] = sum(len(p) for p in parts)
        parts.append(b"%d 0 obj\n" % n)
        parts.append(objs[n])
        parts.append(b"\nendobj\n")
    xref_pos = sum(len(p) for p in parts)
    parts.append(b"xref\n0 6\n")
    parts.append(b"0000000000 65535 f \n")
    for n in range(1, 6):
        parts.append(b"%010d 00000 n \n" % offsets[n])
    parts.append(b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % xref_pos)
    with open(src_path, "wb") as f:
        f.write(b"".join(parts))

    # Sanity: raw insert_pdf on this file reproduces the original error
    raw = fitz.open(src_path)
    nd = fitz.open()
    try:
        assert raw.get_toc() == [[1, "Chapter 1", 1]]
        try:
            nd.insert_pdf(raw)
            raise AssertionError("expected insert_pdf to fail on corrupt xref")
        except Exception as e:
            assert "source object number out of range" in str(e)
    finally:
        nd.close()
        raw.close()
    # Release exception traceback cycle so the grafted docs are destroyed and
    # the source file handle is freed on Windows before temp_dir teardown.
    del raw, nd
    gc.collect()

    # Service must repair the source and split successfully
    result = BookmarkService.split_by_bookmarks(src_path, out_dir, level_1_only=True)
    assert result["total_files"] == 1
    out_pdf = result["files_created"][0]
    assert os.path.exists(out_pdf)
    with fitz.open(out_pdf) as doc:
        assert doc.page_count == 1

def test_insert_bookmarks(temp_dir, create_dummy_pdf):
    pdf_path = os.path.join(temp_dir, "source.pdf")
    create_dummy_pdf(pdf_path, num_pages=5)
    
    out_pdf = os.path.join(temp_dir, "output.pdf")
    bms = [
        {"title": "Intro", "page": 1, "level": 1},
        {"title": "Deep Section", "page": 3, "level": 3},  # Should normalize to level 2 since level 1 to 3 is a +2 skip
        {"title": "Outro", "page": 5, "level": 1}
    ]
    
    res = BookmarkService.insert_bookmarks(pdf_path, bms, out_pdf)
    assert res["inserted"] == 3
    
    # Read back to verify level clamping (normalize_toc_levels)
    info = BookmarkService.extract_bookmarks(out_pdf)
    read_bms = info["bookmarks"]
    assert read_bms[0]["title"] == "Intro"
    assert read_bms[0]["level"] == 1
    
    # Clamping test: Level 3 became Level 2 because level 1 -> 3 is normalized to 1 -> 2
    assert read_bms[1]["title"] == "Deep Section"
    assert read_bms[1]["level"] == 2
