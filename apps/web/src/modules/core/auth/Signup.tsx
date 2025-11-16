import { useState } from "react";
import "./auth.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function Signup(){
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(true);
  const [newsletter, setNewsletter] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  async function onSubmit(e: React.FormEvent){
    e.preventDefault();
    setLoading(true); setError(null);
    try{
      const res = await fetch(`${API_URL}/auth/signup`,{ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if(!res.ok) throw new Error(data?.error || 'Signup failed');
      if(data?.token) localStorage.setItem('token', data.token);
      window.location.hash = '#/landing';
    }catch(err:any){ setError(err.message); } finally{ setLoading(false); }
  }

  return (
    <div className="auth-layout auth-light">
      <div className="auth-brand">2-Synced</div>
      <div className="auth-illustration">
        <img src={'/src/assets/auth/login image.png'} alt="Signup visual" />
      </div>
      <div className="auth-pane">
        <form onSubmit={onSubmit} className="auth-card" style={{ color: 'var(--text)' }}>
          <a className="auth-back" href="#" onClick={(e)=>{ e.preventDefault(); history.back(); }}>&lt; Back</a>
          <h2 className="auth-title" style={{ color: 'var(--text)' }}>Sign up</h2>
          <p className="auth-subtitle" style={{ color: 'var(--muted)' }}>Sign up for free to access to in any of our products</p>

          {/* Google signup (static) */}
          <div style={{ marginBottom: 14 }}>
            <button type="button" className="auth-button" style={{ background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src={'/src/assets/auth/google logo.png'} alt="google" style={{ height: 18 }} />
              <span style={{ color: 'var(--text)' }}>Sign up with Google</span>
            </button>
          </div>

          <label>Email address</label>
          <input className="auth-input" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" required />
          <label style={{ marginTop: 12, display: 'block' }}>Password</label>
          <div style={{ position: 'relative' }}>
            <img
              src={showPassword ? '/src/assets/auth/hide.png' : '/src/assets/auth/unhide.png'}
              alt={showPassword ? 'Hide password' : 'Show password'}
              className="auth-eye"
              role="button"
              tabIndex={0}
              onClick={() => setShowPassword(s => !s)}
              onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') setShowPassword(s => !s); }}
            />
            <input className="auth-input" type={showPassword ? 'text' : 'password'} value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Use 8 or more characters" required />
          </div>

          <div style={{ marginTop: 8 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={agree} onChange={(e)=>setAgree(e.target.checked)} />
              <span style={{ color: 'var(--muted)' }}>Agree to our <a href="#">Terms of use</a> and <a href="#">Privacy Policy</a></span>
            </label>
          </div>

          <div style={{ marginTop: 8 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={newsletter} onChange={(e)=>setNewsletter(e.target.checked)} />
              <span style={{ color: 'var(--muted)' }}>Subscribe to our monthly newsletter</span>
            </label>
          </div>

          {/* reCAPTCHA placeholder */}
          <div style={{ marginTop: 12, border: '1px solid var(--border)', padding: 10, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'var(--muted)' }}>[ reCAPTCHA widget placeholder ]</span>
          </div>

          {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}
          <button className="auth-button" type="submit" disabled={loading} style={{ marginTop: 12 }}>{loading ? 'Signing up...' : 'Sign up'}</button>

          <div className="auth-footer" style={{ color: 'var(--muted)' }}>
            Already have an account? <a href="#/login">Log in</a>
          </div>
        </form>
      </div>
    </div>
  );
}
