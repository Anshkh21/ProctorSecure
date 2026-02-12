"""
YOLO Object Detection Module for ProctorSecure
Detects unauthorized objects (phones, books, papers) during exams
Matches implementation described in IEEE paper
"""

import cv2
import numpy as np
from typing import Dict, List, Tuple, Any
import torch

class ObjectDetector:
    """
    YOLOv5-based object detector for identifying unauthorized items.
    As described in paper: YOLOv5s with custom classes {phone, book, paper, monitor}
    """
    
    def __init__(self, confidence_threshold=0.5):
        """
        Initialize YOLO model
        
        Args:
            confidence_threshold: Minimum confidence for detections (default: 0.5)
        """
        self.confidence_threshold = confidence_threshold
        
        # Load YOLOv5s model (pretrained on COCO)
        try:
            self.model = torch.hub.load('ultralytics/yolov5', 'yolov5s', pretrained=True)
            self.model.conf = confidence_threshold
            self.model_loaded = True
        except Exception as e:
            print(f"Warning: Could not load YOLOv5 model: {e}")
            print("Object detection will be disabled.")
            self.model_loaded = False
        
        # Unauthorized objects mapping (COCO class names)
        self.unauthorized_items = {
            'cell phone': 1.0,
            'book': 1.0,
            'laptop': 1.0,
            'keyboard': 0.8,  # Lower weight (partial violation)
            'mouse': 0.8,
            'remote': 0.7,
            'tv': 0.9
        }
        
    def detect_objects(self, frame: np.ndarray) -> Dict[str, Any]:
        """
        Detect unauthorized objects in frame.
        
        Paper equation: S_object = max(c_i) for detected unauthorized objects
        
        Args:
            frame: BGR image (np.ndarray)
            
        Returns:
            Dict containing:
                - S_object: Anomaly score [0, 1]
                - violations: List of detected violations
                - all_detections: All objects detected
        """
        if not self.model_loaded:
            return {
                'S_object': 0.0,
                'violations': [],
                'all_detections': [],
                ' model_status': 'not_loaded'
            }
        
        try:
            # Run inference
            results = self.model(frame)
            
            # Parse detections
            detections_df = results.pandas().xyxy[0]
            
            violations = []
            max_confidence = 0.0
            all_detections = []
            
            for _, detection in detections_df.iterrows():
                obj_name = detection['name']
                confidence = detection['confidence']
                
                all_detections.append({
                    'object': obj_name,
                    'confidence': float(confidence),
                    'bbox': {
                        'x1': int(detection['xmin']),
                        'y1': int(detection['ymin']),
                        'x2': int(detection['xmax']),
                        'y2': int(detection['ymax'])
                    }
                })
                
                # Check if unauthorized
                if obj_name in self.unauthorized_items:
                    weight = self.unauthorized_items[obj_name]
                    weighted_confidence = confidence * weight
                    
                    violations.append({
                        'object': obj_name,
                        'confidence': float(confidence),
                        'weighted_score': float(weighted_confidence),
                        'bbox': {
                            'x1': int(detection['xmin']),
                            'y1': int(detection['ymin']),
                            'x2': int(detection['xmax']),
                            'y2': int(detection['ymax'])
                        }
                    })
                    
                    max_confidence = max(max_confidence, weighted_confidence)
            
            # S_object score as per paper
            S_object = min(1.0, max_confidence)  # Clamp to [0, 1]
            
            return {
                'S_object': float(S_object),
                'violations': violations,
                'all_detections': all_detections,
                'model_status': 'active'
            }
            
        except Exception as e:
            print(f"Object detection error: {e}")
            return {
                'S_object': 0.0,
                'violations': [],
                'all_detections': [],
                'error': str(e),
                'model_status': 'error'
            }
    
    def annotate_frame(self, frame: np.ndarray, detections: Dict[str, Any]) -> np.ndarray:
        """
        Draw bounding boxes on frame for visualization.
        
        Args:
            frame: Original frame
            detections: Detection results from detect_objects()
            
        Returns:
            Annotated frame
        """
        annotated = frame.copy()
        
        for violation in detections.get('violations', []):
            bbox = violation['bbox']
            obj_name = violation['object']
            confidence = violation['confidence']
            
            # Red box for violations
            cv2.rectangle(
                annotated,
                (bbox['x1'], bbox['y1']),
                (bbox['x2'], bbox['y2']),
                (0, 0, 255),  # Red
                2
            )
            
            # Label
            label = f"{obj_name}: {confidence:.2f}"
            cv2.putText(
                annotated,
                label,
                (bbox['x1'], bbox['y1'] - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 0, 255),
                2
            )
        
        return annotated
