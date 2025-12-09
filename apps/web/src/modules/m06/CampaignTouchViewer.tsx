import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { useEffect, useState } from 'react';
import { listTouchesByCampaign, listTouchesByLead, updateTouch, archiveTouch, deleteTouchPermanent, searchCampaigns, searchLeads } from './services/touches';
import { useWorkspaceId } from '../../utils/workspace';

interface TouchRow {
  _id: string;
  lead_id?: number;
  campaign_id?: number;
  campaign_name?: string;
  type: string;
  channel?: string;
  touched_at: string;
  status?: string;
  metadata?: any;
}

export default function CampaignTouchViewer(){
  const workspaceId = useWorkspaceId({ redirectToWorkspaces: true });
  const [mode, setMode] = useState<'campaign'|'lead'>('campaign');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [campaignOptions, setCampaignOptions] = useState<any[]>([]);
  const [leadOptions, setLeadOptions] = useState<any[]>([]);
  const [rows, setRows] = useState<TouchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string|null>(null);
  const [editChannel, setEditChannel] = useState('');
  const [editType, setEditType] = useState('');
  const [editTouchedAt, setEditTouchedAt] = useState('');
  const [editMetadata, setEditMetadata] = useState('');
  const [toast, setToast] = useState<{msg:string,type:'success'|'error'}|null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [filterType, setFilterType] = useState<string>('');
  const [filterChannel, setFilterChannel] = useState<string>('');

  // Load campaign list for current workspace when in "By Campaign" mode
  useEffect(() => {
    let ignore = false;
    async function run() {
      if (!workspaceId || mode !== 'campaign') { if (!ignore) setCampaignOptions([]); return; }
      const r = await searchCampaigns('');
      if (!ignore) setCampaignOptions(r.campaigns || []);
    }
    run();
    return () => { ignore = true; };
  }, [workspaceId, mode]);

  // Load a small lead list for current workspace when in "By Lead" mode
  useEffect(() => {
    let ignore = false;
    async function run() {
      if (!workspaceId || mode !== 'lead') { if (!ignore) setLeadOptions([]); return; }
      const r = await searchLeads('');
      if (!ignore) setLeadOptions(r.leads || []);
    }
    run();
    return () => { ignore = true; };
  }, [workspaceId, mode]);

  async function load(){
    if(!workspaceId){ setRows([]); return; }
    if(!selectedEntityId){ setRows([]); return; }
    setLoading(true);
    let data: any = [];
    const common = {
      includeArchived: showArchived,
      type: filterType || undefined,
      channel: filterChannel || undefined,
      workspaceId: workspaceId || undefined,
    };
    if(mode==='campaign'){
      data = await listTouchesByCampaign({
        campaignId: selectedEntityId,
        ...common,
      } as any);
    } else {
      data = await listTouchesByLead({
        leadId: selectedEntityId,
        ...common,
      } as any);
    }

    // Accept multiple response shapes and normalise into TouchRow objects
    try { console.debug('[m06/loadTouches] selectedEntityId=', selectedEntityId, 'mode=', mode, 'response=', data); } catch(e){}

    let raw: any[] = [];
    if (Array.isArray(data)) raw = data;
    else if (data && Array.isArray(data.touches)) raw = data.touches;
    else if (data && data.ok === false && data.error) {
      setToast({ msg: `Load error: ${data.error}`, type: 'error' });
      setRows([]);
      setLoading(false);
      return;
    }

    const normalised: TouchRow[] = raw.map((t: any) => ({
      _id: String(t._id || t.id || ''),
      lead_id: t.lead_id,
      campaign_id: t.campaign_id,
      campaign_name: t.campaign_name || t.campaignName,
      type: t.type,
      channel: t.channel,
      touched_at: t.touched_at || t.touchedAt,
      status: t.status,
      metadata: t.metadata,
    })).filter(t => t._id);

    setRows(normalised);
    setLoading(false);
  }

  useEffect(()=>{ load(); },[selectedEntityId, showArchived, filterType, filterChannel, mode, workspaceId]);

  function beginEdit(r:TouchRow){
    setEditingRowId(r._id);
    setEditChannel(r.channel||'');
    setEditType(r.type);
    setEditTouchedAt(r.touched_at.slice(0,16));
    setEditMetadata(r.metadata ? JSON.stringify(r.metadata) : '');
  }

  async function saveEdit(){
    if(!editingRowId) return;
    let metadataObj: any = undefined;
    if(editMetadata.trim()){
      try { metadataObj = JSON.parse(editMetadata); } catch(e){ setToast({ msg:'Metadata invalid JSON', type:'error'}); return; }
    }
    const res = await updateTouch(editingRowId, { channel: editChannel, type: editType, touched_at: editTouchedAt, metadata: metadataObj });
    if((res as any).error){ setToast({ msg:'Update failed', type:'error'}); }
    else { setToast({ msg:'Updated', type:'success'}); setEditingRowId(null); load(); }
  }

  async function doArchive(id:string){
    const res = await archiveTouch(id);
    if((res as any).error) setToast({ msg:'Archive failed', type:'error'});
    else { setToast({ msg:'Archived', type:'success'}); load(); }
  }

  async function doDelete(id:string){
    if(!confirm('Permanent delete this touch?')) return;
    const res = await deleteTouchPermanent(id);
    if((res as any).error) setToast({ msg:'Delete failed', type:'error'});
    else { setToast({ msg:'Deleted', type:'success'}); load(); }
  }

  const filteredRows = rows.filter(r=>{
    if(filterType && r.type!==filterType) return false;
    if(filterChannel && r.channel!==filterChannel) return false;
    return true;
  });

  return (
    <Layout>
      <main className="page-root">
        <ModuleBackButton toSuffix="/m06" />
        <h2 style={{ marginTop:16 }}>Campaign Touches</h2>
        <div style={{ fontSize:12, color:'#555' }}>View & manage interaction events. Toggle mode to switch context.</div>
        {!workspaceId && <div style={{ fontSize:12, color:'#c33', marginTop:8 }}>Open a workspace to manage campaign touches.</div>}
        <div style={{ marginTop:12, display:'flex', gap:12 }}>
          <button className={mode==='campaign'?'btn-primary':'btn-ghost'} onClick={()=>{ setMode('campaign'); setSelectedEntityId(''); }}>By Campaign</button>
          <button className={mode==='lead'?'btn-primary':'btn-ghost'} onClick={()=>{ setMode('lead'); setSelectedEntityId(''); }}>By Lead</button>
        </div>
        <div style={{ marginTop:16 }}>
          <div style={{ fontSize:12 }}>{mode==='campaign'?'Select campaign':'Select lead'}</div>
          {mode === 'campaign' ? (
            <select
              style={{ width:'100%', padding:6, fontSize:12 }}
              value={selectedEntityId}
              onChange={e => setSelectedEntityId(e.target.value)}
            >
              <option value="">Choose a campaign</option>
              {campaignOptions.map((c:any) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <select
              style={{ width:'100%', padding:6, fontSize:12 }}
              value={selectedEntityId}
              onChange={e => setSelectedEntityId(e.target.value)}
            >
              <option value="">Choose a lead</option>
              {leadOptions.map((l:any) => (
                <option key={l._id} value={String(l._id)}>
                  #{l.lead_id} {l.name || ''}
                </option>
              ))}
            </select>
          )}
        </div>
        <div style={{ marginTop:12 }}>
          <label style={{ fontSize:12 }}>
            <input type="checkbox" checked={showArchived} onChange={(e)=>{ setShowArchived(e.target.checked); }} />
            <span style={{ marginLeft:6 }}>Show archived</span>
          </label>
          <span style={{ marginLeft:12, fontSize:12 }}>Type:</span>
          <select value={filterType} onChange={(e)=>setFilterType(e.target.value)} style={{ fontSize:12, marginLeft:4 }}>
            <option value="">All</option>
            <option value="email_open">Email Open</option>
            <option value="email_click">Email Click</option>
            <option value="ad_click">Ad Click</option>
            <option value="webinar">Webinar</option>
            <option value="form_submit">Form Submit</option>
            <option value="other">Other</option>
          </select>
          <span style={{ marginLeft:12, fontSize:12 }}>Channel:</span>
          <select value={filterChannel} onChange={(e)=>setFilterChannel(e.target.value)} style={{ fontSize:12, marginLeft:4 }}>
            <option value="">All</option>
            <option value="email">Email</option>
            <option value="ads">Ads</option>
            <option value="linkedin">LinkedIn</option>
            <option value="webinar">Webinar</option>
            <option value="other">Other</option>
          </select>
          <button className="btn-ghost" style={{ fontSize:12, marginLeft:12 }} onClick={()=>load()}>Reload</button>
        </div>
        <div style={{ marginTop:16, background:'#fff', borderRadius:8, padding:12 }}>
          {loading && <div style={{ fontSize:12 }}>Loading...</div>}
          {!loading && filteredRows.length===0 && (
            <div style={{ fontSize:12 }}>
              {selectedEntityId
                ? 'No touches found for this selection.'
                : 'Select a campaign or lead above to see touches.'}
            </div>
          )}
          {!loading && filteredRows.length>0 && (
            <table style={{ width:'100%', fontSize:12, borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f5f5f5' }}>
                  <th style={{ textAlign:'left', padding:6 }}>Lead</th>
                  <th style={{ textAlign:'left', padding:6 }}>Campaign</th>
                  <th style={{ textAlign:'left', padding:6 }}>Type</th>
                  <th style={{ textAlign:'left', padding:6 }}>Channel</th>
                  <th style={{ textAlign:'left', padding:6 }}>Touched At</th>
                  <th style={{ textAlign:'left', padding:6 }}>Status</th>
                  <th style={{ textAlign:'left', padding:6 }}>Metadata</th>
                  <th style={{ textAlign:'left', padding:6 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(r=>{
                  const editing = editingRowId === r._id;
                  return (
                    <tr key={r._id} style={{ borderTop:'1px solid #eee' }}>
                      <td style={{ padding:6 }}>#{r.lead_id}</td>
                      <td style={{ padding:6 }}>{r.campaign_name || r.campaign_id}</td>
                      <td style={{ padding:6 }}>
                        {editing ? (
                          <select value={editType} onChange={e=>setEditType(e.target.value)} style={{ fontSize:12 }}>
                            <option value="email_open">Email Open</option>
                            <option value="email_click">Email Click</option>
                            <option value="ad_click">Ad Click</option>
                            <option value="webinar">Webinar</option>
                            <option value="form_submit">Form Submit</option>
                            <option value="other">Other</option>
                          </select>
                        ) : r.type }
                      </td>
                      <td style={{ padding:6 }}>
                        {editing ? (
                          <select value={editChannel} onChange={e=>setEditChannel(e.target.value)} style={{ fontSize:12 }}>
                            <option value="email">Email</option>
                            <option value="ads">Ads</option>
                            <option value="linkedin">LinkedIn</option>
                            <option value="webinar">Webinar</option>
                            <option value="other">Other</option>
                          </select>
                        ) : (r.channel || '-')}
                      </td>
                      <td style={{ padding:6 }}>
                        {editing ? (
                          <input type="datetime-local" style={{ fontSize:12 }} value={editTouchedAt} onChange={e=>setEditTouchedAt(e.target.value)} />
                        ) : new Date(r.touched_at).toLocaleString() }
                      </td>
                      <td style={{ padding:6 }}>{r.status||'active'}</td>
                      <td style={{ padding:6, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {editing ? (
                          <textarea rows={2} style={{ width:'100%', fontSize:12 }} value={editMetadata} onChange={e=>setEditMetadata(e.target.value)} />
                        ) : (r.metadata ? JSON.stringify(r.metadata) : '-')}
                      </td>
                      <td style={{ padding:6 }}>
                        {!editing && (
                          <>
                            <button className="btn-ghost" style={{ fontSize:11 }} onClick={()=>beginEdit(r)}>Edit</button>
                            <button className="btn-ghost" style={{ fontSize:11 }} onClick={()=>doArchive(r._id)}>Archive</button>
                            <button className="btn-ghost" style={{ fontSize:11, color:'#c33' }} onClick={()=>doDelete(r._id)}>Delete</button>
                          </>
                        )}
                        {editing && (
                          <>
                            <button className="btn-primary" style={{ fontSize:11 }} onClick={saveEdit}>Save</button>
                            <button className="btn-ghost" style={{ fontSize:11 }} onClick={()=>setEditingRowId(null)}>Cancel</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {mode==='lead' && !loading && filteredRows.length>0 && (
            <details style={{ marginTop:16 }}>
              <summary style={{ cursor:'pointer', fontSize:12 }}>Timeline View</summary>
              <ul style={{ listStyle:'none', padding:0, margin:0 }}>
                {[...filteredRows].sort((a,b)=> new Date(a.touched_at).getTime() - new Date(b.touched_at).getTime()).map(r => (
                  <li key={r._id} style={{ padding:'6px 4px', borderLeft:'2px solid #888', marginLeft:4, position:'relative' }}>
                    <span style={{ position:'absolute', left:-6, top:12, width:8, height:8, background:'#888', borderRadius:'50%' }}></span>
                    <div style={{ fontSize:11, color:'#555' }}>{new Date(r.touched_at).toLocaleString()}</div>
                    <div style={{ fontSize:12 }}><strong>{r.type}</strong>{r.channel?` • ${r.channel}`:''} — Campaign {r.campaign_name || r.campaign_id}</div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        {toast && (
          <div style={{ position:'fixed', right:16, bottom:16, background: toast.type==='success'?'#0a7':'#c33', color:'#fff', padding:'10px 14px', borderRadius:8 }}>
            <div>{toast.msg}</div>
            <button className="btn-ghost" style={{ marginTop:6, background:'#fff', color:'#333' }} onClick={()=>setToast(null)}>Close</button>
          </div>
        )}
      </main>
    </Layout>
  );
}
