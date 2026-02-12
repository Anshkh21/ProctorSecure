# Add these endpoints after the enrollment endpoints (around line 730)

@api_router.get("/proctor/students")
async def get_proctor_students(proctor: dict = Depends(require_proctor)):
    """Get all students enrolled in any of the proctor's exams"""
    # Get all exams belonging to this proctor
    proctor_exams = await db.exams.find({"proctor_id": proctor["id"]}).to_list(1000)
    exam_ids = [exam["id"] for exam in proctor_exams]
    
    if not exam_ids:
        return []
    
    # Get all enrollments for these exams
    enrollments = await db.exam_enrollments.find({"exam_id": {"$in": exam_ids}}).to_list(1000)
    student_ids = list(set([e["student_id"] for e in enrollments]))
    
    if not student_ids:
        return []
    
    # Get all active sessions for these students in these exams
    sessions = await db.exam_sessions.find({
        "student_id": {"$in": student_ids},
        "exam_id": {"$in": exam_ids}
    }).to_list(1000)
    
    # Build student list with session data
    result = []
    for session in sessions:
        student = await db.users.find_one({"id": session["student_id"]})
        if student:
            exam = next((e for e in proctor_exams if e["id"] == session["exam_id"]), None)
            
            result.append({
                "id": student["id"],
                "name": student["name"],
                "email": student["email"],
                "examId": session["exam_id"],
                "examTitle": exam["title"] if exam else "Unknown",
                "status": session.get("verification_status", "pending"),
                "progress": min(100, (session.get("current_question_index", 0) / exam.get("total_questions", 1)) * 100) if exam else 0,
                "webcam_status": "active" if session.get("webcam_enabled") else "inactive",
                "screen_status": "monitored" if session.get("face_detected") else "not_monitored",
                "flag_count": 0,  # We'll calculate this from flags
                "time_remaining": max(0, exam.get("duration", 0) - 10) if exam else 0,  # Mock calculation
                "last_active": session.get("start_time", datetime.utcnow()).isoformat()
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
    
    return flags
