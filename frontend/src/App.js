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

// 创建axios实例
const axiosInstance = axios.create({
    baseURL: API_BASE,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

// 添加请求拦截器
axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        console.log('发送请求:', {
            url: config.url,
            method: config.method,
            headers: config.headers,
            data: config.data
        });
        return config;
    },
    (error) => {
        console.error('请求错误:', error);
        return Promise.reject(error);
    }
);

// 添加响应拦截器
axiosInstance.interceptors.response.use(
    (response) => {
        console.log('收到响应:', response);
        return response;
    },
    (error) => {
        console.error('响应错误:', error);
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// 配置全局axios默认值
axios.defaults.baseURL = API_BASE;
axios.defaults.headers.common['Content-Type'] = 'application/json';
axios.defaults.headers.common['Accept'] = 'application/json';

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
    const [uploadedImage, setUploadedImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [processingStatus, setProcessingStatus] = useState(null);
    const [matlabLog, setMatlabLog] = useState('');
    const [processedImages, setProcessedImages] = useState({});
    const [analysisResults, setAnalysisResults] = useState(null);
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [showPatientModal, setShowPatientModal] = useState(false);
    const [newPatient, setNewPatient] = useState({
        name: '',
        patient_id: '',
        age: '',
        gender: 'M'
    });
    const cancelTokenSource = useRef(null);
    const navigate = useNavigate();
    const pollInterval = useRef(null);
    const [previewImage, setPreviewImage] = useState(null);

    // 获取患者列表
    useEffect(() => {
        const fetchPatients = async () => {
            try {
                const response = await axiosInstance.get('/api/patients');
                console.log('获取到的患者列表:', response.data);
                if (response.data && Array.isArray(response.data.patients)) {
                    setPatients(response.data.patients);
                }
            } catch (error) {
                console.error('获取患者列表失败:', error);
                if (error.response?.status === 401) {
                    navigate('/login');
                }
            }
        };

        if (authState.isAuthenticated) {
            fetchPatients();
        }
    }, [authState.isAuthenticated, navigate]);

    // 配置axios默认值
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            // 配置axios默认值
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            axios.defaults.headers.common['Content-Type'] = 'application/json';
            axios.defaults.headers.common['Accept'] = 'application/json';
            axios.defaults.withCredentials = true;  // 允许跨域请求携带凭证
        }
    }, []);

    // 创建新患者
    const handleCreatePatient = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('未找到token');
                alert('请先登录');
                navigate('/login');
                return;
            }

            // 验证输入
            if (!newPatient.name || !newPatient.patient_id || !newPatient.age || !newPatient.gender) {
                alert('请填写所有必填字段');
                return;
            }

            const age = parseInt(newPatient.age, 10);
            if (isNaN(age) || age <= 0) {
                alert('请输入有效的年龄');
                return;
            }

            const patientData = {
                ...newPatient,
                age: age
            };

            console.log('正在发送创建患者请求:', patientData);

            const response = await axiosInstance.post('/api/patients', patientData);

            console.log('服务器响应:', response);

            if (response.data && response.data.patient) {
                alert('患者创建成功');
                setShowPatientModal(false);
                setNewPatient({
                    name: '',
                    patient_id: '',
                    age: '',
                    gender: 'M'
                });

                // 将新创建的患者添加到列表中
                setPatients(prevPatients => [...prevPatients, response.data.patient]);
            } else {
                throw new Error('服务器响应格式不正确');
            }
        } catch (error) {
            console.error('创建患者失败:', error);
            console.error('错误详情:', {
                message: error.message,
                response: error.response,
                request: error.request
            });
            
            let errorMessage = '创建患者失败，请重试';
            if (error.response) {
                errorMessage = error.response.data?.error || error.response.data?.message || errorMessage;
            } else if (error.request) {
                errorMessage = '无法连接到服务器，请检查网络连接';
            }
            
            alert(errorMessage);
        }
    };

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
            setUploadedImage(null);
            setProcessingStatus(null);
            setMatlabLog('');
            setProcessedImages({});
            setAnalysisResults(null);
            setPreviewImage(null);
            dispatch({ type: 'RESET' });
        }
    };

    // 处理图像上传
    const handleImageUpload = async (file, patientId) => {
        try {
            setLoading(true);
            setProcessingStatus('uploading');
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('patient_id', patientId);
            
            const response = await axios.post(`${API_BASE}/api/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.data.status === 'success') {
                setProcessingStatus('uploaded');
                await startProcessing(response.data.file_info.id);
            }
        } catch (error) {
            console.error('上传失败:', error);
            setProcessingStatus('error');
        } finally {
            setLoading(false);
        }
    };

    // 开始处理图像
    const startProcessing = async (imageId) => {
        try {
            setProcessingStatus('processing');
            const response = await axios.post(`${API_BASE}/api/process/${imageId}`, {}, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.data.task_id) {
                await pollTaskStatus(response.data.task_id);
            }
        } catch (error) {
            console.error('处理失败:', error);
            setProcessingStatus('error');
        }
    };

    // 轮询任务状态
    const pollTaskStatus = async (taskId) => {
        try {
            const interval = setInterval(async () => {
                const response = await axios.get(`${API_BASE}/api/tasks/${taskId}`);
                const { status, progress, results, matlab_log } = response.data;
                
                setMatlabLog(matlab_log || '');
                
                if (status === 'completed') {
                    clearInterval(interval);
                    setProcessingStatus('completed');
                    setAnalysisResults(results);
                    await loadProcessedImages(taskId);
                } else if (status === 'failed') {
                    clearInterval(interval);
                    setProcessingStatus('failed');
                }
            }, 2000);
        } catch (error) {
            console.error('获取任务状态失败:', error);
            setProcessingStatus('error');
        }
    };

    // 加载处理后的图像
    const loadProcessedImages = async (taskId) => {
        try {
            const images = ['p1input.nii', 'p2input.nii', 'p3input.nii'];
            const loadedImages = {};
            
            for (const img of images) {
                const response = await axios.get(`${API_BASE}/api/processed/${taskId}/${img}`);
                if (response.data.status === 'success') {
                    loadedImages[img] = response.data.image;
                }
            }
            
            setProcessedImages(loadedImages);
        } catch (error) {
            console.error('加载处理后的图像失败:', error);
        }
    };

    // 渲染处理按钮
    const renderProcessButton = () => {
        if (!uploadedImage) return null;

        switch (processingStatus) {
            case 'processing':
                return (
                    <button type="button" disabled>
                        正在处理...
                    </button>
                );
            case 'completed':
                return (
                    <button type="button" disabled>
                        处理完成
                    </button>
                );
            case 'failed':
                return (
                    <button 
                        type="button" 
                        className="error-button"
                        onClick={() => startProcessing(uploadedImage.id)}
                    >
                        重试处理
                    </button>
                );
            default:
                return (
                    <button 
                        type="button"
                        onClick={() => startProcessing(uploadedImage.id)}
                    >
                        开始处理
                    </button>
                );
        }
    };

    // 渲染MATLAB日志
    const renderMatlabLog = () => {
        if (!matlabLog) return null;
        return (
            <div style={{ marginTop: 16 }}>
                <h4>处理日志</h4>
                <pre style={{ maxHeight: 200, overflow: 'auto', backgroundColor: '#f5f5f5', padding: 8 }}>
                    {matlabLog}
                </pre>
            </div>
        );
    };

    // 渲染分析结果
    const renderAnalysisResults = () => {
        if (!analysisResults) return null;
        return (
            <div style={{ marginTop: 16 }}>
                <h4>分析结果</h4>
                <Table
                    dataSource={[
                        { key: 'gm', name: '灰质体积', value: `${(analysisResults.gm_volume / 1000).toFixed(2)} ml` },
                        { key: 'wm', name: '白质体积', value: `${(analysisResults.wm_volume / 1000).toFixed(2)} ml` },
                        { key: 'csf', name: '脑脊液体积', value: `${(analysisResults.csf_volume / 1000).toFixed(2)} ml` },
                        { key: 'tiv', name: '颅内总体积', value: `${(analysisResults.tiv / 1000).toFixed(2)} ml` }
                    ]}
                    columns={[
                        { title: '指标', dataIndex: 'name', key: 'name' },
                        { title: '数值', dataIndex: 'value', key: 'value' }
                    ]}
                    pagination={false}
                />
            </div>
        );
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
                                            value={selectedPatient ? selectedPatient.id : ''}
                                            onChange={(e) => {
                                                const patientId = parseInt(e.target.value, 10);
                                                const patient = patients.find(p => p.id === patientId);
                                                setSelectedPatient(patient);
                                                // 清除之前的状态
                                                setSelectedFile(null);
                                                setUploadedImage(null);
                                                setProcessingStatus(null);
                                                setMatlabLog('');
                                                setProcessedImages({});
                                                setAnalysisResults(null);
                                                setPreviewImage(null);
                                            }}
                                        >
                                            <option value="">请选择患者</option>
                                            {patients.map(patient => (
                                                <option key={patient.id} value={patient.id}>
                                                    {patient.name} (ID: {patient.patient_id})
                                                </option>
                                            ))}
                                        </select>
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                setShowPatientModal(true);
                                                setLoading(false); // 确保加载状态被重置
                                            }}
                                            className="add-patient-btn"
                                        >
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
                                            onClick={() => {
                                                if (selectedFile) {
                                                    handleImageUpload(selectedFile, selectedPatient.id);
                                                }
                                            }}
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
                                            <div className="progress" style={{ width: `${processingStatus === 'processing' ? state.progress : 0}%` }}></div>
                                        </div>
                                        <div className="progress-text">处理进度: {processingStatus === 'processing' ? state.progress : 0}%</div>
                                    </div>
                                )}

                                {previewImage && (
                                    <div className="preview-section">
                                        <h3>图像预览</h3>
                                        <img src={previewImage} alt="图像预览" className="preview-image" />
                                    </div>
                                )}

                                {renderProcessButton()}
                                {renderMatlabLog()}
                                {renderAnalysisResults()}

                                {state.result && (
                                    <div className="analysis-section">
                                        <h3>分析结果</h3>
                                        <div className="results-grid">
                                            <div className="result-item">
                                                <h4>图像尺寸</h4>
                                                <p>{state.result.image_size ? `${state.result.image_size[0]} x ${state.result.image_size[1]}` : 'N/A'}</p>
                                            </div>
                                            <div className="result-item">
                                                <h4>平均强度</h4>
                                                <p>{state.result.mean_intensity ? state.result.mean_intensity.toFixed(2) : 'N/A'}</p>
                                            </div>
                                            <div className="result-item">
                                                <h4>最大强度</h4>
                                                <p>{state.result.max_intensity ? state.result.max_intensity.toFixed(2) : 'N/A'}</p>
                                            </div>
                                            <div className="result-item">
                                                <h4>最小强度</h4>
                                                <p>{state.result.min_intensity ? state.result.min_intensity.toFixed(2) : 'N/A'}</p>
                                            </div>
                                            <div className="result-item">
                                                <h4>病灶体积</h4>
                                                <p>{state.result.lesion_volume ? state.result.lesion_volume.toFixed(2) : 'N/A'} 像素</p>
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
                                placeholder="请输入患者姓名"
                            />
                        </div>
                        <div className="form-group">
                            <label>患者ID</label>
                            <input
                                type="text"
                                value={newPatient.patient_id}
                                onChange={(e) => setNewPatient({...newPatient, patient_id: e.target.value})}
                                placeholder="请输入患者ID"
                            />
                        </div>
                        <div className="form-group">
                            <label>年龄</label>
                            <input
                                type="number"
                                value={newPatient.age}
                                onChange={(e) => setNewPatient({...newPatient, age: e.target.value})}
                                placeholder="请输入年龄"
                                min="1"
                            />
                        </div>
                        <div className="form-group">
                            <label>性别</label>
                            <select
                                value={newPatient.gender}
                                onChange={(e) => setNewPatient({...newPatient, gender: e.target.value})}
                            >
                                <option value="">请选择性别</option>
                                <option value="M">男</option>
                                <option value="F">女</option>
                            </select>
                        </div>
                        <div className="modal-buttons">
                            <button type="button" onClick={handleCreatePatient}>创建</button>
                            <button type="button" onClick={() => setShowPatientModal(false)}>取消</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 处理状态显示 */}
            {processingStatus && (
                <div className={`status-message ${processingStatus}`}>
                    {processingStatus === 'uploading' && '正在上传图像...'}
                    {processingStatus === 'uploaded' && '图像上传成功，开始处理...'}
                    {processingStatus === 'processing' && '正在处理图像...'}
                    {processingStatus === 'completed' && '处理完成'}
                    {processingStatus === 'failed' && '处理失败'}
                    {processingStatus === 'error' && '发生错误'}
                </div>
            )}
            
            {/* MATLAB日志显示 */}
            {matlabLog && (
                <div className="matlab-log">
                    <h3>处理日志</h3>
                    <pre>{matlabLog}</pre>
                </div>
            )}
            
            {/* 处理结果显示 */}
            {processingStatus === 'completed' && analysisResults && (
                <div className="analysis-results">
                    <h3>分析结果</h3>
                    <div className="results-grid">
                        <div className="result-item">
                            <label>灰质体积:</label>
                            <span>{(analysisResults.gm_volume / 1000).toFixed(2)} ml</span>
                        </div>
                        <div className="result-item">
                            <label>白质体积:</label>
                            <span>{(analysisResults.wm_volume / 1000).toFixed(2)} ml</span>
                        </div>
                        <div className="result-item">
                            <label>脑脊液体积:</label>
                            <span>{(analysisResults.csf_volume / 1000).toFixed(2)} ml</span>
                        </div>
                        <div className="result-item">
                            <label>颅内总体积:</label>
                            <span>{(analysisResults.tiv / 1000).toFixed(2)} ml</span>
                        </div>
                    </div>
                </div>
            )}
            
            {/* 处理后的图像显示 */}
            {processingStatus === 'completed' && Object.keys(processedImages).length > 0 && (
                <div className="processed-images">
                    <h3>处理后的图像</h3>
                    <div className="images-grid">
                        {Object.entries(processedImages).map(([name, base64]) => (
                            <div key={name} className="image-item">
                                <h4>{name === 'p1input.nii' ? '灰质' : name === 'p2input.nii' ? '白质' : '脑脊液'}</h4>
                                <img src={`data:image/png;base64,${base64}`} alt={name} />
                            </div>
                        ))}
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