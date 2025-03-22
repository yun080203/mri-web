import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import '../../styles/Auth.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

function Login({ onLogin }) {
    const [formData, setFormData] = useState({
        username: '',
        password: ''
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

        try {
            const response = await axios.post(`${API_BASE}/api/login`, formData);
            
            if (response.data.access_token) {
                localStorage.setItem('token', response.data.access_token);
                axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`;
                onLogin(response.data.user);
                navigate('/');
            }
        } catch (error) {
            setError(error.response?.data?.error || '登录失败，请重试');
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-box">
                <h2>登录</h2>
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
                    <button type="submit">登录</button>
                </form>
                <div className="auth-links">
                    <p>还没有账号？ <Link to="/register">立即注册</Link></p>
                </div>
            </div>
        </div>
    );
}

export default Login; 