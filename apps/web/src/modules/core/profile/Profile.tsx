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
      <div className="max-width-680">
        <form onSubmit={onChange} className="auth-card">
          <div className="flex justify-between align-center">
            <h2 className="auth-title">Profile</h2>
            <div>
              <button type="button" className="btn-ghost ml-8" onClick={() => window.location.hash = '#/workspaces'}>Back</button>
              <button type="button" className="btn-primary" onClick={() => { localStorage.removeItem('token'); window.location.hash = '#/login'; }}>Logout</button>
            </div>
          </div>
          <label>Change Password</label>
          <input className="auth-input" type="password" value={oldPass} onChange={e=>setOldPass(e.target.value)} placeholder="Current password" required />
          <input className="auth-input" type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="New password" required />
          {message && <div className="auth-error">{message}</div>}
          <button className="btn-primary" disabled={loading}>{loading ? 'Changing...' : 'Change Password'}</button>
        </form>
      </div>
    </Layout>
  );
}
