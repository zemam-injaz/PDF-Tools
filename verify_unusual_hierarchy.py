import os
import sys
import fitz

# Add the server directory to path
sys.path.append(r'f:\Desktop-Apps\pdf-tools-project\python-server')
from services.bookmark_service import BookmarkService

def test_unusual_hierarchy():
    # TestCase: Level 4 followed by Level 100
    toc = [
        [4, "Chapter 1 (at level 4)", 1],
        [100, "Section 1.1 (at level 100)", 2]
    ]
    
    print(f"Original TOC: {toc}")
    
    try:
        normalized = BookmarkService.normalize_toc_levels(toc)
        print(f"Normalized TOC: {normalized}")
        
        # Test if it can be set to a PDF
        doc = fitz.open()
        doc.new_page()
        doc.new_page()
        doc.set_toc(normalized)
        print("Set TOC successful!")
        doc.close()
        
        # Expected: [[1, 'Chapter 1 (at level 4)', 1], [2, 'Section 1.1 (at level 100)', 2]]
        if normalized[0][0] == 1 and normalized[1][0] == 2:
            print("VERIFICATION SUCCESSFUL: Levels mapped correctly.")
        else:
            print(f"VERIFICATION FAILED: Levels are {normalized[0][0]} and {normalized[1][0]}")
            
    except Exception as e:
        print(f"VERIFICATION FAILED with error: {e}")

if __name__ == "__main__":
    test_unusual_hierarchy()
