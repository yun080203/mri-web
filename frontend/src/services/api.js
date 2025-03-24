import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

// 创建axios实例
const axiosInstance = axios.create({
    baseURL: API_BASE,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

// 请求拦截器
axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// 响应拦截器
axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// 图像相关API
export const imageAPI = {
    // 上传图像
    uploadImage: (file, patientId) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('patient_id', patientId);
        return axiosInstance.post('/api/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
    },

    // 获取预览图
    getPreview: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return axiosInstance.post('/api/preview', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
    },

    // 处理图像
    processImage: (imageId) => {
        return axiosInstance.post(`/api/process/${imageId}`);
    },

    // 获取任务状态
    getTaskStatus: (taskId) => {
        return axiosInstance.get(`/api/tasks/${taskId}`);
    },

    // 获取处理后的图像
    getProcessedImage: (taskId, filename) => {
        return axiosInstance.get(`/api/processed/${taskId}/${filename}`);
    }
};

// 患者相关API
export const patientAPI = {
    // 获取患者列表
    getPatients: () => {
        return axiosInstance.get('/api/patients');
    },

    // 创建新患者
    createPatient: (patientData) => {
        return axiosInstance.post('/api/patients', patientData);
    },

    // 获取患者详情
    getPatientDetail: (patientId) => {
        return axiosInstance.get(`/api/patients/${patientId}`);
    }
};

// 认证相关API
export const authAPI = {
    // 登录
    login: (credentials) => {
        return axiosInstance.post('/api/auth/login', credentials);
    },

    // 注册
    register: (userData) => {
        return axiosInstance.post('/api/auth/register', userData);
    }
};

export default axiosInstance; 