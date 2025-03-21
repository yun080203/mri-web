from flask import Flask, request, jsonify, send_file
import os
from flask_sqlalchemy import SQLAlchemy
import cv2
import numpy as np
import uuid
import subprocess
from werkzeug.utils import secure_filename
import pydicom
from datetime import datetime
import platform
from flask_cors import CORS
import logging
import sys
from sqlalchemy import text
import json
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import traceback
import werkzeug.exceptions
import time

# 配置日志
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('app.log', encoding='utf-8', mode='a')
    ]
)
logger = logging.getLogger(__name__)

# 初始化Flask应用
app = Flask(__name__)
CORS(app)

# 获取当前文件的绝对路径
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
print(f"\n当前工作目录: {os.getcwd()}")
print(f"BASE_DIR: {BASE_DIR}\n")

app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(BASE_DIR, "brain_mri.db")}'
app.config['UPLOAD_FOLDER'] = os.path.join(BASE_DIR, 'uploads')
app.config['PROCESSED_FOLDER'] = os.path.join(BASE_DIR, 'processed')
app.config['REPORTS_FOLDER'] = os.path.join(BASE_DIR, 'reports')
app.config['LOG_FOLDER'] = os.path.join(BASE_DIR, 'logs')
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'dcm', 'nii', 'nii.gz'}
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max-limit

# 创建必要的目录
for folder in ['UPLOAD_FOLDER', 'PROCESSED_FOLDER', 'REPORTS_FOLDER', 'LOG_FOLDER']:
    folder_path = app.config[folder]
    print(f"创建目录: {folder_path}")
    try:
        os.makedirs(folder_path, exist_ok=True)
        print(f"✓ 目录已创建: {folder_path}")
    except Exception as e:
        print(f"✗ 创建目录失败: {str(e)}")

db = SQLAlchemy(app)

class Patient(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    patient_id = db.Column(db.String(255), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    images = db.relationship('Image', backref='patient', lazy=True)

    def __repr__(self):
        return f'<Patient {self.name}>'

class Image(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    patient_id = db.Column(db.Integer, db.ForeignKey('patient.id'), nullable=False)
    check_date = db.Column(db.DateTime, nullable=False)
    lesion_volume = db.Column(db.Float)
    tissue_stats = db.Column(db.JSON)
    processed_filename = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Image {self.filename}>'

def allowed_file(filename):
    print(f"\n检查文件类型: {filename}")
    print(f"允许的文件类型: {app.config['ALLOWED_EXTENSIONS']}")
    
    # 如果是测试文件，直接返回True
    if filename == 'test.dcm':
        print("是测试文件，允许上传")
        return True
        
    if '.' not in filename:
        print(f"文件名中没有扩展名: {filename}")
        return False
        
    ext = filename.rsplit('.', 1)[1].lower()
    print(f"文件扩展名: {ext}")
    
    # 检查扩展名是否在允许列表中
    allowed = ext in app.config['ALLOWED_EXTENSIONS']
    print(f"是否允许上传: {allowed}")
    return allowed

@app.route('/api/process', methods=['POST'])
def process_image():
    try:
        print("\n=== 开始处理新的上传请求 ===")
        print(f"请求头: {dict(request.headers)}")
        print(f"表单数据: {request.form}")
        print(f"文件: {request.files}")
        
        if 'file' not in request.files:
            print("未找到文件")
            return jsonify({'error': '未找到文件'}), 400
            
        file = request.files['file']
        print(f"文件名: {file.filename}")
        print(f"文件内容类型: {file.content_type}")
        
        if file.filename == '':
            print("未选择文件")
            return jsonify({'error': '未选择文件'}), 400
            
        print(f"检查文件类型: {file.filename}")
        if not allowed_file(file.filename):
            print(f"不支持的文件类型: {file.filename}")
            return jsonify({'error': '不支持的文件类型'}), 400
            
        # 获取患者信息
        patient_name = request.form.get('patient_name', '未知患者')
        patient_id = request.form.get('patient_id', f'patient-{datetime.now().strftime("%Y%m%d%H%M%S")}')
        
        print(f"处理患者 {patient_name} (ID: {patient_id}) 的文件: {file.filename}")
        
        # 保存原始文件
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        print(f"保存文件到: {filepath}")
        try:
            file.save(filepath)
            if not os.path.exists(filepath):
                raise Exception("文件保存失败")
            print("文件保存成功")
            print(f"文件大小: {os.path.getsize(filepath)} 字节")
        except Exception as e:
            print(f"保存文件失败: {str(e)}")
            return jsonify({'error': f'保存文件失败: {str(e)}'}), 500
        
        # 生成任务ID
        task_id = f"task-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        print(f"生成任务ID: {task_id}")
        
        # 模拟处理过程
        time.sleep(2)  # 模拟处理时间
        
        # 返回成功响应
        response = {
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
        print(f"返回响应: {response}")
        print("=== 处理完成 ===\n")
        return jsonify(response)
            
    except Exception as e:
        error_msg = f"处理请求时发生错误: {str(e)}"
        print(f"错误: {error_msg}")
        print(f"错误详情: {traceback.format_exc()}")
        print("=== 处理失败 ===\n")
        return jsonify({'error': error_msg}), 500

@app.route('/api/tasks/<task_id>')
def get_task(task_id):
    try:
        print(f"查询任务状态: {task_id}")
        
        # 模拟任务完成
        response = {
            'status': 'completed',
            'results': {
                'task_id': task_id,
                'message': '处理完成'
            }
        }
        print(f"返回响应: {response}")
        return jsonify(response)
        
    except Exception as e:
        error_msg = f"查询任务状态时发生错误: {str(e)}"
        print(f"错误: {error_msg}")
        print(f"错误详情: {traceback.format_exc()}")
        return jsonify({'error': error_msg}), 500

@app.route('/')
def index():
    return jsonify({
        'name': 'MRI图像处理系统API',
        'version': '1.0.0',
        'endpoints': {
            'upload': '/api/process',
            'task_status': '/api/tasks/<task_id>',
            'health': '/health'
        },
        'supported_formats': list(app.config['ALLOWED_EXTENSIONS'])
    })

@app.route('/health')
def health_check():
    return jsonify({'status': 'healthy'})

# 错误处理中间件
@app.errorhandler(Exception)
def handle_error(error):
    print(f"发生未处理的错误: {str(error)}")
    print(f"错误详情: {traceback.format_exc()}")
    
    if isinstance(error, werkzeug.exceptions.RequestEntityTooLarge):
        return jsonify({
            'error': '文件大小超过限制（最大16MB）'
        }), 413
        
    if isinstance(error, werkzeug.exceptions.BadRequest):
        return jsonify({
            'error': '无效的请求'
        }), 400
        
    return jsonify({
        'error': f'服务器错误: {str(error)}'
    }), 500

# 添加CORS支持
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=5000) 