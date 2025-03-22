import threading
import queue
import time
import logging
from datetime import datetime
from flask import current_app
from .matlab_service import MatlabService

logger = logging.getLogger(__name__)

class ProcessingTask:
    def __init__(self, task_id, file_path, output_dir):
        self.task_id = task_id
        self.file_path = file_path
        self.output_dir = output_dir
        self.status = 'pending'
        self.progress = 0
        self.start_time = None
        self.end_time = None
        self.error = None
        self.results = None

class QueueManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(QueueManager, cls).__new__(cls)
            return cls._instance

    def __init__(self, app=None):
        if not hasattr(self, 'initialized'):
            self.app = app
            if app is not None:
                self.init_app(app)

    def init_app(self, app):
        self.app = app
        self.task_queue = queue.Queue()
        self.tasks = {}
        self.processing_count = 0
        self.max_concurrent = app.config['MAX_CONCURRENT_PROCESSES']
        self.matlab_service = MatlabService(app)
        self.worker_thread = threading.Thread(target=self._process_queue, daemon=True)
        self.worker_thread.start()
        self.initialized = True

    def add_task(self, file_path, output_dir):
        """添加新的处理任务"""
        task_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        task = ProcessingTask(task_id, file_path, output_dir)
        self.tasks[task_id] = task
        self.task_queue.put(task)
        logger.info(f"添加新任务: {task_id}")
        return task_id

    def get_task_status(self, task_id):
        """获取任务状态"""
        task = self.tasks.get(task_id)
        if task:
            return {
                'status': task.status,
                'progress': task.progress,
                'start_time': task.start_time,
                'end_time': task.end_time,
                'error': task.error,
                'results': task.results
            }
        return None

    def _process_queue(self):
        """处理队列中的任务"""
        while True:
            try:
                if self.processing_count < self.max_concurrent:
                    task = self.task_queue.get(timeout=1)
                    self._process_task(task)
                else:
                    time.sleep(1)
            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"队列处理错误: {str(e)}")

    def _process_task(self, task):
        """处理单个任务"""
        try:
            self.processing_count += 1
            task.status = 'processing'
            task.start_time = datetime.now()
            
            # 更新进度：开始转换DICOM
            task.progress = 10
            nifti_file = self.matlab_service.convert_dicom_to_nifti(task.file_path, task.output_dir)
            
            # 更新进度：开始CAT12处理
            task.progress = 30
            cat12_output = self.matlab_service.process_with_cat12(nifti_file, task.output_dir)
            
            # 更新进度：提取结果
            task.progress = 80
            task.results = self.matlab_service.extract_results(cat12_output)
            
            # 完成
            task.progress = 100
            task.status = 'completed'
            task.end_time = datetime.now()
            logger.info(f"任务完成: {task.task_id}")
            
        except Exception as e:
            task.status = 'failed'
            task.error = str(e)
            task.end_time = datetime.now()
            logger.error(f"任务失败: {task.task_id}, 错误: {str(e)}")
            
        finally:
            self.processing_count -= 1
            self.task_queue.task_done()

    def get_queue_status(self):
        """获取队列状态"""
        return {
            'queue_size': self.task_queue.qsize(),
            'processing_count': self.processing_count,
            'max_concurrent': self.max_concurrent,
            'tasks': {
                task_id: {
                    'status': task.status,
                    'progress': task.progress,
                    'start_time': task.start_time,
                    'end_time': task.end_time,
                    'error': task.error,
                    'results': task.results
                }
                for task_id, task in self.tasks.items()
            }
        } 