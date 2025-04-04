import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

function Home() {
    return (
        <div className="home-page">
            <h1>脑容量分析系统</h1>
            <p className="home-description">
                欢迎使用基于MRI图像的脑容量分析系统，通过先进的图像处理技术，我们可以为您提供精确的脑组织分割和体积分析。
            </p>
            <div className="feature-grid">
                <Link to="/patients" className="feature-card">
                    <h3>患者管理</h3>
                    <p>管理患者信息，查看患者历史记录</p>
                </Link>
                <Link to="/upload" className="feature-card">
                    <h3>图像上传</h3>
                    <p>上传MRI图像，进行预处理</p>
                </Link>
                <Link to="/data" className="feature-card">
                    <h3>数据管理</h3>
                    <p>查看分析结果，对比处理前后的图像</p>
                </Link>
                <Link to="/compare" className="feature-card">
                    <h3>图像对比</h3>
                    <p>对比不同时间段的图像分析结果</p>
                </Link>
            </div>
        </div>
    );
}

export default Home; 