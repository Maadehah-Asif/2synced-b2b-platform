import { useEffect, useState } from "react";
import Layout from '../../../components/Layout';
import "../auth/auth.css";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function useParamsHash(){
  const hash = window.location.hash || '';
  const m = hash.match(/#\/workspace\/(.+)/);
  return m ? m[1] : null;
}

export default function WorkspaceDetail(){
  const id = useParamsHash();
  const [requests, setRequests] = useState<Array<any>>([]);
  const [members, setMembers] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [shareId, setShareId] = useState<string|null>(null);

  useEffect(()=>{(async()=>{
    if(!id) { setError('missing id'); setLoading(false); return; }
    try{
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/workspaces/${id}/requests`,{ headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if(res.status===403){ setIsAdmin(false); setRequests([]); return; }
      if(!res.ok) throw new Error(data?.error||'Failed');
      setIsAdmin(true);
      setRequests(data.requests||[]);
      // fetch members list
      try{
        const res2 = await fetch(`${API_URL}/workspaces/${id}/members`,{ headers: { Authorization: `Bearer ${token}` } });
        const d2 = await res2.json();
        if(res2.ok) setMembers(d2.members||[]);
      }catch(e){ /* ignore */ }
      // fetch workspace shareId (quick lookup)
      try{
        const res3 = await fetch(`${API_URL}/workspaces`,{ headers: { Authorization: `Bearer ${token}` } });
        const d3 = await res3.json();
        if(res3.ok){
          const found = (d3.workspaces||[]).find((w:any)=> w.id === id);
          if(found) setShareId(found.shareId || null);
        }
      }catch(e){ /* ignore */ }
    }catch(e:any){ setError(e.message); }
    setLoading(false);
  })()},[id]);

  async function act(memberId:string, action:'approve'|'reject'){
    try{
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/workspaces/${id}/requests/${memberId}/${action==='approve'?'approve':'reject'}`,{ method:'POST', headers:{ Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if(!res.ok) throw new Error(data?.error||'Failed');
      // refresh
      setRequests(r => r.filter(x => x.id !== memberId));
    }catch(e:any){ setError(e.message); }
  }

  async function updateRole(memberId:string, newRole:string){
    try{
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/workspaces/${id}/members/${memberId}/role`,{ method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ role: newRole }) });
      const d = await res.json();
      if(!res.ok) throw new Error(d?.error || 'Failed');
      // refresh members
      const res2 = await fetch(`${API_URL}/workspaces/${id}/members`,{ headers: { Authorization: `Bearer ${token}` } });
      const d2 = await res2.json();
      if(res2.ok) setMembers(d2.members||[]);
    }catch(e:any){ setError(e.message); }
  }

  return (
    <Layout>
      <main style={{ flex: 1, background: '#f3f6f9' }}>
        {/* Hero */}
        <div style={{ height: 260, background: `linear-gradient(180deg, rgba(6,30,70,0.9), rgba(6,30,70,0.7)), url('/src/assets/hero-image.png') center/cover no-repeat`, color: '#fff', padding: 28, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h1 style={{ margin: 0, fontSize: 48 }}>Welcome to RevOps Platform</h1>
          <p style={{ marginTop: 8, fontSize: 18, maxWidth: 800 }}>Your complete revenue operations suite for lead management, intent scoring, and sales intelligence.</p>
          <div style={{ marginTop: 18, display: 'flex', gap: 12 }}>
            <button className="auth-button" style={{ background: '#fff', color: '#0a66ff' }} onClick={() => { if(id) window.location.hash = `#/m01/upload?workspace=${id}`; }}>Upload Leads</button>
            <button className="auth-button" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>View Analytics</button>
          </div>
        </div>

        {/* Metrics cards */}
        <section style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <div style={{ background: '#fff', padding: 18, borderRadius: 10 }}>
              <div style={{ color: '#64748b', fontSize: 13 }}>Total Leads</div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>24,582</div>
              <div style={{ color: '#10b981', marginTop: 8 }}>↑+12.5% from last month</div>
            </div>
            <div style={{ background: '#fff', padding: 18, borderRadius: 10 }}>
              <div style={{ color: '#64748b', fontSize: 13 }}>Hot Leads</div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>3,847</div>
              <div style={{ color: '#10b981', marginTop: 8 }}>↑+8.3% this week</div>
            </div>
            <div style={{ background: '#fff', padding: 18, borderRadius: 10 }}>
              <div style={{ color: '#64748b', fontSize: 13 }}>Conversion Rate</div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>23.4%</div>
              <div style={{ color: '#10b981', marginTop: 8 }}>↑+2.1% improvement</div>
            </div>
            <div style={{ background: '#fff', padding: 18, borderRadius: 10 }}>
              <div style={{ color: '#64748b', fontSize: 13 }}>Revenue Pipeline</div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>$2.4M</div>
              <div style={{ color: '#10b981', marginTop: 8 }}>↑+18.7% growth</div>
            </div>
          </div>
        </section>

        {/* Share ID and Admin panels */}
        <section style={{ padding: 20 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>Workspace Share ID</div>
            <div style={{ fontWeight: 700 }}>{shareId || '—' } <button style={{ marginLeft: 8 }} className="auth-button" onClick={() => shareId && navigator.clipboard?.writeText(shareId)}>Copy</button></div>
          </div>
        </section>

        {/* Admin pending requests panel below the metrics */}
        <section style={{ padding: 20 }}>
          <div style={{ background: '#fff', padding: 18, borderRadius: 10 }}>
            <h3 style={{ marginTop: 0 }}>Pending Join Requests</h3>
            {loading && <div>Loading...</div>}
            {error && <div className="auth-error">{error}</div>}
            {!loading && !isAdmin && <div>You are not an admin for this workspace or there are no pending requests.</div>}
            {!loading && isAdmin && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {requests.length === 0 && <div>No pending requests</div>}
                {requests.map((r:any) => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eef2f7' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{(r.user && (r.user.fullName || r.user.email)) || r.userId}</div>
                      <div style={{ color: '#64748b', fontSize: 13 }}>{r.user?.email || ''}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="auth-button" onClick={() => act(r.id, 'approve')}>Approve</button>
                      <button className="auth-button" onClick={() => act(r.id, 'reject')}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Members list (all members) */}
        <section style={{ padding: 20 }}>
          <div style={{ background: '#fff', padding: 18, borderRadius: 10 }}>
            <h3 style={{ marginTop: 0 }}>Workspace Members</h3>
            {members.length === 0 && <div>No members</div>}
            {members.map((m:any) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eef2f7' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{m.user?.fullName || m.user?.email || 'Unknown'}</div>
                  <div style={{ color: '#64748b', fontSize: 13 }}>{m.user?.email || ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select value={m.role} onChange={(e) => updateRole(m.id, e.target.value)}>
                    <option value="admin">admin</option>
                    <option value="member">member</option>
                    <option value="analyst">analyst</option>
                    <option value="manager">manager</option>
                    <option value="sales">sales</option>
                    <option value="marketing">marketing</option>
                  </select>
                  <div style={{ color: '#64748b' }}>{m.status}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </Layout>
  );
}
