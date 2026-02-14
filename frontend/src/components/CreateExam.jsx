import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useToast } from '../hooks/use-toast';
import axios from 'axios';
import { ArrowLeft } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const CreateExam = () => {
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    duration: 60,
    total_questions: 10,
    scheduled_at: '',
    instructions: ''
  });
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [examId, setExamId] = useState(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

    // Questions Logic
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState({
     text: '',
     options: ['', '', '', ''],
     correct_answer: '',
     points: 1
  });

  useEffect(() => {
      const init = async () => {
          const editIdParam = searchParams.get('editId');
          // Prefer state object if available (avoids fetch if we had full object, though we fetch anyway for freshness)
          // but fallback to URL param which is persistent
          let targetExamId = null;
          
          if (location.state?.examToEdit) {
              targetExamId = location.state.examToEdit.id;
          } else if (editIdParam) {
              targetExamId = editIdParam;
          }
          
          if (targetExamId) {
              setIsEditing(true);
              setExamId(targetExamId);
              
              setLoading(true);
              try {
                  const token = localStorage.getItem('token');
                  // Fetch full details including questions
                  const res = await axios.get(`${API}/proctor/exams/${targetExamId}`, {
                      headers: { Authorization: `Bearer ${token}` }
                  });
                  const fullExam = res.data;
                  
                  // Format scheduled_at for datetime-local input (YYYY-MM-DDTHH:mm)
                  // Handle if it's already a Date object or string
                  let sched = fullExam.scheduled_at;
                  if (sched) {
                       // Ensure UTC string is parsed correctly to local time for input
                       const d = new Date(sched.endsWith('Z') ? sched : sched + 'Z');
                       // Format to match input required format (local time)
                       const offset = d.getTimezoneOffset() * 60000;
                       try {
                           const localISOTime = (new Date(d - offset)).toISOString().slice(0, 16);
                           sched = localISOTime;
                       } catch (e) {
                           console.error("Date conversion error", e);
                       }
                  }

                  setFormData({
                      title: fullExam.title,
                      subject: fullExam.subject,
                      duration: fullExam.duration,
                      total_questions: fullExam.total_questions,
                      scheduled_at: sched || '',
                      instructions: Array.isArray(fullExam.instructions) ? fullExam.instructions.join('\n') : fullExam.instructions
                  });
                  
                  if (fullExam.questions) {
                      setQuestions(fullExam.questions);
                  }
                  
              } catch (err) {
                  console.error("Failed to fetch exam details", err);
                  toast({
                      title: "Error",
                      description: "Failed to load exam details for editing.",
                      variant: "destructive"
                  });
              } finally {
                  setLoading(false);
              }
          }
      };
      init();
  }, [location.state, searchParams, toast]);


  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/');
        return;
      }

      // Format instructions as array
      const instructionsArray = typeof formData.instructions === 'string' 
            ? formData.instructions.split('\n').filter(i => i.trim())
            : formData.instructions;
      
      const payload = {
        ...formData,
        instructions: instructionsArray,
        scheduled_at: new Date(formData.scheduled_at).toISOString(),
        questions: questions
      };

      if (isEditing) {
          await axios.put(`${API}/proctor/exams/${examId}`, payload, {
            headers: { Authorization: `Bearer ${token}` }
          });
          toast({
            title: "Exam Updated",
            description: "The exam has been successfully updated."
          });
      } else {
          await axios.post(`${API}/proctor/exams/create`, payload, {
            headers: { Authorization: `Bearer ${token}` }
          });
          toast({
            title: "Exam Created",
            description: "The exam has been successfully scheduled."
          });
      }

      navigate('/proctor');
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to save exam",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };


  const addManualQuestion = () => {
     if (!currentQuestion.text || !currentQuestion.correct_answer || currentQuestion.options.some(o => !o)) {
        toast({
           title: "Validation Error",
           description: "Please fill in all fields for the question.",
           variant: "destructive"
        });
        return;
     }
     setQuestions([...questions, currentQuestion]);
     setFormData({...formData, total_questions: questions.length + 1});
     setCurrentQuestion({
        text: '',
        options: ['', '', '', ''],
        correct_answer: '',
        points: 1
     });
     toast({ title: "Question Added", description: "Question added to list." });
  };

  const handleCsvUpload = (e) => {
     const file = e.target.files[0];
     if (!file) return;

     const reader = new FileReader();
     reader.onload = (event) => {
        const text = event.target.result;
        const lines = text.split('\n');
        const parsedQuestions = [];
        
        lines.forEach((line, index) => {
           if (index === 0 && line.toLowerCase().includes('question')) return; // Skip likely header
           if (!line.trim()) return;
           
           // Handle CSV with commas strictly
           // Format: Question, "OptA;OptB;OptC;OptD", Correct, Points (standard CSV behavior for options with semicolons?)
           // For simplicity, let's assume simple CSV splitting first, but robustly
           
           const parts = line.split(',');
           if (parts.length >= 3) {
              const qText = parts[0].trim();
              const optsRaw = parts[1].trim(); 
              // Handles "Option1; Option2" or Option1;Option2
              const options = optsRaw.replace(/^"|"$/g, '').split(';').map(o => o.trim());
              
              if (options.length === 4) {
                 parsedQuestions.push({
                    text: qText,
                    options: options,
                    correct_answer: parts[2].trim().toUpperCase(),
                    points: parseInt(parts[3] || '1')
                 });
              }
           }
        });

        if (parsedQuestions.length > 0) {
           setQuestions([...questions, ...parsedQuestions]);
           setFormData({...formData, total_questions: questions.length + parsedQuestions.length});
           toast({
              title: "CSV Imported",
              description: `Successfully imported ${parsedQuestions.length} questions.`
           });
        } else {
           toast({
              title: "Import Failed",
              description: "No valid questions found in CSV. Check format.",
              variant: "destructive"
           });
        }
     };
     reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" className="mb-4" onClick={() => navigate('/proctor')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
        
        <Card>
          <CardHeader>
            <CardTitle>{isEditing ? "Edit Exam" : "Create New Exam"}</CardTitle>
            <CardDescription>{isEditing ? "Update exam details and questions" : "Schedule a new exam and set proctoring rules"}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Exam Title</Label>
                  <Input 
                    id="title" 
                    placeholder="e.g. Advanced Calculus Midterm" 
                    value={formData.title} 
                    onChange={handleChange}
                    required 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input 
                    id="subject" 
                    placeholder="e.g. Mathematics" 
                    value={formData.subject} 
                    onChange={handleChange}
                    required 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input 
                    id="duration" 
                    type="number" 
                    min="1"
                    value={formData.duration} 
                    onChange={handleChange}
                    required 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduled_at">Scheduled At</Label>
                  <Input 
                    id="scheduled_at" 
                    type="datetime-local" 
                    value={formData.scheduled_at} 
                    onChange={handleChange}
                    required 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="total_questions">Total Questions</Label>
                  <Input 
                    id="total_questions" 
                    type="number" 
                    min="1"
                    value={formData.total_questions} 
                    onChange={handleChange}
                    required 
                  />
                </div>
                
              </div>

              {/* Questions Section */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-medium">Exam Questions</h3>
                <Tabs defaultValue="manual" className="w-full">
                   <TabsList className="grid w-full grid-cols-2">
                     <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                     <TabsTrigger value="csv">CSV Upload</TabsTrigger>
                   </TabsList>
                   
                   <TabsContent value="manual" className="space-y-4 border rounded-md p-4 mt-2">
                     <div className="space-y-2">
                        <Label>Question Text</Label>
                        <Input 
                           value={currentQuestion.text}
                           onChange={(e) => setCurrentQuestion({...currentQuestion, text: e.target.value})}
                           placeholder="Enter question here"
                        />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        {['A', 'B', 'C', 'D'].map((opt, idx) => (
                           <div key={opt} className="space-y-1">
                              <Label>Option {opt}</Label>
                              <Input 
                                 value={currentQuestion.options[idx] || ''}
                                 onChange={(e) => {
                                    const newOptions = [...currentQuestion.options];
                                    newOptions[idx] = e.target.value;
                                    setCurrentQuestion({...currentQuestion, options: newOptions});
                                 }}
                                 placeholder={`Option ${opt}`}
                              />
                           </div>
                        ))}
                     </div>
                     <div className="space-y-2">
                        <Label>Correct Answer (A, B, C, or D)</Label>
                        <select 
                           className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                           value={currentQuestion.correct_answer}
                           onChange={(e) => setCurrentQuestion({...currentQuestion, correct_answer: e.target.value})}
                        >
                           <option value="">Select Correct Option</option>
                           <option value="A">A</option>
                           <option value="B">B</option>
                           <option value="C">C</option>
                           <option value="D">D</option>
                        </select>
                     </div>
                     <Button type="button" onClick={addManualQuestion} variant="secondary">
                        Add Question
                     </Button>
                   </TabsContent>
                   
                   <TabsContent value="csv" className="space-y-4 border rounded-md p-4 mt-2">
                     <div className="text-sm text-gray-500 space-y-2">
                        <p className="font-medium">CSV Format Required (No Header):</p>
                        <code className="block bg-gray-100 p-2 rounded">
                           Question Text, Option A;Option B;Option C;Option D, Correct Answer(A/B/C/D), Points
                        </code>
                        <p>Example: <span className="italic">What is 2+2?, 3;4;5;6, B, 1</span></p>
                     </div>
                     <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="csv_upload">Upload Questions CSV</Label>
                        <Input id="csv_upload" type="file" accept=".csv" onChange={handleCsvUpload} />
                     </div>
                   </TabsContent>
                </Tabs>

                {/* Questions List Preview */}
                <div className="bg-gray-50 rounded-md p-4 max-h-60 overflow-y-auto">
                   <h4 className="font-medium mb-2">Added Questions ({questions.length})</h4>
                   {questions.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">No questions added yet.</p>
                   ) : (
                      <ul className="space-y-2 text-sm">
                         {questions.map((q, i) => (
                            <li key={i} className="border-b pb-2">
                               <span className="font-semibold">{i+1}. {q.text}</span>
                               <span className="ml-2 text-green-600 text-xs">Answer: {q.correct_answer}</span>
                            </li>
                         ))}
                      </ul>
                   )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions">Instructions (One per line)</Label>
                <textarea 
                  id="instructions"
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Ensure you are in a quiet room&#10;No external calculators allowed&#10;Keep webcam on at all times"
                  value={formData.instructions}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="flex justify-end space-x-4">
                <Button variant="outline" type="button" onClick={() => navigate('/proctor')}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={loading}>
                  {loading ? (isEditing ? "Updating..." : "Creating...") : (isEditing ? "Update Exam" : "Create Exam")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateExam;
