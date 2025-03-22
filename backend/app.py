from flask import Flask, request, jsonify, send_file, current_app
import os
from flask_sqlalchemy import SQLAlchemy
import cv2
import numpy as np
import uuid
import subprocess
from werkzeug.utils import secure_filename
import pydicom
from datetime import datetime, timedelta
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
import base64
from PIL import Image
import nibabel as nib
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
import sqlite3

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# 初始化Flask应用
app = Flask(__name__)

# 配置CORS，只允许一个源
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

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

# JWT配置
app.config['JWT_SECRET_KEY'] = 'your-secret-key'  # 在生产环境中使用更安全的密钥
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=1)
app.config['JWT_IDENTITY_CLAIM'] = 'sub'  # 设置身份声明
app.config['JWT_TOKEN_LOCATION'] = ['headers']  # 指定token位置
app.config['JWT_HEADER_NAME'] = 'Authorization'  # 指定header名称
app.config['JWT_HEADER_TYPE'] = 'Bearer'  # 指定header类型
jwt = JWTManager(app)

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

# 添加用户模型
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    patients = db.relationship('Patient', backref='user', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User {self.username}>'

# 修改Patient模型
class Patient(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    patient_id = db.Column(db.String(255), unique=True, nullable=False)
    age = db.Column(db.Integer)
    gender = db.Column(db.String(10))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
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

# 添加任务队列类
class TaskQueue:
    def __init__(self):
        self.tasks = {}
        self.progress = {}

    def add_task(self, task_id):
        self.tasks[task_id] = 'processing'
        self.progress[task_id] = 0

    def update_progress(self, task_id, progress):
        if task_id in self.progress:
            self.progress[task_id] = progress

    def get_progress(self, task_id):
        return self.progress.get(task_id, 0)

    def complete_task(self, task_id):
        if task_id in self.tasks:
            self.tasks[task_id] = 'completed'
            self.progress[task_id] = 100

    def fail_task(self, task_id):
        if task_id in self.tasks:
            self.tasks[task_id] = 'failed'

# 创建全局任务队列实例
task_queue = TaskQueue()

@app.route('/api/process', methods=['POST'])
@jwt_required()
def process_image():
    try:
        current_user_id = get_jwt_identity()
        
        if 'file' not in request.files:
            return jsonify({'error': '未找到文件'}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '未选择文件'}), 400
            
        if not allowed_file(file.filename):
            return jsonify({'error': '不支持的文件类型'}), 400
            
        # 获取患者信息
        patient_id = request.form.get('patient_id')
        if not patient_id:
            return jsonify({'error': '未提供患者ID'}), 400
            
        # 验证患者是否属于当前用户
        patient = Patient.query.filter_by(id=patient_id, user_id=current_user_id).first()
        if not patient:
            return jsonify({'error': '患者不存在或无权访问'}), 403
            
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
        
        # 添加任务到队列
        task_queue.add_task(task_id)
        
        # 模拟处理过程
        def process_task():
            for i in range(0, 101, 10):
                time.sleep(0.5)  # 模拟处理时间
                task_queue.update_progress(task_id, i)
            task_queue.complete_task(task_id)
        
        # 启动处理线程
        import threading
        thread = threading.Thread(target=process_task)
        thread.start()
        
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

@app.route('/api/tasks')
def get_all_tasks():
    try:
        print("获取所有任务状态")
        
        # 模拟任务列表
        response = {
            'tasks': [
                {
                    'task_id': 'task-1',
                    'status': 'completed',
                    'message': '处理完成'
                },
                {
                    'task_id': 'task-2',
                    'status': 'processing',
                    'message': '正在处理'
                }
            ]
        }
        print(f"返回响应: {response}")
        return jsonify(response)
        
    except Exception as e:
        error_msg = f"获取任务列表时发生错误: {str(e)}"
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

@app.route('/api/tasks/<task_id>/progress', methods=['GET'])
def get_task_progress(task_id):
    """获取任务处理进度"""
    try:
        # 从任务队列获取进度
        progress = task_queue.get_progress(task_id)
        return jsonify({
            'status': 'success',
            'progress': progress
        })
    except Exception as e:
        print(f"获取进度错误: {str(e)}")
        print(f"错误详情: {traceback.format_exc()}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/preview/<filename>', methods=['GET'])
def get_image_preview(filename):
    """获取图像预览"""
    try:
        # 构建文件路径
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        # 检查文件是否存在
        if not os.path.exists(filepath):
            return jsonify({
                'status': 'error',
                'message': '文件不存在'
            }), 404
            
        # 读取DICOM文件
        ds = pydicom.dcmread(filepath)
        
        # 获取像素数据
        pixel_array = ds.pixel_array
        
        # 归一化像素值到0-255范围
        if pixel_array.max() > 255:
            pixel_array = ((pixel_array - pixel_array.min()) * 255.0 / (pixel_array.max() - pixel_array.min())).astype(np.uint8)
        
        # 转换为PNG格式
        img = Image.fromarray(pixel_array)
        
        # 保存为临时PNG文件
        temp_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{filename}.png")
        img.save(temp_path, 'PNG')
        
        # 读取PNG文件并转换为base64
        with open(temp_path, 'rb') as f:
            img_data = base64.b64encode(f.read()).decode()
            
        # 删除临时文件
        os.remove(temp_path)
        
        return jsonify({
            'status': 'success',
            'image': img_data
        })
    except Exception as e:
        print(f"预览生成错误: {str(e)}")
        print(f"错误详情: {traceback.format_exc()}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/processed/<task_id>/<filename>', methods=['GET'])
def get_processed_image(task_id, filename):
    """获取处理后的图像"""
    try:
        # 构建文件路径
        filepath = os.path.join(app.config['PROCESSED_FOLDER'], task_id, filename)
        
        # 检查文件是否存在
        if not os.path.exists(filepath):
            return jsonify({
                'status': 'error',
                'message': '文件不存在'
            }), 404
            
        # 读取NIfTI文件
        img = nib.load(filepath)
        data = img.get_fdata()
        
        # 获取中间切片
        middle_slice = data[:, :, data.shape[2]//2]
        
        # 归一化到0-255
        middle_slice = ((middle_slice - middle_slice.min()) * 255.0 / (middle_slice.max() - middle_slice.min())).astype(np.uint8)
        
        # 转换为PNG
        img = Image.fromarray(middle_slice)
        
        # 保存为临时PNG文件
        temp_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{task_id}_{filename}.png")
        img.save(temp_path, 'PNG')
        
        # 读取PNG文件并转换为base64
        with open(temp_path, 'rb') as f:
            img_data = base64.b64encode(f.read()).decode()
            
        # 删除临时文件
        os.remove(temp_path)
        
        return jsonify({
            'status': 'success',
            'image': img_data
        })
    except Exception as e:
        print(f"获取处理后图像错误: {str(e)}")
        print(f"错误详情: {traceback.format_exc()}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/results/<task_id>', methods=['GET'])
def get_analysis_results(task_id):
    """获取分析结果"""
    try:
        # 构建结果文件路径
        result_file = os.path.join(app.config['PROCESSED_FOLDER'], task_id, 'cat_results.json')
        
        # 检查文件是否存在
        if not os.path.exists(result_file):
            return jsonify({
                'status': 'error',
                'message': '结果文件不存在'
            }), 404
            
        # 读取结果文件
        with open(result_file, 'r') as f:
            results = json.load(f)
            
        return jsonify({
            'status': 'success',
            'results': results
        })
    except Exception as e:
        print(f"获取分析结果错误: {str(e)}")
        print(f"错误详情: {traceback.format_exc()}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# 添加用户注册API
@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')

        if not username or not email or not password:
            return jsonify({'error': '所有字段都是必填的'}), 400

        # 检查用户名是否已存在
        if User.query.filter_by(username=username).first():
            return jsonify({'error': '用户名已存在'}), 400

        # 检查邮箱是否已存在
        if User.query.filter_by(email=email).first():
            return jsonify({'error': '邮箱已被注册'}), 400

        # 创建新用户
        user = User(username=username, email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()

        return jsonify({'message': '注册成功'}), 201

    except Exception as e:
        db.session.rollback()
        print(f"注册错误: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 添加用户登录API
@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({'error': '用户名和密码都是必填的'}), 400

        user = User.query.filter_by(username=username).first()

        if user and user.check_password(password):
            # 将用户ID转换为字符串
            access_token = create_access_token(identity=str(user.id))
            return jsonify({
                'access_token': access_token,
                'username': user.username
            }), 200
        else:
            return jsonify({'error': '用户名或密码错误'}), 401

    except Exception as e:
        print(f"登录错误: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 添加患者信息API
@app.route('/api/patients', methods=['GET', 'POST'])
@jwt_required()
def patients():
    try:
        # 获取当前用户ID并确保是字符串类型
        current_user_id = str(get_jwt_identity())
        print(f"当前用户ID: {current_user_id}")
        print(f"请求头: {dict(request.headers)}")
        
        if request.method == 'GET':
            print("处理 GET 请求")
            patients = Patient.query.filter_by(user_id=int(current_user_id)).all()
            return jsonify({
                'patients': [{
                    'id': p.id,
                    'name': p.name,
                    'patient_id': p.patient_id,
                    'age': p.age,
                    'gender': p.gender,
                    'created_at': p.created_at.isoformat(),
                    'image_count': len(p.images)
                } for p in patients]
            }), 200

        elif request.method == 'POST':
            print("处理 POST 请求")
            print(f"请求内容类型: {request.content_type}")
            print(f"请求数据: {request.get_data()}")
            
            try:
                data = request.get_json()
                print(f"解析后的数据: {data}")
            except Exception as e:
                print(f"解析 JSON 数据失败: {str(e)}")
                return jsonify({'error': '无效的 JSON 数据'}), 400
            
            if not data:
                print("没有接收到数据")
                return jsonify({'error': '无效的请求数据'}), 400
                
            # 验证必填字段
            required_fields = ['name', 'patient_id', 'age', 'gender']
            for field in required_fields:
                if field not in data:
                    print(f"缺少必填字段: {field}")
                    return jsonify({'error': f'缺少必填字段: {field}'}), 400
                    
            # 检查患者ID是否已存在
            if Patient.query.filter_by(patient_id=data['patient_id']).first():
                print(f"患者ID已存在: {data['patient_id']}")
                return jsonify({'error': '患者ID已存在'}), 400
                
            # 创建新患者
            try:
                new_patient = Patient(
                    name=data['name'],
                    patient_id=data['patient_id'],
                    age=int(data['age']),
                    gender=data['gender'],
                    user_id=int(current_user_id)
                )
                
                db.session.add(new_patient)
                db.session.commit()
                print("患者创建成功")
                
                return jsonify({
                    'message': '患者创建成功',
                    'patient': {
                        'id': new_patient.id,
                        'name': new_patient.name,
                        'patient_id': new_patient.patient_id,
                        'age': new_patient.age,
                        'gender': new_patient.gender,
                        'created_at': new_patient.created_at.isoformat()
                    }
                }), 201
            except Exception as e:
                print(f"创建患者时发生错误: {str(e)}")
                print(f"错误详情: {traceback.format_exc()}")
                db.session.rollback()
                return jsonify({'error': f'创建患者失败: {str(e)}'}), 500
            
    except Exception as e:
        print(f"处理患者请求时发生错误: {str(e)}")
        print(f"错误详情: {traceback.format_exc()}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/patients/<int:patient_id>', methods=['GET'])
@jwt_required()
def patient_detail(patient_id):
    current_user_id = get_jwt_identity()
    db = get_db()
    
    try:
        # 获取患者基本信息
        patient = db.execute('''
            SELECT * FROM patients 
            WHERE id = ? AND user_id = ?
        ''', (patient_id, current_user_id)).fetchone()

        if not patient:
            return jsonify({'error': '未找到患者信息'}), 404

        # 获取患者的所有图像记录
        images = db.execute('''
            SELECT * FROM images 
            WHERE patient_id = ?
            ORDER BY created_at DESC
        ''', (patient_id,)).fetchall()

        return jsonify({
            'patient': {
                'id': patient['id'],
                'name': patient['name'],
                'patient_id': patient['patient_id'],
                'age': patient['age'],
                'gender': patient['gender'],
                'created_at': patient['created_at'],
                'images': [{
                    'id': img['id'],
                    'filename': img['filename'],
                    'check_date': img['check_date'],
                    'lesion_volume': img['lesion_volume'],
                    'created_at': img['created_at']
                } for img in images]
            }
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

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

def get_db():
    db = sqlite3.connect(app.config['SQLALCHEMY_DATABASE_URI'])
    db.row_factory = sqlite3.Row
    return db

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=5000) 