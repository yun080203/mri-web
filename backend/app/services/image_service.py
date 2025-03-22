import os
from datetime import datetime
from ..models.models import db, Patient, Image
from ..utils.file_utils import save_uploaded_file, ensure_directory_exists
from flask import current_app
import logging

logger = logging.getLogger(__name__)

class ImageService:
    @staticmethod
    def process_upload(file, patient_name, patient_id):
        """处理上传的图像文件"""
        try:
            logger.info(f"开始处理患者 {patient_name} (ID: {patient_id}) 的文件: {file.filename}")
            
            # 确保上传目录存在
            ensure_directory_exists(current_app.config['UPLOAD_FOLDER'])
            
            # 保存文件
            filename, filepath = save_uploaded_file(file, current_app.config['UPLOAD_FOLDER'])
            
            # 创建或获取患者记录
            patient = Patient.query.filter_by(patient_id=patient_id).first()
            if not patient:
                patient = Patient(name=patient_name, patient_id=patient_id)
                db.session.add(patient)
                db.session.commit()
            
            # 创建图像记录
            image = Image(
                filename=filename,
                original_filename=file.filename,
                patient_id=patient.id,
                check_date=datetime.now()
            )
            db.session.add(image)
            db.session.commit()
            
            # 生成任务ID
            task_id = f"task-{datetime.now().strftime('%Y%m%d%H%M%S')}"
            
            return {
                'task_id': task_id,
                'status': 'processing',
                'message': '文件上传成功，正在处理',
                'file_info': {
                    'filename': filename,
                    'filepath': filepath,
                    'patient_name': patient_name,
                    'patient_id': patient_id
                }
            }
            
        except Exception as e:
            logger.error(f"处理上传文件时发生错误: {str(e)}")
            raise

    @staticmethod
    def get_task_status(task_id):
        """获取任务状态"""
        try:
            logger.debug(f"查询任务状态: {task_id}")
            
            # 这里可以添加实际的任务状态查询逻辑
            # 目前返回模拟数据
            return {
                'status': 'completed',
                'results': {
                    'task_id': task_id,
                    'message': '处理完成'
                }
            }
            
        except Exception as e:
            logger.error(f"查询任务状态时发生错误: {str(e)}")
            raise 