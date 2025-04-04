export const handleUploadError = (error) => {
    if (error.response) {
        switch (error.response.status) {
            case 413:
                return '文件太大，请选择小于16MB的文件';
            case 415:
                return '不支持的文件格式，请选择DICOM或NIfTI格式';
            case 401:
                return '未登录或会话已过期，请重新登录';
            case 403:
                return '没有权限执行此操作';
            case 500:
                return '服务器处理失败，请稍后重试';
            default:
                return error.response.data?.message || '上传失败，请重试';
        }
    }
    if (error.request) {
        return '网络错误，请检查网络连接';
    }
    return '上传失败：' + error.message;
};

export const handleProcessingError = (error) => {
    if (error.response) {
        switch (error.response.status) {
            case 404:
                return '找不到要处理的图像';
            case 400:
                return '图像格式不正确或已损坏';
            case 500:
                return '处理失败，请检查图像格式是否正确';
            default:
                return error.response.data?.message || '处理失败，请重试';
        }
    }
    return '处理失败：' + error.message;
};

export const validateFile = (file) => {
    const errors = [];
    
    // 检查文件大小（16MB限制）
    if (file.size > 16 * 1024 * 1024) {
        errors.push('文件大小不能超过16MB');
    }
    
    // 检查文件类型
    const allowedTypes = ['.dcm', '.nii', '.nii.gz'];
    const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!allowedTypes.includes(fileExt)) {
        errors.push('只支持DICOM (.dcm)和NIfTI (.nii, .nii.gz)格式');
    }
    
    return errors;
}; 