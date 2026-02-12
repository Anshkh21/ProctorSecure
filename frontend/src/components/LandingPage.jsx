import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, Lock, Users, Monitor, CheckCircle } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
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
      
      // Store token and user data
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      toast({
        title: "Success",
        description: `Welcome ${user.name}!`,
      });

      // Navigate based on role
      if (role === 'student') {
        navigate('/student');
      } else if (role === 'proctor') {
        navigate('/proctor');
      } else if (role === 'admin') {
        navigate('/admin');
      }
      
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
      icon: <Shield className="w-8 h-8 text-blue-600" />,
      title: "Secure Environment",
      description: "Advanced security measures to prevent cheating and ensure exam integrity"
    },
    {
      icon: <Eye className="w-8 h-8 text-green-600" />,
      title: "Real-time Monitoring",
      description: "AI-powered monitoring with facial recognition and behavior analysis"
    },
    {
      icon: <Lock className="w-8 h-8 text-purple-600" />,
      title: "Identity Verification", 
      description: "Robust verification system to prevent impersonation and fraud"
    },
    {
      icon: <Users className="w-8 h-8 text-orange-600" />,
      title: "Scalable Solution",
      description: "Handle thousands of concurrent exam-takers without performance issues"
    },
    {
      icon: <Monitor className="w-8 h-8 text-teal-600" />,
      title: "Cross-platform",
      description: "Works on all major browsers and operating systems"
    },
    {
      icon: <CheckCircle className="w-8 h-8 text-indigo-600" />,
      title: "Detailed Analytics",
      description: "Comprehensive reports and insights for exam performance analysis"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Shield className="w-8 h-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">ProctorSecure</span>
            </div>
            <div className="hidden md:flex space-x-6">
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">Features</a>
              <a href="#about" className="text-gray-600 hover:text-gray-900 transition-colors">About</a>
              <a href="#contact" className="text-gray-600 hover:text-gray-900 transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                Secure Remote
                <span className="text-blue-600 block">Exam Proctoring</span>
              </h1>
              <p className="text-xl text-gray-600 leading-relaxed max-w-lg">
                Advanced AI-powered proctoring solution that ensures exam integrity while providing 
                a seamless experience for both students and institutions.
              </p>
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg">
                  Get Started
                </Button>
                <Button variant="outline" size="lg" className="px-8 py-3 text-lg">
                  Watch Demo
                </Button>
              </div>
            </div>
            
            <div className="lg:pl-12">
              <Card className="bg-white/60 backdrop-blur-sm border-gray-200 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-2xl text-center">Login to Continue</CardTitle>
                  <CardDescription className="text-center">
                    Access your secure examination portal
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="student" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="student">Student</TabsTrigger>
                      <TabsTrigger value="proctor">Proctor</TabsTrigger>
                      <TabsTrigger value="admin">Admin</TabsTrigger>
                    </TabsList>
                    <TabsContent value="student" className="space-y-4 mt-6">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="student@university.edu"
                          value={loginData.email}
                          onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="Enter your password"
                          value={loginData.password}
                          onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                        />
                      </div>
                      <Button 
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        onClick={() => handleLogin('student')}
                        disabled={isLoading}
                      >
                        {isLoading ? 'Signing in...' : 'Login as Student'}
                      </Button>
                      <p className="text-xs text-gray-500 text-center">
                        Demo: student@university.edu / password123
                      </p>
                    </TabsContent>
                    <TabsContent value="proctor" className="space-y-4 mt-6">
                      <div className="space-y-2">
                        <Label htmlFor="proctor-email">Email</Label>
                        <Input
                          id="proctor-email"
                          type="email"
                          placeholder="proctor@university.edu"
                          value={loginData.email}
                          onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="proctor-password">Password</Label>
                        <Input
                          id="proctor-password"
                          type="password"
                          placeholder="Enter your password"
                          value={loginData.password}
                          onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                        />
                      </div>
                      <Button 
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => handleLogin('proctor')}
                        disabled={isLoading}
                      >
                        {isLoading ? 'Signing in...' : 'Login as Proctor'}
                      </Button>
                      <p className="text-xs text-gray-500 text-center">
                        Demo: proctor@university.edu / password123
                      </p>
                    </TabsContent>
                    <TabsContent value="admin" className="space-y-4 mt-6">
                      <div className="space-y-2">
                        <Label htmlFor="admin-email">Email</Label>
                        <Input
                          id="admin-email"
                          type="email"
                          placeholder="admin@proctortool.com"
                          value={loginData.email}
                          onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin-password">Password</Label>
                        <Input
                          id="admin-password"
                          type="password"
                          placeholder="Enter admin password"
                          value={loginData.password}
                          onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                        />
                      </div>
                      <Button 
                        className="w-full bg-purple-600 hover:bg-purple-700"
                        onClick={() => handleLogin('admin')}
                        disabled={isLoading}
                      >
                        {isLoading ? 'Signing in...' : 'Login as Admin'}
                      </Button>
                      <p className="text-xs text-gray-500 text-center">
                        Default: admin@proctortool.com / admin123
                      </p>
                    </TabsContent>
                  </Tabs>

                  <div className="mt-4 text-center">
                    <p className="text-sm text-gray-600">
                      Don't have an account?{' '}
                      <Button variant="link" className="p-0 h-auto font-semibold" onClick={() => navigate('/register')}>
                        Register here
                      </Button>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl font-bold text-gray-900">Why Choose ProctorSecure?</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our comprehensive proctoring solution combines cutting-edge technology with 
              user-friendly design to deliver unparalleled exam security.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all duration-300 border-gray-200">
                <CardContent className="p-8">
                  <div className="space-y-4">
                    <div className="group-hover:scale-110 transition-transform duration-300">
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">{feature.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Shield className="w-8 h-8 text-blue-400" />
                <span className="text-xl font-bold">ProctorSecure</span>
              </div>
              <p className="text-gray-300">
                Leading the future of secure online examinations with advanced AI-powered proctoring.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-300">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-300">
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-300">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>&copy; 2025 ProctorSecure. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;