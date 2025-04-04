import threading
import queue
import time
import logging
from datetime import datetime
from flask import current_app
from .matlab_service import MatlabService
import traceback
from enum import Enum

logger = logging.getLogger(__name__)

class TaskPriority(Enum):
    HIGH = 1
    NORMAL = 2
    LOW = 3

class TaskStatus(Enum):
    PENDING = 'pending'
    PROCESSING = 'processing'
    COMPLETED = 'completed'
    FAILED = 'failed'

class ProcessingTask:
    def __init__(self, task_id, file_path, output_dir, priority=TaskPriority.NORMAL):
        self.task_id = task_id
        self.file_path = file_path
        self.output_dir = output_dir
        self.priority = priority
        self.status = TaskStatus.PENDING
        self.progress = 0
        self.start_time = None
        self.end_time = None
        self.error = None
        self.results = None
        self.retries = 0
        self.max_retries = 3

    def __lt__(self, other):
        return self.priority.value < other.priority.value

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
        self.task_queue = queue.PriorityQueue()
        self.tasks = {}
        self.processing_count = 0
        self.max_concurrent = app.config.get('MAX_CONCURRENT_PROCESSES', 1)
        self.matlab_service = MatlabService(app)
        self.worker_threads = []
        self.should_stop = False
        
        # 启动工作线程
        for _ in range(self.max_concurrent):
            thread = threading.Thread(target=self._process_queue, daemon=True)
            thread.start()
            self.worker_threads.append(thread)
            
        self.initialized = True
        logger.info(f"任务队列管理器已初始化，工作线程数：{self.max_concurrent}")

    def add_task(self, task_id, priority=TaskPriority.NORMAL):
        """添加新的处理任务"""
        if task_id not in self.tasks:
            task = ProcessingTask(task_id, priority=priority)
            self.tasks[task_id] = task
            self.task_queue.put((priority.value, task))
            logger.info(f"添加新任务: {task_id}, 优先级: {priority.name}")
        return task_id

    def update_progress(self, task_id, progress, status_message=None):
        """更新任务进度"""
        if task_id in self.tasks:
            task = self.tasks[task_id]
            task.progress = progress
            if status_message:
                task.status_message = status_message
            logger.debug(f"更新任务进度 - 任务ID: {task_id}, 进度: {progress}%, 状态: {status_message or '无'}")

    def get_task_status(self, task_id):
        """获取任务状态"""
        if task_id in self.tasks:
            task = self.tasks[task_id]
            return {
                'status': task.status.value,
                'progress': task.progress,
                'error': task.error,
                'results': task.results,
                'start_time': task.start_time.isoformat() if task.start_time else None,
                'end_time': task.end_time.isoformat() if task.end_time else None
            }
        return None

    def _process_queue(self):
        """处理队列中的任务"""
        while not self.should_stop:
            try:
                if self.processing_count < self.max_concurrent:
                    _, task = self.task_queue.get(timeout=1)
                    self._process_task(task)
                else:
                    time.sleep(1)
            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"队列处理错误: {str(e)}")
                logger.error(f"错误堆栈:\n{traceback.format_exc()}")

    def _process_task(self, task):
        """处理单个任务"""
        try:
            self.processing_count += 1
            task.status = TaskStatus.PROCESSING
            task.start_time = datetime.now()
            logger.info(f"开始处理任务 {task.task_id} (当前处理数: {self.processing_count})")

            # 更新进度：开始转换DICOM
            self.update_progress(task.task_id, 10, "正在转换DICOM文件")
            nifti_file = self.matlab_service.convert_dicom_to_nifti(
                task.file_path, 
                task.output_dir
            )

            # 更新进度：开始CAT12处理
            self.update_progress(task.task_id, 30, "正在进行CAT12处理")
            cat12_output = self.matlab_service.process_with_cat12(
                nifti_file, 
                task.output_dir
            )

            # 更新进度：提取结果
            self.update_progress(task.task_id, 80, "正在提取处理结果")
            task.results = self.matlab_service.extract_results(cat12_output)

            # 完成处理
            task.status = TaskStatus.COMPLETED
            task.progress = 100
            task.end_time = datetime.now()
            logger.info(f"任务 {task.task_id} 完成 - 处理时间: {task.end_time - task.start_time}")

        except Exception as e:
            task.retries += 1
            if task.retries < task.max_retries:
                logger.warning(f"任务 {task.task_id} 失败，准备重试 ({task.retries}/{task.max_retries})")
                self.task_queue.put((task.priority.value, task))
            else:
                task.status = TaskStatus.FAILED
                task.error = str(e)
                task.end_time = datetime.now()
                logger.error(f"任务 {task.task_id} 最终失败: {str(e)}")
                logger.error(f"错误堆栈:\n{traceback.format_exc()}")

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
                    'status': task.status.value,
                    'progress': task.progress,
                    'priority': task.priority.name,
                    'start_time': task.start_time.isoformat() if task.start_time else None,
                    'retries': task.retries
                } for task_id, task in self.tasks.items()
            }
        }

    def shutdown(self):
        """关闭队列管理器"""
        self.should_stop = True
        for thread in self.worker_threads:
            thread.join(timeout=5)
        logger.info("任务队列管理器已关闭") 