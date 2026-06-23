import os
import tempfile
import pytest
import fitz

# Prevent database initialization from polluting user's home directory during imports
_temp_home_dir = tempfile.TemporaryDirectory()
os.environ["USERPROFILE"] = _temp_home_dir.name
os.environ["HOME"] = _temp_home_dir.name

@pytest.fixture
def temp_dir():
    """Provides a temporary directory that is automatically cleaned up after the test."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir

@pytest.fixture
def create_dummy_pdf():
    """Returns a factory function to create a dummy PDF with specified properties."""
    def _create(file_path: str, num_pages: int = 3, text_content: str = "Test PDF Content", 
                bookmarks: list = None, encrypt_password: str = None) -> str:
        doc = fitz.open()
        for i in range(num_pages):
            page = doc.new_page()
            # Add some distinct text content to each page
            page.insert_text((72, 72), f"{text_content} - Page {i+1}", fontsize=12)
            page.insert_text((100, 150), f"Sample details for index {i}", fontsize=10)

        # Set table of contents (bookmarks) if specified
        # Format of bookmarks in PyMuPDF: [ [level, title, page], ... ]
        if bookmarks:
            doc.set_toc(bookmarks)

        # Save options
        if encrypt_password:
            # Encrypt with owner & user password
            doc.save(
                file_path, 
                encryption=fitz.PDF_ENCRYPT_AES_256, 
                user_pw=encrypt_password, 
                owner_pw=encrypt_password + "_owner"
            )
        else:
            doc.save(file_path)
        
        doc.close()
        return file_path

    return _create

@pytest.fixture
def create_dummy_image():
    """Returns a factory function to create a dummy image file (using fitz or dummy bytes) for watermark testing."""
    def _create(file_path: str) -> str:
        # Create a single page dummy PDF, render as PNG
        doc = fitz.open()
        page = doc.new_page(width=100, height=100)
        page.draw_rect([10, 10, 90, 90], color=(1, 0, 0), fill=(0, 1, 0)) # Red outline, green fill
        pix = page.get_pixmap()
        pix.save(file_path)
        doc.close()
        return file_path
    return _create
