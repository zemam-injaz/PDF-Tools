"""Test visual output after margin fix"""
import sys, os, tempfile
sys.path.insert(0, os.path.dirname(__file__))
from services.markdown_service import MarkdownService
import fitz

tmp = tempfile.mkdtemp()
md_path = os.path.join(tmp, 'test.md')
pdf_path = os.path.join(tmp, 'test.pdf')

with open(md_path, 'w', encoding='utf-8') as f:
    f.write('''# الفعل الرباعي المجرد

## ملخص تنفيذي

هذا النص يختبر **التشكيل العربي** والاتجاه من اليمين إلى اليسار. يجب أن تظهر الكلمات بصورة صحيحة ومتصلة دون أي تداخل بين السطور.

نص عادي مع ==كلمات مميزة== و **الجميلة** و *المائلة*.

- خاصية أولى
- خاصية ثانية

1. عنصر مرقم أول
2. عنصر مرقم ثاني

> اقتباس مهم من النص الأصلي.
''')

opts = dict(MarkdownService.DEFAULT_OPTIONS)
opts.update({
    'cover_page': True,
    'include_toc': True,
    'title': 'كتاب تجريبي',
    'author': 'وراق',
    'header_enabled': True,
    'header_text': 'كتاب تجريبي',
    'footer_enabled': True,
    'footer_text': 'وراق',
    'footer_page_numbers': True,
})

MarkdownService.convert_to_pdf([md_path], pdf_path, opts)

# Save HTML for inspection
md_text = MarkdownService._read_and_merge_files([md_path], opts)
html = MarkdownService._build_html(md_text, opts)
html_path = os.path.join(tmp, 'output.html')
with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)

# Render pages to images
doc = fitz.open(pdf_path)
print(f'Pages: {doc.page_count}')
for i in range(doc.page_count):
    page = doc[i]
    pix = page.get_pixmap(dpi=150)
    img_path = os.path.join(tmp, f'page_{i+1}.png')
    pix.save(img_path)
    print(f'Saved: {img_path}')
    blocks = [b for b in page.get_text('dict')['blocks'] if b.get('type') == 0]
    overlap = False
    for j in range(len(blocks)-1):
        gap = blocks[j+1]['bbox'][1] - blocks[j]['bbox'][3]
        if gap < 0:
            overlap = True
    print(f'  Page {i+1}: {len(blocks)} blocks, overlap={overlap}')

print(f'HTML: {html_path}')
print(f'PDF: {pdf_path}')
doc.close()
