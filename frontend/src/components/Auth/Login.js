import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Login.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

function Login({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            console.log('尝试登录:', {
                url: `${API_BASE}/api/auth/login`,
                data: { username, password }
            });

            // 创建axios实例
            const loginAxios = axios.create({
                baseURL: API_BASE,
                timeout: 5000, // 减少超时时间到5秒
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            const response = await loginAxios.post('/api/auth/login', {
                username,
                password
            });

            console.log('登录响应:', response);

            if (response.data.token) {
                localStorage.setItem('token', response.data.token);
                onLogin(response.data.user);
                navigate('/');
            } else {
                throw new Error('登录响应中没有token');
            }
        } catch (error) {
            console.error('登录失败:', error);
            let errorMessage = '登录失败，请重试';
            
            if (error.response) {
                console.error('错误响应:', error.response);
                errorMessage = error.response.data?.error || errorMessage;
            } else if (error.code === 'ECONNABORTED') {
                console.error('请求超时');
                errorMessage = '服务器响应超时，请检查后端服务是否正常运行';
            } else if (error.request) {
                console.error('未收到响应:', error.request);
                errorMessage = '无法连接到服务器，请检查网络连接和后端服务';
            } else {
                console.error('请求错误:', error.message);
                errorMessage = error.message;
            }
            
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <h2>登录</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>用户名</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="请输入用户名"
                            required
                            disabled={loading}
                        />
                    </div>
                    <div className="form-group">
                        <label>密码</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="请输入密码"
                            required
                            disabled={loading}
                        />
                    </div>
                    {error && <div className="error-message">{error}</div>}
                    <button 
                        type="submit" 
                        disabled={loading}
                        className={loading ? 'loading' : ''}
                    >
                        {loading ? '登录中...' : '登录'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Login; 