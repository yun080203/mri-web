import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, Link, useNavigate } from 'react-router-dom';
import '../../styles/Patient.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

function PatientDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchPatientDetails();
    }, [id]);

    const fetchPatientDetails = async () => {
        try {
            setLoading(true);
            setError('');
            
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
                setPatient(response.data.patient);
            } else {
                setError('获取患者数据失败');
            }
        } catch (error) {
            console.error('获取患者详情失败:', error);
            if (error.response?.status === 401) {
                navigate('/login');
            } else if (error.response?.status === 404) {
                setError('未找到患者信息');
            } else {
                setError(error.response?.data?.error || '获取患者详情失败');
            }
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading">加载中...</div>;
    if (error) return <div className="error-message">{error}</div>;
    if (!patient) return <div className="error-message">未找到患者信息</div>;

    return (
        <div className="patient-detail-container">
            <div className="patient-detail-header">
                <h2>患者详情</h2>
                <div className="patient-actions">
                    <Link to="/patients" className="back-button">
                        返回列表
                    </Link>
                    <Link to={`/patients/${patient.id}/edit`} className="edit-button">
                        编辑信息
                    </Link>
                    <Link to={`/upload?patient_id=${patient.id}`} className="upload-button">
                        上传新图像
                    </Link>
                </div>
            </div>

            <div className="patient-info-section">
                <h3>基本信息</h3>
                <div className="info-grid">
                    <div className="info-item">
                        <label>姓名</label>
                        <span>{patient.name}</span>
                    </div>
                    <div className="info-item">
                        <label>患者ID</label>
                        <span>{patient.patient_id}</span>
                    </div>
                    <div className="info-item">
                        <label>年龄</label>
                        <span>{patient.age}</span>
                    </div>
                    <div className="info-item">
                        <label>性别</label>
                        <span>{patient.gender}</span>
                    </div>
                    <div className="info-item">
                        <label>首次检查日期</label>
                        <span>{new Date(patient.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>

            <div className="patient-images">
                <h2>检查记录</h2>
                {patient.images && patient.images.length > 0 ? (
                    <div className="images-grid">
                        {patient.images.map((image) => (
                            <div key={image.id} className="image-card">
                                <div className="image-info">
                                    <p>上传时间: {new Date(image.created_at).toLocaleString()}</p>
                                    <p>状态: {image.processed ? '已处理' : '未处理'}</p>
                                    {image.processing_completed && (
                                        <p>处理完成时间: {new Date(image.processing_completed).toLocaleString()}</p>
                                    )}
                                </div>
                                <div className="image-preview">
                                    <img src={`http://localhost:5000/api/preview/${image.id}`} alt="MRI预览" />
                                </div>
                                {image.processed && (
                                    <div className="volume-data">
                                        <h3>体积分析结果</h3>
                                        <div className="volume-grid">
                                            <div className="volume-item">
                                                <label>灰质体积</label>
                                                <span>{image.gm_volume ? (image.gm_volume / 1000).toFixed(2) + ' ml' : 'N/A'}</span>
                                            </div>
                                            <div className="volume-item">
                                                <label>白质体积</label>
                                                <span>{image.wm_volume ? (image.wm_volume / 1000).toFixed(2) + ' ml' : 'N/A'}</span>
                                            </div>
                                            <div className="volume-item">
                                                <label>脑脊液体积</label>
                                                <span>{image.csf_volume ? (image.csf_volume / 1000).toFixed(2) + ' ml' : 'N/A'}</span>
                                            </div>
                                            <div className="volume-item">
                                                <label>总颅内体积</label>
                                                <span>{image.tiv_volume ? (image.tiv_volume / 1000).toFixed(2) + ' ml' : 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {image.processing_error && (
                                    <div className="error-message">
                                        处理失败: {image.processing_error}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p>暂无图像记录</p>
                )}
            </div>
        </div>
    );
}

export default PatientDetail; 