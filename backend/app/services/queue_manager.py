import threading
import queue
import time
import logging
from datetime import datetime
from flask import current_app
from .matlab_service import MatlabService
import traceback

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
        self.max_concurrent = app.config.get('MAX_CONCURRENT_PROCESSES', 1)
        self.matlab_service = MatlabService(app)
        self.worker_thread = threading.Thread(target=self._process_queue, daemon=True)
        self.worker_thread.start()
        self.initialized = True
        logger.info("任务队列管理器已初始化")

    def add_task(self, task_id):
        """添加新的处理任务"""
        if task_id not in self.tasks:
            self.tasks[task_id] = {
                'status': 'processing',
                'progress': 0,
                'results': None,
                'error': None
            }
            logger.info(f"添加新任务: {task_id}")
        return task_id

    def update_progress(self, task_id, progress):
        """更新任务进度"""
        if task_id in self.tasks:
            self.tasks[task_id]['progress'] = progress
            logger.debug(f"更新任务进度 - 任务ID: {task_id}, 进度: {progress}%")

    def get_progress(self, task_id):
        """获取任务进度"""
        if task_id in self.tasks:
            return self.tasks[task_id]['progress']
        return 0

    def complete_task(self, task_id, results=None):
        """完成任务"""
        if task_id in self.tasks:
            self.tasks[task_id].update({
                'status': 'completed',
                'progress': 100,
                'results': results
            })
            logger.info(f"任务完成 - 任务ID: {task_id}")
            logger.debug(f"任务结果: {results}")

    def fail_task(self, task_id, error=None):
        """标记任务失败"""
        if task_id in self.tasks:
            self.tasks[task_id].update({
                'status': 'failed',
                'error': str(error) if error else None
            })
            logger.error(f"任务失败 - 任务ID: {task_id}, 错误: {error}")

    def get_task_status(self, task_id):
        """获取任务状态"""
        if task_id in self.tasks:
            status = self.tasks[task_id]
            logger.debug(f"获取任务状态 - 任务ID: {task_id}, 状态: {status}")
            return status
        logger.warning(f"任务不存在 - 任务ID: {task_id}")
        return None

    def _process_queue(self):
        """处理队列中的任务"""
        logger.info("任务处理线程已启动")
        while True:
            try:
                if self.processing_count < self.max_concurrent:
                    task = self.task_queue.get(timeout=1)
                    logger.info(f"开始处理任务: {task['task_id']}")
                    self._process_task(task)
                else:
                    logger.debug(f"当前处理任务数已达上限 ({self.processing_count}/{self.max_concurrent})")
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
            logger.info(f"开始处理任务 {task['task_id']} (当前处理数: {self.processing_count})")
            
            task['status'] = 'processing'
            task['start_time'] = datetime.now()
            logger.info(f"任务 {task['task_id']} 开始时间: {task['start_time']}")
            
            # 更新进度：开始转换DICOM
            task['progress'] = 10
            logger.info(f"任务 {task['task_id']} - 开始转换DICOM")
            nifti_file = self.matlab_service.convert_dicom_to_nifti(task['file_path'], task['output_dir'])
            
            # 更新进度：开始CAT12处理
            task['progress'] = 30
            logger.info(f"任务 {task['task_id']} - 开始CAT12处理")
            cat12_output = self.matlab_service.process_with_cat12(nifti_file, task['output_dir'])
            
            # 更新进度：提取结果
            task['progress'] = 80
            logger.info(f"任务 {task['task_id']} - 提取处理结果")
            task['results'] = self.matlab_service.extract_results(cat12_output)
            
            # 完成
            task['progress'] = 100
            task['status'] = 'completed'
            task['end_time'] = datetime.now()
            logger.info(f"任务 {task['task_id']} 完成 - 处理时间: {task['end_time'] - task['start_time']}")
            logger.debug(f"任务 {task['task_id']} 结果: {task['results']}")
            
        except Exception as e:
            task['status'] = 'failed'
            task['error'] = str(e)
            task['end_time'] = datetime.now()
            logger.error(f"任务 {task['task_id']} 失败: {str(e)}")
            logger.error(f"错误堆栈:\n{traceback.format_exc()}")
            
        finally:
            self.processing_count -= 1
            logger.info(f"任务 {task['task_id']} 处理结束 (当前处理数: {self.processing_count})")
            self.task_queue.task_done()

    def get_queue_status(self):
        """获取队列状态"""
        status = {
            'queue_size': self.task_queue.qsize(),
            'processing_count': self.processing_count,
            'max_concurrent': self.max_concurrent,
            'tasks': self.tasks
        }
        logger.debug(f"队列状态: {status}")
        return status 