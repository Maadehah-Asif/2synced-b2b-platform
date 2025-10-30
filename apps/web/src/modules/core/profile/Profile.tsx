import { useState } from "react";
import Layout from '../../../components/Layout';
import "../auth/auth.css";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function Profile(){
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onChange(e: React.FormEvent){
    e.preventDefault(); setLoading(true); setMessage(null);
    try{
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/auth/change-password`,{
        method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
        body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass })
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data?.error || 'Failed');
      setMessage('Password changed');
      setOldPass(''); setNewPass('');
    }catch(err:any){ setMessage(err.message); } finally{ setLoading(false); }
  }

  return (
    <Layout>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <form onSubmit={onChange} className="auth-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="auth-title">Profile</h2>
            <div>
              <button type="button" className="auth-button" onClick={() => window.location.hash = '#/workspaces'} style={{ marginRight: 8 }}>Back</button>
              <button type="button" className="auth-button" onClick={() => { localStorage.removeItem('token'); window.location.hash = '#/login'; }}>Logout</button>
            </div>
          </div>
          <label>Change Password</label>
          <input className="auth-input" type="password" value={oldPass} onChange={e=>setOldPass(e.target.value)} placeholder="Current password" required />
          <input className="auth-input" type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="New password" required />
          {message && <div className="auth-error">{message}</div>}
          <button className="auth-button" disabled={loading}>{loading ? 'Changing...' : 'Change Password'}</button>
        </form>
      </div>
    </Layout>
  );
}
