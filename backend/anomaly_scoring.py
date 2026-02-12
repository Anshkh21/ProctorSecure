"""
Multi-Modal Anomaly Scoring Engine for ProctorSecure
Implements weighted fusion scoring as described in IEEE paper:
S_total(t) = α·S_face(t) + β·S_gaze(t) + γ·S_object(t)

Optimized weights from cross-validation: α=0.4, β=0.3, γ=0.3
"""

import time
from typing import Dict, Any
import numpy as np

class AnomalyScoringEngine:
    """
    Multi-modal anomaly scoring with cross-validated weights.
    Combines face verification, gaze tracking, and object detection scores.
    """
    
    def __init__(self, alpha=0.4, beta=0.3, gamma=0.3):
        """
        Initialize scoring engine with weights.
        
        Args:
            alpha: Face verification weight (default: 0.4 from paper)
            beta: Gaze tracking weight (default: 0.3 from paper)
            gamma: Object detection weight (default: 0.3 from paper)
        """
        # Validate weights sum to 1
        weight_sum = alpha + beta + gamma
        if not np.isclose(weight_sum, 1.0):
            raise ValueError(f"Weights must sum to 1.0, got {weight_sum}")
        
        self.alpha = alpha
        self.beta = beta
        self.gamma = gamma
        
        # Alert thresholds (from paper evaluation)
        self.thresholds = {
            'high': 0.7,     # High risk
            'medium': 0.4,   # Medium risk
            'low': 0.0       # Low risk
        }
        
    def compute_face_score(self, face_analysis: Dict[str, Any]) -> float:
        """
        Compute S_face from face analysis results.
        
        Score components:
        - No face detected: 1.0
        - Multiple faces: 0.8
        - Face similarity < threshold: 0.6
        - Single face verified: 0.0
        
        Args:
            face_analysis: Dict with 'face_count' and optionally 'similarity'
            
        Returns:
            S_face score [0, 1]
        """
        face_count = face_analysis.get('face_count', 0)
        similarity = face_analysis.get('similarity', None)
        
        if face_count == 0:
            return 1.0  # No face = highest violation
        elif face_count > 1:
            return 0.8  # Multiple faces = high violation
        elif similarity is not None and similarity < 0.6:
            return 0.6  # Low similarity = medium violation
        else:
            return 0.0  # Verified face = no violation
    
    def compute_gaze_score(self, gaze_analysis: Dict[str, Any]) -> float:
        """
        Compute S_gaze from gaze tracking results.
        
        Paper equation: S_gaze = I(|θ| > 15°) · (1 - λ·e^(-(t-t0)))
        Simplified: Score based on angle deviation
        
        Args:
            gaze_analysis: Dict with 'x_angle', 'y_angle', and 'warnings'
            
        Returns:
            S_gaze score [0, 1]
        """
        x_angle = gaze_analysis.get('x_angle', 0)
        y_angle = gaze_analysis.get('y_angle', 0)
        warnings = gaze_analysis.get('warnings', [])
        
        # Calculate total deviation angle
        theta = np.sqrt(x_angle**2 + y_angle**2)
        
        if abs(theta) > 15:  # Threshold from paper
            # Normalize to [0, 1], with 50° being max deviation
            S_gaze = min(1.0, abs(theta) / 50.0)
        else:
            S_gaze = 0.0
        
        # Additional penalties for specific warnings
        gaze_warnings = [w for w in warnings if 'gaze' in w.lower() or 'looking' in w.lower()]
        if len(gaze_warnings) > 0:
            S_gaze = max(S_gaze, 0.5)  # Minimum medium score if gaze warning
        
        return float(S_gaze)
    
    def compute_total_score(self, S_face: float, S_gaze: float, S_object: float) -> Dict[str, Any]:
        """
        Compute aggregated anomaly score using weighted fusion.
        
        Paper equation: S_total(t) = α·S_face + β·S_gaze + γ·S_object
        
        Args:
            S_face: Face verification score [0, 1]
            S_gaze: Gaze tracking score [0, 1]
            S_object: Object detection score [0, 1]
            
        Returns:
            Dict containing:
                - S_total: Weighted total score
                - S_face, S_gaze, S_object: Component scores
                - alert_level: LOW/MEDIUM/HIGH
                - risk_category: Classification
                - timestamp: Unix timestamp
        """
        # Compute weighted score
        S_total = (self.alpha * S_face + 
                   self.beta * S_gaze + 
                   self.gamma * S_object)
        
        # Determine alert level
        if S_total >= self.thresholds['high']:
            alert_level = "HIGH"
            risk_category = "cheating_likely"
        elif S_total >= self.thresholds['medium']:
            alert_level = "MEDIUM"
            risk_category = "suspicious_activity"
        else:
            alert_level = "LOW"
            risk_category = "normal_behavior"
        
        return {
            'S_total': float(S_total),
            'S_face': float(S_face),
            'S_gaze': float(S_gaze),
            'S_object': float(S_object),
            'alert_level': alert_level,
            'risk_category': risk_category,
            'weights': {
                'alpha': self.alpha,
                'beta': self.beta,
                'gamma': self.gamma
            },
            'timestamp': time.time()
        }
    
    def analyze_comprehensive(self, 
                            face_analysis: Dict[str, Any],
                            gaze_analysis: Dict[str, Any],
                            object_detection: Dict[str, Any]) -> Dict[str, Any]:
        """
        Perform comprehensive multi-modal analysis.
        
        Args:
            face_analysis: Results from face verification module
            gaze_analysis: Results from gaze tracking module  
            object_detection: Results from object detector
            
        Returns:
            Complete anomaly score breakdown
        """
        # Compute component scores
        S_face = self.compute_face_score(face_analysis)
        S_gaze = self.compute_gaze_score(gaze_analysis)
        S_object = object_detection.get('S_object', 0.0)
        
        # Compute total score
        score_result = self.compute_total_score(S_face, S_gaze, S_object)
        
        # Add detailed breakdown
        score_result['details'] = {
            'face': {
                'score': S_face,
                'face_count': face_analysis.get('face_count', 0),
                'similarity': face_analysis.get('similarity'),
                'reason': self._get_face_reason(face_analysis, S_face)
            },
            'gaze': {
                'score': S_gaze,
                'x_angle': gaze_analysis.get('x_angle', 0),
                'y_angle': gaze_analysis.get('y_angle', 0),
                'deviation': np.sqrt(gaze_analysis.get('x_angle', 0)**2 + 
                                   gaze_analysis.get('y_angle', 0)**2),
                'warnings': gaze_analysis.get('warnings', [])
            },
            'objects': {
                'score': S_object,
                'violations': object_detection.get('violations', []),
                'detected_count': len(object_detection.get('violations', []))
            }
        }
        
        return score_result
    
    def _get_face_reason(self, face_analysis: Dict, score: float) -> str:
        """Get human-readable reason for face score"""
        face_count = face_analysis.get('face_count', 0)
        
        if face_count == 0:
            return "No face detected"
        elif face_count > 1:
            return f"Multiple faces detected ({face_count})"
        elif score > 0.5:
            return "Face verification failed"
        else:
            return "Face verified successfully"
    
    def get_recommendation(self, score_result: Dict[str, Any]) -> str:
        """
        Get recommended action based on score.
        
        Args:
            score_result: Result from compute_total_score()
            
        Returns:
            Recommended action string
        """
        alert_level = score_result['alert_level']
        
        recommendations = {
            'HIGH': "Immediate intervention required. Proctor should review session and contact student.",
            'MEDIUM': "Monitor closely. Flag for proctor review. May require intervention.",
            'LOW': "Normal activity. Continue monitoring."
        }
        
        return recommendations.get(alert_level, "Continue monitoring")
    
    def should_trigger_alert(self, score_result: Dict[str, Any]) -> bool:
        """
        Determine if alert should be triggered.
        
        Args:
            score_result: Result from compute_total_score()
            
        Returns:
            True if alert should be sent to proctor
        """
        return score_result['alert_level'] in ['HIGH', 'MEDIUM']


# Cross-validation weight optimization (for future use)
class WeightOptimizer:
    """
    Optimize α, β, γ weights via cross-validation.
    As described in paper: Grid search over [0.1, 0.8] with step 0.1
    """
    
    def __init__(self):
        self.best_weights = None
        self.best_f1 = 0.0
    
    def grid_search(self, validation_data: list, step=0.1):
        """
        Perform grid search for optimal weights.
        
        Args:
            validation_data: List of dicts with ground truth labels
            step: Grid search step size
            
        Returns:
            Dict with best weights and F1 score
        """
        best_alpha, best_beta, best_gamma = 0.4, 0.3, 0.3
        best_f1 = 0.0
        
        # Grid search
        for alpha in np.arange(0.1, 0.9, step):
            for beta in np.arange(0.1, 0.9, step):
                gamma = 1.0 - alpha - beta
                
                if gamma < 0.1 or gamma > 0.8:
                    continue
                
                # Evaluate with these weights
                engine = AnomalyScoringEngine(alpha, beta, gamma)
                f1 = self._evaluate_f1(engine, validation_data)
                
                if f1 > best_f1:
                    best_f1 = f1
                    best_alpha, best_beta, best_gamma = alpha, beta, gamma
        
        return {
            'alpha': best_alpha,
            'beta': best_beta,
            'gamma': best_gamma,
            'f1_score': best_f1
        }
    
    def _evaluate_f1(self, engine: AnomalyScoringEngine, data: list) -> float:
        """Compute F1 score for validation data"""
        # Simplified - would need actual ground truth labels
        # Placeholder for future implementation
        return 0.95
