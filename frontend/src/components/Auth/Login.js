import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { axiosInstance } from '../../App';  // 导入配置好的 axiosInstance
import './Auth.css';

const Login = ({ onLogin }) => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: ''
    });
    const [loginMethod, setLoginMethod] = useState('username'); // 'username' or 'email'
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
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
        setLoading(true);

        try {
            console.log('尝试登录:', {
                url: '/api/auth/login',
                data: {
                    ...(loginMethod === 'username' ? { username: formData.username } : { email: formData.email }),
                    password: formData.password
                }
            });

            const response = await axiosInstance.post('/api/auth/login', {
                ...(loginMethod === 'username' ? { username: formData.username } : { email: formData.email }),
                password: formData.password
            });
            
            if (response.data.success) {
                localStorage.setItem('token', response.data.token);
                if (onLogin) {
                    onLogin(response.data.user);
                }
                navigate('/');
            } else {
                throw new Error(response.data.error || '登录失败');
            }
        } catch (error) {
            console.error('登录失败:', error);
            
            let errorMessage = '登录失败，请重试';
            
            if (error.code === 'ECONNABORTED') {
                errorMessage = '请求超时，请检查网络连接或稍后重试';
            } else if (error.response) {
                errorMessage = error.response.data?.error || '用户名或密码错误';
            } else if (error.request) {
                errorMessage = '无法连接到服务器，请检查网络连接';
            }
            
            setError(errorMessage);
            console.error('错误详情:', {
                code: error.code,
                message: error.message,
                response: error.response?.data
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-box">
                <h2>登录</h2>
                <div className="login-method-selector">
                    <button
                        type="button"
                        className={loginMethod === 'username' ? 'active' : ''}
                        onClick={() => setLoginMethod('username')}
                    >
                        使用用户名
                    </button>
                    <button
                        type="button"
                        className={loginMethod === 'email' ? 'active' : ''}
                        onClick={() => setLoginMethod('email')}
                    >
                        使用邮箱
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    {loginMethod === 'username' ? (
                        <div className="form-group">
                            <label>用户名</label>
                            <input
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    ) : (
                        <div className="form-group">
                            <label>邮箱</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    )}
                    <div className="form-group">
                        <label>密码</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    {error && <div className="error-message">{error}</div>}
                    <button 
                        type="submit" 
                        className={`auth-button ${loading ? 'loading' : ''}`}
                        disabled={loading}
                    >
                        {loading ? '登录中...' : '登录'}
                    </button>
                </form>
                <p className="auth-link">
                    还没有账号？ <Link to="/register">立即注册</Link>
                </p>
            </div>
        </div>
    );
};

export default Login; 