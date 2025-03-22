from flask import Blueprint, request, jsonify
from ..services.image_service import ImageService
from ..utils.file_utils import allowed_file
import logging
import traceback
from datetime import datetime

logger = logging.getLogger(__name__)
api = Blueprint('api', __name__)

@api.route('/process', methods=['POST'])
def process_image():
    """处理上传的图像文件"""
    try:
        logger.info("=== 开始处理新的上传请求 ===")
        logger.debug(f"请求头: {dict(request.headers)}")
        logger.debug(f"表单数据: {request.form}")
        logger.debug(f"文件: {request.files}")
        
        if 'file' not in request.files:
            logger.warning("未找到文件")
            return jsonify({'error': '未找到文件'}), 400
            
        file = request.files['file']
        logger.debug(f"文件名: {file.filename}")
        logger.debug(f"文件内容类型: {file.content_type}")
        
        if file.filename == '':
            logger.warning("未选择文件")
            return jsonify({'error': '未选择文件'}), 400
            
        if not allowed_file(file.filename):
            logger.warning(f"不支持的文件类型: {file.filename}")
            return jsonify({'error': '不支持的文件类型'}), 400
            
        # 获取患者信息
        patient_name = request.form.get('patient_name', '未知患者')
        patient_id = request.form.get('patient_id', f'patient-{datetime.now().strftime("%Y%m%d%H%M%S")}')
        
        # 处理文件上传
        result = ImageService.process_upload(file, patient_name, patient_id)
        
        logger.info("=== 处理完成 ===")
        return jsonify(result)
            
    except Exception as e:
        logger.error(f"处理请求时发生错误: {str(e)}")
        logger.error(f"错误详情: {traceback.format_exc()}")
        logger.error("=== 处理失败 ===")
        return jsonify({'error': str(e)}), 500

@api.route('/tasks/<task_id>')
def get_task(task_id):
    """获取任务状态"""
    try:
        result = ImageService.get_task_status(task_id)
        return jsonify(result)
    except Exception as e:
        logger.error(f"查询任务状态时发生错误: {str(e)}")
        logger.error(f"错误详情: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

@api.route('/')
def index():
    """API 根路径"""
    return jsonify({
        'name': 'MRI图像处理系统API',
        'version': '1.0.0',
        'endpoints': {
            'upload': '/api/process',
            'task_status': '/api/tasks/<task_id>',
            'health': '/health'
        }
    })

@api.route('/health')
def health_check():
    """健康检查"""
    return jsonify({'status': 'healthy'}) 