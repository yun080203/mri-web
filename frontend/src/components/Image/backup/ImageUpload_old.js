import React, { useState } from 'react';
import axios from 'axios';
import './ImageUpload.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

function ImageUpload({ patientId, onUploadSuccess }) {
    const [selectedFile, setSelectedFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [uploadedImage, setUploadedImage] = useState(null);
    const [processingStatus, setProcessingStatus] = useState('idle');
    const [processingLogs, setProcessingLogs] = useState([]);
    const [processedData, setProcessedData] = useState(null);
    const [matlabLog, setMatlabLog] = useState('');

    const handleFileSelect = async (event) => {
        const file = event.target.files[0];
        if (file) {
            setSelectedFile(file);
            setError('');
            setUploadedImage(null);
            setProcessingStatus('idle');
            setProcessingLogs([]);
            setProcessedData(null);
            setMatlabLog('');

            // 使用后端的预览生成功能
            const formData = new FormData();
            formData.append('file', file);
            try {
                const response = await axios.post(`${API_BASE}/api/preview`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                if (response.data.status === 'success' && response.data.image) {
                    setPreview(`data:image/png;base64,${response.data.image}`);
                }
            } catch (error) {
                console.error('预览生成失败:', error);
                setError('无法生成预览图');
            }
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!selectedFile) {
            setError('请选择文件');
            return;
        }

        if (!patientId) {
            setError('请先选择患者');
            return;
        }

        setLoading(true);
        setError('');
        setProcessingStatus('uploading');

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('patient_id', patientId);

        try {
            const response = await axios.post(`${API_BASE}/api/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.data.image) {
                setUploadedImage(response.data.image);
                setProcessingStatus('uploaded');
                if (onUploadSuccess) {
                    onUploadSuccess(response.data);
                }
            }
        } catch (error) {
            console.error('上传失败:', error);
            setError(error.response?.data?.error || error.message || '上传失败，请重试');
            setProcessingStatus('error');
        } finally {
            setLoading(false);
        }
    };

    const handleProcess = async (imageId) => {
        if (!imageId) {
            setError('缺少图像ID');
            setProcessingStatus('error');
            return;
        }

        setProcessingStatus('processing');
        setProcessingLogs([]);
        setProcessedData(null);
        setMatlabLog('');
        
        try {
            const response = await axios.post(
                `${API_BASE}/api/process/${imageId}`,
                {},
                {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                }
            );
            
            if (response.data.task_id) {
                await pollTaskStatus(response.data.task_id);
            } else {
                throw new Error('处理响应中缺少任务ID');
            }
        } catch (error) {
            console.error('处理失败:', error);
            setError(error.response?.data?.error || error.message || '处理失败，请重试');
            setProcessingStatus('error');
        }
    };

    const pollTaskStatus = async (taskId) => {
        try {
            const response = await axios.get(
                `${API_BASE}/api/tasks/${taskId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                }
            );
            
            if (response.data.matlab_log) {
                setMatlabLog(response.data.matlab_log);
            }
            
            if (response.data.status === 'completed') {
                setProcessingStatus('completed');
                if (response.data.results) {
                    setProcessedData(response.data.results);
                }
            } else if (response.data.status === 'failed') {
                setProcessingStatus('error');
                setError('处理失败');
            } else {
                // 继续轮询
                setTimeout(() => pollTaskStatus(taskId), 2000);
            }
        } catch (error) {
            console.error('轮询失败:', error);
            setProcessingStatus('error');
            setError(error.response?.data?.error || error.message || '轮询失败');
        }
    };

    return (
        <div className="image-upload-container">
            <form onSubmit={handleUpload}>
                <div className="file-input-group">
                    <input
                        type="file"
                        onChange={handleFileSelect}
                        accept=".dcm,.nii,.nii.gz"
                        disabled={loading}
                    />
                    <button 
                        type="submit" 
                        disabled={!selectedFile || loading}
                        className={loading ? 'loading' : ''}
                    >
                        {loading ? '上传中...' : '上传'}
                    </button>
                </div>
                
                {error && <div className="error-message">{error}</div>}
                
                {preview && (
                    <div className="preview-container">
                        <h3>图像预览</h3>
                        <img src={preview} alt="预览" className="image-preview" />
                    </div>
                )}

                {uploadedImage && processingStatus === 'uploaded' && (
                    <div className="upload-success">
                        <h3>上传成功</h3>
                        <p>文件名: {uploadedImage.original_filename}</p>
                        <button 
                            onClick={() => handleProcess(uploadedImage.id)}
                            className="process-button"
                        >
                            开始处理
                        </button>
                    </div>
                )}

                {processingStatus === 'processing' && (
                    <div className="processing-status">
                        <div className="spinner"></div>
                        <p>正在处理图像...</p>
                    </div>
                )}

                {matlabLog && (
                    <div className="matlab-log">
                        <h3>CAT12处理日志</h3>
                        <pre className="log-content">
                            {matlabLog}
                        </pre>
                    </div>
                )}

                {processedData && processingStatus === 'completed' && (
                    <div className="processed-data">
                        <h3>处理结果</h3>
                        <div className="data-container">
                            <div className="data-entry">
                                <strong>灰质体积:</strong> {(processedData.gm_volume / 1000).toFixed(2)} ml
                            </div>
                            <div className="data-entry">
                                <strong>白质体积:</strong> {(processedData.wm_volume / 1000).toFixed(2)} ml
                            </div>
                            <div className="data-entry">
                                <strong>脑脊液体积:</strong> {(processedData.csf_volume / 1000).toFixed(2)} ml
                            </div>
                            <div className="data-entry">
                                <strong>颅内总体积:</strong> {(processedData.tiv / 1000).toFixed(2)} ml
                            </div>
                        </div>
                    </div>
                )}
            </form>
        </div>
    );
}

export default ImageUpload; 