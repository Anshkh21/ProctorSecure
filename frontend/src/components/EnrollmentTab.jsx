import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Progress } from './ui/progress';
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
  UserPlus,
  Mail
} from 'lucide-react';
import { Input } from './ui/input';
import { useToast } from '../hooks/use-toast';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

// Export  EnrollmentTab component
export const EnrollmentTab = ({  exams, token, toast }) => {
  const [selectedExam, setSelectedExam] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [emailInput, setEmailInput] = useState('');
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [enrollingStudents, setEnrollingStudents] = useState(false);
  const [availableStudents, setAvailableStudents] = useState([]);

  useEffect(() => {
    fetchAvailableStudents();
  }, []);

  const fetchAvailableStudents = async () => {
    try {
      const response = await axios.get(`${API}/proctor/available-students`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailableStudents(response.data);
    } catch (error) {
       console.error("Error fetching students:", error);
    }
  };

  const fetchEnrollments = async (examId) => {
    if (!examId) return;
    
    setLoadingEnrollments(true);
    try {
      const response = await axios.get(`${API}/proctor/exams/${examId}/enrollments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEnrollments(response.data);
    } catch (error) {
      console.error('Error fetching enrollments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load enrollments',
        variant: 'destructive'
      });
    } finally {
      setLoadingEnrollments(false);
    }
  };

  const handleExamSelect = (exam) => {
    setSelectedExam(exam);
    fetchEnrollments(exam.id);
  };

  const handleEnrollStudents = async () => {
    if (!selectedExam || !emailInput.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter at least one student email',
        variant: 'destructive'
      });
      return;
    }

    setEnrollingStudents(true);
    
    // Split by comma, newline, or semicolon and clean up
    const emails = emailInput
      .split(/[,;\n]+/)
      .map(e => e.trim())
      .filter(e => e);

    try {
      const response = await axios.post(
        `${API}/proctor/exams/${selectedExam.id}/enroll`,
        { student_emails: emails },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Show results
      const result = response.data;
      toast({
        title: 'Enrollment Complete',
        description: (
          <div className="space-y-1">
            <p>✅ Enrolled: {result.enrolled_count}</p>
            {result.already_enrolled.length > 0 && (
              <p>ℹ️ Already enrolled: {result.already_enrolled.length}</p>
            )}
            {result.not_found.length > 0 && (
              <p>❌ Not found: {result.not_found.length}</p>
            )}
          </div>
        )
      });

      setEmailInput('');
      fetchEnrollments(selectedExam.id);
    } catch (error) {
      console.error('Error enrolling students:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to enroll students',
        variant: 'destructive'
      });
    } finally {
      setEnrollingStudents(false);
    }
  };

  const handleRemoveEnrollment = async (studentId, studentEmail) => {
    if (!window.confirm(`Remove ${studentEmail} from this exam?`)) {
      return;
    }

    try {
      await axios.delete(
        `${API}/proctor/exams/${selectedExam.id}/enrollments/${studentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast({
        title: 'Success',
        description: 'Student removed from exam'
      });

      fetchEnrollments(selectedExam.id);
    } catch (error) {
      console.error('Error removing enrollment:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove student',
        variant: 'destructive'
      });
    }
  };

  const handleAddStudentEmail = (email) => {
      const current = emailInput.trim();
      if (current) {
          setEmailInput(`${current}, ${email}`);
      } else {
          setEmailInput(email);
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Student Enrollments</h2>
        <p className="text-gray-600">Manage which students can access your exams</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Exam Selection */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Select Exam</CardTitle>
            <CardDescription>Choose an exam to manage enrollments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {exams.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No exams available. Create an exam first!
                </p>
              ) : (
                exams.map((exam) => (
                  <Button
                    key={exam.id}
                    variant={selectedExam?.id === exam.id ? 'default' : 'outline'}
                    className="w-full justify-start text-left"
                    onClick={() => handleExamSelect(exam)}
                  >
                    <div className="truncate">
                      <div className="font-medium truncate">{exam.title}</div>
                      <div className="text-xs opacity-80">{exam.subject}</div>
                    </div>
                  </Button>
                ))
              )}
            </div>
            
            {/* New Available Students Section */}
            <div className="mt-8 pt-4 border-t">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold text-sm">Registered Students</h3>
                    <Button variant="ghost" size="xs" onClick={fetchAvailableStudents}>
                        <RefreshCw className="w-3 h-3" />
                    </Button>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {availableStudents.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No registered students found.</p>
                    ) : (
                        availableStudents.map(student => (
                            <div key={student.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm hover:bg-gray-100">
                                <div className="truncate flex-1 mr-2">
                                    <div className="font-medium truncate">{student.name}</div>
                                    <div className="text-xs text-gray-500 truncate">{student.email}</div>
                                </div>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-7 w-7 p-0"
                                    onClick={() => handleAddStudentEmail(student.email)}
                                    title="Add to enrollment list"
                                >
                                    <Plus className="w-3 h-3" />
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </div>
          </CardContent>
        </Card>

        {/* Enrollment Management */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Enroll Students
            </CardTitle>
            <CardDescription>
              {selectedExam 
                ? `Manage enrollments for: ${selectedExam.title}`
                : 'Select an exam to manage enrollments'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedExam ? (
              <div className="text-center py-12 text-gray-500">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Select an exam from the list to manage enrollments</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Enroll Form */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700">
                    Student Emails (comma or newline separated)
                  </label>
                  <p className="text-xs text-gray-500">
                    Select students from the sidebar or type emails manually.
                  </p>
                  <textarea
                    className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="student1@university.edu"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                  />
                  <Button 
                    onClick={handleEnrollStudents}
                    disabled={enrollingStudents || !emailInput.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {enrollingStudents ? 'Enrolling...' : 'Enroll Students'}
                  </Button>
                </div>

                {/* Enrolled Students List */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-gray-900">
                      Enrolled Students ({enrollments.length})
                    </h3>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => fetchEnrollments(selectedExam.id)}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>

                  {loadingEnrollments ? (
                    <div className="text-center py-8 text-gray-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                      <p>Loading enrollments...</p>
                    </div>
                  ) : enrollments.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500">No students enrolled yet</p>
                      <p className="text-sm text-gray-400 mt-1">Add students using the form above</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {enrollments.map((enrollment) => (
                        <div 
                          key={enrollment.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="text-xs">
                                {enrollment.student_name?.split(' ').map(n => n[0]).join('') || '??'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-gray-900">{enrollment.student_name}</p>
                              <p className="text-sm text-gray-600 flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {enrollment.student_email}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleRemoveEnrollment(enrollment.student_id, enrollment.student_email)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EnrollmentTab;
