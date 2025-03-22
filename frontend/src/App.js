// 导入 React 库中的 useState 和 useReducer 钩子，用于在函数组件中添加状态管理
import React, { useState, useReducer, useRef, useEffect } from 'react';
// 导入 axios 库，用于发送 HTTP 请求
import axios from 'axios';
// 新增：导入 react-router-dom 中的 BrowserRouter 重命名为 Router，Routes 和 Route 组件
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import DICOMViewer from './components/Viewer/DICOMViewer';
// 导入 ImageViewer 和 ComparisonView 组件
import ImageViewer from './components/Viewer/ImageViewer';
import ComparisonView from './components/Viewer/ComparisonView';
import DataManager from './components/DataManagement/DataManager';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import PatientList from './components/Patient/PatientList';
import PatientDetail from './components/Patient/PatientDetail';
import './styles/dicom.css';
import './styles/App.css';
// 新增环境变量配置
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

// 认证状态管理
const authReducer = (state, action) => {
    switch (action.type) {
        case 'LOGIN':
            return { ...state, isAuthenticated: true, user: action.payload };
        case 'LOGOUT':
            return { ...state, isAuthenticated: false, user: null };
        default:
            return state;
    }
};

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
        case 'RESET':
            return initialState;
        default:
            return state;
    }
}

// 将原来的 App 组件重命名为 MainApp
function MainApp() {
    const [authState, authDispatch] = useReducer(authReducer, {
        isAuthenticated: !!localStorage.getItem('token'),
        user: null
    });
    const [state, dispatch] = useReducer(uploadReducer, initialState);
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);
    const [processingProgress, setProcessingProgress] = useState(0);
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [showPatientModal, setShowPatientModal] = useState(false);
    const [newPatient, setNewPatient] = useState({
        name: '',
        patient_id: '',
        age: '',
        gender: ''
    });
    const cancelTokenSource = useRef(null);
    const navigate = useNavigate();
    const pollInterval = useRef(null);

    // 获取患者列表
    useEffect(() => {
        const fetchPatients = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    alert('请先登录');
                    return;
                }

                console.log('获取患者列表，请求头:', {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                });

                const response = await axios.get(`${API_BASE}/api/patients`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.data) {
                    setPatients(response.data.patients);
                }
            } catch (error) {
                console.error('获取患者列表失败:', error.response?.data || error);
                if (error.response?.status === 401) {
                    localStorage.removeItem('token');
                    navigate('/login');
                } else {
                    alert(error.response?.data?.error || '获取患者列表失败，请重试');
                }
            }
        };

        if (authState.isAuthenticated) {
            fetchPatients();
        }
    }, [authState.isAuthenticated, navigate]);

    // 创建新患者
    const handleCreatePatient = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                alert('请先登录');
                return;
            }

            console.log('创建患者数据:', newPatient);
            console.log('请求头:', {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            });

            const response = await axios.post(`${API_BASE}/api/patients`, newPatient, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data) {
                setShowPatientModal(false);
                setNewPatient({
                    name: '',
                    patient_id: '',
                    age: '',
                    gender: ''
                });
                fetchPatients();
            }
        } catch (error) {
            console.error('创建患者失败:', error.response?.data || error);
            if (error.response?.status === 401) {
                localStorage.removeItem('token');
                navigate('/login');
            } else {
                alert(error.response?.data?.error || '创建患者失败，请重试');
            }
        }
    };

    // 配置axios默认值
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
    }, []);

    // 清理函数
    const cleanup = () => {
        if (pollInterval.current) {
            clearTimeout(pollInterval.current);
        }
        if (cancelTokenSource.current) {
            cancelTokenSource.current.cancel('操作已取消');
        }
    };

    // 组件卸载时清理
    useEffect(() => {
        return cleanup;
    }, []);

    // 定义一个处理文件选择事件的函数
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            // 清除之前的状态
            setPreviewImage(null);
            setProcessingProgress(0);
            dispatch({ type: 'RESET' });
        }
    };

    // 修改handleUpload函数
    const handleUpload = async () => {
        if (!selectedFile) {
            alert('请先选择文件');
            return;
        }

        if (!selectedPatient) {
            alert('请先选择或创建患者');
            return;
        }

        // 清理之前的状态
        cleanup();
        cancelTokenSource.current = axios.CancelToken.source();

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('patient_id', selectedPatient.id);
        
        try {
            dispatch({ type: 'START_UPLOAD' });
            
            console.log('开始上传文件:', selectedFile.name);
            const response = await axios.post(`${API_BASE}/api/process`, formData, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                cancelToken: cancelTokenSource.current.token,
                onUploadProgress: (e) => {
                    const progress = Math.round((e.loaded * 100) / e.total);
                    dispatch({ type: 'UPDATE_PROGRESS', payload: progress });
                }
            });

            console.log('上传响应:', response.data);
            
            if (response.data.task_id) {
                dispatch({ type: 'PROCESS_START', payload: response.data.task_id });
                
                // 获取图像预览
                try {
                    const previewResponse = await axios.get(`${API_BASE}/api/preview/${selectedFile.name}`, {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    });
                    if (previewResponse.data.status === 'success') {
                        setPreviewImage(`data:image/png;base64,${previewResponse.data.image}`);
                    }
                } catch (error) {
                    console.error('获取预览失败:', error);
                }

                // 开始轮询进度
                const pollProgress = async () => {
                    try {
                        // 获取处理进度
                        const progressResponse = await axios.get(`${API_BASE}/api/tasks/${response.data.task_id}/progress`);
                        console.log('进度响应:', progressResponse.data);
                        
                        if (progressResponse.data.status === 'success') {
                            setProcessingProgress(progressResponse.data.progress);
                            
                            // 检查任务状态
                            const statusResponse = await axios.get(`${API_BASE}/api/tasks/${response.data.task_id}`);
                            console.log('状态响应:', statusResponse.data);
                            
                            if (statusResponse.data.status === 'completed') {
                                dispatch({ type: 'SUCCESS', payload: statusResponse.data.results });
                                
                                // 获取处理后的图像
                                try {
                                    const processedImageResponse = await axios.get(`${API_BASE}/api/processed/${response.data.task_id}/segmented.nii.gz`);
                                    if (processedImageResponse.data.status === 'success') {
                                        setPreviewImage(`data:image/png;base64,${processedImageResponse.data.image}`);
                                    }
                                } catch (error) {
                                    console.error('获取处理后图像失败:', error);
                                }
                                
                                // 获取分析结果
                                try {
                                    const resultsResponse = await axios.get(`${API_BASE}/api/results/${response.data.task_id}`);
                                    if (resultsResponse.data.status === 'success') {
                                        dispatch({ type: 'SUCCESS', payload: resultsResponse.data.results });
                                    }
                                } catch (error) {
                                    console.error('获取分析结果失败:', error);
                                }
                                
                                cleanup();  // 停止轮询
                            } else if (statusResponse.data.status === 'failed') {
                                throw new Error(statusResponse.data.error || '处理失败');
                            } else {
                                // 继续轮询
                                pollInterval.current = setTimeout(pollProgress, 2000);
                            }
                        }
                    } catch (error) {
                        console.error('轮询错误:', error);
                        dispatch({ type: 'ERROR', payload: error.message });
                        cleanup();  // 停止轮询
                    }
                };

                // 开始首次轮询
                pollProgress();
            }
        } catch (error) {
            if (axios.isCancel(error)) {
                console.log('上传已取消');
                return;
            }
            console.error('上传失败:', error);
            dispatch({ type: 'ERROR', payload: error.message });
        }
    };

    // 受保护的路由组件
    const ProtectedRoute = ({ children }) => {
        if (!authState.isAuthenticated) {
            return <Navigate to="/login" />;
        }
        return children;
    };

    // 返回 JSX 元素，用于渲染组件的 UI
    return (
        <div className="app-container">
            {authState.isAuthenticated && (
                <nav className="main-nav">
                    <Link to="/">首页</Link>
                    <Link to="/upload">上传图像</Link>
                    <Link to="/patients">患者管理</Link>
                    <Link to="/compare">图像对比</Link>
                    <Link to="/data">数据管理</Link>
                    <button onClick={() => {
                        localStorage.removeItem('token');
                        authDispatch({ type: 'LOGOUT' });
                    }}>退出登录</button>
                </nav>
            )}

            <main className="main-content">
                <Routes>
                    <Route path="/login" element={
                        !authState.isAuthenticated ? (
                            <Login onLogin={(userData) => {
                                authDispatch({ type: 'LOGIN', payload: userData });
                            }} />
                        ) : (
                            <Navigate to="/" />
                        )
                    } />
                    
                    <Route path="/register" element={
                        !authState.isAuthenticated ? (
                            <Register />
                        ) : (
                            <Navigate to="/" />
                        )
                    } />
                    
                    <Route path="/" element={
                        <ProtectedRoute>
                            <div className="home-page">
                                <h1>MRI图像处理系统</h1>
                                <p>欢迎使用MRI图像处理系统，请选择以下功能：</p>
                                <div className="feature-grid">
                                    <Link to="/upload" className="feature-card">
                                        <h3>上传图像</h3>
                                        <p>上传并处理MRI图像</p>
                                    </Link>
                                    <Link to="/patients" className="feature-card">
                                        <h3>患者管理</h3>
                                        <p>管理患者信息和历史记录</p>
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
                        </ProtectedRoute>
                    } />
                    
                    <Route path="/upload" element={
                        <ProtectedRoute>
                            <div className="upload-page">
                                <h2>上传MRI图像</h2>
                                <div className="patient-section">
                                    <h2>选择患者</h2>
                                    <div className="patient-selector">
                                        <select
                                            value={selectedPatient?.id || ''}
                                            onChange={(e) => {
                                                const patient = patients.find(p => p.id === parseInt(e.target.value));
                                                setSelectedPatient(patient);
                                            }}
                                        >
                                            <option value="">请选择患者</option>
                                            {patients.map(patient => (
                                                <option key={patient.id} value={patient.id}>
                                                    {patient.name} ({patient.patient_id})
                                                </option>
                                            ))}
                                        </select>
                                        <button onClick={() => setShowPatientModal(true)}>
                                            添加新患者
                                        </button>
                                    </div>
                                </div>
                                <div className="upload-section">
                                    <div className="file-input-container">
                                        <input
                                            type="file"
                                            onChange={handleFileChange}
                                            accept=".dcm,.nii,.nii.gz"
                                            disabled={!selectedPatient}
                                        />
                                        <button
                                            onClick={handleUpload}
                                            disabled={!selectedFile || !selectedPatient || state.status === 'uploading' || state.status === 'processing'}
                                        >
                                            {state.status === 'uploading' ? '上传中...' : 
                                             state.status === 'processing' ? '处理中...' : '上传'}
                                        </button>
                                    </div>
                                </div>

                                {state.status === 'uploading' && (
                                    <div className="progress-section">
                                        <div className="progress-bar">
                                            <div className="progress" style={{ width: `${state.progress}%` }}></div>
                                        </div>
                                        <div className="progress-text">上传进度: {state.progress}%</div>
                                    </div>
                                )}

                                {state.status === 'processing' && (
                                    <div className="progress-section">
                                        <div className="progress-bar">
                                            <div className="progress" style={{ width: `${processingProgress}%` }}></div>
                                        </div>
                                        <div className="progress-text">处理进度: {processingProgress}%</div>
                                    </div>
                                )}

                                {previewImage && (
                                    <div className="preview-section">
                                        <h3>原始图像</h3>
                                        <img src={previewImage} alt="原始DICOM预览" className="preview-image" />
                                    </div>
                                )}

                                {state.result && (
                                    <div className="analysis-section">
                                        <h3>分析结果</h3>
                                        <div className="results-grid">
                                            <div className="result-item">
                                                <h4>灰质体积</h4>
                                                <p>{state.result.gm_volume.toFixed(2)} mm³</p>
                                            </div>
                                            <div className="result-item">
                                                <h4>白质体积</h4>
                                                <p>{state.result.wm_volume.toFixed(2)} mm³</p>
                                            </div>
                                            <div className="result-item">
                                                <h4>脑脊液体积</h4>
                                                <p>{state.result.csf_volume.toFixed(2)} mm³</p>
                                            </div>
                                            <div className="result-item">
                                                <h4>总颅内体积</h4>
                                                <p>{state.result.tiv.toFixed(2)} mm³</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {state.error && (
                                    <div className="error-message">
                                        {state.error}
                                    </div>
                                )}

                                {state.status === 'completed' && (
                                    <div className="success-message">
                                        处理完成！
                                    </div>
                                )}
                            </div>
                        </ProtectedRoute>
                    } />
                    
                    <Route path="/patients" element={
                        <ProtectedRoute>
                            <PatientList />
                        </ProtectedRoute>
                    } />
                    
                    <Route path="/patients/:id" element={
                        <ProtectedRoute>
                            <PatientDetail />
                        </ProtectedRoute>
                    } />
                    
                    <Route path="/compare" element={
                        <ProtectedRoute>
                            <ComparisonView 
                                originalImage={selectedFile ? URL.createObjectURL(selectedFile) : null}
                                processedImage={state.result ? `${API_BASE}/uploads/${state.result}` : null}
                            />
                        </ProtectedRoute>
                    } />
                    
                    <Route path="/data" element={
                        <ProtectedRoute>
                            <DataManager />
                        </ProtectedRoute>
                    } />
                </Routes>
            </main>

            {/* 添加患者模态框 */}
            {showPatientModal && (
                <div className="modal">
                    <div className="modal-content">
                        <h3>添加新患者</h3>
                        <div className="form-group">
                            <label>姓名</label>
                            <input
                                type="text"
                                value={newPatient.name}
                                onChange={(e) => setNewPatient({...newPatient, name: e.target.value})}
                            />
                        </div>
                        <div className="form-group">
                            <label>患者ID</label>
                            <input
                                type="text"
                                value={newPatient.patient_id}
                                onChange={(e) => setNewPatient({...newPatient, patient_id: e.target.value})}
                            />
                        </div>
                        <div className="form-group">
                            <label>年龄</label>
                            <input
                                type="number"
                                value={newPatient.age}
                                onChange={(e) => setNewPatient({...newPatient, age: e.target.value})}
                            />
                        </div>
                        <div className="form-group">
                            <label>性别</label>
                            <select
                                value={newPatient.gender}
                                onChange={(e) => setNewPatient({...newPatient, gender: e.target.value})}
                            >
                                <option value="">请选择</option>
                                <option value="M">男</option>
                                <option value="F">女</option>
                            </select>
                        </div>
                        <div className="modal-buttons">
                            <button onClick={handleCreatePatient}>创建</button>
                            <button onClick={() => setShowPatientModal(false)}>取消</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// 新的 App 组件，包装 Router
function App() {
    return (
        <Router>
            <MainApp />
        </Router>
    );
}

// 导出 App 组件
export default App;