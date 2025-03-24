import React from 'react';
import { useSelector } from 'react-redux';
import { formatVolume } from '../../utils/helpers';

const AnalysisResults = () => {
    const { analysisResults, processedImages } = useSelector(state => state.upload);

    if (!analysisResults) {
        return null;
    }

    return (
        <div className="analysis-results">
            <h3>分析结果</h3>
            
            <div className="volume-results">
                <div className="results-grid">
                    <div className="result-item">
                        <label>灰质体积:</label>
                        <span>{formatVolume(analysisResults.gm_volume)}</span>
                    </div>
                    <div className="result-item">
                        <label>白质体积:</label>
                        <span>{formatVolume(analysisResults.wm_volume)}</span>
                    </div>
                    <div className="result-item">
                        <label>脑脊液体积:</label>
                        <span>{formatVolume(analysisResults.csf_volume)}</span>
                    </div>
                    <div className="result-item">
                        <label>颅内总体积:</label>
                        <span>{formatVolume(analysisResults.tiv)}</span>
                    </div>
                </div>
            </div>

            {processedImages && Object.keys(processedImages).length > 0 && (
                <div className="processed-images">
                    <h4>分割结果</h4>
                    <div className="images-grid">
                        {Object.entries(processedImages).map(([name, base64]) => (
                            <div key={name} className="image-item">
                                <h5>
                                    {name === 'p1input.nii' ? '灰质' :
                                     name === 'p2input.nii' ? '白质' : '脑脊液'}
                                </h5>
                                <img
                                    src={`data:image/png;base64,${base64}`}
                                    alt={name}
                                    loading="lazy"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalysisResults; 