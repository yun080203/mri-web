from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
import os
from ..services.matlab_service import MatlabService
from ..services.queue_manager import QueueManager
from ..utils.file_utils import ensure_upload_dir
import logging

logger = logging.getLogger(__name__)
cat12_bp = Blueprint('cat12', __name__)

def get_matlab_service():
    if not hasattr(current_app, 'matlab_service'):
        current_app.matlab_service = MatlabService(current_app)
    return current_app.matlab_service

def get_queue_manager():
    if not hasattr(current_app, 'queue_manager'):
        current_app.queue_manager = QueueManager(current_app)
    return current_app.queue_manager

@cat12_bp.route('/process', methods=['POST'])
def process_dicom():
    """处理上传的DICOM文件"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': '没有上传文件'}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '没有选择文件'}), 400
            
        # 确保文件名安全
        filename = secure_filename(file.filename)
        
        # 创建上传目录
        upload_dir = ensure_upload_dir()
        file_path = os.path.join(upload_dir, filename)
        
        # 保存上传的文件
        file.save(file_path)
        logger.info(f"文件已保存: {file_path}")
        
        # 创建输出目录
        output_dir = os.path.join(upload_dir, 'cat12_output')
        os.makedirs(output_dir, exist_ok=True)
        
        # 添加任务到队列
        queue_manager = get_queue_manager()
        task_id = queue_manager.add_task(file_path, output_dir)
        
        return jsonify({
            'message': '任务已添加到队列',
            'task_id': task_id
        })
        
    except Exception as e:
        logger.error(f"处理失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@cat12_bp.route('/status/<task_id>', methods=['GET'])
def get_task_status(task_id):
    """获取特定任务的状态"""
    try:
        queue_manager = get_queue_manager()
        status = queue_manager.get_task_status(task_id)
        if status:
            return jsonify(status)
        return jsonify({'error': '任务不存在'}), 404
    except Exception as e:
        logger.error(f"获取状态失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@cat12_bp.route('/status', methods=['GET'])
def get_queue_status():
    """获取队列状态"""
    try:
        queue_manager = get_queue_manager()
        status = queue_manager.get_queue_status()
        return jsonify(status)
    except Exception as e:
        logger.error(f"获取队列状态失败: {str(e)}")
        return jsonify({'error': str(e)}), 500 