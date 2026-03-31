import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, BookOpen, AlertCircle, Play, User, LogOut } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import GuideDialog from './GuideDialog';
import SystemCheckDialog from './SystemCheckDialog';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const StudentDashboard = () => {
  const [exams, setExams] = useState([]);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadUserData();
    loadExams();
  }, []);

  const loadUserData = () => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.clear();
      navigate('/');
    }
  };

  const loadExams = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.clear();
        navigate('/');
        return;
      }

      const response = await axios.get(`${API}/exams`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setExams(response.data);
    } catch (error) {
      console.error('Error loading exams:', error);
      
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.clear();
        navigate('/');
      } else {
        toast({
          title: "Error",
          description: "Failed to load exams. Please try again.",
          variant: "destructive"
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartExam = async (examId) => {
    try {
      const token = localStorage.getItem('token');
      
      toast({
        title: "Exam Starting",
        description: "Redirecting to identity verification...",
      });
      
      // Start exam session
      await axios.post(`${API}/session/start`, { exam_id: examId }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Simulate delay for loading
      setTimeout(() => {
        navigate(`/verify?examId=${examId}`);
      }, 1000);
      
    } catch (error) {
      console.error('Error starting exam:', error);
      toast({
        title: "Error",
        description: "Failed to start exam. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
    navigate('/');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'missed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    // Ensure UTC interpretation for backend strings
    const dateStr = typeof dateString === 'string' && dateString.endsWith('Z') ? dateString : dateString + 'Z';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' at ' + date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  };

  const isExamUpcoming = (exam) => {
    if (exam.status !== 'scheduled') return false;
    
    // Ensure UTC interpretation
    let dateStr = exam.scheduled_at;
    if (typeof dateStr === 'string' && !dateStr.endsWith('Z')) {
        dateStr += 'Z';
    }
    
    const now = new Date();
    const scheduledTime = new Date(dateStr);
    const windowEndTime = new Date(scheduledTime.getTime() + 10 * 60000); // 10 minutes later

    // Upcoming means scheduled in the future OR currently in the 10-minute window
    // But if it's PAST the window, it's not upcoming, it's missed/closed
    return now <= windowEndTime;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <BookOpen className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Student Dashboard</h1>
                <p className="text-sm text-gray-600">Secure Exam Portal</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-gray-600" />
                <span className="text-gray-900 font-medium">{user?.name || 'Student'}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Welcome back, {user?.name?.split(' ')[0]}!
                </h2>
                <p className="text-gray-600">
                  You have {exams.filter(isExamUpcoming).length} upcoming exam{exams.filter(isExamUpcoming).length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="hidden md:block">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg p-4 text-white">
                  <BookOpen className="w-12 h-12 mb-2" />
                  <p className="font-medium">Ready to Excel?</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* System Check Banner */}
        <div className="mb-8">
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-6 h-6 text-amber-600" />
                <div>
                  <h3 className="font-semibold text-amber-900">System Requirements Check</h3>
                  <p className="text-amber-800 mt-1">
                    Ensure your webcam and microphone are working properly before starting any exam.
                  </p>
                </div>
                <SystemCheckDialog>
                  <Button variant="outline" className="ml-auto border-amber-300 text-amber-700 hover:bg-amber-100">
                    Test System
                  </Button>
                </SystemCheckDialog>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Exams Grid */}
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-gray-900">Your Exams</h3>
          
          {exams.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Exams Available</h3>
                <p className="text-gray-600">Check back later for upcoming examinations.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {exams.map((exam) => (
                <Card key={exam.id} className="group hover:shadow-lg transition-all duration-300">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg leading-tight">{exam.title}</CardTitle>
                        <CardDescription className="text-gray-600">{exam.subject}</CardDescription>
                      </div>
                      <Badge className={getStatusColor(exam.status)}>
                        {exam.status.replace('-', ' ')}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-600">{exam.duration} min</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <BookOpen className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-600">{exam.total_questions} questions</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">{formatDateTime(exam.scheduled_at)}</span>
                    </div>

                    {exam.instructions && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <h4 className="font-medium text-gray-900 mb-2">Instructions:</h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                          {exam.instructions.slice(0, 2).map((instruction, index) => (
                            <li key={index} className="flex items-start space-x-2">
                              <span className="text-gray-400">•</span>
                              <span>{instruction}</span>
                            </li>
                          ))}
                          {exam.instructions.length > 2 && (
                            <li className="text-gray-500 italic">+{exam.instructions.length - 2} more...</li>
                          )}
                        </ul>
                      </div>
                    )}

                    <div className="pt-2">
                      {(() => {
                        const now = new Date();
                        // Ensure naive UTC strings from backend are treated as UTC
                        let dateStr = exam.scheduled_at;
                        if (typeof dateStr === 'string' && !dateStr.endsWith('Z')) {
                            dateStr += 'Z';
                        }
                        const scheduledTime = new Date(dateStr);
                        const windowEndTime = new Date(scheduledTime.getTime() + 10 * 60000); // 10 minutes later

                        if (exam.status === 'active') {
                           return (
                            <Button 
                              className="w-full bg-green-600 hover:bg-green-700"
                              onClick={() => navigate(`/exam/${exam.id}`)}
                            >
                              Continue Exam
                            </Button>
                           );
                        }
                        
                        if (exam.status === 'completed') {
                           return (
                            <Button variant="outline" className="w-full" disabled>
                              Completed
                            </Button>
                           );
                        }

                        // Scheduled Logic with 10-minute window
                        if (now < scheduledTime) {
                           return (
                             <Button 
                               variant="secondary" 
                               className="w-full bg-yellow-100 text-yellow-800 hover:bg-yellow-200" 
                               disabled
                             >
                               <Clock className="w-4 h-4 mr-2" />
                               Starts {formatDateTime(exam.scheduled_at)}
                             </Button>
                           );
                        } else if (now > windowEndTime) {
                           return (
                             <Button 
                               variant="destructive" 
                               className="w-full" 
                               disabled
                             >
                               <AlertCircle className="w-4 h-4 mr-2" />
                               Entry Closed (Window Expired)
                             </Button>
                           );
                        } else {
                           return (
                            <Button 
                              className="w-full bg-blue-600 hover:bg-blue-700 group-hover:shadow-md transition-all animate-pulse"
                              onClick={() => handleStartExam(exam.id)}
                            >
                              <Play className="w-4 h-4 mr-2" />
                              Start Exam Now
                            </Button>
                           );
                        }
                      })()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Help Section */}
        <div className="mt-12">
          <Card className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold mb-2">Need Help?</h3>
                  <p className="text-indigo-100">
                    Check our comprehensive guide on exam preparation and system requirements.
                  </p>
                </div>
                <GuideDialog>
                  <Button variant="secondary" className="bg-white text-indigo-600 hover:bg-gray-100">
                    View Guide
                  </Button>
                </GuideDialog>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;