// 定义action类型
export const UPLOAD_ACTIONS = {
    SET_FILE: 'upload/setFile',
    START_UPLOAD: 'upload/startUpload',
    UPLOAD_PROGRESS: 'upload/progress',
    UPLOAD_SUCCESS: 'upload/success',
    UPLOAD_ERROR: 'upload/error',
    START_PROCESSING: 'upload/startProcessing',
    PROCESSING_STATUS: 'upload/processingStatus',
    PROCESSING_SUCCESS: 'upload/processingSuccess',
    PROCESSING_ERROR: 'upload/processingError',
    UPDATE_PREVIEW: 'upload/updatePreview',
    UPDATE_MATLAB_LOG: 'upload/updateMatlabLog',
    RESET: 'upload/reset'
};

// 初始状态
const initialState = {
    selectedFile: null,
    uploadStatus: 'idle', // 'idle' | 'uploading' | 'success' | 'error'
    uploadProgress: 0,
    uploadedImage: null,
    processingStatus: 'idle', // 'idle' | 'processing' | 'success' | 'error'
    taskId: null,
    previewImage: null,
    matlabLog: '',
    processedImages: {},
    analysisResults: null,
    error: null
};

// reducer函数
export default function uploadReducer(state = initialState, action) {
    switch (action.type) {
        case UPLOAD_ACTIONS.SET_FILE:
            return {
                ...state,
                selectedFile: action.payload,
                uploadStatus: 'idle',
                uploadProgress: 0,
                uploadedImage: null,
                processingStatus: 'idle',
                error: null
            };
            
        case UPLOAD_ACTIONS.START_UPLOAD:
            return {
                ...state,
                uploadStatus: 'uploading',
                uploadProgress: 0,
                error: null
            };
            
        case UPLOAD_ACTIONS.UPLOAD_PROGRESS:
            return {
                ...state,
                uploadProgress: action.payload
            };
            
        case UPLOAD_ACTIONS.UPLOAD_SUCCESS:
            return {
                ...state,
                uploadStatus: 'success',
                uploadedImage: action.payload,
                error: null
            };
            
        case UPLOAD_ACTIONS.UPLOAD_ERROR:
            return {
                ...state,
                uploadStatus: 'error',
                error: action.payload
            };
            
        case UPLOAD_ACTIONS.START_PROCESSING:
            return {
                ...state,
                processingStatus: 'processing',
                taskId: action.payload,
                error: null
            };
            
        case UPLOAD_ACTIONS.PROCESSING_STATUS:
            return {
                ...state,
                processingStatus: 'processing',
                matlabLog: action.payload.log || state.matlabLog
            };
            
        case UPLOAD_ACTIONS.PROCESSING_SUCCESS:
            return {
                ...state,
                processingStatus: 'success',
                processedImages: action.payload.images || {},
                analysisResults: action.payload.results || null,
                error: null
            };
            
        case UPLOAD_ACTIONS.PROCESSING_ERROR:
            return {
                ...state,
                processingStatus: 'error',
                error: action.payload
            };
            
        case UPLOAD_ACTIONS.UPDATE_PREVIEW:
            return {
                ...state,
                previewImage: action.payload
            };
            
        case UPLOAD_ACTIONS.UPDATE_MATLAB_LOG:
            return {
                ...state,
                matlabLog: action.payload
            };
            
        case UPLOAD_ACTIONS.RESET:
            return initialState;
            
        default:
            return state;
    }
} 