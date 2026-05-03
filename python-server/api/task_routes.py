from fastapi import APIRouter, HTTPException
from services.task_service import task_service

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])

@router.get("/")
def list_tasks():
    """List all recent background tasks"""
    return {"status": "success", "data": task_service.list_tasks()}

@router.get("/{task_id}")
def get_task_status(task_id: str):
    """Get the status and result of a specific task"""
    task = task_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"status": "success", "data": task}
