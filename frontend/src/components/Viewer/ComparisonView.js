import React, { useState } from 'react';
import './ComparisonView.css';

function ComparisonView({ originalImage, processedImage }) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.1, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 0.5));
  };

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setPosition({ x, y });
  };

  return (
    <div className="comparison-container">
      <div className="controls">
        <button onClick={handleZoomIn}>放大</button>
        <button onClick={handleZoomOut}>缩小</button>
      </div>
      <div className="image-comparison">
        <div className="image-container">
          <h3>原始图像</h3>
          <div 
            className="image-wrapper"
            onMouseMove={handleMouseMove}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: `${position.x * 100}% ${position.y * 100}%`
            }}
          >
            <img src={originalImage} alt="原始MRI图像" />
          </div>
        </div>
        <div className="image-container">
          <h3>处理后图像</h3>
          <div 
            className="image-wrapper"
            onMouseMove={handleMouseMove}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: `${position.x * 100}% ${position.y * 100}%`
            }}
          >
            <img src={processedImage} alt="处理后MRI图像" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ComparisonView;