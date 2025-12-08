import { useEffect, useState } from "react";
import Layout from '../../../components/Layout';
import "../auth/auth.css";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function useWorkspaceIdFromHash(){
  const hash = window.location.hash || '';
  const m = hash.match(/#\/workspace\/([^/]+)/);
  return m ? m[1] : null;
}

export default function WorkspaceMembers(){
  const workspaceId = useWorkspaceIdFromHash();
  const [requests, setRequests] = useState<Array<any>>([]);
  const [members, setMembers] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [inviteEmail, setInviteEmail] = useState<string>("");
  const [inviteRole, setInviteRole] = useState<string>("sales_team_member");
  const [inviteMessage, setInviteMessage] = useState<string|null>(null);
  const [selfUserId, setSelfUserId] = useState<string|null>(null);

  function friendlyError(msg: string): string {
    if (!msg) return 'Something went wrong. Please try again.';
    if (msg === 'sales_manager_already_assigned') return 'Only one Sales Manager is allowed in this workspace.';
    if (msg === 'marketing_manager_already_assigned') return 'Only one Marketing Manager is allowed in this workspace.';
    if (msg === 'sales_manager_required') return 'Assign a Sales Manager before assigning Sales Team members.';
    if (msg === 'marketing_manager_required') return 'Assign a Marketing Manager before assigning Marketing Team members.';
    if (msg === 'cannot_edit_own_role') return 'You cannot change your own role.';
    if (msg === 'cannot_remove_self') return 'You cannot remove yourself from this workspace.';
    if (msg === 'user_not_found') return 'No user with this email exists. Ask them to sign up first.';
    return msg;
  }

  useEffect(()=>{(async()=>{
    if(!workspaceId) { setError('missing workspace id'); setLoading(false); return; }
    try{
      const token = localStorage.getItem('token');
      // admin check + requests
      try{
        const res = await fetch(`${API_URL}/workspaces/${workspaceId}/requests`,{ headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if(res.status===403){ setIsAdmin(false); setRequests([]); }
        else if(res.ok){ setIsAdmin(true); setRequests(data.requests||[]); }
      }catch(e){ /* ignore */ }
      // members
      try{
        const res2 = await fetch(`${API_URL}/workspaces/${workspaceId}/members`,{ headers: { Authorization: `Bearer ${token}` } });
        const d2 = await res2.json();
        if(res2.ok) setMembers(d2.members||[]);
      }catch(e){ /* ignore */ }
      // self user id
      try{
        const meRes = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` }});
        const me = await meRes.json();
        if(meRes.ok && me?.user?.id) setSelfUserId(me.user.id);
      }catch(e){ /* ignore */ }
    }catch(e:any){ setError(e.message); }
    setLoading(false);
  })()},[workspaceId]);

  async function act(memberId:string, action:'approve'|'reject'){
    try{
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/workspaces/${workspaceId}/requests/${memberId}/${action==='approve'?'approve':'reject'}`,{ method:'POST', headers:{ Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if(!res.ok) throw new Error(data?.error||'Failed');
      setRequests(r => r.filter(x => x.id !== memberId));
    }catch(e:any){ setError(friendlyError(e.message)); }
  }

  async function updateRole(memberId:string, newRole:string){
    try{
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/workspaces/${workspaceId}/members/${memberId}/role`,{ method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ role: newRole }) });
      const d = await res.json();
      if(!res.ok) throw new Error(d?.error || 'Failed');
      const res2 = await fetch(`${API_URL}/workspaces/${workspaceId}/members`,{ headers: { Authorization: `Bearer ${token}` } });
      const d2 = await res2.json();
      if(res2.ok) setMembers(d2.members||[]);
    }catch(e:any){ setError(friendlyError(e.message)); }
  }

  async function inviteByEmail(){
    try{
      setInviteMessage(null);
      const token = localStorage.getItem('token');
      const body = { email: inviteEmail, role: inviteRole };
      const res = await fetch(`${API_URL}/workspaces/${workspaceId}/invite-email`,{
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data?.error || 'Failed');
      setInviteMessage('Invitation sent. If the user is not yet a member, a pending request has been created.');
      setInviteEmail("");
      if(isAdmin){
        const resReq = await fetch(`${API_URL}/workspaces/${workspaceId}/requests`,{ headers:{ Authorization:`Bearer ${token}` }});
        const dReq = await resReq.json();
        if(resReq.ok) setRequests(dReq.requests || []);
      }
    }catch(e:any){
      setInviteMessage(friendlyError(e.message));
    }
  }

  async function removeMember(memberId:string){
    if(!window.confirm('Remove this member from the workspace?')) return;
    try{
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/workspaces/${workspaceId}/members/${memberId}`,{
        method:'DELETE',
        headers:{ Authorization:`Bearer ${token}` },
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data?.error || 'Failed');
      const res2 = await fetch(`${API_URL}/workspaces/${workspaceId}/members`,{ headers:{ Authorization:`Bearer ${token}` } });
      const d2 = await res2.json();
      if(res2.ok) setMembers(d2.members || []);
    }catch(e:any){ setError(friendlyError(e.message)); }
  }

  return (
    <Layout>
      <main className="page-root">
        <section className="p-20">
          <h2>Workspace Members</h2>
          {loading && <div>Loading…</div>}
          {error && <div className="auth-error">{error}</div>}

          {isAdmin && (
            <div className="card p-18" style={{ borderRadius: 10, marginTop: 16 }}>
              <h3 className="mt-0">Pending Join Requests</h3>
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
          )}

          {isAdmin && (
            <div style={{ background: 'var(--container-bg)', padding: 18, borderRadius: 10, marginTop: 16 }}>
              <h3 style={{ marginTop: 0 }}>Invite User by Email</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="email"
                  placeholder="user@example.com"
                  className="auth-input"
                  style={{ maxWidth: 260 }}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <select value={inviteRole} onChange={(e)=> setInviteRole(e.target.value)}>
                  <option value="head_manager">Head Manager</option>
                  <option value="sales_manager">Sales Manager</option>
                  <option value="marketing_manager">Marketing Manager</option>
                  <option value="sales_team_member">Sales Team Member</option>
                  <option value="marketing_team_member">Marketing Team Member</option>
                </select>
                <button className="btn-primary" type="button" onClick={inviteByEmail} disabled={!inviteEmail.trim()}>
                  Invite
                </button>
              </div>
              {inviteMessage && <div className="auth-error" style={{ marginTop: 8 }}>{inviteMessage}</div>}
            </div>
          )}

          <div style={{ background: 'var(--container-bg)', padding: 18, borderRadius: 10, marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Members</h3>
            {members.length === 0 && <div>No members</div>}
            {members.map((m:any) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: 'var(--outline)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{m.user?.fullName || m.user?.email || 'Unknown'}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{m.user?.email || ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {isAdmin && selfUserId && m.user?.id !== selfUserId ? (
                    <>
                      <select value={m.role} onChange={(e) => updateRole(m.id, e.target.value)}>
                        <option value="head_manager">Head Manager</option>
                        <option value="sales_manager">Sales Manager</option>
                        <option value="marketing_manager">Marketing Manager</option>
                        <option value="sales_team_member">Sales Team Member</option>
                        <option value="marketing_team_member">Marketing Team Member</option>
                      </select>
                      <button className="btn-ghost btn-sm" type="button" onClick={() => removeMember(m.id)}>Remove</button>
                    </>
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
