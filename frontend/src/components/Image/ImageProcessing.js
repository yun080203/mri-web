import React, { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { UPLOAD_ACTIONS } from '../../store/reducers/uploadReducer';
import { imageAPI } from '../../services/api';
import { ERROR_MESSAGES, POLLING_INTERVAL } from '../../utils/constants';
// 临时注释掉可能未使用的组件引用
/*
import ImageUpload from './ImageUpload';
import ImagePreview from './ImagePreview';
import ProcessingStatus from './ProcessingStatus';
import AnalysisResults from './AnalysisResults';
*/

const ImageProcessing = () => {
    const dispatch = useDispatch();
    const { selectedImage, processingStatus, processingLogs } = useSelector(state => state.upload);

    // 开始处理图像
    const startProcessing = useCallback(async () => {
        if (!selectedImage?.id) {
            dispatch({
                type: UPLOAD_ACTIONS.PROCESSING_ERROR,
                payload: '没有可处理的图像'
            });
            return;
        }

        dispatch({ type: UPLOAD_ACTIONS.START_PROCESSING });

        try {
            const response = await imageAPI.processImage(selectedImage.id);
            
            if (response.data.task_id) {
                dispatch({
                    type: UPLOAD_ACTIONS.START_PROCESSING,
                    payload: response.data.task_id
                });
            } else {
                throw new Error('处理响应中缺少任务ID');
            }
        } catch (error) {
            dispatch({
                type: UPLOAD_ACTIONS.PROCESSING_ERROR,
                payload: error.message || ERROR_MESSAGES.PROCESSING_FAILED
            });
        }
    }, [dispatch, selectedImage]);

    // 轮询任务状态
    useEffect(() => {
        let pollTimer = null;

        const pollTaskStatus = async () => {
            if (!selectedImage?.id) return;

            try {
                const response = await imageAPI.getTaskStatus(selectedImage.id);
                const { status, results, matlab_log } = response.data;

                dispatch({
                    type: UPLOAD_ACTIONS.UPDATE_MATLAB_LOG,
                    payload: matlab_log || ''
                });

                if (status === 'completed') {
                    dispatch({
                        type: UPLOAD_ACTIONS.PROCESSING_SUCCESS,
                        payload: {
                            results,
                            images: response.data.images || {}
                        }
                    });
                    return true;
                } else if (status === 'failed') {
                    dispatch({
                        type: UPLOAD_ACTIONS.PROCESSING_ERROR,
                        payload: ERROR_MESSAGES.PROCESSING_FAILED
                    });
                    return true;
                }

                return false;
            } catch (error) {
                dispatch({
                    type: UPLOAD_ACTIONS.PROCESSING_ERROR,
                    payload: error.message || ERROR_MESSAGES.PROCESSING_FAILED
                });
                return true;
            }
        };

        if (processingStatus === 'processing' && selectedImage.id) {
            const poll = async () => {
                const shouldStop = await pollTaskStatus();
                if (!shouldStop) {
                    pollTimer = setTimeout(poll, POLLING_INTERVAL);
                }
            };

            poll();
        }

        return () => {
            if (pollTimer) {
                clearTimeout(pollTimer);
            }
        };
    }, [dispatch, selectedImage, processingStatus]);

    return (
        <div className="image-processing">
            {/* 临时注释掉组件使用
            <ImageUpload />
            <ImagePreview />
            <ProcessingStatus status={processingStatus} logs={processingLogs} />
            {processingStatus === 'completed' && <AnalysisResults />}
            */}
            <div>图像处理组件已临时禁用以进行测试</div>
        </div>
    );
};

export default ImageProcessing; 