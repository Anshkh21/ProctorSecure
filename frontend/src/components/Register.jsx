import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/use-toast';
import { Shield, User, Mail, Lock, Building2, ChevronDown, ArrowLeft } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

/* ── dark styled input ─────────────────────────────── */
const Field = ({ id, label, type = 'text', placeholder, value, onChange, icon: Icon }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
    <label htmlFor={id} style={{ color: '#94a3b8', fontSize: '0.82rem', fontWeight: 500 }}>{label}</label>
    <div style={{ position: 'relative' }}>
      {Icon && (
        <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <Icon size={15} color="rgba(148,163,184,0.5)" />
        </div>
      )}
      <input
        id={id} type={type} placeholder={placeholder}
        value={value} onChange={onChange} required
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: Icon ? '10px 14px 10px 36px' : '10px 14px',
          borderRadius: '8px', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#e2e8f0', fontSize: '0.9rem',
          outline: 'none', transition: 'border-color 0.2s'
        }}
        onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
        onBlur={e  => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
      />
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════ */
const Register = () => {
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', institution: '', role: 'student'
  });
  const [loading, setLoading] = useState(false);
  const navigate  = useNavigate();
  const { toast } = useToast();

  const handleChange = e => setFormData({ ...formData, [e.target.id]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/auth/register`, formData);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      toast({ title: 'Registration Successful', description: `Welcome to ProctorSecure, ${data.user.name}!` });
      navigate(data.user.role === 'student' ? '/student' : '/proctor');
    } catch (err) {
      toast({
        title: 'Registration Failed',
        description: err.response?.data?.detail || 'An error occurred. Please try again.',
        variant: 'destructive'
      });
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#080d1a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px 16px', fontFamily: "'Inter', sans-serif", position: 'relative', overflow: 'hidden'
    }}>
      {/* Google Font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Ambient blobs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(59,130,246,0.12) 0%,transparent 70%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', bottom: '-10%', left: '-10%', width: '450px', height: '450px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(139,92,246,0.1) 0%,transparent 70%)', filter: 'blur(40px)' }} />
      </div>

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: '440px',
        background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
        padding: '40px 36px'
      }}>
        {/* Back link */}
        <button onClick={() => navigate('/')} style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(148,163,184,0.6)', fontSize: '0.82rem', fontWeight: 500,
          marginBottom: '24px', padding: 0, transition: 'color 0.2s'
        }}
          onMouseEnter={e => e.currentTarget.style.color = '#60a5fa'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(148,163,184,0.6)'}
        >
          <ArrowLeft size={14} /> Back to Login
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: 'linear-gradient(135deg,rgba(59,130,246,0.2),rgba(139,92,246,0.2))',
            border: '1px solid rgba(99,102,241,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', boxShadow: '0 0 20px rgba(99,102,241,0.2)'
          }}>
            <Shield size={22} color="#a5b4fc" />
          </div>
          <h1 style={{ margin: '0 0 6px', color: '#f1f5f9', fontSize: '1.5rem', fontWeight: 800 }}>Create an Account</h1>
          <p style={{ margin: 0, color: 'rgba(148,163,184,0.7)', fontSize: '0.875rem' }}>
            Join ProctorSecure and start securing your exams
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Field id="name"        label="Full Name"    placeholder="John Doe"             value={formData.name}        onChange={handleChange} icon={User}      />
          <Field id="email"       label="Email"        type="email" placeholder="john@university.edu" value={formData.email}  onChange={handleChange} icon={Mail}      />
          <Field id="password"    label="Password"     type="password" placeholder="••••••••"  value={formData.password}    onChange={handleChange} icon={Lock}      />
          <Field id="institution" label="Institution"  placeholder="University Name"      value={formData.institution} onChange={handleChange} icon={Building2} />



          {/* Submit */}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '12px', borderRadius: '9px', fontWeight: 700,
            fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer',
            border: 'none', color: 'white', marginTop: '4px',
            background: 'linear-gradient(135deg,#2563eb,#6366f1)',
            boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
            opacity: loading ? 0.7 : 1, transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
          }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(99,102,241,0.55)'; }}}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.4)'; }}
          >
            {loading ? (
              <>
                <span style={{ width: '15px', height: '15px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                Creating Account…
              </>
            ) : 'Create Account'}
          </button>

          {/* Login redirect */}
          <p style={{ margin: 0, textAlign: 'center', fontSize: '0.85rem', color: 'rgba(148,163,184,0.6)' }}>
            Already have an account?{' '}
            <button type="button" onClick={() => navigate('/')} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              color: '#a5b4fc', fontWeight: 600, fontSize: '0.85rem', transition: 'color 0.2s'
            }}
              onMouseEnter={e => e.target.style.color = '#60a5fa'}
              onMouseLeave={e => e.target.style.color = '#a5b4fc'}
            >Sign in →</button>
          </p>
        </form>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder, select option { color: rgba(100,116,139,0.55); }
      `}</style>
    </div>
  );
};

export default Register;
