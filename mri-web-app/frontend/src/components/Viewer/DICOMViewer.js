import React, { useEffect, useRef } from 'react';
import * as cornerstone from 'cornerstone-core';
import * as cornerstoneWADOImageLoader from 'cornerstone-web-image-loader';
import * as dicomParser from 'dicom-parser';

// 配置DICOM解析器
cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
cornerstoneWADOImageLoader.configure({
    webWorkerPath: '/cornerstone/cornerstoneWADOImageLoaderWebWorker.js',
  taskConfiguration: {
    'decodeTask': {
      codecsPath: '/cornerstone/cornerstoneWADOImageLoaderCodecs.js'
    }
  }
});

export default function DICOMViewer({ imageUrl }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const loadImage = async () => {
      try {
        // 注册DICOM图像ID
        const imageId = `wadouri:${imageUrl}`;
        
        // 加载图像
        const image = await cornerstone.loadImage(imageId);
        
        // 获取画布元素
        const canvas = canvasRef.current;
        const element = canvas.parentElement;
        
        // 启用画布交互
        cornerstone.enable(element);
        
        // 显示图像
        cornerstone.displayImage(element, image);
        
        // 调整视窗
        cornerstone.fitToWindow(element);
        
        // 初始化工具
        cornerstoneTools.init({
          globalToolSyncEnabled: true
        });
        
        // 添加基础工具
        cornerstoneTools.addTool(cornerstoneTools.WwwcTool);
        cornerstoneTools.setToolActive('Wwwc', { mouseButtonMask: 1 });
      } catch (err) {
        console.error('DICOM加载失败:', err);
      }
    };

    loadImage();

    return () => {
      // 清理资源
      if (canvasRef.current) {
        cornerstone.disable(canvasRef.current.parentElement);
      }
    };
  }, [imageUrl]);

  return (
    <div style={{ width: '800px', height: '600px', position: 'relative' }}>
      <div style={{ width: '100%', height: '100%' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}