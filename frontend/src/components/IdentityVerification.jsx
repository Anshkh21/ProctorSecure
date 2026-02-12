import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, CheckCircle, AlertCircle, User, Webcam, FileText, ArrowRight, XCircle, Monitor, Loader2 } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const IdentityVerification = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const [webcamStream, setWebcamStream] = useState(null);
  const [idDocument, setIdDocument] = useState(null);
  const [faceVerified, setFaceVerified] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [faceDetectionResult, setFaceDetectionResult] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [idVerified, setIdVerified] = useState(false);
  const [verificationDetails, setVerificationDetails] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const examId = searchParams.get('examId');
  const totalSteps = 4;
  const progress = (currentStep / totalSteps) * 100;

  const steps = [
    { id: 1, title: "System Check", icon: <Webcam className="w-5 h-5" /> },
    { id: 2, title: "ID Verification", icon: <FileText className="w-5 h-5" /> },
    { id: 3, title: "Face Verification", icon: <User className="w-5 h-5" /> },
    { id: 4, title: "Final Review", icon: <CheckCircle className="w-5 h-5" /> }
  ];

  useEffect(() => {
    if (currentStep === 1) {
      initializeWebcam();
    }
  }, [currentStep]);

  // Re-attach stream when step changes (e.g. coming back to video step)
  useEffect(() => {
    if (webcamStream && videoRef.current) {
      console.log("Attaching stream to video element");
      videoRef.current.srcObject = webcamStream;
    }
  }, [webcamStream, currentStep]);

  const initializeWebcam = async () => {
    try {
      setPermissionDenied(false);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: true 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      setWebcamStream(stream);
      setWebcamEnabled(true);
      
      toast({
        title: "Camera Connected",
        description: "Camera and microphone access granted successfully"
      });
    } catch (error) {
      console.error('Camera access error:', error);
      setPermissionDenied(true);
      setWebcamEnabled(false);
      
      let errorMessage = "Please allow camera and microphone access to continue";
      if (error.name === 'NotAllowedError') {
        errorMessage = "Camera access denied. Please click on the camera icon in your browser and allow access.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "No camera found. Please connect a camera and try again.";
      }
      
      toast({
        title: "Camera Access Issue",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const retryCamera = () => {
    initializeWebcam();
  };

  const captureIdImage = async () => {
    console.log("🔵 CAPTURE BUTTON CLICKED");
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      console.log("📸 Image captured, length:", imageData.length);
      setIsProcessing(true);
      setVerificationDetails(null);

      try {
        const response = await axios.post(`${API}/verify/id-card`, 
          { image_data: imageData },
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        
        setVerificationDetails(response.data);

        if (response.data.is_valid) {
          setIdVerified(true); 
          toast({
             title: "ID Verified",
             description: response.data.message
          });
        } else {
          toast({
            title: "Verification Failed",
            description: response.data.message,
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error("ID Verification Error:", error);
        console.error("Error response:", error.response?.data);
        setVerificationDetails(null);
        toast({
          title: "Error",
          description: error.response?.data?.detail || "ID verification failed - check console",
          variant: "destructive"
        });
      } finally {
        setIsProcessing(false);
      }
    } else {
      console.error("❌ Missing refs:", { video: !!videoRef.current, canvas: !!canvasRef.current });
      toast({
        title: "Error",
        description: "Camera not initialized properly. Please refresh the page.",
        variant: "destructive"
      });
    }
  };

  const detectFace = async (imageData) => {
    try {
      // Use the robust identity verification endpoint
      const response = await axios.post(`${API}/verify/identity`, {
        image_data: imageData,
        id_image_data: idDocument // Send the previously captured ID card
      }, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      return response.data;
    } catch (error) {
      console.error('Face detection error:', error);
      toast({
        title: "Detection Error",
        description: "Failed to detect face. Please try again.",
        variant: "destructive"
      });
      return null;
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "File Too Large",
          description: "Please upload an image smaller than 5MB",
          variant: "destructive"
        });
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setIdDocument(e.target.result);
        toast({
          title: "ID Document Uploaded",
          description: "Document uploaded successfully for verification"
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const captureFaceImage = async () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      console.log('Video dimensions:', video.videoWidth, video.videoHeight);
      console.log('Video readyState:', video.readyState);
      
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        toast({
          title: "Camera Error",
          description: "Video stream not ready. Please wait.",
          variant: "destructive"
        });
        return;
      }
      
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);
      
      // Get image data as base64
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      console.log('Image data length:', imageData.length);
      console.log('Image data start:', imageData.substring(0, 50));
      
      if (imageData.length < 100) {
         toast({
          title: "Capture Error",
          description: "Captured image is empty or invalid.",
          variant: "destructive"
        });
        return;
      }

      setIsProcessing(true);
      
      // Send to backend for face detection
      const result = await detectFace(imageData);
      
      if (result) {
        setFaceDetectionResult(result);
        
        if (result.is_valid) {
          setFaceVerified(true);
          toast({
            title: "Face Verified",
            description: result.message
          });
        } else {
          // Construct detailed error message
          let detailedMsg = result.message;
          if (result.warnings && result.warnings.length > 0) {
             detailedMsg += ": " + result.warnings.join(", ");
          }
          
          toast({
            title: "Verification Failed",
            description: detailedMsg,
            variant: "destructive"
          });
        }
      }
      
      setIsProcessing(false);
    }
  };

  const proceedToNextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete verification and start exam
      toast({
        title: "Verification Complete",
        description: "Starting exam now..."
      });
      
      // Clean up webcam stream
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
      }
      
      setTimeout(() => {
        navigate(`/exam/${examId}`);
      }, 1500);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return webcamEnabled;
      case 2: return idDocument !== null;
      case 3: return faceVerified;
      case 4: return true;
      default: return false;
    }
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">System Requirements Check</h3>
              <p className="text-gray-600">
                We need to verify your camera and microphone are working properly
              </p>
            </div>
            
            <div className="bg-gray-100 rounded-lg p-4 aspect-video flex items-center justify-center">
              {webcamEnabled ? (
                <video 
                  ref={videoRef} 
                  autoPlay 
                  muted 
                  className="w-full h-full object-cover rounded"
                />
              ) : permissionDenied ? (
                <div className="text-center">
                  <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                  <p className="text-red-600 mb-2">Camera Access Denied</p>
                  <p className="text-sm text-gray-500 mb-4">
                    Please allow camera access to continue with verification
                  </p>
                  <Button onClick={retryCamera} variant="outline" size="sm">
                    <Camera className="w-4 h-4 mr-2" />
                    Retry Camera Access
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Requesting camera access...</p>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className={`flex items-center space-x-3 p-3 rounded-lg ${
                webcamEnabled ? 'bg-green-50' : 'bg-gray-50'
              }`}>
                {webcamEnabled ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-gray-400" />
                )}
                <div>
                  <p className={`font-medium ${webcamEnabled ? 'text-green-900' : 'text-gray-700'}`}>
                    Camera
                  </p>
                  <p className={`text-sm ${webcamEnabled ? 'text-green-700' : 'text-gray-500'}`}>
                    {webcamEnabled ? 'Connected' : 'Connecting...'}
                  </p>
                </div>
              </div>
              <div className={`flex items-center space-x-3 p-3 rounded-lg ${
                webcamEnabled ? 'bg-green-50' : 'bg-gray-50'
              }`}>
                {webcamEnabled ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-gray-400" />
                )}
                <div>
                  <p className={`font-medium ${webcamEnabled ? 'text-green-900' : 'text-gray-700'}`}>
                    Microphone
                  </p>
                  <p className={`text-sm ${webcamEnabled ? 'text-green-700' : 'text-gray-500'}`}>
                    {webcamEnabled ? 'Connected' : 'Connecting...'}
                  </p>
                </div>
              </div>
            </div>
            
            {permissionDenied && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium mb-1">Camera Permission Required</p>
                    <p className="mb-2">To proceed with the exam, you must allow camera and microphone access:</p>
                    <ul className="space-y-1 ml-4">
                      <li>• Look for the camera icon in your browser's address bar</li>
                      <li>• Click "Allow" when prompted for camera/microphone access</li>
                      <li>• Refresh the page if needed</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-center pt-4">
              <Button 
                onClick={proceedToNextStep} 
                disabled={!webcamEnabled || permissionDenied}
                className="bg-blue-600 hover:bg-blue-700 w-full max-w-xs"
                size="lg"
              >
                Proceed to Verification
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg p-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Verify Identification</h3>
                <p className="text-gray-600">
                  Please hold your Student ID card up to the camera. ensure the text is readable.
                </p>
              </div>
              
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden max-w-2xl mx-auto border-2 border-dashed border-gray-300">
                 <video 
                   ref={videoRef}
                   autoPlay 
                   playsInline
                   muted
                   className="w-full h-full object-cover transform scale-x-[-1]"
                 />
                 
                 {/* ID Card Guide Overlay */}
                 <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                   <div className="w-[60%] h-[40%] border-2 border-yellow-400 rounded-lg flex items-center justify-center opacity-70">
                      <p className="text-yellow-400 font-bold bg-black/50 px-2 rounded">Align ID Here</p>
                   </div>
                 </div>
              </div>

              <canvas ref={canvasRef} className="hidden" />

              <div className="flex justify-center space-x-4">
                <Button 
                  onClick={captureIdImage} 
                  disabled={!webcamEnabled || isProcessing || permissionDenied}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isProcessing ? (
                     <>
                       <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                       Verifying ID...
                     </>
                  ) : (
                     <>
                       <Camera className="w-4 h-4 mr-2" />
                       Capture & Verify
                     </>
                  )}
                </Button>
              </div>

              {idVerified && (
                 <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-green-800 font-medium">ID Verified Successfully</span>
                 </div>
              )}

              <div className="flex justify-center pt-4">
                <Button 
                    onClick={proceedToNextStep} 
                    disabled={!idVerified}
                    className="bg-blue-600 hover:bg-blue-700 w-full max-w-xs"
                    size="lg"
                >
                    Proceed to Face Verification
                    <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Face Verification</h3>
              <p className="text-gray-600">
                Look directly at the camera and click "Capture" to verify your identity
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="bg-gray-100 rounded-lg aspect-square flex items-center justify-center">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    muted 
                    className="w-full h-full object-cover rounded"
                  />
                </div>
                <Button 
                  className="w-full"
                  onClick={captureFaceImage}
                  disabled={isProcessing || !webcamEnabled}
                >
                  {isProcessing ? 'Processing...' : 'Capture Face'}
                </Button>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-6 text-center min-h-[200px] flex flex-col justify-center">
                  {faceVerified ? (
                    <div className="space-y-3">
                      <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
                      <p className="font-medium text-green-900">Identity Verified!</p>
                      <p className="text-sm text-green-700">
                        {faceDetectionResult?.message || "Face matches ID document"}
                      </p>
                    </div>
                  ) : faceDetectionResult && !faceDetectionResult.is_valid ? (
                    <div className="space-y-3">
                      <XCircle className="w-16 h-16 text-red-600 mx-auto" />
                      <p className="font-medium text-red-900">Verification Failed</p>
                      <p className="text-sm text-red-700">{faceDetectionResult.message}</p>
                      <Button size="sm" onClick={captureFaceImage} disabled={isProcessing}>
                        Try Again
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <User className="w-16 h-16 text-gray-400 mx-auto" />
                      <p className="font-medium text-gray-600">
                        {isProcessing ? 'Analyzing...' : 'Ready to verify'}
                      </p>
                      {faceDetectionResult && (
                        <p className="text-sm text-gray-500">
                          Faces detected: {faceDetectionResult.faces_detected}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="text-sm text-amber-800">
                    <p className="font-medium mb-2">Tips for best results:</p>
                    <ul className="space-y-1">
                      <li>• Look directly at the camera</li>
                      <li>• Ensure good lighting</li>
                      <li>• Remove sunglasses or hats</li>
                      <li>• Stay still during capture</li>
                    </ul>
                  </div>
                </div>

                <div className="flex justify-center pt-2">
                    <Button 
                        onClick={proceedToNextStep} 
                        disabled={!faceVerified}
                        className="bg-blue-600 hover:bg-blue-700 w-full"
                        size="lg"
                    >
                        Proceed to Room Scan
                        <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                </div>
              </div>
            </div>

            <canvas ref={canvasRef} className="hidden" />
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg p-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Monitor className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Environment Check</h3>
                <p className="text-gray-600">
                  Please rotate your laptop/webcam 360 degrees to scan your room. 
                  Ensure your desk is clear of unauthorized materials.
                </p>
              </div>
              
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden max-w-2xl mx-auto">
                 <video 
                   ref={videoRef}
                   autoPlay 
                   playsInline
                   muted
                   className="w-full h-full object-cover"
                 />
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-white bg-black/50 px-3 py-1 rounded">Live Feed</p>
                 </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left">
                  <h4 className="font-medium text-amber-800 mb-2">Checklist:</h4>
                  <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                      <li>No other people in the room</li>
                      <li>Desk clear of books, phones, and notes</li>
                      <li>Room is well-lit</li>
                      <li>No headphones/earbuds worn</li>
                  </ul>
              </div>

              <div className="flex justify-center space-x-4">
                <Button 
                  onClick={() => {
                      toast({ title: "Room Scan Complete", description: "Environment check passed." });
                      setCurrentStep(5);
                  }} 
                  className="bg-blue-600 hover:bg-blue-700"
                >
                   <CheckCircle className="w-4 h-4 mr-2" />
                   I have scanned my room
                </Button>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Verification Complete</h3>
              <p className="text-gray-600">
                All verification steps completed successfully. You can now start your exam.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="font-medium text-green-900">System</p>
                  <p className="text-sm text-green-700">Passed</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="font-medium text-green-900">ID Card</p>
                  <p className="text-sm text-green-700">Verified</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="font-medium text-green-900">Face</p>
                  <p className="text-sm text-green-700">Matched</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="font-medium text-green-900">Room</p>
                  <p className="text-sm text-green-700">Scanned</p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg p-6 text-center">
                <h4 className="text-lg font-bold mb-2">Ready to Begin Exam</h4>
                <p className="text-blue-100 mb-4">
                  Your identity has been verified and system is ready for examination
                </p>
                <Button 
                   variant="secondary" 
                   size="lg"
                   onClick={() => navigate(`/exam/${examId}`)}
                   className="font-bold"
                >
                   Start Exam Now <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Cleanup webcam stream on component unmount
  useEffect(() => {
    return () => {
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [webcamStream]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Identity Verification</h1>
            <p className="text-gray-600 mt-1">Please complete verification before starting your exam</p>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
           <div className="mb-8">
              <Progress value={(currentStep / 5) * 100} className="h-2" />
              <div className="flex justify-between mt-2 text-sm text-gray-600">
                 <span className={currentStep >= 1 ? "text-blue-600 font-medium" : ""}>System Check</span>
                 <span className={currentStep >= 2 ? "text-blue-600 font-medium" : ""}>ID Verification</span>
                 <span className={currentStep >= 3 ? "text-blue-600 font-medium" : ""}>Face Verification</span>
                 <span className={currentStep >= 4 ? "text-blue-600 font-medium" : ""}>Room Scan</span>
                 <span className={currentStep >= 5 ? "text-blue-600 font-medium" : ""}>Review</span>
              </div>
           </div>

           {renderStepContent(currentStep)}
        </div>
      </div>
    </div>
  );
};

export default IdentityVerification;