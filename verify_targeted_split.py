import os
import sys
import fitz

# Add the server directory to path
sys.path.append(r'f:\Desktop-Apps\pdf-tools-project\python-server')
from services.bookmark_service import BookmarkService

def create_complex_test_pdf():
    # Create source PDF with multi-level bookmarks
    src_path = "test_complex_source.pdf"
    doc = fitz.open()
    for i in range(5):
        page = doc.new_page()
        page.insert_text((50, 50), f"Page {i+1}")
    
    # 1: Ch1 (p1)
    #   2: Sec1.1 (p2)
    #   2: Sec1.2 (p3)
    # 1: Ch2 (p4)
    #   2: Sec2.1 (p5)
    toc = [
        [1, "Chapter 1", 1],
        [2, "Section 1.1", 2],
        [2, "Section 1.2", 3],
        [1, "Chapter 2", 4],
        [2, "Section 2.1", 5]
    ]
    doc.set_toc(toc)
    doc.save(src_path)
    doc.close()
    return src_path

def verify_targeted_split():
    src_path = create_complex_test_pdf()
    output_dir = "test_split_output"
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"Testing split by Level 2...")
    result = BookmarkService.split_by_bookmarks(
        src_path, output_dir, target_level=2
    )
    
    print(f"Split Result: {result}")
    
    # We expect 3 files (Section 1.1, 1.2, 2.1)
    # Actually Chapter 1 covers [1, 3], Section 1.1 [2, 2], Section 1.2 [3, 3] etc.
    # Looking at the code:
    # it splits from [item[2], next_item[2]-1]
    
    files = os.listdir(output_dir)
    print(f"Created files: {files}")
    
    # Verify one of the files for hierarchy error
    if files:
        test_file = os.path.join(output_dir, files[0])
        doc = fitz.open(test_file)
        print(f"TOC of {files[0]}: {doc.get_toc()}")
        doc.close()

    # Cleanup
    # for f in files: os.remove(os.path.join(output_dir, f))
    # os.rmdir(output_dir)
    # os.remove(src_path)
    
    if len(files) >= 3:
        print("VERIFICATION SUCCESSFUL")
    else:
        print("VERIFICATION FAILED")

if __name__ == "__main__":
    verify_targeted_split()
