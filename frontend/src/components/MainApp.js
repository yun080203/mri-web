import React, { useReducer, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './MainApp.css';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

// 创建 axios 实例
const axiosInstance = axios.create({
    baseURL: API_BASE,
    timeout: 10000,
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
            delete axiosInstance.defaults.headers.common['Authorization'];
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

const MainApp = ({ user, onLogout }) => {
    const [authState, authDispatch] = useReducer(authReducer, {
        isAuthenticated: !!localStorage.getItem('token'),
        user: user
    });
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [patients, setPatients] = useState([]);

    // 获取患者列表
    useEffect(() => {
        const fetchPatients = async () => {
            try {
                setLoading(true);
                const token = localStorage.getItem('token');
                if (!token) {
                    throw new Error('未找到认证令牌');
                }
                
                const response = await axiosInstance.get('/api/patients');
                setPatients(response.data.patients);
            } catch (error) {
                console.error('获取患者列表失败:', error);
                if (error.response?.status === 401) {
                    localStorage.removeItem('token');
                    delete axiosInstance.defaults.headers.common['Authorization'];
                    if (onLogout) {
                        onLogout();
                    }
                    navigate('/login', { replace: true });
                }
            } finally {
                setLoading(false);
            }
        };

        if (authState.isAuthenticated) {
            fetchPatients();
        }
    }, [authState.isAuthenticated, navigate, onLogout]);

    // 处理登出
    const handleLogout = () => {
        localStorage.removeItem('token');
        delete axiosInstance.defaults.headers.common['Authorization'];
        if (onLogout) {
            onLogout();
        }
        navigate('/login', { replace: true });
    };

    return (
        <div className="main-app">
            <nav className="main-nav">
                <Link to="/" className="nav-brand">MRI图像处理系统</Link>
                <div className="nav-links">
                    <Link to="/">首页</Link>
                    <Link to="/patients">患者管理</Link>
                    <Link to="/upload">图像上传</Link>
                    <Link to="/data">数据分析</Link>
                    <button onClick={handleLogout} className="logout-btn">退出登录</button>
                </div>
            </nav>
            <main className="main-content">
                <div className="home-page">
                    <h1>MRI图像处理系统</h1>
                    <div className="feature-grid">
                        <Link to="/patients" className="feature-card">
                            <h3>患者管理</h3>
                            <p>管理患者信息，查看患者历史记录</p>
                        </Link>
                        <Link to="/upload" className="feature-card">
                            <h3>图像上传</h3>
                            <p>上传MRI图像，进行预处理</p>
                        </Link>
                        <Link to="/data" className="feature-card">
                            <h3>数据分析</h3>
                            <p>查看分析结果，对比处理前后的图像</p>
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default MainApp; 