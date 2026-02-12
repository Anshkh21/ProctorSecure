import cv2
import mediapipe as mp
try:
    from deepface import DeepFace
except ImportError:
    DeepFace = None
    print("Warning: DeepFace not installed. Face verification will be disabled.")
import numpy as np
import time
from typing import Dict, List, Tuple, Any
import pytesseract
from thefuzz import fuzz

# Import new modules from research paper implementation
try:
    from object_detector import ObjectDetector
    OBJECT_DETECTION_AVAILABLE = True
except ImportError:
    print("Warning: ObjectDetector not available. Object detection disabled.")
    OBJECT_DETECTION_AVAILABLE = False

try:
    from anomaly_scoring import AnomalyScoringEngine
    ANOMALY_SCORING_AVAILABLE = True
except ImportError:
    print("Warning: AnomalyScoringEngine not available. Using basic scoring.")
    ANOMALY_SCORING_AVAILABLE = False

import shutil
import os

# Check for Tesseract in common locations
TESSERACT_CMD = None
common_paths = [
    r'C:\Program Files\Tesseract-OCR\tesseract.exe',
    r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
    shutil.which("tesseract")
]

for path in common_paths:
    if path and os.path.exists(path):
        TESSERACT_CMD = path
        break

if TESSERACT_CMD:
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
    print(f"✅ Tesseract found at: {TESSERACT_CMD}")
    OCR_AVAILABLE = True
else:
    print("⚠️ Tesseract not found. OCR features will be mocked/disabled.")
    OCR_AVAILABLE = False

class ProctoringModel:
    # ... (existing init) ...
    def __init__(self):
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            max_num_faces=2,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # Try MediaPipe face detection, fallback to OpenCV if it fails
        self.face_detection = None
        self.face_detection_method = None
        
        # Force OpenCV fallback due to protobuf compatibility issues
        use_opencv_fallback = True
        
        if not use_opencv_fallback:
            try:
                self.mp_face_detection = mp.solutions.face_detection
                self.face_detection = self.mp_face_detection.FaceDetection(
                    min_detection_confidence=0.5
                )
                self.face_detection_method = "mediapipe"
                print("✅ MediaPipe face detection initialized")
            except Exception as e:
                print(f"⚠️ MediaPipe face detection failed: {e}")
                use_opencv_fallback = True
        
        if use_opencv_fallback:
            print("   Using OpenCV Haar Cascade for face detection...")
            try:
                # Load OpenCV's pre-trained Haar Cascade for face detection
                self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
                self.face_detection_method = "opencv"
                print("✅ OpenCV Haar Cascade face detection initialized")
            except Exception as opencv_error:
                print(f"❌ Face detection initialization completely failed: {opencv_error}")
                self.face_detection_method = "none"
        
        # Initialize object detector (YOLO) - from research paper
        if OBJECT_DETECTION_AVAILABLE:
            try:
                self.object_detector = ObjectDetector(confidence_threshold=0.5)
                print("✅ Object detection (YOLO) initialized")
            except Exception as e:
                print(f"Warning: Object detector initialization failed: {e}")
                self.object_detector = None
        else:
            self.object_detector = None
        
        # Initialize anomaly scoring engine - from research paper
        # Weights from cross-validation: α=0.4, β=0.3, γ=0.3
        if ANOMALY_SCORING_AVAILABLE:
            self.anomaly_scorer = AnomalyScoringEngine(alpha=0.4, beta=0.3, gamma=0.3)
            print("✅ Anomaly scoring engine initialized")
        else:
            self.anomaly_scorer = None
        
        # Indices for landmarks
        self.LEFT_EYE = [362, 385, 387, 263, 373, 380]
        self.RIGHT_EYE = [33, 160, 158, 133, 153, 144]
        self.LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]

    # ... (existing methods: _euclidean_distance, _get_aspect_ratio, analyze_frame) ...

    def verify_identity(self, current_face_img: np.ndarray, reference_face_encoding: Any) -> bool:
        """Verify identity by detecting exactly one face."""
        try:
            if self.face_detection_method == "mediapipe":
                fd_results = self.face_detection.process(cv2.cvtColor(current_face_img, cv2.COLOR_BGR2RGB))
                if fd_results.detections and len(fd_results.detections) == 1:
                    return True
            elif self.face_detection_method == "opencv":
                # Use OpenCV Haar Cascade
                gray = cv2.cvtColor(current_face_img, cv2.COLOR_BGR2GRAY)
                faces = self.face_cascade.detectMultiScale(gray, 1.1, 4)
                if len(faces) == 1:
                    return True
            else:
                print("No face detection method available")
                return False
        except Exception as e:
            print(f"Error in verify_identity: {e}")
            return False
        return False
        
    def extract_text_from_image(self, image_np: np.ndarray) -> str:
        """Extract text from ID card image using OCR"""
        try:
            # Preprocessing for better OCR
            gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY)
            # Apply thresholding
            gray = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
            
            text = pytesseract.image_to_string(gray)
            return text
        except Exception as e:
            print(f"OCR Error: {e}")
            return ""

    def verify_id_name(self, id_image_np: np.ndarray, student_name: str) -> Dict[str, Any]:
        """Verify if student name appears on the ID card. Tries multiple rotations."""
        
        # Fallback if OCR is not available
        if not OCR_AVAILABLE:
            return {
                "match": True,
                "match_ratio": 100,
                "extracted_text": "OCR Engine Missing - Verification Bypassed (Dev Mode)",
                "all_extracted": []
            }
            
        extracted_texts = []
        best_match_ratio = 0
        best_text = ""
        
        # Determine rotations to try: 0, 90, 180, 270 degrees
        rotations = [0, 90, 180, 270]
        
        try:
            for angle in rotations:
                if angle == 0:
                    rotated_img = id_image_np
                elif angle == 90:
                    rotated_img = cv2.rotate(id_image_np, cv2.ROTATE_90_CLOCKWISE)
                elif angle == 180:
                    rotated_img = cv2.rotate(id_image_np, cv2.ROTATE_180)
                elif angle == 270:
                    rotated_img = cv2.rotate(id_image_np, cv2.ROTATE_90_COUNTERCLOCKWISE)
                
                # Extract text
                text = self.extract_text_from_image(rotated_img)
                if not text:
                    continue
                    
                extracted_texts.append(text)
                
                # Check match
                ratio = fuzz.partial_ratio(student_name.lower(), text.lower())
                
                if ratio > best_match_ratio:
                    best_match_ratio = ratio
                    best_text = text
                
                # If we found a good match, stop trying rotations
                if best_match_ratio > 75:
                    break
        except Exception as e:
            print(f"ID Verification Error during rotation check: {e}")
            
        is_match = best_match_ratio > 70
        
        return {
            "match": is_match,
            "match_ratio": best_match_ratio,
            "extracted_text": best_text if best_text else "No text extracted (OCR failed)",
            "all_extracted": extracted_texts if extracted_texts else []
        }
        
    def _euclidean_distance(self, point1, point2):
        x1, y1 = point1.ravel()
        x2, y2 = point2.ravel()
        return np.sqrt((x2 - x1)**2 + (y2 - y1)**2)

    def _get_aspect_ratio(self, landmarks, indices, width, height):
        # Calculate aspect ratio for eyes (EAR) or mouth (MAR)
        # Vertical distance 1
        A = self._euclidean_distance(
            np.array([landmarks[indices[1]].x * width, landmarks[indices[1]].y * height]),
            np.array([landmarks[indices[5]].x * width, landmarks[indices[5]].y * height])
        )
        # Vertical distance 2
        B = self._euclidean_distance(
            np.array([landmarks[indices[2]].x * width, landmarks[indices[2]].y * height]),
            np.array([landmarks[indices[4]].x * width, landmarks[indices[4]].y * height])
        )
        # Horizontal distance
        C = self._euclidean_distance(
            np.array([landmarks[indices[0]].x * width, landmarks[indices[0]].y * height]),
            np.array([landmarks[indices[3]].x * width, landmarks[indices[3]].y * height])
        )
        return (A + B) / (2.0 * C)

    def analyze_frame(self, image_np: np.ndarray) -> Dict[str, Any]:
        """
        Analyze a single frame for proctoring violations.
        Returns a dictionary with detection results.
        """
        results = {
            "face_count": 0,
            "face_locations": [],
            "gaze_direction": "center",
            "head_pose": "center",
            "warnings": []
        }
        
        h, w, _ = image_np.shape

        # 0. Environmental Checks (Lighting & Blur)
        gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY)
        brightness = np.mean(gray)
        if brightness < 40:
            results["warnings"].append("Environment too dark/Low light")
        
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        if laplacian_var < 50: # Threshold for blur
             results["warnings"].append("Video too blurry")

        # 1. Face Detection (Count/Presence)
        image_rgb = cv2.cvtColor(image_np, cv2.COLOR_BGR2RGB)
        fd_results = self.face_detection.process(image_rgb)
        
        if fd_results.detections:
            results["face_count"] = len(fd_results.detections)
            for detection in fd_results.detections:
                bboxC = detection.location_data.relative_bounding_box
                results["face_locations"].append({
                    "x": int(bboxC.xmin * w),
                    "y": int(bboxC.ymin * h),
                    "width": int(bboxC.width * w),
                    "height": int(bboxC.height * h)
                })
        
        if results["face_count"] == 0:
            results["warnings"].append("No face detected")
            return results 
            
        if results["face_count"] > 1:
            results["warnings"].append("Multiple faces detected")

        # 2. Face Mesh (Gaze, Head Pose, Mouth, Eyes)
        fm_results = self.face_mesh.process(image_rgb)
        
        if fm_results.multi_face_landmarks:
            face_landmarks = fm_results.multi_face_landmarks[0]
            landmarks_list = face_landmarks.landmark
            
            # --- Head Pose Estimation ---
            face_2d = []
            face_3d = []
            key_landmarks = [1, 152, 33, 263, 61, 291]
            
            for idx, lm in enumerate(landmarks_list):
                if idx in key_landmarks:
                    if idx == 1: 
                        nose_2d = (lm.x * w, lm.y * h)
                        nose_3d = (lm.x * w, lm.y * h, lm.z * 3000)
                    
                    x, y = int(lm.x * w), int(lm.y * h)
                    face_2d.append([x, y])
                    face_3d.append([x, y, lm.z])
            
            face_2d = np.array(face_2d, dtype=np.float64)
            face_3d = np.array(face_3d, dtype=np.float64)

            focal_length = 1 * w
            cam_matrix = np.array([[focal_length, 0, h / 2],
                                   [0, focal_length, w / 2],
                                   [0, 0, 1]])
            dist_matrix = np.zeros((4, 1), dtype=np.float64)

            success, rot_vec, trans_vec = cv2.solvePnP(face_3d, face_2d, cam_matrix, dist_matrix)
            rmat, jac = cv2.Rodrigues(rot_vec)
            angles, mtxR, mtxQ, Qx, Qy, Qz = cv2.RQDecomp3x3(rmat)

            x_angle = angles[0] * 360
            y_angle = angles[1] * 360
            
            if y_angle < -15:
                results["head_pose"] = "left"
                results["warnings"].append("Looking left")
            elif y_angle > 15:
                results["head_pose"] = "right"
                results["warnings"].append("Looking right")
            
            if x_angle < -15:
                results["head_pose"] = "down"
            elif x_angle > 15:
                results["head_pose"] = "up"
                results["warnings"].append("Looking up")

            # --- Eye Aspect Ratio (EAR) - Drowsiness/Blinking ---
            left_ear = self._get_aspect_ratio(landmarks_list, self.LEFT_EYE, w, h)
            right_ear = self._get_aspect_ratio(landmarks_list, self.RIGHT_EYE, w, h)
            avg_ear = (left_ear + right_ear) / 2.0
            
            # Lower threshold to prevent blinking flags. Real sleepiness is usually sustained closure.
            if avg_ear < 0.18: 
                results["warnings"].append("Eyes closed/Drowsy")

            # --- Mouth Aspect Ratio (MAR) - Talking ---
            mouth_top = landmarks_list[13]
            mouth_bottom = landmarks_list[14]
            mouth_left = landmarks_list[61]
            mouth_right = landmarks_list[291]
            
            mouth_h = self._euclidean_distance(
                np.array([mouth_top.x * w, mouth_top.y * h]),
                np.array([mouth_bottom.x * w, mouth_bottom.y * h])
            )
            mouth_w = self._euclidean_distance(
                np.array([mouth_left.x * w, mouth_left.y * h]),
                np.array([mouth_right.x * w, mouth_right.y * h])
            )
            
            if mouth_w > 0:
                mar = mouth_h / mouth_w
                # Increase threshold slightly to avoid flagging slight mouth partings
                if mar > 0.55: 
                    results["warnings"].append("Mouth open/Talking detected")

            # --- Gaze Tracking (Iris vs Eye Corners) ---
            # Refined checking if iris is centered
            left_iris = landmarks_list[468]
            right_iris = landmarks_list[473]
            L_eye_left = landmarks_list[33]  # Left eye left corner
            L_eye_right = landmarks_list[133] # Left eye right corner
            
            # Horizontal ratio for left eye
            eye_width = L_eye_right.x - L_eye_left.x
            if eye_width > 0:
                iris_rel_x = (left_iris.x - L_eye_left.x) / eye_width
                # Iris tracking can be noisy. Widen "center" zone
                if iris_rel_x < 0.25:
                   results["gaze_direction"] = "right" # Mirrored
                   if "Looking right" not in results["warnings"]: 
                       results["warnings"].append("Gaze deviation: looking right")
                elif iris_rel_x > 0.75:
                   results["gaze_direction"] = "left" # Mirrored
                   if "Looking left" not in results["warnings"]:
                       results["warnings"].append("Gaze deviation: looking left")

        return results

    def verify_identity(self, current_face_img: np.ndarray, reference_face_encoding: Any) -> bool:
        fd_results = self.face_detection.process(cv2.cvtColor(current_face_img, cv2.COLOR_BGR2RGB))
        if fd_results.detections and len(fd_results.detections) == 1:
            return True
        return False

    def enhanced_analyze_frame(self, image_np: np.ndarray) -> Dict[str, Any]:
        """
        Enhanced frame analysis using research paper methodology.
        Includes:
        - Basic proctoring analysis (face, gaze, environment)
        - Object detection (YOLO)
        - Weighted anomaly scoring (S_total = α·S_face + β·S_gaze + γ·S_object)
        
        Args:
            image_np: Frame to analyze
            
        Returns:
            Dict with comprehensive analysis including anomaly scores
        """
        # Run basic analysis
        basic_results = self.analyze_frame(image_np)
        
        # Initialize enhanced results
        enhanced_results = {
            **basic_results,  # Include all basic results
            "anomaly_scoring": {
                "enabled": self.anomaly_scorer is not None,
                "S_total": 0.0,
                "S_face": 0.0,
                "S_gaze": 0.0,
                "S_object": 0.0,
                "alert_level": "LOW",
                "risk_category": "normal_behavior"
            },
            "object_detection": {
                "enabled": self.object_detector is not None,
                "violations": [],
                "detected_objects": []
            }
        }
        
        # Object Detection
        if self.object_detector is not None:
            try:
                obj_results = self.object_detector.detect_objects(image_np)
                enhanced_results["object_detection"] = {
                    "enabled": True,
                    **obj_results
                }
            except Exception as e:
                print(f"Object detection error: {e}")
                enhanced_results["object_detection"]["error"] = str(e)
        
        # Anomaly Scoring
        if self.anomaly_scorer is not None:
            try:
                # Prepare face analysis data
                face_analysis = {
                    "face_count": basic_results.get("face_count", 0),
                    "similarity": None  # TODO: Add face verification similarity
                }
                
                # Prepare gaze analysis data  
                gaze_analysis = {
                    "x_angle": 0,  # Extract from basic_results if available
                    "y_angle": 0,
                    "warnings": basic_results.get("warnings", [])
                }
                
                # Get object detection results
                object_detection = enhanced_results["object_detection"]
                
                # Compute comprehensive anomaly score
                score_result = self.anomaly_scorer.analyze_comprehensive(
                    face_analysis,
                    gaze_analysis,
                    object_detection
                )
                
                enhanced_results["anomaly_scoring"] = {
                    "enabled": True,
                    **score_result
                }
                
                # Add recommendation
                enhanced_results["recommendation"] = self.anomaly_scorer.get_recommendation(score_result)
                enhanced_results["should_alert"] = self.anomaly_scorer.should_trigger_alert(score_result)
                
            except Exception as e:
                print(f"Anomaly scoring error: {e}")
                enhanced_results["anomaly_scoring"]["error"] = str(e)
        
        return enhanced_results
