import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Progress } from './ui/progress';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  AlertTriangle, 
  Eye, 
  Clock, 
  CheckCircle, 
  Flag,
  Monitor,
  Volume2,
  Camera,
  LogOut,
  RefreshCw,
  Download,
  Search,
  FileText,
  Trash2,
  Plus,
  Edit,
  Shield,
  BookOpen,
  GraduationCap
} from 'lucide-react';
import { Input } from './ui/input';
import { useToast } from '../hooks/use-toast';
import { EnrollmentTab } from './EnrollmentTab';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const ProctorDashboard = () => {
  const { toast } = useToast();
  const [students, setStudents] = useState([]);
  const [flags, setFlags] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [selectedExamFilter, setSelectedExamFilter] = useState('all');
  const [exams, setExams] = useState([]); // New state for exams
  const [selectedExamForEnrollment, setSelectedExamForEnrollment] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [emailInput, setEmailInput] = useState('');
  const [enrollingStudents, setEnrollingStudents] = useState(false);
  const [liveFeed, setLiveFeed] = useState({ webcam: null, screen: null });
  const [analytics, setAnalytics] = useState({ average_time_per_question: 0, most_difficult_question: 'N/A' });
  const [isActionPending, setIsActionPending] = useState(false);
  const [selectedExamForReset, setSelectedExamForReset] = useState('');
  const [selectedStudentForReset, setSelectedStudentForReset] = useState('');
  const navigate = useNavigate();

  // Parse role from stored JWT for UI gating
  const currentUserRole = (() => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return 'proctor';
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role || 'proctor';
    } catch { return 'proctor'; }
  })();
  const isAdmin = currentUserRole === 'admin';

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };
      
      const [studentsRes, flagsRes, examsRes, analyticsRes] = await Promise.all([
        axios.get(`${API}/proctor/students`, config),
        axios.get(`${API}/proctor/flags`, config),
        axios.get(`${API}/exams`, config),
        axios.get(`${API}/proctor/analytics`, config)
      ]);
      
      // Transform backend data to match UI expected format if needed
      // Currently backend response keys match what we put in server.py
      const studentsData = studentsRes.data.map(s => ({
        ...s,
        webcamStatus: s.webcam_status, // map snake_case to camelCase
        screenStatus: s.screen_status,
        flagCount: s.flag_count,
        timeRemaining: s.time_remaining,
        lastActivity: s.last_active,
        exam_title: s.examTitle // Map camelCase from backend to snake_case expected by UI
      }));
      
      setStudents(studentsData);
      setFlags(flagsRes.data.map(flag => ({
          ...flag,
          studentId: flag.student_id // Fix mismatch
      })));
      setExams(examsRes.data); // Set exams data
      setAnalytics(analyticsRes.data);
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      if (error.response && error.response.status === 401) {
        navigate('/login');
      }
    }
  };

  const handleDeleteExam = async (examId) => {
     if (!window.confirm("Are you sure you want to delete this exam? This action cannot be undone.")) {
       return;
     }
     
     try {
       const token = localStorage.getItem('token');
       await axios.delete(`${API}/proctor/exams/${examId}`, {
         headers: { Authorization: `Bearer ${token}` }
       });
       
       setExams(exams.filter(e => e.id !== examId));
     } catch (error) {
       console.error("Error deleting exam:", error);
       alert("Failed to delete exam");
     }
  };

  useEffect(() => {
    // Initial fetch
    fetchDashboardData();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchDashboardData, 5000);
    
    setRefreshInterval(interval);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  // Poll for live feed when a student is selected
  useEffect(() => {
      let interval;
      if (selectedStudent && selectedStudent.sessionId) {
          const fetchLiveFeed = async () => {
              try {
                  const token = localStorage.getItem('token');
                  const res = await axios.get(`${API}/proctor/session/${selectedStudent.sessionId}/live`, {
                      headers: { Authorization: `Bearer ${token}` }
                  });
                  setLiveFeed({
                      webcam: res.data.webcam_frame,
                      screen: res.data.screen_frame
                  });
              } catch (err) {
                  console.error("Error fetching live feed", err);
              }
          };
          fetchLiveFeed(); // Initial fetch
          interval = setInterval(fetchLiveFeed, 1000); // Poll every second (adjustable)
      } else {
          setLiveFeed({ webcam: null, screen: null });
      }
      return () => clearInterval(interval);
  }, [selectedStudent]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'verified': return 'bg-green-100 text-green-800';
      case 'flagged': return 'bg-red-100 text-red-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const filteredStudents = students.filter(student => 
    (activeTab === 'results' ? student.status?.toLowerCase() === 'completed' : student.status?.toLowerCase() !== 'completed') &&
    (selectedExamFilter === 'all' || student.examId === selectedExamFilter) &&
    (student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const analyticsStudents = students.filter(student => 
    (selectedExamFilter === 'all' || student.examId === selectedExamFilter)
  );

  const totalStudents = students.length;
  const activeStudents = students.filter(s => s.status === 'verified').length;
  const flaggedStudents = students.filter(s => s.status === 'flagged').length;
  const totalFlags = flags.length;

  const formatTimestamp = (timeString) => {
    if (!timeString) return 'N/A';
    // Force UTC interpretation by appending 'Z' if missing (fixes local time assumption)
    const ts = timeString.endsWith('Z') ? timeString : timeString + 'Z';
    const date = new Date(ts);
    return date.toLocaleString('en-IN', { 
        timeZone: 'Asia/Kolkata',
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
    });
  };

  const handleStudentClick = (student) => {
    setSelectedStudent(student);
    setActiveTab('student-detail');
  };

  const handleEditExam = (exam) => {
    // Navigate with both query param (robust) and state (legacy/backup)
    navigate(`/create-exam?editId=${exam.id}`, { state: { examToEdit: exam } });
  };

  const exportReport = () => {
    // Mock export functionality
    const data = {
      examSession: 'Software Engineering Fundamentals',
      timestamp: new Date().toISOString(),
      students: students.length,
      flags: flags.length,
      details: { students, flags }
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const examId = selectedStudent ? selectedStudent.examId : 'all';
    a.download = `exam-report-${examId}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSendMessage = async () => {
    if (!selectedStudent) return;
    const msg = prompt(`Enter message to send to ${selectedStudent.name}:`, "Please check your camera angle.");
    if (!msg) return;

    setIsActionPending(true);
    try {
        const token = localStorage.getItem('token');
        await axios.post(`${API}/proctor/send-message`, {
            student_id: selectedStudent.id,
            session_id: selectedStudent.sessionId,
            message: msg
        }, { headers: { Authorization: `Bearer ${token}` } });
        toast({ title: "Message Sent", description: `Message delivered to ${selectedStudent.name}` });
    } catch (err) {
        toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
    } finally {
        setIsActionPending(false);
    }
  };

  const handleFlagStudent = async () => {
      if (!selectedStudent) return;
      const reason = prompt(`Reason for flagging ${selectedStudent.name}:`, "Suspicious behavior observed.");
      if (!reason) return;
  
      setIsActionPending(true);
      try {
          const token = localStorage.getItem('token');
          await axios.post(`${API}/proctor/flag`, {
              student_id: selectedStudent.id,
              session_id: selectedStudent.sessionId,
              flag_type: "proctor_manual_flag",
              description: reason,
              severity: "high"
          }, { headers: { Authorization: `Bearer ${token}` } });
          toast({ title: "Student Flagged", description: `Manually flagged ${selectedStudent.name}` });
          fetchDashboardData();
      } catch (err) {
          toast({ title: "Error", description: "Failed to flag student.", variant: "destructive" });
      } finally {
          setIsActionPending(false);
      }
  };

  const handleEndSession = async () => {
    if (!selectedStudent) return;
    if (!window.confirm(`Are you sure you want to FORCE END the exam for ${selectedStudent.name}? This action cannot be undone.`)) return;

    setIsActionPending(true);
    try {
        const token = localStorage.getItem('token');
        await axios.post(`${API}/proctor/end-session/${selectedStudent.sessionId}`, {}, {
            headers: { Authorization: `Bearer ${token}` }
        });
        toast({ title: "Session Terminated", description: `Forced ended exam for ${selectedStudent.name}.` });
        fetchDashboardData();
        setSelectedStudent(null);
        setActiveTab('students');
    } catch (err) {
        toast({ title: "Error", description: "Failed to terminate session.", variant: "destructive" });
    } finally {
        setIsActionPending(false);
    }
  };

  const handleResetData = async (collectionName, label) => {
    if (!window.confirm(`⚠️ WARNING ⚠️\n\nAre you sure you want to delete all ${label}? This action CANNOT be undone.`)) {
      return;
    }

    setIsActionPending(true);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/admin/reset/${collectionName}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast({
        title: "Success",
        description: `Successfully cleared ${label}.`,
        className: "bg-green-50 border-green-200"
      });
      
      // Refresh the dashboard to clear the UI
      fetchDashboardData();
      
      // If we deleted students or sessions, we should probably clear the selected student view
      if (['sessions', 'students', 'all'].includes(collectionName)) {
         setSelectedStudent(null);
         setActiveTab("overview");
      }
      
    } catch (err) {
      console.error(`Error resetting ${collectionName}:`, err);
      toast({
        title: "Error",
        description: err.response?.data?.detail || `Failed to clear ${label}.`,
        variant: "destructive"
      });
    } finally {
      setIsActionPending(false);
    }
  };

  // --- Helper: Flag Aggregation ---
  const groupFlags = (flagsArray) => {
    if (!flagsArray || flagsArray.length === 0) return [];
    
    const grouped = {};
    flagsArray.forEach(flag => {
      // Normalise field name: backend ProctoringFlag model stores as `type`, but some paths may use `flag_type`
      const flagType = flag.type || flag.flag_type || 'unknown';
      const studentKey = flag.student_id || flag.studentId || 'unknown-student';
      const sessionKey = flag.session_id || 'no-session';
      // Create a unique key per student + session + violation type
      const key = `${studentKey}-${sessionKey}-${flagType}`;
      
      if (!grouped[key]) {
        grouped[key] = {
          ...flag,
          type: flagType,       // Normalise to always have `type`
          count: 1,
          occurrences: [flag]
        };
      } else {
        grouped[key].count += 1;
        grouped[key].occurrences.push(flag);
        // Keep the *latest* timestamp
        if (new Date(flag.timestamp) > new Date(grouped[key].timestamp)) {
           grouped[key].timestamp = flag.timestamp;
        }
      }
    });
    
    // Sort: high severity first, then by latest timestamp descending
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return Object.values(grouped).sort((a, b) => {
      const sA = severityOrder[a.severity] ?? 3;
      const sB = severityOrder[b.severity] ?? 3;
      if (sA !== sB) return sA - sB;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Monitor className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Proctor Dashboard</h1>
                <p className="text-sm text-gray-600">Live Exam Monitoring</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => navigate('/create-exam')}>
                + Create Exam
              </Button>
              <Button variant="outline" size="sm" onClick={exportReport}>
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
              <Button variant="ghost" size="sm" onClick={fetchDashboardData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Students</p>
                  <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
                </div>
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Sessions</p>
                  <p className="text-2xl font-bold text-green-600">{activeStudents}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Flagged Students</p>
                  <p className="text-2xl font-bold text-red-600">{flaggedStudents}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Flags</p>
                  <p className="text-2xl font-bold text-yellow-600">{totalFlags}</p>
                </div>
                <Flag className="w-8 h-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="students">Live Sessions</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="flags">Flags & Alerts</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="exams">Exams</TabsTrigger>
            <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
            <TabsTrigger value="system">System Actions</TabsTrigger>
            {selectedStudent && (
              <TabsTrigger value="student-detail">Student Detail</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {exams.length === 0 ? (
              /* Onboarding/Empty State for New Proctors */
              <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
                <CardContent className="p-8">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Shield className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Your Proctor Dashboard!</h2>
                    <p className="text-gray-600">Let's get you started with monitoring exams</p>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6 mt-8">
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                        <span className="text-blue-600 font-bold text-lg">1</span>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">Create an Exam</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Click the "Create Exam" button to set up your first proctored examination with questions and settings.
                      </p>
                      <Button onClick={() => navigate('/create-exam')} className="w-full bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Your First Exam
                      </Button>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm">
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                        <span className="text-indigo-600 font-bold text-lg">2</span>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">Enroll Students</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Go to the "Enrollments" tab to add students to your exam using their email addresses.
                      </p>
                      <Button onClick={() => setActiveTab('enrollments')} variant="outline" className="w-full">
                        <Users className="w-4 h-4 mr-2" />
                        View Enrollments
                      </Button>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                        <span className="text-purple-600 font-bold text-lg">3</span>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">Monitor Live</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Once students start taking exams, you'll see real-time monitoring data, webcam feeds, and alerts here.
                      </p>
                      <Button variant="outline" className="w-full" disabled>
                        <Monitor className="w-4 h-4 mr-2" />
                        Awaiting Active Sessions
                      </Button>
                    </div>
                  </div>

                  <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-900">
                      <strong>💡 Tip:</strong> Students will only see exams they're enrolled in. Make sure to enroll your students after creating an exam!
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Live Student Feed */}
                <Card>
                  <CardHeader>
                    <CardTitle>Live Student Monitoring</CardTitle>
                    <CardDescription>Real-time view of active exam sessions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {students.filter(s => s.status !== 'completed').length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No active exam sessions</p>
                        <p className="text-sm mt-1">Students will appear here when they start taking exams</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {students.filter(s => s.status !== 'completed').slice(0, 3).map((student) => (
                          <div key={student.sessionId || student.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <Avatar>
                                <AvatarFallback>{student.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-gray-900">{student.name}</p>
                                <p className="text-sm text-gray-600">Progress: {student.progress}%</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge className={getStatusColor(student.status)}>
                                {student.status}
                              </Badge>
                              <Button size="sm" variant="outline" onClick={() => handleStudentClick(student)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Flags */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Flags</CardTitle>
                    <CardDescription>Latest security alerts and violations</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {flags.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Flag className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No flags reported</p>
                        <p className="text-sm mt-1">Security alerts will appear here</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {flags.slice(0, 4).map((flag) => {
                          const student = students.find(s => s.id === flag.studentId);
                          return (
                            <div key={flag.id} className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg">
                              <div className={`w-3 h-3 rounded-full mt-2 ${getSeverityColor(flag.severity)}`}></div>
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{flag.student_name || student?.name || 'Unknown Student'}</p>
                                <p className="text-sm text-gray-600">{flag.description}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {flag.exam_title} • {formatTimestamp(flag.timestamp)}
                                </p>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {flag.severity}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="enrollments" className="space-y-6">
            <EnrollmentTab 
              exams={exams} 
              token={localStorage.getItem('token')} 
              toast={toast} 
            />
          </TabsContent>

          <TabsContent value="students" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Active Student Sessions</h2>
              <div className="flex items-center space-x-4">
                <select 
                  className="h-9 w-[200px] border border-gray-200 rounded-md text-sm bg-white px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedExamFilter}
                  onChange={(e) => setSelectedExamFilter(e.target.value)}
                >
                  <option value="all">All Exams</option>
                  {exams.map(exam => (
                    <option key={exam.id} value={exam.id}>{exam.title}</option>
                  ))}
                </select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input 
                    placeholder="Search students..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
              </div>
            </div>

            {filteredStudents.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
                    <Monitor className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">No Active Sessions</h3>
                    <p className="text-gray-500 max-w-sm mx-auto mt-1">
                        Students will appear here automatically when they start taking an exam.
                    </p>
                </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStudents.map((student) => (
                <Card key={student.sessionId} className="group hover:shadow-lg transition-all cursor-pointer" 
                      onClick={() => handleStudentClick(student)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarFallback>{student.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-sm">{student.name}</CardTitle>
                          <CardDescription className="text-xs">{student.email}</CardDescription>
                        </div>
                      </div>
                      <Badge className={getStatusColor(student.status)}>
                        {student.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Progress</span>
                        <span className="font-medium">{student.progress}%</span>
                      </div>
                      <Progress value={student.progress} />
                    </div>
                    
                    {/* [NEW] Score Display for Completed Exams */}
                    {student.status === 'completed' && (
                        <div className="bg-blue-50 p-2 rounded text-center">
                            <p className="text-xs text-blue-600 font-semibold uppercase">Final Score</p>
                            <p className="text-lg font-bold text-blue-800">
                                {student.score} / {student.total_points} ({student.percentage?.toFixed(1)}%)
                            </p>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center space-x-2">
                        <Camera className={`w-4 h-4 ${student.webcamStatus === 'active' ? 'text-green-600' : 'text-red-600'}`} />
                        <span className="text-gray-600">Webcam</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Monitor className={`w-4 h-4 ${student.screenStatus === 'monitored' ? 'text-green-600' : 'text-yellow-600'}`} />
                        <span className="text-gray-600">Screen</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Flags: {student.flagCount}</span>
                      <span className="text-gray-600">Time: {student.timeRemaining ? Math.round(student.timeRemaining) : 0}min</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            )}
          </TabsContent>

          <TabsContent value="results" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Exam Results</h2>
              <div className="flex items-center space-x-4">
                <select 
                  className="h-9 w-[200px] border border-gray-200 rounded-md text-sm bg-white px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedExamFilter}
                  onChange={(e) => setSelectedExamFilter(e.target.value)}
                >
                  <option value="all">All Exams</option>
                  {exams.map(exam => (
                    <option key={exam.id} value={exam.id}>{exam.title}</option>
                  ))}
                </select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input 
                    placeholder="Search results..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="relative w-full overflow-auto">
                  <table className="w-full caption-bottom text-sm text-left">
                    <thead className="[&_tr]:border-b bg-gray-50/50">
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Student</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Exam</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Submitted At</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Score</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Percentage</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-gray-500">
                            <div className="flex flex-col items-center justify-center">
                                <CheckCircle className="w-12 h-12 text-gray-300 mb-3" />
                                <p className="text-lg font-medium text-gray-900">No Results Found</p>
                                <p className="text-sm text-gray-500">Completed exams will appear here.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((student) => (
                            <tr key={student.sessionId} className="border-b transition-colors hover:bg-gray-50/50">
                              <td className="p-4 align-middle">
                                <div className="flex items-center space-x-3">
                                  <Avatar className="w-8 h-8">
                                    <AvatarFallback className="text-xs">
                                      {student.name?.split(' ').map(n => n[0]).join('')}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium text-gray-900">{student.name}</p>
                                    <p className="text-xs text-gray-500">{student.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 align-middle">
                                {student.exam_title || 'Unknown Exam'}
                              </td>
                              <td className="p-4 align-middle text-gray-500">
                                {student.end_time ? formatTimestamp(student.end_time) : 'N/A'}
                              </td>
                              <td className="p-4 align-middle font-medium">
                                {student.score} / {student.total_points}
                              </td>
                              <td className="p-4 align-middle">
                                <Badge variant={student.percentage >= 50 ? "default" : "destructive"} 
                                       className={student.percentage >= 50 ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-100" : "bg-red-100 text-red-800 border-red-200 hover:bg-red-100"}>
                                  {student.percentage?.toFixed(1)}%
                                </Badge>
                              </td>
                              <td className="p-4 align-middle text-right">
                                <Button size="sm" variant="outline" onClick={() => handleStudentClick(student)}>
                                  View Details
                                </Button>
                              </td>
                            </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="flags" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Flags & Alerts</h2>
              <div className="flex space-x-2">
                <Badge variant="outline" className="bg-red-50 text-red-700">
                  {groupFlags(flags).filter(f => f.severity === 'high').length} High Priority
                </Badge>
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                  {groupFlags(flags).filter(f => f.severity === 'medium').length} Medium Priority
                </Badge>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="relative w-full overflow-auto">
                  <table className="w-full caption-bottom text-sm text-left">
                    <thead className="[&_tr]:border-b bg-gray-50/50">
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[100px]">Severity</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Student</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Incident</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Exam</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Time</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flags.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-gray-500">
                            No flags reported. Clean sessions!
                          </td>
                        </tr>
                      ) : (
                        groupFlags(flags).map((flagGroup) => {
                          const student = students.find(s => s.id === (flagGroup.student_id || flagGroup.studentId));
                          // Prefer backend-enriched student_name so completed-session students still display
                          const displayName = flagGroup.student_name || student?.name || 'Unknown';
                          const displayEmail = student?.email || '';
                          const initials = displayName !== 'Unknown'
                            ? displayName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase()
                            : '?';
                          return (
                            <tr key={flagGroup.id || `${flagGroup.student_id || flagGroup.studentId}-${flagGroup.type}`} className="border-b transition-colors hover:bg-gray-50/50">
                              <td className="p-4 align-middle">
                                <Badge className={`${getSeverityColor(flagGroup.severity)} text-white border-0`}>
                                  {(flagGroup.severity || 'low').toUpperCase()}
                                </Badge>
                              </td>
                              <td className="p-4 align-middle">
                                <div className="flex items-center space-x-3">
                                  <Avatar className="w-8 h-8">
                                    <AvatarFallback className="text-xs">
                                      {initials}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium text-gray-900">{displayName}</p>
                                    <p className="text-xs text-gray-500">{displayEmail}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 align-middle">
                                <div className="flex items-center space-x-2">
                                  <div>
                                    <p className="font-medium text-gray-900">{(flagGroup.type || flagGroup.flag_type || 'unknown').replace(/_/g, ' ').toUpperCase()}</p>
                                    <p className="text-xs text-gray-500">{flagGroup.description}</p>
                                  </div>
                                  {flagGroup.count > 1 && (
                                    <Badge variant="secondary" className="bg-gray-200 text-gray-700 ml-2">
                                      x {flagGroup.count}
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 align-middle">
                                {flagGroup.exam_title || 'Unknown Exam'}
                              </td>
                              <td className="p-4 align-middle text-gray-500">
                                {new Date(flagGroup.timestamp.endsWith('Z') ? flagGroup.timestamp : flagGroup.timestamp + 'Z').toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                              </td>
                              <td className="p-4 align-middle text-right">
                                {flagGroup.evidence_image ? (
                                  <Button size="sm" variant="outline" className="h-8" onClick={() => {
                                      const win = window.open();
                                      let imagesHtml = flagGroup.occurrences
                                          .filter(occ => occ.evidence_image)
                                          .map(occ => `<div style="text-align:center;margin-bottom:2rem;"><p style="color:white;font-family:sans-serif;">${new Date(occ.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p><img src="${occ.evidence_image}" style="max-width:90%;max-height:80vh;border:2px solid white;"/></div>`)
                                          .join('');
                                          
                                      if (!imagesHtml) {
                                          imagesHtml = `<div style="color:white;font-family:sans-serif;">No verifiable images captured for this flag type.</div>`;
                                      }
                                      
                                      win.document.write(`<div style="padding:2rem;background:#111;min-height:100vh;">${imagesHtml}</div>`);
                                  }}>
                                    <Eye className="w-3 h-3 mr-2" />
                                    Evidence ({flagGroup.occurrences.filter(o => o.evidence_image).length})
                                  </Button>
                                ) : (
                                  <span className="text-xs text-gray-400">No Evidence</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Exam Analytics</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Completion Rates</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-gray-600">Overall Progress</span>
                        <span className="text-sm font-medium">
                          {analyticsStudents.length > 0 ? Math.round(analyticsStudents.reduce((acc, s) => acc + (s.progress || 0), 0) / analyticsStudents.length) : 0}%
                        </span>
                      </div>
                      <Progress value={analyticsStudents.length > 0 ? Math.round(analyticsStudents.reduce((acc, s) => acc + (s.progress || 0), 0) / analyticsStudents.length) : 0} />
                    </div>
                    <div className="pt-4 space-y-2">
                      <p className="text-sm text-gray-600">Students completed: {analyticsStudents.filter(s => s.status === 'completed').length}</p>
                      <p className="text-sm text-gray-600">Average time per question: {analytics.average_time_per_question} minutes</p>
                      <p className="text-sm text-gray-600">Most difficult question: {analytics.most_difficult_question}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Security Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Clean sessions</span>
                      <Badge className="bg-green-100 text-green-800">
                        {analyticsStudents.filter(s => s.flagCount === 0).length} students
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Minor violations</span>
                      <Badge className="bg-yellow-100 text-yellow-800">
                        {analyticsStudents.filter(s => s.flagCount > 0 && s.flagCount < 3).length} students
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Major violations</span>
                      <Badge className="bg-red-100 text-red-800">
                        {analyticsStudents.filter(s => s.flagCount >= 3).length} students
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="exams" className="space-y-6">
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Manage Exams</h2>
                <Button onClick={() => navigate('/create-exam')} className="bg-blue-600 hover:bg-blue-700">
                   <Plus className="w-4 h-4 mr-2" />
                   Create New Exam
                </Button>
             </div>

             <div className="grid gap-4">
                <Card>
                   <CardContent className="p-0">
                      <div className="relative w-full overflow-auto">
                         <table className="w-full caption-bottom text-sm text-left">
                            <thead className="[&_tr]:border-b bg-gray-50/50">
                               <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[200px]">Title</th>
                                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Subject</th>
                                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Duration</th>
                                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Scheduled At</th>
                                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Status</th>
                                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Actions</th>
                               </tr>
                            </thead>
                            <tbody>
                               {exams.length === 0 ? (
                                   <tr>
                                      <td colSpan="6" className="p-8 text-center text-gray-500">
                                         No exams found. Create your first exam!
                                      </td>
                                   </tr>
                               ) : (
                                   exams.map((exam) => (
                                       <tr key={exam.id} className="border-b transition-colors hover:bg-gray-50/50">
                                           <td className="p-4 align-middle font-medium">{exam.title}</td>
                                           <td className="p-4 align-middle">{exam.subject}</td>
                                           <td className="p-4 align-middle">{exam.duration} min</td>
                                           <td className="p-4 align-middle">
                                               {(() => {
                                                   // Fix timestamp display - ensure UTC interpretation before converting
                                                   const dateStr = exam.scheduled_at.endsWith('Z') ? exam.scheduled_at : exam.scheduled_at + 'Z';
                                                   return new Date(dateStr).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                                               })()}
                                           </td>
                                           <td className="p-4 align-middle">
                                               <Badge variant={exam.status === 'active' ? 'default' : 'secondary'} 
                                                      className={getStatusColor(exam.status)}>
                                                   {exam.status}
                                               </Badge>
                                           </td>
                                           <td className="p-4 align-middle text-right">
                                               <div className="flex justify-end gap-2">
                                                   <Button 
                                                       variant="ghost" 
                                                       size="icon" 
                                                       className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                       onClick={() => handleEditExam(exam)}
                                                   >
                                                       <Edit className="h-4 w-4" />
                                                   </Button>
                                                   <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                           onClick={() => handleDeleteExam(exam.id)}>
                                                       <Trash2 className="h-4 w-4" />
                                                   </Button>
                                               </div>
                                           </td>
                                       </tr>
                                   ))
                               )}
                            </tbody>
                         </table>
                      </div>
                   </CardContent>
                </Card>
              </div>
           </TabsContent>

           <TabsContent value="system" className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">System Actions</h2>
                <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
                  Danger Zone
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-orange-200 bg-orange-50/50">
                  <CardHeader>
                    <CardTitle className="flex items-center text-orange-800">
                      <Trash2 className="w-5 h-5 mr-2" />
                      Clear Exam Sessions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Delete all active and completed exam sessions. This will remove all student attempts and scores, but keep the created exams intact.
                    </p>
                    <Button 
                      variant="outline" 
                      className="w-full border-orange-300 text-orange-700 hover:bg-orange-100"
                      onClick={() => handleResetData('sessions', 'exam sessions')}
                      disabled={isActionPending}
                    >
                      Delete All Sessions
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-orange-200 bg-orange-50/50">
                  <CardHeader>
                    <CardTitle className="flex items-center text-orange-800">
                      <Flag className="w-5 h-5 mr-2" />
                      Clear Proctoring Flags
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Delete all recorded incidents, warnings, and photo evidence. Useful for clearing out test data from dry runs.
                    </p>
                    <Button 
                      variant="outline" 
                      className="w-full border-orange-300 text-orange-700 hover:bg-orange-100"
                      onClick={() => handleResetData('flags', 'proctoring flags')}
                      disabled={isActionPending}
                    >
                      Delete All Flags
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-orange-200 bg-orange-50/50">
                  <CardHeader>
                    <CardTitle className="flex items-center text-orange-800">
                      <BookOpen className="w-5 h-5 mr-2" />
                      Clear Records for a Specific Exam
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-3">
                      Delete all sessions and flags tied to one exam. The exam itself is kept intact.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        className="flex-1 border border-orange-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                        value={selectedExamForReset}
                        onChange={(e) => setSelectedExamForReset(e.target.value)}
                      >
                        <option value="">— Select Exam —</option>
                        {exams.map((ex) => (
                          <option key={ex.id} value={ex.id}>{ex.title}</option>
                        ))}
                      </select>
                      <Button
                        variant="outline"
                        className="border-orange-400 text-orange-700 hover:bg-orange-100 whitespace-nowrap"
                        disabled={isActionPending || !selectedExamForReset}
                        onClick={async () => {
                          const exam = exams.find(e => e.id === selectedExamForReset);
                          if (!window.confirm(`Delete all sessions & flags for exam "${exam?.title || selectedExamForReset}"?\nThe exam itself will NOT be deleted.`)) return;
                          setIsActionPending(true);
                          try {
                            const token = localStorage.getItem('token');
                            const res = await axios.delete(`${API}/proctor/reset/exam/${selectedExamForReset}`, { headers: { Authorization: `Bearer ${token}` } });
                            toast({ title: 'Done', description: res.data.message });
                            setSelectedExamForReset('');
                          } catch (err) {
                            toast({ title: 'Error', description: err.response?.data?.detail || 'Failed.', variant: 'destructive' });
                          } finally { setIsActionPending(false); }
                        }}
                      >
                        Delete Exam Records
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-orange-200 bg-orange-50/50">
                  <CardHeader>
                    <CardTitle className="flex items-center text-orange-800">
                      <GraduationCap className="w-5 h-5 mr-2" />
                      Clear Records for a Specific Student
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-3">
                      Delete sessions and flags for a student, scoped to your exams only.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        className="flex-1 border border-orange-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                        value={selectedStudentForReset}
                        onChange={(e) => setSelectedStudentForReset(e.target.value)}
                      >
                        <option value="">— Select Student —</option>
                        {students.map((st) => (
                          <option key={st.id} value={st.id}>{st.name} ({st.email})</option>
                        ))}
                      </select>
                      <Button
                        variant="outline"
                        className="border-orange-400 text-orange-700 hover:bg-orange-100 whitespace-nowrap"
                        disabled={isActionPending || !selectedStudentForReset}
                        onClick={async () => {
                          const student = students.find(s => s.id === selectedStudentForReset);
                          if (!window.confirm(`Delete all sessions & flags for student "${student?.name || selectedStudentForReset}" (scoped to your exams)?`)) return;
                          setIsActionPending(true);
                          try {
                            const token = localStorage.getItem('token');
                            const res = await axios.delete(`${API}/proctor/reset/student/${selectedStudentForReset}`, { headers: { Authorization: `Bearer ${token}` } });
                            toast({ title: 'Done', description: res.data.message });
                            setSelectedStudentForReset('');
                          } catch (err) {
                            toast({ title: 'Error', description: err.response?.data?.detail || 'Failed.', variant: 'destructive' });
                          } finally { setIsActionPending(false); }
                        }}
                      >
                        Delete Student Records
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-red-200 bg-red-50/50">
                  <CardHeader>
                    <CardTitle className="flex items-center text-red-800">
                      <Users className="w-5 h-5 mr-2" />
                      Clear Student Records
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Permanently delete all registered students from the platform. Admin and Proctor accounts will NOT be deleted.
                    </p>
                    {isAdmin ? (
                      <Button 
                        variant="destructive" 
                        className="w-full bg-red-600 hover:bg-red-700"
                        onClick={() => handleResetData('students', 'student accounts')}
                        disabled={isActionPending}
                      >
                        Delete All Students
                      </Button>
                    ) : (
                      <p className="text-xs text-red-500 italic text-center pt-1">⛔ Only Super Admins can delete student accounts.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-red-600 bg-red-50">
                  <CardHeader>
                    <CardTitle className="flex items-center text-red-900 font-bold">
                      <AlertTriangle className="w-5 h-5 mr-2" />
                      {isAdmin ? 'Factory Data Reset' : 'Clear My Data'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-800 mb-4 font-medium">
                      {isAdmin 
                        ? 'Wipe the slate clean. This permanently deletes EVERYTHING: Exams, Sessions, Flags, and Students.'
                        : 'Delete all your exams, exam sessions, and proctoring flags that you created.'}
                    </p>
                    <Button 
                      variant="destructive" 
                      className="w-full bg-red-800 hover:bg-red-900 font-bold"
                      onClick={() => handleResetData('all', isAdmin ? 'ENTIRE DATABASE' : 'all your data')}
                      disabled={isActionPending}
                    >
                      {isAdmin ? 'Master Reset' : 'Delete My Data'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
           </TabsContent>

           {selectedStudent && (
            <TabsContent value="student-detail" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Student Detail</h2>
                <Button variant="outline" onClick={() => setSelectedStudent(null)}>
                  Close
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                {selectedStudent.status === 'completed' ? (
                    /* [NEW] Post-Exam Report View */
                    <div className="space-y-6">
                        <Card className="border-l-4 border-blue-500">
                            <CardHeader>
                                <CardTitle className="text-xl">Post-Exam Report</CardTitle>
                                <CardDescription>Exam submitted on {formatTimestamp(selectedStudent.end_time)}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-3 gap-6 text-center">
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                        <p className="text-sm text-gray-500 uppercase tracking-wide">Final Score</p>
                                        <p className="text-3xl font-bold text-gray-900 mt-1">{selectedStudent.score} / {selectedStudent.total_points}</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                        <p className="text-sm text-gray-500 uppercase tracking-wide">Percentage</p>
                                        <p className={`text-3xl font-bold mt-1 ${selectedStudent.percentage >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                                            {selectedStudent.percentage?.toFixed(1)}%
                                        </p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                        <p className="text-sm text-gray-500 uppercase tracking-wide">Security Flags</p>
                                        <p className="text-3xl font-bold text-red-600 mt-1">{selectedStudent.flagCount}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Flag Evidence Gallery for Completed Exams */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Flagged Incidents & Evidence</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {flags.filter(f => f.session_id === selectedStudent.sessionId).length === 0 ? (
                                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
                                        <CheckCircle className="w-10 h-10 mx-auto text-green-500 mb-2" />
                                        <p>No incidents reported during this session.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {groupFlags(flags.filter(f => f.session_id === selectedStudent.sessionId)).map((flagGroup) => (
                                            <div key={flagGroup.id || `${flagGroup.studentId}-${flagGroup.type}`} className="flex items-start space-x-4 p-4 border rounded-lg bg-gray-50">
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-2 mb-1">
                                                        <Badge className={getSeverityColor(flagGroup.severity)}>{flagGroup.severity}</Badge>
                                                        <span className="font-semibold text-gray-900">{flagGroup.type.replace(/_/g, ' ').toUpperCase()}</span>
                                                        {flagGroup.count > 1 && (
                                                            <Badge variant="secondary" className="bg-gray-200 text-gray-700">
                                                                x {flagGroup.count}
                                                            </Badge>
                                                        )}
                                                        <span className="text-xs text-gray-500">• {formatTimestamp(flagGroup.timestamp)}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-700">{flagGroup.description}</p>
                                                </div>
                                                {flagGroup.evidence_image && (
                                                    <div className="flex-shrink-0">
                                                        <Button size="sm" variant="outline" onClick={() => {
                                                            const win = window.open();
                                                            // We construct simple HTML. A more robust implementation would loop over flagGroup.occurrences
                                                            // allowing proctors to see *all* photos of the occurrences. 
                                                            let imagesHtml = flagGroup.occurrences
                                                                .filter(occ => occ.evidence_image)
                                                                .map(occ => `<div style="text-align:center;margin-bottom:2rem;"><p style="color:white;font-family:sans-serif;">${new Date(occ.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p><img src="${occ.evidence_image}" style="max-width:90%;max-height:80vh;border:2px solid white;"/></div>`)
                                                                .join('');
                                                                
                                                            if (!imagesHtml) {
                                                                imagesHtml = `<div style="color:white;font-family:sans-serif;">No verifiable images captured for this flag type.</div>`;
                                                            }
                                                            
                                                            win.document.write(`<div style="padding:2rem;background:#111;min-height:100vh;">${imagesHtml}</div>`);
                                                        }}>
                                                            <Eye className="w-4 h-4 mr-2" />
                                                            View Evidence ({flagGroup.occurrences.filter(o => o.evidence_image).length})
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                  /* Live Monitoring View (Existing) */
                  <div className="space-y-6">
                  {/* Live Video Feed */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Camera className="w-5 h-5 mr-2" />
                        Live Video Feed
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-gray-900 rounded-lg aspect-video flex items-center justify-center">
                        <div className="text-center text-gray-400">
                          {liveFeed.webcam ? (
                              <img src={liveFeed.webcam.startsWith('data:') ? liveFeed.webcam : `data:image/jpeg;base64,${liveFeed.webcam}`} alt="Live Webcam" className="w-full h-full object-contain rounded-lg"/>
                          ) : (
                              <>
                                <Camera className="w-16 h-16 mx-auto mb-4" />
                                <p>Waiting for live feed...</p>
                              </>
                          )}
                          {!liveFeed.webcam && <p className="text-sm">{selectedStudent.name}</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Screen Monitor */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Monitor className="w-5 h-5 mr-2" />
                        Screen Monitor
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-gray-100 rounded-lg aspect-video flex items-center justify-center">
                        <div className="text-center text-gray-500">
                          {liveFeed.screen ? (
                              <img src={liveFeed.screen.startsWith('data:') ? liveFeed.screen : `data:image/jpeg;base64,${liveFeed.screen}`} alt="Live Screen" className="w-full h-full object-contain rounded-lg"/>
                          ) : (
                              <>
                                <Monitor className="w-16 h-16 mx-auto mb-4" />
                                <p>Waiting for screen feed...</p>
                              </>
                          )}
                          {!liveFeed.screen && <p className="text-sm">Exam Interface</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  </div>
                )}
                </div>

                <div className="space-y-6">
                  {/* Student Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Student Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarFallback>
                            {selectedStudent.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{selectedStudent.name}</p>
                          <p className="text-sm text-gray-600">{selectedStudent.email}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Status</span>
                          <Badge className={getStatusColor(selectedStudent.status)}>
                            {selectedStudent.status}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Progress</span>
                          <span className="font-medium">{selectedStudent.progress}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Time Remaining</span>
                          <span className="font-medium">{selectedStudent.timeRemaining} min</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Flags</span>
                          <span className="font-medium text-red-600">{selectedStudent.flagCount}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* System Status */}
                  <Card>
                    <CardHeader>
                      <CardTitle>System Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Webcam</span>
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${
                            selectedStudent.webcamStatus === 'active' ? 'bg-green-500' : 'bg-red-500'
                          }`}></div>
                          <span className="text-sm">{selectedStudent.webcamStatus}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Screen</span>
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${
                            selectedStudent.screenStatus === 'monitored' ? 'bg-green-500' : 'bg-yellow-500'
                          }`}></div>
                          <span className="text-sm">{selectedStudent.screenStatus}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Last Activity</span>
                        <span className="text-sm">{formatTimestamp(selectedStudent.lastActivity)}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quick Actions - Only show for active sessions */}
                  {selectedStudent.status?.toLowerCase() !== 'completed' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button className="w-full" variant="outline" onClick={handleSendMessage} disabled={isActionPending}>
                        <Volume2 className="w-4 h-4 mr-2" />
                        Send Message
                      </Button>
                      <Button className="w-full" variant="outline" onClick={handleFlagStudent} disabled={isActionPending}>
                        <Flag className="w-4 h-4 mr-2" />
                        Flag Student
                      </Button>
                      <Button className="w-full" variant="destructive" onClick={handleEndSession} disabled={isActionPending}>
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        End Session
                      </Button>
                    </CardContent>
                  </Card>
                  )}
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default ProctorDashboard;