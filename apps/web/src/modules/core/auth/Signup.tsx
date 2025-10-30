import { useState } from "react";
import "./auth.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // workspace will be created/joined later from the app UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Signup failed");
      localStorage.setItem("token", data.token);
  alert("Account created!");
  window.location.hash = "#/login";
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-illustration">
        <img src={"/src/assets/auth/signup image.png"} alt="Signup visual" />
      </div>
      <div className="auth-pane">
        <form onSubmit={onSubmit} className="auth-card">
          <a className="auth-back" href="#/login">&lt; Back</a>
          <h2 className="auth-title">ACCOUNT SIGNUP</h2>
          <p className="auth-subtitle">Become a member and enjoy exclusive features.</p>
          <label>Full Name</label>
          <input className="auth-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" required />
          <label style={{ marginTop: 12 }}>Email Address</label>
          <input className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          <label style={{ marginTop: 12 }}>Password</label>
          <input className="auth-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          {/* Workspace creation/join happens after login; removed from signup form */}
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-button" disabled={loading}>
            {loading ? "Continue..." : "Continue"}
          </button>
          <div className="auth-footer">
            Already have an account? <a href="#/login">Login</a>
          </div>
        </form>
      </div>
    </div>
  );
}
