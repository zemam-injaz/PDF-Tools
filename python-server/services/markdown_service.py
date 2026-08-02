"""Professional Markdown to PDF conversion service using Chromium"""
import html
import os
import re
import tempfile
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from markdown_it import MarkdownIt
from mdit_py_plugins.container import container_plugin
from mdit_py_plugins.footnote import footnote_plugin
from playwright.sync_api import sync_playwright
import fitz

FONT_DIR = Path(__file__).resolve().parent.parent / 'assets' / 'fonts'

AVAILABLE_FONTS = {
    'Noto Naskh Arabic': {
        'regular': FONT_DIR / 'NotoNaskhArabic-Regular.ttf',
        'bold': FONT_DIR / 'NotoNaskhArabic-Bold.ttf',
    },
    'Amiri': {
        'regular': FONT_DIR / 'Amiri-Regular.ttf',
        'bold': FONT_DIR / 'Amiri-Bold.ttf',
    },
    'Scheherazade New': {
        'regular': FONT_DIR / 'ScheherazadeNew-Regular.ttf',
        'bold': FONT_DIR / 'ScheherazadeNew-Bold.ttf',
    },
    'Tajawal': {
        'regular': FONT_DIR / 'Tajawal-Regular.ttf',
        'bold': FONT_DIR / 'Tajawal-Bold.ttf',
    },
    'IBM Plex Sans Arabic': {
        'regular': FONT_DIR / 'IBMPlexSansArabic-Regular.ttf',
        'bold': FONT_DIR / 'IBMPlexSansArabic-Bold.ttf',
    },
}

# Allow clients to send compact names as well
FONT_NAME_MAP = {
    'NotoNaskhArabic': 'Noto Naskh Arabic',
    'notonaskharabic': 'Noto Naskh Arabic',
    'amiri': 'Amiri',
    'scheherazadenew': 'Scheherazade New',
    'scheherazade_new': 'Scheherazade New',
    'scheherazade new': 'Scheherazade New',
    'tajawal': 'Tajawal',
    'ibmplexsansarabic': 'IBM Plex Sans Arabic',
    'ibm_plex_sans_arabic': 'IBM Plex Sans Arabic',
    'ibm plex sans arabic': 'IBM Plex Sans Arabic',
}

PAGE_SIZES = {
    'A4': ('A4', '210mm 297mm'),
    'Letter': ('Letter', '215.9mm 279.4mm'),
    'A3': ('A3', '297mm 420mm'),
    'A5': ('A5', '148mm 210mm'),
    'Legal': ('Legal', '215.9mm 355.6mm'),
}

CSS_TEMPLATE = """
@font-face {{
    font-family: '{font_family}';
    src: url('file:///{regular_path}') format('truetype');
    font-weight: 400;
    font-style: normal;
}}
@font-face {{
    font-family: '{font_family}';
    src: url('file:///{bold_path}') format('truetype');
    font-weight: 700;
    font-style: normal;
}}

:root {{
    --primary-color: {primary_color};
    --text-color: {text_color};
    --link-color: {link_color};
    --accent-color: {accent_color};
    --code-bg: {code_background};
    --code-text: {code_text};
    --blockquote-border: {blockquote_border};
    --blockquote-bg: {blockquote_background};
    --highlight: {highlight_color};
    --header-color: {header_color};
    --footer-color: {footer_color};
    --page-number-color: {page_number_color};
    --toc-color: {toc_color};
    --body-size: {body_size}pt;
    --line-height: {line_height};
}}

@page {{
    size: {page_size};
}}

*, *::before, *::after {{
    box-sizing: border-box;
}}

html {{
    direction: {direction};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}}

body {{
    font-family: '{font_family}', 'Noto Naskh Arabic', serif;
    font-size: var(--body-size);
    line-height: var(--line-height);
    color: var(--text-color);
    direction: {direction};
    text-align: {text_align};
    hyphenate-character: auto;
    -webkit-font-smoothing: antialiased;
    background: #ffffff;
}}

/* Bookmark markers: tiny but searchable in the PDF */
.bm-marker {{
    font-size: 1pt;
    line-height: 1;
    color: #ffffff;
    display: inline;
    margin: 0;
    padding: 0;
}}

/* Cover page */
.cover-page {{
    page-break-after: always;
    text-align: center;
    padding-top: 35%;
    min-height: 80vh;
    direction: {direction};
    border-bottom: 3px solid var(--primary-color);
    padding-bottom: 2em;
}}

.cover-page .cover-title {{
    font-size: 2.4em;
    font-weight: 700;
    color: var(--primary-color);
    line-height: 2.0;
    margin-bottom: 0.3em;
}}

.cover-page .cover-subtitle {{
    font-size: 1.5em;
    color: var(--header-color);
    line-height: 2.2;
    margin-bottom: 2em;
}}

.cover-page .cover-author {{
    font-size: 1.15em;
    color: var(--text-color);
    line-height: 2.2;
    margin-bottom: 0.6em;
}}

.cover-page .cover-meta {{
    font-size: 0.95em;
    color: var(--footer-color);
    line-height: 2.0;
    margin-top: 4em;
}}

/* Headings */
h1, h2, h3, h4, h5, h6 {{
    color: var(--primary-color);
    font-weight: 700;
    page-break-after: avoid;
}}

h1 {{
    font-size: 1.9em;
    line-height: 2.0;
    margin: 1.8em 0 0.9em;
    padding-bottom: 0.3em;
    border-bottom: 2px solid var(--primary-color);
}}

h2 {{
    font-size: 1.5em;
    line-height: 2.1;
    margin: 1.5em 0 0.75em;
    padding-bottom: 0.25em;
    border-bottom: 1px solid var(--blockquote-border);
}}

h3 {{
    font-size: 1.22em;
    line-height: 2.2;
    margin: 1.3em 0 0.6em;
}}

h4 {{
    font-size: 1.06em;
    line-height: 2.3;
    margin: 1.1em 0 0.5em;
}}

/* Paragraphs */
p {{
    margin: 0 0 1em;
    orphans: 3;
    widows: 3;
    line-height: inherit;
}}

/* Highlight */
mark {{
    background: var(--highlight);
    color: inherit;
    padding: 0.05em 0.15em;
    border-radius: 2px;
}}

/* Links */
a {{
    color: var(--link-color);
    text-decoration: underline;
}}

/* Lists */
ul, ol {{
    margin: 1em 0;
    padding-inline-start: 2.2rem;
}}

li {{
    margin: 0.5em 0;
    line-height: var(--line-height);
}}

li::marker {{
    color: var(--primary-color);
    font-weight: 700;
}}

li > p {{
    margin: 0;
}}

/* Blockquotes */
blockquote {{
    margin: 1.4em 0;
    padding: 1em 1.4em;
    border-inline-start: 5px solid var(--accent-color);
    background: var(--blockquote-bg);
    color: var(--text-color);
    border-radius: 0 6px 6px 0;
}}

blockquote > p:last-child {{
    margin-bottom: 0;
}}

/* Code blocks */
pre {{
    background: var(--code-bg);
    color: var(--code-text);
    padding: 1em 1.2em;
    border-radius: 8px;
    overflow-x: auto;
    direction: ltr;
    text-align: left;
    margin: 1.2em 0;
    font-size: 0.82em;
    line-height: 1.55;
    page-break-inside: avoid;
    border: 1px solid rgba(255, 255, 255, 0.1);
}}

code {{
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    font-size: 0.9em;
}}

p code, li code {{
    background: rgba(0, 0, 0, 0.06);
    padding: 0.15em 0.45em;
    border-radius: 4px;
    color: var(--code-bg);
}}

pre code {{
    background: transparent;
    padding: 0;
    color: inherit;
}}

/* Tables */
table {{
    width: 100%;
    border-collapse: collapse;
    margin: 1.2em 0;
    font-size: 0.95em;
    page-break-inside: avoid;
    border: 1px solid var(--blockquote-border);
}}

th, td {{
    border: 1px solid var(--blockquote-border);
    padding: 0.7em 0.9em;
    text-align: {text_align};
}}

th {{
    background: var(--blockquote-bg);
    font-weight: 700;
    color: var(--primary-color);
}}

tr:nth-child(even) {{
    background: rgba(0, 0, 0, 0.02);
}}

/* Horizontal rules */
hr {{
    border: none;
    border-top: 1px solid var(--blockquote-border);
    margin: 2em 0;
}}

/* Chapter sections */
.chapter {{
    page-break-before: always;
}}

.chapter:first-of-type {{
    page-break-before: avoid;
}}

/* Table of contents */
.toc {{
    margin-bottom: 2em;
    page-break-after: always;
}}

.toc h2 {{
    margin-top: 0;
    margin-bottom: 1em;
    padding-bottom: 0.3em;
    border-bottom: 2px solid var(--primary-color);
}}

.toc-entry {{
    margin-bottom: 0.5em;
    color: var(--toc-color);
    line-height: 1.8;
}}

.toc-entry.level-1 {{
    font-weight: 700;
    font-size: 1.05em;
}}

.toc-entry.level-2 {{
    padding-inline-start: 1.2em;
    font-size: 0.98em;
}}

.toc-entry.level-3 {{
    padding-inline-start: 2.4em;
    font-size: 0.94em;
}}

.toc-entry.level-4 {{
    padding-inline-start: 3.6em;
    font-size: 0.9em;
}}

/* Print helpers */
img {{
    max-width: 100%;
    height: auto;
    page-break-inside: avoid;
}}

strong {{
    font-weight: 700;
}}
"""


class MarkdownService:

    DEFAULT_OPTIONS: Dict[str, Any] = {
        # Page & layout
        'page_size': 'A4',
        'margin_top': 20,
        'margin_bottom': 25,
        'margin_left': 20,
        'margin_right': 20,
        'direction': 'rtl',
        'text_align': 'justify',
        # Typography
        'font_family': 'IBM Plex Sans Arabic',
        'body_size': 12,
        'line_height': 2.8,
        # Content structure
        'include_toc': False,
        'cover_page': False,
        'chapter_breaks': True,
        'bookmarks_enabled': True,
        # Metadata
        'title': None,
        'subtitle': None,
        'author': None,
        'subject': None,
        'keywords': None,
        'publisher': None,
        'lang': 'ar',
        # Header
        'header_enabled': True,
        'header_text': None,
        'header_align': 'center',
        # Footer
        'footer_enabled': True,
        'footer_text': 'Generated by Warraq',
        'footer_page_numbers': True,
        'footer_align': 'center',
        'page_number_format': '{n}',
        # Color system
        'primary_color': '#111827',
        'text_color': '#1a1a1a',
        'link_color': '#2563eb',
        'accent_color': '#2563eb',
        'code_background': '#1e1e2e',
        'code_text': '#cdd6f4',
        'blockquote_border': '#cbd5e1',
        'blockquote_background': '#f8fafc',
        'highlight_color': '#fef08a',
        'header_color': '#4b5563',
        'footer_color': '#6b7280',
        'page_number_color': '#6b7280',
        'toc_color': '#374151',
    }

    ILLEGAL_FILENAME_CHARS = set('\\/:*?"<>|')

    @staticmethod
    def _sanitize_title(title: str) -> str:
        title = html.unescape(title)
        illegal = {
            '\\': ' - ',
            '/': ' - ',
            ':': ' -',
            '*': '×',
            '?': '',
            '"': "'",
            '<': '‹',
            '>': '›',
            '|': ' - ',
        }
        for ch, repl in illegal.items():
            title = title.replace(ch, repl)
        return re.sub(r'\s+', ' ', title).strip()

    @staticmethod
    def _has_illegal_chars(title: str) -> bool:
        return any(ch in title for ch in MarkdownService.ILLEGAL_FILENAME_CHARS)

    @staticmethod
    def _build_playwright_template(opts: dict, kind: str) -> str:
        """Build a self-contained HTML header/footer template for Playwright."""
        if kind == 'header' and not opts.get('header_enabled'):
            return '<div></div>'
        if kind == 'footer' and not opts.get('footer_enabled'):
            return '<div></div>'

        direction = 'rtl' if opts.get('direction') == 'rtl' else 'ltr'
        text_align = 'right' if direction == 'rtl' else 'left'
        selected_font = opts.get('font_family', 'Noto Naskh Arabic')
        font_family = f"'{selected_font}', 'Noto Naskh Arabic', 'Segoe UI', 'Arial', sans-serif"

        if kind == 'header':
            align = opts.get('header_align', 'center')
            color = opts.get('header_color', '#4b5563')
            text = opts.get('header_text', '')
            if not text:
                return '<div></div>'
            font_size = max(7, int(opts.get('body_size', 12) * 0.65))
            justify = {'left': 'flex-start', 'center': 'center', 'right': 'flex-end'}.get(align, 'center')
            return f"""<div style="width:100%;font-size:{font_size}pt;font-family:{font_family};color:{color};direction:{direction};text-align:{align};display:flex;justify-content:{justify};align-items:center;padding:0 10mm;">
                <span>{text}</span>
            </div>"""
        else:
            align = opts.get('footer_align', 'center')
            color = opts.get('footer_color', '#6b7280')
            pn_color = opts.get('page_number_color', '#6b7280')
            text = opts.get('footer_text', '')
            page_numbers = opts.get('footer_page_numbers', True)
            font_size = max(7, int(opts.get('body_size', 12) * 0.6))

            if align == 'center':
                if text and page_numbers:
                    center = f"{text} — <span class=\"pageNumber\" style=\"color:{pn_color};\"></span>"
                elif text:
                    center = text
                elif page_numbers:
                    center = f"<span class=\"pageNumber\" style=\"color:{pn_color};\"></span>"
                else:
                    return '<div></div>'
                return f"""<div style="width:100%;font-size:{font_size}pt;font-family:{font_family};color:{color};direction:{direction};text-align:center;display:flex;justify-content:center;align-items:center;padding:0 10mm;">
                    <span>{center}</span>
                </div>"""
            else:
                left = ''
                right = ''
                if align == 'left':
                    left = text if text else ''
                    if page_numbers:
                        right = f"<span class=\"pageNumber\" style=\"color:{pn_color};\"></span>"
                else:  # right
                    right = text if text else ''
                    if page_numbers:
                        left = f"<span class=\"pageNumber\" style=\"color:{pn_color};\"></span>"

                if not left and not right:
                    return '<div></div>'
                return f"""<div style="width:100%;font-size:{font_size}pt;font-family:{font_family};color:{color};direction:{direction};display:flex;justify-content:space-between;align-items:center;padding:0 10mm;">
                    <span>{left}</span>
                    <span>{right}</span>
                </div>"""

    @staticmethod
    def convert_to_pdf(
        markdown_files: List[str],
        output_path: str,
        options: Optional[dict] = None
    ) -> str:
        opts = dict(MarkdownService.DEFAULT_OPTIONS)
        if options:
            opts.update({k: v for k, v in options.items() if v is not None})

        # Normalize numeric margins
        for key in ('margin_top', 'margin_bottom', 'margin_left', 'margin_right'):
            opts[key] = float(opts.get(key, 20))
        opts['body_size'] = int(opts.get('body_size', 12))
        opts['line_height'] = float(opts.get('line_height', 2.8))

        if not opts.get('text_align'):
            opts['text_align'] = 'right' if opts.get('direction') == 'rtl' else 'left'

        # Normalize font family name
        raw_font = opts.get('font_family', 'Noto Naskh Arabic')
        opts['font_family'] = FONT_NAME_MAP.get(raw_font, raw_font)
        if opts['font_family'] not in AVAILABLE_FONTS:
            opts['font_family'] = 'Noto Naskh Arabic'

        md_text, file_names = MarkdownService._read_and_merge_files(markdown_files, opts)
        html, bookmarks = MarkdownService._build_html(md_text, file_names, opts)

        tmp_html = Path(tempfile.mkdtemp()) / 'warraq_output.html'
        tmp_html.write_text(html, encoding='utf-8')

        header_template = MarkdownService._build_playwright_template(opts, 'header')
        footer_template = MarkdownService._build_playwright_template(opts, 'footer')
        has_header_footer = bool(header_template.strip() != '<div></div>' or footer_template.strip() != '<div></div>')

        bookmark_page_numbers = {}
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page()
            page.goto(tmp_html.as_uri(), wait_until='networkidle')


            pdf_kwargs = {
                'path': output_path,
                'print_background': True,
                'format': PAGE_SIZES.get(opts['page_size'], ('A4', '210mm 297mm'))[0],
                'margin': {
                    'top': f"{opts['margin_top']}mm",
                    'bottom': f"{opts['margin_bottom']}mm",
                    'left': f"{opts['margin_left']}mm",
                    'right': f"{opts['margin_right']}mm",
                },
            }
            if has_header_footer:
                pdf_kwargs['display_header_footer'] = True
                pdf_kwargs['header_template'] = header_template
                pdf_kwargs['footer_template'] = footer_template

            page.pdf(**pdf_kwargs)
            browser.close()

        try:
            tmp_html.unlink()
        except Exception:
            pass

        MarkdownService._apply_pdf_metadata(output_path, opts)
        MarkdownService._apply_bookmarks(output_path, bookmarks, bookmark_page_numbers)
        return output_path

    @staticmethod
    def _read_and_merge_files(markdown_files: List[str], opts: dict):
        sections = []
        file_names = []
        for file_path in markdown_files:
            if not os.path.isfile(file_path):
                continue
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                content = f.read()
            file_name = os.path.splitext(os.path.basename(file_path))[0]
            file_names.append(file_name)
            sections.append(content)
        return '\n\n---\n\n'.join(sections), file_names

    @staticmethod
    def _preprocess_markdown(text: str) -> str:
        # ==highlight== → <mark>...</mark>
        text = re.sub(r'==([^=]+)==', r'<mark>\1</mark>', text)
        return text

    @staticmethod
    def _build_html(md_text: str, file_names: List[str], opts: dict):
        md_text = MarkdownService._preprocess_markdown(md_text)

        md = MarkdownIt(
            'commonmark',
            {'html': True, 'breaks': False, 'linkify': True, 'lang_prefix': 'language-'},
        )
        md.enable('table')
        md.use(container_plugin, name='warning')
        md.use(footnote_plugin)

        def _strip_html_tags(value: str) -> str:
            return re.sub(r'<[^>]+>', '', value)

        # Split into chapters based on --- separators
        parts = re.split(r'\n\s*-{3,}\s*\n', md_text)
        chapter_htmls = []
        bookmarks = []
        multiple_files = len(parts) > 1
        for i, part in enumerate(parts):
            part_html = md.render(part)
            file_name = file_names[i] if i < len(file_names) else f'Part {i + 1}'

            # Extract headings first (before adding IDs)
            heading_matches = list(re.finditer(r'<(h[1-6])>(.*?)</\1>', part_html, flags=re.S))

            # Determine file/chapter title
            file_title = file_name
            first_h1_idx = next(
                (idx for idx, m in enumerate(heading_matches) if m.group(1) == 'h1'), None
            )
            if not multiple_files and opts.get('title'):
                file_title = opts['title']
            elif first_h1_idx is not None:
                raw = _strip_html_tags(heading_matches[first_h1_idx].group(2)).strip()
                if raw:
                    file_title = raw

            bookmarks_enabled = opts.get('bookmarks_enabled', True)

            if bookmarks_enabled:
                file_title_clean = MarkdownService._sanitize_title(file_title)
                if file_title_clean:
                    bookmarks.append({
                        'level': 1,
                        'title': file_title_clean,
                        'id': f'bm-file-{i}'
                    })

            cls = 'chapter' if i > 0 or opts.get('chapter_breaks', True) else 'chapter first'
            section_marker = f'<span class="bm-marker">BMK_BM_FILE_{i} </span>'
            chapter_htmls.append(f'<section id="bm-file-{i}" class="{cls}">{section_marker}\n{part_html}\n</section>')
        body_html = '\n'.join(chapter_htmls)

        toc_html = ''
        if opts.get('include_toc'):
            toc_html = MarkdownService._generate_toc(md_text, opts)

        cover_html = ''
        if opts.get('cover_page'):
            cover_html = MarkdownService._build_cover_page(opts)

        page_size_tuple = PAGE_SIZES.get(opts['page_size'], ('A4', '210mm 297mm'))
        page_size = page_size_tuple[1]

        font_key = opts.get('font_family', 'Noto Naskh Arabic')
        font_info = AVAILABLE_FONTS.get(font_key, AVAILABLE_FONTS['Noto Naskh Arabic'])
        regular_path = font_info['regular'].resolve().as_posix()
        bold_path = font_info['bold'].resolve().as_posix() if font_info['bold'].is_file() else regular_path

        css = CSS_TEMPLATE.format(
            font_family=font_key,
            regular_path=regular_path,
            bold_path=bold_path,
            page_size=page_size,
            direction=opts['direction'],
            text_align=opts['text_align'],
            body_size=opts['body_size'],
            line_height=opts['line_height'],
            primary_color=opts['primary_color'],
            text_color=opts['text_color'],
            link_color=opts['link_color'],
            accent_color=opts['accent_color'],
            code_background=opts['code_background'],
            code_text=opts['code_text'],
            blockquote_border=opts['blockquote_border'],
            blockquote_background=opts['blockquote_background'],
            highlight_color=opts['highlight_color'],
            header_color=opts['header_color'],
            footer_color=opts['footer_color'],
            page_number_color=opts['page_number_color'],
            toc_color=opts['toc_color'],
        )

        lang = opts.get('lang', 'ar')
        html = f"""<!DOCTYPE html>
<html dir="{opts['direction']}" lang="{lang}">
<head>
<meta charset="utf-8">
<style>
{css}
</style>
</head>
<body>
{cover_html}
{toc_html}
{body_html}
</body>
</html>"""
        return html, bookmarks

    @staticmethod
    def _build_cover_page(opts: dict) -> str:
        title = opts.get('title', '')
        subtitle = opts.get('subtitle', '')
        author = opts.get('author', '')
        publisher = opts.get('publisher', '')
        date_str = datetime.now().strftime('%Y-%m-%d')

        parts = []
        if title:
            parts.append(f'<div class="cover-title">{title}</div>')
        if subtitle:
            parts.append(f'<div class="cover-subtitle">{subtitle}</div>')
        if author:
            parts.append(f'<div class="cover-author">{author}</div>')

        meta_parts = []
        if publisher:
            meta_parts.append(publisher)
        meta_parts.append(date_str)

        if meta_parts:
            parts.append(f'<div class="cover-meta">{" — ".join(meta_parts)}</div>')

        return f'<div class="cover-page">\n{"\n".join(parts)}\n</div>\n'

    @staticmethod
    def _generate_toc(md_text: str, opts: dict) -> str:
        entries = []
        for line in md_text.split('\n'):
            m = re.match(r'^(#{1,4})\s+(.+)$', line.strip())
            if m:
                level = len(m.group(1))
                title = m.group(2).strip()
                entries.append(f'<div class="toc-entry level-{level}">{title}</div>')
        if not entries:
            return ''
        is_rtl = opts.get('direction') == 'rtl'
        toc_title = 'فهرس المحتويات' if is_rtl else 'Table of Contents'
        toc_marker = '<span class="bm-marker">BMK_BM_TOC_PAGE </span>'
        return f'<div id="bm-toc-page" class="toc">{toc_marker}\n<h2>{toc_title}</h2>\n' + '\n'.join(entries) + '\n</div>\n'

    @staticmethod
    def _apply_pdf_metadata(pdf_path: str, opts: dict) -> None:
        try:
            doc = fitz.open(pdf_path)
            metadata = doc.metadata

            if opts.get('title'):
                metadata['title'] = opts['title']
            if opts.get('author'):
                metadata['author'] = opts['author']
            if opts.get('subject'):
                metadata['subject'] = opts['subject']
            if opts.get('keywords'):
                metadata['keywords'] = opts['keywords']

            metadata['creator'] = opts.get('publisher') or 'Warraq PDF Tools'
            metadata['producer'] = 'Warraq Markdown to PDF (Chromium)'
            metadata['creationDate'] = datetime.now().strftime("D:%Y%m%d%H%M%S")
            metadata['modDate'] = datetime.now().strftime("D:%Y%m%d%H%M%S")

            doc.set_metadata(metadata)
            doc.save(pdf_path, incremental=True, encryption=0)
            doc.close()
        except Exception:
            pass

    @staticmethod
    def _apply_bookmarks(pdf_path: str, bookmarks: List[dict], page_numbers: dict) -> None:
        if not bookmarks:
            return
        try:
            doc = fitz.open(pdf_path)

            # Strategy: use marker text search for file-level bookmarks, with
            # PyMuPDF's page.search_for() as fallback for unmatched titles.

            # Identify the TOC page so we don't accidentally match headings
            # listed in the table of contents.
            toc_page = None
            toc_marker = 'BMK_BM_TOC_PAGE'
            for page_idx in range(len(doc)):
                if 'BMK_BM_TOC_PAGE' in doc[page_idx].get_text():
                    toc_page = page_idx + 1
                    break

            # ── Pass 1: markers (for file-level and TOC bookmarks) ──────
            marker_to_id = {}
            for bm in bookmarks:
                bid = bm.get('id')
                if bid:
                    marker = f"BMK_{bid.upper().replace('-', '_')}"
                    marker_to_id[marker] = bid
            marker_pattern = re.compile(r'BMK_[A-Z0-9_]+')
            for page_idx in range(len(doc)):
                text = doc[page_idx].get_text()
                for marker in marker_pattern.findall(text):
                    bid = marker_to_id.get(marker)
                    if bid and bid not in page_numbers:
                        page_numbers[bid] = page_idx + 1

            # ── Pass 2: direct title search for heading bookmarks ──────
            heading_bookmarks = [
                bm for bm in bookmarks
                if bm.get('id') and bm['id'].startswith('bm-f')
                and bm.get('title')
            ]
            for bm in heading_bookmarks:
                if bm['id'] in page_numbers:
                    continue
                title = bm['title']
                for page_idx in range(len(doc)):
                    pg = page_idx + 1
                    if pg == toc_page:
                        continue
                    # page.search_for() returns rectangles; non-empty = found
                    if doc[page_idx].search_for(title):
                        page_numbers[bm['id']] = pg
                        break

            # ── Assemble the TOC from resolved page numbers ────────────
            toc = []
            for bm in bookmarks:
                bid = bm.get('id')
                page_num = page_numbers.get(bid)
                if page_num is None:
                    continue
                title = bm.get('title', '').strip()
                if not title:
                    continue
                toc.append([bm['level'], title, page_num])

            if toc:
                # Shift levels so the minimum is 1
                min_level = min(entry[0] for entry in toc)
                if min_level > 1:
                    shift = min_level - 1
                    for entry in toc:
                        entry[0] -= shift

                # Ensure the very first entry is level 1
                if toc[0][0] != 1:
                    toc[0][0] = 1

                # PyMuPDF requires that no entry skips more than one level
                # relative to the previous entry (e.g. h1 -> h3 is invalid).
                # Walk through and clamp each level to prev_level + 1 at most.
                prev_level = toc[0][0]
                for entry in toc[1:]:
                    entry[0] = min(entry[0], prev_level + 1)
                    entry[0] = max(entry[0], 1)      # never below 1
                    prev_level = entry[0]

                doc.set_toc(toc)
                doc.save(pdf_path, incremental=True, encryption=0)
            doc.close()
        except Exception as e:
            raise RuntimeError(f"Failed to apply bookmarks: {e}")
