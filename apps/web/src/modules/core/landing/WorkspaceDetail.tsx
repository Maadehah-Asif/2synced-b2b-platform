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
  const [selfUserId, setSelfUserId] = useState<string|null>(null);

  useEffect(()=>{(async()=>{
    if(!id) { setError('missing id'); setLoading(false); return; }
    try{
      const token = localStorage.getItem('token');
      // Try requests to determine admin; do not bail on 403
      try{
        const res = await fetch(`${API_URL}/workspaces/${id}/requests`,{ headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if(res.status===403){ setIsAdmin(false); setRequests([]); }
        else if(res.ok){ setIsAdmin(true); setRequests(data.requests||[]); }
      }catch(e){ /* ignore */ }
      // Fetch members (any active member can view)
      try{
        const res2 = await fetch(`${API_URL}/workspaces/${id}/members`,{ headers: { Authorization: `Bearer ${token}` } });
        const d2 = await res2.json();
        if(res2.ok) setMembers(d2.members||[]);
      }catch(e){ /* ignore */ }
      // Fetch current user id to restrict self role editing
      try{
        const meRes = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` }});
        const me = await meRes.json();
        if(meRes.ok && me?.user?.id) setSelfUserId(me.user.id);
      }catch(e){ /* ignore */ }
      // Fetch workspace shareId for display
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
      setRequests(r => r.filter(x => x.id !== memberId));
    }catch(e:any){ setError(e.message); }
  }

  async function updateRole(memberId:string, newRole:string){
    try{
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/workspaces/${id}/members/${memberId}/role`,{ method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ role: newRole }) });
      const d = await res.json();
      if(!res.ok) throw new Error(d?.error || 'Failed');
      const res2 = await fetch(`${API_URL}/workspaces/${id}/members`,{ headers: { Authorization: `Bearer ${token}` } });
      const d2 = await res2.json();
      if(res2.ok) setMembers(d2.members||[]);
    }catch(e:any){ setError(e.message); }
  }

  return (
    <Layout>
      <main className="page-root">
        {/* Hero */}
        <div className="hero" style={{ backgroundImage: "url('/src/assets/hero-image.png')" }}>
          <h1>Welcome to RevOps Platform</h1>
          <p>Your complete revenue operations suite for lead management, intent scoring, and sales intelligence.</p>
          <div className="flex gap-12 mt-18">
            <button className="btn-primary" onClick={() => { if(id) window.location.hash = `#/m01/upload?workspace=${id}`; }}>Upload Leads</button>
            <button className="btn-secondary ml-8" onClick={() => { if(id) window.location.hash = `#/m01/merged?workspace=${id}`; }}>View Merged CSVs</button>
            <button className="btn-secondary ml-8" onClick={() => { if(id) window.location.hash = `#/m01/leads?workspace=${id}`; }}>View Leads Code CSVs</button>
            {/* Analytics entry removed as per request; keep primary flows simple */}
          </div>
        </div>

        {/* Info cards (static, non-dynamic) */}
        <section className="p-20">
          <div className="stats-grid">
            <div className="stats-card">
              <div className="label">Uploads</div>
              <div className="muted">Manage source CSVs for your workspace.</div>
            </div>
            <div className="stats-card">
              <div className="label">Merged CSVs</div>
              <div className="muted">Combine, deduplicate, and normalize columns.</div>
            </div>
            <div className="stats-card">
              <div className="label">Leads Code</div>
              <div className="muted">Generate prediction CSVs and review outputs.</div>
            </div>
            <div className="stats-card">
              <div className="label">Members</div>
              <div className="muted">View all members; admins can edit roles.</div>
            </div>
          </div>
        </section>

        {/* Share ID and Admin panels */}
  <section className="p-20">
          <div className="mb-12">
            <div className="muted" style={{ fontSize: 13 }}>Workspace Share ID</div>
            <div className="font-700">{shareId || '—'} <button className="btn-primary btn-sm ml-8" onClick={() => shareId && navigator.clipboard?.writeText(shareId)}>Copy</button></div>
          </div>
        </section>

        {/* Admin pending requests panel below the metrics (visible to admins only) */}
        {isAdmin && (
  <section className="p-20">
            <div className="card p-18" style={{ borderRadius: 10 }}>
            <h3 className="mt-0">Pending Join Requests</h3>
            {loading && <div>Loading...</div>}
            {error && <div className="auth-error">{error}</div>}
            {!loading && (
              <div className="flex-col gap-12">
                {requests.length === 0 && <div>No pending requests</div>}
                {requests.map((r:any) => (
                  <div key={r.id} className="flex justify-between align-center" style={{ padding: '8px 0', borderBottom: 'var(--outline)' }}>
                    <div>
                      <div className="font-700">{(r.user && (r.user.fullName || r.user.email)) || r.userId}</div>
                      <div className="muted" style={{ fontSize: 13 }}>{r.user?.email || ''}</div>
                    </div>
                    <div className="flex gap-8">
                      <button className="btn-primary" onClick={() => act(r.id, 'approve')}>Approve</button>
                      <button className="btn-ghost" onClick={() => act(r.id, 'reject')}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        )}

        {/* Members list (all members) */}
  <section className="p-20">
          <div style={{ background: 'var(--container-bg)', padding: 18, borderRadius: 10 }}>
            <h3 style={{ marginTop: 0 }}>Workspace Members</h3>
            {members.length === 0 && <div>No members</div>}
            {members.map((m:any) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: 'var(--outline)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{m.user?.fullName || m.user?.email || 'Unknown'}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{m.user?.email || ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {/* Admins can edit other members' roles, but not their own */}
                  {isAdmin && selfUserId && m.user?.id !== selfUserId ? (
                    <select value={m.role} onChange={(e) => updateRole(m.id, e.target.value)}>
                      <option value="head_manager">Head Manager</option>
                      <option value="sales_manager">Sales Manager</option>
                      <option value="marketing_manager">Marketing Manager</option>
                      <option value="sales_team_member">Sales Team Member</option>
                      <option value="marketing_team_member">Marketing Team Member</option>
                    </select>
                  ) : (
                    <div className="badge" style={{ padding: '2px 8px', border: '1px solid #ddd', borderRadius: 12, fontSize: 12 }}>{(m.role||'').toString().replace(/_/g,' ').replace(/\b\w/g, (c:any)=> c.toUpperCase())}</div>
                  )}
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{m.status}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </Layout>
  );
}


