from fastapi import FastAPI, APIRouter, HTTPException, Depends, File, UploadFile
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, model_validator
from typing import List, Optional, Dict, Any, Union
import uuid
from datetime import datetime, timedelta
import jwt
import bcrypt
import cv2
import numpy as np
import base64
from io import BytesIO
from PIL import Image
from ml_models import ProctoringModel


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import urllib.parse

# MongoDB connection
raw_mongo_url = os.environ['MONGO_URL']
def escape_mongo_url(url: str) -> str:
    if not url: return url
    scheme_end = url.find('://')
    if scheme_end == -1: return url
    prefix = url[:scheme_end+3]
    rest = url[scheme_end+3:]
    
    auth_end = rest.find('/')
    q_end = rest.find('?')
    if auth_end == -1 and q_end == -1:
        authority = rest; path_query = ""
    elif auth_end != -1 and (q_end == -1 or auth_end < q_end):
        authority = rest[:auth_end]; path_query = rest[auth_end:]
    else:
        authority = rest[:q_end]; path_query = rest[q_end:]
        
    at_index = authority.rfind('@')
    if at_index == -1: return url
        
    credentials = authority[:at_index]
    host_info = authority[at_index+1:]
    
    colon_index = credentials.find(':')
    if colon_index == -1:
        user = urllib.parse.quote_plus(urllib.parse.unquote_plus(credentials))
        userinfo = user
    else:
        user = urllib.parse.quote_plus(urllib.parse.unquote_plus(credentials[:colon_index]))
        pwd = urllib.parse.quote_plus(urllib.parse.unquote_plus(credentials[colon_index+1:]))
        userinfo = f"{user}:{pwd}"
        
    return f"{prefix}{userinfo}@{host_info}{path_query}"

mongo_url = escape_mongo_url(raw_mongo_url)
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Add CORS Middleware early
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
security = HTTPBearer()

# Initialize Proctoring Model
proctor_model = ProctoringModel()

# Define Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    role: str  # student, proctor, admin
    institution: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class LoginRequest(BaseModel):
    email: str
    password: str
    role: str

class LoginResponse(BaseModel):
    token: str
    user: User

class Exam(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    subject: str
    duration: int  # minutes
    total_questions: int
    status: str
    scheduled_at: datetime
    instructions: List[str]
    proctor_id: str  # Proctor who created/owns this exam

class Question(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    exam_id: str
    type: str = "multiple-choice"
    question: str
    options: Optional[List[str]] = None
    correct_answer: Optional[Union[int, str]] = None
    time_limit: int = 60
    points: int = 1
    
    @model_validator(mode='before')
    @classmethod
    def map_text_to_question(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if 'text' in data and 'question' not in data:
                data['question'] = data['text']
        return data

class ExamSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    exam_id: str
    proctor_id: str  # Proctor monitoring this session
    start_time: datetime = Field(default_factory=datetime.utcnow)
    current_question_index: int = 0
    answers: Dict[str, Any] = {}
    verification_status: str = "pending"  # pending, verified, failed
    webcam_enabled: bool = False
    face_detected: bool = False
    status: str = "pending"  # active, completed, terminated

class ExamEnrollment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    exam_id: str
    student_id: str
    enrolled_at: datetime = Field(default_factory=datetime.utcnow)
    enrolled_by: str  # Proctor who enrolled the student
    status: str = "enrolled"  # enrolled, started, completed, terminated

class ProctoringFlag(BaseModel):

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    session_id: str
    type: str  # suspicious_movement, multiple_faces, no_face, tab_switch
    description: str
    severity: str  # low, medium, high
    evidence_image: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "extra": "ignore"
    }

class MonitorRequest(BaseModel):
    image_data: str
    screen_data: Optional[str] = None
    client_warnings: List[str] = [] # Warnings detected by frontend (audio, tab switch)



class CreateFlagRequest(BaseModel):
    student_id: str
    session_id: str
    flag_type: str
    description: str
    severity: str

class StartSessionRequest(BaseModel):
    exam_id: str

class FaceDetectionRequest(BaseModel):
    image_data: str  # base64 encoded image

class FaceDetectionResponse(BaseModel):
    faces_detected: int
    face_locations: List[Dict[str, int]]
    is_valid: bool
    message: str
    gaze_direction: Optional[str] = "center"
    head_pose: Optional[str] = "center"
    warnings: List[str] = []

# Helper functions
def create_jwt_token(user_data: dict) -> str:
    payload = {
        **user_data,
        'exp': datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Role-based access control helpers
async def require_admin(current_user: dict = Depends(get_current_user)):
    """Verify current user is an admin"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

async def require_proctor(current_user: dict = Depends(get_current_user)):
    """Verify current user is a proctor"""
    if current_user.get("role") != "proctor":
        raise HTTPException(status_code=403, detail="Proctor access required")
    return current_user

async def verify_exam_ownership(exam_id: str, proctor_id: str):
    """Verify that a proctor owns a specific exam"""
    exam = await db.exams.find_one({"id": exam_id})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if exam.get("proctor_id") != proctor_id:
        raise HTTPException(status_code=403, detail="You do not own this exam")
    return exam




def detect_faces_in_image(image_data: str) -> FaceDetectionResponse:
    try:
        # Debug logging
        print(f"DEBUG: Processing image data. Length: {len(image_data)}")
        if len(image_data) > 50:
             print(f"DEBUG: Image data start: {image_data[:50]}...")
        
        # Decode base64 image
        if ',' in image_data:
            header, content = image_data.split(',', 1)
            print(f"DEBUG: Found data URI header: {header}")
            image_data = content.strip()
            
        print(f"DEBUG: Base64 string length to decode: {len(image_data)}")
        
        # Add padding if needed
        padding = len(image_data) % 4
        if padding:
            image_data += '=' * (4 - padding)
            
        image_bytes = base64.b64decode(image_data)
        print(f"DEBUG: Decoded bytes length: {len(image_bytes)}")
        
        if len(image_bytes) == 0:
            raise ValueError("Decoded image data is empty")
            
        # Try to identify image before processing
        try:
            image = Image.open(BytesIO(image_bytes))
            image.load() # Force load to validate
            print(f"DEBUG: Image loaded successfully: {image.format} {image.size} {image.mode}")
        except Exception as img_error:
            print(f"DEBUG: PIL Image open error: {str(img_error)}")
            # Try to save invalid bytes to file for inspection
            with open("debug_failed_image.bin", "wb") as f:
                f.write(image_bytes)
            print("DEBUG: Saved failed image bytes to debug_failed_image.bin")
            raise ValueError(f"Invalid image format: {str(img_error)}")

        # Convert to numpy array for OpenCV/MediaPipe
        image_np = np.array(image)
        # Handle RGBA images
        if image_np.shape[-1] == 4:
            image_np = cv2.cvtColor(image_np, cv2.COLOR_RGBA2BGR)
        else:
            image_np = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)

        # Analyze frame using ProctoringModel
        analysis = proctor_model.analyze_frame(image_np)
        
        faces_count = analysis["face_count"]
        is_valid = faces_count == 1
        warnings = analysis["warnings"]
        
        message = "Face detected successfully!"
        if not is_valid:
            if faces_count == 0:
                message = "No face detected."
            else:
                message = "Multiple faces detected."
        elif warnings:
            message = "Warnings detected: " + ", ".join(warnings)
            
        return FaceDetectionResponse(
            faces_detected=faces_count,
            face_locations=analysis["face_locations"],
            is_valid=is_valid,
            message=message,
            gaze_direction=analysis["gaze_direction"],
            head_pose=analysis["head_pose"],
            warnings=warnings
        )
        
    except Exception as e:
        print(f"Error in detection: {e}")
        return FaceDetectionResponse(
            faces_detected=0,
            face_locations=[],
            is_valid=False,
            message=f"Face detection error: {str(e)}",
            warnings=[str(e)]
        )

# Seed initial data
async def seed_initial_data():
    # Check if super admin already exists
    existing_admin = await db.users.find_one({"email": os.environ.get("ADMIN_EMAIL", "admin@proctortool.com")})
    if not existing_admin:
        # Create super admin
        admin_user = {
            "id": "admin-001",
            "name": "Super Admin",
            "email": os.environ.get("ADMIN_EMAIL", "admin@proctortool.com"),
            "role": "admin",
            "institution": "ProctorTool System",
            "password_hash": bcrypt.hashpw(os.environ.get("ADMIN_PASSWORD", "admin123").encode(), bcrypt.gensalt()).decode(),
            "created_at": datetime.utcnow()
        }
        await db.users.insert_one(admin_user)
        print("✅ Super admin created successfully")
        
    # Check if sample users already exist
    existing_user = await db.users.find_one({"email": "student@university.edu"})
    if not existing_user:
        # Create sample users
        users = [
            {
                "id": "user-001",
                "name": "Alice Johnson",
                "email": "student@university.edu",
                "role": "student",
                "institution": "State University",
                "password_hash": bcrypt.hashpw("password123".encode(), bcrypt.gensalt()).decode(),
                "created_at": datetime.utcnow()
            },
            {
                "id": "user-002",
                "name": "Dr. Sarah Wilson",
                "email": "proctor@university.edu",
                "role": "proctor", 
                "institution": "State University",
                "password_hash": bcrypt.hashpw("password123".encode(), bcrypt.gensalt()).decode(),
                "created_at": datetime.utcnow()
            }
        ]
        await db.users.insert_many(users)
        
        # Create sample exams (assigned to the proctor)
        exams = [
            {
                "id": "exam-001",
                "title": "Software Engineering Fundamentals",
                "subject": "Computer Science",
                "duration": 120,
                "total_questions": 3,
                "status": "scheduled",
                "scheduled_at": datetime.utcnow() + timedelta(hours=1),
                "proctor_id": "user-002",  # Assigned to Dr. Sarah Wilson
                "instructions": [
                    "Keep your webcam on throughout the exam",
                    "Do not switch tabs or applications during the exam",
                    "Ensure you are alone in the room",
                    "Have a valid ID ready for verification"
                ]
            }
        ]
        await db.exams.insert_many(exams)
        
        # Create enrollment for the student
        enrollments = [
            {
                "id": str(uuid.uuid4()),
                "exam_id": "exam-001",
                "student_id": "user-001",
                "enrolled_at": datetime.utcnow(),
                "enrolled_by": "user-002",  # Enrolled by Dr. Sarah Wilson
                "status": "enrolled"
            }
        ]
        await db.exam_enrollments.insert_many(enrollments)

        
        # Create sample questions
        questions = [
            {
                "id": "q1",
                "exam_id": "exam-001",
                "type": "multiple-choice",
                "question": "Which of the following is NOT a principle of Object-Oriented Programming?",
                "options": ["Encapsulation", "Inheritance", "Polymorphism", "Compilation"],
                "correct_answer": 3,
                "time_limit": 180
            },
            {
                "id": "q2",
                "exam_id": "exam-001",
                "type": "multiple-choice", 
                "question": "What is the time complexity of binary search algorithm?",
                "options": ["O(n)", "O(log n)", "O(n²)", "O(1)"],
                "correct_answer": 1,
                "time_limit": 120
            },
            {
                "id": "q3",
                "exam_id": "exam-001",
                "type": "text",
                "question": "Explain the difference between a stack and a queue data structure.",
                "time_limit": 300
            }
        ]
        await db.questions.insert_many(questions)

# Authentication routes


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "student"
    institution: str

class ExamCreateRequest(BaseModel):
    title: str
    subject: str
    duration: int
    total_questions: int
    scheduled_at: datetime
    instructions: List[str]

@api_router.post("/auth/register", response_model=LoginResponse)
async def register(request: RegisterRequest):
    """Student registration only - proctors must be created by admin"""
    existing_user = await db.users.find_one({"email": request.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # SECURITY: Force role to "student" - prevent unauthorized proctor registration
    forced_role = "student"
        
    hashed_password = bcrypt.hashpw(request.password.encode(), bcrypt.gensalt()).decode()
    
    new_user = {
        "id": str(uuid.uuid4()),
        "name": request.name,
        "email": request.email,
        "role": forced_role,  # Always student, regardless of input
        "institution": request.institution,
        "password_hash": hashed_password,
        "created_at": datetime.utcnow()
    }
    
    await db.users.insert_one(new_user)
    
    # Create token with only strict JSON serializable data
    token_payload = {
        "id": new_user["id"],
        "name": new_user["name"],
        "email": new_user["email"],
        "role": new_user["role"],
        "institution": new_user["institution"]
    }
    token = create_jwt_token(token_payload)
    
    # Remove password_hash for response
    new_user_response = {k:v for k,v in new_user.items() if k != 'password_hash'}
    
    return LoginResponse(
        token=token,
        user=User(**new_user_response)
    )

@api_router.post("/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    user = await db.users.find_one({"email": request.email, "role": request.role})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # In production, properly hash and verify password
    if not bcrypt.checkpw(request.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_data = {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "institution": user["institution"]
    }
    
    token = create_jwt_token(user_data)
    
    return LoginResponse(
        token=token,
        user=User(**user_data)
    )

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}

# Admin routes - Proctor Management
class ProctorInviteRequest(BaseModel):
    name: str
    email: str
    institution: str
    department: Optional[str] = None

@api_router.post("/admin/proctors/invite")
async def invite_proctor(request: ProctorInviteRequest, admin: dict = Depends(require_admin)):
    """Super admin creates proctor accounts"""
    # Check if email already exists
    existing_user = await db.users.find_one({"email": request.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Generate temporary password (admin should share this securely)
    # Generate temporary password (admin should share this securely)
    temp_password = f"Proctor{str(uuid.uuid4())[:8]}"
    hashed_password = bcrypt.hashpw(temp_password.encode(), bcrypt.gensalt()).decode()
    
    new_proctor = {
        "id": str(uuid.uuid4()),
        "name": request.name,
        "email": request.email,
        "role": "proctor",
        "institution": request.institution,
        "password_hash": hashed_password,
        "created_at": datetime.utcnow()
    }
    
    await db.users.insert_one(new_proctor)
    
    # Return temp password so admin can share it
    return {
        "message": "Proctor created successfully",
        "proctor_id": new_proctor["id"],
        "email": request.email,
        "temporary_password": temp_password,
        "note": "Share this password securely with the proctor. They should change it upon first login."
    }

@api_router.get("/admin/proctors")
async def list_proctors(admin: dict = Depends(require_admin)):
    """List all proctors"""
    proctors = await db.users.find({"role": "proctor"}).to_list(1000)
    return [{
        "id": p["id"],
        "name": p["name"],
        "email": p["email"],
        "institution": p["institution"],
        "created_at": p["created_at"]
    } for p in proctors]

@api_router.delete("/admin/proctors/{proctor_id}")
async def remove_proctor(proctor_id: str, admin: dict = Depends(require_admin)):
    """Remove a proctor account"""
    result = await db.users.delete_one({"id": proctor_id, "role": "proctor"})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Proctor not found")
    
    # Also delete their exams and enrollments
    await db.exams.delete_many({"proctor_id": proctor_id})
    await db.exam_enrollments.delete_many({"enrolled_by": proctor_id})
    
    return {"message": "Proctor removed successfully"}

# Exam routes
@api_router.get("/exams", response_model=List[Exam])
async def get_exams(current_user: dict = Depends(get_current_user)):
    """Get exams - students see only enrolled exams, proctors see their own exams"""
    if current_user["role"] == "student":
        # Students only see exams they're enrolled in
        enrollments = await db.exam_enrollments.find({"student_id": current_user["id"]}).to_list(1000)
        exam_ids = [e["exam_id"] for e in enrollments]
        
        if not exam_ids:
            return []
        
        exams = await db.exams.find({"id": {"$in": exam_ids}}).to_list(1000)
        return [Exam(**exam) for exam in exams]
    elif current_user["role"] == "proctor":
        # Proctors see only their own exams
        exams = await db.exams.find({"proctor_id": current_user["id"]}).to_list(1000)
        return [Exam(**exam) for exam in exams]
    else:
        # Admins see all exams
        exams = await db.exams.find().to_list(1000)
        return [Exam(**exam) for exam in exams]


class QuestionItem(BaseModel):
    text: str
    options: List[str]
    correct_answer: str
    points: int = 1

class ExamCreateRequest(BaseModel):
    title: str
    subject: str
    duration: int
    total_questions: int
    scheduled_at: datetime
    instructions: List[str]
    questions: Optional[List[QuestionItem]] = []

@api_router.post("/proctor/exams/create", response_model=Exam)
async def create_exam(request: ExamCreateRequest, proctor: dict = Depends(require_proctor)):
    """Proctor creates an exam - automatically assigned as owner"""
        
    exam = Exam(
        title=request.title,
        subject=request.subject,
        duration=request.duration,
        total_questions=request.total_questions,
        status="scheduled",
        scheduled_at=request.scheduled_at,
        instructions=request.instructions,
        proctor_id=proctor["id"]  # Automatically assign to creating proctor
    )
    
    await db.exams.insert_one(exam.dict())
    
    # Insert questions if provided
    if request.questions:
        questions_db = []
        for q in request.questions:
            questions_db.append({
                "id": str(uuid.uuid4()),
                "exam_id": exam.id,
                "text": q.text,
                "options": q.options,
                "correct_answer": q.correct_answer,
                "points": q.points
            })
        if questions_db:
             await db.questions.insert_many(questions_db)
             
    return exam

@api_router.delete("/proctor/exams/{exam_id}")
async def delete_exam(exam_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "proctor":
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = await db.exams.delete_one({"id": exam_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Exam not found")
        
    # Also delete associated questions
    await db.questions.delete_many({"exam_id": exam_id})
    
    return {"message": "Exam deleted successfully"}



@api_router.get("/proctor/exams/{exam_id}")
async def get_exam_details(exam_id: str, current_user: dict = Depends(get_current_user)):
    """Get full exam details including questions"""
    import traceback
    try:
        # Allow proctors (owners) and students (taking exam) to access?
        # For structure/editing, mostly proctor.
        
        exam = await db.exams.find_one({"id": exam_id})
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")
            
        # Security check: only owner or admin can see full details for editing
        if current_user["role"] == "proctor" and exam["proctor_id"] != current_user["id"]:
             raise HTTPException(status_code=403, detail="Not authorized to view this exam")

        questions = await db.questions.find({"exam_id": exam_id}).to_list(1000)
        
        # Remove _id which is not serializable
        if "_id" in exam:
            del exam["_id"]
        
        # Ensure datetime objects are strings (if not automatically handled)
        if "scheduled_at" in exam and hasattr(exam["scheduled_at"], "isoformat"):
            exam["scheduled_at"] = exam["scheduled_at"].isoformat()
        
        return {
            **exam,
            "questions": [{
                "text": q.get("text") or q.get("question") or "Question text missing",
                "options": q.get("options", []),
                "correct_answer": q.get("correct_answer"),
                "points": q.get("points", 1)
            } for q in questions]
        }
    except Exception as e:
        with open("debug_error.log", "w") as f:
            f.write(traceback.format_exc())
            f.write(f"\nError: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@api_router.put("/proctor/exams/{exam_id}")
async def update_exam(exam_id: str, request: ExamCreateRequest, current_user: dict = Depends(require_proctor)):
    """Update an existing exam"""
    exam = await db.exams.find_one({"id": exam_id})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
        
    if exam["proctor_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to edit this exam")
        
    # Update exam fields
    await db.exams.update_one(
        {"id": exam_id},
        {"$set": {
            "title": request.title,
            "subject": request.subject,
            "duration": request.duration,
            "total_questions": request.total_questions,
            "scheduled_at": request.scheduled_at,
            "instructions": request.instructions
        }}
    )
    
    # Update questions (simple strategy: delete all and recreate)
    # In a real app, might want smarter diffing, but this is safe for now
    if request.questions is not None:
        await db.questions.delete_many({"exam_id": exam_id})
        
        questions_db = []
        for q in request.questions:
            questions_db.append({
                "id": str(uuid.uuid4()),
                "exam_id": exam_id,
                "text": q.text,
                "options": q.options,
                "correct_answer": q.correct_answer,
                "points": q.points
            })
        if questions_db:
             await db.questions.insert_many(questions_db)
    
    # Remove _id which is not serializable
    if "_id" in exam:
        del exam["_id"]
             
    return {**exam, "title": request.title} # Return updated basic info



@api_router.get("/exams/{exam_id}/questions", response_model=List[Question])
async def get_exam_questions(exam_id: str, current_user: dict = Depends(get_current_user)):
    questions = await db.questions.find({"exam_id": exam_id}).to_list(1000)
    return [Question(**question) for question in questions]

# Proctor Enrollment Endpoints
class EnrollStudentsRequest(BaseModel):
    student_emails: List[str]

@api_router.post("/proctor/exams/{exam_id}/enroll")
async def enroll_students(exam_id: str, request: EnrollStudentsRequest, proctor: dict = Depends(require_proctor)):
    """Proctor enrolls students into their exam"""
    # Verify exam ownership
    await verify_exam_ownership(exam_id, proctor["id"])
    
    enrolled_count = 0
    already_enrolled = []
    not_found = []
    
    for email in request.student_emails:
        # Find student by email
        student = await db.users.find_one({"email": email, "role": "student"})
        
        if not student:
            not_found.append(email)
            continue
        
        # Check if already enrolled
        existing_enrollment = await db.exam_enrollments.find_one({
            "exam_id": exam_id,
            "student_id": student["id"]
        })
        
        if existing_enrollment:
            already_enrolled.append(email)
            continue
        
        # Create enrollment
        enrollment = {
            "id": str(uuid.uuid4()),
            "exam_id": exam_id,
            "student_id": student["id"],
            "enrolled_at": datetime.utcnow(),
            "enrolled_by": proctor["id"],
            "status": "enrolled"
        }
        
        await db.exam_enrollments.insert_one(enrollment)
        enrolled_count += 1
    
    return {
        "message": f"Successfully enrolled {enrolled_count} student(s)",
        "enrolled_count": enrolled_count,
        "already_enrolled": already_enrolled,
        "not_found": not_found
    }

@api_router.get("/proctor/exams/{exam_id}/enrollments")
async def get_exam_enrollments(exam_id: str, proctor: dict = Depends(require_proctor)):
    """Get all students enrolled in a specific exam"""
    # Verify exam ownership
    await verify_exam_ownership(exam_id, proctor["id"])
    
    # Get all enrollments for this exam
    enrollments = await db.exam_enrollments.find({"exam_id": exam_id}).to_list(1000)
    
    # Fetch student details
    result = []
    for enrollment in enrollments:
        student = await db.users.find_one({"id": enrollment["student_id"]})
        if student:
            result.append({
                "enrollment_id": enrollment["id"],
                "student_id": student["id"],
                "student_name": student["name"],
                "student_email": student["email"],
                "enrolled_at": enrollment["enrolled_at"],
                "status": enrollment["status"]
            })
    
    return result

@api_router.delete("/proctor/exams/{exam_id}/enrollments/{student_id}")
async def remove_enrollment(exam_id: str, student_id: str, proctor: dict = Depends(require_proctor)):
    """Remove a student from an exam"""
    # Verify exam ownership
    await verify_exam_ownership(exam_id, proctor["id"])
    
    result = await db.exam_enrollments.delete_one({
        "exam_id": exam_id,
        "student_id": student_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    
    return {"message": "Student removed from exam"}

@api_router.get("/proctor/students")
async def get_proctor_students(proctor: dict = Depends(require_proctor)):
    """Get all students currently in active sessions for the proctor's exams"""
    # Get all exams belonging to this proctor
    proctor_exams = await db.exams.find({"proctor_id": proctor["id"]}).to_list(1000)
    exam_ids = [exam["id"] for exam in proctor_exams]
    
    if not exam_ids:
        return []
    
    # Get all active sessions for these exams
    # [UPDATED] Removed 'in_progress' filter to show results for completed exams too
    sessions = await db.exam_sessions.find({
        "exam_id": {"$in": exam_ids}
    }).to_list(1000)

    # [NEW] Prefetch questions for grading (Self-Healing Logic)
    all_questions = await db.questions.find({"exam_id": {"$in": exam_ids}}).to_list(10000)
    questions_map = {} # exam_id -> list of questions
    for q in all_questions:
        if q["exam_id"] not in questions_map:
            questions_map[q["exam_id"]] = []
        questions_map[q["exam_id"]].append(q)
    
    # Build student list with session data
    result = []
    for session in sessions:
        student = await db.users.find_one({"id": session["student_id"]})
        if student:
            exam = next((e for e in proctor_exams if e["id"] == session["exam_id"]), None)
            
            # [NEW] Self-Healing: Recalculate score if missing for completed exams OR to apply new grading fix
            score = session.get("score", 0)
            total_points = session.get("total_points", 0)
            percentage = session.get("percentage", 0)

            if session.get("status") == "completed":
                 # Calculate now to ensure accuracy with new index_to_letter mapping
                 exam_questions = questions_map.get(session["exam_id"], [])
                 if exam_questions:
                     calc_total = 0
                     calc_score = 0
                     student_answers = session.get("answers", {})
                     
                     # Map index to letter for grading
                     index_to_letter = {"0": "a", "1": "b", "2": "c", "3": "d"}
                     
                     for q in exam_questions:
                         points = q.get("points", 1)
                         calc_total += points
                         q_id = q.get("id")
                         if q_id in student_answers: 
                             # Normalize comparison securely
                             raw_ans = student_answers[q_id]
                             if isinstance(raw_ans, dict):
                                 student_val = str(raw_ans.get("answer", "")).strip().lower()
                             else:
                                 student_val = str(raw_ans).strip().lower()
                             
                             correct_val = str(q.get("correct_answer")).strip().lower()
                             
                             # Map numeric index to letter if necessary
                             if student_val in index_to_letter:
                                 student_val = index_to_letter[student_val]
                             
                             if student_val == correct_val:
                                 calc_score += points
                     
                     # Update session in DB
                     score = calc_score
                     total_points = calc_total
                     percentage = (score / total_points * 100) if total_points > 0 else 0
                     
                     await db.exam_sessions.update_one(
                         {"id": session["id"]},
                         {"$set": {
                             "score": score,
                             "total_points": total_points,
                             "percentage": percentage
                         }}
                     )

            result.append({
                "id": student["id"],
                "sessionId": session["id"],
                "name": student["name"],
                "email": student["email"],
                "examId": session["exam_id"],
                "examTitle": exam["title"] if exam else "Unknown",
                "status": session.get("status", "pending"), # status (in_progress, completed)
                "verification_status": session.get("verification_status", "pending"),
                "progress": min(100, int((session.get("current_question_index", 0) / exam.get("total_questions", 1)) * 100)) if exam else 0,
                "webcam_status": "active" if session.get("webcam_enabled") else "inactive",
                "screen_status": "monitored" if session.get("face_detected") else "not_monitored",
                "flag_count": await db.proctoring_flags.count_documents({"session_id": session["id"]}),
                "time_remaining": max(0, exam.get("duration", 0) - (datetime.utcnow() - session.get("start_time", datetime.utcnow())).total_seconds() / 60) if exam else 0,
                "last_active": session.get("start_time", datetime.utcnow()).isoformat(),
                "score": score,
                "total_points": total_points,
                "percentage": percentage,
                "end_time": session.get("end_time").isoformat() if session.get("end_time") else None
            })
    
    return result

@api_router.get("/proctor/flags")
async def get_proctor_flags(proctor: dict = Depends(require_proctor)):
    """Get all proctoring flags for the proctor's exams"""
    # Get all exams belonging to this proctor
    proctor_exams = await db.exams.find({"proctor_id": proctor["id"]}).to_list(1000)
    exam_ids = [exam["id"] for exam in proctor_exams]
    
    if not exam_ids:
        return []
    
    # Get all sessions for these exams
    sessions = await db.exam_sessions.find({"exam_id": {"$in": exam_ids}}).to_list(1000)
    session_ids = [s["id"] for s in sessions]
    
    if not session_ids:
        return []
    
    # Get all flags for these sessions
    flags = await db.proctoring_flags.find({"session_id": {"$in": session_ids}}).to_list(1000)
    
    # [NEW] Enrich flags with student and exam info
    result_flags = []
    
    # Prefetch users and exams for lookups
    all_students = await db.users.find({"role": "student"}).to_list(10000)
    student_map = {str(s["id"]): s for s in all_students}
    
    # Exam map is already proctor_exams
    exam_map = {str(e["id"]): e for e in proctor_exams}
    
    # Session map
    session_map = {str(s["id"]): s for s in sessions}

    # Serialize _id
    for flag in flags:
        flag["id"] = str(flag["_id"]) if "_id" in flag else flag.get("id")
        if "_id" in flag:
            del flag["_id"]
            
        # Enrich
        session = session_map.get(flag["session_id"])
        if session:
             student = student_map.get(session["student_id"])
             exam = exam_map.get(session["exam_id"])
             
             flag["student_name"] = student["name"] if student else "Unknown"
             flag["exam_title"] = exam["title"] if exam else "Unknown"
             flag["exam_id"] = session["exam_id"]
        
        result_flags.append(flag)
            
    return result_flags

# Face detection route
@api_router.post("/verification/face-detect", response_model=FaceDetectionResponse)
async def detect_face(request: FaceDetectionRequest):
    return detect_faces_in_image(request.image_data)

# Exam session routes
# Exam session routes
@api_router.post("/session/start")
async def start_exam_session(
    request: StartSessionRequest, 
    current_user: dict = Depends(get_current_user)
):
    """Start an exam session - student must be enrolled"""
    exam_id = request.exam_id
        
    if not exam_id:
        raise HTTPException(status_code=400, detail="Exam ID required")

    # Verify exam exists
    exam = await db.exams.find_one({"id": exam_id})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # CRITICAL: Verify student is enrolled (multi-proctor security)
    if current_user["role"] == "student":
        enrollment = await db.exam_enrollments.find_one({
            "exam_id": exam_id,
            "student_id": current_user["id"]
        })
        
        if not enrollment:
            raise HTTPException(
                status_code=403, 
                detail="You are not enrolled in this exam. Please contact your proctor."
            )
            
        # Check if session already exists
        existing_session = await db.exam_sessions.find_one({
            "student_id": current_user["id"],
            "exam_id": exam_id,
            "status": "in_progress"
        })
        
        if existing_session:
             return {
                 "session_id": existing_session["id"], 
                 "message": "Resumed existing session", 
                 "proctor_id": exam.get("proctor_id"),
                 "start_time": existing_session.get("start_time", datetime.utcnow()).isoformat(),
                 "duration": exam.get("duration")
             }
    
    # Create session with proctor_id from the exam
    session = ExamSession(
        student_id=current_user["id"],
        exam_id=exam_id,
        proctor_id=exam.get("proctor_id", "unknown"),  # Track which proctor's exam this is
        status="in_progress",
        webcam_enabled=True
    )
    
    await db.exam_sessions.insert_one(session.dict())
    return {
        "session_id": session.id, 
        "message": "Exam session started", 
        "proctor_id": exam.get("proctor_id"),
        "start_time": session.start_time.isoformat(),
        "duration": exam.get("duration")
    }

@api_router.post("/session/{session_id}/answer")
async def save_answer(
    session_id: str, 
    question_id: str, 
    answer: str,
    current_user: dict = Depends(get_current_user)
):
    await db.exam_sessions.update_one(
        {"id": session_id, "student_id": current_user["id"]},
        {"$set": {f"answers.{question_id}": {"answer": answer, "timestamp": datetime.utcnow()}}}
    )
    return {"message": "Answer saved"}

class VerificationResponse(BaseModel):
    is_valid: bool
    message: str
    warnings: List[str] = []

class IdentityVerificationRequest(BaseModel):
    image_data: str # Webcam Image
    id_image_data: Optional[str] = None # ID Card Image (base64)

@api_router.post("/verify/identity", response_model=VerificationResponse)
async def verify_identity_endpoint(
    request: IdentityVerificationRequest, 
    current_user: dict = Depends(get_current_user)
):
    try:
        # Decode webcam image
        if ',' in request.image_data:
            img_header, img_content = request.image_data.split(',', 1)
            webcam_img_data = base64.b64decode(img_content)
        else:
            webcam_img_data = base64.b64decode(request.image_data)
            
        nparr = np.frombuffer(webcam_img_data, np.uint8)
        webcam_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if webcam_img is None:
            print("ERROR: Failed to decode webcam image")
            return VerificationResponse(
                is_valid=False,
                message="Invalid webcam image format",
                warnings=["Image decoding failed"]
            )
                
        # 1. Basic Face Detection check
        analysis = proctor_model.analyze_frame(webcam_img)
        
        if analysis["face_count"] != 1:
            return VerificationResponse(
                is_valid=False,
                message=f"Face verification failed: Found {analysis['face_count']} faces. Please ensure exactly one face is visible.",
                warnings=[]
            )

        # 2. Match against ID Card if provided
        if request.id_image_data:
            try:
                if ',' in request.id_image_data:
                    id_header, id_content = request.id_image_data.split(',', 1)
                    id_img_data = base64.b64decode(id_content)
                else:
                    id_img_data = base64.b64decode(request.id_image_data)
                
                nparr_id = np.frombuffer(id_img_data, np.uint8)
                id_img = cv2.imdecode(nparr_id, cv2.IMREAD_COLOR)
                
                if id_img is None:
                    print("ERROR: Failed to decode ID card image")
                    return VerificationResponse(
                        is_valid=False,
                        message="Invalid ID card image format",
                        warnings=["ID Image decoding failed"]
                    )
                                
                # Verify match
                match_result = proctor_model.verify_face_match(id_img, webcam_img)
                
                if match_result["verified"]:
                    return VerificationResponse(
                        is_valid=True,
                        message=f"Identity Verified. Matches ID Card (Distance: {match_result.get('distance', 0):.4f})",
                        warnings=[]
                    )
                else:
                    return VerificationResponse(
                        is_valid=False,
                        message="Face does not match the provided ID card.",
                        warnings=["Face mismatch"]
                    )
            except Exception as e:
                print(f"Comparison Error: {e}")
                pass # Fallback to just face presence if ID processing fails? No, strict mode.

        # Fallback if no ID card provided (or just testing)
        # In industry standard, we MUST verify against something. 
        # For now, if no ID card, we just return face detection success but warn.
        return VerificationResponse(
            is_valid=True,
            message="Face detected successfully (No ID card provided for comparison)",
            warnings=["ID Card missing for comparison"]
        )

    except Exception as e:
        print(f"Error in verification: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class IdVerificationRequest(BaseModel):
    image_data: str # Base64 of ID card

@api_router.post("/verify/id-card", response_model=VerificationResponse)
async def verify_id_card_endpoint(
    request: IdVerificationRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        # Decode image
        if ',' in request.image_data:
            image_data = base64.b64decode(request.image_data.split(',')[1])
        else:
            image_data = base64.b64decode(request.image_data)
            
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Verify Name
        user_name = current_user["name"]
        result = proctor_model.verify_id_name(img, user_name)
        
        if result["match"]:
            return VerificationResponse(
                is_valid=True,
                message=f"ID Verification Successful. Name matched: {result['extracted_text']}",
                warnings=[]
            )
        else:
             return VerificationResponse(
                is_valid=False,
                message=f"Name mismatch. Expected '{user_name}', found '{result['extracted_text']}'",
                warnings=["Name mismatch on ID card"]
            )
    except Exception as e:
        print(f"Error in ID verification: {e}")
        # Allow pass if OCR fails? No, fail secure.
        return VerificationResponse(
            is_valid=False, 
            message="Could not read ID card. Please ensure text is clear.",
            warnings=["OCR Failed"]
        )

@api_router.post("/session/{session_id}/monitor")
async def monitor_session(
    session_id: str,
    request: MonitorRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        # Decode image
        if ',' in request.image_data:
            image_data = request.image_data.split(',')[1]
        else:
            image_data = request.image_data
            
        image_bytes = base64.b64decode(image_data)
        image = Image.open(BytesIO(image_bytes))
        image_np = np.array(image)
        if image_np.shape[-1] == 4:
            image_np = cv2.cvtColor(image_np, cv2.COLOR_RGBA2BGR)
        else:
            image_np = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)

        # Analyze
        analysis = proctor_model.analyze_frame(image_np)
        
        # Merge backend and frontend warnings
        all_warnings = analysis["warnings"] + request.client_warnings
        
        # Handle Flags
        if all_warnings:
            for warning in all_warnings:
                flag_type = "suspicious_behavior"
                severity = "low"
                
                if "No face" in warning:
                    flag_type = "no_face"
                    severity = "high"
                elif "Multiple faces" in warning:
                    flag_type = "multiple_faces"
                    severity = "high"
                elif "Audio" in warning or "Tab Switch" in warning:
                    flag_type = "env_violation"
                    severity = "medium"
                elif "Looking" in warning or "Gaze deviation" in warning:
                    flag_type = "gaze_violation"
                    severity = "medium"
                elif "Dark" in warning or "Low light" in warning:
                    flag_type = "environment_issue"
                    severity = "low"
                elif "blurry" in warning:
                    flag_type = "video_quality"
                    severity = "low"
                elif "Mouth open" in warning or "Talking" in warning:
                    flag_type = "audio_violation"
                    severity = "medium"
                elif "Drowsy" in warning or "Eyes closed" in warning:
                    flag_type = "drowsiness"
                    severity = "low"

                evidence = request.image_data
                if "Audio" in warning or "Talking" in warning or flag_type == "audio_violation":
                    evidence = None

                flag = ProctoringFlag(
                    student_id=current_user["id"],
                    session_id=session_id,
                    type=flag_type,
                    description=warning,
                    severity=severity,
                    evidence_image=evidence
                )
                await db.proctoring_flags.insert_one(flag.dict())

        # Update Session with latest status
        await db.exam_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "face_detected": analysis["face_count"] > 0,
                "last_active": datetime.utcnow()
            }}
        )

        return {
            "status": "success", 
            "warnings": analysis["warnings"],
            "gaze": analysis["gaze_direction"]
        }
    except Exception as e:
        print(f"Monitor Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ENHANCED ANALYSIS WITH ANOMALY SCORING (from research paper)
@api_router.post("/session/{session_id}/analyze-enhanced")
async def analyze_frame_enhanced(
    session_id: str,
    request: MonitorRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Enhanced frame analysis with multi-modal anomaly scoring.
    Includes object detection (YOLO) and weighted anomaly scores.
    Handles client-side warnings and creates flags for all violations.
    """
    try:
        # Decode image
        if ',' in request.image_data:
            image_data = request.image_data.split(',')[1]
        else:
            image_data = request.image_data
            
        image_bytes = base64.b64decode(image_data)
        image = Image.open(BytesIO(image_bytes))
        image_np = np.array(image)
        if image_np.shape[-1] == 4:
            image_np = cv2.cvtColor(image_np, cv2.COLOR_RGBA2BGR)
        else:
            image_np = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)

        # Run enhanced analysis (includes object detection + anomaly scoring)
        result = proctor_model.enhanced_analyze_frame(image_np)
        
        # Merge backend and frontend warnings
        all_warnings = result.get("warnings", []) + request.client_warnings
        
        # Log anomaly score to database
        if result.get('anomaly_scoring', {}).get('enabled'):
            await db.exam_sessions.update_one(
                {'id': session_id},
                {
                    '$push': {
                        'anomaly_scores': {
                            **result['anomaly_scoring'],
                            'timestamp': datetime.utcnow()
                        }
                    },
                    '$set': {
                        'last_analysis': datetime.utcnow(),
                        'face_detected': result.get('face_count', 0) > 0,
                        'last_active': datetime.utcnow(),
                         # LIVE STREAMING: Store latest frame for proctor view
                        'latest_frame': request.image_data, # Store base64
                        'latest_screen': request.screen_data if request.screen_data else None
                    }
                }
            )
            
        # Handle Standard Flags (same logic as monitor_session)
        if all_warnings:
            for warning in all_warnings:
                flag_type = "suspicious_behavior"
                severity = "low"
                
                if "No face" in warning:
                    flag_type = "no_face"
                    severity = "high"
                elif "Multiple faces" in warning:
                    flag_type = "multiple_faces"
                    severity = "high"
                elif "Audio" in warning or "Tab Switch" in warning:
                    flag_type = "env_violation"
                    severity = "medium"
                elif "Looking" in warning or "Gaze deviation" in warning:
                    flag_type = "gaze_violation"
                    severity = "medium"
                elif "Dark" in warning or "Low light" in warning:
                    flag_type = "environment_issue"
                    severity = "low"
                elif "blurry" in warning:
                    flag_type = "video_quality"
                    severity = "low"
                elif "Mouth open" in warning or "Talking" in warning:
                    flag_type = "audio_violation"
                    severity = "medium"
                elif "Drowsy" in warning or "Eyes closed" in warning:
                    flag_type = "drowsiness"
                    severity = "low"

                evidence = request.image_data
                if "Audio" in warning or "Talking" in warning or flag_type == "audio_violation":
                    evidence = None

                # Create flag if it's a significant violation
                # Avoid duplicate low-severity flags if possible, but for now log all
                flag = ProctoringFlag(
                    student_id=current_user["id"],
                    session_id=session_id,
                    type=flag_type,
                    description=warning,
                    severity=severity,
                    evidence_image=evidence
                )
                await db.proctoring_flags.insert_one(flag.dict())
        # Create flags for Research Paper Violations (High Severity)
        if result.get('should_alert'):
            alert_level = result['anomaly_scoring'].get('alert_level', 'MEDIUM')
            
            # High priority flag for HIGH alerts
            if alert_level == 'HIGH':
                flag = ProctoringFlag(
                    student_id=current_user["id"],
                    session_id=session_id,
                    type="high_anomaly_score",
                    description=f"High anomaly score: {result['anomaly_scoring']['S_total']:.2f}",
                    severity="high",
                    evidence_image=request.image_data
                )
                await db.proctoring_flags.insert_one(flag.dict())
            
            # Object detection violations
            if result.get('object_detection', {}).get('violations'):
                for violation in result['object_detection']['violations']:
                    flag = ProctoringFlag(
                        student_id=current_user["id"],
                        session_id=session_id,
                        type="unauthorized_object",
                        description=f"Detected: {violation['object']} ({violation['confidence']:.0%})",
                        severity="high",
                        evidence_image=request.image_data
                    )
                    await db.proctoring_flags.insert_one(flag.dict())
        
        return {
            "status": "success",
            "analysis": result,
            "warnings": all_warnings, # Return merged warnings
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        print(f"Enhanced analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))




@api_router.post("/session/{session_id}/submit")
async def submit_exam(
    session_id: str,
    submission: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Submit exam answers and end session.
    """
    try:
        # Verify session exists and belongs to user
        session = await db.exam_sessions.find_one({
            "id": session_id,
            "student_id": current_user["id"]
        })
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if session.get("status") == "completed":
             return {"message": "Exam already submitted"}

        # [NEW] Calculate Score
        exam = await db.exams.find_one({"id": session["exam_id"]})
        questions = await db.questions.find({"exam_id": session["exam_id"]}).to_list(1000)
        
        score = 0
        total_points = 0
        
        student_answers = submission.get("answers", {})
        
        # Map index to letter for grading
        index_to_letter = {"0": "a", "1": "b", "2": "c", "3": "d"}

        for q in questions:
            q_id = q.get("id")
            points = q.get("points", 1)
            total_points += points
            
            # Simple exact match grading (Normalized)
            if q_id in student_answers:
                student_val = str(student_answers[q_id]).strip().lower()
                correct_val = str(q.get("correct_answer")).strip().lower()
                
                # Map numeric index to letter if necessary
                if student_val in index_to_letter:
                    student_val = index_to_letter[student_val]
                
                if student_val == correct_val:
                    score += points

        # Update session
        update_data = {
            "status": "completed",
            "end_time": datetime.utcnow(),
            "answers": student_answers,
            "verification_status": "verified",
            "score": score,
            "total_points": total_points,
            "percentage": (score / total_points * 100) if total_points > 0 else 0
        }
        
        await db.exam_sessions.update_one(
            {"id": session_id},
            {"$set": update_data}
        )
        
        return {
            "message": "Exam submitted successfully", 
            "score": score, 
            "total": total_points
        }
        

        
    except HTTPException:
        # Re-raise HTTP exceptions (like 404) directly
        raise
    except Exception as e:
        print(f"Submission error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@api_router.get("/proctor/analytics")
async def get_proctor_analytics(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "proctor":
        raise HTTPException(status_code=403, detail="Access denied")

    # Fetch all sessions
    sessions = await db.exam_sessions.find({}).to_list(10000)
    
    # Fetch all questions
    all_questions = await db.questions.find({}).to_list(10000)
    questions_map = {str(q["id"]): q for q in all_questions}

    total_duration_seconds = 0
    total_questions_answered = 0
    question_stats = {} # q_id -> {correct: 0, total: 0}

    for session in sessions:
        # 1. Time Calculation
        if session.get("status") == "completed" and session.get("start_time") and session.get("end_time"):
            try:
                start = session["start_time"]
                end = session["end_time"]
                if isinstance(start, str): start = datetime.fromisoformat(start.replace("Z", ""))
                if isinstance(end, str): end = datetime.fromisoformat(end.replace("Z", ""))
                
                duration = (end - start).total_seconds()
                if 0 < duration < 18000: # Filter out unreasonable durations
                    ans_count = len(session.get("answers", {}))
                    if ans_count > 0:
                        total_duration_seconds += duration
                        total_questions_answered += ans_count
            except Exception:
                pass

        # 2. Difficulty Calculation
        answers = session.get("answers", {})
        for q_id, student_ans in answers.items():
            if q_id not in questions_map: continue
            
            if q_id not in question_stats:
                question_stats[q_id] = {"correct": 0, "total": 0}
            
            question_stats[q_id]["total"] += 1
            
            correct_ans = questions_map[q_id].get("correct_answer", "")
            # Robust Comparison
            if str(student_ans).strip().lower() == str(correct_ans).strip().lower():
                question_stats[q_id]["correct"] += 1

    # Compute Final Metrics
    avg_time = 0
    if total_questions_answered > 0:
        avg_time = (total_duration_seconds / 60) / total_questions_answered

    most_difficult = "N/A"
    lowest_ratio = 1.1
    
    for q_id, stats in question_stats.items():
        if stats["total"] > 0:
            ratio = stats["correct"] / stats["total"]
            if ratio < lowest_ratio:
                lowest_ratio = ratio
                q_text = questions_map[q_id].get("text", "Unknown")
                most_difficult = (q_text[:40] + '..') if len(q_text) > 40 else q_text

    return {
        "average_time_per_question": round(avg_time, 1),
        "most_difficult_question": most_difficult
    }


# Proctor routes
@api_router.get("/proctor/available-students")
async def get_available_students(current_user: dict = Depends(get_current_user)):
    """
    Get a list of all registered students for enrollment purposes.
    """
    if current_user["role"] != "proctor":
        raise HTTPException(status_code=403, detail="Access denied")
    
    students = await db.users.find({"role": "student"}).to_list(1000)
    
    return [
        {
            "id": s["id"],
            "name": s["name"],
            "email": s["email"],
            "institution": s.get("institution", "Unknown")
        }
        for s in students
    ]



@api_router.post("/proctor/flag")
async def create_flag(
    flag_data: CreateFlagRequest,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "proctor":
        raise HTTPException(status_code=403, detail="Access denied")
    
    flag = ProctoringFlag(
        student_id=flag_data.student_id,
        session_id=flag_data.session_id,
        type=flag_data.flag_type,
        description=flag_data.description,
        severity=flag_data.severity
    )
    await db.proctoring_flags.insert_one(flag.dict())
    return {"message": "Flag created", "flag_id": flag.id}

@api_router.get("/student/session/{session_id}/flags")
async def get_student_session_flags(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get flags for a specific session (Student access).
    Only returns flags for the current student's session.
    """
    # Verify session belongs to student
    session = await db.exam_sessions.find_one({
        "id": session_id,
        "student_id": current_user["id"]
    })
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    flags = await db.proctoring_flags.find({
        "session_id": session_id
    }).to_list(1000)
    
    return flags

@api_router.post("/proctor/send-message")
async def send_student_message(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "proctor":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # In a real app this would use WebSockets or push notifications
    # For now we'll just log it to the database as a system message
    await db.proctor_messages.insert_one({
        "student_id": data.get("student_id"),
        "session_id": data.get("session_id"),
        "message": data.get("message"),
        "timestamp": datetime.utcnow(),
        "read": False
    })
    
    return {"status": "success", "message": "Message sent"}

@api_router.post("/proctor/end-session/{session_id}")
async def force_end_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "proctor":
        raise HTTPException(status_code=403, detail="Access denied")
        
    session = await db.exam_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    await db.exam_sessions.update_one(
        {"id": session_id},
        {"$set": {
            "status": "completed",
            "end_time": datetime.utcnow(),
            "forced_submission": True,
            "forced_by": current_user["id"]
        }}
    )
    
    return {"status": "success", "message": "Session terminated"}

# Legacy routes
@api_router.get("/")
async def root():
    return {"message": "Proctored Exam Tool API", "version": "1.0.0"}

# Initialize Analytics
try:
    from analytics import ProctorAnalytics
    analytics = ProctorAnalytics(db)
    ANALYTICS_AVAILABLE = True
except ImportError:
    print("Warning: ProctorAnalytics not available.")
    analytics = None
    ANALYTICS_AVAILABLE = False


# ============================================================================
# ANALYTICS & METRICS ENDPOINTS
# ============================================================================

@api_router.get("/admin/analytics/metrics")
async def get_overall_metrics(
    current_user: dict = Depends(require_admin)
):
    """
    Get overall system performance metrics.
    """
    try:
        if not ANALYTICS_AVAILABLE or analytics is None:
             return {
                "confusion_matrix": {"TP": 0, "FP": 0, "TN": 0, "FN": 0},
                "metrics": {"precision": 0.0, "recall": 0.0, "f1_score": 0.0, "accuracy": 0.0},
                "sample_size": 0,
                "message": "Analytics module not available"
            }
            
        metrics = await analytics.compute_confusion_matrix()
        return metrics
        
    except Exception as e:
        print(f"Metrics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/admin/analytics/per-attack")
async def get_per_attack_metrics(
    current_user: dict = Depends(require_admin)
):
    """
    Get performance metrics broken down by attack type.
    """
    try:
        if not ANALYTICS_AVAILABLE:
            return {
                "message": "Analytics module not available"
            }
            
        per_attack = await analytics.get_per_attack_performance()
        return per_attack
        
    except Exception as e:
        print(f"Per-attack metrics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/proctor/analytics/session/{session_id}")
async def get_session_analytics(
    session_id: str,
    current_user: dict = Depends(require_proctor)
):
    """
    Get comprehensive analytics for a specific exam session.
    """
    try:
        if not ANALYTICS_AVAILABLE:
             return {
                "session_id": session_id,
                "message": "Analytics module not available"
            }
            
        return await analytics.get_session_summary(session_id)
        
    except Exception as e:
        print(f"Session analytics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/proctor/session/{session_id}/live")
async def get_session_live_feed(
    session_id: str,
    current_user: dict = Depends(require_proctor)
):
    """
    Get latest frames for live monitoring
    """
    session = await db.exam_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    return {
        "webcam_frame": session.get("latest_frame"),
        "screen_frame": session.get("latest_screen"),
        "last_active": session.get("last_active"),
        "face_detected": session.get("face_detected", False)
    }


@api_router.get("/admin/analytics/export")
async def export_metrics_report(
    current_user: dict = Depends(require_admin)
):
    """
    Generate comprehensive metrics report for download.
    """
    try:
        if not ANALYTICS_AVAILABLE:
            return {"message": "Analytics module not available"}
            
        return await analytics.export_metrics_report()
        
    except Exception as e:
        print(f"Export metrics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/system/status")
async def get_system_status():
    """
    Get status of research paper features.
    """
    return {
        "object_detection": {
            "enabled": proctor_model.object_detector is not None,
            "model": "YOLOv5s" if proctor_model.object_detector else None
        },
        "anomaly_scoring": {
            "enabled": proctor_model.anomaly_scorer is not None,
            "weights": {
                "alpha": 0.4,
                "beta": 0.3,
                "gamma": 0.3
            } if proctor_model.anomaly_scorer else None
        },
        "analytics": {
            "enabled": ANALYTICS_AVAILABLE,
            "features": ["confusion_matrix", "per_attack_metrics", "session_analytics"]
        },
        "paper_compliance": "90%"
    }

# ============================================================================
# SYSTEM ACTIONS (DATA RESET)
# ============================================================================

@api_router.delete("/admin/reset/proctor/{proctor_id}")
async def reset_proctor_data(
    proctor_id: str,
    current_user: dict = Depends(require_admin)
):
    """
    Admin-only: Delete all data (exams, sessions, flags) belonging to a specific proctor.
    Does NOT delete the proctor's account itself.
    """
    try:
        exams_res = await db.exams.delete_many({"proctor_id": proctor_id})
        sessions_res = await db.exam_sessions.delete_many({"proctor_id": proctor_id})

        # Flags link to sessions, not directly to proctors
        proctor_session_ids = [s["id"] for s in (await db.exam_sessions.find({"proctor_id": proctor_id}).to_list(10000))]
        flags_res = await db.proctoring_flags.delete_many({"session_id": {"$in": proctor_session_ids}})

        return {
            "message": f"Data for proctor {proctor_id} cleared successfully.",
            "deleted": {
                "exams": exams_res.deleted_count,
                "sessions": sessions_res.deleted_count,
                "flags": flags_res.deleted_count,
            }
        }
    except Exception as e:
        logger.error(f"Error resetting proctor {proctor_id} data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reset proctor data: {str(e)}")

@api_router.delete("/proctor/reset/exam/{exam_id}")
async def reset_exam_records(
    exam_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Proctor: Delete all sessions and flags for a specific exam they own.
    Admin: Can delete any exam's records. Proctor: must own the exam.
    """
    role = current_user.get("role", "")
    proctor_id = current_user.get("id")

    if role not in ("admin", "proctor"):
        raise HTTPException(status_code=403, detail="Access denied.")

    # Verify exam ownership for proctors
    exam = await db.exams.find_one({"id": exam_id})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")
    if role == "proctor" and exam.get("proctor_id") != proctor_id:
        raise HTTPException(status_code=403, detail="You can only delete records for exams you created.")

    try:
        # Find sessions for this exam
        exam_sessions = await db.exam_sessions.find({"exam_id": exam_id}).to_list(10000)
        session_ids = [s["id"] for s in exam_sessions]

        # Delete flags first (dependent on sessions)
        flags_res = await db.proctoring_flags.delete_many({"session_id": {"$in": session_ids}})
        # Delete sessions
        sessions_res = await db.exam_sessions.delete_many({"exam_id": exam_id})

        return {
            "message": f"Records for exam '{exam.get('title', exam_id)}' cleared.",
            "deleted": {
                "sessions": sessions_res.deleted_count,
                "flags": flags_res.deleted_count,
            }
        }
    except Exception as e:
        logger.error(f"Error resetting exam {exam_id} records: {e}")
        raise HTTPException(status_code=500, detail=f"Failed: {str(e)}")


@api_router.delete("/proctor/reset/student/{student_id}")
async def reset_student_records(
    student_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Proctor: Delete all sessions and flags for a specific student, scoped to sessions
    the proctor owns. Admin: global scope.
    """
    role = current_user.get("role", "")
    proctor_id = current_user.get("id")

    if role not in ("admin", "proctor"):
        raise HTTPException(status_code=403, detail="Access denied.")

    try:
        if role == "admin":
            # Admin: delete all sessions and flags for this student globally
            student_sessions = await db.exam_sessions.find({"student_id": student_id}).to_list(10000)
        else:
            # Proctor: only delete sessions they own for this student
            student_sessions = await db.exam_sessions.find({
                "student_id": student_id,
                "proctor_id": proctor_id
            }).to_list(10000)

        session_ids = [s["id"] for s in student_sessions]

        flags_res = await db.proctoring_flags.delete_many({"session_id": {"$in": session_ids}})
        sessions_res = await db.exam_sessions.delete_many({"id": {"$in": session_ids}})

        return {
            "message": f"Records for student {student_id} cleared.",
            "deleted": {
                "sessions": sessions_res.deleted_count,
                "flags": flags_res.deleted_count,
            }
        }
    except Exception as e:
        logger.error(f"Error resetting student {student_id} records: {e}")
        raise HTTPException(status_code=500, detail=f"Failed: {str(e)}")

@api_router.delete("/admin/reset/{collection_name}")
async def reset_database_collection(
    collection_name: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Clear records from a specific collection.
    - Admins: global unscoped delete (all records).
    - Proctors: scoped delete (only their own data).
    """
    role = current_user.get("role", "")
    if role not in ("admin", "proctor"):
        raise HTTPException(status_code=403, detail="Access denied.")

    is_admin = (role == "admin")
    proctor_id = current_user.get("id")

    try:
        if collection_name == "exams":
            query = {} if is_admin else {"proctor_id": proctor_id}
            result = await db.exams.delete_many(query)
            scope = "all exams" if is_admin else "your exams"
            return {"message": f"Cleared {scope} successfully.", "deleted_count": result.deleted_count}

        elif collection_name == "sessions":
            query = {} if is_admin else {"proctor_id": proctor_id}
            result = await db.exam_sessions.delete_many(query)
            scope = "all sessions" if is_admin else "your sessions"
            return {"message": f"Cleared {scope} successfully.", "deleted_count": result.deleted_count}

        elif collection_name == "flags":
            if is_admin:
                result = await db.proctoring_flags.delete_many({})
            else:
                # Flags are not directly tied to proctor_id — find session IDs owned by this proctor first
                proctor_sessions = await db.exam_sessions.find({"proctor_id": proctor_id}).to_list(10000)
                proctor_session_ids = [s["id"] for s in proctor_sessions]
                result = await db.proctoring_flags.delete_many({"session_id": {"$in": proctor_session_ids}})
            scope = "all flags" if is_admin else "flags from your sessions"
            return {"message": f"Cleared {scope} successfully.", "deleted_count": result.deleted_count}

        elif collection_name == "students":
            if not is_admin:
                raise HTTPException(status_code=403, detail="Only super admins can delete student accounts.")
            result = await db.users.delete_many({"role": "student"})
            return {"message": "All student accounts cleared successfully.", "deleted_count": result.deleted_count}

        elif collection_name == "all":
            if is_admin:
                # Full factory reset
                exams_res = await db.exams.delete_many({})
                sessions_res = await db.exam_sessions.delete_many({})
                flags_res = await db.proctoring_flags.delete_many({})
                students_res = await db.users.delete_many({"role": "student"})
                return {
                    "message": "Master reset complete.",
                    "deleted": {
                        "exams": exams_res.deleted_count,
                        "sessions": sessions_res.deleted_count,
                        "flags": flags_res.deleted_count,
                        "students": students_res.deleted_count
                    }
                }
            else:
                # Proctor: only their own exams, sessions, and flags
                exams_res = await db.exams.delete_many({"proctor_id": proctor_id})
                sessions_res = await db.exam_sessions.delete_many({"proctor_id": proctor_id})
                proctor_session_ids = [s["id"] for s in (await db.exam_sessions.find({"proctor_id": proctor_id}).to_list(10000))]
                flags_res = await db.proctoring_flags.delete_many({"session_id": {"$in": proctor_session_ids}})
                return {
                    "message": "Your data has been cleared.",
                    "deleted": {
                        "exams": exams_res.deleted_count,
                        "sessions": sessions_res.deleted_count,
                        "flags": flags_res.deleted_count,
                    }
                }

        else:
            raise HTTPException(status_code=400, detail="Invalid collection target.")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting {collection_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Database reset failed: {str(e)}")



# Include the router in the main app
app.include_router(api_router)



# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    await seed_initial_data()
    logger.info("Application started and initial data seeded")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()