# ProctorSecure - Advanced AI Remote Proctoring & Online Exam Security Tool

ProctorSecure is a state-of-the-art, **AI-powered remote proctoring solution** designed to ensure the integrity of online exams and assessments. It leverages advanced machine learning models for real-time monitoring, automated identity verification, and anti-cheating environment analysis, providing a secure, scalable, and automated proctoring platform for educational institutions, universities, and certification bodies.

## 🚀 Key Features & Capabilities

### 🧠 AI proctoring & Automated Monitoring
*   **Real-Time Object Detection:** Automated detection of prohibited items such as **cell phones, laptops, and books** using TensorFlow.js (COCO-SSD) to prevent cheating during online tests.
*   **Biometric Identity Verification:** Robust facial recognition and identity verification using **DeepFace** to match the student's live webcam feed against their official ID card with high accuracy.
*   **Continuous Face Detection:** Live webcam monitoring to ensure the registered student is present, focused, and alone during the entire exam session.
*   **Gaze Tracking & Eye Movement Analysis:** (Planned) Advanced tracking to detect suspicious behavior and off-screen looking.
*   **Automated Audio Monitoring:** Detection of suspicious audio levels, background voices, and unauthorized communication.

### 🔒 Comprehensive Exam Security & Anti-Cheat System
*   **Secure Browser Lockdown:** Aggressive **Fullscreen Enforcement** with a visual blocking overlay if the user attempts to exit fullscreen mode.
*   **Tab Switching & Navigation Detection:** Alerts and automatically logs incidents when the test-taker leaves the active exam tab.
*   **Copy/Paste & Shortcut Prevention:** Disables clipboard shortcuts (Copy, Cut, Paste) and right-click context menus to prevent content theft.
*   **DevTools Detection:** (Planned) Prevents inspection or manipulation of the online exam interface.

### 📊 Proctor Dashboard & Incident Analytics
*   **Live Proctor Dashboard:** Real-time, centralized view of all active test sessions, live video feeds, and automatically flagged suspicious activities.
*   **Detailed Incident Logging:** Comprehensive logs of all security violations, cheating attempts, with timestamped evidence snapshots.
*   **Student portal:** Clean, intuitive interface for students to register, verify identity (KYC), and take secure exams.

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

You may fork this repository **only** to submit pull requests (suggested changes) back to the original repository. Forking for any other purpose, including using this code in your own projects, is strictly prohibited.

## 📄 License

**© 2024–2026 Ansh Khatod. All Rights Reserved.**

This software and all associated source code, designs, ideas, concepts, and documentation are the **exclusive intellectual property of Ansh Khatod** and are protected under copyright law.

> **This is NOT open-source software.**

**You MAY:**
- View the source code for reference only.
- Submit pull requests to suggest changes back to this repository.

**You MAY NOT:**
- Copy, reproduce, or use any part of this code in your own projects.
- Modify, distribute, sell, or create derivative works from this software.
- Claim ownership of any idea, design, or implementation found here.

Any unauthorized use will be prosecuted to the fullest extent of applicable law.
See the [LICENSE](./LICENSE) file for full terms.
