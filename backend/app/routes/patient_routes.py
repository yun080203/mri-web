from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Patient
import logging
import os
from flask import current_app

logger = logging.getLogger(__name__)
patient_bp = Blueprint('patient', __name__)

@patient_bp.route('/patients', methods=['GET', 'POST'])
@jwt_required()
def patients():
    try:
        current_user_id = get_jwt_identity()
        logger.info(f"处理患者请求，用户ID: {current_user_id}")
        
        if not current_user_id:
            logger.error("未找到用户ID")
            return jsonify({'error': '未授权访问'}), 401
        
        if request.method == 'POST':
            try:
                data = request.get_json()
                logger.debug(f"接收到的POST数据: {data}")
                
                # 验证必需字段
                required_fields = ['name', 'patient_id', 'age', 'gender']
                for field in required_fields:
                    if field not in data:
                        logger.warning(f"缺少必需字段: {field}")
                        return jsonify({'error': f'缺少必需字段：{field}'}), 400
                
                # 检查患者ID是否已存在
                existing_patient = Patient.query.filter_by(patient_id=data['patient_id']).first()
                if existing_patient:
                    logger.warning(f"患者ID已存在: {data['patient_id']}")
                    return jsonify({'error': '患者ID已存在'}), 400
                
                # 创建新患者
                new_patient = Patient(
                    name=data['name'],
                    patient_id=data['patient_id'],
                    age=data['age'],
                    gender=data['gender'],
                    user_id=current_user_id
                )
                
                db.session.add(new_patient)
                db.session.commit()
                logger.info(f"成功创建新患者: {new_patient.id}")
                
                return jsonify({
                    'success': True,
                    'patient': new_patient.to_dict()
                })
                
            except Exception as e:
                logger.error(f"创建患者失败: {str(e)}")
                db.session.rollback()
                return jsonify({'error': '创建患者失败'}), 500
        
        # GET 请求处理
        try:
            logger.debug(f"获取用户 {current_user_id} 的患者列表")
            patients = Patient.query.filter_by(user_id=current_user_id).all()
            logger.info(f"成功获取患者列表，数量: {len(patients)}")
            
            return jsonify({
                'success': True,
                'patients': [patient.to_dict() for patient in patients]
            })
        except Exception as e:
            logger.error(f"获取患者列表失败: {str(e)}")
            return jsonify({'error': '获取患者列表失败'}), 500
            
    except Exception as e:
        logger.error(f"处理患者请求时发生错误: {str(e)}")
        return jsonify({'error': '服务器内部错误'}), 500

@patient_bp.route('/patients/<int:patient_id>', methods=['GET', 'PUT', 'DELETE'])
@jwt_required()
def patient_detail(patient_id):
    try:
        current_user_id = get_jwt_identity()
        logger.info(f"处理患者请求，患者ID: {patient_id}，用户ID: {current_user_id}")
        
        if not current_user_id:
            logger.error("未找到用户ID")
            return jsonify({'error': '未授权访问'}), 401
        
        patient = Patient.query.filter_by(id=patient_id, user_id=current_user_id).first()
        if not patient:
            logger.warning(f"未找到患者: {patient_id}")
            return jsonify({'error': '未找到患者'}), 404
            
        if request.method == 'GET':
            try:
                patient_dict = patient.to_dict()
                logger.info(f"成功获取患者详情: {patient_id}")
                return jsonify({
                    'success': True,
                    'patient': patient_dict
                })
            except Exception as e:
                logger.error(f"序列化患者数据失败: {str(e)}")
                return jsonify({'error': '序列化患者数据失败'}), 500
                
        elif request.method == 'PUT':
            try:
                data = request.get_json()
                if not data:
                    return jsonify({'error': '请求数据为空'}), 400
                    
                # 验证必填字段
                required_fields = ['name', 'patient_id', 'age', 'gender']
                for field in required_fields:
                    if field not in data:
                        return jsonify({'error': f'缺少必填字段：{field}'}), 400
                        
                # 检查患者ID是否已被其他患者使用
                existing_patient = Patient.query.filter(
                    Patient.patient_id == data['patient_id'],
                    Patient.id != patient_id
                ).first()
                if existing_patient:
                    return jsonify({'error': '患者ID已存在'}), 400
                    
                # 更新患者信息
                patient.name = data['name']
                patient.patient_id = data['patient_id']
                patient.age = data['age']
                patient.gender = data['gender']
                
                db.session.commit()
                logger.info(f"成功更新患者信息: {patient_id}")
                
                return jsonify({
                    'success': True,
                    'patient': patient.to_dict()
                })
                
            except Exception as e:
                logger.error(f"更新患者信息失败: {str(e)}")
                db.session.rollback()
                return jsonify({'error': '更新患者信息失败'}), 500
                
        elif request.method == 'DELETE':
            try:
                # 删除患者的所有图像记录
                for image in patient.images:
                    # 删除物理文件
                    if image.filename:
                        file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], image.filename)
                        if os.path.exists(file_path):
                            os.remove(file_path)
                    if image.processed_filename:
                        processed_path = os.path.join(current_app.config['PROCESSED_FOLDER'], image.processed_filename)
                        if os.path.exists(processed_path):
                            os.remove(processed_path)
                    db.session.delete(image)
                    
                # 删除患者记录
                db.session.delete(patient)
                db.session.commit()
                
                logger.info(f"成功删除患者: {patient_id}")
                return jsonify({
                    'success': True,
                    'message': '患者删除成功'
                })
                
            except Exception as e:
                logger.error(f"删除患者失败: {str(e)}")
                db.session.rollback()
                return jsonify({'error': '删除患者失败'}), 500
                
    except Exception as e:
        logger.error(f"处理患者请求时发生错误: {str(e)}")
        return jsonify({'error': '服务器内部错误'}), 500 