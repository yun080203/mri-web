import React from 'react';
import { useSelector } from 'react-redux';
import { formatProcessingStatus } from '../../utils/helpers';

const ProcessingStatus = () => {
    const { processingStatus, matlabLog, error } = useSelector(state => state.upload);

    if (!processingStatus && !matlabLog && !error) {
        return null;
    }

    return (
        <div className="processing-status">
            {processingStatus && (
                <div className={`status-message ${processingStatus}`}>
                    {formatProcessingStatus(processingStatus)}
                </div>
            )}

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            {matlabLog && (
                <div className="matlab-log">
                    <h4>处理日志</h4>
                    <pre>
                        {matlabLog}
                    </pre>
                </div>
            )}
        </div>
    );
};

export default ProcessingStatus; 