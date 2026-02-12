import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "./components/ui/toaster";
import LandingPage from "./components/LandingPage";
import Register from "./components/Register";
import StudentDashboard from "./components/StudentDashboard";
import ExamInterface from "./components/ExamInterface";
import ProctorDashboard from "./components/ProctorDashboard";
import AdminDashboard from "./components/AdminDashboard";
import IdentityVerification from "./components/IdentityVerification";
import CreateExam from "./components/CreateExam";

function App() {
  return (
    <div className="App min-h-screen bg-gray-50">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/register" element={<Register />} />
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/exam/:examId" element={<ExamInterface />} />
          <Route path="/verify" element={<IdentityVerification />} />
          <Route path="/proctor" element={<ProctorDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/create-exam" element={<CreateExam />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </div>
  );
}

export default App;