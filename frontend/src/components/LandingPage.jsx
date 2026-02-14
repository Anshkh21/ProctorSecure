import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, Lock, Users, Monitor, CheckCircle, ArrowRight, BookOpen, GraduationCap } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const LandingPage = () => {
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (role) => {
    if (!loginData.email || !loginData.password) {
      toast({
        title: "Error",
        description: "Please enter email and password",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await axios.post(`${API}/auth/login`, {
        email: loginData.email,
        password: loginData.password,
        role: role
      });

      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      toast({
        title: "Success",
        description: `Welcome back, ${user.name}!`,
      });

      if (role === 'student') navigate('/student');
      else if (role === 'proctor') navigate('/proctor');
      else if (role === 'admin') navigate('/admin');
      
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = "Login failed. Please try again.";
      if (error.response?.status === 401) {
        errorMessage = "Invalid credentials. Please check your email and password.";
      } else if (error.response?.status === 404) {
        errorMessage = "User not found. Please check your email and role.";
      }
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    {
      icon: <Shield className="w-6 h-6 text-blue-500" />,
      title: "Bank-Grade Security",
      description: "Advanced encryption and secure protocols ensure exam integrity is never compromised."
    },
    {
      icon: <Eye className="w-6 h-6 text-indigo-500" />,
      title: "AI Proctoring",
      description: "Smart monitoring detects suspicious behavior in real-time using computer vision."
    },
    {
      icon: <Lock className="w-6 h-6 text-purple-500" />,
      title: "Identity Verification", 
      description: "Multi-factor authentication with facial recognition for fail-safe student identification."
    },
    {
      icon: <Users className="w-6 h-6 text-pink-500" />,
      title: "Seamless Scalability",
      description: "Built to handle thousands of concurrent users without compromising performance."
    },
    {
      icon: <Monitor className="w-6 h-6 text-orange-500" />,
      title: "Device Agnostic",
      description: "Compatible with all major browsers and operating systems. No plugins required."
    },
    {
      icon: <CheckCircle className="w-6 h-6 text-teal-500" />,
      title: "Instant Analytics",
      description: "Get detailed reports and insights immediately after exam completion."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-blue-100">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700">
                ProctorSecure
              </span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">How it Works</a>
              <Button variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
                Contact Sales
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-12 lg:pt-32 lg:pb-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100 via-slate-50 to-white -z-10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            
            {/* Hero Content */}
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-sm font-medium">
                <span className="flex h-2 w-2 rounded-full bg-blue-600 mr-2 animate-pulse"></span>
                Secure • Reliable • Intelligent
              </div>
              
              <h1 className="text-5xl lg:text-7xl font-extrabold text-slate-900 tracking-tight leading-[1.1]">
                Exams without <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                  Compromise.
                </span>
              </h1>
              
              <p className="text-xl text-slate-600 leading-relaxed max-w-xl">
                The most secure, AI-driven proctoring platform designed to maintain academic integrity while delivering a stress-free experience for students.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="text-base px-8 h-12 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200/50 transition-all hover:scale-105">
                  Get Started
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
                <Button variant="outline" size="lg" className="text-base px-8 h-12 border-slate-200 hover:bg-white hover:text-blue-700 transition-all">
                  Learn More
                </Button>
              </div>
            </div>
            
            {/* Login Card */}
            <div className="lg:pl-8 animate-in fade-in slide-in-from-right-8 duration-1000 delay-200">
              <Card className="border-0 shadow-2xl shadow-blue-100/50 bg-white/70 backdrop-blur-xl ring-1 ring-white/50">
                <CardHeader className="space-y-1 text-center pb-8">
                  <div className="mx-auto w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 text-blue-600">
                    <Lock className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
                  <CardDescription>Enter your credentials to access the portal</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="student" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-6 p-1 bg-slate-100/80">
                      <TabsTrigger value="student" className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">Student</TabsTrigger>
                      <TabsTrigger value="proctor" className="data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm">Proctor</TabsTrigger>
                      <TabsTrigger value="admin" className="data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm">Admin</TabsTrigger>
                    </TabsList>

                    {['student', 'proctor', 'admin'].map((role) => (
                      <TabsContent key={role} value={role} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor={`${role}-email`}>Email Address</Label>
                          <Input
                            id={`${role}-email`}
                            type="email"
                            placeholder={`${role}@university.edu`}
                            className="bg-white/50 border-slate-200 focus:ring-blue-500"
                            value={loginData.email}
                            onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`${role}-password`}>Password</Label>
                          <Input
                            id={`${role}-password`}
                            type="password"
                            placeholder="••••••••"
                            className="bg-white/50 border-slate-200 focus:ring-blue-500"
                            value={loginData.password}
                            onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                          />
                        </div>
                        <Button 
                          className={`w-full h-11 text-base shadow-lg transition-all hover:scale-[1.02] ${
                            role === 'student' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' :
                            role === 'proctor' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' :
                            'bg-purple-600 hover:bg-purple-700 shadow-purple-200'
                          }`}
                          onClick={() => handleLogin(role)}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <span className="flex items-center gap-2">
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                              Authenticating...
                            </span>
                          ) : `Login as ${role.charAt(0).toUpperCase() + role.slice(1)}`}
                        </Button>
                        <div className="p-3 bg-slate-50 rounded-lg text-xs text-center text-slate-500 border border-slate-100">
                          <span className="font-semibold">Demo Credentials:</span> {role}@university.edu / password123
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>


      {/* Features Section */}
      <section id="features" className="py-12 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Complete Exam Integrity</h2>
            <p className="text-lg text-slate-600">
              Our platform combines advanced AI monitoring with intuitive design to create the most secure testing environment available.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="group p-8 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all duration-300">
                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-blue-50 transition-all duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12">
            <div className="space-y-6">
              <div className="flex items-center space-x-2 text-white">
                <Shield className="w-6 h-6 text-blue-500" />
                <span className="text-xl font-bold">ProctorSecure</span>
              </div>
              <p className="text-sm leading-relaxed">
                Empowering institutions with secure, scalable, and AI-driven assessment solutions.
              </p>
            </div>
            
            <div>
               <h4 className="text-white font-semibold mb-6">Platform</h4>
               <ul className="space-y-3 text-sm">
                 <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                 <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
                 <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                 <li><a href="#" className="hover:text-white transition-colors">Demo</a></li>
               </ul>
            </div>
            
            <div>
               <h4 className="text-white font-semibold mb-6">Company</h4>
               <ul className="space-y-3 text-sm">
                 <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                 <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                 <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                 <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
               </ul>
            </div>
            
            <div>
               <h4 className="text-white font-semibold mb-6">Legal</h4>
               <ul className="space-y-3 text-sm">
                 <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                 <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                 <li><a href="#" className="hover:text-white transition-colors">Cookie Policy</a></li>
               </ul>
            </div>
          </div>
          
          <div className="border-t border-slate-800 mt-16 pt-8 text-center text-sm text-slate-500">
            &copy; 2025 ProctorSecure Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;