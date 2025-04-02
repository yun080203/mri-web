import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, Link, useNavigate } from 'react-router-dom';
import '../../styles/Patient.css';
import { Button, Modal, message, Spin } from 'antd';
import { API_BASE, FALLBACK_IMAGE } from '../../utils/constants';

function PatientDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [refreshInterval, setRefreshInterval] = useState(null);
    const [imageLoading, setImageLoading] = useState({});
    const [retryCount, setRetryCount] = useState({});
    const MAX_RETRY = 3; // 最大重试次数
    const [imageErrors, setImageErrors] = useState({});
    const [segmentationImages, setSegmentationImages] = useState({});

    useEffect(() => {
        fetchPatientDetails();
        
        // 设置定时刷新，但仅当有正在处理的图像时才刷新
        const interval = setInterval(() => {
            // 检查是否有正在处理的图像
            if (patient && patient.images && patient.images.some(img => !img.processed && !img.processing_error)) {
                console.log('发现正在处理的图像，继续轮询...');
                fetchPatientDetails();
            } else {
                // 如果没有正在处理的图像且定时器存在，清除定时器
                if (refreshInterval) {
                    console.log('没有正在处理的图像，停止轮询');
                    clearInterval(refreshInterval);
                    setRefreshInterval(null);
                }
            }
        }, 5000);
        
        setRefreshInterval(interval);
        
        return () => {
            if (refreshInterval) {
                clearInterval(refreshInterval);
            }
        };
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
                console.log('获取到的患者数据:', response.data.patient);
                
                // 检查图像是否有task_id
                const hasImagesWithoutTaskId = response.data.patient.images.some(img => 
                    img.processed && !img.task_id
                );
                
                if (hasImagesWithoutTaskId) {
                    console.warn('警告: 有已处理的图像缺少task_id');
                }
                
                // 更新患者数据，确保图像处理信息正确
                const updatedPatient = response.data.patient;
                
                // 如果有已存在的患者数据，保留图像加载状态
                if (patient) {
                    updatedPatient.images = updatedPatient.images.map(newImage => {
                        const existingImage = patient.images.find(img => img.id === newImage.id);
                        if (existingImage) {
                            return {
                                ...newImage,
                                imageLoaded: existingImage.imageLoaded,
                                loadError: existingImage.loadError
                            };
                        }
                        return {
                            ...newImage,
                            imageLoaded: false,
                            loadError: false
                        };
                    });
                }
                
                setPatient(updatedPatient);
                
                // 检查是否有正在处理的图像
                const hasProcessingImages = response.data.patient.images.some(img => 
                    !img.processed && !img.processing_error
                );
                
                // 如果没有正在处理的图像，停止刷新
                if (!hasProcessingImages && refreshInterval) {
                    console.log('所有图像处理完成，停止刷新');
                    clearInterval(refreshInterval);
                    setRefreshInterval(null);
                } else if (hasProcessingImages) {
                    console.log('存在正在处理的图像，继续刷新');
                }
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

    const handleDelete = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }

            const response = await axios.delete(`${API_BASE}/api/patients/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.success) {
                message.success('患者删除成功');
                navigate('/patients');
            } else {
                message.error(response.data.error || '删除失败');
            }
        } catch (error) {
            console.error('删除患者失败:', error);
            if (error.response?.status === 401) {
                navigate('/login');
            } else {
                message.error(error.response?.data?.error || '删除患者失败');
            }
        }
    };
    
    const handleImageError = async (e, image, type = "original") => {
        // 获取图像元素
        const imgElement = e.target;
        
        // 从data属性获取imageId和type
        const imageId = imgElement.getAttribute('data-image-id') || (image ? image.id : undefined);
        const imageType = type === "original" ? "original" : imgElement.getAttribute('data-type') || type;
        
        console.log(`图像加载失败，尝试获取备用预览。图像ID: ${imageId}, 类型: ${imageType}`);
        
        if (!imageId) {
            console.error('无法加载图像: 未提供图像ID');
            return;
        }
        
        try {
            if (type === "original") {
                // 这是原始MRI预览图像加载失败的情况
                // 原始MRI预览图直接从后端获取
                imgElement.style.display = 'none';
                setImageLoading(prev => ({
                    ...prev,
                    [imageId]: false
                }));
                
                // 查找是否已有错误覆盖层，如果有则不重复创建
                const container = imgElement.parentNode;
                if (container) {
                    const existingError = container.querySelector('.error-overlay');
                    if (!existingError) {
                        const errorDiv = document.createElement('div');
                        errorDiv.className = 'error-overlay';
                        errorDiv.textContent = '无法加载MRI预览图';
                        container.appendChild(errorDiv);
                    }
                }
            } else {
                // 这是分割图像加载失败的情况
                console.log(`分割图像 ${image?.task_id} 加载失败，类型: ${imageType}`);
                // 已经在渲染部分处理了这种情况，显示错误UI
            }
        } catch (error) {
            console.error(`处理图像错误时发生异常:`, error);
        }
    };
    
    // 图像加载成功
    const handleImageLoad = (imageId) => {
        console.log(`图像 ${imageId} 加载成功`);
        
        // 更新加载状态
        setImageLoading(prev => ({
            ...prev,
            [imageId]: false
        }));
        
        // 清除错误状态
        setImageErrors(prev => ({
            ...prev,
            [imageId]: false
        }));
        
        // 找到对应的图像元素，并移除错误覆盖层
        try {
            const imgElement = document.querySelector(`img[data-image-id="${imageId}"]`);
            if (imgElement) {
                const container = imgElement.parentNode;
                if (container) {
                    const errorOverlay = container.querySelector('.error-overlay');
                    if (errorOverlay) {
                        container.removeChild(errorOverlay);
                    }
                }
                
                // 确保图像显示
                imgElement.style.display = 'block';
            }
        } catch (err) {
            console.error('移除错误覆盖层失败:', err);
        }
    };

    // 当选择图像或图像列表变化时，加载分割图像
    useEffect(() => {
        if (patient && patient.images && patient.images.length > 0) {
            const processedImages = patient.images.filter(img => img.processed && img.task_id);
            
            // 初始化加载状态
            const loadingStates = {};
            patient.images.forEach(img => {
                if (img.processed && img.task_id) {
                    console.log(`图像 ${img.id} 已处理，task_id: ${img.task_id}`);
                    // 设置该图像的三种组织类型的加载状态
                    loadingStates[`${img.id}_gm`] = true;
                    loadingStates[`${img.id}_wm`] = true;
                    loadingStates[`${img.id}_csf`] = true;
                    
                    // 为每个处理完成的图像加载分割图像
                    loadSegmentationImages(img);
                } else {
                    console.log(`图像 ${img.id} ${img.processed ? '已处理但无task_id' : '未处理'}`);
                }
            });
            setImageLoading(loadingStates);
        }
    }, [patient]);
    
    // 添加一个新的函数用于获取原始MRI预览图
    const fetchOriginalImage = async (taskId) => {
        if (!taskId) {
            console.error('无法获取原始图像预览：缺少task_id');
            return null;
        }

        console.log(`尝试从处理结果中获取原始图像预览，taskId: ${taskId}`);
        
        // 定义重试次数和延迟
        const maxRetries = 3;
        let retryCount = 0;
        
        while (retryCount < maxRetries) {
            try {
                // 使用p0input.nii作为原始图像的源文件
                const response = await fetch(`${API_BASE}/api/preview/${taskId}?type=original`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                console.log(`API响应状态: ${response.status}, 内容类型: ${response.headers.get('content-type')}`);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`获取原始图像预览失败: ${response.status} - ${errorText}`);
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
                    console.log(`成功获取原始图像预览数据`, data);
                    
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
                console.error(`获取原始图像预览出错:`, error);
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

    // 修改加载分割图像的函数，增加加载原始MRI预览
    const loadSegmentationImages = async (image) => {
        if (!image || !image.task_id) {
            console.log('未选择图像或图像没有关联的任务ID');
            return;
        }
        
        try {
            console.log(`开始加载图像，任务ID: ${image.task_id}`);
            
            // 设置所有图像为加载中状态
            setImageLoading(prev => ({
                ...prev,
                [image.id]: true,
                [`${image.id}_gm`]: true,
                [`${image.id}_wm`]: true,
                [`${image.id}_csf`]: true
            }));
            
            // 加载原始MRI预览图像
            const originalPromise = fetchOriginalImage(image.task_id);
            const gmPromise = fetchSegmentationImage(image.task_id, 'gm');
            const wmPromise = fetchSegmentationImage(image.task_id, 'wm');
            const csfPromise = fetchSegmentationImage(image.task_id, 'csf');
            
            const [original, gm, wm, csf] = await Promise.all([originalPromise, gmPromise, wmPromise, csfPromise]);
            
            // 如果获取到了原始图像，更新图像状态
            if (original) {
                // 记录并显示原始图像
                console.log(`获取到原始MRI预览图像，用于图像: ${image.id}`);
                
                // 查找对应图像ID的元素
                if (image.id) {
                    const originalImgElement = document.querySelector(`img[data-image-id="${image.id}"]`);
                    if (originalImgElement) {
                        // 更新图像源并确保显示
                        originalImgElement.src = original;
                        originalImgElement.style.display = 'block';
                        
                        // 移除错误覆盖层
                        const container = originalImgElement.parentNode;
                        if (container) {
                            const errorOverlay = container.querySelector('.error-overlay');
                            if (errorOverlay) {
                                container.removeChild(errorOverlay);
                            }
                        }
                    }
                }
            }
            
            setSegmentationImages(prev => ({
                ...prev,
                [image.id]: { gm, wm, csf, original }
            }));
            
            console.log(`图像 ${image.id} 的分割图像加载完成`, { 
                original: !!original,
                gm: !!gm, 
                wm: !!wm, 
                csf: !!csf 
            });
            
            // 更新加载状态
            setImageLoading(prev => ({
                ...prev,
                [image.id]: false,
                [`${image.id}_gm`]: false,
                [`${image.id}_wm`]: false,
                [`${image.id}_csf`]: false
            }));
            
            // 更新错误状态
            setImageErrors(prev => ({
                ...prev,
                [image.id]: !original,
                [`${image.id}_gm`]: !gm,
                [`${image.id}_wm`]: !wm,
                [`${image.id}_csf`]: !csf
            }));
            
        } catch (error) {
            console.error('加载分割图像时出错:', error);
            message.error('加载分割图像失败');
            
            // 设置所有图像加载完成但失败
            setImageLoading(prev => ({
                ...prev,
                [image.id]: false,
                [`${image.id}_gm`]: false,
                [`${image.id}_wm`]: false,
                [`${image.id}_csf`]: false
            }));
            
            setImageErrors(prev => ({
                ...prev,
                [image.id]: true,
                [`${image.id}_gm`]: true,
                [`${image.id}_wm`]: true,
                [`${image.id}_csf`]: true
            }));
        }
    };

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
                const response = await fetch(`${API_BASE}/api/preview/${taskId}?type=${type}`, {
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
                    <Button 
                        type="primary" 
                        danger 
                        onClick={() => {
                            Modal.confirm({
                                title: '确认删除',
                                content: '确定要删除该患者吗？此操作不可恢复。',
                                okText: '确认',
                                cancelText: '取消',
                                onOk: handleDelete
                            });
                        }}
                        className="delete-button"
                    >
                        删除患者
                    </Button>
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
                                    <p>状态: {image.processed ? '已处理' : image.processing_error ? '处理失败' : '未处理'}</p>
                                    {image.processing_completed && (
                                        <p>处理完成时间: {new Date(image.processing_completed).toLocaleString()}</p>
                                    )}
                                </div>
                                <div className="image-preview">
                                    {imageLoading[image.id] ? (
                                        <div className="image-loading">
                                            <Spin tip="正在加载图像..." />
                                        </div>
                                    ) : (
                                        // 修改这里，如果已处理且有task_id，尝试从segmentationImages中使用
                                        image.processed && image.task_id && segmentationImages[image.id] && segmentationImages[image.id].original ? (
                                            <img 
                                                src={segmentationImages[image.id].original}
                                                alt="MRI预览" 
                                                style={{maxWidth: '100%', maxHeight: '300px'}}
                                                data-image-id={image.id}
                                                data-type="original"
                                            />
                                        ) : (
                                            // 原始方式获取图像
                                            <img 
                                                src={`${API_BASE}/api/preview/${image.id}`} 
                                                alt="MRI预览" 
                                                onError={(e) => handleImageError(e, image, "original")}
                                                onLoad={() => handleImageLoad(image.id)}
                                                style={{maxWidth: '100%', maxHeight: '300px'}}
                                                crossOrigin="anonymous"
                                                data-image-id={image.id}
                                                data-type="original"
                                            />
                                        )
                                    )}
                                </div>
                                {image.processed && (
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
                                                        {(image.gm_volume / 1000).toFixed(2)}
                                                        <span className="volume-unit">ml</span>
                                                        <span className="volume-percent">
                                                            ({(image.gm_volume / image.tiv_volume * 100).toFixed(1)}%)
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
                                                        {(image.wm_volume / 1000).toFixed(2)}
                                                        <span className="volume-unit">ml</span>
                                                        <span className="volume-percent">
                                                            ({(image.wm_volume / image.tiv_volume * 100).toFixed(1)}%)
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
                                                        {(image.csf_volume / 1000).toFixed(2)}
                                                        <span className="volume-unit">ml</span>
                                                        <span className="volume-percent">
                                                            ({(image.csf_volume / image.tiv_volume * 100).toFixed(1)}%)
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
                                                        {(image.tiv_volume / 1000).toFixed(2)}
                                                        <span className="volume-unit">ml</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="volume-chart">
                                            <div className="chart-bars">
                                                <div 
                                                    className="chart-bar gm-bar" 
                                                    style={{width: `${(image.gm_volume / image.tiv_volume * 100).toFixed(1)}%`}}
                                                ></div>
                                                <div 
                                                    className="chart-bar wm-bar" 
                                                    style={{width: `${(image.wm_volume / image.tiv_volume * 100).toFixed(1)}%`}}
                                                ></div>
                                                <div 
                                                    className="chart-bar csf-bar" 
                                                    style={{width: `${(image.csf_volume / image.tiv_volume * 100).toFixed(1)}%`}}
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
                                {image.processed && image.task_id ? (
                                    <div className="processed-images">
                                        <h3>分割结果</h3>
                                        <div className="images-grid">
                                            <div className="image-item">
                                                <h5>灰质 (GM)</h5>
                                                {imageLoading[`${image.id}_gm`] ? (
                                                    <div className="image-loading">
                                                        <Spin tip="正在加载灰质图像..." />
                                                    </div>
                                                ) : segmentationImages[image.id]?.gm ? (
                                                    <img
                                                        src={segmentationImages[image.id].gm}
                                                        alt="灰质分割结果"
                                                        className="preview-image"
                                                        data-image-id={`${image.id}-gm`}
                                                        data-task-id={image.task_id}
                                                    />
                                                ) : (
                                                    <div className="image-load-error">
                                                        <div className="error-overlay">无法加载灰质图像</div>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="image-item">
                                                <h5>白质 (WM)</h5>
                                                {imageLoading[`${image.id}_wm`] ? (
                                                    <div className="image-loading">
                                                        <Spin tip="正在加载白质图像..." />
                                                    </div>
                                                ) : segmentationImages[image.id]?.wm ? (
                                                    <img
                                                        src={segmentationImages[image.id].wm}
                                                        alt="白质分割结果"
                                                        className="preview-image"
                                                        data-image-id={`${image.id}-wm`}
                                                        data-task-id={image.task_id}
                                                    />
                                                ) : (
                                                    <div className="image-load-error">
                                                        <div className="error-overlay">无法加载白质图像</div>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="image-item">
                                                <h5>脑脊液 (CSF)</h5>
                                                {imageLoading[`${image.id}_csf`] ? (
                                                    <div className="image-loading">
                                                        <Spin tip="正在加载脑脊液图像..." />
                                                    </div>
                                                ) : segmentationImages[image.id]?.csf ? (
                                                    <img
                                                        src={segmentationImages[image.id].csf}
                                                        alt="脑脊液分割结果"
                                                        className="preview-image"
                                                        data-image-id={`${image.id}-csf`}
                                                        data-task-id={image.task_id}
                                                    />
                                                ) : (
                                                    <div className="image-load-error">
                                                        <div className="error-overlay">无法加载脑脊液图像</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    image.processed && (
                                        <div className="error-message">
                                            警告: 图像已处理但缺少任务ID，无法显示分割结果。请尝试重新处理图像。
                                        </div>
                                    )
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