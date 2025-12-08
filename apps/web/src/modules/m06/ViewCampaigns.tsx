import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { useWorkspaceId } from '../../utils/workspace';
// Using local API_URL to match CampaignManager pattern
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function ViewCampaigns(){
  const workspaceId = useWorkspaceId({ redirectToWorkspaces: true });
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [archivedOnly, setArchivedOnly] = useState(false);
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [startFrom, setStartFrom] = useState('');
  const [startTo, setStartTo] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editChannel, setEditChannel] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editErrors, setEditErrors] = useState<{[k:string]:string}>({});
  const [toast, setToast] = useState<{msg:string, type:'success'|'error'}|null>(null);

  function Toast({ message, type, onClose }:{ message:string, type:'success'|'error', onClose:()=>void }){
    return (
      <div style={{ position:'fixed', right:16, bottom:16, background:type==='success'?'#0a7':'#c33', color:'#fff', padding:'10px 14px', borderRadius:8, boxShadow:'0 2px 8px rgba(0,0,0,0.2)' }}>
        <div>{message}</div>
        <button className="btn-ghost" style={{ marginTop: 6, background:'#fff', color:'#333' }} onClick={onClose}>Close</button>
      </div>
    )
  }

  async function fetchCampaigns(){
    if(!workspaceId){ window.location.hash = '#/workspaces'; return; }
    setLoading(true); setError(null);
    try{
      const params = new URLSearchParams({
        projectId: workspaceId,
        search,
        channel: channelFilter,
        includeArchived: String(includeArchived),
        archivedOnly: String(archivedOnly),
        createdFrom,
        createdTo,
        startFrom,
        startTo,
      });
      const res = await fetch(`${API_URL}/m06/campaigns?${params.toString()}`);
      const j = await res.json();
      if(!res.ok) { setError(j && j.error ? j.error : 'error'); setCampaigns([]); }
      else setCampaigns(j.campaigns || []);
    }catch(e){ setError('network error'); }
    setLoading(false);
  }

  useEffect(()=>{ fetchCampaigns() },[workspaceId, search, channelFilter, includeArchived, createdFrom, createdTo, startFrom, startTo])

  async function archive(c:any){
    if(!workspaceId){ window.location.hash = '#/workspaces'; return; }
    const ok = window.confirm(`Archive campaign "${c.name}"?`);
    if(!ok) return;
    try{
      const res = await fetch(`${API_URL}/m06/campaigns/${c.id}/archive`, { method: 'POST' });
      const j = await res.json();
      if(!res.ok){ setToast({ msg: j && j.error ? j.error : 'Failed to archive', type: 'error' }); }
      else { fetchCampaigns(); setToast({ msg: 'Campaign archived', type: 'success' }); }
    }catch(e){ alert('Network error'); }
  }

  async function permanentDelete(c:any){
    if(!workspaceId){ window.location.hash = '#/workspaces'; return; }
    const ok = window.prompt(`Type the campaign name to confirm permanent delete:\n${c.name}`);
    if(ok !== c.name) return;
    try{
      const res = await fetch(`${API_URL}/m06/campaigns/${c.id}/permanent`, { method: 'DELETE' });
      const j = await res.json();
      if(!res.ok){
        const msg = j && j.error ? j.error : 'Failed to delete';
        setToast({ msg, type: 'error' });
      }
      else { fetchCampaigns(); setToast({ msg: 'Campaign deleted permanently', type: 'success' }); }
    }catch(e){ alert('Network error'); }
  }

  function openEdit(c:any){
    setEditing(c);
    setEditName(c.name || '');
    setEditChannel(c.channel || '');
    setEditStart(c.start_date ? String(new Date(c.start_date).toISOString().slice(0,10)) : '');
    setEditEnd(c.end_date ? String(new Date(c.end_date).toISOString().slice(0,10)) : '');
  }

  async function submitEdit(){
    if(!editing) return;
    const errs:any = {};
    if(!editName) errs.name = 'Name is required';
    if(!editChannel) errs.channel = 'Channel is required';
    if(editEnd && editStart && new Date(editEnd) < new Date(editStart)) errs.end = 'End date cannot be before start date';
    setEditErrors(errs);
    if(Object.keys(errs).length) return;
    try{
      const payload:any = { name: editName, channel: editChannel };
      if(editStart) payload.start_date = editStart;
      if(editEnd) payload.end_date = editEnd;
      const res = await fetch(`${API_URL}/m06/campaigns/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const j = await res.json();
      if(!res.ok){ setToast({ msg: j && j.error ? j.error : 'Failed to update', type: 'error' }); }
      else { setEditing(null); fetchCampaigns(); setToast({ msg: 'Campaign updated', type: 'success' }); }
    }catch(e){ alert('Network error'); }
  }

  return (
    <Layout>
      <main className="page-root">
        <h2 style={{ marginTop: 16 }}>Campaigns</h2>
        <div style={{ marginTop: 8 }}>
          <ModuleBackButton toSuffix="/m06" />
        </div>
        {!workspaceId && <div style={{ fontSize: 13 }}>Open a workspace to manage campaigns.</div>}
        <div style={{ marginTop: 12 }}>
          {/* Filters */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12 }}>Search</div>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="name or id" />
            </div>
            <div>
              <div style={{ fontSize: 12 }}>Channel</div>
              <select value={channelFilter} onChange={e=>setChannelFilter(e.target.value)}>
                <option value="">All</option>
                <option value="email">Email</option>
                <option value="ads">Ads</option>
                <option value="linkedin">LinkedIn</option>
                <option value="webinar">Webinar</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12 }}>Created from</div>
              <input type="date" value={createdFrom} onChange={e=>setCreatedFrom(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12 }}>Created to</div>
              <input type="date" value={createdTo} onChange={e=>setCreatedTo(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12 }}>Start from</div>
              <input type="date" value={startFrom} onChange={e=>setStartFrom(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12 }}>Start to</div>
              <input type="date" value={startTo} onChange={e=>setStartTo(e.target.value)} />
            </div>
          </div>
          <div style={{ display:'flex', gap:16, alignItems:'center' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={includeArchived} onChange={e=>{ setIncludeArchived(e.target.checked); if(!e.target.checked) setArchivedOnly(false); }} /> Include archived campaigns
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: includeArchived ? 1 : 0.5 }}>
              <input type="checkbox" disabled={!includeArchived} checked={archivedOnly} onChange={e=>setArchivedOnly(e.target.checked)} /> Archived only
            </label>
          </div>

          {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
          {loading ? (
            <div style={{ marginTop: 8 }}>Loading...</div>
          ) : (
            <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', background: '#fafafa' }}>
                  <th style={{ padding: 8 }}>Name</th>
                  <th style={{ padding: 8 }}>Channel</th>
                  <th style={{ padding: 8 }}>Start</th>
                  <th style={{ padding: 8 }}>End</th>
                  <th style={{ padding: 8 }}>Spend</th>
                  <th style={{ padding: 8 }}>Status</th>
                  <th style={{ padding: 8 }}>Created</th>
                  <th style={{ padding: 8 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => (
                  <tr key={c.id}>
                    <td style={{ padding: 8 }}>{c.name}</td>
                    <td style={{ padding: 8 }}>{c.channel}</td>
                    <td style={{ padding: 8 }}>{c.start_date ? new Date(c.start_date).toISOString().slice(0,10) : '—'}</td>
                    <td style={{ padding: 8 }}>{c.end_date ? new Date(c.end_date).toISOString().slice(0,10) : '—'}</td>
                    <td style={{ padding: 8 }}>${(Number(c.spend)||0).toLocaleString()}</td>
                    <td style={{ padding: 8 }}>
                      {c.status === 'archived' ? <span style={{ background: '#eee', padding: '2px 6px', borderRadius: 6 }}>Archived</span> : 'active'}
                    </td>
                    <td style={{ padding: 8 }}>{c.created_at ? new Date(c.created_at).toISOString().slice(0,10) : '—'}</td>
                    <td style={{ padding: 8 }}>
                      <button className="btn-ghost" onClick={()=>openEdit(c)}>Edit</button>
                      {c.status !== 'archived' ? (
                        <button className="btn-ghost" onClick={()=>archive(c)} style={{ marginLeft: 8 }}>Archive</button>
                      ) : (
                        <button className="btn-danger" onClick={()=>permanentDelete(c)} style={{ marginLeft: 8 }}>Delete Permanently</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {editing && (
          <div className="modal-backdrop">
            <div className="modal">
              <h3>Edit Campaign</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                <div>
                  <div style={{ fontSize: 12 }}>Name</div>
                  <input value={editName} onChange={e=>setEditName(e.target.value)} />
                  {editErrors.name && <div style={{ color:'#c33', fontSize:12 }}>{editErrors.name}</div>}
                </div>
                <div>
                  <div style={{ fontSize: 12 }}>Channel</div>
                  <select value={editChannel} onChange={e=>setEditChannel(e.target.value)}>
                    <option value="">—</option>
                    <option value="email">Email</option>
                    <option value="ads">Ads</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="webinar">Webinar</option>
                    <option value="other">Other</option>
                  </select>
                  {editErrors.channel && <div style={{ color:'#c33', fontSize:12 }}>{editErrors.channel}</div>}
                </div>
                <div>
                  <div style={{ fontSize: 12 }}>Start date</div>
                  <input type="date" value={editStart} onChange={e=>setEditStart(e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize: 12 }}>End date</div>
                  <input type="date" value={editEnd} onChange={e=>setEditEnd(e.target.value)} />
                  {editErrors.end && <div style={{ color:'#c33', fontSize:12 }}>{editErrors.end}</div>}
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="btn-primary" onClick={submitEdit}>Save</button>
                <button className="btn-ghost" style={{ marginLeft: 8 }} onClick={()=>setEditing(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
        {toast && (<Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)} />)}
      </main>
    </Layout>
  )
}
