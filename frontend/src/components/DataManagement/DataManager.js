import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './DataManager.css';
import { Spin, message } from 'antd';

// 添加API基础URL常量
const API_BASE_URL = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

function DataManager() {
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageLoading, setImageLoading] = useState({});
  const [segmentationImages, setSegmentationImages] = useState({
    gm: null,
    wm: null,
    csf: null
  });

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

      const response = await axios.get(`${API_BASE_URL}/api/patients`, {
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
    
    // 重置状态
    setSegmentationImages({
      gm: null,
      wm: null,
      csf: null
    });
    
    // 如果有图像，选择第一个处理完成的图像
    if (patient && patient.images && patient.images.length > 0) {
      const processedImage = patient.images.find(img => img.processed);
      if (processedImage) {
        console.log(`选择处理完成的图像：ID=${processedImage.id}, 任务ID=${processedImage.task_id || '无'}`);
        setSelectedImage(processedImage);
      } else {
        setSelectedImage(null);
      }
    } else {
      setSelectedImage(null);
    }
  };

  // 处理图像加载错误
  const handleImageError = async (e, image, imageType = 'gm') => {
    console.error('预览图加载失败:', e);
    
    // 设置相应图像类型的加载状态
    const loadingKey = `${image.id}_${imageType}`;
    setImageLoading(prev => ({...prev, [loadingKey]: true}));
    
    // 直接使用axios获取base64编码的图像数据
    if (image.task_id) {
      try {
        console.log(`使用axios直接获取base64数据: ${image.task_id}, 类型: ${imageType}`);
        const previewUrl = `${API_BASE_URL}/api/preview/${image.task_id}?type=${imageType}`;
        
        const response = await axios.get(previewUrl, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Accept': 'application/json'
          }
        });
        
        console.log('预览API响应状态:', response.status);
        
        if (response.data && response.data.status === 'success' && response.data.image) {
          // 成功获取base64图像数据
          console.log(`成功获取base64图像数据，长度: ${response.data.image.length}`);
          const imgSrc = `data:image/png;base64,${response.data.image}`;
          e.target.src = imgSrc;
          e.target.onerror = null; // 防止再次触发错误
          
          // 移除错误样式（如果有）
          const parent = e.target.parentNode;
          if (parent) {
            parent.classList.remove('image-load-error');
            const errorOverlay = parent.querySelector('.error-overlay');
            if (errorOverlay) {
              parent.removeChild(errorOverlay);
            }
          }
        } else {
          throw new Error('预览API返回了非成功状态或无图像数据');
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
      } finally {
        setImageLoading(prev => ({ ...prev, [loadingKey]: false }));
      }
    } else {
      // 添加错误提示样式
      e.target.parentNode.classList.add('image-load-error');
      
      // 添加错误提示文本
      if (!e.target.parentNode.querySelector('.error-overlay')) {
        const errorText = document.createElement('div');
        errorText.className = 'error-overlay';
        errorText.innerText = '图像加载失败 (无task_id)';
        e.target.parentNode.appendChild(errorText);
      }
      
      setImageLoading(prev => ({ ...prev, [loadingKey]: false }));
    }
  };
  
  // 处理图像加载成功
  const handleImageLoad = (imageId, imageType = '') => {
    const loadingKey = imageType ? `${imageId}_${imageType}` : imageId;
    setImageLoading(prev => ({ ...prev, [loadingKey]: false }));
  };

  // 当选择新图像时，加载分割图像
  useEffect(() => {
    if (selectedImage && selectedImage.processed && selectedImage.task_id) {
      // 重置状态
      setSegmentationImages({
        gm: null,
        wm: null,
        csf: null
      });
      
      // 设置加载状态
      setImageLoading({
        [`${selectedImage.id}_gm`]: true,
        [`${selectedImage.id}_wm`]: true,
        [`${selectedImage.id}_csf`]: true
      });

      // 异步加载所有分割图像
      const loadImages = async () => {
        if (!selectedImage || !selectedImage.task_id) {
          console.log('未选择图像或图像没有关联的任务ID');
          return;
        }
        
        try {
          console.log(`开始加载图像，任务ID: ${selectedImage.task_id}`);
          
          // 设置所有图像为加载中状态
          setImageLoading({
            [`${selectedImage.id}_gm`]: true,
            [`${selectedImage.id}_wm`]: true,
            [`${selectedImage.id}_csf`]: true
          });
          
          const gmPromise = fetchSegmentationImage(selectedImage.task_id, 'gm');
          const wmPromise = fetchSegmentationImage(selectedImage.task_id, 'wm');
          const csfPromise = fetchSegmentationImage(selectedImage.task_id, 'csf');
          
          const [gm, wm, csf] = await Promise.all([gmPromise, wmPromise, csfPromise]);
          
          setSegmentationImages({ gm, wm, csf });
          console.log('所有分割图像加载完成', { gm: !!gm, wm: !!wm, csf: !!csf });
        } catch (error) {
          console.error('加载分割图像时出错:', error);
          message.error('加载分割图像失败');
        } finally {
          // 设置所有图像加载完成
          setImageLoading({
            [`${selectedImage.id}_gm`]: false,
            [`${selectedImage.id}_wm`]: false,
            [`${selectedImage.id}_csf`]: false
          });
        }
      };
      
      loadImages();
    }
  }, [selectedImage]);

  // 获取分割图像
  const fetchSegmentationImage = async (taskId, type) => {
    if (!taskId) {
      console.error(`无法获取${type}图像：缺少task_id`);
      return null;
    }

    console.log(`尝试获取分割图像，taskId: ${taskId}, 类型: ${type}`);
    
    // 定义重试次数和延迟
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/preview/${taskId}?type=${type}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        console.log(`API响应状态: ${response.status}, 内容类型: ${response.headers.get('content-type')}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`获取${type}图像失败: ${response.status} - ${errorText}`);
          retryCount++;
          if (retryCount < maxRetries) {
            console.log(`重试 (${retryCount}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            continue;
          }
          return null;
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          console.log(`成功获取${type}图像数据`, data);
          
          if (data.status === 'success' && data.image) {
            return `data:image/png;base64,${data.image}`;
          } else {
            console.error(`图像数据格式错误:`, data);
            return null;
          }
        } else {
          console.error(`响应不是JSON格式: ${contentType}`);
          const text = await response.text();
          console.error(`响应内容: ${text.substring(0, 100)}...`);
          return null;
        }
      } catch (error) {
        console.error(`获取${type}图像出错:`, error);
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(`重试 (${retryCount}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        } else {
          return null;
        }
      }
    }
    
    return null;
  };

  const generateReport = async (patientId) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/reports/${patientId}`, {
        responseType: 'blob',
        headers: {
          'Accept': 'application/pdf'
        }
      });
      // 处理报告下载
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${patientId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      message.success('报告生成成功，正在下载...');
    } catch (err) {
      setError('生成报告失败');
      console.error(err);
      message.error('生成报告失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = patients.filter(patient =>
    patient.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.patient_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 渲染分割图像部分
  const renderSegmentationImages = () => {
    if (!selectedImage) {
      return null;
    }
    
    if (!selectedImage.processed) {
      return (
        <div className="no-volume-data">
          <p>该图像尚未处理，无分割结果</p>
        </div>
      );
    }
    
    if (!selectedImage.task_id) {
      return (
        <div className="no-volume-data">
          <p>该图像缺少任务ID，无法显示分割结果</p>
        </div>
      );
    }

    return (
      <div className="processed-images">
        <h3>分割结果</h3>
        <div className="images-grid">
          <div className="image-item">
            <h5>灰质 (GM)</h5>
            {imageLoading[`${selectedImage.id}_gm`] ? (
              <div className="image-loading">
                <Spin tip="正在加载图像..." />
              </div>
            ) : segmentationImages.gm ? (
              <img
                src={segmentationImages.gm}
                alt="灰质分割结果"
                className="preview-image"
              />
            ) : (
              <div className="image-load-error">
                <div className="error-overlay">无法加载灰质图像</div>
              </div>
            )}
          </div>
          
          <div className="image-item">
            <h5>白质 (WM)</h5>
            {imageLoading[`${selectedImage.id}_wm`] ? (
              <div className="image-loading">
                <Spin tip="正在加载图像..." />
              </div>
            ) : segmentationImages.wm ? (
              <img
                src={segmentationImages.wm}
                alt="白质分割结果"
                className="preview-image"
              />
            ) : (
              <div className="image-load-error">
                <div className="error-overlay">无法加载白质图像</div>
              </div>
            )}
          </div>
          
          <div className="image-item">
            <h5>脑脊液 (CSF)</h5>
            {imageLoading[`${selectedImage.id}_csf`] ? (
              <div className="image-loading">
                <Spin tip="正在加载图像..." />
              </div>
            ) : segmentationImages.csf ? (
              <img
                src={segmentationImages.csf}
                alt="脑脊液分割结果"
                className="preview-image"
              />
            ) : (
              <div className="image-load-error">
                <div className="error-overlay">无法加载脑脊液图像</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

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
            
            {renderSegmentationImages()}
            
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