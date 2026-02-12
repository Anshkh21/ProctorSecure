// Mock data for Proctored Exam Tool

export const mockExams = [
  {
    id: "exam-001",
    title: "Software Engineering Fundamentals",
    subject: "Computer Science",
    duration: 120, // minutes
    totalQuestions: 50,
    status: "scheduled",
    scheduledAt: "2025-07-15T10:00:00Z",
    instructions: [
      "Keep your webcam on throughout the exam",
      "Do not switch tabs or applications during the exam",
      "Ensure you are alone in the room",
      "Have a valid ID ready for verification"
    ]
  },
  {
    id: "exam-002", 
    title: "Data Structures and Algorithms",
    subject: "Computer Science",
    duration: 90,
    totalQuestions: 40,
    status: "in-progress",
    scheduledAt: "2025-07-15T14:00:00Z",
    instructions: [
      "Calculator is not allowed",
      "Keep your hands visible at all times",
      "No external materials permitted"
    ]
  }
];

export const mockQuestions = [
  {
    id: "q1",
    examId: "exam-001",
    type: "multiple-choice",
    question: "Which of the following is NOT a principle of Object-Oriented Programming?",
    options: [
      "Encapsulation",
      "Inheritance", 
      "Polymorphism",
      "Compilation"
    ],
    correctAnswer: 3,
    timeLimit: 180 // seconds
  },
  {
    id: "q2",
    examId: "exam-001", 
    type: "multiple-choice",
    question: "What is the time complexity of binary search algorithm?",
    options: [
      "O(n)",
      "O(log n)",
      "O(n²)",
      "O(1)"
    ],
    correctAnswer: 1,
    timeLimit: 120
  },
  {
    id: "q3",
    examId: "exam-001",
    type: "text",
    question: "Explain the difference between a stack and a queue data structure.",
    timeLimit: 300
  }
];

export const mockStudents = [
  {
    id: "student-001",
    name: "Alice Johnson",
    email: "alice@university.edu",
    examId: "exam-001",
    status: "verified",
    webcamStatus: "active",
    screenStatus: "monitored",
    flagCount: 0,
    lastActivity: "2025-07-15T10:30:00Z",
    progress: 65, // percentage
    timeRemaining: 45 // minutes
  },
  {
    id: "student-002",
    name: "Bob Smith", 
    email: "bob@university.edu",
    examId: "exam-001",
    status: "flagged",
    webcamStatus: "active",
    screenStatus: "suspicious",
    flagCount: 2,
    lastActivity: "2025-07-15T10:32:00Z", 
    progress: 40,
    timeRemaining: 43
  },
  {
    id: "student-003",
    name: "Carol Davis",
    email: "carol@university.edu",
    examId: "exam-002",
    status: "verified",
    webcamStatus: "active",
    screenStatus: "monitored", 
    flagCount: 0,
    lastActivity: "2025-07-15T10:33:00Z",
    progress: 80,
    timeRemaining: 20
  }
];

export const mockFlags = [
  {
    id: "flag-001",
    studentId: "student-002",
    type: "suspicious_movement",
    timestamp: "2025-07-15T10:25:00Z",
    description: "Multiple faces detected in frame",
    severity: "high"
  },
  {
    id: "flag-002", 
    studentId: "student-002",
    type: "tab_switch",
    timestamp: "2025-07-15T10:28:00Z",
    description: "Browser tab switched for 3 seconds",
    severity: "medium"
  }
];

export const mockUser = {
  id: "user-001",
  name: "Dr. Sarah Wilson",
  email: "sarah.wilson@university.edu",
  role: "proctor", // student, proctor, admin
  institution: "State University"
};

export const mockExamSession = {
  id: "session-001",
  studentId: "student-001",
  examId: "exam-001", 
  startTime: "2025-07-15T10:00:00Z",
  currentQuestionIndex: 12,
  answers: {
    "q1": { answer: 3, timeSpent: 145 },
    "q2": { answer: 1, timeSpent: 89 }
  },
  webcamEnabled: true,
  screenSharingEnabled: true,
  identityVerified: true
};