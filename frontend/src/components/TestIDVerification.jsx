import React, { useState, useRef } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TestIDVerification = () => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  React.useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError("Camera access denied");
      }
    };
    initCamera();
  }, []);

  const captureAndVerify = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      
      console.log("Sending request to:", `${API}/verify/id-card`);
      console.log("Has token:", !!localStorage.getItem('token'));
      
      const response = await axios.post(`${API}/verify/id-card`, 
        { image_data: imageData },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      
      console.log("Received response:", response.data);
      setResult(response.data);
    } catch (err) {
      console.error("Full error:", err);
      console.error("Error response:", err.response);
      setError(err.response?.data?.detail || err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>ID Verification Test</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          style={{ width: '100%', maxWidth: '640px', border: '2px solid #ccc' }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      <button 
        onClick={captureAndVerify} 
        disabled={loading}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: loading ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Processing...' : 'Capture & Verify'}
      </button>

      {error &&(
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px' }}>
          <strong>Error:</strong> {error}
        </div>
       )}

      {result && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: result.is_valid ? '#efe' : '#fee',
          border: `1px solid ${result.is_valid ? '#cfc' : '#fcc'}`,
          borderRadius: '4px'
        }}>
          <h3>{result.is_valid ? '✓ Success' : '✗ Failed'}</h3>
          <p><strong>Message:</strong> {result.message}</p>
          
          {result.details && (
            <div style={{ marginTop: '10px', padding: '10px', backgroundColor: 'white', borderRadius: '4px' }}>
              <p><strong>Confidence:</strong> {result.details.match_ratio}%</p>
              <p><strong>Extracted Text:</strong></p>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '12px' }}>
                {result.details.extracted_text || "No text"}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TestIDVerification;
