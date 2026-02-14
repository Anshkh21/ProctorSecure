
import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Camera, Mic, CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";

const SystemCheckDialog = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('idle'); // idle, checking, success, error
  const [micStatus, setMicStatus] = useState('idle');     // idle, checking, success, error
  const [stream, setStream] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const videoRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      stopStream();
      resetStatus();
    }
  }, [isOpen]);

  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const resetStatus = () => {
    setCameraStatus('idle');
    setMicStatus('idle');
    setErrorMsg("");
  };

  const startSystemCheck = async () => {
    setIsChecking(true);
    setCameraStatus('checking');
    setMicStatus('checking');
    setErrorMsg("");

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });

      setStream(mediaStream);
      
      // Check video track
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack && videoTrack.readyState === 'live') {
        setCameraStatus('success');
      } else {
        setCameraStatus('error');
      }

      // Check audio track
      const audioTrack = mediaStream.getAudioTracks()[0];
      if (audioTrack && audioTrack.readyState === 'live') {
        setMicStatus('success');
      } else {
        setMicStatus('error');
      }

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

    } catch (err) {
      console.error("System check error:", err);
      setCameraStatus('error');
      setMicStatus('error');
      
      if (err.name === 'NotAllowedError') {
        setErrorMsg("Permission denied. Please allow camera and microphone access in your browser settings.");
      } else if (err.name === 'NotFoundError') {
        setErrorMsg("No camera or microphone found. Please connect your devices.");
      } else {
        setErrorMsg("An error occurred while accessing devices: " + err.message);
      }
    } finally {
      setIsChecking(false);
    }
  };

  const StatusIcon = ({ status }) => {
    if (status === 'checking') return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    if (status === 'success') return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (status === 'error') return <XCircle className="w-5 h-5 text-red-500" />;
    return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>System Requirements Check</DialogTitle>
          <DialogDescription>
            Verify that your camera and microphone are working correctly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          
          {/* Video Preview Area */}
          <div className="bg-slate-950 rounded-lg aspect-video flex items-center justify-center overflow-hidden relative">
            {stream ? (
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline
                className="w-full h-full object-cover transform scale-x-[-1]" 
              />
            ) : (
              <div className="text-slate-500 flex flex-col items-center">
                <Camera className="w-12 h-12 mb-2 opacity-50" />
                <p className="text-sm">Click "Start Check" to test devices</p>
              </div>
            )}
            
            {/* Overlay Status */}
            {isChecking && (
               <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                 <div className="text-white flex flex-col items-center">
                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                    <p>Requesting permissions...</p>
                 </div>
               </div>
            )}
          </div>

          {/* Device Status List */}
          <div className="space-y-3">
            <div className={`flex items-center justify-between p-3 rounded-lg border ${cameraStatus === 'error' ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${cameraStatus === 'success' ? 'bg-green-100 text-green-600' : 'bg-white text-slate-500'}`}>
                   <Camera className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-sm text-slate-900">Webcam</p>
                  <p className="text-xs text-slate-500">
                    {cameraStatus === 'success' ? 'Connected & Access Granted' : 
                     cameraStatus === 'error' ? 'Connection Failed' : 'Waiting for check...'}
                  </p>
                </div>
              </div>
              <StatusIcon status={cameraStatus} />
            </div>

            <div className={`flex items-center justify-between p-3 rounded-lg border ${micStatus === 'error' ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${micStatus === 'success' ? 'bg-green-100 text-green-600' : 'bg-white text-slate-500'}`}>
                   <Mic className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-sm text-slate-900">Microphone</p>
                  <p className="text-xs text-slate-500">
                    {micStatus === 'success' ? 'Connected & Access Granted' : 
                     micStatus === 'error' ? 'Connection Failed' : 'Waiting for check...'}
                  </p>
                </div>
              </div>
              <StatusIcon status={micStatus} />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-start gap-2">
              <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{errorMsg}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Close
            </Button>
            {cameraStatus === 'idle' || cameraStatus === 'error' || micStatus === 'error' ? (
              <Button onClick={startSystemCheck} disabled={isChecking}>
                {isChecking ? "Checking..." : "Start Check"}
              </Button>
            ) : (
               <Button onClick={startSystemCheck} variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                 <RefreshCw className="w-4 h-4 mr-2" />
                 Test Again
               </Button>
            )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SystemCheckDialog;
