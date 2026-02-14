import mediapipe as mp
print(f"MediaPipe version: {mp.__version__}")
try:
    print(f"mp.solutions: {mp.solutions}")
    print(f"mp.solutions.face_mesh: {mp.solutions.face_mesh}")
    print("✅ MediaPipe structure seems correct")
except AttributeError as e:
    print(f"❌ MediaPipe AttributeError: {e}")
except Exception as e:
    print(f"❌ MediaPipe Error: {e}")
