import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, Camera, AlertTriangle, Flag, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { mockQuestions, mockExamSession, mockExams } from '../mock';
import { useToast } from '../hooks/use-toast';
import axios from 'axios'; // Import axios
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API_URL = `${BACKEND_URL}/api`;
import { loadModel, detectObjects } from '../utils/tensorflow_utils'; // [NEW] TensorFlow integration
import AnomalyScoreDisplay from './AnomalyScoreDisplay'; // [NEW] Anomaly Score Component

const ExamInterface = () => {
  const { examId } = useParams();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(7200); // 2 hours in seconds
  const [webcamStatus, setWebcamStatus] = useState('active');
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [flaggedQuestions, setFlaggedQuestions] = useState(new Set());
  const [questionsList, setQuestionsList] = useState([]); // State for fetched questions
  const [modelLoaded, setModelLoaded] = useState(false); // [NEW] Model state
  const [analysisResult, setAnalysisResult] = useState(null); // [NEW] Anomaly Analysis Result
  const clientWarningsRef = useRef([]); // [NEW] Buffer for warnings
  const videoRef = useRef(null);
  const screenVideoRef = useRef(null); // Ref for screen capture
  const audioContextRef = useRef(null); // Ref for audio analysis
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Calculate answered count
  const answeredCount = Object.keys(answers).length;

  // [NEW] Load TensorFlow Model
  useEffect(() => {
     loadModel().then(success => setModelLoaded(success));
  }, []);
  
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

  const exam = mockExams.find(e => e.id === examId);
  const questions = mockQuestions.filter(q => q.examId === examId);

  useEffect(() => {
    // [NEW] Fullscreen Listener
    const handleFullScreenChange = () => {
       const isFull = !!document.fullscreenElement;
       setIsFullscreen(isFull);
       if (!isFull) {
           clientWarningsRef.current.push("Exited Fullscreen");
       }
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);

    // Force Full Screen
    const enterFullScreen = async () => {
        try {
            if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
            }
        } catch (err) {
            console.error("Full screen denied:", err);
        }
    };
    enterFullScreen();

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

    // Initialize webcam and screen share
    initializeMonitoring();
    
    // Start Audio Monitoring
    initializeAudioMonitoring();
    
    // Fetch Exam Data
    const fetchExamData = async () => {
       try {
          const token = localStorage.getItem('token');
          // 1. Fetch Exam Details
          // In a real app, this endpoint would return the exam meta data
          // const resMeta = await axios.get(`${API_URL}/exams/${examId}`, ...);
          // For now, we mock the exam meta but fetch questions
          
          const resQuestions = await axios.get(`${API_URL}/exams/${examId}/questions`, {
             headers: { Authorization: `Bearer ${token}` }
          });
          setQuestionsList(resQuestions.data);
       } catch (error) {
          console.error("Failed to load exam data", error);
          toast({ title: "Error", description: "Failed to load questions", variant: "destructive" });
       }
    };

    fetchExamData();
    
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
  }, [examId]);

  const initializeAudioMonitoring = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
          const analyser = audioContextRef.current.createAnalyser();
          const microphone = audioContextRef.current.createMediaStreamSource(stream);
          const scriptProcessor = audioContextRef.current.createScriptProcessor(2048, 1, 1);

          analyser.smoothingTimeConstant = 0.8;
          analyser.fftSize = 1024;

          microphone.connect(analyser);
          analyser.connect(scriptProcessor);
          scriptProcessor.connect(audioContextRef.current.destination);
          
          let consecutiveLoudFrames = 0;

          scriptProcessor.onaudioprocess = () => {
              const array = new Uint8Array(analyser.frequencyBinCount);
              analyser.getByteFrequencyData(array);
              
              let values = 0;
              const length = array.length;
              for (let i = 0; i < length; i++) {
                  values += array[i];
              }
              const average = values / length;

              // Threshold for loud noise
              if (average > 30) { 
                  consecutiveLoudFrames++;
                  if (consecutiveLoudFrames > 50) { 
                      console.log("Audio violation detected: Loud noise");
                      // Add to buffer, avoid spamming duplicates excessively
                      if (clientWarningsRef.current && !clientWarningsRef.current.includes("Audio: High Volume")) {
                          clientWarningsRef.current.push("Audio: High Volume");
                      }
                      consecutiveLoudFrames = 0; 
                  }
              } else {
                  consecutiveLoudFrames = 0;
              }
          };
      } catch (err) {
          console.error("Audio monitoring failed:", err);
      }
  };

  const initializeMonitoring = async () => {
    try {
      // 1. Webcam Stream
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // 2. Screen Share (Required)
      try {
         const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
            video: { cursor: "always" }, 
            audio: false 
         });

         if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = screenStream;
         }
         
         screenStream.getVideoTracks()[0].onended = () => {
            toast({
               title: "Screen Share Ended",
               description: "You stopped screen sharing. PLEASE RE-ENABLE IT immediately to continue.",
               variant: "destructive"
            });
            setWebcamStatus('error');
         };
         
      } catch (screenErr) {
         console.error("Screen share denied:", screenErr);
         toast({ 
            title: "Screen Share Required", 
            description: "You must share your entire screen to take this exam.",
            variant: "destructive"
         });
      }

    } catch (err) {
      console.error("Error accessing camera:", err);
      setWebcamStatus('error');
      toast({
        title: "Camera Error",
        description: "Could not access webcam. Please check permissions.",
        variant: "destructive"
      });
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

            const sessionId = localStorage.getItem('examSessionId') || 'session_1'; 
            
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
            await axios.post(`${API_URL}/session/${sessionId}/analyze-enhanced`, {
                image_data: webcamImage,
                screen_data: screenImage,
                client_warnings: warningsToSend,
                timestamp: new Date().toISOString()
            }, {
                headers: { Authorization: `Bearer ${token}` }
            }).then(res => {
                // Update Analysis Result State
                if (res.data.analysis) {
                    setAnalysisResult(res.data.analysis);
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
  }, []);

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
            <h2 className="text-xl font-semibold mb-4">Exam Not Found</h2>
            <Button onClick={() => navigate('/student')}>Return to Dashboard</Button>
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
                <span className={timeRemaining <= 600 ? 'text-red-600' : 'text-gray-900'}>
                  {formatTime(timeRemaining)}
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
                    Question {currentQuestion + 1} of {questions.length}
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
                      {currentQuestionData.options.map((option, index) => (
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
                {currentQuestion === questions.length - 1 ? (
                  <Button onClick={handleSubmitExam} className="bg-green-600 hover:bg-green-700">
                    <Send className="w-4 h-4 mr-2" />
                    Submit Exam
                  </Button>
                ) : (
                  <Button 
                    onClick={() => setCurrentQuestion(Math.min(questions.length - 1, currentQuestion + 1))}
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
                  {answeredCount} of {questions.length} answered
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((_, index) => {
                    const isAnswered = answers[questions[index].id] !== undefined;
                    const isCurrent = index === currentQuestion;
                    const isFlagged = flaggedQuestions.has(questions[index].id);
                    
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