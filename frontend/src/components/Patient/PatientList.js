import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import '../../styles/Patient.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

function PatientList() {
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchPatients();
    }, []);

    const fetchPatients = async () => {
        try {
            const response = await axios.get(`${API_BASE}/api/patients`);
            setPatients(response.data.patients);
            setLoading(false);
        } catch (error) {
            setError('获取患者列表失败');
            setLoading(false);
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
                            <p><strong>检查次数：</strong>{patient.image_count}</p>
                            <p><strong>首次检查：</strong>{new Date(patient.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="patient-actions">
                            <Link to={`/patients/${patient.id}`} className="view-button">
                                查看详情
                            </Link>
                            <Link to={`/upload?patient_id=${patient.id}`} className="upload-button">
                                上传新图像
                            </Link>
                        </div>
                    </div>
                ))}
            </div>

            <div className="add-patient-section">
                <Link to="/patients/new" className="add-patient-button">
                    添加新患者
                </Link>
            </div>
        </div>
    );
}

export default PatientList; 