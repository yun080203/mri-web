import os

class Config:
    # 基础配置
    BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
    
    # 数据库配置
    SQLALCHEMY_DATABASE_URI = f'sqlite:///{os.path.join(BASE_DIR, "brain_mri.db")}'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # 文件上传配置
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    PROCESSED_FOLDER = os.path.join(BASE_DIR, 'processed')
    REPORTS_FOLDER = os.path.join(BASE_DIR, 'reports')
    LOG_FOLDER = os.path.join(BASE_DIR, 'logs')
    
    # 允许的文件类型
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'dcm', 'nii', 'nii.gz'}
    
    # 文件大小限制
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB
    
    # 日志配置
    LOG_LEVEL = 'DEBUG'
    LOG_FORMAT = '%(asctime)s [%(levelname)s] %(message)s'
    LOG_FILE = 'app.log'
    
    # 安全配置
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-key-please-change-in-production'
    
    # CORS配置
    CORS_ORIGINS = ['*']
    CORS_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    CORS_HEADERS = ['Content-Type', 'Authorization']
    
    # MATLAB配置
    MATLAB_PATH = os.environ.get('MATLAB_PATH') or r"D:\Matlab\bin\matlab.exe"
    CAT12_PATH = os.environ.get('CAT12_PATH') or r"D:\Matlab\toolbox\spm12\toolbox\cat12"
    
    # CAT12处理配置
    CAT12_QUALITY = 1  # 处理质量：1=高质量，2=标准质量
    CAT12_SURFACE = 1  # 是否进行表面重建
    CAT12_ROI = 1      # 是否进行ROI分析
    CAT12_NORM = 1     # 是否进行标准化
    CAT12_DEFORM = 1   # 是否进行变形场计算
    CAT12_VBM = 1      # 是否进行VBM分析
    
    # 处理队列配置
    MAX_CONCURRENT_PROCESSES = 2  # 最大并发处理数
    PROCESS_TIMEOUT = 3600  # 处理超时时间（秒）
    
    # 进度跟踪配置
    PROGRESS_UPDATE_INTERVAL = 5  # 进度更新间隔（秒） 