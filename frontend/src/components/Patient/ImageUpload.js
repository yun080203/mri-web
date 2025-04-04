{selectedPatient && (
  <div className="upload-section">
    <h2>上传MRI图像</h2>
    <div className="upload-form">
      <input
        type="file"
        onChange={handleFileChange}
        accept=".dcm,.nii,.nii.gz"
        className="file-input"
      />
      <button onClick={handleUpload} disabled={!selectedFile} className="upload-button">
        上传图像
      </button>
    </div>
    
    {uploadStatus && (
      <div className={`status-message ${uploadStatus.type}`}>
        {uploadStatus.message}
      </div>
    )}
    
    {processingStatus && (
      <div className="processing-status">
        <h3>处理状态</h3>
        <p>状态: {processingStatus.status}</p>
        {processingStatus.progress > 0 && (
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${processingStatus.progress}%` }}
            ></div>
          </div>
        )}
        {processingStatus.results && (
          <div className="volume-data">
            <h3>体积分析结果</h3>
            <div className="volume-grid">
              <div className="volume-item">
                <label>灰质体积</label>
                <span>{(processingStatus.results.gm_volume / 1000).toFixed(2)} ml</span>
              </div>
              <div className="volume-item">
                <label>白质体积</label>
                <span>{(processingStatus.results.wm_volume / 1000).toFixed(2)} ml</span>
              </div>
              <div className="volume-item">
                <label>脑脊液体积</label>
                <span>{(processingStatus.results.csf_volume / 1000).toFixed(2)} ml</span>
              </div>
              <div className="volume-item">
                <label>总颅内体积</label>
                <span>{(processingStatus.results.tiv_volume / 1000).toFixed(2)} ml</span>
              </div>
            </div>
          </div>
        )}
        {processingStatus.error && (
          <div className="error-message">
            处理失败: {processingStatus.error}
          </div>
        )}
      </div>
    )}
  </div>
)} 