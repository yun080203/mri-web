import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, Slider, Radio, Button, Row, Col, Tabs, Space, Tooltip, Select, Spin, message } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, FullscreenOutlined, SyncOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { axiosInstance } from '../../utils/axiosConfig';
import './ImageCompare.css';

// 添加内联样式
const styles = {
  spinContent: {
    padding: '30px',
    background: 'rgba(0, 0, 0, 0.05)',
    borderRadius: '4px',
    textAlign: 'center',
    marginBottom: '20px',
    height: '200px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
};

/**
 * 图像对比组件
 * 支持不同扫描结果的并排和叠加对比
 */
const ImageCompare = () => {
  // 状态管理
  const [compareMode, setCompareMode] = useState('side-by-side'); // 'side-by-side', 'overlay'
  const [layout, setLayout] = useState('horizontal'); // 'horizontal', 'vertical'
  const [selectedImages, setSelectedImages] = useState([null, null]);
  const [opacity, setOpacity] = useState(0.5);
  const [syncZoom, setSyncZoom] = useState(true);
  const [showDifference, setShowDifference] = useState(false);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imageData, setImageData] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // 用于同步两个视图的缩放
  const transformerRefs = [useRef(null), useRef(null)];
  
  // 添加以下状态定义
  const [originalImages, setOriginalImages] = useState({});
  const [imageLoading, setImageLoading] = useState({});
  const [imageErrors, setImageErrors] = useState({});
  
  // 初始化 - 获取URL参数
  useEffect(() => {
    console.log('ImageCompare组件已加载, 环境变量:', {
      API_BASE: process.env.REACT_APP_API_BASE || 'http://localhost:5000'
    });
    
    const img1 = searchParams.get('img1');
    const img2 = searchParams.get('img2');
    const patientId = searchParams.get('patientId');
    
    console.log('URL参数:', { img1, img2, patientId });
    
    if (patientId) {
      setSelectedPatient(parseInt(patientId, 10));
    }
    
    if (img1 || img2) {
      console.log('从URL参数中获取图像ID:', { img1, img2 });
      fetchInitialData(img1, img2);
    } else {
      fetchPatients();
    }
  }, [searchParams]);
  
  // 获取患者列表
  const fetchPatients = async () => {
    try {
      setLoading(true);
      console.log('开始获取患者列表');
      const response = await axiosInstance.get('/api/patients');
      console.log('患者列表响应:', response.data);
      
      if (response.data.success && Array.isArray(response.data.patients)) {
        setPatients(response.data.patients);
        console.log(`成功获取${response.data.patients.length}名患者`);
        
        // 如果有患者但没有选择患者，自动选择第一个
        if (response.data.patients.length > 0 && !selectedPatient) {
          const firstPatient = response.data.patients[0];
          console.log('自动选择第一个患者:', firstPatient.id);
          handlePatientChange(firstPatient.id);
        }
      } else {
        message.error('获取患者列表失败');
      }
    } catch (error) {
      console.error('获取患者列表错误:', error);
      message.error('获取患者列表失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 根据URL参数获取初始图像数据
  const fetchInitialData = async (img1Id, img2Id) => {
    try {
      setLoading(true);
      if (img1Id) {
        const img1Data = await fetchImageData(img1Id);
        if (img1Data) {
          handleImageSelect(0, img1Data);
        }
      }
      
      if (img2Id) {
        const img2Data = await fetchImageData(img2Id);
        if (img2Data) {
          handleImageSelect(1, img2Data);
        }
      }
    } catch (error) {
      console.error('获取初始图像数据错误:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // 获取图像数据
  const fetchImageData = async (imageId) => {
    try {
      const response = await axiosInstance.get(`/api/images/${imageId}`);
      if (response.data.success) {
        return response.data.image;
      } else {
        message.error(`获取图像ID ${imageId} 的数据失败`);
        return null;
      }
    } catch (error) {
      console.error(`获取图像 ${imageId} 数据错误:`, error);
      return null;
    }
  };
  
  // 获取患者的所有图像
  const fetchPatientImages = async (patientId) => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/api/patients/${patientId}`);
      if (response.data.success) {
        const patientData = response.data.patient;
        const processedImages = patientData.images.filter(img => img.processed && img.task_id);
        setImageData(processedImages);
      } else {
        message.error('获取患者图像数据失败');
      }
    } catch (error) {
      console.error('获取患者图像错误:', error);
      message.error('获取患者图像数据失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 获取分割图像
  const fetchSegmentationImage = async (taskId, type) => {
    if (!taskId) {
      console.error(`无法获取${type}图像：缺少task_id`);
      return null;
    }

    // 确保taskId是字符串
    const taskIdStr = String(taskId);
    console.log(`尝试获取分割图像，taskId: ${taskIdStr}, 类型: ${type}, URL: ${process.env.REACT_APP_API_BASE || 'http://localhost:5000'}/api/preview/${taskIdStr}?type=${type}`);
    
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        console.log(`开始请求: /api/preview/${taskIdStr}?type=${type}, 重试次数: ${retryCount}`);
        // 使用axiosInstance代替fetch，确保处理CORS和Authorization
        const response = await axiosInstance.get(`/api/preview/${taskIdStr}?type=${type}`, {
          responseType: 'json'
        });

        console.log(`API响应状态码: ${response.status}`, response.data);
        
        if (response.data && response.data.status === 'success' && response.data.image) {
          console.log(`成功获取${type}图像，数据长度: ${response.data.image.length}`);
          return `data:image/png;base64,${response.data.image}`;
        } else {
          console.error(`获取${type}图像失败: 无效的响应数据`, response.data);
          retryCount++;
          if (retryCount < maxRetries) {
            console.log(`准备重试，等待 ${1000 * retryCount}ms`);
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            continue;
          }
          return null;
        }
      } catch (error) {
        console.error(`获取${type}图像出错:`, error, error.response || 'No response data');
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(`准备重试，等待 ${1000 * retryCount}ms`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        } else {
          return null;
        }
      }
    }
    
    return null;
  };
  
  // 选择患者处理
  const handlePatientChange = (patientId) => {
    setSelectedPatient(patientId);
    fetchPatientImages(patientId);
    
    // 清空选择的图像
    setSelectedImages([null, null]);
  };
  
  // 图像选择处理
  const handleImageSelect = async (index, imageData) => {
    // 如果只传入ID，先获取数据
    if (typeof imageData === 'number' || typeof imageData === 'string') {
      try {
        console.log(`开始获取图像数据, ID: ${imageData}`);
        const data = await fetchImageData(imageData);
        if (!data) {
          console.error(`获取图像数据失败，ID: ${imageData}`);
          message.error(`获取图像数据失败，ID: ${imageData}`);
          return;
        }
        imageData = data;
      } catch (error) {
        console.error(`获取图像数据时发生错误, ID: ${imageData}`, error);
        message.error(`获取图像数据失败: ${error.message}`);
        return;
      }
    }
    
    console.log(`图像 ${index} 选择成功:`, imageData);
    
    // 确保图像有task_id
    if (!imageData.task_id) {
      console.error(`所选图像没有分割数据, ID: ${imageData.id}`);
      message.error('所选图像没有分割数据');
      return;
    }
    
    console.log(`开始加载图像 ${index} 的分割数据，task_id: ${imageData.task_id}`);
    
    try {
      // 加载分割图像
      message.loading({ content: '加载分割图像中...', key: `loading-${index}` });
      const gmPromise = fetchSegmentationImage(imageData.task_id, 'gm');
      const wmPromise = fetchSegmentationImage(imageData.task_id, 'wm');
      const csfPromise = fetchSegmentationImage(imageData.task_id, 'csf');
      
      const [gm, wm, csf] = await Promise.all([gmPromise, wmPromise, csfPromise]);
      
      console.log(`图像 ${index} 分割数据加载结果:`, { gm, wm, csf });
      
      const newImage = {
        ...imageData,
        segmentations: {
          gm,
          wm,
          csf
        }
      };
      
      const newSelectedImages = [...selectedImages];
      newSelectedImages[index] = newImage;
      setSelectedImages(newSelectedImages);
      
      console.log(`已更新selectedImages[${index}]:`, newSelectedImages[index]);
      message.success({ content: '图像加载成功', key: `loading-${index}` });
    } catch (error) {
      console.error(`加载分割图像失败:`, error);
      message.error({ content: `加载分割图像失败: ${error.message}`, key: `loading-${index}` });
    }
  };
  
  // 同步缩放处理
  const handleZoomChange = (index, ref) => {
    if (syncZoom && transformerRefs[1-index]?.current) {
      const { scale, positionX, positionY } = ref.state;
      transformerRefs[1-index].current.setTransform(positionX, positionY, scale);
    }
  };
  
  // 计算变化百分比
  const calculateChange = (oldValue, newValue) => {
    if (!oldValue || !newValue) return 0;
    return ((newValue - oldValue) / oldValue * 100).toFixed(2);
  };
  
  // 获取变化类型的CSS类
  const getChangeClass = (oldValue, newValue) => {
    if (!oldValue || !newValue) return 'neutral';
    const change = newValue - oldValue;
    if (Math.abs(change) < 0.01) return 'neutral';
    return change > 0 ? 'increase' : 'decrease';
  };
  
  // 添加以下函数来获取原始图像
  const fetchOriginalImage = async (taskId) => {
    if (!taskId) return null;
    if (originalImages[taskId]) return originalImages[taskId];
    
    setImageLoading(prev => ({ ...prev, [taskId]: true }));
    setImageErrors(prev => ({ ...prev, [taskId]: null }));
    
    try {
      const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';
      const response = await fetch(`${API_BASE}/api/preview/${taskId}?type=original`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`获取图像失败: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (data.status === 'success' && data.image) {
          const imgSrc = `data:image/png;base64,${data.image}`;
          setOriginalImages(prev => ({ ...prev, [taskId]: imgSrc }));
          return imgSrc;
        } else {
          throw new Error('图像数据格式错误');
        }
      } else {
        throw new Error(`响应不是JSON格式: ${contentType}`);
      }
    } catch (error) {
      console.error(`获取原始图像失败 (${taskId}):`, error);
      setImageErrors(prev => ({ ...prev, [taskId]: error.message }));
      return null;
    } finally {
      setImageLoading(prev => ({ ...prev, [taskId]: false }));
    }
  };
  
  // 当选择的图像改变时，获取原始图像
  useEffect(() => {
    if (selectedImages[0]?.task_id) {
      fetchOriginalImage(selectedImages[0].task_id);
    }
  }, [selectedImages[0]?.task_id]);
  
  useEffect(() => {
    if (selectedImages[1]?.task_id) {
      fetchOriginalImage(selectedImages[1].task_id);
    }
  }, [selectedImages[1]?.task_id]);
  
  // 渲染加载状态
  if (loading) {
    return (
      <div className="loading-container">
        <Spin size="large" />
        <p>加载数据中...</p>
      </div>
    );
  }
  
  // 渲染side-by-side模式下的第一个图像
  const renderFirstImage = () => {
    if (!selectedImages[0]) {
      return <div className="no-image-placeholder">请选择第一张图像</div>;
    }

    // 定义第一张图像的Tab项
    const tabItems = [
      {
        key: 'original',
        label: '原始',
        children: (
          <TransformWrapper
            ref={transformerRefs[0]}
            onZoom={(ref) => handleZoomChange(0, ref)}
          >
            <TransformComponent>
              {imageLoading[selectedImages[0]?.task_id] ? (
                <div className="loading-container">
                  <Spin>
                    <div style={styles.spinContent}>加载中...</div>
                  </Spin>
                </div>
              ) : originalImages[selectedImages[0]?.task_id] ? (
                <img 
                  src={originalImages[selectedImages[0].task_id]} 
                  alt="原始MRI" 
                  className="comparison-image"
                  onLoad={() => console.log("原始图像加载成功:", selectedImages[0].id)}
                />
              ) : (
                <div className="no-image">
                  {imageErrors[selectedImages[0]?.task_id] || "无法加载原始图像"}
                  <div className="debug-info">taskId: {selectedImages[0]?.task_id}</div>
                </div>
              )}
            </TransformComponent>
          </TransformWrapper>
        )
      },
      {
        key: 'gm',
        label: '灰质',
        children: (
          <TransformWrapper
            ref={transformerRefs[0]}
            onZoom={(ref) => handleZoomChange(0, ref)}
          >
            <TransformComponent>
              {selectedImages[0]?.segmentations?.gm ? (
                <img 
                  src={selectedImages[0].segmentations.gm} 
                  alt="灰质分割" 
                  className="comparison-image"
                  onError={(e) => {
                    console.error("灰质图像加载失败:", e);
                    if (e.target && e.target.parentNode) {
                      e.target.parentNode.innerHTML = '<div class="no-image">灰质分割图像加载失败</div>';
                    }
                  }}
                />
              ) : (
                <div className="no-image">
                  {loading ? "加载中..." : "灰质分割图像未找到"}
                  <div className="debug-info">taskId: {selectedImages[0]?.task_id}</div>
                </div>
              )}
            </TransformComponent>
          </TransformWrapper>
        )
      },
      {
        key: 'wm',
        label: '白质',
        children: (
          <TransformWrapper
            ref={transformerRefs[0]}
            onZoom={(ref) => handleZoomChange(0, ref)}
          >
            <TransformComponent>
              {selectedImages[0]?.segmentations?.wm ? (
                <img 
                  src={selectedImages[0].segmentations.wm} 
                  alt="白质分割" 
                  className="comparison-image"
                  onError={(e) => {
                    console.error("白质图像加载失败:", e);
                    if (e.target && e.target.parentNode) {
                      e.target.parentNode.innerHTML = '<div class="no-image">白质分割图像加载失败</div>';
                    }
                  }}
                />
              ) : (
                <div className="no-image">
                  {loading ? "加载中..." : "白质分割图像未找到"}
                  <div className="debug-info">taskId: {selectedImages[0]?.task_id}</div>
                </div>
              )}
            </TransformComponent>
          </TransformWrapper>
        )
      },
      {
        key: 'csf',
        label: '脑脊液',
        children: (
          <TransformWrapper
            ref={transformerRefs[0]}
            onZoom={(ref) => handleZoomChange(0, ref)}
          >
            <TransformComponent>
              {selectedImages[0]?.segmentations?.csf ? (
                <img 
                  src={selectedImages[0].segmentations.csf} 
                  alt="脑脊液分割" 
                  className="comparison-image"
                  onError={(e) => {
                    console.error("脑脊液图像加载失败:", e);
                    if (e.target && e.target.parentNode) {
                      e.target.parentNode.innerHTML = '<div class="no-image">脑脊液分割图像加载失败</div>';
                    }
                  }}
                />
              ) : (
                <div className="no-image">
                  {loading ? "加载中..." : "脑脊液分割图像未找到"}
                  <div className="debug-info">taskId: {selectedImages[0]?.task_id}</div>
                </div>
              )}
            </TransformComponent>
          </TransformWrapper>
        )
      }
    ];

    return (
      <>
        <div className="segmentation-tabs">
          <Tabs defaultActiveKey="original" items={tabItems} />
        </div>
        {/* 体积数据显示 */}
        {selectedImages[0] && (
          <div className="volume-data-summary">
            <h4>体积数据</h4>
            <Row gutter={[8, 8]}>
              <Col span={6}>
                <div className="volume-item-small gm-item">
                  <div className="volume-label">灰质</div>
                  <div className="volume-value">{(selectedImages[0].gm_volume/1000).toFixed(2)} ml</div>
                </div>
              </Col>
              <Col span={6}>
                <div className="volume-item-small wm-item">
                  <div className="volume-label">白质</div>
                  <div className="volume-value">{(selectedImages[0].wm_volume/1000).toFixed(2)} ml</div>
                </div>
              </Col>
              <Col span={6}>
                <div className="volume-item-small csf-item">
                  <div className="volume-label">脑脊液</div>
                  <div className="volume-value">{(selectedImages[0].csf_volume/1000).toFixed(2)} ml</div>
                </div>
              </Col>
              <Col span={6}>
                <div className="volume-item-small tiv-item">
                  <div className="volume-label">总体积</div>
                  <div className="volume-value">{(selectedImages[0].tiv_volume/1000).toFixed(2)} ml</div>
                </div>
              </Col>
            </Row>
          </div>
        )}
      </>
    );
  };

  // 渲染side-by-side模式下的第二个图像
  const renderSecondImage = () => {
    if (!selectedImages[1]) {
      return <div className="no-image-placeholder">请选择第二张图像</div>;
    }

    // 定义第二张图像的Tab项
    const tabItems = [
      {
        key: 'original',
        label: '原始',
        children: (
          <TransformWrapper
            ref={transformerRefs[1]}
            onZoom={(ref) => handleZoomChange(1, ref)}
          >
            <TransformComponent>
              {imageLoading[selectedImages[1]?.task_id] ? (
                <div className="loading-container">
                  <Spin>
                    <div style={styles.spinContent}>加载中...</div>
                  </Spin>
                </div>
              ) : originalImages[selectedImages[1]?.task_id] ? (
                <img 
                  src={originalImages[selectedImages[1].task_id]} 
                  alt="原始MRI" 
                  className="comparison-image"
                  onLoad={() => console.log("原始图像加载成功:", selectedImages[1].id)}
                />
              ) : (
                <div className="no-image">
                  {imageErrors[selectedImages[1]?.task_id] || "无法加载原始图像"}
                  <div className="debug-info">taskId: {selectedImages[1]?.task_id}</div>
                </div>
              )}
            </TransformComponent>
          </TransformWrapper>
        )
      },
      {
        key: 'gm',
        label: '灰质',
        children: (
          <TransformWrapper
            ref={transformerRefs[1]}
            onZoom={(ref) => handleZoomChange(1, ref)}
          >
            <TransformComponent>
              {selectedImages[1]?.segmentations?.gm ? (
                <img 
                  src={selectedImages[1].segmentations.gm} 
                  alt="灰质分割" 
                  className="comparison-image"
                  onError={(e) => {
                    console.error("灰质图像加载失败:", e);
                    if (e.target && e.target.parentNode) {
                      e.target.parentNode.innerHTML = '<div class="no-image">灰质分割图像加载失败</div>';
                    }
                  }}
                />
              ) : (
                <div className="no-image">
                  {loading ? "加载中..." : "灰质分割图像未找到"}
                  <div className="debug-info">taskId: {selectedImages[1]?.task_id}</div>
                </div>
              )}
            </TransformComponent>
          </TransformWrapper>
        )
      },
      {
        key: 'wm',
        label: '白质',
        children: (
          <TransformWrapper
            ref={transformerRefs[1]}
            onZoom={(ref) => handleZoomChange(1, ref)}
          >
            <TransformComponent>
              {selectedImages[1]?.segmentations?.wm ? (
                <img 
                  src={selectedImages[1].segmentations.wm} 
                  alt="白质分割" 
                  className="comparison-image"
                  onError={(e) => {
                    console.error("白质图像加载失败:", e);
                    if (e.target && e.target.parentNode) {
                      e.target.parentNode.innerHTML = '<div class="no-image">白质分割图像加载失败</div>';
                    }
                  }}
                />
              ) : (
                <div className="no-image">
                  {loading ? "加载中..." : "白质分割图像未找到"}
                  <div className="debug-info">taskId: {selectedImages[1]?.task_id}</div>
                </div>
              )}
            </TransformComponent>
          </TransformWrapper>
        )
      },
      {
        key: 'csf',
        label: '脑脊液',
        children: (
          <TransformWrapper
            ref={transformerRefs[1]}
            onZoom={(ref) => handleZoomChange(1, ref)}
          >
            <TransformComponent>
              {selectedImages[1]?.segmentations?.csf ? (
                <img 
                  src={selectedImages[1].segmentations.csf} 
                  alt="脑脊液分割" 
                  className="comparison-image"
                  onError={(e) => {
                    console.error("脑脊液图像加载失败:", e);
                    if (e.target && e.target.parentNode) {
                      e.target.parentNode.innerHTML = '<div class="no-image">脑脊液分割图像加载失败</div>';
                    }
                  }}
                />
              ) : (
                <div className="no-image">
                  {loading ? "加载中..." : "脑脊液分割图像未找到"}
                  <div className="debug-info">taskId: {selectedImages[1]?.task_id}</div>
                </div>
              )}
            </TransformComponent>
          </TransformWrapper>
        )
      }
    ];

    return (
      <>
        <div className="segmentation-tabs">
          <Tabs defaultActiveKey="original" items={tabItems} />
        </div>
        {/* 体积数据显示 */}
        {selectedImages[1] && (
          <div className="volume-data-summary">
            <h4>体积数据</h4>
            <Row gutter={[8, 8]}>
              <Col span={6}>
                <div className="volume-item-small gm-item">
                  <div className="volume-label">灰质</div>
                  <div className="volume-value">{(selectedImages[1].gm_volume/1000).toFixed(2)} ml</div>
                  {showDifference && selectedImages[0] && (
                    <div className={`volume-change ${getChangeClass(selectedImages[0].gm_volume, selectedImages[1].gm_volume)}`}>
                      {calculateChange(selectedImages[0].gm_volume, selectedImages[1].gm_volume)}%
                    </div>
                  )}
                </div>
              </Col>
              <Col span={6}>
                <div className="volume-item-small wm-item">
                  <div className="volume-label">白质</div>
                  <div className="volume-value">{(selectedImages[1].wm_volume/1000).toFixed(2)} ml</div>
                  {showDifference && selectedImages[0] && (
                    <div className={`volume-change ${getChangeClass(selectedImages[0].wm_volume, selectedImages[1].wm_volume)}`}>
                      {calculateChange(selectedImages[0].wm_volume, selectedImages[1].wm_volume)}%
                    </div>
                  )}
                </div>
              </Col>
              <Col span={6}>
                <div className="volume-item-small csf-item">
                  <div className="volume-label">脑脊液</div>
                  <div className="volume-value">{(selectedImages[1].csf_volume/1000).toFixed(2)} ml</div>
                  {showDifference && selectedImages[0] && (
                    <div className={`volume-change ${getChangeClass(selectedImages[0].csf_volume, selectedImages[1].csf_volume)}`}>
                      {calculateChange(selectedImages[0].csf_volume, selectedImages[1].csf_volume)}%
                    </div>
                  )}
                </div>
              </Col>
              <Col span={6}>
                <div className="volume-item-small tiv-item">
                  <div className="volume-label">总体积</div>
                  <div className="volume-value">{(selectedImages[1].tiv_volume/1000).toFixed(2)} ml</div>
                  {showDifference && selectedImages[0] && (
                    <div className={`volume-change ${getChangeClass(selectedImages[0].tiv_volume, selectedImages[1].tiv_volume)}`}>
                      {calculateChange(selectedImages[0].tiv_volume, selectedImages[1].tiv_volume)}%
                    </div>
                  )}
                </div>
              </Col>
            </Row>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="image-compare-container">
      <Card title="MRI图像对比分析" className="compare-card">
        <div className="controls-section">
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} md={8}>
              <Select
                placeholder="选择患者"
                style={{ width: '100%' }}
                value={selectedPatient}
                onChange={handlePatientChange}
                options={patients.map(p => ({ label: p.name, value: p.id }))}
              />
            </Col>
            
            <Col xs={24} md={16}>
              <Space wrap>
                <Radio.Group value={compareMode} onChange={e => setCompareMode(e.target.value)}>
                  <Radio.Button value="side-by-side">并排对比</Radio.Button>
                  <Radio.Button value="overlay">叠加对比</Radio.Button>
                </Radio.Group>
                
                <Radio.Group value={layout} onChange={e => setLayout(e.target.value)}>
                  <Radio.Button value="horizontal">水平布局</Radio.Button>
                  <Radio.Button value="vertical">垂直布局</Radio.Button>
                </Radio.Group>
                
                <Button 
                  type={syncZoom ? "primary" : "default"} 
                  icon={<SyncOutlined />} 
                  onClick={() => setSyncZoom(!syncZoom)}
                >
                  同步缩放
                </Button>
                
                <Button
                  type={showDifference ? "primary" : "default"}
                  onClick={() => setShowDifference(!showDifference)}
                >
                  显示差异
                </Button>
              </Space>
            </Col>
          </Row>
          
          {compareMode === 'overlay' && (
            <div className="opacity-slider">
              <span>透明度:</span>
              <Slider 
                value={opacity} 
                onChange={setOpacity} 
                min={0} 
                max={1} 
                step={0.01} 
                style={{ width: 200 }} 
              />
            </div>
          )}
        </div>
        
        <div className="image-selector-section">
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Card 
                size="small" 
                title="对比图像1" 
                className="selector-card"
              >
                <Select
                  placeholder="选择图像1"
                  style={{ width: '100%' }}
                  value={selectedImages[0]?.id}
                  onChange={value => handleImageSelect(0, value)}
                  options={imageData.map(img => ({ 
                    label: `${new Date(img.check_date).toLocaleDateString()} (ID: ${img.id})`, 
                    value: img.id 
                  }))}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card 
                size="small" 
                title="对比图像2" 
                className="selector-card"
              >
                <Select
                  placeholder="选择图像2"
                  style={{ width: '100%' }}
                  value={selectedImages[1]?.id}
                  onChange={value => handleImageSelect(1, value)}
                  options={imageData.map(img => ({ 
                    label: `${new Date(img.check_date).toLocaleDateString()} (ID: ${img.id})`, 
                    value: img.id 
                  }))}
                />
              </Card>
            </Col>
          </Row>
        </div>
        
        {/* 图像对比区域 */}
        <div className={`compare-view ${layout}`}>
          {compareMode === 'side-by-side' ? (
            <>
              {/* 第一张图像 */}
              <div className="image-container">
                {renderFirstImage()}
              </div>
              
              {/* 第二张图像 */}
              <div className="image-container">
                {renderSecondImage()}
              </div>
            </>
          ) : (
            // 叠加对比模式
            <div className="overlay-container">
              {selectedImages[0] && selectedImages[1] ? (
                <div className="overlay-controls">
                  <div className="opacity-slider">
                    <Space>
                      <Tooltip title="图像1">
                        <EyeOutlined />
                      </Tooltip>
                      <Slider 
                        value={opacity * 100} 
                        onChange={value => setOpacity(value / 100)} 
                        style={{ width: 200 }} 
                      />
                      <Tooltip title="图像2">
                        <EyeInvisibleOutlined />
                      </Tooltip>
                    </Space>
                  </div>
                  
                  <div className="overlay-image">
                    <TransformWrapper
                      ref={transformerRefs[0]}
                    >
                      <TransformComponent>
                        <div className="overlay-wrapper">
                          {imageLoading[selectedImages[0]?.task_id] ? (
                            <div className="loading-container">
                              <Spin>
                                <div style={styles.spinContent}>加载图像1...</div>
                              </Spin>
                            </div>
                          ) : originalImages[selectedImages[0]?.task_id] ? (
                            <img 
                              src={originalImages[selectedImages[0].task_id]} 
                              alt="图像1" 
                              className="base-image"
                              onLoad={() => console.log("叠加模式图像1加载成功:", selectedImages[0].id)}
                            />
                          ) : (
                            <div className="no-image">
                              {imageErrors[selectedImages[0]?.task_id] || "无法加载图像1"}
                            </div>
                          )}
                          
                          {imageLoading[selectedImages[1]?.task_id] ? (
                            <div className="loading-container overlay-loader">
                              <Spin>
                                <div style={styles.spinContent}>加载图像2...</div>
                              </Spin>
                            </div>
                          ) : originalImages[selectedImages[1]?.task_id] ? (
                            <img 
                              src={originalImages[selectedImages[1].task_id]} 
                              alt="图像2" 
                              className="overlay-image"
                              style={{ opacity: opacity }}
                              onLoad={() => console.log("叠加模式图像2加载成功:", selectedImages[1].id)}
                            />
                          ) : (
                            <div className="no-image overlay-error">
                              {imageErrors[selectedImages[1]?.task_id] || "无法加载图像2"}
                            </div>
                          )}
                        </div>
                      </TransformComponent>
                    </TransformWrapper>
                  </div>
                </div>
              ) : (
                <div className="no-image-placeholder">请选择两张图像进行对比</div>
              )}
            </div>
          )}
        </div>
        
        {/* 底部控制区 */}
        <div className="comparison-controls">
          <Row gutter={[16, 16]} justify="center">
            <Col>
              <Space>
                <Button 
                  icon={<ZoomInOutlined />} 
                  onClick={() => {
                    transformerRefs[0].current?.zoomIn();
                    if (syncZoom && transformerRefs[1].current) {
                      transformerRefs[1].current.zoomIn();
                    }
                  }}
                >
                  放大
                </Button>
                <Button 
                  icon={<ZoomOutOutlined />} 
                  onClick={() => {
                    transformerRefs[0].current?.zoomOut();
                    if (syncZoom && transformerRefs[1].current) {
                      transformerRefs[1].current.zoomOut();
                    }
                  }}
                >
                  缩小
                </Button>
                <Button 
                  icon={<FullscreenOutlined />} 
                  onClick={() => {
                    transformerRefs[0].current?.resetTransform();
                    if (syncZoom && transformerRefs[1].current) {
                      transformerRefs[1].current.resetTransform();
                    }
                  }}
                >
                  重置
                </Button>
              </Space>
            </Col>
          </Row>
        </div>
      </Card>
    </div>
  );
};

export default ImageCompare; 