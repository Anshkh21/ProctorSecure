import React from 'react';

/**
 * AnomalyScoreDisplay Component
 * Displays real-time anomaly scores from ProctorSecure analysis
 * 
 * Props:
 * - analysisResult: Enhanced analysis result from backend
 * - showDetails: Whether to show detailed breakdown
 */
const AnomalyScoreDisplay = ({ analysisResult, showDetails = true }) => {
  if (!analysisResult?.anomaly_scoring?.enabled) {
    return null;
  }

  const { anomaly_scoring, object_detection, recommendation, should_alert } = analysisResult;
  const { S_total, S_face, S_gaze, S_object, alert_level, risk_category } = anomaly_scoring;

  // Color coding based on alert level
  const getAlertColor = (level) => {
    switch (level) {
      case 'HIGH':
        return 'bg-red-100 border-red-500 text-red-900';
      case 'MEDIUM':
        return 'bg-yellow-100 border-yellow-500 text-yellow-900';
      case 'LOW':
        return 'bg-green-100 border-green-500 text-green-900';
      default:
        return 'bg-gray-100 border-gray-500 text-gray-900';
    }
  };

  const getScoreBarColor = (score) => {
    if (score > 0.7) return 'bg-red-500';
    if (score > 0.4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${getAlertColor(alert_level)} mb-4`}>
      {/* Header with Overall Score */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold">
          Anomaly Score: {S_total.toFixed(2)}
        </h3>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold 
          ${alert_level === 'HIGH' ? 'bg-red-600 text-white' : 
            alert_level === 'MEDIUM' ? 'bg-yellow-600 text-white' : 
            'bg-green-600 text-white'}`}>
          {alert_level}
        </span>
      </div>

      {/* Overall Score Bar */}
      <div className="mb-4">
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className={`h-3 rounded-full transition-all duration-300 ${getScoreBarColor(S_total)}`}
            style={{ width: `${Math.min(S_total * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Detailed Component Scores */}
      {showDetails && (
        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Face Verification:</span>
            <div className="flex items-center space-x-2">
              <div className="w-24 bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${getScoreBarColor(S_face)}`}
                  style={{ width: `${Math.min(S_face * 100, 100)}%` }}
                />
              </div>
              <span className="w-12 text-right">{S_face.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Gaze Tracking:</span>
            <div className="flex items-center space-x-2">
              <div className="w-24 bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${getScoreBarColor(S_gaze)}`}
                  style={{ width: `${Math.min(S_gaze * 100, 100)}%` }}
                />
              </div>
              <span className="w-12 text-right">{S_gaze.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Object Detection:</span>
            <div className="flex items-center space-x-2">
              <div className="w-24 bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${getScoreBarColor(S_object)}`}
                  style={{ width: `${Math.min(S_object * 100, 100)}%` }}
                />
              </div>
              <span className="w-12 text-right">{S_object.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Detected Objects */}
      {object_detection?.violations && object_detection.violations.length > 0 && (
        <div className="bg-white bg-opacity-50 rounded p-2 mb-3">
          <h4 className="text-sm font-semibold mb-1">⚠️ Detected Objects:</h4>
          <div className="flex flex-wrap gap-2">
            {object_detection.violations.map((violation, idx) => (
              <span 
                key={idx}
                className="bg-red-200 text-red-900 text-xs px-2 py-1 rounded"
              >
                {violation.object} ({(violation.confidence * 100).toFixed(0)}%)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Risk Category */}
      <div className="text-sm space-y-1">
        <p className="font-medium">
          Risk Category: <span className="capitalize">{risk_category.replace('_', ' ')}</span>
        </p>
        
        {/* Recommendation */}
        {recommendation && (
          <p className="text-xs mt-2 p-2 bg-white bg-opacity-50 rounded">
            <strong>🎯 Recommendation:</strong> {recommendation}
          </p>
        )}
      </div>

      {/* Alert Indicator */}
      {should_alert && (
        <div className="mt-3 p-2 bg-red-600 text-white rounded text-center text-sm font-bold animate-pulse">
          🚨 PROCTOR ALERT TRIGGERED
        </div>
      )}
    </div>
  );
};

export default AnomalyScoreDisplay;
