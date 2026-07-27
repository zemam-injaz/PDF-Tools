import os
import json
import pickle
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
import subprocess
from pathlib import Path
from .task_service import task_service

# Scopes for Google Drive and Google Docs
SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/documents.readonly'
]

APP_DATA_DIR = os.path.join(os.path.expanduser("~"), ".pdf-tools")
TOKEN_PATH = os.path.join(APP_DATA_DIR, "tahweel_token.pickle")
CLIENT_SECRETS_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "client_secrets.json")

class TahweelService:
    def __init__(self):
        self.creds = None
        if not os.path.exists(APP_DATA_DIR):
            os.makedirs(APP_DATA_DIR)
        
        # Verify tahweel installation
        try:
            import tahweel
            print(f"[TAHWEEL] Package found. Version: {getattr(tahweel, '__version__', 'unknown')}", flush=True)
        except ImportError:
            print("[TAHWEEL] WARNING: 'tahweel' package not found in current environment!", flush=True)
            
        # Verify poppler (required for pdf2image/tahweel)
        try:
            import subprocess
            result = subprocess.run(["pdftocairo", "-v"], capture_output=True, text=True)
            if result.returncode == 0:
                print("[TAHWEEL] Poppler found.", flush=True)
            else:
                print("[TAHWEEL] WARNING: Poppler (pdftocairo) returned non-zero. PDF conversion might fail.", flush=True)
        except FileNotFoundError:
            print("[TAHWEEL] WARNING: Poppler (pdftocairo) not found in PATH. This is required for Tahweel!", flush=True)

    def get_auth_status(self):
        self._load_creds()
        if self.creds and self.creds.valid:
            user_info = self.get_user_info()
            return {"authenticated": True, "user": user_info}
        return {"authenticated": False}

    def get_user_info(self):
        """Fetches basic user info from Google"""
        if not self.creds or not self.creds.valid:
            return None
        try:
            service = build('drive', 'v3', credentials=self.creds)
            about = service.about().get(fields="user").execute()
            return about.get('user')
        except Exception as e:
            print(f"[TAHWEEL] Error fetching user info: {e}", flush=True)
            return None

    def _load_creds(self):
        if os.path.exists(TOKEN_PATH):
            try:
                with open(TOKEN_PATH, 'rb') as token:
                    self.creds = pickle.load(token)
            except Exception as e:
                print(f"[TAHWEEL] Failed to load token file: {e}", flush=True)
                self.creds = None

        if self.creds and self.creds.expired and self.creds.refresh_token:
            try:
                self.creds.refresh(Request())
                with open(TOKEN_PATH, 'wb') as token:
                    pickle.dump(self.creds, token)
            except Exception as e:
                print(f"[TAHWEEL] Failed to refresh token: {e}", flush=True)
                os.remove(TOKEN_PATH)
                self.creds = None

    def authenticate(self):
        """Starts the OAuth2 flow"""
        if not os.path.exists(CLIENT_SECRETS_PATH):
            raise FileNotFoundError(f"client_secrets.json not found at {CLIENT_SECRETS_PATH}. Please follow the instructions to create it.")

        flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRETS_PATH, SCOPES)
        
        # Professional success page with Warraq branding, auto-close countdown
        success_msg = """
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Warraq — تمت المصادقة</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700&family=Inter:wght@400;500;600&display=swap');

            * { margin: 0; padding: 0; box-sizing: border-box; }

            body {
                font-family: 'Noto Naskh Arabic', 'Segoe UI', Tahoma, sans-serif;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
                color: #e2e8f0;
                overflow: hidden;
            }

            .bg-pattern {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background:
                    radial-gradient(ellipse at 20% 50%, rgba(99, 102, 241, 0.08) 0%, transparent 50%),
                    radial-gradient(ellipse at 80% 20%, rgba(245, 158, 11, 0.06) 0%, transparent 50%),
                    radial-gradient(ellipse at 50% 80%, rgba(16, 185, 129, 0.05) 0%, transparent 50%);
                pointer-events: none;
                z-index: 0;
            }

            .container {
                position: relative;
                z-index: 1;
                text-align: center;
                padding: 20px;
            }

            .card {
                background: rgba(30, 41, 59, 0.85);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(99, 102, 241, 0.2);
                border-radius: 24px;
                padding: 48px 40px;
                max-width: 480px;
                display: inline-block;
                box-shadow:
                    0 25px 50px rgba(0, 0, 0, 0.4),
                    0 0 0 1px rgba(99, 102, 241, 0.1) inset;
                animation: cardIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }

            @keyframes cardIn {
                from { opacity: 0; transform: translateY(30px) scale(0.96); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }

            .brand {
                font-family: 'Inter', sans-serif;
                font-size: 14px;
                font-weight: 500;
                letter-spacing: 0.05em;
                color: #6366f1;
                margin-bottom: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            .brand::before {
                content: '';
                display: inline-block;
                width: 8px; height: 8px;
                background: #10b981;
                border-radius: 50%;
                animation: pulse 2s ease-in-out infinite;
            }
            @keyframes pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.5; transform: scale(1.3); }
            }

            .check-wrapper {
                position: relative;
                display: inline-block;
                margin-bottom: 28px;
            }
            .check-circle {
                width: 80px; height: 80px;
                border-radius: 50%;
                background: linear-gradient(135deg, #10b981, #059669);
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 0 40px rgba(16, 185, 129, 0.3);
                animation: checkBounce 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both;
            }
            @keyframes checkBounce {
                0% { transform: scale(0); }
                50% { transform: scale(1.15); }
                100% { transform: scale(1); }
            }
            .check-circle svg { width: 36px; height: 36px; }
            .check-circle svg path {
                stroke-dasharray: 50;
                stroke-dashoffset: 50;
                animation: drawCheck 0.4s ease-out 0.5s forwards;
            }
            @keyframes drawCheck {
                to { stroke-dashoffset: 0; }
            }

            h1 {
                font-size: 24px;
                font-weight: 700;
                color: #f1f5f9;
                margin-bottom: 12px;
                line-height: 1.4;
            }
            .highlight { color: #10b981; }

            p {
                font-size: 16px;
                line-height: 1.8;
                color: #94a3b8;
                margin-bottom: 24px;
            }
            p strong {
                color: #e2e8f0;
                font-weight: 600;
            }

            .countdown-bar {
                background: rgba(99, 102, 241, 0.1);
                border: 1px solid rgba(99, 102, 241, 0.2);
                border-radius: 16px;
                padding: 18px 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                color: #a5b4fc;
                font-size: 15px;
                font-weight: 500;
                font-family: 'Inter', 'Segoe UI', sans-serif;
            }
            .countdown-number {
                background: rgba(99, 102, 241, 0.25);
                color: #c7d2fe;
                min-width: 36px;
                height: 36px;
                border-radius: 10px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
                font-size: 18px;
                transition: all 0.3s ease;
            }
            .countdown-number.flash {
                background: rgba(239, 68, 68, 0.3);
                color: #fca5a5;
            }
        </style>
        </head>
        <body>
        <div class="bg-pattern"></div>
        <div class="container">
            <div class="card">
                <div class="brand">WARRAQ TAHWEEL</div>

                <div class="check-wrapper">
                    <div class="check-circle">
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="4 12 10 18 20 6"/>
                        </svg>
                    </div>
                </div>

                <h1>تمت <span class="highlight">المُصادقة</span> بنجاح!</h1>
                <p>
                    لقد سجّلت دخولك إلى <strong>Tahweel</strong>،
                    محرّك التحويل الاحترافي للعربية في تطبيق <strong>ورّاق</strong>.
                    <br>
                    يمكنك الآن إغلاق هذه النافذة والعودة إلى التطبيق.
                </p>

                <div class="countdown-bar" id="countdown">
                    <span>يُغلق تلقائياً بعد</span>
                    <span class="countdown-number" id="timer">5</span>
                    <span>ثوانٍ</span>
                </div>
            </div>
        </div>
        <script>
            let seconds = 5;
            const timerEl = document.getElementById('timer');
            const countdownEl = document.getElementById('countdown');

            function updateTimer() {
                timerEl.textContent = seconds;
                if (seconds <= 2) {
                    timerEl.classList.add('flash');
                }
                if (seconds <= 0) {
                    window.close();
                    if (!window.closed) {
                        document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#94a3b8;font-family:sans-serif;font-size:18px;">يمكنك إغلاق هذه النافذة الآن.</div>';
                    }
                    return;
                }
                seconds--;
                setTimeout(updateTimer, 1000);
            }
            setTimeout(updateTimer, 1000);
        </script>
        </body>
        </html>
        """
        
        # Use a fixed port for redirect URI to make it easier for Tauri
        self.creds = flow.run_local_server(
            port=0, 
            authorization_prompt_message='يرجى التوجه إلى المتصفح لإتمام تسجيل الدخول...',
            success_message=success_msg
        )
        
        with open(TOKEN_PATH, 'wb') as token:
            pickle.dump(self.creds, token)
        
        return {"status": "success", "message": "Authenticated successfully"}

    def sign_out(self):
        if os.path.exists(TOKEN_PATH):
            os.remove(TOKEN_PATH)
        self.creds = None
        return {"status": "success"}

    def _docx_to_pdf_win32(self, docx_path):
        """Converts DOCX to PDF using Word COM interface on Windows."""
        try:
            import win32com.client
            import pythoncom
            
            # Initialize COM
            pythoncom.CoInitialize()
            
            word = win32com.client.Dispatch("Word.Application")
            word.Visible = False
            
            docx_path = str(Path(docx_path).absolute())
            pdf_path = docx_path.replace(".docx", ".pdf")
            
            print(f"[TAHWEEL] Converting {docx_path} to PDF...", flush=True)
            doc = word.Documents.Open(docx_path)
            # wdExportFormatPDF = 17
            doc.ExportAsFixedFormat(pdf_path, 17)
            doc.Close()
            word.Quit()
            
            return pdf_path
        except Exception as e:
            print(f"[TAHWEEL] Word PDF conversion failed: {e}", flush=True)
            return None
        finally:
            pythoncom.CoUninitialize()

    def get_word_index(self, pdf_path, task_id=None):
        """Perform OCR on each page and return word counts."""
        print(f"[TAHWEEL] Starting indexing for: {pdf_path}", flush=True)
        self._load_creds()
        if not self.creds or not self.creds.valid:
            raise Exception("User not authenticated with Google")

        input_path = Path(pdf_path)
        try:
            from tahweel.managers.file_managers_factory import FileManagersFactory
            from tahweel.processors.google_drive_base_ocr_processor import GoogleDriveBaseOcrProcessor
            from concurrent.futures import ThreadPoolExecutor

            # 1. Initialize file manager
            file_manager = FileManagersFactory.from_file_path(input_path, pdf2image_thread_count=8)
            
            # 2. Convert PDF to images
            file_manager.to_images()
            pages_count = file_manager.pages_count()

            # 3. OCR Processing
            processor = GoogleDriveBaseOcrProcessor(self.creds)
            index = []
            
            with ThreadPoolExecutor(max_workers=4) as executor:
                futures = [executor.submit(processor.process, img_path) for img_path in file_manager.images_paths]
                for i, future in enumerate(futures):
                    text = future.result()
                    # Basic word count
                    word_count = len(text.split())
                    index.append({
                        "page": i + 1,
                        "word_count": word_count
                    })
                    
                    if task_id:
                        progress = int(((i + 1) / pages_count) * 100)
                        task_service.update_task(task_id, progress=progress, 
                                               message=f"فهرسة {input_path.name}: صفحة {i+1}/{pages_count}")

            return index
            
        except Exception as e:
            print(f"[TAHWEEL] Indexing Error: {e}", flush=True)
            raise e
        finally:
            pass

    def convert(self, pdf_path, output_dir, remove_newlines=True, task_id=None, convert_to_pdf=True):
        print(f"[TAHWEEL] Starting conversion for: {pdf_path}", flush=True)
        self._load_creds()
        if not self.creds or not self.creds.valid:
            raise Exception("User not authenticated with Google")

        input_path = Path(pdf_path)
        output_dir = Path(output_dir) if output_dir else input_path.parent
        
        if not output_dir.exists():
            output_dir.mkdir(parents=True)

        try:
            from tahweel.managers.file_managers_factory import FileManagersFactory
            from tahweel.processors.google_drive_base_ocr_processor import GoogleDriveBaseOcrProcessor
            from tahweel.writers.docx_writer import DocxWriter
            from tahweel.writers.txt_writer import TxtWriter
            from tahweel.utils.string_utils import apply_transformations
            from tahweel.models import Transformation
            from tahweel.enums import TransformationType
            from concurrent.futures import ThreadPoolExecutor

            # Identify files to process
            files_to_process = []
            if input_path.is_dir():
                files_to_process = list(input_path.glob("*.pdf"))
                print(f"[TAHWEEL] Found {len(files_to_process)} PDFs in directory", flush=True)
            else:
                files_to_process = [input_path]

            total_files = len(files_to_process)
            results = []

            for file_idx, current_pdf in enumerate(files_to_process):
                file_msg = f" ({file_idx+1}/{total_files})" if total_files > 1 else ""
                print(f"[TAHWEEL] Processing file{file_msg}: {current_pdf.name}", flush=True)
                
                if task_id:
                    task_service.update_task(task_id, message=f"جاري معالجة الملف: {current_pdf.name} {file_msg}")

                # 1. Initialize file manager
                file_manager = FileManagersFactory.from_file_path(current_pdf, pdf2image_thread_count=8)
                
                # 2. Convert PDF to images
                file_manager.to_images()
                pages_count = file_manager.pages_count()

                # 3. OCR Processing
                processor = GoogleDriveBaseOcrProcessor(self.creds)
                content = []
                with ThreadPoolExecutor(max_workers=4) as executor:
                    futures = [executor.submit(processor.process, img_path) for img_path in file_manager.images_paths]
                    for i, future in enumerate(futures):
                        text = future.result()
                        content.append(text)
                        if task_id:
                            # Combined progress for all files
                            file_progress = ((i + 1) / pages_count) * (100 / total_files)
                            total_progress = int((file_idx * (100 / total_files)) + file_progress)
                            task_service.update_task(task_id, progress=total_progress, 
                                                   message=f"معالجة {current_pdf.name}: صفحة {i+1}/{pages_count}")

                # 4. Cleanup & Transformations
                transformations = [
                    Transformation(TransformationType.REPLACE, '\ufeff________________', ''),
                    Transformation(TransformationType.REPLACE, '\ufeff', ''),
                    Transformation(TransformationType.FUNCTION, str.strip),
                ]
                content = [apply_transformations(text, transformations) for text in content]

                # 5. Save Output
                docx_out = output_dir / current_pdf.with_suffix('.docx').name
                txt_out = output_dir / current_pdf.with_suffix('.txt').name
                
                DocxWriter(docx_out).write(content, remove_newlines)
                
                page_sep = "\nPAGE_SEPARATOR\n"
                with open(txt_out, 'w', encoding='utf-8') as f:
                    f.write(page_sep.join(content))

                # 6. Convert to PDF if requested
                pdf_out = None
                if convert_to_pdf:
                    if task_id:
                        task_service.update_task(task_id, message=f"جاري تحويل {current_pdf.name} إلى PDF...")
                    pdf_out = self._docx_to_pdf_win32(docx_out)

                results.append({
                    "filename": current_pdf.name,
                    "docx": str(docx_out),
                    "txt": str(txt_out),
                    "pdf": pdf_out
                })

            return {
                "status": "success",
                "processed_files": results,
                "total_files": total_files
            }
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"[TAHWEEL] Critical Error: {e}", flush=True)
            raise e
        finally:
            pass

tahweel_service = TahweelService()

