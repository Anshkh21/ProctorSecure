import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useToast } from '../hooks/use-toast';
import { Loader2, UserPlus, Users, Trash2, Mail, Building, Copy, Check, AlertTriangle, Shield, Flag, BookOpen, GraduationCap } from 'lucide-react';


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
  const [isResetting, setIsResetting] = useState(false);
  const [selectedProctorForReset, setSelectedProctorForReset] = useState('');

  const handleAdminReset = async (collection, label) => {
    if (!window.confirm(`⚠️ WARNING ⚠️\n\nAre you sure you want to permanently delete all ${label}?\n\nThis action CANNOT be undone.`)) {
      return;
    }
    setIsResetting(true);
    try {
      const res = await fetch(`http://localhost:8000/api/admin/reset/${collection}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Done', description: data.message || `${label} cleared.` });
      } else {
        toast({ title: 'Error', description: data.detail || 'Failed.', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Network error.', variant: 'destructive' });
    } finally {
      setIsResetting(false);
    }
  };

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

        {/* System Actions / Danger Zone */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-red-600" />
              <h2 className="text-2xl font-bold text-gray-900">System Actions</h2>
            </div>
            <span className="bg-red-100 text-red-800 text-xs font-semibold px-3 py-1 rounded-full border border-red-200">
              Danger Zone
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            Permanently remove data from the database. These actions are irreversible. Use with extreme caution.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Exams */}
            <Card className="border-orange-200 bg-orange-50/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center text-orange-800 text-base">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Clear All Exams
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-3">Delete all created exams and their questions from the system.</p>
                <Button variant="outline" className="w-full border-orange-300 text-orange-700 hover:bg-orange-100" disabled={isResetting}
                  onClick={() => handleAdminReset('exams', 'exams')}>
                  Delete All Exams
                </Button>
              </CardContent>
            </Card>

            {/* Sessions */}
            <Card className="border-orange-200 bg-orange-50/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center text-orange-800 text-base">
                  <Users className="w-4 h-4 mr-2" />
                  Clear All Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-3">Delete all exam sessions, student attempts, and scores.</p>
                <Button variant="outline" className="w-full border-orange-300 text-orange-700 hover:bg-orange-100" disabled={isResetting}
                  onClick={() => handleAdminReset('sessions', 'exam sessions')}>
                  Delete All Sessions
                </Button>
              </CardContent>
            </Card>

            {/* Flags */}
            <Card className="border-orange-200 bg-orange-50/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center text-orange-800 text-base">
                  <Flag className="w-4 h-4 mr-2" />
                  Clear All Flags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-3">Delete all proctoring flags, incidents, and photo evidence.</p>
                <Button variant="outline" className="w-full border-orange-300 text-orange-700 hover:bg-orange-100" disabled={isResetting}
                  onClick={() => handleAdminReset('flags', 'proctoring flags')}>
                  Delete All Flags
                </Button>
              </CardContent>
            </Card>

            {/* Students */}
            <Card className="border-red-200 bg-red-50/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center text-red-800 text-base">
                  <GraduationCap className="w-4 h-4 mr-2" />
                  Clear All Students
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-3">Delete all student accounts. Admin and Proctor accounts are NOT affected.</p>
                <Button variant="destructive" className="w-full bg-red-600 hover:bg-red-700" disabled={isResetting}
                  onClick={() => handleAdminReset('students', 'student accounts')}>
                  Delete All Students
                </Button>
              </CardContent>
            </Card>

            {/* Per-Proctor Data Delete — full width */}
            <Card className="border-amber-400 bg-amber-50 md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center text-amber-900 font-bold">
                  <Users className="w-5 h-5 mr-2" />
                  Clear Data for a Specific Proctor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 mb-4">
                  Select a proctor and permanently delete all their exams, exam sessions, and proctoring flags.
                  <span className="font-semibold text-amber-800"> Their account will NOT be deleted.</span>
                </p>
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <select
                    className="flex-1 border border-amber-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    value={selectedProctorForReset}
                    onChange={(e) => setSelectedProctorForReset(e.target.value)}
                  >
                    <option value="">— Select a Proctor —</option>
                    {proctors.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.email})
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="destructive"
                    className="bg-amber-600 hover:bg-amber-700 whitespace-nowrap"
                    disabled={isResetting || !selectedProctorForReset}
                    onClick={async () => {
                      const proctor = proctors.find(p => p.id === selectedProctorForReset);
                      if (!proctor) return;
                      if (!window.confirm(`⚠️ WARNING ⚠️\n\nDelete all data (exams, sessions, flags) for proctor:\n"${proctor.name}"\n\nThis CANNOT be undone.`)) return;

                      setIsResetting(true);
                      try {
                        const res = await fetch(`http://localhost:8000/api/admin/reset/proctor/${selectedProctorForReset}`, {
                          method: 'DELETE',
                          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                        });
                        const data = await res.json();
                        if (res.ok) {
                          toast({ title: 'Done', description: data.message });
                          setSelectedProctorForReset('');
                        } else {
                          toast({ title: 'Error', description: data.detail || 'Failed.', variant: 'destructive' });
                        }
                      } catch {
                        toast({ title: 'Error', description: 'Network error.', variant: 'destructive' });
                      } finally {
                        setIsResetting(false);
                      }
                    }}
                  >
                    {isResetting ? 'Deleting...' : 'Delete Proctor Data'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Master Reset — full width */}
            <Card className="border-red-700 bg-red-50 md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center text-red-900 font-bold">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  Master Reset — Delete Everything
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-800 font-medium mb-3">
                  Wipe the entire database clean: all Exams, Sessions, Flags, and Students will be permanently deleted.
                </p>
                <Button variant="destructive" className="w-full bg-red-900 hover:bg-red-950 font-bold text-base py-5" disabled={isResetting}
                  onClick={() => handleAdminReset('all', 'ENTIRE DATABASE (Exams, Sessions, Flags, Students)')}>
                  {isResetting ? 'Processing...' : '☢ Master Reset'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;
