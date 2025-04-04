import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Spin, Alert } from 'antd';

const ImagePreview = () => {
    const { previewImage, uploadStatus } = useSelector(state => state.upload);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const handleImageLoad = () => {
        setLoading(false);
    };

    const handleImageError = () => {
        setError('图像加载失败');
        setLoading(false);
    };

    if (uploadStatus === 'uploading') {
        return (
            <div className="preview-loading">
                <Spin tip="正在加载预览图..." />
            </div>
        );
    }

    if (!previewImage) {
        return null;
    }

    return (
        <div className="image-preview">
            <h3>图像预览</h3>
            <div className="preview-container">
                {loading && <Spin />}
                {error && (
                    <Alert
                        message="错误"
                        description={error}
                        type="error"
                        showIcon
                    />
                )}
                <img
                    src={previewImage}
                    alt="预览图"
                    className={`preview-image ${loading ? 'loading' : ''}`}
                    loading="lazy"
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    style={{ display: loading ? 'none' : 'block' }}
                />
            </div>
        </div>
    );
};

export default ImagePreview; 