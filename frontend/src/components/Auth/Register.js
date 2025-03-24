import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import '../../styles/Auth.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

function Register() {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // 验证密码
        if (formData.password !== formData.confirmPassword) {
            setError('两次输入的密码不一致');
            return;
        }

        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setError('请输入有效的邮箱地址');
            return;
        }

        setLoading(true);

        try {
            // 准备要发送的数据
            const registerData = {
                username: formData.username,
                email: formData.email,
                password: formData.password
            };

            // 详细的调试日志
            console.log('准备发送的注册数据:', {
                url: `${API_BASE}/api/auth/register`,
                data: {
                    ...registerData,
                    password: '***' // 出于安全考虑不显示密码
                }
            });

            // 创建axios实例并设置headers
            const registerAxios = axios.create({
                baseURL: API_BASE,
                timeout: 5000,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            const response = await registerAxios.post('/api/auth/register', registerData);
            console.log('注册响应:', response.data);

            if (response.data.success) {
                alert('注册成功！请登录');
                navigate('/login');
            } else {
                setError('注册失败：' + (response.data.error || '未知错误'));
            }
        } catch (error) {
            console.error('注册错误:', error.response?.data || error);
            setError(error.response?.data?.error || '注册失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-box">
                <h2>注册</h2>
                {error && <div className="error-message">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>用户名</label>
                        <input
                            type="text"
                            value={formData.username}
                            onChange={(e) => setFormData({...formData, username: e.target.value})}
                            placeholder="请输入用户名"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>邮箱</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                            placeholder="请输入邮箱"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>密码</label>
                        <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({...formData, password: e.target.value})}
                            placeholder="请输入密码"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>确认密码</label>
                        <input
                            type="password"
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                            placeholder="请再次输入密码"
                            required
                        />
                    </div>
                    <button type="submit" disabled={loading}>
                        {loading ? '注册中...' : '注册'}
                    </button>
                </form>
                <p className="auth-link">
                    已有账号？ <Link to="/login">立即登录</Link>
                </p>
            </div>
        </div>
    );
}

export default Register; 