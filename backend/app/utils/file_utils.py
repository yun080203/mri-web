import os
from werkzeug.utils import secure_filename
from flask import current_app
import logging

logger = logging.getLogger(__name__)

def allowed_file(filename):
    """检查文件类型是否允许上传"""
    logger.debug(f"检查文件类型: {filename}")
    logger.debug(f"允许的文件类型: {current_app.config['ALLOWED_EXTENSIONS']}")
    
    if '.' not in filename:
        logger.warning(f"文件名中没有扩展名: {filename}")
        return False
        
    ext = filename.rsplit('.', 1)[1].lower()
    logger.debug(f"文件扩展名: {ext}")
    
    allowed = ext in current_app.config['ALLOWED_EXTENSIONS']
    logger.debug(f"是否允许上传: {allowed}")
    return allowed

def save_uploaded_file(file, folder):
    """保存上传的文件"""
    try:
        filename = secure_filename(file.filename)
        filepath = os.path.join(folder, filename)
        
        logger.debug(f"保存文件到: {filepath}")
        file.save(filepath)
        
        if not os.path.exists(filepath):
            raise Exception("文件保存失败")
            
        logger.info(f"文件保存成功: {filename}")
        logger.debug(f"文件大小: {os.path.getsize(filepath)} 字节")
        
        return filename, filepath
        
    except Exception as e:
        logger.error(f"保存文件失败: {str(e)}")
        raise

def ensure_directory_exists(directory):
    """确保目录存在，如果不存在则创建"""
    try:
        os.makedirs(directory, exist_ok=True)
        logger.debug(f"目录已创建或已存在: {directory}")
        return True
    except Exception as e:
        logger.error(f"创建目录失败: {str(e)}")
        return False

def ensure_upload_dir():
    """确保上传目录存在"""
    upload_dir = current_app.config['UPLOAD_FOLDER']
    os.makedirs(upload_dir, exist_ok=True)
    return upload_dir 