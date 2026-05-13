import { useEffect, useState } from "react";
import Layout from '../../../components/Layout';
import "../auth/auth.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function useWorkspaceIdFromHash(){
  const hash = window.location.hash || '';
  const m = hash.match(/#\/workspace\/([^/]+)/);
  return m ? m[1] : null;
}

function formatRole(role: string): string {
  return (role || '')
    .toString()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c:any)=> c.toUpperCase());
}

function getRoleTone(role: string) {
  if (role === 'head_manager') return { bg: 'rgba(15,66,88,0.12)', border: 'rgba(15,66,88,0.22)', color: 'var(--header-secondary)' };
  if (role === 'sales_manager') return { bg: 'rgba(25,73,114,0.10)', border: 'rgba(25,73,114,0.18)', color: 'var(--text-primary)' };
  if (role === 'marketing_manager') return { bg: 'rgba(72,177,217,0.14)', border: 'rgba(72,177,217,0.24)', color: 'var(--header-secondary)' };
  return { bg: 'rgba(69,154,208,0.08)', border: 'rgba(69,154,208,0.16)', color: 'var(--text-primary)' };
}

function getStatusTone(status: string) {
  if ((status || '').toLowerCase() === 'active') {
    return { bg: 'rgba(33,128,79,0.10)', color: '#1f6b46', dot: '#2f9d62' };
  }
  return { bg: 'rgba(157,120,24,0.10)', color: '#8a6812', dot: '#c6921a' };
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
  const activeMembers = members.filter((member) => (member.status || '').toLowerCase() === 'active');
  const pendingMembers = members.filter((member) => (member.status || '').toLowerCase() === 'pending');

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
      try{
        const res = await fetch(`${API_URL}/workspaces/${workspaceId}/requests`,{ headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if(res.status===403){ setIsAdmin(false); setRequests([]); }
        else if(res.ok){ setIsAdmin(true); setRequests(data.requests||[]); }
      }catch(e){ /* ignore */ }
      try{
        const res2 = await fetch(`${API_URL}/workspaces/${workspaceId}/members`,{ headers: { Authorization: `Bearer ${token}` } });
        const d2 = await res2.json();
        if(res2.ok) setMembers(d2.members||[]);
      }catch(e){ /* ignore */ }
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
      const res2 = await fetch(`${API_URL}/workspaces/${workspaceId}/members`,{ headers: { Authorization: `Bearer ${token}` } });
      const d2 = await res2.json();
      if(res2.ok) setMembers(d2.members||[]);
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
        <section
          className="p-20"
          style={{
            minHeight: '100%',
            background: 'linear-gradient(180deg, rgba(15,66,88,0.06) 0%, rgba(255,255,255,0.82) 22%, rgba(249,251,254,1) 100%)',
          }}
        >
          <div style={{ maxWidth: 1160, margin: '0 auto', display: 'grid', gap: 18 }}>
            <section
              className="card"
              style={{
                borderRadius: 22,
                padding: 24,
                background: 'linear-gradient(135deg, rgba(11,37,64,0.98) 0%, rgba(15,66,88,0.96) 58%, rgba(72,177,217,0.88) 100%)',
                color: '#fff',
                boxShadow: '0 28px 60px rgba(11,37,64,0.18)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -70,
                  right: -20,
                  width: 240,
                  height: 240,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 72%)',
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 20,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ maxWidth: 620 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.78 }}>
                    Workspace Access
                  </div>
                  <h2 style={{ margin: '10px 0 8px', fontSize: 34, lineHeight: 1.1, color: '#fff' }}>Workspace Members</h2>
                  <div style={{ fontSize: 15, lineHeight: 1.65, color: 'rgba(255,255,255,0.82)' }}>
                    Manage the people in this workspace, review pending access requests, and control roles without changing any of the underlying workflows.
                  </div>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 12,
                    minWidth: 280,
                    flex: '1 1 320px',
                    alignSelf: 'stretch',
                  }}
                >
                  <div style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 18, padding: '16px 18px' }}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.72)' }}>Members</div>
                    <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{activeMembers.length}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 18, padding: '16px 18px' }}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.72)' }}>Pending</div>
                    <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{pendingMembers.length}</div>
                  </div>
                </div>
              </div>
            </section>

            {loading && (
              <div className="card" style={{ borderRadius: 18, padding: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                Loading...
              </div>
            )}

            {error && <div className="auth-error">{error}</div>}

            {isAdmin && (
              <div className="card p-18" style={{ borderRadius: 20, padding: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
                  <div>
                    <h3 className="mt-0" style={{ marginBottom: 6, fontSize: 24 }}>Pending Join Requests</h3>
                    <div className="muted" style={{ fontSize: 14 }}>Review access requests before users become active members of this workspace.</div>
                  </div>
                  <div
                    style={{
                      padding: '8px 14px',
                      borderRadius: 999,
                      background: 'rgba(69,154,208,0.08)',
                      border: '1px solid rgba(69,154,208,0.16)',
                      color: 'var(--text-primary)',
                      fontWeight: 700,
                    }}
                  >
                    {pendingMembers.length} request{pendingMembers.length === 1 ? '' : 's'}
                  </div>
                </div>

                {!loading && (
                  <div className="flex-col gap-12">
                    {requests.length === 0 && (
                      <div
                        style={{
                          border: '1px dashed rgba(67,105,141,0.20)',
                          borderRadius: 16,
                          padding: 18,
                          background: 'linear-gradient(180deg, rgba(69,154,208,0.04), rgba(69,154,208,0.02))',
                          color: 'var(--text-muted)',
                        }}
                      >
                        No pending requests.
                      </div>
                    )}
                    {requests.map((r:any) => (
                      <div
                        key={r.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 14,
                          padding: '16px 18px',
                          border: '1px solid rgba(67,105,141,0.10)',
                          borderRadius: 16,
                          background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(249,251,254,0.96))',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <div className="font-700" style={{ fontSize: 16, marginBottom: 4 }}>{(r.user && (r.user.fullName || r.user.email)) || r.userId}</div>
                          <div className="muted" style={{ fontSize: 14 }}>{r.user?.email || 'No email available'}</div>
                        </div>
                        <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
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
              <div
                className="card"
                style={{
                  borderRadius: 20,
                  padding: 22,
                  background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(246,250,253,0.92))',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: 24 }}>Invite User by Email</h3>
                    <div className="muted" style={{ fontSize: 14 }}>Send workspace access using the same role rules already enforced by the backend.</div>
                  </div>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(220px, 1.6fr) minmax(220px, 1fr) auto',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <input
                    type="email"
                    placeholder="user@example.com"
                    className="auth-input"
                    style={{ maxWidth: 'none', marginBottom: 0 }}
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
                  <button className="btn-primary" type="button" onClick={inviteByEmail} disabled={!inviteEmail.trim()} style={{ minWidth: 118, minHeight: 42 }}>
                    Invite
                  </button>
                </div>
                {inviteMessage && <div className="auth-error" style={{ marginTop: 12 }}>{inviteMessage}</div>}
              </div>
            )}

            <div
              className="card"
              style={{
                borderRadius: 20,
                padding: 22,
                background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(248,250,253,0.98))',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: 24 }}>Members</h3>
                  <div className="muted" style={{ fontSize: 14 }}>Current workspace participants, their assigned roles, and their access status.</div>
                </div>
              </div>
              {members.length === 0 && (
                <div
                  style={{
                    border: '1px dashed rgba(67,105,141,0.20)',
                    borderRadius: 16,
                    padding: 18,
                    background: 'linear-gradient(180deg, rgba(69,154,208,0.04), rgba(69,154,208,0.02))',
                    color: 'var(--text-muted)',
                  }}
                >
                  No members.
                </div>
              )}
              <div style={{ display: 'grid', gap: 12 }}>
                {members.map((m:any) => {
                  const roleTone = getRoleTone(m.role);
                  const statusTone = getStatusTone(m.status);
                  const canManage = isAdmin && selfUserId && m.user?.id !== selfUserId;
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 16,
                        padding: '18px 18px',
                        borderRadius: 18,
                        border: '1px solid rgba(67,105,141,0.10)',
                        background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,253,0.96))',
                        boxShadow: '0 12px 28px rgba(9,30,63,0.04)',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ minWidth: 220, flex: '1 1 280px' }}>
                        <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text-primary)', marginBottom: 4 }}>
                          {m.user?.fullName || m.user?.email || 'Unknown'}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                          {m.user?.email || 'No email available'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end', flex: '1 1 340px' }}>
                        {!canManage && (
                          <div
                            style={{
                              padding: '7px 12px',
                              borderRadius: 999,
                              border: `1px solid ${roleTone.border}`,
                              background: roleTone.bg,
                              color: roleTone.color,
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            {formatRole(m.role)}
                          </div>
                        )}

                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '7px 12px',
                            borderRadius: 999,
                            background: statusTone.bg,
                            color: statusTone.color,
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusTone.dot, display: 'inline-block' }} />
                          {(m.status || 'unknown').toString()}
                        </div>

                        {canManage && (
                          <>
                            <select value={m.role} onChange={(e) => updateRole(m.id, e.target.value)} style={{ minWidth: 210 }}>
                              <option value="head_manager">Head Manager</option>
                              <option value="sales_manager">Sales Manager</option>
                              <option value="marketing_manager">Marketing Manager</option>
                              <option value="sales_team_member">Sales Team Member</option>
                              <option value="marketing_team_member">Marketing Team Member</option>
                            </select>
                            <button className="btn-ghost btn-sm" type="button" onClick={() => removeMember(m.id)}>
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
