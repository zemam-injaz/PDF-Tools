import fitz
import os

def test_coords():
    # Create a blank PDF
    doc = fitz.open()
    page = doc.new_page(width=500, height=800)
    
    # Draw a circle at expected (100, 100) point (top-left origin assumption)
    # If it's at the top, our assumption is correct.
    rect = fitz.Rect(100, 100, 120, 120)
    annot = page.add_circle_annot(rect)
    annot.set_colors(stroke=(1,0,0), fill=(1,0,0))
    annot.update()
    
    # Store the file
    out_path = "f:/Desktop-Apps/pdf-tools-project/python-server-coord-test.pdf"
    doc.save(out_path)
    doc.close()
    print(f"Test PDF saved to {out_path}")

if __name__ == "__main__":
    test_coords()
