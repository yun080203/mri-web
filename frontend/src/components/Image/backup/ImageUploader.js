import React, { useState } from 'react';
import axios from 'axios';

function ImageUploader() {
  const [file, setFile] = useState(null); // 存储用户上传的文件
  const [progress, setProgress] = useState(0); // 存储上传进度
  const [error, setError] = useState(''); // 存储错误信息

  // 处理文件选择
  const handleFileChange = (e) => {
    setFile(e.target.files[0]); // 将用户选择的文件保存到状态中
  };

  // 处理文件上传
  const handleUpload = async () => {
    if (!file) {
      setError('请选择一个文件');
      return;
    }

    const formData = new FormData(); // 创建一个 FormData 对象
    formData.append('file', file); // 将文件添加到 FormData 中

    try {
      // 发送 POST 请求到后端
      const response = await axios.post('http://localhost:5000/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data', // 设置请求头
        },
        onUploadProgress: (progressEvent) => {
          // 计算上传进度
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setProgress(percentCompleted); // 更新进度状态
        },
      });

      if (response.status === 200) {
        alert('上传成功！'); // 上传成功提示
        setError(''); // 清除错误信息
      }
    } catch (error) {
      console.error('上传出错：', error); // 捕获并打印错误
      setError('上传失败，请稍后重试'); // 设置错误信息
    }
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} /> {/* 文件选择输入框 */}
      <button onClick={handleUpload}>上传</button> {/* 上传按钮 */}
      {progress > 0 && <div>上传进度: {progress}%</div>} {/* 显示上传进度 */}
      {error && <div style={{ color: 'red' }}>{error}</div>} {/* 显示错误信息 */}
    </div>
  );
}

export default ImageUploader;