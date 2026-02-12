import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useToast } from '../hooks/use-toast';
import { Loader2, UserPlus, Users, Trash2, Mail, Building, Copy, Check } from 'lucide-react';


const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [proctors, setProctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    institution: '',
    department: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [passwordCopied, setPasswordCopied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!token || user.role !== 'admin') {
      navigate('/');
      return;
    }
    
    fetchProctors();
  }, [navigate]);

  const fetchProctors = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/admin/proctors', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setProctors(data);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to fetch proctors',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error fetching proctors:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setPasswordCopied(true);
      toast({
        title: "Copied!",
        description: "Password copied to clipboard",
      });
      setTimeout(() => setPasswordCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Please copy the password manually",
        variant: "destructive"
      });
    }
  };

  const handleInviteProctor = async (e) => {
    e.preventDefault();
    setPasswordCopied(false);
    setSubmitting(true);

    try {
      const response = await fetch('http://localhost:8000/api/admin/proctors/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(inviteForm)
      });

      const data = await response.json();

      if (response.ok) {
        setTempPassword(data.temporary_password);
        toast({
          title: 'Proctor Invited Successfully!',
          description: (
            <div className="space-y-2 mt-2">
              <p><strong>Email:</strong> {data.email}</p>
              <p><strong>Temporary Password:</strong> <code className="bg-gray-800 px-2 py-1 rounded">{data.temporary_password}</code></p>
              <p className="text-sm text-yellow-600">⚠️ {data.note}</p>
            </div>
          )
        });

        setInviteForm({ name: '', email: '', institution: '', department: '' });
        fetchProctors();
      } else {
        toast({
          title: 'Error',
          description: data.detail || 'Failed to invite proctor',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error inviting proctor:', error);
      toast({
        title: 'Error',
        description: 'Network error occurred',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProctor = async (proctorId, proctorName) => {
    if (!window.confirm(`Are you sure you want to remove ${proctorName}? This will also delete all their exams and enrollments.`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/admin/proctors/${proctorId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Proctor removed successfully'
        });
        fetchProctors();
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.detail || 'Failed to remove proctor',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error removing proctor:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-2">Manage proctors and oversee the system</p>
          </div>
          <Button onClick={handleLogout} variant="outline">
            Logout
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Proctors</p>
                  <p className="text-3xl font-bold text-gray-900">{proctors.length}</p>
                </div>
                <Users className="w-12 h-12 text-blue-600 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invite Proctor Button */}
        <div className="mb-6">
          <Button 
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Invite New Proctor
          </Button>
        </div>

        {/* Invite Form */}
        {showInviteForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Invite Proctor</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInviteProctor} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <Input
                      type="text"
                      value={inviteForm.name}
                      onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                      placeholder="Dr. John Smith"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email *
                    </label>
                    <Input
                      type="email"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      placeholder="john.smith@university.edu"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Institution *
                    </label>
                    <Input
                      type="text"
                      value={inviteForm.institution}
                      onChange={(e) => setInviteForm({ ...inviteForm, institution: e.target.value })}
                      placeholder="State University"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Department (Optional)
                    </label>
                    <Input
                      type="text"
                      value={inviteForm.department}
                      onChange={(e) => setInviteForm({ ...inviteForm, department: e.target.value })}
                      placeholder="Computer Science"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Inviting...
                      </>
                    ) : (
                      'Send Invitation'
                    )}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowInviteForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
                  {tempPassword && (
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-900 mb-2">
                      ✅ Proctor invited successfully!
                    </p>
                    <div className="bg-white p-3 rounded border border-green-300">
                      <p className="text-xs text-gray-600 mb-1">Temporary Password:</p>
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-lg font-mono font-bold text-green-700">
                          {tempPassword}
                        </code>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={copyToClipboard}
                          className="flex items-center gap-2"
                        >
                          {passwordCopied ? (
                            <>
                              <Check className="w-4 h-4 text-green-600" />
                              <span className="text-green-600">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span>Copy</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      Share this password with the new proctor. They'll be asked to change it on first login.
                    </p>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        )}



        {/* Proctors List */}
        <Card>
          <CardHeader>
            <CardTitle>Proctors ({proctors.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {proctors.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No proctors yet. Invite your first proctor above!</p>
            ) : (
              <div className="space-y-3">
                {proctors.map((proctor) => (
                  <div 
                    key={proctor.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{proctor.name}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {proctor.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building className="w-3 h-3" />
                          {proctor.institution}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteProctor(proctor.id, proctor.name)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
