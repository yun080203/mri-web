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
    ALLOWED_EXTENSIONS = {'dcm', 'nii', 'nii.gz'}
    ALLOWED_MIME_TYPES = {
        'application/dicom',
        'application/octet-stream'
    }
    
    # 文件大小限制
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB
    
    # 日志配置
    LOG_LEVEL = 'DEBUG'
    LOG_FORMAT = '%(asctime)s [%(levelname)s] %(message)s'
    LOG_FILE = 'app.log'
    LOG_MAX_SIZE = 10 * 1024 * 1024  # 10MB
    LOG_BACKUP_COUNT = 5
    
    # 安全配置
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-key-please-change-in-production'
    
    # JWT配置
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'jwt-secret-key-please-change-in-production'
    JWT_ACCESS_TOKEN_EXPIRES = 3600  # token过期时间：1小时
    JWT_REFRESH_TOKEN_EXPIRES = 2592000  # 刷新token过期时间：30天
    JWT_TOKEN_LOCATION = ["headers"]
    JWT_HEADER_NAME = "Authorization"
    JWT_HEADER_TYPE = "Bearer"
    JWT_IDENTITY_CLAIM = "sub"
    
    # CORS配置
    CORS_ORIGINS = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001'
    ]
    CORS_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    CORS_HEADERS = ['Content-Type', 'Authorization', 'Accept']
    CORS_SUPPORTS_CREDENTIALS = True
    CORS_MAX_AGE = 3600
    
    # 缓存配置
    CACHE_TYPE = os.environ.get('CACHE_TYPE', 'simple')
    CACHE_REDIS_URL = os.environ.get('CACHE_REDIS_URL', 'redis://localhost:6379/0')
    CACHE_DEFAULT_TIMEOUT = 300
    CACHE_KEY_PREFIX = 'mri_app:'
    
    # 任务队列配置
    MAX_CONCURRENT_PROCESSES = int(os.environ.get('MAX_CONCURRENT_PROCESSES', 2))
    PROCESS_TIMEOUT = 3600  # 处理超时时间（秒）
    MAX_RETRIES = 3  # 最大重试次数
    RETRY_DELAY = 5  # 重试延迟（秒）
    
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
    
    # 性能优化配置
    CHUNK_SIZE = 8192  # 文件上传分块大小
    COMPRESSION_LEVEL = 6  # 图像压缩级别(1-9)
    PREVIEW_MAX_SIZE = 800  # 预览图最大尺寸
    
    # 错误处理配置
    ERROR_INCLUDE_TRACEBACK = False  # 是否在错误响应中包含堆栈跟踪
    
    @staticmethod
    def init_app(app):
        # 确保必要的目录存在
        for folder in [Config.UPLOAD_FOLDER, Config.PROCESSED_FOLDER, 
                      Config.REPORTS_FOLDER, Config.LOG_FOLDER]:
            if not os.path.exists(folder):
                os.makedirs(folder)

class DevelopmentConfig(Config):
    DEBUG = True
    ERROR_INCLUDE_TRACEBACK = True
    SQLALCHEMY_ECHO = True

class ProductionConfig(Config):
    DEBUG = False
    ERROR_INCLUDE_TRACEBACK = False
    SQLALCHEMY_ECHO = False
    
    # 生产环境安全设置
    CORS_ORIGINS = [
        'https://your-production-domain.com'
    ]
    
    # 生产环境缓存设置
    CACHE_TYPE = 'redis'
    
    # 生产环境日志设置
    LOG_LEVEL = 'INFO'

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
} 