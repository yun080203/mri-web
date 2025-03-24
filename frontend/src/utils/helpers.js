import { ACCEPTED_FILE_TYPES, ERROR_MESSAGES } from './constants';

// 验证文件类型
export const validateFileType = (file) => {
    const fileName = file.name.toLowerCase();
    return fileName.endsWith(ACCEPTED_FILE_TYPES.DICOM) ||
           fileName.endsWith('.nii') ||
           fileName.endsWith('.nii.gz');
};

// 格式化错误消息
export const formatError = (error) => {
    if (!error) return '';
    
    if (error.response) {
        const { status, data } = error.response;
        
        switch (status) {
            case 400:
                return data.message || ERROR_MESSAGES.SERVER_ERROR;
            case 401:
                return ERROR_MESSAGES.AUTH_ERROR;
            case 404:
                return '请求的资源不存在';
            case 500:
                return ERROR_MESSAGES.SERVER_ERROR;
            default:
                return data.message || ERROR_MESSAGES.SERVER_ERROR;
        }
    }
    
    if (error.request) {
        return ERROR_MESSAGES.NETWORK_ERROR;
    }
    
    return error.message || ERROR_MESSAGES.SERVER_ERROR;
};

// 格式化体积数据（转换为ml）
export const formatVolume = (volumeInMm3) => {
    if (!volumeInMm3 && volumeInMm3 !== 0) return 'N/A';
    return `${(volumeInMm3 / 1000).toFixed(2)} ml`;
};

// 格式化处理状态
export const formatProcessingStatus = (status) => {
    switch (status) {
        case 'uploading':
            return '正在上传';
        case 'uploaded':
            return '上传完成';
        case 'processing':
            return '正在处理';
        case 'completed':
            return '处理完成';
        case 'failed':
            return '处理失败';
        case 'error':
            return '发生错误';
        default:
            return '准备就绪';
    }
};

// 防抖函数
export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// 节流函数
export const throttle = (func, limit) => {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

// 格式化日期
export const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// 生成唯一ID
export const generateId = () => {
    return Math.random().toString(36).substr(2, 9);
};

// 格式化文件大小
export const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// 验证患者数据
export const validatePatientData = (data) => {
    const errors = {};
    
    if (!data.name) {
        errors.name = '请输入姓名';
    }
    
    if (!data.patient_id) {
        errors.patient_id = '请输入患者ID';
    }
    
    if (!data.age) {
        errors.age = '请输入年龄';
    } else if (isNaN(data.age) || data.age <= 0) {
        errors.age = '请输入有效的年龄';
    }
    
    if (!data.gender) {
        errors.gender = '请选择性别';
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
}; 