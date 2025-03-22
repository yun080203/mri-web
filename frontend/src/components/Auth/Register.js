import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
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
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('两次输入的密码不一致');
            return;
        }

        try {
            console.log('正在发送注册请求到:', `${API_BASE}/api/register`);
            console.log('注册数据:', {
                username: formData.username,
                email: formData.email,
                password: formData.password
            });
            
            const response = await axios.post(`${API_BASE}/api/register`, {
                username: formData.username,
                email: formData.email,
                password: formData.password
            });

            console.log('注册响应:', response.data);

            if (response.data.message) {
                navigate('/login');
            }
        } catch (error) {
            console.error('注册错误:', error);
            console.error('错误响应:', error.response?.data);
            setError(error.response?.data?.error || '注册失败，请重试');
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-box">
                <h2>注册</h2>
                {error && <div className="error-message">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="username">用户名</label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="email">邮箱</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">密码</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="confirmPassword">确认密码</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <button type="submit">注册</button>
                </form>
                <div className="auth-links">
                    <p>已有账号？ <Link to="/login">立即登录</Link></p>
                </div>
            </div>
        </div>
    );
}

export default Register; 