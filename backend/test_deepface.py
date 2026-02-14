import sys
import os
import cv2
import numpy as np

# Add current directory to path so we can import ml_models
sys.path.append(os.getcwd())

try:
    from ml_models import ProctoringModel
    print("✅ Successfully imported ProctoringModel")
    
    model = ProctoringModel()
    print("✅ Successfully initialized ProctoringModel")
    
    # Check DeepFace availability
    try:
        from deepface import DeepFace
        print(f"✅ DeepFace imported successfully. Version: {DeepFace.__version__ if hasattr(DeepFace, '__version__') else 'Unknown'}")
    except ImportError:
        print("❌ DeepFace NOT found")
        
    # Create a dummy image (black image)
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # Test verify_identity (should fail on black image, but run without error)
    result = model.verify_identity(img, None)
    print(f"✅ verify_identity ran successfully. Result (expected False): {result}")

except Exception as e:
    print(f"❌ Error during verification: {e}")
    import traceback
    traceback.print_exc()
