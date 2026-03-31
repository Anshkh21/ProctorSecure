import React, { useState, useEffect, useRef } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Eye, Lock, Users, Monitor, CheckCircle,
  ArrowRight, Zap, BookOpen, Star, ChevronRight,
  GraduationCap, BarChart2, Globe, Rocket, Clock, Award
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

/* ─── tiny helpers ─────────────────────────────────────── */
const Btn = ({ children, onClick, style = {}, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: '12px 28px', borderRadius: '10px', fontWeight: 700,
      fontSize: '0.95rem', cursor: disabled ? 'not-allowed' : 'pointer',
      border: 'none', color: 'white', display: 'inline-flex',
      alignItems: 'center', gap: '8px', transition: 'all 0.25s',
      background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
      boxShadow: '0 6px 24px rgba(99,102,241,0.35)',
      ...style
    }}
    onMouseEnter={e => { if (!disabled) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(99,102,241,0.5)'; }}}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,102,241,0.35)'; }}
  >
    {children}
  </button>
);

const GhostBtn = ({ children, href = '#', style = {} }) => (
  <a href={href} style={{
    padding: '12px 28px', borderRadius: '10px', fontWeight: 600,
    fontSize: '0.95rem', cursor: 'pointer', display: 'inline-flex',
    alignItems: 'center', gap: '8px', transition: 'all 0.25s',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: '#cbd5e1', textDecoration: 'none', ...style
  }}
    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = '#fff'; }}
    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#cbd5e1'; }}
  >
    {children}
  </a>
);

/* ─── dark input ─────────────────────────────────────── */
const DarkInput = ({ id, type, placeholder, value, onChange, onKeyDown }) => (
  <input
    id={id} type={type} placeholder={placeholder}
    value={value} onChange={onChange} onKeyDown={onKeyDown}
    style={{
      padding: '10px 14px', borderRadius: '8px', width: '100%',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      color: '#e2e8f0', fontSize: '0.9rem', outline: 'none',
      transition: 'border-color 0.2s', boxSizing: 'border-box'
    }}
    onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
    onBlur={e  => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
  />
);

/* ═══════════════════════════════════════════════════════ */
const LandingPage = () => {
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const recaptchaRef = useRef(null);
  const navigate  = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkLoginStatus = () => {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          const payloadBase64 = token.split('.')[1];
          const payloadStr = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
          const payload = JSON.parse(payloadStr);
          const isExpired = payload.exp * 1000 < Date.now();
          
          if (!isExpired) {
            if (user.role === 'student') navigate('/student');
            else if (user.role === 'proctor') navigate('/proctor');
            else navigate('/admin');
          } else {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            toast({ title: 'Session Expired', description: 'Your session has expired. Please log in again.', variant: 'destructive' });
          }
        } catch (err) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
    };
    checkLoginStatus();
  }, [navigate, toast]);

  const handleLogin = async (role) => {
    if (!loginData.email || !loginData.password) {
      toast({ title: 'Error', description: 'Please enter email and password', variant: 'destructive' });
      return;
    }
    if (!recaptchaToken) {
      toast({ title: 'Error', description: 'Please complete the reCAPTCHA verification', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const { data } = await axios.post(`${API}/auth/login`, { ...loginData, role });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      toast({ title: 'Success', description: `Welcome back, ${data.user.name}!` });
      if (role === 'student') navigate('/student');
      else if (role === 'proctor') navigate('/proctor');
      else navigate('/admin');
    } catch (err) {
      const msg = err.response?.status === 401 ? 'Invalid credentials.'
                : err.response?.status === 404 ? 'User not found.'
                : 'Login failed.';
      toast({ title: 'Login Failed', description: msg, variant: 'destructive' });
      if (recaptchaRef.current) recaptchaRef.current.reset();
      setRecaptchaToken(null);
    } finally { setIsLoading(false); }
  };

  /* ── data ─── */
  const features = [
    { icon: <Shield  size={22} color="#60a5fa" />, title: 'Robust Security',     desc: 'Industry-standard encryption and secure protocols ensure exam integrity is never compromised.' },
    { icon: <Eye     size={22} color="#a78bfa" />, title: 'AI Proctoring',           desc: 'Real-time computer vision detects suspicious activity with sub-second latency.' },
    { icon: <Lock    size={22} color="#c084fc" />, title: 'Identity Verification',   desc: 'Multi-factor auth with facial recognition for fail-safe student identification.' },
    { icon: <Users   size={22} color="#f472b6" />, title: 'Seamless Scalability',    desc: 'Handles thousands of concurrent exam sessions without a drop in performance.' },
    { icon: <Monitor size={22} color="#22d3ee" />, title: 'Device Agnostic',         desc: 'Works across all major browsers and operating systems — no plugins ever required.' },
    { icon: <BarChart2 size={22} color="#34d399" />, title: 'Instant Analytics',     desc: 'Detailed reports and cheating-risk scores land in your dashboard the moment the exam ends.' },
  ];

  const steps = [
    { num: '01', icon: <BookOpen size={28} color="#60a5fa" />, title: 'Set Up Your Exam',       desc: 'Create an exam in minutes — add questions, set duration, and configure proctoring rules.' },
    { num: '02', icon: <GraduationCap size={28} color="#a78bfa" />, title: 'Students Join Securely', desc: 'Students log in, verify their identity via webcam, and the AI session begins automatically.' },
    { num: '03', icon: <BarChart2 size={28} color="#34d399" />, title: 'Review & Report',       desc: 'Get a full flag report with timestamps, screenshots, and a risk score for every student.' },
  ];

  const stats = [
    { value: 'Launching', label: '2025', icon: <Rocket size={18} color="#60a5fa" /> },
    { value: '99.9%',     label: 'Uptime SLA',            icon: <Globe    size={18} color="#a78bfa" /> },
    { value: '<1s',       label: 'Detection latency',     icon: <Clock    size={18} color="#22d3ee" /> },
    { value: 'Free',      label: 'Early access',          icon: <Star     size={18} color="#f472b6" /> },
  ];

  /* ── colours per role ─── */
  const roleGrad = { student: ['#1d4ed8','#3b82f6'], proctor: ['#4338ca','#6366f1'], admin: ['#6d28d9','#7c3aed'] };
  const roleShadow = { student: 'rgba(59,130,246,0.4)', proctor: 'rgba(99,102,241,0.4)', admin: 'rgba(124,58,237,0.4)' };

  /* ── shared card style ─── */
  const glassCard = {
    background: 'rgba(15,23,42,0.65)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '18px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.45)'
  };

  return (
    <div style={{ fontFamily:"'Inter',sans-serif", minHeight:'100vh', background:'#080d1a', color:'#f1f5f9', overflowX:'hidden' }}>
      {/* Google Font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* Ambient blobs */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0, overflow:'hidden' }}>
        <div style={{ position:'absolute', top:'-15%', right:'-8%', width:'700px', height:'700px', borderRadius:'50%', background:'radial-gradient(circle,rgba(59,130,246,0.13) 0%,transparent 70%)', filter:'blur(50px)' }} />
        <div style={{ position:'absolute', bottom:'5%', left:'-12%', width:'600px', height:'600px', borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,0.11) 0%,transparent 70%)', filter:'blur(50px)' }} />
        <div style={{ position:'absolute', top:'50%', left:'40%', width:'400px', height:'400px', borderRadius:'50%', background:'radial-gradient(circle,rgba(244,114,182,0.07) 0%,transparent 70%)', filter:'blur(40px)' }} />
      </div>

      {/* ══ NAV ══════════════════════════════════════════╗ */}
      <nav style={{ position:'sticky', top:0, zIndex:50, background:'rgba(8,13,26,0.8)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth:'1200px', margin:'0 auto', padding:'0 24px', display:'flex', justifyContent:'space-between', alignItems:'center', height:'64px' }}>
          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ background:'linear-gradient(135deg,#3b82f6,#6366f1)', padding:'8px', borderRadius:'10px', boxShadow:'0 0 18px rgba(99,102,241,0.4)', display:'flex' }}>
              <Shield size={18} color="#fff" />
            </div>
            <span style={{ fontWeight:800, fontSize:'1.15rem', background:'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              ProctorSecure
            </span>
            <span style={{ background:'rgba(99,102,241,0.2)', border:'1px solid rgba(99,102,241,0.35)', color:'#a5b4fc', fontSize:'0.65rem', fontWeight:700, padding:'2px 8px', borderRadius:'9999px', letterSpacing:'0.05em' }}>
              BETA
            </span>
          </div>

          {/* Links */}
          <div style={{ display:'flex', alignItems:'center', gap:'32px' }}>
            {['#features','#how-it-works','#launch'].map((h, i) => (
              <a key={h} href={h} style={{ fontSize:'0.875rem', fontWeight:500, color:'#94a3b8', textDecoration:'none', transition:'color 0.2s' }}
                onMouseEnter={e => e.target.style.color='#60a5fa'}
                onMouseLeave={e => e.target.style.color='#94a3b8'}
              >{['Features','How It Works','Early Access'][i]}</a>
            ))}
            <GhostBtn style={{ padding:'7px 18px', fontSize:'0.85rem' }}>Contact</GhostBtn>
            <a href="/register" style={{ padding:'7px 18px', borderRadius:'8px', fontWeight:700, fontSize:'0.85rem', background:'linear-gradient(135deg,#3b82f6,#6366f1)', color:'white', textDecoration:'none', boxShadow:'0 0 14px rgba(99,102,241,0.3)', transition:'all 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow='0 0 22px rgba(99,102,241,0.55)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow='0 0 14px rgba(99,102,241,0.3)'}
            >Register</a>
          </div>
        </div>
      </nav>

      {/* ══ HERO ═════════════════════════════════════════╗ */}
      <section style={{ position:'relative', zIndex:1, padding:'100px 24px 80px' }}>
        <div style={{ maxWidth:'1200px', margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'64px', alignItems:'center' }}>

            {/* Left – copy */}
            <div style={{ display:'flex', flexDirection:'column', gap:'28px' }}>
              {/* Launch badge */}
              <div style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'9999px', padding:'6px 16px', width:'fit-content' }}>
                <Rocket size={13} color="#a78bfa" />
                <span style={{ color:'#c4b5fd', fontSize:'0.78rem', fontWeight:700, letterSpacing:'0.05em' }}>NOW LAUNCHING — JOIN EARLY ACCESS</span>
              </div>

              <h1 style={{ margin:0, fontWeight:900, lineHeight:1.05, fontSize:'clamp(2.6rem,5.5vw,4.2rem)' }}>
                Exams without<br />
                <span style={{ background:'linear-gradient(135deg,#60a5fa 0%,#a78bfa 50%,#f472b6 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                  Compromise.
                </span>
              </h1>

              <p style={{ margin:0, fontSize:'1.1rem', color:'rgba(148,163,184,0.9)', lineHeight:1.75, maxWidth:'480px' }}>
                ProctorSecure is the AI-powered exam platform built for modern institutions — bringing enterprise-grade security and effortless student experience together for the first time.
              </p>

              <div style={{ display:'flex', gap:'14px', flexWrap:'wrap' }}>
                <Btn><Rocket size={16} /> Get Early Access</Btn>
                <GhostBtn href="#how-it-works">See How It Works <ChevronRight size={15} /></GhostBtn>
              </div>

              {/* Trust indicators */}
              <div style={{ display:'flex', alignItems:'center', gap:'16px', paddingTop:'8px' }}>
                <div style={{ display:'flex' }}>
                  {['#3b82f6','#6366f1','#a78bfa','#f472b6'].map((c,i) => (
                    <div key={i} style={{ width:'30px', height:'30px', borderRadius:'50%', background:c, border:'2px solid #080d1a', marginLeft: i ? '-8px' : 0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <GraduationCap size={13} color="#fff" />
                    </div>
                  ))}
                </div>
                <span style={{ fontSize:'0.82rem', color:'rgba(148,163,184,0.75)' }}>
                  Be among the <strong style={{ color:'#c4b5fd' }}>first institutions</strong> to go live
                </span>
              </div>
            </div>

            {/* Right – login card */}
            <div style={{ ...glassCard, padding:'40px 36px' }}>
              {/* Header */}
              <div style={{ textAlign:'center', marginBottom:'28px' }}>
                <div style={{ width:'50px', height:'50px', borderRadius:'14px', background:'linear-gradient(135deg,rgba(59,130,246,0.2),rgba(139,92,246,0.2))', border:'1px solid rgba(99,102,241,0.3)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', boxShadow:'0 0 20px rgba(99,102,241,0.2)' }}>
                  <Lock size={22} color="#a5b4fc" />
                </div>
                <h2 style={{ margin:'0 0 6px', color:'#f1f5f9', fontSize:'1.4rem', fontWeight:700 }}>Welcome Back</h2>
                <p style={{ margin:0, color:'rgba(148,163,184,0.75)', fontSize:'0.875rem' }}>Enter your credentials to access the portal</p>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="student" className="w-full">
                <TabsList style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'10px', padding:'4px', marginBottom:'20px' }}>
                  {['student','proctor','admin'].map(r => (
                    <TabsTrigger key={r} value={r}
                      className={`data-[state=active]:text-white data-[state=active]:shadow-md ${r==='student'?'data-[state=active]:bg-blue-600':r==='proctor'?'data-[state=active]:bg-indigo-600':'data-[state=active]:bg-violet-600'}`}
                      style={{ borderRadius:'7px', color:'#94a3b8', fontWeight:600, fontSize:'0.85rem' }}
                    >{r.charAt(0).toUpperCase()+r.slice(1)}</TabsTrigger>
                  ))}
                </TabsList>

                {['student','proctor','admin'].map(role => (
                  <TabsContent key={role} value={role}>
                    <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                      <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                        <label style={{ color:'#94a3b8', fontSize:'0.82rem', fontWeight:500 }}>Email Address</label>
                        <DarkInput id={`${role}-email`} type="email" placeholder={`${role}@university.edu`}
                          value={loginData.email}
                          onChange={e => setLoginData({...loginData, email: e.target.value})}
                          onKeyDown={e => e.key==='Enter' && handleLogin(role)}
                        />
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                        <label style={{ color:'#94a3b8', fontSize:'0.82rem', fontWeight:500 }}>Password</label>
                        <DarkInput id={`${role}-password`} type="password" placeholder="••••••••"
                          value={loginData.password}
                          onChange={e => setLoginData({...loginData, password: e.target.value})}
                          onKeyDown={e => e.key==='Enter' && handleLogin(role)}
                        />
                      </div>

                      <div style={{ margin: '10px 0', display: 'flex', justifyContent: 'center' }}>
                        <ReCAPTCHA
                          ref={recaptchaRef}
                          sitekey={process.env.REACT_APP_RECAPTCHA_SITE_KEY || "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"}
                          onChange={(val) => setRecaptchaToken(val)}
                          theme="dark"
                        />
                      </div>

                      <button
                        onClick={() => handleLogin(role)} disabled={isLoading}
                        style={{
                          width:'100%', padding:'12px', borderRadius:'9px', fontWeight:700,
                          fontSize:'0.95rem', cursor: isLoading ? 'not-allowed' : 'pointer',
                          border:'none', color:'white', marginTop:'4px', opacity: isLoading ? 0.7 : 1,
                          background: `linear-gradient(135deg,${roleGrad[role][0]},${roleGrad[role][1]})`,
                          boxShadow: `0 4px 20px ${roleShadow[role]}`,
                          display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                          transition:'all 0.2s'
                        }}
                        onMouseEnter={e => { if (!isLoading) e.currentTarget.style.transform='translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; }}
                      >
                        {isLoading ? (
                          <>
                            <span style={{ width:'15px', height:'15px', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.7s linear infinite', display:'inline-block' }} />
                            Authenticating…
                          </>
                        ) : `Login as ${role.charAt(0).toUpperCase()+role.slice(1)}`}
                      </button>

                      <div style={{ padding:'9px 12px', borderRadius:'8px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:'0.76rem', textAlign:'center', color:'rgba(148,163,184,0.65)' }}>
                        <span style={{ fontWeight:600, color:'rgba(148,163,184,0.85)' }}>Demo:</span> {role}@university.edu / password123
                      </div>

                      <p style={{ margin:0, textAlign:'center', fontSize:'0.82rem', color:'rgba(148,163,184,0.6)' }}>
                        Don't have an account?{' '}
                        <a href="/register" style={{ color:'#a5b4fc', fontWeight:600, textDecoration:'none', transition:'color 0.2s' }}
                          onMouseEnter={e => e.target.style.color='#60a5fa'}
                          onMouseLeave={e => e.target.style.color='#a5b4fc'}
                        >Create one →</a>
                      </p>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>

          </div>
        </div>
      </section>

      {/* ══ STATS BAR ════════════════════════════════════╗ */}
      <section style={{ position:'relative', zIndex:1, padding:'0 24px 80px' }}>
        <div style={{ maxWidth:'1200px', margin:'0 auto' }}>
          <div style={{
            display:'grid', gridTemplateColumns:'repeat(4,1fr)',
            background:'rgba(15,23,42,0.7)', backdropFilter:'blur(16px)',
            border:'1px solid rgba(255,255,255,0.07)', borderRadius:'16px',
            padding:'32px 24px', gap:'8px'
          }}>
            {stats.map((s, i) => (
              <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'8px', padding:'12px', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  {s.icon}
                  <span style={{ fontWeight:900, fontSize:'1.7rem', color:'#f1f5f9' }}>{s.value}</span>
                </div>
                <span style={{ color:'rgba(148,163,184,0.65)', fontSize:'0.8rem', fontWeight:500, textAlign:'center' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FEATURES ═════════════════════════════════════╗ */}
      <section id="features" style={{ position:'relative', zIndex:1, padding:'80px 24px' }}>
        {/* top glow divider */}
        <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:'50%', height:'1px', background:'linear-gradient(90deg,transparent,rgba(99,102,241,0.4),transparent)' }} />

        <div style={{ maxWidth:'1200px', margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:'56px' }}>
            <span style={{ display:'inline-block', background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.25)', color:'#a5b4fc', fontSize:'0.78rem', fontWeight:700, padding:'4px 14px', borderRadius:'9999px', letterSpacing:'0.05em', marginBottom:'16px' }}>
              PLATFORM CAPABILITIES
            </span>
            <h2 style={{ margin:'0 0 14px', fontWeight:800, fontSize:'clamp(1.8rem,3.5vw,2.4rem)', color:'#f1f5f9' }}>
              Everything you need for secure exams
            </h2>
            <p style={{ margin:0, color:'rgba(148,163,184,0.8)', fontSize:'1rem', lineHeight:1.7, maxWidth:'560px', marginLeft:'auto', marginRight:'auto' }}>
              Our platform combines cutting-edge AI with intuitive design so you never have to choose between security and simplicity.
            </p>
          </div>

          {/* 3 × 2 even grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'24px' }}>
            {features.map((f, i) => (
              <div key={i}
                style={{ ...glassCard, padding:'32px 28px', transition:'all 0.3s cubic-bezier(0.4,0,0.2,1)', cursor:'default' }}
                onMouseEnter={e => { e.currentTarget.style.border='1px solid rgba(99,102,241,0.3)'; e.currentTarget.style.transform='translateY(-5px)'; e.currentTarget.style.boxShadow='0 24px 60px rgba(0,0,0,0.5), 0 0 40px rgba(99,102,241,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.border='1px solid rgba(255,255,255,0.07)'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 20px 60px rgba(0,0,0,0.45)'; }}
              >
                <div style={{ width:'46px', height:'46px', borderRadius:'12px', background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.15)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'18px' }}>
                  {f.icon}
                </div>
                <h3 style={{ margin:'0 0 10px', fontWeight:700, fontSize:'1.05rem', color:'#e2e8f0' }}>{f.title}</h3>
                <p style={{ margin:0, color:'rgba(148,163,184,0.72)', lineHeight:1.65, fontSize:'0.875rem' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ═════════════════════════════════╗ */}
      <section id="how-it-works" style={{ position:'relative', zIndex:1, padding:'80px 24px' }}>
        <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:'50%', height:'1px', background:'linear-gradient(90deg,transparent,rgba(168,85,247,0.4),transparent)' }} />

        <div style={{ maxWidth:'1200px', margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:'56px' }}>
            <span style={{ display:'inline-block', background:'rgba(168,85,247,0.1)', border:'1px solid rgba(168,85,247,0.25)', color:'#c084fc', fontSize:'0.78rem', fontWeight:700, padding:'4px 14px', borderRadius:'9999px', letterSpacing:'0.05em', marginBottom:'16px' }}>
              HOW IT WORKS
            </span>
            <h2 style={{ margin:'0 0 14px', fontWeight:800, fontSize:'clamp(1.8rem,3.5vw,2.4rem)', color:'#f1f5f9' }}>
              Up and running in three steps
            </h2>
            <p style={{ margin:0, color:'rgba(148,163,184,0.8)', fontSize:'1rem', lineHeight:1.7 }}>
              No complex setup. No IT team required. Start your first secure exam in under 10 minutes.
            </p>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'24px', position:'relative' }}>
            {/* connector line */}
            <div style={{ position:'absolute', top:'56px', left:'calc(16.6% + 24px)', right:'calc(16.6% + 24px)', height:'1px', background:'linear-gradient(90deg,rgba(99,102,241,0.4),rgba(168,85,247,0.4),rgba(52,211,153,0.4))', zIndex:0 }} />

            {steps.map((s, i) => (
              <div key={i} style={{ ...glassCard, padding:'36px 28px', position:'relative', zIndex:1, textAlign:'center' }}>
                <div style={{ width:'56px', height:'56px', borderRadius:'16px', background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', position:'relative' }}>
                  {s.icon}
                  <span style={{ position:'absolute', top:'-8px', right:'-8px', background:'linear-gradient(135deg,#3b82f6,#6366f1)', color:'#fff', fontSize:'0.62rem', fontWeight:800, padding:'2px 6px', borderRadius:'6px' }}>{s.num}</span>
                </div>
                <h3 style={{ margin:'0 0 10px', fontWeight:700, fontSize:'1.05rem', color:'#e2e8f0' }}>{s.title}</h3>
                <p style={{ margin:0, color:'rgba(148,163,184,0.72)', lineHeight:1.65, fontSize:'0.875rem' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ EARLY ACCESS CTA ════════════════════════════╗ */}
      <section id="launch" style={{ position:'relative', zIndex:1, padding:'80px 24px' }}>
        <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:'50%', height:'1px', background:'linear-gradient(90deg,transparent,rgba(244,114,182,0.4),transparent)' }} />

        <div style={{ maxWidth:'900px', margin:'0 auto' }}>
          <div style={{
            background:'linear-gradient(135deg,rgba(15,23,42,0.9) 0%,rgba(30,20,60,0.9) 100%)',
            backdropFilter:'blur(24px)',
            border:'1px solid rgba(99,102,241,0.25)',
            borderRadius:'24px',
            padding:'64px 48px',
            textAlign:'center',
            boxShadow:'0 0 80px rgba(99,102,241,0.12), 0 40px 80px rgba(0,0,0,0.5)',
            position:'relative', overflow:'hidden'
          }}>
            {/* glow behind */}
            <div style={{ position:'absolute', top:'30%', left:'50%', transform:'translate(-50%,-50%)', width:'400px', height:'300px', background:'radial-gradient(ellipse,rgba(99,102,241,0.14) 0%,transparent 70%)', pointerEvents:'none' }} />

            <div style={{ position:'relative', zIndex:1 }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'rgba(244,114,182,0.1)', border:'1px solid rgba(244,114,182,0.25)', color:'#f9a8d4', fontSize:'0.78rem', fontWeight:700, padding:'5px 14px', borderRadius:'9999px', marginBottom:'24px' }}>
                <Star size={12} color="#f9a8d4" /> LIMITED EARLY ACCESS — FREE FOR FOUNDING INSTITUTIONS
              </div>

              <h2 style={{ margin:'0 0 16px', fontWeight:900, fontSize:'clamp(1.8rem,4vw,2.8rem)', color:'#f1f5f9', lineHeight:1.1 }}>
                Be the first.<br />
                <span style={{ background:'linear-gradient(135deg,#60a5fa,#a78bfa,#f472b6)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                  Shape the future of fair exams.
                </span>
              </h2>

              <p style={{ margin:'0 auto 32px', color:'rgba(148,163,184,0.85)', fontSize:'1rem', lineHeight:1.75, maxWidth:'540px' }}>
                We're onboarding our first cohort of partner universities right now. Get free access, dedicated setup support, and early influence over our product roadmap.
              </p>

              <div style={{ display:'flex', justifyContent:'center', gap:'14px', flexWrap:'wrap' }}>
                <Btn style={{ padding:'14px 36px', fontSize:'1rem' }}>
                  <Rocket size={16} /> Request Early Access
                </Btn>
                <GhostBtn href="#features" style={{ padding:'14px 28px', fontSize:'1rem' }}>
                  View Features <ArrowRight size={15} />
                </GhostBtn>
              </div>

              {/* perks */}
              <div style={{ display:'flex', justifyContent:'center', gap:'24px', marginTop:'36px', flexWrap:'wrap' }}>
                {['No credit card required','Dedicated onboarding','Priority support'].map(perk => (
                  <div key={perk} style={{ display:'flex', alignItems:'center', gap:'6px', color:'rgba(148,163,184,0.7)', fontSize:'0.82rem' }}>
                    <CheckCircle size={14} color="#34d399" /> {perk}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ═══════════════════════════════════════╗ */}
      <footer style={{ background:'rgba(5,8,18,0.98)', borderTop:'1px solid rgba(255,255,255,0.05)', padding:'60px 24px 28px', position:'relative', zIndex:1 }}>
        <div style={{ maxWidth:'1200px', margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:'48px', marginBottom:'48px' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <Shield size={18} color="#60a5fa" />
                <span style={{ fontWeight:800, color:'#f1f5f9', fontSize:'1rem' }}>ProctorSecure</span>
                <span style={{ background:'rgba(99,102,241,0.2)', border:'1px solid rgba(99,102,241,0.3)', color:'#a5b4fc', fontSize:'0.6rem', fontWeight:700, padding:'1px 6px', borderRadius:'4px' }}>BETA</span>
              </div>
              <p style={{ color:'rgba(148,163,184,0.6)', fontSize:'0.85rem', lineHeight:1.65, margin:0, maxWidth:'280px' }}>
                Empowering institutions with secure, scalable, AI-driven assessment solutions. Launching 2025.
              </p>
              <div style={{ display:'flex', gap:'8px' }}>
                {['🔒','🏛️','🤖'].map((e,i) => (
                  <span key={i} style={{ fontSize:'1.2rem' }}>{e}</span>
                ))}
              </div>
            </div>

            {[
              { heading:'Platform', links:['Features','Security','Analytics','Demo'] },
              { heading:'Company',  links:['About Us','Careers','Blog','Contact'] },
              { heading:'Legal',    links:['Privacy Policy','Terms of Service','Cookie Policy'] }
            ].map(col => (
              <div key={col.heading}>
                <h4 style={{ color:'#f1f5f9', fontWeight:700, fontSize:'0.875rem', marginBottom:'18px', marginTop:0 }}>{col.heading}</h4>
                <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:'10px' }}>
                  {col.links.map(l => (
                    <li key={l}><a href="#" style={{ color:'rgba(148,163,184,0.6)', fontSize:'0.85rem', textDecoration:'none', transition:'color 0.2s' }}
                      onMouseEnter={e => e.target.style.color='#60a5fa'}
                      onMouseLeave={e => e.target.style.color='rgba(148,163,184,0.6)'}
                    >{l}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div style={{ borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:'24px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px' }}>
            <span style={{ color:'rgba(100,116,139,0.65)', fontSize:'0.8rem' }}>© 2025 ProctorSecure Inc. All rights reserved.</span>
            <span style={{ color:'rgba(100,116,139,0.5)', fontSize:'0.78rem' }}>Crafted with ❤️ for academic integrity</span>
          </div>
        </div>
      </footer>

      {/* Global keyframes */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(100,116,139,0.55); }
        @media (max-width: 900px) {
          section > div > div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
          section > div > div[style*="grid-template-columns: repeat(3"] { grid-template-columns: 1fr !important; }
          section > div > div[style*="grid-template-columns: repeat(4"] { grid-template-columns: repeat(2,1fr) !important; }
          nav > div > div > div:last-child { display: none !important; }
          footer > div > div:first-child { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
};

export default LandingPage;