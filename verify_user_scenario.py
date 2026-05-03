import os
import sys
import fitz

# Add the server directory to path
sys.path.append(r'f:\Desktop-Apps\pdf-tools-project\python-server')
from services.bookmark_service import BookmarkService

def test_user_scenario():
    # User's TOC sample
    # Level 1: Preface (p3)
    #   Level 2: 1.1 (p3)
    #   Level 2: 1.2 (p3)
    # Level 1: Surah Fatiha (p57)
    
    toc = [
        [1, "Chapter 1", 3],
        [2, "Section 1.1", 3],
        [2, "Section 1.2", 3],
        [1, "Chapter 2", 57]
    ]
    
    print(f"Original TOC: {toc}")
    
    # 1. Test normalization
    normalized = BookmarkService.normalize_toc_levels(toc)
    print(f"Normalized TOC: {normalized}")
    
    # 2. Test split by all bookmarks (ignore_hierarchy=True)
    # This should split at EVERY bookmark, even on the same page
    output_dir = "test_user_split"
    os.makedirs(output_dir, exist_ok=True)
    
    # Create mock PDF
    pdf_path = "mock_user.pdf"
    doc = fitz.open()
    for _ in range(60): doc.new_page()
    doc.set_toc(toc)
    doc.save(pdf_path)
    doc.close()
    
    try:
        print("Testing split with ignore_hierarchy=True...")
        result = BookmarkService.split_by_bookmarks(
            pdf_path, output_dir, ignore_hierarchy=True
        )
        print(f"Split Result (count): {len(result['files_created'])}")
        
        # We expect 4 files
        if len(result['files_created']) >= 4:
            print("VERIFICATION SUCCESSFUL: Multiple bookmarks on same page handled.")
        else:
            print(f"VERIFICATION FAILED: Only {len(result['files_created'])} files created.")
            
    except Exception as e:
        print(f"VERIFICATION FAILED with error: {e}")
    finally:
        # Cleanup
        import shutil
        if os.path.exists(output_dir): shutil.rmtree(output_dir)
        if os.path.exists(pdf_path): os.remove(pdf_path)

if __name__ == "__main__":
    test_user_scenario()
