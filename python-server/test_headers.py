"""Verify headers/footers/page numbers appear in PDF"""
import sys, os, tempfile
sys.path.insert(0, os.path.dirname(__file__))
from services.markdown_service import MarkdownService
import fitz

tmp = tempfile.mkdtemp()
md_path = os.path.join(tmp, 'test.md')
pdf_path = os.path.join(tmp, 'test.pdf')

with open(md_path, 'w', encoding='utf-8') as f:
    f.write('# عنوان الكتاب\n\n## فصل أول\n\nنص الفصل الأول هنا.\n\n## فصل ثان\n\nنص الفصل الثاني هنا.\n')

opts = dict(MarkdownService.DEFAULT_OPTIONS)
opts.update({
    'cover_page': True,
    'include_toc': True,
    'title': 'عنوان الكتاب',
    'author': 'المؤلف',
    'header_enabled': True,
    'header_text': 'عنوان الكتاب',
    'footer_enabled': True,
    'footer_text': 'وراق',
    'footer_page_numbers': True,
})

MarkdownService.convert_to_pdf([md_path], pdf_path, opts)

# Check text on each page
doc = fitz.open(pdf_path)
print(f'Pages: {doc.page_count}')
for i in range(doc.page_count):
    text = doc[i].get_text()
    # Save to file for inspection
    with open(os.path.join(tmp, f'page_{i+1}_text.txt'), 'w', encoding='utf-8') as f:
        f.write(text)
    # Check for header/footer/page number
    has_header = 'عنوان الكتاب' in text
    has_footer = 'وراق' in text
    has_page_number = any(str(n) in text for n in range(1, 10))
    print(f'Page {i+1}: header={has_header}, footer={has_footer}, page_number={has_page_number}')

doc.close()
print(f'PDF: {pdf_path}')
print(f'Text files: {tmp}')
