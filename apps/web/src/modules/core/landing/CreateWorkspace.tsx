import { useState } from "react";
import Layout from '../../../components/Layout';
import "../auth/auth.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function CreateWorkspace() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/workspaces/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed');
      // show created workspace id so user can share with teammates
      setCreatedId(data?.workspace?._id || data?.workspaceId || null);
      // navigate to workspace list after short delay
      setTimeout(() => window.location.hash = '#/workspaces', 1200);
    } catch (err: any) {
      setMessage(err.message);
    } finally { setLoading(false); }
  }

  return (
    <Layout>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <form onSubmit={onCreate} className="auth-card">
          <h2 className="auth-title">Create Workspace</h2>
          <label>Workspace Name</label>
          <input className="auth-input" value={name} onChange={(e) => setName(e.target.value)} required />
          {message && <div className="auth-error">{message}</div>}
          <button className="auth-button" disabled={loading}>{loading ? 'Creating...' : 'Create'}</button>
          {createdId && (
            <div style={{ marginTop: 12, padding: 12, background: '#eef2ff', borderRadius: 6 }}>
              Workspace created. ID: <strong>{createdId}</strong>
              <button style={{ marginLeft: 8 }} className="auth-button" onClick={() => navigator.clipboard?.writeText(createdId)}>Copy ID</button>
            </div>
          )}
        </form>
      </div>
    </Layout>
  );
}
