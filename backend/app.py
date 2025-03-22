from flask import Flask, request, jsonify, send_file, current_app, make_response
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
from PIL import Image as PILImage
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

# 配置CORS
CORS(app, 
    resources={
        r"/*": {
            "origins": ["http://localhost:3000"],  # 明确指定前端域名
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
            "expose_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True,  # 允许携带凭证
            "max_age": 86400
        }
    }
)

# 移除原有的CORS预检请求处理器
@app.after_request
def after_request(response):
    if request.method == 'OPTIONS':
        print(f"处理OPTIONS请求: {request.headers}")
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept,X-Requested-With')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    response.headers.add('Access-Control-Max-Age', '86400')
    return response

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
app.config['JWT_SECRET_KEY'] = 'your-secret-key'  # 请更改为安全的密钥
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = 24 * 60 * 60  # token有效期24小时
app.config['JWT_IDENTITY_CLAIM'] = 'sub'  # 设置身份声明
app.config['JWT_TOKEN_LOCATION'] = ['headers']  # 指定token位置
app.config['JWT_HEADER_NAME'] = 'Authorization'  # 指定header名称
app.config['JWT_HEADER_TYPE'] = 'Bearer'  # 指定header类型

# 添加 CAT12 配置
app.config['CAT12_PATH'] = 'D:/Matlab/toolbox/spm12/toolbox/cat12'  # CAT12 路径
app.config['SPM12_PATH'] = 'D:/Matlab/toolbox/spm12'  # SPM12 路径
app.config['MATLAB_PATH'] = 'D:/Matlab/bin/matlab.exe'  # MATLAB 路径

# 初始化JWT
jwt = JWTManager(app)

# 添加JWT回调函数
@jwt.user_identity_loader
def user_identity_lookup(user):
    # 确保用户ID是字符串类型
    return str(user) if user is not None else None

@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    # 从JWT中获取用户ID并转换为整数
    identity = jwt_data["sub"]
    if identity is None:
        return None
    try:
        user_id = int(identity)
        return User.query.filter_by(id=user_id).first()
    except (ValueError, TypeError):
        return None

# 添加JWT错误处理
@jwt.invalid_token_loader
def invalid_token_callback(error_string):
    return jsonify({
        'msg': 'Invalid token',
        'error': str(error_string)
    }), 401

@jwt.unauthorized_loader
def unauthorized_callback(error_string):
    return jsonify({
        'msg': 'Missing Authorization Header',
        'error': str(error_string)
    }), 401

@jwt.expired_token_loader
def expired_token_callback(_jwt_header, jwt_data):
    return jsonify({
        'msg': 'Token has expired',
        'error': 'token_expired'
    }), 401

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
    __tablename__ = 'patients'  # 显式指定表名
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
    __tablename__ = 'images'  # 显式指定表名
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id'), nullable=False)  # 修改外键引用
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
        self.results = {}  # 添加结果存储

    def add_task(self, task_id):
        self.tasks[task_id] = 'processing'
        self.progress[task_id] = 0
        self.results[task_id] = None

    def update_progress(self, task_id, progress):
        if task_id in self.progress:
            self.progress[task_id] = progress

    def get_progress(self, task_id):
        return self.progress.get(task_id, 0)

    def complete_task(self, task_id, results=None):
        if task_id in self.tasks:
            self.tasks[task_id] = 'completed'
            self.progress[task_id] = 100
            if results:
                self.results[task_id] = results

    def get_results(self, task_id):
        return self.results.get(task_id)

    def fail_task(self, task_id):
        if task_id in self.tasks:
            self.tasks[task_id] = 'failed'

# 创建全局任务队列实例
task_queue = TaskQueue()

def process_dicom_image(filepath, task_id):
    """处理医学影像文件（支持DICOM和NIfTI格式）"""
    try:
        # 创建处理结果目录
        task_dir = os.path.join(app.config['PROCESSED_FOLDER'], task_id)
        mri_dir = os.path.join(task_dir, 'mri')
        os.makedirs(task_dir, exist_ok=True)
        os.makedirs(mri_dir, exist_ok=True)
        print(f"创建目录: {task_dir}")
        print(f"创建目录: {mri_dir}")

        # 检查MATLAB和SPM12路径
        spm12_path = app.config['SPM12_PATH'].replace('/', '\\')
        cat12_path = app.config['CAT12_PATH'].replace('/', '\\')
        matlab_path = app.config['MATLAB_PATH'].replace('/', '\\')

        print(f"检查路径:")
        print(f"MATLAB路径: {matlab_path}")
        print(f"SPM12路径: {spm12_path}")
        print(f"CAT12路径: {cat12_path}")

        # 验证路径是否存在
        if not os.path.exists(matlab_path):
            raise Exception(f"MATLAB路径不存在: {matlab_path}")
        if not os.path.exists(spm12_path):
            raise Exception(f"SPM12路径不存在: {spm12_path}")
        if not os.path.exists(cat12_path):
            raise Exception(f"CAT12路径不存在: {cat12_path}")

        # 根据文件扩展名处理输入文件
        file_ext = os.path.splitext(filepath)[1].lower()
        if file_ext == '.dcm':
            # 处理DICOM文件
            ds = pydicom.dcmread(filepath)
            pixel_array = ds.pixel_array
            if len(pixel_array.shape) == 2:
                pixel_array = pixel_array[np.newaxis, :, :]
            nii_filepath = os.path.join(task_dir, 'input.nii')
            nii_img = nib.Nifti1Image(pixel_array, np.eye(4))
            nib.save(nii_img, nii_filepath)
            print(f"将DICOM转换为NIfTI: {nii_filepath}")
        elif file_ext == '.nii':
            # 直接复制NIfTI文件
            nii_filepath = os.path.join(task_dir, 'input.nii')
            import shutil
            shutil.copy2(filepath, nii_filepath)
            print(f"复制NIfTI文件: {nii_filepath}")
        else:
            raise Exception(f"不支持的文件格式: {file_ext}")

        # 准备TPM路径
        tpm_path = os.path.join(spm12_path, 'tpm', 'TPM.nii')
        if not os.path.exists(tpm_path):
            raise Exception(f"TPM文件不存在: {tpm_path}")
        tpm_path = tpm_path.replace('/', '\\')

        # 创建 MATLAB 脚本
        matlab_script = r"""
        try
            % 添加路径并显示
            disp('正在添加路径...');
            disp(['SPM12路径: ' '{0}']);
            disp(['CAT12路径: ' '{1}']);
            addpath('{0}');
            addpath('{1}');
            
            % 初始化SPM
            disp('正在初始化SPM...');
            spm('defaults', 'fmri');
            spm_jobman('initcfg');
            
            % 显示输入文件信息
            disp(['输入文件: ' '{2}']);
            disp(['TPM文件: ' '{3}']);
            
            % 创建并显示批处理结构
            disp('创建批处理结构...');
            matlabbatch = [];
            matlabbatch{{1}}.spm.tools.cat.estwrite.data = {{'{2}'}};
            matlabbatch{{1}}.spm.tools.cat.estwrite.nproc = 2;
            matlabbatch{{1}}.spm.tools.cat.estwrite.opts.tpm = {{'{3}'}};
            matlabbatch{{1}}.spm.tools.cat.estwrite.opts.affreg = 'mni';  % MNI空间配准
            matlabbatch{{1}}.spm.tools.cat.estwrite.opts.biasstr = 0.5;   % 中等偏差校正
            matlabbatch{{1}}.spm.tools.cat.estwrite.extopts.APP = 1070;   % 经典预处理
            matlabbatch{{1}}.spm.tools.cat.estwrite.extopts.LASstr = 0.5; % 中等局部自适应分割
            matlabbatch{{1}}.spm.tools.cat.estwrite.extopts.gcutstr = 2;  % 中等全局校正
            matlabbatch{{1}}.spm.tools.cat.estwrite.extopts.cleanupstr = 0.5; % 中等清理
            matlabbatch{{1}}.spm.tools.cat.estwrite.output.surface = 0;
            matlabbatch{{1}}.spm.tools.cat.estwrite.output.ROImenu.atlases.neuromorphometrics = 1;
            matlabbatch{{1}}.spm.tools.cat.estwrite.output.GM.native = 1;
            matlabbatch{{1}}.spm.tools.cat.estwrite.output.WM.native = 1;
            matlabbatch{{1}}.spm.tools.cat.estwrite.output.CSF.native = 1;
            matlabbatch{{1}}.spm.tools.cat.estwrite.output.bias.native = 0;
            matlabbatch{{1}}.spm.tools.cat.estwrite.output.warps = [0 0];
            
            % 运行批处理
            disp('开始运行CAT12处理...');
            spm_jobman('run', matlabbatch);
            disp('CAT12处理完成');
            
        catch ME
            disp('错误信息:');
            disp(['错误ID: ' ME.identifier]);
            disp(['错误信息: ' ME.message]);
            for i = 1:length(ME.stack)
                disp(['文件: ' ME.stack(i).file]);
                disp(['行号: ' num2str(ME.stack(i).line)]);
                disp(['函数: ' ME.stack(i).name]);
            end
            exit(1);
        end
        disp('处理成功完成');
        exit;
        """.format(
            spm12_path.replace('\\', '\\\\'),
            cat12_path.replace('\\', '\\\\'),
            nii_filepath.replace('/', '\\').replace('\\', '\\\\'),
            tpm_path.replace('\\', '\\\\')
        )

        # 保存 MATLAB 脚本
        script_path = os.path.join(task_dir, 'cat12_process.m')
        with open(script_path, 'w') as f:
            f.write(matlab_script)
        print(f"保存MATLAB脚本: {script_path}")

        # 运行 MATLAB 脚本
        matlab_cmd = f'"{matlab_path}" -nodesktop -nosplash -wait -logfile "{os.path.join(task_dir, "matlab.log")}" -r "run(\'{script_path}\')"'
        print(f"执行MATLAB命令: {matlab_cmd}")
        
        process = subprocess.Popen(matlab_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stdout, stderr = process.communicate()

        # 打印MATLAB输出
        try:
            print("MATLAB stdout:", stdout.decode('gbk', errors='ignore'))
        except:
            print("MATLAB stdout:", stdout)
        try:
            print("MATLAB stderr:", stderr.decode('gbk', errors='ignore'))
        except:
            print("MATLAB stderr:", stderr)

        # 检查MATLAB日志文件
        log_file = os.path.join(task_dir, "matlab.log")
        if os.path.exists(log_file):
            print("MATLAB日志文件内容:")
            with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                print(f.read())

        if process.returncode != 0:
            raise Exception(f"MATLAB处理失败，返回码: {process.returncode}")

        try:
            # 检查是否生成了必要的文件
            required_files = [
                os.path.join(task_dir, 'mri', 'p1input.nii'),
                os.path.join(task_dir, 'mri', 'p2input.nii'),
                os.path.join(task_dir, 'mri', 'p3input.nii')
            ]
            
            missing_files = [f for f in required_files if not os.path.exists(f)]
            if missing_files:
                raise Exception(f"处理后的文件未生成: {', '.join(missing_files)}")

            # 读取分割结果
            gm_path = os.path.join(task_dir, 'mri', 'p1input.nii')
            wm_path = os.path.join(task_dir, 'mri', 'p2input.nii')
            csf_path = os.path.join(task_dir, 'mri', 'p3input.nii')

            # 计算体积
            gm_img = nib.load(gm_path)
            wm_img = nib.load(wm_path)
            csf_img = nib.load(csf_path)

            voxel_volume = np.prod(gm_img.header.get_zooms())  # 体素体积（mm³）
            gm_volume = np.sum(gm_img.get_fdata()) * voxel_volume
            wm_volume = np.sum(wm_img.get_fdata()) * voxel_volume
            csf_volume = np.sum(csf_img.get_fdata()) * voxel_volume
            tiv = gm_volume + wm_volume + csf_volume

            # 生成结果
            results = {
                'gm_volume': float(gm_volume),
                'wm_volume': float(wm_volume),
                'csf_volume': float(csf_volume),
                'tiv': float(tiv)
            }

            # 保存结果
            results_path = os.path.join(task_dir, 'results.json')
            with open(results_path, 'w') as f:
                json.dump(results, f)

            # 复制分割结果到预期的位置
            segmented_path = os.path.join(task_dir, 'segmented.nii.gz')
            nib.save(gm_img, segmented_path)

            return results

        except Exception as e:
            print(f"处理图像时发生错误: {str(e)}")
            print(f"错误详情: {traceback.format_exc()}")
            raise

    except Exception as e:
        print(f"处理图像时发生错误: {str(e)}")
        print(f"错误详情: {traceback.format_exc()}")
        raise

@app.route('/api/upload', methods=['POST'])
@jwt_required()
def upload_image():
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
        patient = Patient.query.filter_by(id=patient_id, user_id=int(current_user_id)).first()
        if not patient:
            return jsonify({'error': '患者不存在或无权访问'}), 403
            
        # 保存原始文件
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # 创建图像记录
        new_image = Image(
            filename=filename,
            original_filename=file.filename,
            patient_id=patient.id,
            check_date=datetime.now()
        )
        db.session.add(new_image)
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': '文件上传成功',
            'file_info': {
                'id': new_image.id,
                'filename': filename,
                'filepath': filepath,
                'patient_name': patient.name,
                'patient_id': patient.id
            }
        })
            
    except Exception as e:
        error_msg = f"上传文件时发生错误: {str(e)}"
        print(f"错误: {error_msg}")
        print(f"错误详情: {traceback.format_exc()}")
        return jsonify({'error': error_msg}), 500

@app.route('/api/process/<int:image_id>', methods=['POST'])
@jwt_required()
def process_image(image_id):
    try:
        current_user_id = get_jwt_identity()
        
        # 获取图像记录
        image = Image.query.get(image_id)
        if not image:
            return jsonify({'error': '图像不存在'}), 404
            
        # 验证图像所属的患者是否属于当前用户
        patient = Patient.query.get(image.patient_id)
        if not patient or str(patient.user_id) != current_user_id:
            return jsonify({'error': '无权访问该图像'}), 403
            
        # 构建文件路径
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], image.filename)
        if not os.path.exists(filepath):
            return jsonify({'error': '图像文件不存在'}), 404
            
        # 生成任务ID
        task_id = f"task-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # 添加任务到队列
        task_queue.add_task(task_id)
        
        # 启动处理线程
        def process_task():
            try:
                print(f"开始处理任务: {task_id}")
                
                # 处理图像
                results = process_dicom_image(filepath, task_id)
                print(f"图像处理结果: {results}")
                
                # 检查results是否有效
                if not results or not isinstance(results, dict):
                    raise Exception("处理结果无效")
                    
                # 检查必要的结果文件是否存在
                required_files = [
                    os.path.join(app.config['PROCESSED_FOLDER'], task_id, 'mri', 'p1input.nii'),
                    os.path.join(app.config['PROCESSED_FOLDER'], task_id, 'mri', 'p2input.nii'),
                    os.path.join(app.config['PROCESSED_FOLDER'], task_id, 'mri', 'p3input.nii'),
                    os.path.join(app.config['PROCESSED_FOLDER'], task_id, 'report', 'catreport_input.pdf')
                ]
                
                # 检查并打印每个文件的存在状态
                for file_path in required_files:
                    exists = os.path.exists(file_path)
                    print(f"检查文件 {file_path}: {'存在' if exists else '不存在'}")
                    
                missing_files = [f for f in required_files if not os.path.exists(f)]
                if missing_files:
                    raise Exception(f"缺少必要的结果文件: {', '.join(missing_files)}")
                    
                # 更新任务状态和图像记录
                print("更新任务状态为完成")
                task_queue.complete_task(task_id, results)
                
                print("更新图像记录")
                image.processed_filename = f"{task_id}/segmented.nii.gz"
                image.tissue_stats = results
                db.session.commit()
                print("数据库更新成功")
                
            except Exception as e:
                print(f"处理任务失败: {str(e)}")
                print(f"错误详情: {traceback.format_exc()}")
                task_queue.fail_task(task_id)
                
                # 尝试回滚数据库会话
                try:
                    db.session.rollback()
                    print("数据库会话已回滚")
                except Exception as db_error:
                    print(f"数据库回滚失败: {str(db_error)}")
        
        import threading
        thread = threading.Thread(target=process_task)
        thread.start()
        
        return jsonify({
            'task_id': task_id,
            'status': 'processing',
            'message': '开始处理图像'
        })
            
    except Exception as e:
        error_msg = f"处理请求时发生错误: {str(e)}"
        print(f"错误: {error_msg}")
        print(f"错误详情: {traceback.format_exc()}")
        return jsonify({'error': error_msg}), 500

@app.route('/api/tasks/<task_id>')
def get_task(task_id):
    try:
        print(f"获取任务状态: {task_id}")
        
        # 获取任务状态
        status = task_queue.tasks.get(task_id, 'unknown')
        progress = task_queue.get_progress(task_id)
        results = task_queue.get_results(task_id)
        
        print(f"任务状态: {status}")
        print(f"处理进度: {progress}")
        print(f"处理结果: {results}")
        
        # 检查MATLAB日志文件
        log_file = os.path.join(app.config['PROCESSED_FOLDER'], task_id, "matlab.log")
        log_content = None
        if os.path.exists(log_file):
            with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                log_content = f.read()
                print(f"MATLAB日志内容: {log_content}")
        else:
            print(f"MATLAB日志文件不存在: {log_file}")
        
        # 检查必要的结果文件
        result_files = {
            'p1': os.path.exists(os.path.join(app.config['PROCESSED_FOLDER'], task_id, 'mri', 'p1input.nii')),
            'p2': os.path.exists(os.path.join(app.config['PROCESSED_FOLDER'], task_id, 'mri', 'p2input.nii')),
            'p3': os.path.exists(os.path.join(app.config['PROCESSED_FOLDER'], task_id, 'mri', 'p3input.nii')),
            'report': os.path.exists(os.path.join(app.config['PROCESSED_FOLDER'], task_id, 'report', 'catreport_input.pdf'))
        }
        print(f"结果文件状态: {result_files}")
        
        response = {
            'status': status,
            'progress': progress,
            'results': results,
            'matlab_log': log_content,
            'files_exist': result_files
        }
        print(f"返回响应: {response}")
        return jsonify(response)
        
    except Exception as e:
        error_msg = f"获取任务状态失败: {str(e)}"
        print(error_msg)
        print(f"错误详情: {traceback.format_exc()}")
        return jsonify({
            'error': error_msg,
            'status': 'error'
        }), 500

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
            'upload': '/api/upload',
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
            
        # 根据文件扩展名处理
        file_ext = os.path.splitext(filepath)[1].lower()
        
        if file_ext == '.dcm':
            # 读取DICOM文件
            ds = pydicom.dcmread(filepath)
            pixel_array = ds.pixel_array
        elif file_ext == '.nii':
            # 读取NIfTI文件
            img = nib.load(filepath)
            # 获取中间切片
            data = img.get_fdata()
            if len(data.shape) == 3:
                mid_slice = data.shape[2] // 2
                pixel_array = data[:, :, mid_slice]
            else:
                pixel_array = data
        else:
            return jsonify({
                'status': 'error',
                'message': '不支持的文件格式'
            }), 400
        
        # 归一化像素值到0-255范围
        if pixel_array.max() > pixel_array.min():
            pixel_array = ((pixel_array - pixel_array.min()) * 255.0 / (pixel_array.max() - pixel_array.min())).astype(np.uint8)
        
        # 转换为PNG格式
        img = PILImage.fromarray(pixel_array)
        
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
        if filename == 'segmented.nii.gz':
            filepath = os.path.join(app.config['PROCESSED_FOLDER'], task_id, filename)
        else:
            filepath = os.path.join(app.config['PROCESSED_FOLDER'], task_id, 'mri', filename)
        
        # 检查文件是否存在
        if not os.path.exists(filepath):
            print(f"文件不存在: {filepath}")
            return jsonify({
                'status': 'error',
                'message': '文件不存在'
            }), 404
            
        # 读取NIfTI文件
        img = nib.load(filepath)
        data = img.get_fdata()
        
        # 如果是3D图像，获取中间切片
        if len(data.shape) == 3:
            mid_slice = data.shape[2] // 2
            slice_data = data[:, :, mid_slice]
        else:
            slice_data = data
        
        # 归一化到0-255
        if slice_data.max() > slice_data.min():
            slice_data = ((slice_data - slice_data.min()) * 255.0 / (slice_data.max() - slice_data.min())).astype(np.uint8)
        
        # 转换为PNG
        img = PILImage.fromarray(slice_data)
        
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
        result_file = os.path.join(app.config['PROCESSED_FOLDER'], task_id, 'results.json')
        
        # 检查文件是否存在
        if not os.path.exists(result_file):
            print(f"结果文件不存在: {result_file}")
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
@app.route('/api/auth/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({'error': '用户名和密码不能为空'}), 400

        # 检查用户名是否已存在
        if User.query.filter_by(username=username).first():
            return jsonify({'error': '用户名已存在'}), 400

        # 创建新用户
        new_user = User(username=username)
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': '注册成功'
        })

    except Exception as e:
        print(f"注册错误: {str(e)}")
        print(f"错误详情: {traceback.format_exc()}")
        db.session.rollback()
        return jsonify({'error': '注册失败，请重试'}), 500

# 添加用户登录API
@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        print("\n收到登录请求:")
        print(f"请求方法: {request.method}")
        print(f"请求头: {dict(request.headers)}")
        print(f"请求IP: {request.remote_addr}")
        
        # 检查请求内容类型
        if not request.is_json:
            print("请求格式错误：不是JSON格式")
            return jsonify({'error': '请求必须是JSON格式'}), 400
            
        data = request.get_json()
        print(f"请求数据: {data}")
        
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            print("用户名或密码为空")
            return jsonify({'error': '用户名和密码不能为空'}), 400

        # 查找用户
        try:
            user = User.query.filter_by(username=username).first()
            print(f"查找用户结果: {'找到用户' if user else '未找到用户'}")
        except Exception as e:
            print(f"数据库查询错误: {str(e)}")
            return jsonify({'error': '服务器错误'}), 500
        
        if not user:
            print(f"用户不存在: {username}")
            return jsonify({'error': '用户名或密码错误'}), 401
            
        try:
            password_correct = user.check_password(password)
            print(f"密码验证结果: {'正确' if password_correct else '错误'}")
        except Exception as e:
            print(f"密码验证错误: {str(e)}")
            return jsonify({'error': '服务器错误'}), 500
            
        if not password_correct:
            print(f"密码错误: {username}")
            return jsonify({'error': '用户名或密码错误'}), 401

        # 创建token
        try:
            access_token = create_access_token(identity=str(user.id))
            print(f"Token创建成功: {access_token[:20]}...")
        except Exception as e:
            print(f"Token创建错误: {str(e)}")
            return jsonify({'error': '服务器错误'}), 500

        response_data = {
            'token': access_token,
            'user': {
                'id': user.id,
                'username': user.username
            }
        }
        print(f"登录成功，返回数据: {response_data}")
        return jsonify(response_data)

    except Exception as e:
        print(f"登录错误: {str(e)}")
        print(f"错误详情: {traceback.format_exc()}")
        return jsonify({'error': '登录失败，请重试'}), 500

# 添加患者信息API
@app.route('/api/patients', methods=['GET', 'POST'])
@jwt_required()
def patients():
    try:
        # 获取并记录请求信息
        current_user_id = get_jwt_identity()
        print(f"\n收到患者请求:")
        print(f"Method: {request.method}")
        print(f"Headers: {dict(request.headers)}")
        print(f"当前用户ID: {current_user_id}")
        
        if request.method == 'POST':
            print("\n处理POST请求 - 创建新患者")
            try:
                data = request.get_json()
                print(f"接收到的数据: {data}")
            except Exception as e:
                print(f"解析JSON数据失败: {str(e)}")
                return jsonify({'error': '无效的请求数据格式'}), 400

            if not data:
                print("请求数据为空")
                return jsonify({'error': '请求数据为空'}), 400

            # 验证必填字段
            required_fields = ['name', 'patient_id', 'age', 'gender']
            for field in required_fields:
                if not data.get(field):
                    print(f"缺少必填字段: {field}")
                    return jsonify({'error': f'缺少必填字段: {field}'}), 400

            # 验证患者ID是否已存在
            existing_patient = Patient.query.filter_by(patient_id=data['patient_id']).first()
            if existing_patient:
                print(f"患者ID已存在: {data['patient_id']}")
                return jsonify({'error': '患者ID已存在'}), 400

            try:
                print("\n创建新患者记录:")
                print(f"姓名: {data['name']}")
                print(f"患者ID: {data['patient_id']}")
                print(f"年龄: {data['age']}")
                print(f"性别: {data['gender']}")
                print(f"用户ID: {current_user_id}")

                # 创建新患者
                new_patient = Patient(
                    name=data['name'],
                    patient_id=data['patient_id'],
                    age=int(data['age']),
                    gender=data['gender'],
                    user_id=int(current_user_id)
                )

                # 保存到数据库
                db.session.add(new_patient)
                db.session.commit()
                print(f"患者创建成功，ID: {new_patient.id}")

                # 返回创建的患者信息
                response_data = {
                    'status': 'success',
                    'message': '患者创建成功',
                    'patient': {
                        'id': new_patient.id,
                        'name': new_patient.name,
                        'patient_id': new_patient.patient_id,
                        'age': new_patient.age,
                        'gender': new_patient.gender,
                        'created_at': new_patient.created_at.isoformat()
                    }
                }
                print(f"返回响应: {response_data}")
                return jsonify(response_data), 201

            except Exception as e:
                db.session.rollback()
                print(f"创建患者失败: {str(e)}")
                print(f"错误详情: {traceback.format_exc()}")
                return jsonify({'error': f'创建患者失败: {str(e)}'}), 500

        else:  # GET 请求
            print("\n处理GET请求 - 获取患者列表")
            try:
                patients = Patient.query.filter_by(user_id=int(current_user_id)).all()
                patients_list = [{
                    'id': p.id,
                    'name': p.name,
                    'patient_id': p.patient_id,
                    'age': p.age,
                    'gender': p.gender,
                    'created_at': p.created_at.isoformat()
                } for p in patients]
                
                print(f"找到 {len(patients_list)} 个患者记录")
                return jsonify({'patients': patients_list})
            except Exception as e:
                print(f"获取患者列表失败: {str(e)}")
                print(f"错误详情: {traceback.format_exc()}")
                return jsonify({'error': f'获取患者列表失败: {str(e)}'}), 500

    except Exception as e:
        print(f"处理患者请求时出错: {str(e)}")
        print(f"错误详情: {traceback.format_exc()}")
        return jsonify({'error': f'服务器内部错误: {str(e)}'}), 500

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

# 更新init_db函数
def init_db():
    try:
        db_path = os.path.join(BASE_DIR, "brain_mri.db")
        if not os.path.exists(db_path):
            print("创建新数据库...")
            with app.app_context():
                db.create_all()
            print("数据库创建成功")
        else:
            print("数据库已存在，跳过创建")
            
        # 确保所需目录存在
        required_dirs = ['uploads', 'processed', 'reports', 'logs']
        for dir_name in required_dirs:
            dir_path = os.path.join(BASE_DIR, dir_name)
            if not os.path.exists(dir_path):
                print(f"创建目录: {dir_path}")
                os.makedirs(dir_path)
                print(f"✓ 目录已创建: {dir_path}")
            else:
                print(f"✓ 目录已存在: {dir_path}")
                
    except Exception as e:
        print(f"初始化数据库时出错: {str(e)}")
        raise

# 在应用启动时初始化数据库
with app.app_context():
    init_db()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000) 