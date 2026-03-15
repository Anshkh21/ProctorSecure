# ProctorSecure - Advanced AI Proctoring Tool

ProctorSecure is a state-of-the-art, AI-powered remote proctoring solution designed to ensure the integrity of online exams. It leverages advanced machine learning models for real-time monitoring, identity verification, and environment analysis, providing a secure and scalable platform for educational institutions and certification bodies.

## 🚀 Key Features

### 🧠 AI-Powered Monitoring
*   **Object Detection:** Real-time detection of prohibited items such as **cell phones, laptops, and books** using TensorFlow.js (COCO-SSD) to prevent cheating.
*   **Identity Verification:** Robust biometric verification using **DeepFace** to match the student's live face against their ID card with high accuracy.
*   **Face Detection:** Continuous monitoring to ensure the registered student is present and alone during the exam.
*   **Gaze Tracking:** (Planned) Analysis of eye movements to detect suspicious behavior.
*   **Audio Monitoring:** Detection of suspicious audio levels and background voices.

### 🔒 comprehensive Security
*   **Browser Lockdown:** Aggressive **Fullscreen Enforcement** with a visual blocking overlay if the user exits fullscreen mode.
*   **Anti-Cheat Measures:**
    *   **Tab Switching Detection:** Alerts and logs incidents when the user leaves the exam tab.
    *   **Copy/Paste Prevention:** Disables clipboard shortcuts (Copy, Cut, Paste) and context menus.
    *   **DevTools Detection:** (Planned) Prevents inspection of the exam interface.

### 📊 Dashboard & Analytics
*   **Proctor Dashboard:** Real-time view of all active sessions, live video feeds, and flagged incidents.
*   **Incident Logging:** Detailed logs of all security violations with timestamps and evidence snapshots.
*   **Student Dashboard:** Clean, intuitive interface for students to register, verify identity, and take exams.

## 🛠 Tech Stack

### Frontend
*   **Framework:** React 19
*   **Styling:** Tailwind CSS, Radix UI (shadcn/ui)
*   **State Management:** React Hooks
*   **AI/ML:** TensorFlow.js (`@tensorflow/tfjs`, `@tensorflow-models/coco-ssd`)
*   **Routing:** React Router v7

### Backend
*   **Framework:** FastAPI (Python)
*   **Database:** MongoDB (Motor Async Driver)
*   **ML Libraries:**
    *   `DeepFace` (Face Verification)
    *   `MediaPipe` (Face Detection)
    *   `OpenCV` (Image Processing)
    *   `TensorFlow/Keras` (Deep Learning Backend)
*   **Authentication:** JWT (JSON Web Tokens) with BCrypt hashing

## 📦 Installation

### Prerequisites
*   Node.js (v16+)
*   Python (v3.9+)
*   MongoDB (Local or Atlas)

### 1. Clone the Repository
```bash
git clone https://github.com/Anshkh21/ProctorSecure.git
cd ProctorSecure
```

### 2. Backend Setup
Navigate to the backend directory and set up the Python environment.

```bash
cd backend
python -m venv venv
# Windows
.\venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
```

**Environment Variables:**
Create a `.env` file in the `backend/` directory:
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=proctor_db
SECRET_KEY=your_super_secret_key_change_this_in_production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
CORS_ORIGINS=http://localhost:3000
```

**Run the Backend:**
```bash
uvicorn server:app --reload
```
The API will be available at `http://localhost:8000`.

### 3. Frontend Setup
Navigate to the frontend directory and install dependencies.

```bash
cd ../frontend
npm install
```

**Run the Frontend:**
```bash
npm start
```
The application will be available at `http://localhost:3000`.

## 📖 Usage

1.  **Register:** Create a student account.
2.  **Login:** Access the dashboard.
3.  **Identity Verification:**
    *   Upload a clear photo of your **Government ID**.
    *   Allow camera access to capture your **Live Face**.
    *   The system will verify your identity.
4.  **Take Exam:**
    *   Select an available exam.
    *   Enter **Fullscreen Mode** (Required).
    *   The exam interface will load, and monitoring will begin.
    *   **Note:** Exiting fullscreen or using other apps will trigger warnings.

## 🤝 Contributing

Contributions are welcome! Please fork the repository and submit a pull request for review.

## 📄 License

**Copyright (c) 2026 Ansh Khatod. All Rights Reserved.**

This project and its original source code are proprietary and confidential. No part of this software may be copied, reproduced, distributed, or adapted in any form or by any means without the prior written permission of the copyright owner.

You are permitted to view the source code and submit pull requests to suggest changes, but you may not use this code in your own projects, whether commercial or non-commercial.
