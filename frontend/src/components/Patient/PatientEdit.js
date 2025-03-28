import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import '../../styles/Patient.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

function PatientEdit() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        patient_id: '',
        age: '',
        gender: ''
    });
    const [validationErrors, setValidationErrors] = useState({});

    useEffect(() => {
        if (id && id !== 'new') {
            fetchPatientData();
        } else {
            setLoading(false);
        }
    }, [id]);

    const fetchPatientData = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }

            const response = await axios.get(`${API_BASE}/api/patients/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.success && response.data.patient) {
                const patient = response.data.patient;
                setFormData({
                    name: patient.name,
                    patient_id: patient.patient_id,
                    age: patient.age,
                    gender: patient.gender
                });
                setLoading(false);
            } else {
                setError('获取患者数据失败');
                setLoading(false);
            }
        } catch (error) {
            console.error('获取患者数据失败:', error);
            setError('获取患者数据失败');
            setLoading(false);
            if (error.response?.status === 401) {
                navigate('/login');
            }
        }
    };

    const validateForm = () => {
        const errors = {};
        if (!formData.name.trim()) {
            errors.name = '姓名不能为空';
        }
        if (!formData.patient_id.trim()) {
            errors.patient_id = '患者ID不能为空';
        }
        if (!formData.age) {
            errors.age = '年龄不能为空';
        } else if (isNaN(formData.age) || formData.age < 0 || formData.age > 150) {
            errors.age = '请输入有效的年龄';
        }
        if (!formData.gender) {
            errors.gender = '请选择性别';
        }
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }

            let response;
            if (id === 'new' || !id) {
                response = await axios.post(
                    `${API_BASE}/api/patients`,
                    formData,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
            } else {
                response = await axios.put(
                    `${API_BASE}/api/patients/${id}`,
                    formData,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
            }

            if (response.data.success) {
                navigate('/patients');
            }
        } catch (error) {
            console.error('保存患者信息失败:', error);
            setError(error.response?.data?.error || '保存患者信息失败');
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // 清除对应字段的验证错误
        if (validationErrors[name]) {
            setValidationErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    if (loading) return <div className="loading">加载中...</div>;
    if (error) return <div className="error-message">{error}</div>;

    return (
        <div className="patient-edit-container">
            <h2>{id ? '编辑患者信息' : '添加新患者'}</h2>
            <form onSubmit={handleSubmit} className="patient-form">
                <div className="form-group">
                    <label htmlFor="name">姓名</label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className={validationErrors.name ? 'error' : ''}
                    />
                    {validationErrors.name && (
                        <span className="error-message">{validationErrors.name}</span>
                    )}
                </div>

                <div className="form-group">
                    <label htmlFor="patient_id">患者ID</label>
                    <input
                        type="text"
                        id="patient_id"
                        name="patient_id"
                        value={formData.patient_id}
                        onChange={handleChange}
                        className={validationErrors.patient_id ? 'error' : ''}
                    />
                    {validationErrors.patient_id && (
                        <span className="error-message">{validationErrors.patient_id}</span>
                    )}
                </div>

                <div className="form-group">
                    <label htmlFor="age">年龄</label>
                    <input
                        type="number"
                        id="age"
                        name="age"
                        value={formData.age}
                        onChange={handleChange}
                        className={validationErrors.age ? 'error' : ''}
                    />
                    {validationErrors.age && (
                        <span className="error-message">{validationErrors.age}</span>
                    )}
                </div>

                <div className="form-group">
                    <label htmlFor="gender">性别</label>
                    <select
                        id="gender"
                        name="gender"
                        value={formData.gender}
                        onChange={handleChange}
                        className={validationErrors.gender ? 'error' : ''}
                    >
                        <option value="">请选择</option>
                        <option value="男">男</option>
                        <option value="女">女</option>
                    </select>
                    {validationErrors.gender && (
                        <span className="error-message">{validationErrors.gender}</span>
                    )}
                </div>

                <div className="form-actions">
                    <button type="submit" className="submit-button">
                        {id ? '保存修改' : '添加患者'}
                    </button>
                    <button
                        type="button"
                        className="cancel-button"
                        onClick={() => navigate('/patients')}
                    >
                        取消
                    </button>
                </div>
            </form>
        </div>
    );
}

export default PatientEdit; 