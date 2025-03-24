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

const ImageUpload = () => {
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [uploadedImageId, setUploadedImageId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [processingLogs, setProcessingLogs] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patients, setPatients] = useState([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [form] = Form.useForm();

  // 获取患者列表
  useEffect(() => {
    fetchPatients();
  }, []);

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
        setSelectedPatient(response.data.patient.id);
      }
    } catch (error) {
      message.error('创建患者失败');
      console.error('创建患者错误:', error);
    }
  };

  const handleUpload = async () => {
    if (!selectedPatient) {
      message.error('请先选择患者');
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', fileList[0]);
      formData.append('patient_id', selectedPatient);

      const response = await axiosInstance.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percentCompleted);
        }
      });

      if (response.data.status === 'success') {
        setUploadedImageId(response.data.file_info.id);
        message.success('上传成功');
        fetchPreviewImage(response.data.file_info.filename);
      }
    } catch (error) {
      console.error('上传错误:', error);
      message.error(error.response?.data?.error || '上传失败');
    } finally {
      setUploading(false);
      setProgress(0);
      setFileList([]);
    }
  };

  const fetchPreviewImage = async (filename) => {
    setImageLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/api/preview/${filename}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      
      if (response.data.status === 'success') {
        setPreviewImage(`data:image/png;base64,${response.data.image}`);
      }
    } catch (error) {
      console.error('获取预览图失败:', error);
      message.error('获取预览图失败');
    } finally {
      setImageLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!uploadedImageId) {
      message.error('请先上传图像');
      return;
    }

    setProcessing(true);
    setProcessingLogs([]);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE}/api/process/${uploadedImageId}`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (response.data.status === 'processing') {
        message.success('开始处理图像');
        pollProcessingStatus(response.data.task_id);
      }
    } catch (error) {
      console.error('处理错误:', error);
      message.error('处理失败');
      setProcessing(false);
    }
  };

  const pollProcessingStatus = async (imageId) => {
    setProcessing(true);
    setProcessingLogs([]);
    
    const interval = setInterval(async () => {
      try {
        const response = await axiosInstance.get(`/api/tasks/${imageId}`);
        const { status, progress, logs } = response.data;
        
        setProgress(progress || 0);
        if (logs) setProcessingLogs(logs);

        if (status === 'completed') {
          clearInterval(interval);
          setProcessing(false);
          message.success('处理完成');
          // 获取处理结果
          fetchResults(imageId);
        } else if (status === 'failed') {
          clearInterval(interval);
          setProcessing(false);
          message.error('处理失败');
        }
      } catch (error) {
        console.error('获取处理状态失败:', error);
        clearInterval(interval);
        setProcessing(false);
        message.error('获取处理状态失败');
      }
    }, 2000);

    return () => clearInterval(interval);
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
    },
    beforeUpload: file => {
      if (!validateFile(file)) {
        return false;
      }
      setFileList([file]);
      return false;
    },
    fileList,
    accept: ALLOWED_EXTENSIONS.join(','),
  };

  return (
    <div className="image-upload-container">
      <Card title="图像上传与处理">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div className="patient-selector">
            <Select
              style={{ width: '100%' }}
              placeholder="请选择患者"
              onChange={setSelectedPatient}
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
            disabled={fileList.length === 0 || !selectedPatient}
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
              <h3>图像预览</h3>
              {imageLoading ? (
                <div className="image-loading">
                  <div className="spinner"></div>
                  <p>加载预览图...</p>
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
              onClick={handleProcess}
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
                renderItem={item => <List.Item>{item}</List.Item>}
              />
            </div>
          )}
        </Space>
      </Card>

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
    </div>
  );
};

export default ImageUpload; 