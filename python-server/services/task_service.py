import uuid
import threading
from datetime import datetime
from typing import Dict, Any, Optional, Callable
from enum import Enum

class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"

class TaskInfo:
    def __init__(self, task_id: str, task_type: str):
        self.task_id = task_id
        self.task_type = task_type
        self.status = TaskStatus.PENDING
        self.progress = 0
        self.message = "Initializing..."
        self.result = None
        self.error = None
        self.created_at = datetime.now()
        self.updated_at = datetime.now()

    def to_dict(self):
        return {
            "task_id": self.task_id,
            "task_type": self.task_type,
            "status": self.status.value,
            "progress": self.progress,
            "message": self.message,
            "result": self.result,
            "error": self.error,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }

class TaskService:
    def __init__(self):
        self.tasks: Dict[str, TaskInfo] = {}
        self.lock = threading.Lock()

    def create_task(self, task_type: str) -> str:
        task_id = str(uuid.uuid4())
        with self.lock:
            self.tasks[task_id] = TaskInfo(task_id, task_type)
        return task_id

    def update_task(self, task_id: str, status: Optional[TaskStatus] = None, 
                    progress: Optional[int] = None, message: Optional[str] = None,
                    result: Any = None, error: Any = None):
        with self.lock:
            if task_id in self.tasks:
                task = self.tasks[task_id]
                if status: task.status = status
                if progress is not None: task.progress = progress
                if message: task.message = message
                if result is not None: task.result = result
                if error: task.error = error
                task.updated_at = datetime.now()

    def get_task(self, task_id: str) -> Optional[dict]:
        with self.lock:
            task = self.tasks.get(task_id)
            return task.to_dict() if task else None

    def list_tasks(self) -> list:
        with self.lock:
            # Return last 50 tasks
            sorted_tasks = sorted(self.tasks.values(), key=lambda x: x.created_at, reverse=True)
            return [t.to_dict() for t in sorted_tasks[:50]]

    def run_background_task(self, task_id: str, func: Callable, *args, **kwargs):
        """Runs a function in a background thread and updates the task status."""
        def wrapper():
            try:
                print(f"[TASK START] {task_id} ({func.__name__})", flush=True)
                self.update_task(task_id, status=TaskStatus.RUNNING, message="In progress...")
                
                # Pass task_id to func if it expects it (for progress updates)
                import inspect
                sig = inspect.signature(func)
                if 'task_id' in sig.parameters:
                    kwargs['task_id'] = task_id
                
                result = func(*args, **kwargs)
                
                print(f"[TASK COMPLETE] {task_id}", flush=True)
                self.update_task(task_id, status=TaskStatus.COMPLETED, progress=100, 
                                message="Completed successfully", result=result)
            except Exception as e:
                import traceback
                print(f"[TASK ERROR] {task_id}: {e}", flush=True)
                traceback.print_exc()
                self.update_task(task_id, status=TaskStatus.FAILED, message=str(e), error=str(e))

        thread = threading.Thread(target=wrapper)
        thread.daemon = True
        thread.start()

task_service = TaskService()
