import { useState } from "react";
import Layout from '../../../components/Layout';
import "../auth/auth.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function JoinWorkspace() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('token');
      // accept either a Mongo id (24-hex) or a short share id
      const trimmed = identifier.trim();
      if (!trimmed || trimmed.length < 4) {
        setMessage('Please provide a valid workspace ID or share code.');
        setLoading(false);
        return;
      }
      const payload: any = {};
      if (/^[0-9a-fA-F]{24}$/.test(trimmed)) payload.workspaceId = trimmed;
      else payload.workspaceId = trimmed; // server will look up by shareId if needed
      const res = await fetch(`${API_URL}/workspaces/join`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed');
      setMessage('Request sent. Waiting for admin approval.');
    } catch (err: any) {
      setMessage(err.message);
    } finally { setLoading(false); }
  }

  return (
    <Layout>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <form onSubmit={onJoin} className="auth-card">
          <h2 className="auth-title">Join Workspace</h2>
          <label>Workspace ID or Share Code</label>
          <input className="auth-input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Paste the workspace ID or share code" required />
          {message && <div className="auth-error">{message}</div>}
          <button className="btn-primary" disabled={loading}>{loading ? 'Joining...' : 'Join'}</button>
        </form>
      </div>
    </Layout>
  );
}
