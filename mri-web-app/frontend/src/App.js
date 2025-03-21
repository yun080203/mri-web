// 导入 React 库中的 useState 和 useReducer 钩子，用于在函数组件中添加状态管理
import React, { useState, useReducer } from 'react';
// 导入 axios 库，用于发送 HTTP 请求
import axios from 'axios';
// 新增：导入 react-router-dom 中的 BrowserRouter 重命名为 Router，Routes 和 Route 组件
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import DICOMViewer from './components/Viewer/DICOMViewer';
// 导入 ImageViewer 和 ComparisonView 组件
import ImageViewer from './components/Viewer/ImageViewer';
import ComparisonView from './components/Viewer/ComparisonView';
import DataManager from './components/DataManagement/DataManager';
import './styles/dicom.css';
import './styles/App.css';
// 新增环境变量配置
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

// 使用useReducer整合状态
const initialState = {
    taskId: null,
    status: 'idle', // 'idle' | 'uploading' | 'processing' | 'completed' | 'failed'
    progress: 0,
    result: null,
    error: null
};

function uploadReducer(state, action) {
    switch (action.type) {
        case 'START_UPLOAD':
            return { ...state, status: 'uploading', progress: 0 };
        case 'UPDATE_PROGRESS':
            return { ...state, progress: action.payload };
        case 'PROCESS_START':
            return { ...state, status: 'processing', taskId: action.payload };
        case 'SUCCESS':
            return { ...state, status: 'completed', result: action.payload };
        case 'ERROR':
            return { ...state, status: 'failed', error: action.payload };
        default:
            return state;
    }
}

// 定义一个名为 App 的函数组件，这是整个应用的根组件
function App() {
    // 使用 useState 钩子创建状态变量 selectedFile，用于存储用户选择的文件
    const [selectedFile, setSelectedFile] = useState(null);
    // 使用 useReducer 管理上传状态
    const [state, dispatch] = useReducer(uploadReducer, initialState);

    // 定义一个处理文件选择事件的函数
    const handleFileChange = (e) => {
        setSelectedFile(e.target.files[0]);
    };

    // 添加可恢复上传功能
    const handleUpload = async () => {
        if (!selectedFile) return;

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('patient_name', '测试患者'); // 添加默认患者信息
        formData.append('patient_id', 'test-' + Date.now());
        
        try {
            dispatch({ type: 'START_UPLOAD' });
            
            console.log('开始上传文件:', selectedFile.name);
            const response = await axios.post(`${API_BASE}/api/process`, formData, {
                cancelToken: source.token,
                onUploadProgress: (e) => {
                    const progress = Math.round((e.loaded * 100) / e.total);
                    dispatch({ type: 'UPDATE_PROGRESS', payload: progress });
                }
            });

            console.log('上传响应:', response.data);

            // 启动轮询机制
            const pollResult = async (taskId) => {
                try {
                    console.log('开始轮询任务状态:', taskId);
                    const { data } = await axios.get(`${API_BASE}/api/tasks/${taskId}`);
                    console.log('任务状态:', data);
                    
                    if (data.status === 'completed') {
                        dispatch({ type: 'SUCCESS', payload: data.results });
                        return;
                    } else if (data.status === 'failed') {
                        throw new Error(data.error || '处理失败');
                    }
                    
                    setTimeout(() => pollResult(taskId), 2000);
                } catch (error) {
                    console.error('轮询错误:', error);
                    dispatch({ type: 'ERROR', payload: error.message });
                }
            };

            pollResult(response.data.task_id);
        } catch (error) {
            console.error('上传错误:', error);
            if (error.response) {
                // 服务器响应了，但状态码不在 2xx 范围内
                console.error('错误响应:', error.response.data);
                dispatch({ type: 'ERROR', payload: error.response.data.error || '上传失败' });
            } else if (error.request) {
                // 请求已发出，但没有收到响应
                console.error('未收到响应:', error.request);
                dispatch({ type: 'ERROR', payload: '服务器无响应' });
            } else {
                // 发送请求时出了点问题
                console.error('请求错误:', error.message);
                dispatch({ type: 'ERROR', payload: error.message });
            }
        }
        
        return () => source.cancel();
    };

    // 返回 JSX 元素，用于渲染组件的 UI
    return (
        <Router>
            <div className="app-container">
                <nav className="main-nav">
                    <Link to="/">首页</Link>
                    <Link to="/upload">上传图像</Link>
                    <Link to="/compare">图像对比</Link>
                    <Link to="/data">数据管理</Link>
                </nav>

                <main className="main-content">
                    <Routes>
                        <Route path="/" element={
                            <div className="home-page">
                                <h1>MRI图像处理系统</h1>
                                <p>欢迎使用MRI图像处理系统，请选择以下功能：</p>
                                <div className="feature-grid">
                                    <Link to="/upload" className="feature-card">
                                        <h3>上传图像</h3>
                                        <p>上传并处理MRI图像</p>
                                    </Link>
                                    <Link to="/compare" className="feature-card">
                                        <h3>图像对比</h3>
                                        <p>对比原始图像和处理结果</p>
                                    </Link>
                                    <Link to="/data" className="feature-card">
                                        <h3>数据管理</h3>
                                        <p>管理患者数据和报告</p>
                                    </Link>
                                </div>
                            </div>
                        } />
                        
                        <Route path="/upload" element={
                            <div className="upload-page">
                                <h2>上传MRI图像</h2>
                                <div className="upload-section">
                                    <input type="file" onChange={handleFileChange} accept=".dcm,.nii,.nii.gz" />
                                    <button onClick={handleUpload} disabled={!selectedFile || state.status === 'uploading'}>
                                        {state.status === 'uploading' ? '上传中...' : '上传'}
                                    </button>
                                    {state.progress > 0 && (
                                        <div className="progress-bar">
                                            <div 
                                                className="progress-fill"
                                                style={{ width: `${state.progress}%` }}
                                            ></div>
                                        </div>
                                    )}
                                </div>
                                {selectedFile && (
                                    <div className="preview-section">
                                        <h3>图像预览</h3>
                                        <DICOMViewer imageUrl={URL.createObjectURL(selectedFile)} />
                                    </div>
                                )}
                                {state.error && (
                                    <div className="error-message">
                                        {state.error}
                                    </div>
                                )}
                            </div>
                        } />
                        
                        <Route path="/compare" element={
                            <ComparisonView 
                                originalImage={selectedFile ? URL.createObjectURL(selectedFile) : null}
                                processedImage={state.result ? `${API_BASE}/uploads/${state.result}` : null}
                            />
                        } />
                        
                        <Route path="/data" element={<DataManager />} />
                    </Routes>
                </main>
            </div>
        </Router>
    );
}

// 导出 App 组件，以便在其他文件中使用
export default App;