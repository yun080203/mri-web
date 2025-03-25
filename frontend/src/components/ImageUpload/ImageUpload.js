import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { message, Upload, Button, Space, Card, Progress, List, Select, Modal, Form, Input, InputNumber } from 'antd';
import { UploadOutlined, PlusOutlined } from '@ant-design/icons';
import './ImageUpload.css';
import { axiosInstance } from '../../utils/axiosConfig';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

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

const ALLOWED_EXTENSIONS = ['.dcm', '.nii', '.nii.gz'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

const ImageUpload = ({ selectedPatient, onUploadSuccess, hidePatientSelect, autoProcess = false }) => {
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [uploadedImageId, setUploadedImageId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [processingLogs, setProcessingLogs] = useState([]);
  const [patients, setPatients] = useState([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [form] = Form.useForm();

  // 获取患者列表
  useEffect(() => {
    if (!hidePatientSelect) {
      fetchPatients();
    }
  }, [hidePatientSelect]);

  const fetchPatients = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/patients`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      setPatients(response.data.patients);
    } catch (error) {
      message.error('获取患者列表失败');
      console.error('获取患者列表错误:', error);
    }
  };

  const handleCreatePatient = async (values) => {
    try {
      const response = await axios.post(`${API_BASE}/api/patients`, values, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.data.success) {
        message.success('患者创建成功');
        setShowPatientModal(false);
        form.resetFields();
        fetchPatients();
        form.setFieldsValue({ patient: response.data.patient.id });
      }
    } catch (error) {
      message.error('创建患者失败');
      console.error('创建患者错误:', error);
    }
  };

  const handleUpload = async () => {
    const patientId = selectedPatient || form.getFieldValue('patient');
    if (!patientId) {
      message.error('请先选择患者');
      return;
    }

    setUploading(true);
    setProgress(0);
    setProcessingLogs([]);
    // 不清除预览图，保留用户上传时的预览
    // setPreviewImage(null);

    try {
      const formData = new FormData();
      formData.append('file', fileList[0]);
      formData.append('patient_id', patientId);

      const response = await axiosInstance.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percentCompleted);
        }
      });

      console.log('上传响应:', response.data);

      // 检查响应数据
      if (!response.data) {
        throw new Error('服务器没有返回数据');
      }

      if (response.data.message === '文件上传成功' && response.data.image) {
        // 成功处理
        const imageId = response.data.image.id || response.data.image._id;
        console.log('设置图像ID:', imageId);
        setUploadedImageId(imageId);
        message.success('上传成功');
        setProcessingLogs(prevLogs => [...prevLogs, `文件上传成功: ${response.data.image.filename || fileList[0].name}`]);
        
        if (onUploadSuccess) {
          onUploadSuccess(response.data.image);
        }

        // 如果服务器返回了预览图数据，直接使用
        if (response.data.image.preview) {
          setPreviewImage(`data:image/png;base64,${response.data.image.preview}`);
          setProcessingLogs(prevLogs => [...prevLogs, '预览图获取成功']);
        }
        // 否则尝试单独获取预览图
        else if (response.data.image.filename) {
          try {
            await fetchPreviewImage(response.data.image.filename);
          } catch (error) {
            console.error('获取预览图失败，保留原有预览');
            // 预览获取失败时保留原有预览，不影响后续处理
          }
        }

        console.log('上传完成，uploadedImageId:', imageId, '处理状态:', processing);
      } else {
        throw new Error(response.data.message || '上传失败');
      }
    } catch (error) {
      console.error('上传错误:', error);
      setProcessingLogs(prevLogs => [...prevLogs, `上传失败: ${error.message || '未知错误'}`]);
      message.error(error.response?.data?.message || error.message || '上传失败');
    } finally {
      setUploading(false);
      setProgress(0);
      setFileList([]);
    }
  };

  const fetchPreviewImage = async (filename) => {
    if (!filename) {
      console.error('获取预览图失败: 文件名为空');
      return;
    }

    setImageLoading(true);
    try {
      // 使用相对路径，让axiosInstance处理baseURL
      const response = await axiosInstance.get(`/api/preview/${filename}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        // 添加withCredentials配置
        withCredentials: true
      });
      
      console.log('预览图响应:', response.data);
      
      if (response.data.status === 'success' && response.data.image) {
        setPreviewImage(`data:image/png;base64,${response.data.image}`);
        setProcessingLogs(prevLogs => [...prevLogs, '预览图生成成功']);
      } else {
        throw new Error(response.data.message || '获取预览图失败：服务器返回的数据格式不正确');
      }
    } catch (error) {
      console.error('获取预览图失败:', error);
      setProcessingLogs(prevLogs => [...prevLogs, `获取预览图失败: ${error.message || '未知错误'}`]);
      // 不显示错误消息，因为预览图获取失败不影响主要功能
      // message.error('获取预览图失败');
    } finally {
      setImageLoading(false);
    }
  };

  const handleProcess = async (imageId = null) => {
    const targetImageId = imageId || uploadedImageId;
    if (!targetImageId) {
      message.error('没有可处理的图像');
      return;
    }

    setProcessing(true);
    setProcessingLogs(prevLogs => [...prevLogs, '开始处理图像...']);

    try {
      console.log('开始处理图像, imageId:', targetImageId);
      const response = await axiosInstance.post('/api/process', {
        image_id: targetImageId
      });

      console.log('处理响应:', response.data);

      if (response.data.task_id) {
        setProcessingLogs(prevLogs => [...prevLogs, `任务ID: ${response.data.task_id}`]);
        // 立即开始轮询状态
        pollProcessingStatus(response.data.task_id);
      } else {
        throw new Error('未获取到任务ID');
      }
    } catch (error) {
      console.error('处理请求失败:', error);
      setProcessingLogs(prevLogs => [...prevLogs, `处理失败: ${error.message || '未知错误'}`]);
      message.error('处理请求失败');
      setProcessing(false);
    }
  };

  const pollProcessingStatus = async (taskId) => {
    if (!taskId) {
      console.error('轮询错误: 未提供taskId');
      setProcessing(false);
      return;
    }

    let pollCount = 0;
    let startTime = Date.now();
    const PHASE_1_DURATION = 7 * 60 * 1000;   // 7分钟
    const PHASE_2_DURATION = 13 * 60 * 1000;  // 13分钟
    const MAX_DURATION = 30 * 60 * 1000;      // 30分钟
    let pollTimer = null;

    const getPollingInterval = () => {
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < PHASE_1_DURATION) {
        return 30000; // 0-7分钟：30秒
      } else if (elapsedTime < PHASE_2_DURATION) {
        return 10000; // 7-13分钟：10秒（高频期）
      } else {
        return 60000; // 13分钟后：60秒
      }
    };

    const checkStatus = async () => {
      try {
        const elapsedTime = Date.now() - startTime;
        const elapsedMinutes = Math.floor(elapsedTime / 60000);
        const elapsedSeconds = Math.floor((elapsedTime % 60000) / 1000);
        const currentInterval = getPollingInterval() / 1000;
        
        console.log(`检查处理状态 (${pollCount + 1}次, 已耗时: ${elapsedMinutes}分${elapsedSeconds}秒, 当前轮询间隔: ${currentInterval}秒), taskId:`, taskId);
        const response = await axiosInstance.get(`/api/status/${taskId}`, {
          withCredentials: true,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        console.log('状态响应:', response.data);

        if (!response.data) {
          throw new Error('未收到状态数据');
        }

        const status = response.data.status;
        
        // 只在状态变化时添加日志
        if (!processingLogs.includes(`当前状态: ${status}`)) {
          const phase = elapsedTime < PHASE_1_DURATION ? '初始阶段' : 
                       elapsedTime < PHASE_2_DURATION ? '高频检查阶段' : '最终阶段';
          setProcessingLogs(prevLogs => [...prevLogs, `当前状态: ${status} (${phase})`]);
        }

        if (status === 'completed' || status === 'success') {
          clearInterval(pollTimer);
          setProcessing(false);
          setProcessingLogs(prevLogs => [...prevLogs, `处理完成 (总耗时: ${elapsedMinutes}分${elapsedSeconds}秒)`]);
          await fetchResults(taskId);
          message.success('处理完成');
          return;
        } else if (status === 'failed' || status === 'error') {
          clearInterval(pollTimer);
          setProcessing(false);
          const errorMsg = response.data.error || '处理失败';
          setProcessingLogs(prevLogs => [...prevLogs, `错误: ${errorMsg} (总耗时: ${elapsedMinutes}分${elapsedSeconds}秒)`]);
          message.error(errorMsg);
          return;
        }

        // 更新进度信息（只在进度变化时添加日志）
        if (response.data.progress) {
          const progressMsg = `进度: ${response.data.progress}`;
          if (!processingLogs.includes(progressMsg)) {
            setProcessingLogs(prevLogs => [...prevLogs, progressMsg]);
          }
        }

        pollCount++;
        
        // 检查是否超时
        if (elapsedTime >= MAX_DURATION) {
          clearInterval(pollTimer);
          setProcessing(false);
          setProcessingLogs(prevLogs => [...prevLogs, `处理超时（${MAX_DURATION / 60000}分钟）`]);
          message.error(`处理超时（${MAX_DURATION / 60000}分钟）`);
          return;
        }

        // 根据当前阶段调整轮询间隔
        const newInterval = getPollingInterval();
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = setInterval(checkStatus, newInterval);
        }

      } catch (error) {
        console.error('检查状态失败:', error);
        const errorMsg = `检查状态失败: ${error.message || '未知错误'}`;
        if (!processingLogs.includes(errorMsg)) {
          setProcessingLogs(prevLogs => [...prevLogs, errorMsg]);
        }
        
        // 如果是网络错误，继续轮询
        if (error.response?.status >= 500 || error.code === 'ECONNABORTED' || error.message === 'Network Error') {
          if (!processingLogs.includes('网络错误，继续轮询...')) {
            setProcessingLogs(prevLogs => [...prevLogs, '网络错误，继续轮询...']);
          }
          return; // 继续轮询
        } else {
          clearInterval(pollTimer);
          setProcessing(false);
          message.error('检查状态失败');
        }
      }
    };

    // 立即执行一次状态检查
    await checkStatus();
    
    // 设置初始轮询间隔
    pollTimer = setInterval(checkStatus, getPollingInterval());

    // 清理函数
    return () => {
      if (pollTimer) {
        clearInterval(pollTimer);
      }
    };
  };

  const fetchResults = async (taskId) => {
    if (!taskId) {
      console.error('获取结果错误: 未提供taskId');
      return;
    }

    try {
      console.log('获取处理结果, taskId:', taskId);
      const response = await axiosInstance.get(`/api/results/${taskId}`);
      console.log('结果响应:', response.data);

      if (response.data.status === 'success') {
        setProcessingLogs(prevLogs => [...prevLogs, '成功获取处理结果']);
        
        // 显示结果
        if (response.data.results) {
          const results = response.data.results;
          setProcessingLogs(prevLogs => [
            ...prevLogs,
            '处理结果:',
            ...Object.entries(results).map(([key, value]) => {
              if (typeof value === 'number') {
                // 对体积数据进行格式化
                if (key.includes('volume')) {
                  return `${key}: ${value.toFixed(2)} mm³`;
                }
                return `${key}: ${value.toFixed(2)}`;
              }
              return `${key}: ${value}`;
            })
          ]);

          // 如果有预览图，显示预览
          if (response.data.preview) {
            setPreviewImage(`data:image/png;base64,${response.data.preview}`);
          }

          // 如果有分割结果图像，也显示
          if (response.data.segmented_preview) {
            setProcessingLogs(prevLogs => [...prevLogs, '分割结果图像已生成']);
          }
        }
      } else {
        throw new Error(response.data.message || '获取结果失败');
      }
    } catch (error) {
      console.error('获取结果失败:', error);
      setProcessingLogs(prevLogs => [...prevLogs, `获取结果失败: ${error.message || '未知错误'}`]);
      message.error('获取结果失败');
    }
  };

  const validateFile = (file) => {
    const extension = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      message.error(`不支持的文件类型。支持的类型：${ALLOWED_EXTENSIONS.join(', ')}`);
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      message.error(`文件大小超过限制。最大支持：${MAX_FILE_SIZE / (1024 * 1024)}MB`);
      return false;
    }
    return true;
  };

  const uploadProps = {
    onRemove: file => {
      const index = fileList.indexOf(file);
      const newFileList = fileList.slice();
      newFileList.splice(index, 1);
      setFileList(newFileList);
      setPreviewImage(null);
    },
    beforeUpload: async file => {
      if (!validateFile(file)) {
        return false;
      }
      
      // 如果是图像文件，直接预览
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviewImage(e.target.result);
          setImageLoading(false);
        };
        reader.readAsDataURL(file);
      } else {
        // 对于DICOM或NIfTI文件，发送到服务器生成预览
        setImageLoading(true);
        try {
          const formData = new FormData();
          formData.append('file', file);
          const response = await axios.post(`${API_BASE}/api/preview`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });

          if (response.data.status === 'success') {
            setPreviewImage(`data:image/png;base64,${response.data.image}`);
          }
        } catch (error) {
          console.error('预览生成失败:', error);
          message.error('无法生成预览图');
        } finally {
          setImageLoading(false);
        }
      }
      
      setFileList([file]);
      return false;
    },
    fileList,
    accept: ALLOWED_EXTENSIONS.join(','),
  };

  return (
    <Card title="图像上传与处理" className="image-upload-container">
      <Space direction="vertical" style={{ width: '100%' }}>
        {!hidePatientSelect && (
          <div className="patient-selector">
            <Select
              style={{ width: '100%' }}
              placeholder="请选择患者"
              onChange={value => form.setFieldsValue({ patient: value })}
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
        )}

        <div className="upload-section">
          <Upload {...uploadProps}>
            <Button icon={<UploadOutlined />}>选择文件</Button>
          </Upload>
          <div className="upload-tips">
            <p>支持的文件类型：{ALLOWED_EXTENSIONS.join(', ')}</p>
            <p>最大文件大小：{MAX_FILE_SIZE / (1024 * 1024)}MB</p>
          </div>
        </div>
        
        <Button
          type="primary"
          onClick={handleUpload}
          disabled={fileList.length === 0 || (!selectedPatient && !form.getFieldValue('patient'))}
          loading={uploading}
          style={{ marginTop: 16 }}
        >
          {uploading ? '上传中' : '开始上传'}
        </Button>

        {progress > 0 && (
          <Progress percent={progress} status={progress === 100 ? "success" : "active"} />
        )}

        {previewImage && (
          <div className="preview-section">
            {imageLoading ? (
              <div className="image-loading">
                <div className="spinner"></div>
                <p>加载预览图...</p>
              </div>
            ) : previewImage === 'error' ? (
              <div className="preview-error">
                <p>预览图加载失败</p>
              </div>
            ) : (
              <img 
                src={previewImage} 
                alt="预览" 
                className="preview-image"
                loading="lazy"
              />
            )}
          </div>
        )}

        {uploadedImageId && !processing && (
          <Button
            type="primary"
            onClick={() => handleProcess()}
            style={{ marginTop: 16 }}
          >
            开始处理
          </Button>
        )}

        {processing && (
          <div style={{ marginTop: 16 }}>
            <Progress percent={progress} status={progress === 100 ? "success" : "active"} />
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              正在处理图像...
            </div>
          </div>
        )}

        {processingLogs.length > 0 && (
          <div className="processing-logs">
            <h3>处理日志</h3>
            <List
              size="small"
              bordered
              dataSource={processingLogs}
              renderItem={item => (
                <List.Item>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {item}
                  </pre>
                </List.Item>
              )}
            />
          </div>
        )}
      </Space>

      <Modal
        title="新建患者"
        open={showPatientModal}
        onCancel={() => setShowPatientModal(false)}
        footer={null}
      >
        <Form
          form={form}
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
              <Select.Option value="M">男</Select.Option>
              <Select.Option value="F">女</Select.Option>
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
  );
};

export default ImageUpload; 