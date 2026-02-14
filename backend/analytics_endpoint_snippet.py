@api_router.get("/proctor/analytics")
async def get_proctor_analytics(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "proctor":
        raise HTTPException(status_code=403, detail="Access denied")

    # Fetch all sessions (optimize fields if possible, but need answers and times)
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
                # Handle varying datetime formats
                if isinstance(start, str): start = datetime.fromisoformat(start.replace("Z", ""))
                if isinstance(end, str): end = datetime.fromisoformat(end.replace("Z", ""))
                
                duration = (end - start).total_seconds()
                # Sanity check: duration > 0 and reasonable (< 5 hours)
                if 0 < duration < 18000:
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
