import { useState } from "react";
import "./auth.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function Signup(){
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(true);
  const [newsletter, setNewsletter] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  async function onSubmit(e: React.FormEvent){
    e.preventDefault();
    setLoading(true); setError(null);
    try{
      const normalizedEmail = email.trim();
      // empty-field validation
      if (!normalizedEmail) {
        setError('Email is required.');
        setLoading(false);
        return;
      }
      if (!password) {
        setError('Password is required.');
        setLoading(false);
        return;
      }
      if (!confirmPassword) {
        setError('Please confirm your password.');
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setLoading(false);
        setError('Passwords do not match. Please re-enter them.');
        return;
      }
      const res = await fetch(`${API_URL}/auth/signup`,{
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password, confirmPassword }),
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data?.error || 'Signup failed');
      if(data?.token) localStorage.setItem('token', data.token);
      window.location.hash = '#/landing';
    }catch(err:any){ setError(err.message); } finally{ setLoading(false); }
  }

  function handleGoogleSignup() {
    window.location.href = `${API_URL}/auth/google`;
  }

  return (
    <div className="auth-layout auth-light">
      <div className="auth-brand">2-Synced</div>
      <div className="auth-illustration">
        <img src={'/src/assets/auth/new login-signup image.png'} alt="Signup visual" />
      </div>
      <div className="auth-pane">
        <form onSubmit={onSubmit} className="auth-card" style={{ color: 'var(--text)' }}>
          <a className="auth-back" href="#" onClick={(e)=>{ e.preventDefault(); history.back(); }}>&lt; Back</a>
          <h2 className="auth-title" style={{ color: 'var(--text)' }}>Sign up</h2>
          <p className="auth-subtitle" style={{ color: 'var(--muted)' }}>Sign up for free to access to in any of our products</p>

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
          <label style={{ marginTop: 12, display: 'block' }}>Confirm password</label>
          <input
            className="auth-input"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your password"
            required
          />

            {/* Temporarily disabled: agreement & newsletter checkboxes
              and reCAPTCHA placeholder. Keep for future restore. */}
          {false && (
            <>
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
            </>
          )}


          {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}
          <button className="auth-button auth-button-primary" type="submit" disabled={loading} style={{ marginTop: 12 }}>{loading ? 'Signing up...' : 'Create an account'}</button>

          <div className="auth-divider">
            <span>OR</span>
          </div>

          {/* Google signup via backend OAuth */}
          <button
            type="button"
            className="auth-button auth-button-google"
            onClick={handleGoogleSignup}
          >
            <img src={'/src/assets/auth/google logo.png'} alt="google" />
            <span>Continue with Google</span>
          </button>

          <div className="auth-footer" style={{ color: 'var(--muted)' }}>
            Already have an account? <a href="#/login">Log in</a>
          </div>
        </form>
      </div>
    </div>
  );
}
