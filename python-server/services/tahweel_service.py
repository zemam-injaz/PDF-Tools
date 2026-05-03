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
            with open(TOKEN_PATH, 'rb') as token:
                self.creds = pickle.load(token)
        
        if self.creds and self.creds.expired and self.creds.refresh_token:
            self.creds.refresh(Request())
            with open(TOKEN_PATH, 'wb') as token:
                pickle.dump(self.creds, token)

    def authenticate(self):
        """Starts the OAuth2 flow"""
        if not os.path.exists(CLIENT_SECRETS_PATH):
            raise FileNotFoundError(f"client_secrets.json not found at {CLIENT_SECRETS_PATH}. Please follow the instructions to create it.")

        flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRETS_PATH, SCOPES)
        
        # Enhanced success message for Arabic users
        success_msg = """
        <div style="direction: rtl; text-align: center; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 50px; background-color: #f8fafc; color: #1e293b; height: 100vh;">
            <div style="background: white; padding: 40px; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); display: inline-block; max-width: 500px;">
                <div style="color: #059669; font-size: 64px; margin-bottom: 20px;">✓</div>
                <h1 style="color: #1e3a8a; margin-bottom: 15px;">تمت المُصادقة بنجاح!</h1>
                <p style="font-size: 18px; line-height: 1.6; color: #475569;">
                    لقد قمت بتسجيل الدخول بنجاح إلى ميزة <strong>Tahweel</strong>.
                    <br>
                    يمكنك الآن إغلاق هذه النافذة والعودة إلى البرنامج لمتابعة العمل.
                </p>
                <div style="margin-top: 30px; padding: 15px; background: #eff6ff; border-radius: 10px; color: #1d4ed8; font-size: 14px;">
                    سيتم إغلاق هذا الخادم المؤقت تلقائياً.
                </div>
            </div>
        </div>
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

