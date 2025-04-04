// API基础URL
export const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

// 空白1x1 PNG作为图像加载失败时的替代图像
export const FALLBACK_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

// 上传相关常量
export const ALLOWED_EXTENSIONS = ['.dcm', '.nii', '.nii.gz', '.img', '.hdr'];
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

// 文件类型
export const ACCEPTED_FILE_TYPES = {
    DICOM: '.dcm',
    NIFTI: '.nii,.nii.gz'
};

// 处理状态
export const PROCESSING_STATUS = {
    IDLE: 'idle',
    UPLOADING: 'uploading',
    UPLOADED: 'uploaded',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    ERROR: 'error'
};

// 错误消息
export const ERROR_MESSAGES = {
    NO_FILE: '请选择文件',
    INVALID_FILE_TYPE: '不支持的文件类型',
    NO_PATIENT: '请选择患者',
    UPLOAD_FAILED: '上传失败',
    PROCESSING_FAILED: '处理失败',
    NETWORK_ERROR: '网络错误',
    AUTH_ERROR: '认证失败',
    SERVER_ERROR: '服务器错误'
};

// 路由路径
export const ROUTES = {
    HOME: '/',
    LOGIN: '/login',
    REGISTER: '/register',
    UPLOAD: '/upload',
    PATIENTS: '/patients',
    PATIENT_DETAIL: '/patients/:id',
    COMPARE: '/compare',
    DATA: '/data'
};

// 本地存储键
export const STORAGE_KEYS = {
    TOKEN: 'token',
    USER: 'user'
};

// 轮询间隔（毫秒）
export const POLLING_INTERVAL = 2000;

// 超时时间（毫秒）
export const TIMEOUT = {
    API: 30000,
    UPLOAD: 60000
}; 