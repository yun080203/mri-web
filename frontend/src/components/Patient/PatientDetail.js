import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import '../../styles/Patient.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

function PatientDetail() {
    const { id } = useParams();
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchPatientDetails();
    }, [id]);

    const fetchPatientDetails = async () => {
        try {
            const response = await axios.get(`${API_BASE}/api/patients/${id}`);
            setPatient(response.data.patient);
            setLoading(false);
        } catch (error) {
            setError('获取患者详情失败');
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

            <div className="patient-images-section">
                <h3>检查记录</h3>
                {patient.images.length === 0 ? (
                    <p className="no-data">暂无检查记录</p>
                ) : (
                    <div className="images-grid">
                        {patient.images.map(image => (
                            <div key={image.id} className="image-card">
                                <div className="image-info">
                                    <p><strong>检查日期：</strong>{new Date(image.check_date).toLocaleDateString()}</p>
                                    <p><strong>病变体积：</strong>{image.lesion_volume ? `${image.lesion_volume.toFixed(2)} mm³` : '未计算'}</p>
                                </div>
                                <div className="image-actions">
                                    <Link to={`/compare?image_id=${image.id}`} className="view-button">
                                        查看图像
                                    </Link>
                                    <Link to={`/data?image_id=${image.id}`} className="data-button">
                                        查看数据
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default PatientDetail; 