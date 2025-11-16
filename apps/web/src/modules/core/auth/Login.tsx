import { useState } from "react";
import "./auth.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Login failed");
      if (remember && data?.token) localStorage.setItem("token", data.token);
      window.location.hash = '#/landing';
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout auth-light">
      <div className="auth-brand">2-Synced</div>
      <div className="auth-illustration">
        <img src={'/src/assets/auth/login image.png'} alt="Login visual" />
      </div>
      <div className="auth-pane">
        <form onSubmit={onSubmit} className="auth-card" style={{ color: 'var(--text)' }}>
          <a className="auth-back" href="#" onClick={(e) => { e.preventDefault(); history.back(); }}>&lt; Back</a>
          <h2 className="auth-title" style={{ color: 'var(--text)' }}>ACCOUNT LOGIN</h2>
          <p className="auth-subtitle" style={{ color: 'var(--muted)' }}>If you are already a member you can login with your email address and password.</p>

          {/* Google signin (static) */}
          <div style={{ marginBottom: 14 }}>
            <button type="button" className="auth-button" style={{ background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => { /* placeholder */ }}>
              <img src={'/src/assets/auth/google logo.png'} alt="google" style={{ height: 18 }} />
              <span style={{ color: 'var(--text)' }}>Sign in with Google</span>
            </button>
          </div>

          <label>Email address</label>
          <input className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
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
            <input className="auth-input" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <div className="auth-row">
            <input id="remember" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <label htmlFor="remember">Remember me</label>
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-button" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
          <div className="auth-footer">
            Don’t have an account? <a href="#/signup">Sign up here</a>
          </div>
        </form>
      </div>
    </div>
  );
}
