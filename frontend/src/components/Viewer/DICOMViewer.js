import React, { useEffect, useRef, useState } from 'react';
import * as cornerstone from 'cornerstone-core';
import * as cornerstoneTools from 'cornerstone-tools';
import * as cornerstoneMath from 'cornerstone-math';
import dicomParser from 'dicom-parser';
import axios from 'axios';

// 配置 cornerstone
cornerstoneTools.external.cornerstone = cornerstone;
cornerstoneTools.external.cornerstoneMath = cornerstoneMath;

const DICOMViewer = ({ imageId, onLoadError }) => {
    const elementRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const cancelTokenSource = useRef(null);

    useEffect(() => {
        if (!elementRef.current) return;

        // 初始化 cornerstone
        cornerstone.enable(elementRef.current);

        // 创建取消令牌
        cancelTokenSource.current = axios.CancelToken.source();

        const loadImage = async () => {
            try {
                setIsLoading(true);
                const response = await axios.get(imageId, {
                    responseType: 'arraybuffer',
                    cancelToken: cancelTokenSource.current.token
                });
                
                const byteArray = new Uint8Array(response.data);
                const dataSet = dicomParser.parseDicom(byteArray);
                
                // 获取像素数据
                const pixelDataElement = dataSet.elements.x7fe00010;
                const pixelData = new Uint16Array(response.data, pixelDataElement.dataOffset, pixelDataElement.length / 2);
                
                // 创建图像对象
                const image = {
                    imageId: imageId,
                    minPixelValue: 0,
                    maxPixelValue: 65535,
                    slope: dataSet.floatString('x00281053', 1),
                    intercept: dataSet.floatString('x00281052', 0),
                    rows: dataSet.uint16('x00280010'),
                    columns: dataSet.uint16('x00280011'),
                    height: dataSet.uint16('x00280010'),
                    width: dataSet.uint16('x00280011'),
                    color: false,
                    columnPixelSpacing: dataSet.floatString('x00280030', 1),
                    rowPixelSpacing: dataSet.floatString('x00280030', 1),
                    sizeInBytes: pixelData.length * 2,
                    getPixelData: () => pixelData,
                    getRows: () => dataSet.uint16('x00280010'),
                    getColumns: () => dataSet.uint16('x00280011'),
                    getHeight: () => dataSet.uint16('x00280010'),
                    getWidth: () => dataSet.uint16('x00280011'),
                    getColor: () => false,
                    getColumnPixelSpacing: () => dataSet.floatString('x00280030', 1),
                    getRowPixelSpacing: () => dataSet.floatString('x00280030', 1),
                    getSlope: () => dataSet.floatString('x00281053', 1),
                    getIntercept: () => dataSet.floatString('x00281052', 0),
                    getWindowCenter: () => dataSet.floatString('x00281050', 0),
                    getWindowWidth: () => dataSet.floatString('x00281051', 0),
                    getStatus: () => 0,
                    getImageId: () => imageId,
                    getImageIdIndex: () => 0
                };

                // 显示图像
                cornerstone.displayImage(elementRef.current, image);
                setIsLoading(false);
            } catch (error) {
                console.error('加载DICOM图像失败:', error);
                setIsLoading(false);
                if (onLoadError) {
                    onLoadError(error);
                }
            }
        };

        loadImage();

        // 清理函数
        return () => {
            if (cancelTokenSource.current) {
                cancelTokenSource.current.cancel('组件卸载，取消请求');
            }
            cornerstone.disable(elementRef.current);
        };
    }, [imageId, onLoadError]);

    return (
        <div className="dicom-viewer">
            {isLoading && <div className="loading">加载中...</div>}
            <div ref={elementRef} className="cornerstone-element"></div>
        </div>
    );
};

export default DICOMViewer;