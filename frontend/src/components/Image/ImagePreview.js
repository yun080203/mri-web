import React from 'react';
import { useSelector } from 'react-redux';

const ImagePreview = () => {
    const { previewImage, uploadStatus } = useSelector(state => state.upload);

    if (uploadStatus === 'uploading') {
        return (
            <div className="preview-loading">
                <div className="spinner"></div>
                <p>正在加载预览图...</p>
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
                <img
                    src={previewImage}
                    alt="预览图"
                    className="preview-image"
                    loading="lazy"
                />
            </div>
        </div>
    );
};

export default ImagePreview; 