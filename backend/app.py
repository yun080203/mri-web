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
from config.config import Config
from models import db, User, Patient, Image as DBImage
from threading import Thread
import shutil

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

# 从Config类加载配置
app.config.from_object(Config)

# 配置CORS
CORS(app, 
    resources={
        r"/*": {
            "origins": ["http://localhost:3000"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "Accept"],
            "supports_credentials": True,
            "max_age": 3600
        }
    }
)

# 修改CORS预检请求处理器
@app.after_request
def after_request(response):
    if 'Access-Control-Allow-Origin' not in response.headers:
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    response.headers.add('Access-Control-Max-Age', '3600')
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
app.config['JWT_SECRET_KEY'] = Config.JWT_SECRET_KEY
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = Config.JWT_ACCESS_TOKEN_EXPIRES
app.config['JWT_IDENTITY_CLAIM'] = Config.JWT_IDENTITY_CLAIM
app.config['JWT_TOKEN_LOCATION'] = Config.JWT_TOKEN_LOCATION
app.config['JWT_HEADER_NAME'] = Config.JWT_HEADER_NAME
app.config['JWT_HEADER_TYPE'] = Config.JWT_HEADER_TYPE

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

# 初始化数据库
db.init_app(app)

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

    def fail_task(self, task_id):
        if task_id in self.tasks:
            self.tasks[task_id] = 'failed'

    def get_results(self, task_id):
        return self.results.get(task_id)

# 创建任务队列实例
task_queue = TaskQueue()

def process_dicom_image(full_filepath, task_dir, nifti_file, file_ext):
    try:
        print(f"\n=== 开始处理图像 ===")
        print(f"输入文件: {full_filepath}")
        print(f"任务目录: {task_dir}")
        print(f"文件类型: {file_ext}")

        if file_ext == '.dcm':
            print("处理DICOM文件...")
            # 处理DICOM文件
            ds = pydicom.dcmread(full_filepath)
            pixel_array = ds.pixel_array
            
            # 确保是3D数组
            if len(pixel_array.shape) == 2:
                pixel_array = pixel_array[np.newaxis, :, :]
            print(f"图像形状: {pixel_array.shape}")
            
            # 使用PIL处理图像
            img = PILImage.fromarray(pixel_array[0].astype('uint8'))
            preview_path = os.path.join(task_dir, 'preview.png')
            img.save(preview_path)
            print(f"预览图已保存: {preview_path}")
            
            # 转换为NIfTI
            nifti_img = nib.Nifti1Image(pixel_array, np.eye(4))
            nib.save(nifti_img, nifti_file)
            print(f"已转换为NIfTI: {nifti_file}")
            
        elif file_ext in ['.nii', '.gz']:
            print("处理NIfTI文件...")
            # 处理NIfTI文件
            img = nib.load(full_filepath)
            data = img.get_fdata()
            print(f"NIfTI图像形状: {data.shape}")
            
            # 获取中间切片
            mid_slice = data.shape[2] // 2
            slice_data = data[:, :, mid_slice]
            
            # 归一化到0-255
            slice_data = ((slice_data - slice_data.min()) * 255 / (slice_data.max() - slice_data.min())).astype('uint8')
            
            # 使用PIL保存预览图
            preview_img = PILImage.fromarray(slice_data)
            preview_path = os.path.join(task_dir, 'preview.png')
            preview_img.save(preview_path)
            print(f"预览图已保存: {preview_path}")
            
            # 复制NIfTI文件
            shutil.copy2(full_filepath, nifti_file)
            print(f"已复制NIfTI文件: {nifti_file}")
        else:
            raise Exception(f"不支持的文件格式: {file_ext}")

        # 检查MATLAB和SPM12路径
        spm12_path = app.config['SPM12_PATH'].replace('/', '\\')
        cat12_path = app.config['CAT12_PATH'].replace('/', '\\')
        matlab_path = app.config['MATLAB_PATH'].replace('/', '\\')

        print(f"\n=== 检查环境配置 ===")
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

        # 准备TPM路径
        tpm_path = os.path.join(spm12_path, 'tpm', 'TPM.nii')
        if not os.path.exists(tpm_path):
            raise Exception(f"TPM文件不存在: {tpm_path}")
        tpm_path = tpm_path.replace('/', '\\')
        print(f"TPM文件路径: {tpm_path}")

        print("\n=== 准备MATLAB处理 ===")
        # 创建MATLAB脚本
        matlab_script = '''
        try
            addpath('{spm12_path}');
            addpath('{cat12_path}');
            
            % 初始化SPM
            spm('defaults', 'fmri');
            spm_jobman('initcfg');
            
            % 创建批处理结构
            matlabbatch{{1}}.spm.tools.cat.estwrite.data = {{'{nifti_file}'}};
            matlabbatch{{1}}.spm.tools.cat.estwrite.nproc = 2;
            matlabbatch{{1}}.spm.tools.cat.estwrite.opts.tpm = {{'{tpm_path}'}};
            matlabbatch{{1}}.spm.tools.cat.estwrite.opts.affreg = 'mni';
            matlabbatch{{1}}.spm.tools.cat.estwrite.opts.biasstr = 0.5;
            matlabbatch{{1}}.spm.tools.cat.estwrite.extopts.APP = 1070;
            matlabbatch{{1}}.spm.tools.cat.estwrite.extopts.LASstr = 0.5;
            matlabbatch{{1}}.spm.tools.cat.estwrite.extopts.gcutstr = 2;
            matlabbatch{{1}}.spm.tools.cat.estwrite.extopts.cleanupstr = 0.5;
            matlabbatch{{1}}.spm.tools.cat.estwrite.output.surface = 0;
            matlabbatch{{1}}.spm.tools.cat.estwrite.output.ROImenu.atlases.neuromorphometrics = 1;
            matlabbatch{{1}}.spm.tools.cat.estwrite.output.GM.native = 1;
            matlabbatch{{1}}.spm.tools.cat.estwrite.output.WM.native = 1;
            matlabbatch{{1}}.spm.tools.cat.estwrite.output.CSF.native = 1;
            
            % 运行批处理
            spm_jobman('run', matlabbatch);
            exit;
        catch ME
            disp('错误信息:');
            disp(ME.message);
            exit(1);
        end
        '''.format(
            spm12_path=spm12_path.replace('\\', '\\\\'),
            cat12_path=cat12_path.replace('\\', '\\\\'),
            nifti_file=nifti_file.replace('\\', '\\\\'),
            tpm_path=tpm_path.replace('\\', '\\\\')
        )

        # 保存MATLAB脚本
        script_path = os.path.join(task_dir, 'cat12_process.m')
        with open(script_path, 'w') as f:
            f.write(matlab_script)
        print(f"MATLAB脚本已保存: {script_path}")

        # 运行MATLAB脚本
        matlab_cmd = f'"{matlab_path}" -nodesktop -nosplash -wait -r "run(\'{script_path}\')"'
        print(f"\n=== 执行MATLAB处理 ===")
        print(f"执行命令: {matlab_cmd}")
        
        process = subprocess.Popen(
            matlab_cmd, 
            shell=True, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE,
            cwd=task_dir  # 设置工作目录
        )
        stdout, stderr = process.communicate()

        # 检查MATLAB执行结果
        print("\n=== MATLAB执行结果 ===")
        print(f"返回码: {process.returncode}")
        if stdout:
            print("标准输出:")
            print(stdout.decode('gbk', errors='ignore'))
        if stderr:
            print("错误输出:")
            print(stderr.decode('gbk', errors='ignore'))

        if process.returncode != 0:
            error_msg = stderr.decode('gbk', errors='ignore')
            raise Exception(f"MATLAB处理失败: {error_msg}")

        print("\n=== 检查处理结果 ===")
        # 检查处理结果
        result_files = {
            'gm': os.path.join(task_dir, 'mri', 'p1input.nii'),
            'wm': os.path.join(task_dir, 'mri', 'p2input.nii'),
            'csf': os.path.join(task_dir, 'mri', 'p3input.nii')
        }

        # 检查每个文件的存在性和大小
        for tissue, path in result_files.items():
            if os.path.exists(path):
                size = os.path.getsize(path)
                print(f"{tissue}文件 ({path}): 存在，大小 {size/1024:.2f}KB")
            else:
                print(f"{tissue}文件 ({path}): 不存在")

        missing_files = [f for f, path in result_files.items() if not os.path.exists(path)]
        if missing_files:
            raise Exception(f"缺少处理结果文件: {', '.join(missing_files)}")

        # 计算体积
        print("\n=== 计算组织体积 ===")
        volumes = {}
        for tissue, path in result_files.items():
            img = nib.load(path)
            voxel_volume = np.prod(img.header.get_zooms())  # 体素体积（mm³）
            tissue_volume = np.sum(img.get_fdata()) * voxel_volume
            volumes[f"{tissue}_volume"] = float(tissue_volume)
            print(f"{tissue}体积: {tissue_volume:.2f}mm³")

        volumes['tiv'] = float(sum(volumes.values()))
        print(f"总颅内体积: {volumes['tiv']:.2f}mm³")

        # 保存结果
        results_path = os.path.join(task_dir, 'results.json')
        with open(results_path, 'w') as f:
            json.dump(volumes, f)
        print(f"\n结果已保存到: {results_path}")

        # 复制分割结果到预期的位置
        segmented_path = os.path.join(task_dir, 'segmented.nii.gz')
        shutil.copy2(result_files['gm'], segmented_path)
        print(f"灰质分割结果已复制到: {segmented_path}")

        print("\n=== 处理完成 ===")
        return volumes

    except Exception as e:
        print(f"\n=== 处理失败 ===")
        print(f"错误信息: {str(e)}")
        print(f"错误堆栈:\n{traceback.format_exc()}")
        raise

@app.route('/api/upload', methods=['POST'])
@jwt_required()
def upload_image():
    try:
        current_user_id = get_jwt_identity()
        
        if 'file' not in request.files:
            return jsonify({'error': '没有文件上传'}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '没有选择文件'}), 400
            
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
            
        # 生成安全的文件名
        filename = secure_filename(file.filename)
        unique_filename = f"p{datetime.now().strftime('%Y%m%d_%H%M%S')}{filename}"
        
        # 保存文件
        file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(file_path)
        
        # 创建图像记录
        new_image = DBImage(
            filename=unique_filename,
            original_filename=file.filename,
            patient_id=patient.id,
            check_date=datetime.now(),
            processed_filename=None  # 使用processed_filename而不是processed
        )
        
        db.session.add(new_image)
        db.session.commit()
        
        return jsonify({
            'message': '文件上传成功',
            'image': new_image.to_dict()
        }), 200
            
    except Exception as e:
        error_msg = f"上传文件时发生错误: {str(e)}"
        print(f"错误: {error_msg}")
        print(f"错误详情: {traceback.format_exc()}")
        return jsonify({'error': error_msg}), 500

@app.route('/api/process/<int:image_id>', methods=['POST'])
@jwt_required()
def process_image(image_id):
    try:
        # 获取图像记录
        image = DBImage.query.get(image_id)
        if not image:
            return jsonify({'error': '图像不存在'}), 404

        # 验证患者权限
        patient = Patient.query.get(image.patient_id)
        if not patient:
            return jsonify({'error': '患者不存在'}), 404

        current_user_id = get_jwt_identity()
        if patient.user_id != int(current_user_id):
            return jsonify({'error': '无权访问此患者的图像'}), 403

        # 生成任务ID
        task_id = str(uuid.uuid4())
        
        # 创建任务目录
        task_dir = os.path.join(app.config['PROCESSED_FOLDER'], task_id)
        os.makedirs(task_dir, exist_ok=True)
        os.makedirs(os.path.join(task_dir, 'mri'), exist_ok=True)

        # 获取原始文件路径和扩展名
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], image.filename)
        file_ext = os.path.splitext(image.filename)[1].lower()
        
        # 设置NIfTI文件路径
        nifti_file = os.path.join(task_dir, 'input.nii')

        # 添加任务到队列
        task_queue.add_task(task_id)
        
        # 创建后台线程处理图像
        def process_task():
            try:
                print(f"\n=== 开始处理任务 ===")
                with app.app_context():  # 添加应用上下文
                    # 处理图像
                    results = process_dicom_image(file_path, task_dir, nifti_file, file_ext)
                    print(f"处理结果: {results}")
                    
                    # 更新图像记录
                    image.processed_filename = f"{task_id}/segmented.nii.gz"
                    image.processed_at = datetime.now()
                    image.processed = True  # 添加处理状态标记
                    image.tissue_stats = results  # 保存组织统计数据
                    db.session.commit()
                    print(f"数据库记录已更新: {image.id}")
                    
                    # 完成任务
                    task_queue.complete_task(task_id, results)
                    print(f"任务已完成: {task_id}")
            except Exception as e:
                print(f"\n=== 任务失败 ===")
                print(f"错误信息: {str(e)}")
                print(f"错误堆栈:\n{traceback.format_exc()}")
                with app.app_context():  # 错误处理也需要应用上下文
                    image.processing_error = str(e)
                    db.session.commit()
                task_queue.fail_task(task_id)
                print(f"任务已标记为失败: {task_id}")
                
        thread = Thread(target=process_task)
        thread.daemon = True
        thread.start()
        
        return jsonify({
            'status': 'processing',
            'task_id': task_id
        })
        
    except Exception as e:
        print(f"启动处理失败: {str(e)}")
        print(f"错误详情: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tasks/<task_id>', methods=['GET'])
@jwt_required()
def get_task_status(task_id):
    """获取任务状态"""
    try:
        print(f"\n=== 获取任务状态 ===")
        print(f"任务ID: {task_id}")
        
        # 获取任务状态
        status = task_queue.tasks.get(task_id)
        if not status:
            print(f"任务不存在: {task_id}")
            return jsonify({'error': '任务不存在'}), 404
            
        print(f"任务状态: {status}")
        print(f"任务进度: {task_queue.get_progress(task_id)}")
        
        # 获取MATLAB日志
        log_file = os.path.join(app.config['PROCESSED_FOLDER'], task_id, 'matlab.log')
        matlab_log = None
        if os.path.exists(log_file):
            with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                matlab_log = f.read()
            print("已读取MATLAB日志")
        else:
            print(f"MATLAB日志不存在: {log_file}")
        
        # 获取处理结果
        results = task_queue.get_results(task_id)
        print(f"处理结果: {results}")
        
        response_data = {
            'status': status,
            'progress': task_queue.get_progress(task_id),
            'results': results,
            'matlab_log': matlab_log
        }
        print(f"返回数据: {response_data}")
        
        return jsonify(response_data)
    except Exception as e:
        print(f"\n=== 获取状态失败 ===")
        print(f"错误信息: {str(e)}")
        print(f"错误堆栈:\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

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

@app.route('/api/preview', methods=['POST'])
def generate_preview():
    try:
        if 'file' not in request.files:
            return jsonify({'status': 'error', 'message': '没有文件被上传'})
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({'status': 'error', 'message': '没有选择文件'})
            
        # 设置matplotlib使用非交互式后端
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        
        # 临时保存文件
        temp_path = os.path.join(app.config['UPLOAD_FOLDER'], 'temp_' + file.filename)
        file.save(temp_path)
        
        try:
            # 根据文件类型处理
            if file.filename.lower().endswith('.dcm'):
                ds = pydicom.dcmread(temp_path)
                img_data = ds.pixel_array
            else:
                img = nib.load(temp_path)
                img_data = img.get_fdata()
                
            # 如果是3D数据，取中间切片
            if len(img_data.shape) == 3:
                middle_slice = img_data.shape[2] // 2
                img_data = img_data[:, :, middle_slice]
                
            # 创建预览图
            plt.figure(figsize=(10, 10))
            plt.imshow(img_data, cmap='gray')
            plt.axis('off')
            
            # 保存为内存中的图像
            import io
            import base64
            buf = io.BytesIO()
            plt.savefig(buf, format='png', bbox_inches='tight', pad_inches=0)
            plt.close()
            
            # 转换为base64
            image_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
            
            return jsonify({
                'status': 'success',
                'image': image_base64
            })
            
        finally:
            # 清理临时文件
            if os.path.exists(temp_path):
                os.remove(temp_path)
                
    except Exception as e:
        logging.error(f"生成预览图失败: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'生成预览图失败: {str(e)}'
        })

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
        email = data.get('email')
        password = data.get('password')

        if not username or not password or not email:
            return jsonify({'error': '用户名、邮箱和密码不能为空'}), 400

        # 检查用户名是否已存在
        if User.query.filter_by(username=username).first():
            return jsonify({'error': '用户名已存在'}), 400

        # 检查邮箱是否已存在
        if User.query.filter_by(email=email).first():
            return jsonify({'error': '邮箱已被注册'}), 400

        # 创建新用户
        new_user = User(username=username, email=email)
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
        data = request.get_json()
        if not data:
            return jsonify({'error': '无效的请求数据'}), 400

        # 支持用户名或邮箱登录
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')

        if not password:
            return jsonify({'error': '请输入密码'}), 400

        if not (username or email):
            return jsonify({'error': '请输入用户名或邮箱'}), 400

        # 根据用户名或邮箱查找用户
        if username:
            user = User.query.filter_by(username=username).first()
        else:
            user = User.query.filter_by(email=email).first()

        if user and user.check_password(password):
            access_token = create_access_token(identity=user.id)
            return jsonify({
                'success': True,
                'token': access_token,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email
                }
            })
        else:
            return jsonify({'error': '用户名/邮箱或密码错误'}), 401

    except Exception as e:
        app.logger.error(f"登录错误: {str(e)}")
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

# 添加OPTIONS请求处理
@app.route('/api/task/<task_id>', methods=['OPTIONS'])
def handle_options(task_id):
    response = make_response()
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)