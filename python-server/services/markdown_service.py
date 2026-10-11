"""Professional Markdown to PDF conversion service using Chromium"""
import atexit
import base64
import html
import os
import re
import tempfile
import threading
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from markdown_it import MarkdownIt
from mdit_py_plugins.container import container_plugin
from mdit_py_plugins.footnote import footnote_plugin
from playwright.sync_api import sync_playwright
import fitz

FONT_DIR = Path(__file__).resolve().parent.parent / 'assets' / 'fonts'

_thread_local = threading.local()
_started_playwrights = []
_started_playwrights_lock = threading.Lock()

BROWSER_LAUNCH_ARGS = [
    '--disable-gpu',
    '--disable-extensions',
    '--disable-dev-shm-usage',
    '--no-sandbox',
]


def _get_thread_state():
    """Lazily create a Playwright browser bound to the current thread.

    Playwright's Sync API is pinned to the thread that started it, so each
    worker thread gets its own instance. FastAPI runs sync endpoints and
    run_in_threadpool jobs on worker threads, so this is always safe there.
    """
    if not hasattr(_thread_local, 'browser'):
        _thread_local.playwright = sync_playwright().start()
        _thread_local.browser = _thread_local.playwright.chromium.launch(
            args=BROWSER_LAUNCH_ARGS
        )
        with _started_playwrights_lock:
            _started_playwrights.append(_thread_local.playwright)
    return _thread_local


def _shutdown_browsers():
    with _started_playwrights_lock:
        instances = list(_started_playwrights)
        _started_playwrights.clear()
    for pw in instances:
        try:
            pw.stop()
        except Exception:
            pass


atexit.register(_shutdown_browsers)

# Compiled regexes for performance
HIGHLIGHT_RE = re.compile(r'==([^=]+)==')
HTML_TAGS_RE = re.compile(r'<[^>]+>')
HEADING_RE = re.compile(r'<(h[1-6])>(.*?)</\1>', flags=re.S)
CHAPTER_SPLIT_RE = re.compile(r'\n\s*-{3,}\s*\n')
MARKER_PATTERN = re.compile(r'BMK_[A-Z0-9_]+')
TOC_ENTRY_RE = re.compile(r'^(#{1,4})\s+(.+)$')

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
    src: url(data:font/ttf;base64,{regular_data}) format('truetype');
    font-weight: 400;
    font-style: normal;
}}
@font-face {{
    font-family: '{font_family}';
    src: url(data:font/ttf;base64,{bold_data}) format('truetype');
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
    counter-reset: chapter figure;
    font-family: '{font_family}', 'Noto Naskh Arabic', serif;
    font-size: var(--body-size);
    line-height: var(--line-height);
    color: var(--text-color);
    direction: {direction};
    text-align: {text_align};
    hyphenate-character: auto;
    -webkit-font-smoothing: antialiased;
    background: #ffffff;
    margin: 0;
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
    break-after: page;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    width: {cover_width_css};
    height: {cover_height_css};
    max-height: {cover_height_css};
    margin: 0;
    position: relative;
    direction: {direction};
    overflow: hidden;
    background: {cover_background};
    color: {cover_text_color};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}}

.cover-content {{
    width: 100%;
    box-sizing: border-box;
    padding: 14mm 18mm;
}}

/* Inner decorative frame */
.cover-page::before {{
    content: "";
    position: absolute;
    top: 8mm; left: 8mm; right: 8mm; bottom: 8mm;
    border: 0.35mm solid {cover_accent_color};
    border-radius: 3mm;
    opacity: 0.55;
}}

/* Accent bands */
.cover-page .cover-band {{
    position: absolute;
    left: 0; right: 0;
    height: 5mm;
    background: {cover_accent_color};
}}
.cover-page .cover-band.top {{ top: 0; }}
.cover-page .cover-band.bottom {{ bottom: 0; }}

.cover-page .cover-title {{
    font-size: 3em;
    font-weight: 800;
    color: {cover_text_color};
    line-height: 1.5;
    margin: 0 0 0.5em;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.22);
}}

.cover-page .cover-divider {{
    width: 34mm;
    height: 0.6mm;
    background: {cover_accent_color};
    border-radius: 1mm;
    margin: 0 auto 0.6em;
}}

.cover-page .cover-subtitle {{
    font-size: 1.45em;
    color: {cover_text_color};
    opacity: 0.9;
    line-height: 1.8;
    margin: 0 0 1.4em;
}}

.cover-page .cover-author {{
    font-size: 1.1em;
    color: {cover_text_color};
    opacity: 0.92;
    line-height: 1.8;
    margin: 0 0 0.4em;
}}

.cover-page .cover-meta {{
    font-size: 0.95em;
    color: {cover_text_color};
    opacity: 0.75;
    line-height: 1.8;
    margin-top: 3em;
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

/* Blockquotes & Callouts */
blockquote {{
    margin: 1.4em 0;
    padding: 1em 1.4em;
    border-inline-start: 5px solid var(--accent-color);
    background: var(--blockquote-bg);
    color: var(--text-color);
    border-radius: 0 6px 6px 0;
}}

.warning, .tip, .note, .danger {{
    margin: 1.4em 0;
    padding: 1em 1.4em;
    border-radius: 0 6px 6px 0;
}}
.warning {{
    border-inline-start: 5px solid #d97706;
    background: #fffbeb;
}}
.warning::before {{
    content: "⚠ تنبيه";
    display: block;
    font-weight: 700;
    color: #b45309;
    margin-bottom: 0.4em;
}}
.tip {{
    border-inline-start: 5px solid #16a34a;
    background: #f0fdf4;
}}
.tip::before {{
    content: "💡 تلميح";
    display: block;
    font-weight: 700;
    color: #15803d;
    margin-bottom: 0.4em;
}}
.note {{
    border-inline-start: 5px solid #2563eb;
    background: #eff6ff;
}}
.note::before {{
    content: "📝 ملاحظة";
    display: block;
    font-weight: 700;
    color: #1d4ed8;
    margin-bottom: 0.4em;
}}
.danger {{
    border-inline-start: 5px solid #dc2626;
    background: #fef2f2;
}}
.danger::before {{
    content: "⛔ تحذير";
    display: block;
    font-weight: 700;
    color: #b91c1c;
    margin-bottom: 0.4em;
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

pre[class*="language-"] {{
    position: relative;
    padding-top: 2.2em;
}}
pre[class*="language-"]::before {{
    content: attr(data-lang);
    position: absolute;
    top: 0; inset-inline-start: 0;
    background: rgba(255,255,255,0.08);
    padding: 0.3em 0.9em;
    font-size: 0.75em;
    border-radius: 8px 0 8px 0;
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

.chapter > h1 {{
    counter-increment: chapter;
}}
.chapter > h1::before {{
    display: block;
    font-size: 0.4em;
    font-weight: 400;
    color: var(--accent-color);
    letter-spacing: 0.15em;
    margin-bottom: 0.5em;
    content: counter(chapter, arabic-indic) " — الفصل";
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
    display: flex;
    justify-content: space-between;
    align-items: baseline;
}}
.toc-entry .toc-title::after {{
    content: "";
    flex: 1;
    border-bottom: 1px dotted var(--toc-color);
    margin: 0 0.5em;
    transform: translateY(-0.2em);
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

figure {{ margin: 1.4em 0; text-align: center; }}
figcaption {{
    font-size: 0.85em;
    color: var(--footer-color);
    margin-top: 0.5em;
    counter-increment: figure;
}}
figcaption::before {{ content: "شكل " counter(figure, arabic-indic) ": "; font-weight: 700; }}

strong {{
    font-weight: 700;
}}

/* Footnotes */
.footnote-ref {{ 
    color: var(--accent-color); 
    font-weight: 700;
    text-decoration: none;
}}
.footnotes {{
    margin-top: 3em;
    padding-top: 1em;
    border-top: 1px solid var(--blockquote-border);
    font-size: 0.85em;
    color: var(--footer-color);
}}
.footnotes ol {{ padding-inline-start: 1.5em; }}
"""


class MarkdownService:

    @classmethod
    def start_browser(cls):
        """Start the current thread's browser (used by tests)."""
        _get_thread_state()

    @classmethod
    def stop_browser(cls):
        """Stop the current thread's browser."""
        pw = getattr(_thread_local, 'playwright', None)
        if pw is not None:
            try:
                pw.stop()
            except Exception:
                pass
            try:
                del _thread_local.playwright
            except AttributeError:
                pass
        _thread_local.browser = None

    @classmethod
    def get_browser(cls):
        state = _get_thread_state()
        browser = state.browser
        if browser is None or not browser.is_connected():
            try:
                if browser is not None:
                    browser.close()
            except Exception:
                pass
            with _started_playwrights_lock:
                state.playwright = sync_playwright().start()
                state.browser = state.playwright.chromium.launch(
                    args=BROWSER_LAUNCH_ARGS
                )
                _started_playwrights.append(state.playwright)
            browser = state.browser
        return browser


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
        'line_height': 2.0,
        # Content structure
        'include_toc': False,
        'cover_page': False,
        'chapter_breaks': True,
        'bookmarks_enabled': True,
        # Cover page styling
        'cover_bg_type': 'gradient',     # 'white' | 'solid' | 'gradient'
        'cover_bg_color': None,          # solid background; falls back to primary
        'cover_gradient_from': None,     # falls back to primary
        'cover_gradient_to': None,       # falls back to accent
        'cover_accent_color': None,      # bands/frame; gold on colored, accent on white
        'cover_text_color': None,        # white on colored, primary on white
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
        'footer_text': 'Matn — Smart PDF Workspace by Zemam Apps',
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
        opts['line_height'] = float(opts.get('line_height', 2.0))

        if not opts.get('text_align'):
            opts['text_align'] = 'right' if opts.get('direction') == 'rtl' else 'left'

        # Normalize font family name
        raw_font = opts.get('font_family', 'Noto Naskh Arabic')
        opts['font_family'] = FONT_NAME_MAP.get(raw_font, raw_font)
        if opts['font_family'] not in AVAILABLE_FONTS:
            opts['font_family'] = 'Noto Naskh Arabic'

        md_text, file_names = MarkdownService._read_and_merge_files(markdown_files, opts)
        parts = MarkdownService._build_parts(md_text, file_names, opts)
        bookmarks = parts['bookmarks']

        header_template = MarkdownService._build_playwright_template(opts, 'header')
        footer_template = MarkdownService._build_playwright_template(opts, 'footer')
        has_header_footer = bool(header_template.strip() != '<div></div>' or footer_template.strip() != '<div></div>')

        browser = MarkdownService.get_browser()
        cover_html = parts['cover_html']

        if cover_html:
            tmp_dir = tempfile.mkdtemp()
            cover_pdf = os.path.join(tmp_dir, 'warraq_cover.pdf')
            content_pdf = os.path.join(tmp_dir, 'warraq_content.pdf')
            try:
                MarkdownService._render_html_to_pdf(
                    browser, MarkdownService._assemble_html(parts, opts, 'cover'),
                    cover_pdf, opts, full_bleed=True,
                )
                MarkdownService._render_html_to_pdf(
                    browser, MarkdownService._assemble_html(parts, opts, 'content'),
                    content_pdf, opts, full_bleed=False,
                    header_footer=has_header_footer,
                    header_template=header_template, footer_template=footer_template,
                )
                MarkdownService._merge_pdfs(cover_pdf, content_pdf, output_path)
            finally:
                for p in (cover_pdf, content_pdf):
                    try:
                        os.remove(p)
                    except OSError:
                        pass
        else:
            MarkdownService._render_html_to_pdf(
                browser, MarkdownService._assemble_html(parts, opts, 'content'),
                output_path, opts, full_bleed=False,
                header_footer=has_header_footer,
                header_template=header_template, footer_template=footer_template,
            )

        MarkdownService._apply_metadata_and_bookmarks(output_path, opts, bookmarks, {})
        return output_path

    @staticmethod
    def _render_html_to_pdf(
        browser, html: str, path: str, opts: dict,
        full_bleed: bool = False,
        header_footer: bool = False,
        header_template: str = '',
        footer_template: str = '',
    ) -> None:
        page = browser.new_page()
        try:
            page.set_content(html, wait_until='load')
            page.evaluate("document.fonts.ready")

            pdf_kwargs = {
                'path': path,
                'print_background': True,
                'format': PAGE_SIZES.get(opts['page_size'], ('A4', '210mm 297mm'))[0],
            }
            if full_bleed:
                pdf_kwargs['margin'] = {'top': '0', 'bottom': '0', 'left': '0', 'right': '0'}
            else:
                pdf_kwargs['margin'] = {
                    'top': f"{opts['margin_top']}mm",
                    'bottom': f"{opts['margin_bottom']}mm",
                    'left': f"{opts['margin_left']}mm",
                    'right': f"{opts['margin_right']}mm",
                }
            if header_footer:
                pdf_kwargs['display_header_footer'] = True
                pdf_kwargs['header_template'] = header_template
                pdf_kwargs['footer_template'] = footer_template

            page.pdf(**pdf_kwargs)
        finally:
            page.close()

    @staticmethod
    def _merge_pdfs(cover_pdf: str, content_pdf: str, output_path: str) -> None:
        out = fitz.open()
        try:
            with fitz.open(cover_pdf) as c:
                out.insert_pdf(c)
            with fitz.open(content_pdf) as b:
                out.insert_pdf(b)
            out.save(output_path)
        finally:
            out.close()

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
        return HIGHLIGHT_RE.sub(r'<mark>\1</mark>', text)

    @staticmethod
    def _build_parts(md_text: str, file_names: List[str], opts: dict) -> dict:
        md_text = MarkdownService._preprocess_markdown(md_text)

        md = MarkdownIt(
            'commonmark',
            {'html': True, 'breaks': False, 'linkify': True, 'lang_prefix': 'language-'},
        )
        md.enable('table')
        md.use(container_plugin, name='warning')
        md.use(container_plugin, name='tip')
        md.use(container_plugin, name='note')
        md.use(container_plugin, name='danger')
        md.use(footnote_plugin)

        # Override image rendering for figures and captions
        default_image = md.renderer.rules.get("image")
        def render_image(self, tokens, idx, options, env):
            token = tokens[idx]
            alt = self.renderInlineAsText(token.children, options, env)
            src = html.escape(token.attrGet('src') or '')
            title = token.attrGet('title')
            
            img_html = f'<img src="{src}" alt="{html.escape(alt)}"'
            if title:
                img_html += f' title="{html.escape(title)}"'
            img_html += ' />'
            
            if title:
                return f'<figure>{img_html}<figcaption>{html.escape(title)}</figcaption></figure>'
            return img_html
            
        md.renderer.rules['image'] = render_image

        # Override fence for data-lang
        default_fence = md.renderer.rules.get('fence')
        def render_fence(self, tokens, idx, options, env):
            token = tokens[idx]
            lang = token.info.strip() if token.info else ""
            
            # Temporary replace the default rendering logic with a custom one
            # to inject data-lang. Instead of full rewrite, we'll let default run and patch it.
            html_out = ""
            if default_fence:
                html_out = default_fence(self, tokens, idx, options, env)
            else:
                html_out = f'<pre><code class="language-{html.escape(lang)}">{html.escape(token.content)}</code></pre>'
                
            if lang and html_out:
                html_out = html_out.replace(f'<pre><code class="language-{html.escape(lang)}"', f'<pre class="language-{html.escape(lang)}" data-lang="{html.escape(lang)}"><code', 1)
            return html_out
            
        md.renderer.rules['fence'] = render_fence

        def _strip_html_tags(value: str) -> str:
            return HTML_TAGS_RE.sub('', value)

        # Split into chapters based on --- separators
        parts = CHAPTER_SPLIT_RE.split(md_text)
        chapter_htmls = []
        bookmarks = []
        multiple_files = len(parts) > 1
        for i, part in enumerate(parts):
            part_html = md.render(part)
            file_name = file_names[i] if i < len(file_names) else f'Part {i + 1}'

            # Extract headings first (before adding IDs)
            heading_matches = list(HEADING_RE.finditer(part_html))

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
                
                # Process headings in part_html to inject markers
                def inject_heading_marker(m):
                    h_tag = m.group(1)
                    inner_html = m.group(2)
                    raw_title = _strip_html_tags(inner_html).strip()
                    clean_title = MarkdownService._sanitize_title(raw_title)
                    if not clean_title:
                        return m.group(0)
                    
                    level = int(h_tag[1])
                    bm_level = level + 1 # file title is level 1
                    
                    h_idx = len([b for b in bookmarks if b.get('id', '').startswith(f'bm-f{i}-h')])
                    bm_id = f'bm-f{i}-h{h_idx}'
                    
                    bookmarks.append({
                        'level': bm_level,
                        'title': clean_title,
                        'id': bm_id
                    })
                    
                    marker = f'<span class="bm-marker">BMK_{bm_id.upper().replace("-", "_")} </span>'
                    return f'<{h_tag}>{marker}{inner_html}</{h_tag}>'

                part_html = HEADING_RE.sub(inject_heading_marker, part_html)

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
        page_width_mm = float(page_size.split()[0].replace('mm', ''))
        page_height_mm = float(page_size.split()[1].replace('mm', ''))

        font_key = opts.get('font_family', 'Noto Naskh Arabic')
        font_info = AVAILABLE_FONTS.get(font_key, AVAILABLE_FONTS['Noto Naskh Arabic'])
        regular_data = base64.b64encode(font_info['regular'].read_bytes()).decode('ascii')
        if font_info['bold'].is_file():
            bold_data = base64.b64encode(font_info['bold'].read_bytes()).decode('ascii')
        else:
            bold_data = regular_data

        cover_background, cover_text_color, cover_accent_color = MarkdownService._build_cover_style(opts)

        css = CSS_TEMPLATE.format(
            font_family=font_key,
            regular_data=regular_data,
            bold_data=bold_data,
            page_size=page_size,
            cover_width_css=f'{page_width_mm}mm',
            cover_height_css=f'{page_height_mm}mm',
            cover_background=cover_background,
            cover_text_color=cover_text_color,
            cover_accent_color=cover_accent_color,
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

        return {
            'css': css,
            'cover_html': cover_html,
            'toc_html': toc_html,
            'body_html': body_html,
            'bookmarks': bookmarks,
        }

    @staticmethod
    def _assemble_html(parts: dict, opts: dict, mode: str = 'full') -> str:
        """Assemble a full HTML document from parts.

        mode: 'full' (cover + toc + body), 'cover' (cover only) or 'content' (toc + body).
        """
        lang = opts.get('lang', 'ar')
        if mode == 'cover':
            body = parts['cover_html']
        elif mode == 'content':
            body = f"{parts['toc_html']}\n{parts['body_html']}"
        else:
            body = f"{parts['cover_html']}\n{parts['toc_html']}\n{parts['body_html']}"
        return f"""<!DOCTYPE html>
<html dir="{opts['direction']}" lang="{lang}">
<head>
<meta charset="utf-8">
<style>
{parts['css']}
</style>
</head>
<body>
{body}
</body>
</html>"""

    @staticmethod
    def _build_html(md_text: str, file_names: List[str], opts: dict):
        parts = MarkdownService._build_parts(md_text, file_names, opts)
        return MarkdownService._assemble_html(parts, opts, 'full'), parts['bookmarks']

    @staticmethod
    def _build_cover_style(opts: dict):
        """Resolve cover background/text/accent values from options."""
        bg_type = opts.get('cover_bg_type', 'gradient')
        primary = opts.get('primary_color', '#111827')
        accent = opts.get('accent_color', '#2563eb')
        gradient_from = opts.get('cover_gradient_from') or primary
        gradient_to = opts.get('cover_gradient_to') or accent

        if bg_type == 'white':
            background = '#ffffff'
        elif bg_type == 'solid':
            background = opts.get('cover_bg_color') or primary
        else:
            background = f'linear-gradient(150deg, {gradient_from} 0%, {gradient_to} 100%)'

        if opts.get('cover_text_color'):
            text_color = opts['cover_text_color']
        elif bg_type == 'white':
            text_color = primary
        else:
            text_color = '#ffffff'

        if opts.get('cover_accent_color'):
            accent_color = opts['cover_accent_color']
        elif bg_type == 'white':
            accent_color = accent
        else:
            accent_color = '#f5c518'

        return background, text_color, accent_color

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
            parts.append('<div class="cover-divider"></div>')
            parts.append(f'<div class="cover-subtitle">{subtitle}</div>')
        if author:
            parts.append(f'<div class="cover-author">{author}</div>')

        meta_parts = []
        if publisher:
            meta_parts.append(publisher)
        meta_parts.append(date_str)

        if meta_parts:
            parts.append(f'<div class="cover-meta">{" — ".join(meta_parts)}</div>')

        return ('<div class="cover-page">\n'
                '<div class="cover-band top"></div>\n'
                '<div class="cover-band bottom"></div>\n'
                '<div class="cover-content">\n'
                + '\n'.join(parts) + '\n</div>\n'
                '</div>\n')

    @staticmethod
    def _generate_toc(md_text: str, opts: dict) -> str:
        entries = []
        for line in md_text.split('\n'):
            m = TOC_ENTRY_RE.match(line.strip())
            if m:
                level = len(m.group(1))
                title = m.group(2).strip()
                entries.append(f'<div class="toc-entry level-{level}"><span class="toc-title">{title}</span></div>')
        if not entries:
            return ''
        is_rtl = opts.get('direction') == 'rtl'
        toc_title = 'فهرس المحتويات' if is_rtl else 'Table of Contents'
        toc_marker = '<span class="bm-marker">BMK_BM_TOC_PAGE </span>'
        return f'<div id="bm-toc-page" class="toc">{toc_marker}\n<h2>{toc_title}</h2>\n' + '\n'.join(entries) + '\n</div>\n'

    @staticmethod
    def _apply_metadata_and_bookmarks(pdf_path: str, opts: dict, bookmarks: List[dict], page_numbers: dict) -> None:
        try:
            doc = fitz.open(pdf_path)
            
            # --- Apply Metadata ---
            metadata = doc.metadata

            if opts.get('title'):
                metadata['title'] = opts['title']
            if opts.get('author'):
                metadata['author'] = opts['author']
            if opts.get('subject'):
                metadata['subject'] = opts['subject']
            if opts.get('keywords'):
                metadata['keywords'] = opts['keywords']

            metadata['creator'] = opts.get('creator') or opts.get('publisher') or 'Matn PDF Workspace'
            metadata['producer'] = opts.get('producer') or 'Matn Markdown to PDF (Chromium)'
            metadata['creationDate'] = datetime.now().strftime("D:%Y%m%d%H%M%S")
            metadata['modDate'] = datetime.now().strftime("D:%Y%m%d%H%M%S")

            doc.set_metadata(metadata)

            # --- Apply Bookmarks ---
            if bookmarks:
                # Strategy: use marker text search for all bookmarks (files and headings)
                
                marker_to_id = {}
                for bm in bookmarks:
                    bid = bm.get('id')
                    if bid:
                        marker = f"BMK_{bid.upper().replace('-', '_')}"
                        marker_to_id[marker] = bid

                # Pass 1: find all markers
                for page_idx in range(len(doc)):
                    text = doc[page_idx].get_text()
                    for marker in MARKER_PATTERN.findall(text):
                        bid = marker_to_id.get(marker)
                        if bid and bid not in page_numbers:
                            page_numbers[bid] = page_idx + 1

                # Assemble the TOC from resolved page numbers
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
                    prev_level = toc[0][0]
                    for entry in toc[1:]:
                        entry[0] = min(entry[0], prev_level + 1)
                        entry[0] = max(entry[0], 1)
                        prev_level = entry[0]

                    doc.set_toc(toc)

            doc.save(pdf_path, incremental=True, encryption=0)
            doc.close()
        except Exception as e:
            print(f"[MarkdownService] Failed to apply metadata/bookmarks: {e}")
