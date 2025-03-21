import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './DataManager.css';

function DataManager() {
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:5000/api/patients');
      setPatients(response.data);
    } catch (err) {
      setError('获取患者数据失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
  };

  const generateReport = async (patientId) => {
    try {
      setLoading(true);
      const response = await axios.get(`http://localhost:5000/api/reports/${patientId}`);
      // 处理报告下载
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${patientId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('生成报告失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="data-manager">
      <div className="search-section">
        <input
          type="text"
          placeholder="搜索患者姓名或ID..."
          value={searchTerm}
          onChange={handleSearch}
        />
      </div>

      {loading && <div className="loading">加载中...</div>}
      {error && <div className="error">{error}</div>}

      <div className="patients-list">
        {filteredPatients.map(patient => (
          <div
            key={patient.id}
            className={`patient-card ${selectedPatient?.id === patient.id ? 'selected' : ''}`}
            onClick={() => handlePatientSelect(patient)}
          >
            <h3>{patient.name}</h3>
            <p>ID: {patient.id}</p>
            <p>检查日期: {new Date(patient.check_date).toLocaleDateString()}</p>
            <p>病变区域大小: {patient.lesion_volume} mm³</p>
            <button onClick={() => generateReport(patient.id)}>生成报告</button>
          </div>
        ))}
      </div>

      {selectedPatient && (
        <div className="patient-details">
          <h2>患者详细信息</h2>
          <div className="details-content">
            <p><strong>姓名:</strong> {selectedPatient.name}</p>
            <p><strong>ID:</strong> {selectedPatient.id}</p>
            <p><strong>检查日期:</strong> {new Date(selectedPatient.check_date).toLocaleDateString()}</p>
            <p><strong>病变区域大小:</strong> {selectedPatient.lesion_volume} mm³</p>
            <div className="tissue-stats">
              <h3>组织统计</h3>
              <p>灰质: {selectedPatient.tissue_stats?.gray_matter}%</p>
              <p>白质: {selectedPatient.tissue_stats?.white_matter}%</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataManager; 