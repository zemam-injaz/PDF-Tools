from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import uvicorn
import os
from pdf_service import PDFService

app = FastAPI(title="PDF Tools API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for local tools
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PDFMergeRequest(BaseModel):
    paths: List[str]
    output_path: str

class PDFSplitRequest(BaseModel):
    input_path: str
    split_pages: List[int]
    output_dir: str

class PDFCompressRequest(BaseModel):
    input_path: str
    output_path: str
    compression_level: int = 2

class PDFExtractRequest(BaseModel):
    input_path: str
    output_dir: str

@app.get("/")
def read_root():
    return {"status": "PDF Tools API Running"}

@app.post("/api/merge")
def merge_pdfs(request: PDFMergeRequest):
    try:
        PDFService.merge_pdfs(request.paths, request.output_path)
        return {"status": "success", "message": "Merged successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/split")
def split_pdf(request: PDFSplitRequest):
    try:
        files = PDFService.split_pdf(request.input_path, request.split_pages, request.output_dir)
        return {"status": "success", "files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/compress")
def compress_pdf(request: PDFCompressRequest):
    try:
        PDFService.compress_pdf(request.input_path, request.output_path, request.compression_level)
        return {"status": "success", "message": "Compressed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/extract-images")
def extract_images(request: PDFExtractRequest):
    try:
        files = PDFService.extract_images(request.input_path, request.output_dir)
        return {"status": "success", "files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/info")
def get_info(path: str):
    try:
        return PDFService.get_pdf_info(path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8002)
