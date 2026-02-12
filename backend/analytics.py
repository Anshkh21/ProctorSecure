"""
Analytics and Metrics Tracking for ProctorSecure
Tracks Precision, Recall, F1-score, Confusion Matrix as described in IEEE paper
"""

from typing import Dict, List, Any, Optional
from datetime import datetime
import numpy as np

class ProctorAnalytics:
    """
    Analytics engine for computing proctoring performance metrics.
    Tracks detection accuracy, false positives, and generates confusion matrices.
    """
    
    def __init__(self, db_connection):
        """
        Initialize analytics engine.
        
        Args:
            db_connection: MongoDB database connection
        """
        self.db = db_connection
        
    async def log_detection(self, 
                          session_id: str,
                          prediction: str,
                          ground_truth: Optional[str] = None,
                          anomaly_score: Dict[str, Any] = None) -> bool:
        """
        Log a detection event for later evaluation.
        
        Args:
            session_id: Exam session ID
            prediction: 'cheating' or 'normal'
            ground_truth: Optional ground truth label for validation
            anomaly_score: Full anomaly scoring result
            
        Returns:
            True if logged successfully
        """
        try:
            detection_log = {
                'session_id': session_id,
                'prediction': prediction,
                'ground_truth': ground_truth,
                'anomaly_score': anomaly_score,
                'timestamp': datetime.utcnow()
            }
            
            await self.db.detection_logs.insert_one(detection_log)
            return True
            
        except Exception as e:
            print(f"Error logging detection: {e}")
            return False
    
    async def log_session_metrics(self,
                                 session_id: str,
                                 anomaly_scores: List[Dict[str, Any]]) -> bool:
        """
        Log all anomaly scores for a session.
        
        Args:
            session_id: Exam session ID
            anomaly_scores: List of all anomaly score results
            
        Returns:
            True if logged successfully
        """
        try:
            # Update session with anomaly scores
            await  self.db.exam_sessions.update_one(
                {'session_id': session_id},
                {
                    '$set': {
                        'anomaly_scores': anomaly_scores,
                        'max_score': max([s.get('S_total', 0) for s in anomaly_scores] + [0]),
                        'avg_score': np.mean([s.get('S_total', 0) for s in anomaly_scores]) if anomaly_scores else 0,
                        'high_alerts': sum(1 for s in anomaly_scores if s.get('alert_level') == 'HIGH'),
                        'medium_alerts': sum(1 for s in anomaly_scores if s.get('alert_level') == 'MEDIUM'),
                        'metrics_updated_at': datetime.utcnow()
                    }
                }
            )
            return True
            
        except Exception as e:
            print(f"Error logging session metrics: {e}")
            return False
    
    async def compute_confusion_matrix(self, 
                                      start_date: Optional[datetime] = None,
                                      end_date: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Compute confusion matrix for detections within date range.
        
        Paper metrics:
        - True Positive (TP): Correctly flagged cheating
        - False Positive (FP): Incorrectly flagged normal as cheating
        - True Negative (TN): Correctly identified normal behavior
        - False Negative (FN): Missed cheating
        
        Args:
            start_date: Optional start date filter
            end_date: Optional end date filter
            
        Returns:
            Dict with confusion matrix and derived metrics
        """
        try:
            # Build query
            query = {}
            if start_date or end_date:
                query['timestamp'] = {}
                if start_date:
                    query['timestamp']['$gte'] = start_date
                if end_date:
                    query['timestamp']['$lte'] = end_date
            
            # Only include logs with ground truth
            query['ground_truth'] = {'$ne': None}
            
            # Fetch detection logs
            logs = await self.db.detection_logs.find(query).to_list(None)
            
            # Compute confusion matrix
            TP = sum(1 for log in logs if log['prediction'] == 'cheating' and log['ground_truth'] == 'cheating')
            FP = sum(1 for log in logs if log['prediction'] == 'cheating' and log['ground_truth'] == 'normal')
            TN = sum(1 for log in logs if log['prediction'] == 'normal' and log['ground_truth'] == 'normal')
            FN = sum(1 for log in logs if log['prediction'] == 'normal' and log['ground_truth'] == 'cheating')
            
            # Compute metrics
            precision = TP / (TP + FP) if (TP + FP) > 0 else 0
            recall = TP / (TP + FN) if (TP + FN) > 0 else 0
            f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
            accuracy = (TP + TN) / (TP + FP + TN + FN) if (TP + FP + TN + FN) > 0 else 0
            
            # Specificity (True Negative Rate)
            specificity = TN / (TN + FP) if (TN + FP) > 0 else 0
            
            return {
                'confusion_matrix': {
                    'TP': TP,
                    'FP': FP,
                    'TN': TN,
                    'FN': FN
                },
                'metrics': {
                    'precision': round(precision, 4),
                    'recall': round(recall, 4),
                    'f1_score': round(f1_score, 4),
                    'accuracy': round(accuracy, 4),
                    'specificity': round(specificity, 4)
                },
                'sample_size': TP + FP + TN + FN,
                'computed_at': datetime.utcnow()
            }
            
        except Exception as e:
            print(f"Error computing confusion matrix: {e}")
            return {
                'error': str(e),
                'confusion_matrix': {'TP': 0, 'FP': 0, 'TN': 0, 'FN': 0},
                'metrics': {'precision': 0, 'recall': 0, 'f1_score': 0, 'accuracy': 0}
            }
    
    async def get_per_attack_performance(self) -> Dict[str, Dict[str, float]]:
        """
        Get performance metrics broken down by attack type.
        
        Paper reports:
        - Impersonation: F1=0.97
        - Object Misuse: F1=0.93
        - Gaze Anomaly: F1=0.90
        - Collusion: F1=0.84
        
        Returns:
            Dict mapping attack type to metrics
        """
        try:
            logs = await self.db.detection_logs.find({'ground_truth': {'$ne': None}}).to_list(None)
            
            attack_types = ['impersonation', 'object_misuse', 'gaze_anomaly', 'collusion', 'normal']
            results = {}
            
            for attack_type in attack_types:
                # Filter logs for this attack type
                relevant_logs = [log for log in logs if log.get('attack_type') == attack_type or 
                                (attack_type == 'normal' and log.get('ground_truth') == 'normal')]
                
                if not relevant_logs:
                    continue
                
                # Compute metrics for this type
                TP = sum(1 for log in relevant_logs if log['prediction'] == 'cheating' and log['ground_truth'] == 'cheating')
                FP = sum(1 for log in relevant_logs if log['prediction'] == 'cheating' and log['ground_truth'] == 'normal')
                TN = sum(1 for log in relevant_logs if log['prediction'] == 'normal' and log['ground_truth'] == 'normal')
                FN = sum(1 for log in relevant_logs if log['prediction'] == 'normal' and log['ground_truth'] == 'cheating')
                
                precision = TP / (TP + FP) if (TP + FP) > 0 else 0
                recall = TP / (TP + FN) if (TP + FN) > 0 else 0
                f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
                
                results[attack_type] = {
                    'precision': round(precision, 4),
                    'recall': round(recall, 4),
                    'f1_score': round(f1, 4),
                    'sample_count': len(relevant_logs)
                }
            
            return results
            
        except Exception as e:
            print(f"Error computing per-attack performance: {e}")
            return {}
    
    async def get_session_summary(self, session_id: str) -> Dict[str, Any]:
        """
        Get comprehensive analytics summary for a session.
        
        Args:
            session_id: Exam session ID
            
        Returns:
            Dict with session metrics and statistics
        """
        try:
            session = await self.db.exam_sessions.find_one({'session_id': session_id})
            
            if not session:
                return {'error': 'Session not found'}
            
            anomaly_scores = session.get('anomaly_scores', [])
            
            if not anomaly_scores:
                return {
                    'session_id': session_id,
                    'total_frames': 0,
                    'message': 'No anomaly scores recorded'
                }
            
            # Compute statistics
            S_totals = [s['S_total'] for s in anomaly_scores]
            
            return {
                'session_id': session_id,
                'total_frames': len(anomaly_scores),
                'max_score': round(max(S_totals), 4),
                'avg_score': round(np.mean(S_totals), 4),
                'min_score': round(min(S_totals), 4),
                'std_dev': round(np.std(S_totals), 4),
                'alert_breakdown': {
                    'HIGH': sum(1 for s in anomaly_scores if s.get('alert_level') == 'HIGH'),
                    'MEDIUM': sum(1 for s in anomaly_scores if s.get('alert_level') == 'MEDIUM'),
                    'LOW': sum(1 for s in anomaly_scores if s.get('alert_level') == 'LOW')
                },
                'violations': {
                    'face_violations': sum(1 for s in anomaly_scores if s.get('S_face', 0) > 0.5),
                    'gaze_violations': sum(1 for s in anomaly_scores if s.get('S_gaze', 0) > 0.5),
                    'object_violations': sum(1 for s in anomaly_scores if s.get('S_object', 0) > 0.5)
                }
            }
            
        except Exception as e:
            print(f"Error getting session summary: {e}")
            return {'error': str(e)}
    
    async def export_metrics_report(self) -> Dict[str, Any]:
        """
        Generate comprehensive metrics report matching paper format.
        
        Returns:
            Full report with all metrics for admin dashboard
        """
        confusion = await self.compute_confusion_matrix()
        per_attack = await self.get_per_attack_performance()
        
        return {
            'overall_performance': confusion['metrics'],
            'confusion_matrix': confusion['confusion_matrix'],
            'per_attack_type': per_attack,
            'sample_size': confusion['sample_size'],
            'generated_at': datetime.utcnow().isoformat()
        }
