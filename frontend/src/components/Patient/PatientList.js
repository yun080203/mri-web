import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import '../../styles/Patient.css';
import { message } from 'antd';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

function PatientList() {
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchPatients();
    }, []);

    const fetchPatients = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }

            const response = await axios.get(`${API_BASE}/api/patients`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            if (response.data && Array.isArray(response.data.patients)) {
                setPatients(response.data.patients);
            }
            setLoading(false);
        } catch (error) {
            console.error('获取患者列表失败:', error);
            setError('获取患者列表失败');
            setLoading(false);
            if (error.response?.status === 401) {
                navigate('/login');
            }
        }
    };

    const handleDelete = async (patientId) => {
        try {
            console.log('开始删除患者:', patientId);
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('未找到token');
                message.error('请先登录');
                return;
            }

            console.log('发送删除请求...');
            const response = await axios.delete(`${API_BASE}/api/patients/${patientId}/delete`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            console.log('收到响应:', response.status);
            console.log('响应数据:', response.data);

            if (response.data.success) {
                console.log('删除成功，刷新列表...');
                message.success('患者删除成功');
                // 关闭确认对话框
                setDeleteConfirm(null);
                // 刷新患者列表
                await fetchPatients();
            } else {
                console.error('删除失败:', response.data.error);
                message.error(response.data.error || '删除失败');
                // 关闭确认对话框
                setDeleteConfirm(null);
            }
        } catch (error) {
            console.error('删除患者失败:', error);
            if (error.response?.status === 401) {
                navigate('/login');
            } else {
                message.error(error.response?.data?.error || '删除失败，请重试');
            }
            // 关闭确认对话框
            setDeleteConfirm(null);
        }
    };

    const filteredPatients = patients.filter(patient =>
        patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.patient_id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="patient-list-container">
            <div className="patient-list-header">
                <h2>患者管理</h2>
                <div className="search-box">
                    <input
                        type="text"
                        placeholder="搜索患者..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading && <div className="loading">加载中...</div>}
            {error && <div className="error-message">{error}</div>}

            <div className="patient-grid">
                {filteredPatients.map(patient => (
                    <div key={patient.id} className="patient-card">
                        <h3>{patient.name}</h3>
                        <div className="patient-info">
                            <p><strong>患者ID：</strong>{patient.patient_id}</p>
                            <p><strong>年龄：</strong>{patient.age}</p>
                            <p><strong>性别：</strong>{patient.gender}</p>
                            <p><strong>检查次数：</strong>{patient.images?.length || 0}</p>
                            <p><strong>首次检查：</strong>{new Date(patient.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="patient-actions">
                            <Link to={`/patients/${patient.id}`} className="view-button">
                                查看详情
                            </Link>
                            <Link to={`/patients/${patient.id}/edit`} className="edit-button">
                                编辑
                            </Link>
                            <Link to={`/upload?patient_id=${patient.id}`} className="upload-button">
                                上传新图像
                            </Link>
                            <button
                                className="delete-button"
                                onClick={() => setDeleteConfirm(patient.id)}
                            >
                                删除
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="patient-list-footer">
                <Link to="/patients/new" className="add-patient-button">
                    添加新患者
                </Link>
            </div>

            {/* 删除确认对话框 */}
            {deleteConfirm && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>确认删除</h3>
                        <p>您确定要删除这个患者吗？此操作不可撤销。</p>
                        <div className="modal-actions">
                            <button
                                className="confirm-button"
                                onClick={() => handleDelete(deleteConfirm)}
                            >
                                确认删除
                            </button>
                            <button
                                className="cancel-button"
                                onClick={() => setDeleteConfirm(null)}
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PatientList; 