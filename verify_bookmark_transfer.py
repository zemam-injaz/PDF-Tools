import os
import sys
import fitz

# Add the server directory to path
sys.path.append(r'f:\Desktop-Apps\pdf-tools-project\python-server')
from services.bookmark_service import BookmarkService

def create_test_pdfs():
    # Create source PDF with bookmarks
    src_path = "test_source.pdf"
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "Source PDF with Bookmarks")
    
    toc = [
        [1, "Chapter 1", 1],
        [2, "Section 1.1", 1],
        [1, "Chapter 2", 1]
    ]
    doc.set_toc(toc)
    doc.save(src_path)
    doc.close()
    
    # Create target PDF without bookmarks
    tgt_path = "test_target.pdf"
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "Target PDF (OCR Result)")
    doc.save(tgt_path)
    doc.close()
    
    return src_path, tgt_path

def verify_transfer():
    src_path, tgt_path = create_test_pdfs()
    out_path = "test_result.pdf"
    
    print(f"Transferring bookmarks from {src_path} to {tgt_path}...")
    result = BookmarkService.transfer_bookmarks(src_path, tgt_path, out_path)
    
    print(f"Result: {result}")
    
    # Verify result PDF
    doc = fitz.open(out_path)
    new_toc = doc.get_toc()
    print(f"Transferred Bookmarks: {new_toc}")
    
    doc.close()
    
    # Cleanup
    # os.remove(src_path)
    # os.remove(tgt_path)
    # os.remove(out_path)
    
    if len(new_toc) == 3 and new_toc[0][1] == "Chapter 1":
        print("VERIFICATION SUCCESSFUL")
    else:
        print("VERIFICATION FAILED")

if __name__ == "__main__":
    verify_transfer()
