import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { axiosInstance } from '../../utils/axiosConfig';
import { message, Upload, Button, Space, Card, Progress, List, Select, Modal, Form, Input, InputNumber, Radio, Alert, Row, Col, Spin, Typography, Divider } from 'antd';
import { UploadOutlined, PlusOutlined, InboxOutlined, FileImageOutlined, LoadingOutlined } from '@ant-design/icons';
import './ImageUpload.css';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { API_BASE, ALLOWED_EXTENSIONS, MAX_FILE_SIZE, FALLBACK_IMAGE } from '../../utils/constants';

// 常量定义
const POLLING_INTERVAL = 5000; // 初始轮询间隔为5秒
const MAX_POLLING_INTERVAL = 30000; // 最大轮询间隔为30秒
const POLLING_MULTIPLIER = 1.5; // 每次失败后增加50%的间隔时间

// 图像压缩函数
const compressImage = async (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 计算新的尺寸
        let width = img.width;
        let height = img.height;
        const maxSize = 1200; // 最大尺寸
        
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // 绘制压缩后的图像
        ctx.drawImage(img, 0, 0, width, height);
        
        // 转换为Blob
        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          }));
        }, 'image/jpeg', 0.7); // 0.7是压缩质量
      };
    };
  });
};

const ImageUpload = ({ selectedPatient, onUploadSuccess, hidePatientSelect, autoProcess = false }) => {
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [uploadedImageId, setUploadedImageId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [processingLogs, setProcessingLogs] = useState([]);
  const [patients, setPatients] = useState([]);
  const [imageLoading, setImageLoading] = useState({ gm: false, wm: false, csf: false });
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [form] = Form.useForm();
  const [uploadStatus, setUploadStatus] = useState('processing');
  const navigate = useNavigate();
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [processedImages, setProcessedImages] = useState({ gm: null, wm: null, csf: null });
  const [processingStatus, setProcessingStatus] = useState(null);
  const [volumeData, setVolumeData] = useState(null);
  const [selectedPatientState, setSelectedPatientState] = useState(selectedPatient || null);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [pollingTimer, setPollingTimer] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [showAddPatientModal, setShowAddPatientModal] = useState(false);
  const [addPatientForm] = Form.useForm();
  const [uploadForm] = Form.useForm();
  const [examDate, setExamDate] = useState(null);
  const [patientSearchValue, setPatientSearchValue] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [currentPatient, setCurrentPatient] = useState(selectedPatient || null);
  const [isPolling, setIsPolling] = useState(false);
  const [poller, setPoller] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(POLLING_INTERVAL);
  const [taskStatus, setTaskStatus] = useState(null);
  const [taskProgress, setTaskProgress] = useState(0);
  const [taskError, setTaskError] = useState(null);
  const [taskResults, setTaskResults] = useState(null);
  const [processingState, setProcessingState] = useState(null);
  const [segmentImages, setSegmentImages] = useState({ gm: null, wm: null, csf: null });

  // 使用useRef存储更新日志的函数
  const updateProcessingLogs = useCallback((updater) => {
    setProcessingLogs(prev => {
      const newLogs = typeof updater === 'function' ? updater(prev) : updater;
      // 从日志中提取体积数据
      extractVolumeDataFromLogs(newLogs);
      return newLogs;
    });
  }, []);

  // 获取患者列表
  useEffect(() => {
    if (!hidePatientSelect) {
      fetchPatients();
    }
  }, [hidePatientSelect]);

  const fetchPatients = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        message.error('请先登录');
        navigate('/login');
        return;
      }
      
      console.log('获取患者列表...');
      const response = await axiosInstance.get('/api/patients');
      
      if (response.data.success && Array.isArray(response.data.patients)) {
      setPatients(response.data.patients);
        console.log('获取到', response.data.patients.length, '个患者');
      } else {
        console.error('患者数据格式不正确:', response.data);
      message.error('获取患者列表失败');
      }
    } catch (error) {
      console.error('获取患者列表错误:', error);
      message.error('获取患者列表失败');
      
      // 如果是未授权错误，重定向到登录页面
      if (error.response && error.response.status === 401) {
        navigate('/login');
      }
    }
  };

  const handlePatientChange = (value) => {
    console.log('选择患者:', value);
    setSelectedPatientState(value);
    // 同时更新表单
    form.setFieldsValue({ patient: value });
  };
  
  // 处理创建患者表单提交
  const handleCreatePatient = async (values) => {
    try {
      console.log('创建新患者:', values);
      const response = await axiosInstance.post('/api/patients', values);
      
      if (response.data.success) {
        message.success('患者创建成功');
        setShowPatientModal(false);
        addPatientForm.resetFields();
        
        // 刷新患者列表
        await fetchPatients();
        
        // 自动选择新创建的患者
        const newPatientId = response.data.patient.id;
        setSelectedPatientState(newPatientId);
        form.setFieldsValue({ patient: newPatientId });
        
        console.log('新患者已创建并选中:', newPatientId);
      } else {
        message.error(response.data.error || '创建患者失败');
      }
    } catch (error) {
      console.error('创建患者错误:', error);
      message.error(error.response?.data?.error || '创建患者失败');
    }
  };

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.error('请先选择文件');
      return;
    }

    if (!selectedPatientState) {
      message.error('请先选择患者');
      return;
    }

    setUploading(true);
    updateProcessingLogs(prevLogs => [...prevLogs, '开始上传文件...']);

    // 获取文件对象
    const file = fileList[0].originFileObj;
      const formData = new FormData();
    formData.append('file', file);
    formData.append('patient_id', selectedPatientState);

    try {
      console.log('上传文件:', file.name);
      console.log('患者ID:', selectedPatientState);

      const response = await axiosInstance.post('/api/upload', formData);
      
      console.log('上传响应:', response);
      
      if (response.data && response.data.image) {
        const imageData = response.data.image;
        console.log('图像ID:', imageData.id);
        setUploadedImageId(imageData.id);
        message.success('上传成功');
        
        // 提取已上传图像的信息
        const { id, filename, file_path, upload_time } = imageData;
        setProcessedImages({
          id,
          filename,
          file_path,
          upload_time
        });
        
        // 检查是否可以获取预览图
        if (imageData.preview_url) {
          fetchPreviewImage(imageData.preview_url);
        } else {
          // 没有预览URL，尝试生成
          fetchPreviewImageById(imageData.id);
        }
        
        // 自动开始处理
        if (autoProcess) {
          startProcessing(imageData.id);
        }
      } else {
        console.error('上传失败: 响应中没有图像数据');
        message.error('上传失败: 服务器未返回图像信息');
      }
    } catch (error) {
      console.error('上传出错:', error);
      
      // 尝试获取详细错误信息
      let errorMessage = '上传失败: ';
      
      if (error.response && error.response.data) {
        // 服务器返回了错误信息
        console.error('错误响应数据:', error.response.data);
        errorMessage += error.response.data.message || JSON.stringify(error.response.data);
      } else {
        // 客户端错误或网络错误
        errorMessage += error.message || '未知错误';
      }
      
      message.error(errorMessage);
      updateProcessingLogs(prevLogs => [...prevLogs, `上传失败: ${errorMessage}`]);
    } finally {
      setUploading(false);
    }
  };

  const fetchPreviewImage = (url) => {
    console.log('获取预览图:', url);
    const previewImg = new Image();
    previewImg.crossOrigin = 'anonymous';
    previewImg.onload = () => {
      console.log('预览图加载成功');
      setPreviewImage(url);
      setImageLoading(false);
      updateProcessingLogs(prevLogs => [...prevLogs, '预览图加载成功']);
    };
    
    previewImg.onerror = (error) => {
      console.error('预览图加载失败:', error);
      setImageLoading(false);
      updateProcessingLogs(prevLogs => [...prevLogs, `预览图加载失败: ${error.message || '未知错误'}`]);
    };
    
    previewImg.src = url;
  };

  const fetchPreviewImageById = async (imageId) => {
    try {
      const response = await axiosInstance.get(`/api/preview/${imageId}`);
      if (response.data && response.data.image) {
        setPreviewImage(`data:image/png;base64,${response.data.image}`);
        setImageLoading(false);
      }
    } catch (error) {
      console.error('获取预览图失败:', error);
      setImageLoading(false);
      updateProcessingLogs(prevLogs => [...prevLogs, `获取预览图失败: ${error.message || '未知错误'}`]);
    }
  };

  const fetchImageById = async (imageId) => {
    try {
      console.log(`正在获取图像ID ${imageId} 的预览图...`);
      updateProcessingLogs(prevLogs => [...prevLogs, `正在获取图像ID ${imageId} 的预览图...`]);
      
      const response = await axiosInstance.get(`/api/images/${imageId}`);
      return response.data;
    } catch (error) {
      console.error('获取图像失败:', error);
      updateProcessingLogs(prevLogs => [...prevLogs, `获取预览图失败: ${error.message || '未知错误'}`]);
      return null;
    }
  };

  const handleProcess = async () => {
    if (!uploadedImageId) {
      message.error('请先上传图像');
      return;
    }

    setProcessing(true);
    setProcessingStatus({
      status: 'processing',
      progress: 0,
      taskId: null
    });
    updateProcessingLogs(prevLogs => [...prevLogs, '开始处理图像...']);
    
    try {
      // 创建处理任务
      const response = await axiosInstance.post('/api/process', {
        image_id: uploadedImageId,
        patient_id: selectedPatientState,
      });
      
      if (response.data && response.data.task_id) {
        const taskId = response.data.task_id;
        setCurrentTaskId(taskId);
        updateProcessingLogs(prevLogs => [...prevLogs, `处理任务已创建，任务ID: ${taskId}`]);
        
        // 开始轮询任务状态
        startPolling(taskId);
      } else {
        setProcessing(false);
        setProcessingStatus({
          status: 'failed',
          error: '服务器未返回任务ID'
        });
        message.error('处理失败: 服务器未返回任务ID');
      }
    } catch (error) {
      console.error('处理失败:', error);
      setProcessing(false);
      setProcessingStatus({
        status: 'failed',
        error: error.message || '未知错误'
      });
      message.error(`处理失败: ${error.message || '未知错误'}`);
      updateProcessingLogs(prevLogs => [...prevLogs, `处理失败: ${error.message || '未知错误'}`]);
    }
  };

  const startPolling = (taskId) => {
    const POLLING_INTERVAL = 5000; // 5秒
    const MAX_POLLING_INTERVAL = 30000; // 30秒
    const POLLING_MULTIPLIER = 1.5; // 每次失败后增加50%的间隔
    let currentInterval = POLLING_INTERVAL;

    // 记录任务ID，以便在调试时使用
    console.log(`开始轮询任务: ${taskId}`);
    setCurrentTaskId(taskId);

    const poll = async () => {
      try {
        const response = await axiosInstance.get(`/api/status/${taskId}`);
        const { status, progress, error, results, matlab_log } = response.data;

        console.log(`收到状态响应: status=${status}, progress=${progress}`);

        // 更新处理状态
        setProcessingStatus(prev => ({
          ...prev,
          status: status === 'completed' ? 'success' : status, // 将completed映射为success
          taskId,
          progress,
          error,
          results,
          matlab_log
        }));

        // 如果处理完成或失败，停止轮询
        if (status === 'success' || status === 'completed' || status === 'failed') {
          console.log(`任务${status === 'failed' ? '失败' : '完成'}，停止轮询`);
          
          // 如果任务完成，获取结果
          if (status === 'completed' || status === 'success') {
      setProcessing(false);
            console.log('尝试获取任务结果...');
            await fetchResults(taskId);
          }
          
          stopPolling();
      return;
    }

        // 如果进度超过90%，增加轮询间隔
        if (progress > 90) {
          currentInterval = Math.min(currentInterval * POLLING_MULTIPLIER, MAX_POLLING_INTERVAL);
        }

        // 设置下一次轮询
        const timer = setTimeout(poll, currentInterval);
        setPollingTimer(timer);
      } catch (error) {
        console.error('轮询状态失败:', error);
        // 增加轮询间隔
        currentInterval = Math.min(currentInterval * POLLING_MULTIPLIER, MAX_POLLING_INTERVAL);
        // 继续轮询
        const timer = setTimeout(poll, currentInterval);
        setPollingTimer(timer);
      }
    };

    // 开始第一次轮询
    poll();
  };

  const stopPolling = () => {
    console.log('停止轮询');
    
    // 清理组件级别的timer
    if (pollingTimer) {
      clearTimeout(pollingTimer);
      setPollingTimer(null);
    }
    
    // 清理window级别的轮询间隔（兼容旧代码）
    if (window.pollInterval) {
      clearInterval(window.pollInterval);
      window.pollInterval = null;
    }
    
    console.log('已停止所有轮询');
  };

  const initialStatusCheck = async (taskId) => {
    if (!taskId) {
      console.error('无法检查状态: taskId不存在');
      updateProcessingLogs(prev => [...prev, '轮询错误: taskId不存在']);
      return;
    }
    
    try {
      await checkStatus(taskId);
    } catch (error) {
      console.error('初始状态检查失败:', error);
      updateProcessingLogs(prev => [...prev, `初始状态检查失败: ${error.message}`]);
    }
  };

  const resetState = () => {
    setFileList([]);
    setPreviewImage(null);
    setImageLoading(false);
    setUploadedImageId(null);
    setProcessing(false);
    setProcessingStatus(null);
    setProcessingLogs([]);
    setSelectedPatientState(null);
    setCurrentTaskId(null);
    setProcessedImages(null);
    setVolumeData(null);
  };

  // 清理资源并在组件加载时设置一些初始状态
  useEffect(() => {
    // 组件加载时清空一些状态
    setPreviewImage(null);
    setImageLoading(false);
    setProcessing(false);
    setProcessingLogs([]);
    setUploadedImageId(null);
    setFileList([]);
    
    // 在组件卸载时清理资源
    return () => {
      console.log('组件卸载，清理资源');
      
      // 清理轮询间隔
      if (window.pollInterval) {
        console.log('清理轮询间隔');
        clearInterval(window.pollInterval);
        window.pollInterval = null;
      }
      
      // 清理全局任务ID
      if (window.currentPollingTaskId) {
        console.log('清理全局任务ID');
        window.currentPollingTaskId = null;
      }
      
      // 清除组件中的状态
      setPreviewImage(null);
      setImageLoading(false);
      stopPolling();
    };
  }, []); // 空依赖数组确保这个effect只在组件挂载和卸载时运行

  // 图像加载错误处理
  const handleImageError = async (e, type) => {
    console.error(`${type} 图像加载失败:`, e);
    const img = e.target;
    const container = img.parentElement;
    
    // 创建错误消息容器
    const errorContainer = document.createElement('div');
    errorContainer.className = 'image-load-error';
    errorContainer.innerHTML = `
      <div class="error-overlay">
        图像加载失败
        <br>
        正在重试...
      </div>
    `;
    
    // 替换图像元素
    if (container) {
      container.replaceChild(errorContainer, img);
    }
    
    // 获取任务ID并重试获取图像
    const taskId = processingStatus.taskId || currentTaskId;
    if (taskId) {
      updateProcessingLogs(prevLogs => [...prevLogs, `图像加载失败，尝试重新获取${type}图像...`]);
      
      try {
        // 使用我们的fetchSegmentationImageData函数重新获取图像
        const base64Image = await fetchSegmentationImageData(taskId, type);
        
        if (base64Image) {
          // 如果成功获取图像，创建新的图像元素
          const newImg = document.createElement('img');
          newImg.src = base64Image;
          newImg.alt = `${type} 分割结果`;
          newImg.className = 'preview-image';
          newImg.crossOrigin = 'anonymous';
          
          // 设置事件处理
          newImg.onerror = (e) => handleImageError(e, type);
          
          // 更新DOM
          if (container && container.contains(errorContainer)) {
            container.replaceChild(newImg, errorContainer);
          }
          
          // 更新状态
          setProcessedImages(prev => ({
            ...prev,
            [type]: base64Image
          }));
          
          updateProcessingLogs(prevLogs => [...prevLogs, `成功重新加载${type}图像`]);
        } else {
          // 如果获取失败，显示永久错误消息
          errorContainer.innerHTML = `
            <div class="error-overlay">
              无法加载${type}图像
              <br>
              请刷新页面重试
            </div>
          `;
          updateProcessingLogs(prevLogs => [...prevLogs, `无法重新加载${type}图像`]);
        }
      } catch (error) {
        console.error(`重新获取${type}图像失败:`, error);
        // 显示永久错误消息
        errorContainer.innerHTML = `
          <div class="error-overlay">
            图像加载失败: ${error.message || '未知错误'}
            <br>
            请刷新页面重试
          </div>
        `;
        updateProcessingLogs(prevLogs => [...prevLogs, `重新获取${type}图像出错: ${error.message || '未知错误'}`]);
      }
    } else {
      // 没有任务ID，无法重试
      errorContainer.innerHTML = `
        <div class="error-overlay">
          无法加载图像: 未找到处理任务ID
          <br>
          请重新处理图像
        </div>
      `;
      updateProcessingLogs(prevLogs => [...prevLogs, `无法加载图像: 未找到处理任务ID`]);
    }
  };

  // 格式化文件大小的辅助函数
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };
  
  // 用于处理文件更改的处理程序
  const handleChange = (info) => {
    let newFileList = [...info.fileList];
    // 限制最多一个文件
    newFileList = newFileList.slice(-1);
    
    // 确保文件对象包含原始文件
    newFileList = newFileList.map(file => {
      if (file.originFileObj) {
        return file;
      }
      return {
        ...file,
        originFileObj: file.originFileObj || file
      };
    });
    
    console.log('文件列表已更新:', newFileList);
    setFileList(newFileList);
  };
  
  // 自定义请求处理函数，让我们控制上传过程
  const dummyRequest = ({ file, onSuccess }) => {
    console.log('dummyRequest接收文件:', file);
    // 这个函数不做任何事情，只是让Upload组件不自动上传
    setTimeout(() => {
      onSuccess("ok");
    }, 0);
  };
  
  // 用于验证上传的文件
  const beforeUpload = (file) => {
    if (!selectedPatientState) {
      console.warn('未选择患者ID');
      message.warning('请先选择患者后再上传文件');
      return false;
    }
    
    console.log('患者ID:', selectedPatientState);
    
    // 检查文件扩展名
    const fileName = file.name;
    const fileExt = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
    const validExt = ALLOWED_EXTENSIONS.some(ext => {
      return fileExt === ext || fileExt === `.${ext}`;
    });
    
    if (!validExt) {
      console.error(`不支持的文件类型: ${fileExt}`);
      message.error(`不支持的文件类型。支持的类型：${ALLOWED_EXTENSIONS.join(', ')}`);
      updateProcessingLogs(prevLogs => [...prevLogs, `不支持的文件类型: ${fileExt}。支持的类型: ${ALLOWED_EXTENSIONS.join(', ')}`]);
      return false;
    }
    
    // 检查文件大小
    if (file.size > MAX_FILE_SIZE) {
      console.error(`文件大小超过限制: ${file.size} > ${MAX_FILE_SIZE}`);
      message.error(`文件大小超过限制。最大支持：${MAX_FILE_SIZE / (1024 * 1024)}MB`);
      updateProcessingLogs(prevLogs => [...prevLogs, `文件大小超过限制: ${formatBytes(file.size)}。最大支持: ${formatBytes(MAX_FILE_SIZE)}`]);
      return false;
    }
    
    // 记录文件信息
    console.log('有效的文件对象:', {
      name: file.name,
      type: file.type,
      size: formatBytes(file.size),
      ext: fileExt
    });
    
    // 添加日志
    updateProcessingLogs(prevLogs => [...prevLogs, `文件验证通过: ${file.name} (${formatBytes(file.size)})`]);
    
    setFileList([file]);
    
    return false; // 手动上传
  };

  // 确保在组件初始渲染时正确同步选择的患者
  useEffect(() => {
    if (selectedPatient && selectedPatient !== selectedPatientState) {
      console.log('从props同步患者ID:', selectedPatient);
      setSelectedPatientState(selectedPatient);
      form.setFieldsValue({ patient: selectedPatient });
    }
  }, [selectedPatient, form]);

  // 新增：用于启动处理的函数
  const startProcessing = async (imageId) => {
    console.log('开始自动处理图像:', imageId);
    updateProcessingLogs(prevLogs => [...prevLogs, `开始自动处理图像: ${imageId}`]);
    
    // 延迟一点时间再开始处理
    setTimeout(() => {
      handleProcess();
    }, 1000);
  };

  const extractVolumeDataFromLogs = (logs) => {
    try {
      // 检查是否有包含体积数据的日志
      const volumeRegex = {
        gm: /gm体积: (\d+(\.\d+)?)/i,
        wm: /wm体积: (\d+(\.\d+)?)/i,
        csf: /csf体积: (\d+(\.\d+)?)/i,
        tiv: /总颅内体积: (\d+(\.\d+)?)/i
      };
      
      const volumeData = {
        gm_volume: null,
        wm_volume: null,
        csf_volume: null,
        tiv_volume: null
      };
      
      let foundData = false;
      
      // 从日志中提取体积数据
      for (const log of logs) {
        for (const [key, regex] of Object.entries(volumeRegex)) {
          const match = log.match(regex);
          if (match && match[1]) {
            const volume = parseFloat(match[1]);
            if (!isNaN(volume)) {
              const volumeKey = key === 'tiv' ? 'tiv_volume' : `${key}_volume`;
              volumeData[volumeKey] = volume;
              foundData = true;
            }
          }
        }
      }
      
      // 如果找到数据，更新状态
      if (foundData) {
        setVolumeData(volumeData);
      }
    } catch (error) {
      console.error('解析体积数据失败:', error);
    }
  };
  
  // 处理删除文件
  const handleRemove = () => {
    setFileList([]);
    setPreviewImage(null);
    return true;
  };

  // 获取任务状态
  const checkStatus = async (taskId) => {
    if (!taskId) {
      console.error('checkStatus: 没有提供taskId');
      updateProcessingLogs(prev => [...prev, '轮询错误: taskId不存在']);
      return;
    }

    try {
      console.log(`检查任务状态: ${taskId}`);
      const response = await axiosInstance.get(`/api/status/${taskId}`);
      
      // 记录完整的响应以便调试
      console.log('状态响应:', response.data);

      // 检查响应中是否有status字段
      if (response.data && response.data.status) {
        const status = response.data.status;
        let logMessage = `任务状态: ${status}`;
        
        // 添加进度信息
        if (response.data.progress !== undefined) {
          const progressValue = Math.round(response.data.progress);
          logMessage += `, 进度: ${progressValue}%`;
          setProgress(progressValue);
        }
        
        // 只有当日志不是最后一条时才添加
        const lastLog = processingLogs[processingLogs.length - 1];
        if (!lastLog || !lastLog.startsWith(logMessage)) {
          updateProcessingLogs(prev => [...prev, logMessage]);
        }
        
        // 处理MATLAB日志 - 检查不同来源的日志
        // 1. matlab_log字段
        if (response.data.matlab_log) {
          const matlabLogs = response.data.matlab_log.split('\n')
            .filter(line => line.trim() !== '')
            .filter(line => !processingLogs.includes(line));
          
          // 添加到处理日志
          if (matlabLogs.length > 0) {
            updateProcessingLogs(prev => [...prev, ...matlabLogs]);
          }
        }
        
        // 2. 检查是否在处理日志中包含体积数据
        if (response.data.logs) {
          const volumeLogs = response.data.logs
            .filter(line => 
              line.includes('gm体积:') || 
              line.includes('wm体积:') || 
              line.includes('csf体积:') || 
              line.includes('总颅内体积:')
            )
            .filter(line => !processingLogs.includes(line));
          
          if (volumeLogs.length > 0) {
            updateProcessingLogs(prev => [...prev, ...volumeLogs]);
          }
        }
        
        // 处理任务完成
        if (status === 'completed' || status === 'success') {
          console.log('任务完成');
          updateProcessingLogs(prev => [...prev, '任务处理完成']);
          setProcessing(false);
          setProcessingStatus({
            status: 'success',
            taskId: taskId
          });
          
          // 获取结果
          await fetchResults(taskId);
          
          // 清理轮询
          stopPolling();
        } 
        // 处理任务失败
        else if (status === 'failed') {
          console.log('任务失败');
          // 添加更详细的失败原因（如果有）
          const errorMessage = response.data.error 
            ? `任务处理失败: ${response.data.error}`
            : '任务处理失败，请检查服务器日志获取详细信息';

          updateProcessingLogs(prev => [...prev, errorMessage]);
          
          // CAT12处理失败特别处理
          if (response.data.error && response.data.error.includes('缺少处理结果文件')) {
            updateProcessingLogs(prev => [...prev, 
              '注意: CAT12无法处理该图像文件。可能原因:',
              '1. 图像格式不兼容',
              '2. 图像分辨率过低',
              '3. 图像质量不足',
              '请尝试使用标准MRI T1文件'
            ]);
          }
          
          setProcessing(false);
          setProcessingStatus({
            status: 'failed',
            taskId: taskId,
            error: response.data.error
          });
          
          // 清理轮询
          stopPolling();
        }
      } else {
        // 没有状态信息，可能是API改变
        console.warn('响应中没有状态信息:', response.data);
        updateProcessingLogs(prev => [...prev, '警告: 响应中没有状态信息']);
      }
    } catch (error) {
      console.error('轮询状态错误:', error);
      
      // 记录详细错误信息
      const errorMessage = error.response 
        ? `轮询错误: ${error.response.status} - ${error.response.data?.message || error.message}`
        : `轮询错误: ${error.message}`;
      
      updateProcessingLogs(prev => [...prev, errorMessage]);
      
      // 如果是404错误（任务不存在）
      if (error.response?.status === 404) {
        console.error('任务不存在，停止轮询');
        updateProcessingLogs(prev => [...prev, "任务不存在，停止轮询"]);
        stopPolling();
        setProcessing(false);
        setProcessingStatus({
          status: 'failed',
          taskId: taskId,
          error: '任务不存在'
        });
      }
    }
  };

  const fetchResults = async (taskId) => {
    if (!taskId) {
      console.error("没有可用的任务ID");
      return;
    }

    try {
      setProcessingState('获取结果');
      updateProcessingLogs(prevLogs => [...prevLogs, `正在获取任务结果，任务ID: ${taskId}`]);
      
      const response = await axios.get(`${API_BASE}/api/tasks/${taskId}`);
      
      if (response.data.status === 'failed') {
        console.error('处理失败:', response.data.error);
        setTaskStatus('failed');
        setTaskProgress(0);
        setTaskError(response.data.error || '处理失败');
        setProcessingState('失败');
        
        updateProcessingLogs(prevLogs => [...prevLogs, `任务处理失败: ${response.data.error || '未知错误'}`]);
        
        return;
      }
      
      if (response.data.status === 'completed' && response.data.results) {
        console.log('处理结果:', response.data.results);
        setTaskResults(response.data.results);
        setTaskStatus('completed');
        setTaskProgress(100);
        setProcessingState('完成');
        
        updateProcessingLogs(prevLogs => [...prevLogs, '任务处理完成，获取结果成功']);
        
        // 使用任务ID设置图像URL
        try {
          // 使用fetchSegmentationImageData函数获取图像
          updateProcessingLogs(prevLogs => [...prevLogs, '获取分割图像数据...']);
          console.log('开始获取分割图像数据...');
          
          // 设置所有图像为加载中状态
          setImageLoading({
            gm: true,
            wm: true,
            csf: true
          });
          
          // 并行获取三种组织的分割图像
          const [gmData, wmData, csfData] = await Promise.all([
            fetchSegmentationImageData(taskId, 'gm'),
            fetchSegmentationImageData(taskId, 'wm'),
            fetchSegmentationImageData(taskId, 'csf')
          ]);
          
          console.log('分割图像数据获取状态:', { 
            gm: !!gmData, 
            wm: !!wmData, 
            csf: !!csfData 
          });
          
          // 设置分割图像
          setSegmentImages({
            gm: gmData,
            wm: wmData,
            csf: csfData
          });
          
          // 更新加载状态
          setImageLoading({
            gm: false,
            wm: false,
            csf: false
          });
          
          updateProcessingLogs(prevLogs => [
            ...prevLogs, 
            `分割图像获取完成: GM=${!!gmData}, WM=${!!wmData}, CSF=${!!csfData}`
          ]);
          
        } catch (error) {
          console.error('获取分割图像时出错:', error);
          updateProcessingLogs(prevLogs => [...prevLogs, `获取分割图像时出错: ${error.message}`]);
          
          // 设置加载状态为false
          setImageLoading({
            gm: false,
            wm: false,
            csf: false
          });
        }
        
        // 如果有回调函数，调用它
        if (onUploadSuccess) {
          onUploadSuccess(response.data.results);
        }
      }
    } catch (error) {
      console.error('获取任务结果时出错:', error);
      updateProcessingLogs(prevLogs => [...prevLogs, `获取任务结果时出错: ${error.message}`]);
      
      setTaskStatus('failed');
      setTaskError('获取结果失败: ' + (error.message || '未知错误'));
      setProcessingState('失败');
    }
  };
  
  // 获取分割图像数据
  const fetchSegmentationImageData = async (taskId, type) => {
    if (!taskId) {
      console.error(`无法获取${type}图像：缺少task_id`);
      return null;
    }

    console.log(`尝试获取分割图像，taskId: ${taskId}, 类型: ${type}`);
    updateProcessingLogs(prevLogs => [...prevLogs, `尝试获取${type}分割图像...`]);
    
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
            updateProcessingLogs(prevLogs => [...prevLogs, `获取${type}图像失败，重试 (${retryCount}/${maxRetries})...`]);
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
            updateProcessingLogs(prevLogs => [...prevLogs, `成功获取${type}图像数据`]);
            return `data:image/png;base64,${data.image}`;
          } else {
            console.error(`图像数据格式错误:`, data);
            updateProcessingLogs(prevLogs => [...prevLogs, `${type}图像数据格式错误`]);
            return null;
          }
        } else {
          console.error(`响应不是JSON格式: ${contentType}`);
          const text = await response.text();
          console.error(`响应内容: ${text.substring(0, 100)}...`);
          updateProcessingLogs(prevLogs => [...prevLogs, `${type}图像响应格式错误: ${contentType}`]);
          return null;
        }
      } catch (error) {
        console.error(`获取${type}图像出错:`, error);
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(`重试 (${retryCount}/${maxRetries})...`);
          updateProcessingLogs(prevLogs => [...prevLogs, `获取${type}图像出错，重试 (${retryCount}/${maxRetries})...`]);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        } else {
          updateProcessingLogs(prevLogs => [...prevLogs, `获取${type}图像最终失败: ${error.message}`]);
          return null;
        }
      }
    }
    
    return null;
  };

  // 处理状态文本和进度
  const formatStatus = (status, progress) => {
    if (status === 'pending') return `等待处理 (${progress}%)`;
    if (status === 'processing') return `处理中 (${progress}%)`;
    if (status === 'completed') return `处理完成 (${progress}%)`;
    if (status === 'failed') return `处理失败 (${progress}%)`;
    return `未知状态 (${progress}%)`;
  };

  return (
    <div className="image-upload-container">
      <Card title="MRI图像上传与处理">
        <Form form={form} layout="vertical">
        {!hidePatientSelect && (
            <Form.Item 
              label="选择患者" 
              name="patient"
              rules={[{ required: true, message: '请选择患者' }]}
              initialValue={selectedPatientState}
            >
          <div className="patient-selector">
            <Select
              style={{ width: '100%' }}
              placeholder="请选择患者"
                  value={selectedPatientState}
                  onChange={handlePatientChange}
              options={patients.map(p => ({ label: p.name, value: p.id }))}
            />
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => setShowPatientModal(true)}
            >
              新建患者
            </Button>
          </div>
            </Form.Item>
          )}
          
          <Form.Item label="上传MRI图像">
            <Upload.Dragger
              name="file"
              fileList={fileList}
              beforeUpload={beforeUpload}
              onChange={handleChange}
              onRemove={handleRemove}
              customRequest={dummyRequest}
              maxCount={1}
              multiple={false}
              showUploadList={{
                showRemoveIcon: true,
                showPreviewIcon: false
              }}
              accept={ALLOWED_EXTENSIONS.join(',')}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持的格式: {ALLOWED_EXTENSIONS.join(', ')}
              </p>
              <p className="ant-upload-hint">
                最大文件大小: {formatBytes(MAX_FILE_SIZE)}
              </p>
            </Upload.Dragger>
          </Form.Item>
          
          {/* 添加预览图区域 */}
          {(previewImage || imageLoading) && (
          <div className="preview-section">
              <h3>预览图</h3>
            {imageLoading ? (
                <div className="image-loading-container">
                  <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
                  <div className="image-loading-text">处理预览图中...</div>
              </div>
              ) : previewImage ? (
                <div className="preview-image-container">
              <img 
                src={previewImage} 
                    alt="上传预览" 
                    style={{ maxWidth: '100%', maxHeight: '300px' }} 
                    crossOrigin="anonymous"
                    onError={(e) => handleImageError(e, 'preview')}
                  />
                </div>
              ) : (
                <div className="upload-placeholder">
                  <FileImageOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />
                  <p>上传后显示预览图</p>
                </div>
            )}
          </div>
        )}

          <Row gutter={16}>
            <Col span={12}>
        <Button
          type="primary"
          onClick={handleUpload}
                disabled={fileList.length === 0 || uploading}
          loading={uploading}
                block
        >
                {uploading ? '上传中...' : '上传图像'}
        </Button>
            </Col>
            <Col span={12}>
          <Button
            type="primary"
            onClick={() => handleProcess()}
                disabled={!uploadedImageId || processing}
                loading={processing}
                block
          >
                {processing ? '处理中...' : '开始处理'}
          </Button>
            </Col>
          </Row>
          
          {progress > 0 && (
            <Progress 
              percent={progress} 
              status={processing ? "active" : undefined} 
              style={{ marginTop: 16 }}
            />
          )}
          
          {/* 处理日志 */}
        {processingLogs.length > 0 && (
          <div className="processing-logs">
            <h3>处理日志</h3>
            <List
              size="small"
              bordered
              dataSource={processingLogs}
                renderItem={log => (
                <List.Item>
                    <pre>{log}</pre>
                </List.Item>
              )}
            />
          </div>
        )}
          
          {/* 处理结果显示 */}
          {((processingStatus && processingStatus.status === 'success') || 
            (typeof processingStatus === 'string' && processingStatus === 'success')) && volumeData && (
            <div className="results-section">
              <h3>脑组织体积分析结果</h3>
              <div className="volume-data">
                <div className="volume-item gm-item">
                  <div className="volume-icon">
                    <svg viewBox="0 0 100 100" width="40" height="40">
                      <circle cx="50" cy="50" r="45" fill="#91caff" />
                      <text x="50" y="55" fontSize="20" fontWeight="bold" fill="#fff" textAnchor="middle">GM</text>
                    </svg>
                  </div>
                  <div className="volume-content">
                    <div className="volume-label">灰质 (Gray Matter)</div>
                    <div className="volume-value">
                      {volumeData.gm_volume.toFixed(2)} mm³
                      <span className="volume-percent">
                        ({((volumeData.gm_volume / volumeData.tiv_volume) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
                <div className="volume-item wm-item">
                  <div className="volume-icon">
                    <svg viewBox="0 0 100 100" width="40" height="40">
                      <circle cx="50" cy="50" r="45" fill="#ffd591" />
                      <text x="50" y="55" fontSize="20" fontWeight="bold" fill="#fff" textAnchor="middle">WM</text>
                    </svg>
                  </div>
                  <div className="volume-content">
                    <div className="volume-label">白质 (White Matter)</div>
                    <div className="volume-value">
                      {volumeData.wm_volume.toFixed(2)} mm³
                      <span className="volume-percent">
                        ({((volumeData.wm_volume / volumeData.tiv_volume) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
                <div className="volume-item csf-item">
                  <div className="volume-icon">
                    <svg viewBox="0 0 100 100" width="40" height="40">
                      <circle cx="50" cy="50" r="45" fill="#b7eb8f" />
                      <text x="50" y="55" fontSize="20" fontWeight="bold" fill="#fff" textAnchor="middle">CSF</text>
                    </svg>
                  </div>
                  <div className="volume-content">
                    <div className="volume-label">脑脊液 (CSF)</div>
                    <div className="volume-value">
                      {volumeData.csf_volume.toFixed(2)} mm³
                      <span className="volume-percent">
                        ({((volumeData.csf_volume / volumeData.tiv_volume) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
                <div className="volume-item tiv-item">
                  <div className="volume-icon">
                    <svg viewBox="0 0 100 100" width="40" height="40">
                      <circle cx="50" cy="50" r="45" fill="#722ed1" />
                      <text x="50" y="55" fontSize="20" fontWeight="bold" fill="#fff" textAnchor="middle">TIV</text>
                    </svg>
                  </div>
                  <div className="volume-content">
                    <div className="volume-label">总颅内体积 (TIV)</div>
                    <div className="volume-value">
                      {volumeData.tiv_volume.toFixed(2)} mm³
                      <span className="volume-unit">
                        ({(volumeData.tiv_volume / 1000).toFixed(2)} cm³)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="volume-chart">
                <div className="chart-bars">
                  <div 
                    className="chart-bar gm-bar" 
                    style={{width: `${(volumeData.gm_volume / volumeData.tiv_volume) * 100}%`}}
                    title={`灰质: ${((volumeData.gm_volume / volumeData.tiv_volume) * 100).toFixed(1)}%`}
                  ></div>
                  <div 
                    className="chart-bar wm-bar" 
                    style={{width: `${(volumeData.wm_volume / volumeData.tiv_volume) * 100}%`}}
                    title={`白质: ${((volumeData.wm_volume / volumeData.tiv_volume) * 100).toFixed(1)}%`}
                  ></div>
                  <div 
                    className="chart-bar csf-bar" 
                    style={{width: `${(volumeData.csf_volume / volumeData.tiv_volume) * 100}%`}}
                    title={`脑脊液: ${((volumeData.csf_volume / volumeData.tiv_volume) * 100).toFixed(1)}%`}
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
          
          {/* 分割图像显示 */}
          {taskStatus === 'completed' && (
            <div className="processed-images">
              <h3>脑组织分割图像</h3>
              <div className="images-grid">
                <div className="image-item">
                  <h5>灰质 (GM)</h5>
                  {imageLoading.gm ? (
                    <div className="image-loading">
                      <Spin tip="正在加载图像..." />
                    </div>
                  ) : segmentImages.gm ? (
                    <img
                      src={segmentImages.gm}
                      alt="灰质分割结果"
                      className="preview-image"
                      data-image-id={`${currentTaskId}-gm`}
                      data-task-id={currentTaskId}
                      onError={(e) => handleImageError(e, 'gm')}
                    />
                  ) : (
                    <div className="image-load-error">
                      <div className="error-overlay">无法加载灰质图像</div>
                    </div>
                  )}
                </div>
                
                <div className="image-item">
                  <h5>白质 (WM)</h5>
                  {imageLoading.wm ? (
                    <div className="image-loading">
                      <Spin tip="正在加载图像..." />
                    </div>
                  ) : segmentImages.wm ? (
                    <img
                      src={segmentImages.wm}
                      alt="白质分割结果"
                      className="preview-image"
                      data-image-id={`${currentTaskId}-wm`}
                      data-task-id={currentTaskId}
                      onError={(e) => handleImageError(e, 'wm')}
                    />
                  ) : (
                    <div className="image-load-error">
                      <div className="error-overlay">无法加载白质图像</div>
                    </div>
                  )}
                </div>
                
                <div className="image-item">
                  <h5>脑脊液 (CSF)</h5>
                  {imageLoading.csf ? (
                    <div className="image-loading">
                      <Spin tip="正在加载图像..." />
                    </div>
                  ) : segmentImages.csf ? (
                    <img
                      src={segmentImages.csf}
                      alt="脑脊液分割结果"
                      className="preview-image"
                      data-image-id={`${currentTaskId}-csf`}
                      data-task-id={currentTaskId}
                      onError={(e) => handleImageError(e, 'csf')}
                    />
                  ) : (
                    <div className="image-load-error">
                      <div className="error-overlay">无法加载脑脊液图像</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* 处理成功但没有分割结果的情况 */}
          {((processingStatus && processingStatus.status === 'success') || 
             (typeof processingStatus === 'string' && processingStatus === 'success')) && 
           Object.keys(processedImages || {}).length === 0 && (
            <Alert
              message="处理成功但未找到分割结果"
              description="CAT12处理完成，但未能生成分割图像。这可能是因为输入图像格式不兼容或分辨率不足。请尝试使用标准MRI T1文件。"
              type="warning"
              showIcon
              style={{ marginTop: 20 }}
            />
          )}
          
          {/* 处理失败的情况 */}
          {((processingStatus && processingStatus.status === 'failed') ||
             (typeof processingStatus === 'string' && processingStatus === 'failed')) && (
            <Alert
              message="处理失败"
              description={
                processingStatus && typeof processingStatus === 'object' && processingStatus.error ? 
                `图像处理失败: ${processingStatus.error}` :
                "图像处理失败。这可能是因为图像格式不兼容、分辨率过低或服务器处理错误。请查看处理日志了解详情，并尝试使用标准T1加权MRI图像。"
              }
              type="error"
              showIcon
              style={{ marginTop: 20 }}
            />
          )}
        </Form>
        
        {/* 创建患者的模态框 */}
      <Modal
        title="新建患者"
        open={showPatientModal}
        onCancel={() => setShowPatientModal(false)}
        footer={null}
      >
        <Form
            form={addPatientForm}
          onFinish={handleCreatePatient}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入患者姓名' }]}
          >
            <Input />
          </Form.Item>
          
          <Form.Item
            name="patient_id"
            label="患者ID"
            rules={[{ required: true, message: '请输入患者ID' }]}
          >
            <Input />
          </Form.Item>
          
          <Form.Item
            name="age"
            label="年龄"
            rules={[{ required: true, message: '请输入患者年龄' }]}
          >
            <InputNumber min={0} max={150} style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name="gender"
            label="性别"
            rules={[{ required: true, message: '请选择患者性别' }]}
          >
            <Select>
                <Select.Option value="男">男</Select.Option>
                <Select.Option value="女">女</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item>
            <Button type="primary" htmlType="submit">
              创建
            </Button>
            <Button onClick={() => setShowPatientModal(false)} style={{ marginLeft: 8 }}>
              取消
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
    </div>
  );
};

export default ImageUpload; 