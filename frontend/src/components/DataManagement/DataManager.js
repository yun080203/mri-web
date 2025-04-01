import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './DataManager.css';
import { Spin } from 'antd';

// 添加API基础URL常量
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

function DataManager() {
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageLoading, setImageLoading] = useState({});

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        setError('未登录或登录已过期');
        return;
      }

      const response = await axios.get(`${API_BASE}/api/patients`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success && Array.isArray(response.data.patients)) {
        setPatients(response.data.patients);
      } else {
        setError('获取患者数据失败：数据格式不正确');
        console.error('API返回数据格式不正确:', response.data);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setError('未登录或登录已过期，请重新登录');
        // 可以在这里添加重定向到登录页面的逻辑
      } else {
        setError('获取患者数据失败');
        console.error('获取患者数据错误:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handlePatientSelect = async (patient) => {
    setSelectedPatient(patient);
    
    // 如果有图像，选择第一个处理完成的图像
    if (patient && patient.images && patient.images.length > 0) {
      const processedImage = patient.images.find(img => img.processed);
      if (processedImage) {
        setSelectedImage(processedImage);
      }
    }
  };

  // 处理图像加载错误
  const handleImageError = async (e, image) => {
    console.error('预览图加载失败:', e);
    
    // 设置图像加载错误状态
    setImageLoading(prev => ({...prev, [image.id]: false}));
    
    // 尝试改用任务ID获取预览
    if (image.task_id) {
      try {
        // 设置加载状态
        setImageLoading(prev => ({ ...prev, [image.id]: true }));
        
        // 尝试使用任务ID获取预览
        const previewUrl = `${API_BASE}/api/preview/${image.task_id}?type=gm`;
        const response = await axios.get(previewUrl, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.data && response.data.status === 'success') {
          // 如果成功获取到预览图，更新DOM
          e.target.src = `data:image/png;base64,${response.data.image}`;
          e.target.onerror = null; // 防止再次触发错误
          
          // 更新加载状态
          setImageLoading(prev => ({ ...prev, [image.id]: false }));
        } else {
          throw new Error('预览API返回了非成功状态');
        }
      } catch (error) {
        console.error('通过任务ID获取预览失败:', error);
        
        // 添加错误提示样式
        e.target.parentNode.classList.add('image-load-error');
        
        // 添加错误提示文本
        if (!e.target.parentNode.querySelector('.error-overlay')) {
          const errorText = document.createElement('div');
          errorText.className = 'error-overlay';
          errorText.innerText = '图像加载失败';
          e.target.parentNode.appendChild(errorText);
        }
        
        setImageLoading(prev => ({ ...prev, [image.id]: false }));
      }
    } else {
      // 添加错误提示样式
      e.target.parentNode.classList.add('image-load-error');
      
      // 添加错误提示文本
      if (!e.target.parentNode.querySelector('.error-overlay')) {
        const errorText = document.createElement('div');
        errorText.className = 'error-overlay';
        errorText.innerText = '图像加载失败';
        e.target.parentNode.appendChild(errorText);
      }
    }
  };
  
  // 处理图像加载成功
  const handleImageLoad = (imageId) => {
    setImageLoading(prev => ({ ...prev, [imageId]: false }));
  };

  const generateReport = async (patientId) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/api/reports/${patientId}`);
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
    patient.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.patient_id?.toLowerCase().includes(searchTerm.toLowerCase())
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
            <p>ID: {patient.patient_id}</p>
            <p>年龄: {patient.age}</p>
            <p>性别: {patient.gender}</p>
            <p>检查日期: {new Date(patient.created_at).toLocaleDateString()}</p>
            <p>图像数: {patient.images?.length || 0}</p>
            <button onClick={(e) => {
              e.stopPropagation();
              generateReport(patient.id);
            }}>生成报告</button>
          </div>
        ))}
      </div>

      {selectedPatient && (
        <div className="patient-details">
          <h2>患者详细信息</h2>
          <div className="details-content">
            <div className="details-info">
              <p><strong>姓名:</strong> {selectedPatient.name}</p>
              <p><strong>患者ID:</strong> {selectedPatient.patient_id}</p>
              <p><strong>年龄:</strong> {selectedPatient.age}</p>
              <p><strong>性别:</strong> {selectedPatient.gender}</p>
              <p><strong>首次检查日期:</strong> {new Date(selectedPatient.created_at).toLocaleDateString()}</p>
            </div>
            
            {selectedImage && selectedImage.processed && selectedImage.gm_volume && (
              <div className="results-section">
                <h3>脑组织体积分析</h3>
                <div className="volume-data">
                  <div className="volume-item gm-item">
                    <div className="volume-icon">
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="#1890ff">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                      </svg>
                    </div>
                    <div className="volume-content">
                      <div className="volume-label">灰质体积</div>
                      <div className="volume-value">
                        {(selectedImage.gm_volume / 1000).toFixed(2)}
                        <span className="volume-unit">ml</span>
                        <span className="volume-percent">
                          ({(selectedImage.gm_volume / selectedImage.tiv_volume * 100).toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="volume-item wm-item">
                    <div className="volume-icon">
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="#faad14">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                      </svg>
                    </div>
                    <div className="volume-content">
                      <div className="volume-label">白质体积</div>
                      <div className="volume-value">
                        {(selectedImage.wm_volume / 1000).toFixed(2)}
                        <span className="volume-unit">ml</span>
                        <span className="volume-percent">
                          ({(selectedImage.wm_volume / selectedImage.tiv_volume * 100).toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="volume-item csf-item">
                    <div className="volume-icon">
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="#52c41a">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                      </svg>
                    </div>
                    <div className="volume-content">
                      <div className="volume-label">脑脊液体积</div>
                      <div className="volume-value">
                        {(selectedImage.csf_volume / 1000).toFixed(2)}
                        <span className="volume-unit">ml</span>
                        <span className="volume-percent">
                          ({(selectedImage.csf_volume / selectedImage.tiv_volume * 100).toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="volume-item tiv-item">
                    <div className="volume-icon">
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="#722ed1">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                      </svg>
                    </div>
                    <div className="volume-content">
                      <div className="volume-label">总颅内体积</div>
                      <div className="volume-value">
                        {(selectedImage.tiv_volume / 1000).toFixed(2)}
                        <span className="volume-unit">ml</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="volume-chart">
                  <div className="chart-bars">
                    <div 
                      className="chart-bar gm-bar" 
                      style={{width: `${(selectedImage.gm_volume / selectedImage.tiv_volume * 100).toFixed(1)}%`}}
                    ></div>
                    <div 
                      className="chart-bar wm-bar" 
                      style={{width: `${(selectedImage.wm_volume / selectedImage.tiv_volume * 100).toFixed(1)}%`}}
                    ></div>
                    <div 
                      className="chart-bar csf-bar" 
                      style={{width: `${(selectedImage.csf_volume / selectedImage.tiv_volume * 100).toFixed(1)}%`}}
                    ></div>
                  </div>
                  <div className="chart-legend">
                    <div className="legend-item">
                      <div className="legend-color gm-color"></div>
                      <div>灰质</div>
                    </div>
                    <div className="legend-item">
                      <div className="legend-color wm-color"></div>
                      <div>白质</div>
                    </div>
                    <div className="legend-item">
                      <div className="legend-color csf-color"></div>
                      <div>脑脊液</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {selectedImage && selectedImage.processed && selectedImage.task_id && (
              <div className="processed-images">
                <h3>分割结果</h3>
                <div className="images-grid">
                  <div className="image-item">
                    <h5>灰质 (GM)</h5>
                    {imageLoading[selectedImage.id] ? (
                      <div className="image-loading">
                        <Spin tip="正在加载图像..." />
                      </div>
                    ) : (
                      <img
                        src={`${API_BASE}/api/preview/${selectedImage.task_id}?type=gm`}
                        alt="灰质分割结果"
                        className="preview-image"
                        crossOrigin="anonymous"
                        onError={(e) => handleImageError(e, selectedImage)}
                        onLoad={() => handleImageLoad(selectedImage.id)}
                      />
                    )}
                  </div>
                  <div className="image-item">
                    <h5>白质 (WM)</h5>
                    <img
                      src={`${API_BASE}/api/preview/${selectedImage.task_id}?type=wm`}
                      alt="白质分割结果"
                      className="preview-image"
                      crossOrigin="anonymous"
                      onError={(e) => handleImageError(e, selectedImage)}
                    />
                  </div>
                  <div className="image-item">
                    <h5>脑脊液 (CSF)</h5>
                    <img
                      src={`${API_BASE}/api/preview/${selectedImage.task_id}?type=csf`}
                      alt="脑脊液分割结果"
                      className="preview-image"
                      crossOrigin="anonymous"
                      onError={(e) => handleImageError(e, selectedImage)}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {(!selectedImage || !selectedImage.processed) && (
              <div className="no-volume-data">
                <p>暂无体积数据分析结果</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DataManager; 