from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.tahweel_service import tahweel_service
import os
from services.task_service import task_service

router = APIRouter(prefix="/api/tahweel", tags=["Tahweel"])

class ConvertRequest(BaseModel):
    pdf_path: str
    output_dir: str
    remove_newlines: bool = True
    is_async: bool = False
    convert_to_pdf: bool = True

@router.get("/auth/status")
def get_auth_status():
    return tahweel_service.get_auth_status()

@router.post("/auth/signin")
def sign_in():
    try:
        return tahweel_service.authenticate()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/auth/signout")
def sign_out():
    return tahweel_service.sign_out()

@router.post("/convert")
def convert_pdf(request: ConvertRequest):
    print(f"[API] Received Tahweel convert request for: {request.pdf_path}", flush=True)
    try:
        # Check if file exists
        if not os.path.exists(request.pdf_path):
            print(f"[API] Error: PDF file not found at {request.pdf_path}", flush=True)
            raise HTTPException(status_code=404, detail="PDF file not found")
            
        if request.is_async:
            task_id = task_service.create_task("tahweel_ocr")
            print(f"[API] Starting async task: {task_id}", flush=True)
            task_service.run_background_task(
                task_id, 
                tahweel_service.convert, 
                request.pdf_path, 
                request.output_dir, 
                request.remove_newlines,
                convert_to_pdf=request.convert_to_pdf
            )
            return {"status": "success", "task_id": task_id}
        else:
            print(f"[API] Running synchronous conversion...", flush=True)
            result = tahweel_service.convert(
                request.pdf_path, 
                request.output_dir, 
                request.remove_newlines,
                convert_to_pdf=request.convert_to_pdf
            )
            print(f"[API] Synchronous conversion finished", flush=True)
            return result
    except Exception as e:
        print(f"[API] Error in convert_pdf: {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))

class IndexRequest(BaseModel):
    pdf_path: str
    use_ocr: bool = False
    is_async: bool = False

@router.post("/index")
def index_pdf(request: IndexRequest):
    print(f"[API] Received Index request for: {request.pdf_path} (OCR: {request.use_ocr})", flush=True)
    try:
        if not os.path.exists(request.pdf_path):
            raise HTTPException(status_code=404, detail="PDF file not found")
            
        if request.is_async:
            task_id = task_service.create_task("index_book")
            
            def run_index():
                if request.use_ocr:
                    return tahweel_service.get_word_index(request.pdf_path, task_id)
                else:
                    from services.text_service import TextService
                    return TextService.get_word_index(request.pdf_path)

            task_service.run_background_task(task_id, run_index)
            return {"status": "success", "task_id": task_id}
        else:
            if request.use_ocr:
                result = tahweel_service.get_word_index(request.pdf_path)
            else:
                from services.text_service import TextService
                result = TextService.get_word_index(request.pdf_path)
            return {"status": "success", "data": result}
    except Exception as e:
        print(f"[API] Error in index_pdf: {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))
