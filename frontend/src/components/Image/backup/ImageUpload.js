import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { UPLOAD_ACTIONS } from '../../store/reducers/uploadReducer';
import { imageAPI } from '../../services/api';
import { validateFileType } from '../../utils/helpers';
import { ERROR_MESSAGES, ACCEPTED_FILE_TYPES } from '../../utils/constants';

const ImageUpload = () => {
    const dispatch = useDispatch();
    const { selectedPatient } = useSelector(state => state.patient);
    const { uploadStatus, error } = useSelector(state => state.upload);

    const handleFileSelect = useCallback(async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!validateFileType(file)) {
            dispatch({
                type: UPLOAD_ACTIONS.UPLOAD_ERROR,
                payload: ERROR_MESSAGES.INVALID_FILE_TYPE
            });
            return;
        }

        if (!selectedPatient) {
            dispatch({
                type: UPLOAD_ACTIONS.UPLOAD_ERROR,
                payload: ERROR_MESSAGES.NO_PATIENT
            });
            return;
        }

        dispatch({ type: UPLOAD_ACTIONS.SET_FILE, payload: file });

        try {
            // 获取预览图
            const previewResponse = await imageAPI.getPreview(file);
            if (previewResponse.data.status === 'success') {
                dispatch({
                    type: UPLOAD_ACTIONS.UPDATE_PREVIEW,
                    payload: `data:image/png;base64,${previewResponse.data.image}`
                });
            }
        } catch (error) {
            console.error('预览生成失败:', error);
        }
    }, [dispatch, selectedPatient]);

    const handleUpload = useCallback(async () => {
        const file = useSelector(state => state.upload.selectedFile);
        if (!file || !selectedPatient) return;

        dispatch({ type: UPLOAD_ACTIONS.START_UPLOAD });

        try {
            const response = await imageAPI.uploadImage(file, selectedPatient.id);
            
            if (response.data.status === 'success') {
                dispatch({
                    type: UPLOAD_ACTIONS.UPLOAD_SUCCESS,
                    payload: response.data.file_info
                });
            } else {
                throw new Error(response.data.message || ERROR_MESSAGES.UPLOAD_FAILED);
            }
        } catch (error) {
            dispatch({
                type: UPLOAD_ACTIONS.UPLOAD_ERROR,
                payload: error.message || ERROR_MESSAGES.UPLOAD_FAILED
            });
        }
    }, [dispatch, selectedPatient]);

    return (
        <div className="image-upload">
            <div className="upload-controls">
                <input
                    type="file"
                    accept={`${ACCEPTED_FILE_TYPES.DICOM},${ACCEPTED_FILE_TYPES.NIFTI}`}
                    onChange={handleFileSelect}
                    disabled={uploadStatus === 'uploading'}
                />
                <button
                    onClick={handleUpload}
                    disabled={uploadStatus === 'uploading' || !selectedPatient}
                >
                    {uploadStatus === 'uploading' ? '上传中...' : '上传图像'}
                </button>
            </div>
            
            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}
            
            <div className="upload-instructions">
                <h4>支持的文件格式：</h4>
                <ul>
                    <li>DICOM (.dcm)</li>
                    <li>NIfTI (.nii, .nii.gz)</li>
                </ul>
            </div>
        </div>
    );
};

export default ImageUpload; 