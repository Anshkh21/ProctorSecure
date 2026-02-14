import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, Camera, AlertTriangle, Flag, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import axios from 'axios'; // Import axios
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API_URL = `${BACKEND_URL}/api`;
import { loadModel, detectObjects } from '../utils/tensorflow_utils'; // [NEW] TensorFlow integration
import AnomalyScoreDisplay from './AnomalyScoreDisplay'; // [NEW] Anomaly Score Component

const ExamInterface = () => {
  const { examId } = useParams();
  
  // Helper to format seconds into MM:SS
  // Helper to format seconds into HH:MM:SS or MM:SS
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(null); // Initialize as null, set on start
  const [webcamStatus, setWebcamStatus] = useState('active');
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [flaggedQuestions, setFlaggedQuestions] = useState(new Set());
  const [questionsList, setQuestionsList] = useState([]); // State for fetched questions
  const [modelLoaded, setModelLoaded] = useState(false); // [NEW] Model state
  const [analysisResult, setAnalysisResult] = useState(null); // [NEW] Anomaly Analysis Result
  const clientWarningsRef = useRef([]); // [NEW] Buffer for warnings
  const videoRef = useRef(null);
  const screenVideoRef = useRef(null); // Ref for screen capture
  const webcamStreamRef = useRef(null); // [NEW] Ref to hold stream before video mount
  const screenStreamRef = useRef(null); // [NEW] Ref to hold screen stream
  const audioContextRef = useRef(null); // Ref for audio analysis
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Calculate answered count
  const answeredCount = Object.keys(answers).length;
  const progress = questionsList.length > 0 ? (answeredCount / questionsList.length) * 100 : 0;

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleFlagQuestion = (questionId) => {
    setFlaggedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const handleSubmitExam = async () => {
      try {
          const token = localStorage.getItem('token');
          let sessionId = localStorage.getItem('examSessionId');

          // [Robustness] Lazy Create Session if missing (e.g. user started before fix)
          if (!sessionId) {
              console.warn("Session ID missing at submission. Attempting lazy creation...");
              try {
                  const startRes = await axios.post(`${API_URL}/session/start`, {
                      exam_id: examId
                  }, {
                      headers: { Authorization: `Bearer ${token}` }
                  });
                  if (startRes.data.session_id) {
                      sessionId = startRes.data.session_id;
                      localStorage.setItem('examSessionId', sessionId);
                  }
              } catch (startErr) {
                  console.error("Lazy session creation failed:", startErr);
              }
          }

          if (!sessionId) {
              toast({
                  title: "Submission Error",
                  description: "Could not establish exam session. Please contact support.",
                  variant: "destructive"
              });
              return;
          }
          
          await axios.post(`${API_URL}/session/${sessionId}/submit`, {
              answers: answers,
              ended_at: new Date().toISOString()
          }, {
              headers: { Authorization: `Bearer ${token}` }
          });

          toast({
              title: "Exam Submitted",
              description: "Your responses have been recorded.",
              className: "bg-green-500 text-white"
          });
          
          if (document.fullscreenElement) {
              await document.exitFullscreen();
          }
          navigate('/student/dashboard');

      } catch (error) {
          console.error("Submission failed", error);
          toast({ 
              title: "Submission Error", 
              description: "Failed to submit exam. Please try again or contact support.", 
              variant: "destructive" 
          });
      }
  };

  // [NEW] Load TensorFlow Model
  useEffect(() => {
     loadModel().then(success => setModelLoaded(success));
  }, []);
  
  const [exam, setExam] = useState(null); // Load from API
  const [hasStarted, setHasStarted] = useState(false); // New state for start button

  // Anti-Cheat: Disable Copy/Paste and Context Menu
  useEffect(() => {
     const preventDefault = (e) => e.preventDefault();
     
     const handleCopyPaste = (e) => {
        e.preventDefault();
        toast({
           title: "Action Blocked",
           description: "Copying and pasting is disabled during the exam.",
           variant: "destructive"
        });
     };

     document.addEventListener('contextmenu', preventDefault);
     document.addEventListener('copy', handleCopyPaste);
     document.addEventListener('paste', handleCopyPaste);
     document.addEventListener('cut', handleCopyPaste);
     
     return () => {
        document.removeEventListener('contextmenu', preventDefault);
        document.removeEventListener('copy', handleCopyPaste);
        document.removeEventListener('paste', handleCopyPaste);
        document.removeEventListener('cut', handleCopyPaste);
     };
  }, []);

  // Fetch Data (Questions AND Metadata)
  useEffect(() => {
    const fetchExamData = async () => {
       try {
          const token = localStorage.getItem('token');
          
          // 1. Fetch all exams to find the current one (since we don't have a single exam endpoint yet)
          const resExams = await axios.get(`${API_URL}/exams`, {
             headers: { Authorization: `Bearer ${token}` }
          });
          const foundExam = resExams.data.find(e => e.id === examId);
          if (foundExam) {
             setExam(foundExam);
          } else {
             console.error("Exam not found in list");
          }

          // 2. Fetch Questions
          const resQuestions = await axios.get(`${API_URL}/exams/${examId}/questions`, {
             headers: { Authorization: `Bearer ${token}` }
          });
          setQuestionsList(resQuestions.data);

       } catch (error) {
          console.error("Failed to load exam data", error);
          toast({ title: "Error", description: "Failed to load exam data", variant: "destructive" });
       }
    };

    if (examId) {
        fetchExamData();
    }
  }, [examId]);

  // Monitoring and Fullscreen (Active only after start)
  useEffect(() => {
    if (!hasStarted) return;

    // Fullscreen Listener
    const handleFullScreenChange = () => {
       const isFull = !!document.fullscreenElement;
       setIsFullscreen(isFull);
       setIsFullscreen(isFull);
       if (!isFull) {
           // Grace period check: Don't flag in first 5 seconds of exam
           // (Implementing via simple timestamp check or ref)
           clientWarningsRef.current.push("Exited Fullscreen");
       }
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);

    // Initial Fullscreen Request is handled by the Start button now

    // Tab Switching / Focus Loss
    const handleVisibilityChange = () => {
        if (document.hidden) {
            toast({
                title: "Warning: Tab Switch Detected",
                description: "Leaving the exam tab is prohibited.",
                variant: "destructive"
            });
            if (clientWarningsRef.current) clientWarningsRef.current.push("Tab Switch detected");
        }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Initialize monitoring
    initializeMonitoring();
    initializeAudioMonitoring();
    
    // Start timer
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 0) {
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Prevent exit attempts
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'Are you sure you want to leave the exam?';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(timer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
      if (videoRef.current && videoRef.current.srcObject) {
         videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
      if (screenVideoRef.current && screenVideoRef.current.srcObject) {
         screenVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
          audioContextRef.current.close();
      }
    };
  }, [examId, hasStarted]);

  const handleStartExam = async () => {
      try {
          // 0. Create/Start Session Backend
          const token = localStorage.getItem('token');
          const res = await axios.post(`${API_URL}/session/start`, {
              exam_id: examId
          }, {
              headers: { Authorization: `Bearer ${token}` }
          });
          
          
          if (res.data.session_id) {
              console.log("Exam Session Started/Resumed:", res.data.session_id);
              localStorage.setItem('examSessionId', res.data.session_id);
              
              // Initialize Timer from Server Data (New Start or Resume)
              if (res.data.start_time && res.data.duration) {
                  // FORCE UTC: unexpected behavior if server sends naive string and browser implies local
                  const timeStr = res.data.start_time.endsWith('Z') ? res.data.start_time : res.data.start_time + 'Z';
                  const startTime = new Date(timeStr);
                  const now = new Date();
                  const elapsedSeconds = Math.floor((now - startTime) / 1000);
                  const totalSeconds = res.data.duration * 60;
                  
                  // If clock skew makes elapsed negative, treat as 0
                  const adjustedElapsed = Math.max(0, elapsedSeconds);
                  const remaining = Math.max(0, totalSeconds - adjustedElapsed);
                  
                  setTimeRemaining(remaining);
              } else if (exam && exam.duration) {
                  // Fallback if server doesn't return times (shouldn't happen with fix)
                  setTimeRemaining(exam.duration * 60);
              }
          } else {
              throw new Error("No session ID returned from server");
          }
          
          // 1. Request Screen Share FIRST
          await initializeMonitoring();
          await initializeAudioMonitoring();

          // 2. Request Fullscreen
          // 2. Request Fullscreen
          if (document.documentElement.requestFullscreen) {
              await document.documentElement.requestFullscreen();
              
              // Double check if it actually worked (browser might deny without enough user interaction)
              // Give it a tiny delay to register
              await new Promise(r => setTimeout(r, 100));
              if (!document.fullscreenElement) {
                   console.warn("Fullscreen request apparently succeeded but element is null.");
                   // Don't block, but warn user via the overlay that will appear immediately
              }
          }
          
          // 3. Start Exam State
          setHasStarted(true);

      } catch (err) {
          console.error("Start exam failed:", err);
          toast({ 
              title: "Setup Failed", 
              description: "Could not start exam session. Please try again.",
              variant: "destructive" 
          });
      }
  };

  const [audioContext, setAudioContext] = useState(null);

  const initializeAudioMonitoring = async () => {
      try {
          if (audioContextRef.current) return;

          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          audioContextRef.current = audioCtx;
          setAudioContext(audioCtx);

          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);

          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);

          const checkAudio = () => {
              if (!audioContextRef.current) return;
              
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < bufferLength; i++) {
                  sum += dataArray[i];
              }
              const average = sum / bufferLength;

              if (average > 50) { // Threshold
                  // console.warn("Loud noise detected");
                   if (clientWarningsRef.current && !clientWarningsRef.current.includes("Audio: High Volume")) {
                          clientWarningsRef.current.push("Audio: High Volume");
                   }
              }
              
              requestAnimationFrame(checkAudio);
          };

          checkAudio();

      } catch (err) {
          console.error("Audio monitoring failed:", err);
          // Don't block exam if audio fails, just warn
          toast({
                title: "Audio Warning",
                description: "Could not access microphone. continuing without audio monitoring.",
                variant: "warning"
          });
      }
  };

  const initializeMonitoring = async () => {
    try {
      // 1. Webcam Stream
      if (!webcamStreamRef.current) {
         try {
             const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
             webcamStreamRef.current = stream;
         } catch (e) {
             console.error("Webcam access denied", e);
             throw e;
         }
      }
      
      // Attach to video element if available
      if (videoRef.current && webcamStreamRef.current) {
          videoRef.current.srcObject = webcamStreamRef.current;
      }
      
      // 2. Screen Share (Required)
      if (!screenStreamRef.current) {
         try {
             const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
                video: { 
                    cursor: "always",
                    displaySurface: "browser" 
                }, 
                audio: false,
                selfBrowserSurface: "include", 
                systemAudio: "exclude",
                surfaceSwitching: "include",
                monitorTypeSurfaces: "exclude" 
             });
             screenStreamRef.current = screenStream;

             screenStream.getVideoTracks()[0].onended = () => {
                // Determine if this was an intentional stop or accidental
                // For now, treat as accidental/violation unless exam is submitted
                console.log("Screen share ended by user");
                 toast({
                   title: "Screen Share Ended",
                   description: "You stopped screen sharing. Please re-enable it to continue.",
                   variant: "destructive"
                });
                // Do NOT auto-submit. Just warn.
             };
         } catch (e) {
             console.error("Screen share access denied", e);
             throw e;
         }
      }

      // Attach to screen video element if available
      if (screenVideoRef.current && screenStreamRef.current) {
         screenVideoRef.current.srcObject = screenStreamRef.current;
      }

    } catch (err) {
      console.error("Error accessing camera/screen:", err);
      // Propagate error to handleStartExam
      throw err;
    }
  };

  useEffect(() => {
    const interval = setInterval(async () => {
        if (!videoRef.current) return;

        try {
            // Capture Webcam Frame
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 480;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const webcamImage = canvas.toDataURL('image/jpeg', 0.5);

            // Capture Screen Frame
            let screenImage = null;
            if (screenVideoRef.current && screenVideoRef.current.srcObject && screenVideoRef.current.srcObject.active) {
                const sCanvas = document.createElement('canvas');
                sCanvas.width = 1280;
                sCanvas.height = 720;
                const sCtx = sCanvas.getContext('2d');
                sCtx.drawImage(screenVideoRef.current, 0, 0, sCanvas.width, sCanvas.height);
                screenImage = sCanvas.toDataURL('image/jpeg', 0.5);
            }


            // Retrieve fresh sessionId and token in every loop iteration
            const currentSessionId = localStorage.getItem('examSessionId');
            const currentToken = localStorage.getItem('token'); 

            if (!currentSessionId || !currentToken) return; 

            // [NEW] Fetch Flags for Student Transparency
            let currentFlags = [];
            try {
                const flagRes = await axios.get(`${API_URL}/student/session/${currentSessionId}/flags`, {
                    headers: { Authorization: `Bearer ${currentToken}` }
                });
                currentFlags = flagRes.data;
            } catch (flagErr) {
                console.warn("Failed to fetch flags:", flagErr);
            }
            
            // [NEW] Object Detection
            if (modelLoaded && videoRef.current) {
                const detections = await detectObjects(videoRef.current);
                if (detections.length > 0) {
                   const distinctItems = [...new Set(detections.map(d => d.class))];
                   const msg = `Prohibited Item: ${distinctItems.join(', ')}`;
                   
                   // Rate limit warning
                   if (!clientWarningsRef.current.some(w => w.includes(msg))) {
                       clientWarningsRef.current.push(msg);
                       toast({ 
                           title: "Security Violation", 
                           description: `Detected: ${distinctItems.join(', ')}`, 
                           variant: "destructive" 
                       });
                   }
                }
            }

            // Get and clear warnings buffer
            const warningsToSend = [...clientWarningsRef.current];
            clientWarningsRef.current = []; // Clear buffer

            // [UPDATED] Use Enhanced Analysis Endpoint
            await axios.post(`${API_URL}/session/${currentSessionId}/analyze-enhanced`, {
                image_data: webcamImage,
                screen_data: screenImage,
                client_warnings: warningsToSend,
                timestamp: new Date().toISOString()
            }, {
                headers: { Authorization: `Bearer ${currentToken}` }
            }).then(res => {
                // Update Analysis Result State
                if (res.data.analysis) {
                    setAnalysisResult({
                        ...res.data.analysis,
                        flags: currentFlags // Attach fetched flags
                    });
                }

                // Handle Warnings (merged from backend)
                if (res.data.warnings && res.data.warnings.length > 0) {
                     res.data.warnings.forEach(w => {
                         toast({
                             title: "Proctor Warning",
                             description: w,
                             variant: "destructive",
                             duration: 3000
                         });
                     });
                }
            });

        } catch (err) {
            console.error("Monitoring cycle error:", err);
        }

    }, 5000); 

    return () => clearInterval(interval);
  }, [modelLoaded]);

  // Use questionsList from state
  const currentQuestionData = questionsList.length > 0 ? questionsList[currentQuestion] : null;

  if (!exam || !currentQuestionData) { 
      // If we are loading questions, show a loading state instead of "Exam Not Found" immediately
      if (questionsList.length === 0 && exam) {
          return <div className="min-h-screen flex items-center justify-center">Loading Exam Questions...</div>;
      }
      // ... existing error UI ...
      return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-4">Loading Exam...</h2>
            {/* If it takes too long, it might be 404, but let's give it a moment or user relies on toast error */}
            <p className="text-gray-500 mb-4">Please wait while we set up your environment.</p>
            <Button variant="outline" onClick={() => navigate('/student')}>Return to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasStarted) {
      return (
          <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
              <Card className="max-w-2xl w-full shadow-xl">
                  <CardHeader>
                      <CardTitle className="text-2xl">Ready to Begin?</CardTitle>
                      <CardDescription>
                          {exam.title} • {exam.duration} Minutes • {questionsList.length} Questions
                      </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                      <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r">
                          <div className="flex">
                              <div className="flex-shrink-0">
                                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                              </div>
                              <div className="ml-3">
                                  <h3 className="text-sm font-medium text-amber-800">Proctored Exam Session</h3>
                                  <div className="mt-2 text-sm text-amber-700">
                                      <p>This exam is monitored. By clicking start, you agree to:</p>
                                      <ul className="list-disc list-inside mt-1 ml-2">
                                          <li>Webcam and audio recording</li>
                                          <li>Screen sharing (required)</li>
                                          <li>Fullscreen mode enforcement</li>
                                      </ul>
                                  </div>
                              </div>
                          </div>
                      </div>
                      
                      <div className="space-y-2">
                          <h4 className="font-medium text-gray-900">Before you start:</h4>
                          <ul className="list-disc pl-5 space-y-1 text-gray-600 text-sm">
                              <li>Ensure you are in a quiet, well-lit room.</li>
                              <li>Close all other tabs and applications.</li>
                              <li>Have your ID ready if requested.</li>
                              <li>Do not leave the exam window once started.</li>
                          </ul>
                      </div>

                      <Button 
                          onClick={handleStartExam} 
                          className="w-full text-lg py-6 font-bold bg-blue-600 hover:bg-blue-700 shadow-md transition-all transform hover:scale-[1.01]"
                      >
                          Start Exam & Enter Fullscreen
                      </Button>
                  </CardContent>
              </Card>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* [NEW] Lockdown Overlay */}
      {!isFullscreen && (
        <div className="fixed inset-0 bg-red-600 z-[9999] flex flex-col items-center justify-center text-white p-8 text-center animate-pulse">
            <AlertTriangle className="w-32 h-32 mb-6" />
            <h1 className="text-5xl font-bold mb-6">EXAM VIOLATION</h1>
            <p className="text-2xl mb-8 max-w-2xl">
                You have exited full screen mode. Please return immediately. 
                This incident has been recorded.
            </p>
            <Button 
                onClick={() => document.documentElement.requestFullscreen()} 
                variant="secondary" 
                size="lg"
                className="text-xl px-8 py-6 font-bold"
            >
                RETURN TO EXAM
            </Button>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-lg font-semibold text-gray-900">{exam.title}</h1>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  webcamStatus === 'active' ? 'bg-green-500' : 
                  webcamStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                }`}></div>
                <span className="text-sm text-gray-600">
                  {webcamStatus === 'active' ? 'Monitoring Active' : 
                   webcamStatus === 'error' ? 'Camera Error' : 'Camera Inactive'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2 text-lg font-mono">
                <Clock className="w-5 h-5 text-gray-600" />
                <span className={(timeRemaining !== null && timeRemaining <= 600) ? 'text-red-600' : 'text-gray-900'}>
                  {timeRemaining !== null ? formatTime(timeRemaining) : '--:--'}
                </span>
              </div>
              <Button 
                variant="destructive"
                onClick={handleSubmitExam}
                className="bg-red-600 hover:bg-red-700"
              >
                Submit Exam
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Main Question Area */}
          <div className="lg:col-span-3">
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    Question {currentQuestion + 1} of {questionsList.length}
                  </CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleFlagQuestion(currentQuestionData.id)}
                    className={flaggedQuestions.has(currentQuestionData.id) ? 'bg-yellow-100 text-yellow-800' : ''}
                  >
                    <Flag className="w-4 h-4 mr-1" />
                    {flaggedQuestions.has(currentQuestionData.id) ? 'Flagged' : 'Flag'}
                  </Button>
                </div>
                <Progress value={progress} className="mt-2" />
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div className="prose max-w-none">
                  <p className="text-lg text-gray-900 leading-relaxed">
                    {currentQuestionData.question}
                  </p>
                </div>

                {currentQuestionData.type === 'multiple-choice' && (
                  <RadioGroup 
                    value={answers[currentQuestionData.id] || ''}
                    onValueChange={(value) => handleAnswerChange(currentQuestionData.id, value)}
                  >
                    <div className="space-y-3">
                      {currentQuestionData.options?.map((option, index) => (
                        <div key={index} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                          <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                          <Label 
                            htmlFor={`option-${index}`} 
                            className="flex-1 cursor-pointer text-gray-900"
                          >
                            {option}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                )}

                {currentQuestionData.type === 'text' && (
                  <div className="space-y-2">
                    <Label htmlFor="text-answer">Your Answer:</Label>
                    <Textarea
                      id="text-answer"
                      placeholder="Type your answer here..."
                      value={answers[currentQuestionData.id] || ''}
                      onChange={(e) => handleAnswerChange(currentQuestionData.id, e.target.value)}
                      rows={6}
                      className="resize-none"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between mt-6">
              <Button 
                variant="outline"
                onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                disabled={currentQuestion === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
              
              <div className="flex space-x-3">
                {currentQuestion === questionsList.length - 1 ? (
                  <Button onClick={handleSubmitExam} className="bg-green-600 hover:bg-green-700">
                    <Send className="w-4 h-4 mr-2" />
                    Submit Exam
                  </Button>
                ) : (
                  <Button 
                    onClick={() => setCurrentQuestion(Math.min(questionsList.length - 1, currentQuestion + 1))}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* [NEW] Anomaly Score Display */}
            {analysisResult && (
                <AnomalyScoreDisplay 
                    analysisResult={analysisResult} 
                    showDetails={true} 
                />
            )}

            {/* Webcam Monitor */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <Camera className="w-4 h-4 mr-2" />
                  Live Monitor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-900 rounded-lg aspect-video overflow-hidden">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    muted 
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Your session is being monitored for security purposes
                </p>
              </CardContent>
            </Card>

            {/* Question Navigator */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Question Navigator</CardTitle>
                <p className="text-xs text-gray-600">
                  {answeredCount} of {questionsList.length} answered
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-2">
                  {questionsList.map((_, index) => {
                    const isAnswered = answers[questionsList[index].id] !== undefined;
                    const isCurrent = index === currentQuestion;
                    const isFlagged = flaggedQuestions.has(questionsList[index].id);
                    
                    return (
                      <button
                        key={index}
                        onClick={() => setCurrentQuestion(index)}
                        className={`w-8 h-8 text-xs rounded border-2 transition-all ${
                          isCurrent 
                            ? 'bg-blue-600 text-white border-blue-600' 
                            : isFlagged 
                            ? 'bg-yellow-200 text-yellow-800 border-yellow-400'
                            : isAnswered 
                            ? 'bg-green-100 text-green-800 border-green-300' 
                            : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                        }`}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
                
                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
                    <span className="text-gray-600">Answered</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-yellow-200 border border-yellow-400 rounded"></div>
                    <span className="text-gray-600">Flagged</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-gray-100 border border-gray-300 rounded"></div>
                    <span className="text-gray-600">Not visited</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Exam Rules */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2 text-amber-600" />
                  Exam Rules
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-xs text-gray-600 space-y-2">
                  <li>• Stay in camera view</li>
                  <li>• No external materials</li>
                  <li>• No tab switching</li>
                  <li>• Raise hand for assistance</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamInterface;