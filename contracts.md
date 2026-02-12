# Proctored Exam Tool - API Contracts & Integration Plan

## Backend Implementation Plan

### 1. API Endpoints to Implement

#### Authentication
- `POST /api/auth/login` - Student/Proctor login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user info

#### Exam Management
- `GET /api/exams` - Get exams for current user
- `GET /api/exams/:id` - Get specific exam details
- `GET /api/exams/:id/questions` - Get questions for exam
- `POST /api/exams/:id/start` - Start exam session
- `POST /api/exams/:id/submit` - Submit exam

#### Identity Verification
- `POST /api/verification/start` - Start verification process
- `POST /api/verification/face-detect` - Face detection endpoint
- `POST /api/verification/complete` - Complete verification

#### Monitoring & Proctoring
- `GET /api/proctor/students` - Get all active students
- `GET /api/proctor/flags` - Get security flags
- `POST /api/proctor/flag` - Create new flag
- `GET /api/proctor/student/:id` - Get student details

#### Exam Session
- `POST /api/session/answer` - Save answer
- `GET /api/session/:id/progress` - Get session progress
- `POST /api/session/flag-question` - Flag question for review

### 2. Data Models

#### User
```javascript
{
  id: string,
  name: string,
  email: string,
  role: 'student' | 'proctor' | 'admin',
  institution: string
}
```

#### Exam
```javascript
{
  id: string,
  title: string,
  subject: string,
  duration: number, // minutes
  totalQuestions: number,
  status: 'scheduled' | 'active' | 'completed',
  scheduledAt: Date,
  instructions: string[]
}
```

#### ExamSession
```javascript
{
  id: string,
  studentId: string,
  examId: string,
  startTime: Date,
  endTime: Date,
  answers: object,
  verificationStatus: 'pending' | 'verified' | 'failed',
  proctorFlags: Flag[]
}
```

### 3. Frontend Integration Changes

#### Mock Data Replacement
- Replace `mock.js` imports with actual API calls
- Update components to use real-time data
- Add loading states and error handling

#### New Features to Add
- OpenCV face detection integration
- Real-time camera permission handling
- WebSocket connections for live monitoring
- File upload for ID verification

### 4. OpenCV Face Detection Integration

#### Frontend Changes
- Install opencv.js via CDN or npm
- Add face detection in IdentityVerification component
- Real-time face tracking during exam
- Alert system for multiple faces or no face detected

#### Backend Support
- Image processing endpoints
- Face comparison algorithms
- Alert generation based on detection results

### 5. Security Enhancements
- JWT token authentication
- Session management
- Real-time monitoring via WebSockets
- Encrypted file storage for ID documents