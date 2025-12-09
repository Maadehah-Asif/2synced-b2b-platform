import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { useEffect, useState } from 'react';
import Autocomplete from '../../components/Autocomplete';
import { listDeals, updateDeal, archiveDeal, deleteDealPermanent, searchLeads } from './services/deals';
import type { Deal } from './services/deals';
import { useWorkspaceId } from '../../utils/workspace';

export default function DealViewer(){
  const workspaceId = useWorkspaceId({ redirectToWorkspaces: true });
  const [leadQuery, setLeadQuery] = useState('');
  const [leadId, setLeadId] = useState<string>('');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [status, setStatus] = useState<string>('closed_won');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [stage, setStage] = useState<string>('');
  const [includeArchived, setIncludeArchived] = useState<boolean>(false);
  const [rows, setRows] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<string|null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editClosedWon, setEditClosedWon] = useState('true');
  const [editClosedAt, setEditClosedAt] = useState('');
  const [editStage, setEditStage] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [toast, setToast] = useState<{msg:string,type:'success'|'error'}|null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadError, setLoadError] = useState<string|undefined>(undefined);

  useEffect(()=>{
    // default 90-day window for closed_won
    const now = new Date();
    const past = new Date(); past.setDate(past.getDate()-90);
    const toStr = now.toISOString().slice(0,10);
    const fromStr = past.toISOString().slice(0,10);
    setFrom(fromStr);
    setTo(toStr);
    setStatus('closed_won');
  },[]);

  async function load(){
    if(!workspaceId){
      setRows([]);
      return;
    }
    setLoading(true);
    setLoadError(undefined);
    const params: any = { from, to, status, stage, includeArchived };
    if(leadId) params.leadId = leadId;
    if(minAmount) params.minAmount = Number(minAmount);
    if(maxAmount) params.maxAmount = Number(maxAmount);
    try {
      const data = await listDeals(params);
      setRows(Array.isArray(data)? data : []);
    } catch(e:any){
      setLoadError(e?.message||'Failed to load deals');
    }
    setLoading(false);
  }

  useEffect(()=>{ load(); },[leadId, from, to, status, minAmount, maxAmount, stage, includeArchived, workspaceId]);

  function startEdit(r:Deal){
    setEditing(r._id!);
    setEditAmount(String(r.amount||''));
    setEditClosedWon(String(r.closed_won));
    setEditClosedAt((r.closed_at||'').slice(0,16));
    setEditStage(r.stage||'');
    setEditNotes(r.notes||'');
    setModalOpen(true);
  }

  async function saveEdit(){
    if(!editing) return;
    const payload: any = { amount: Number(editAmount), closed_won: editClosedWon==='true', closed_at: editClosedAt || undefined, stage: editStage || undefined, notes: editNotes || undefined };
    const res = await updateDeal(editing, payload);
    if((res as any).error) setToast({ msg:'Update failed', type:'error' });
    else { setToast({ msg:'Updated', type:'success' }); setEditing(null); setModalOpen(false); load(); }
  }

  async function doArchive(id:string){
    if(!confirm('This will archive the deal. It will be hidden from normal views but kept for historical attribution and reports. Proceed?')) return;
    const res = await archiveDeal(id);
    if((res as any).error) setToast({ msg:'Archive failed', type:'error' });
    else { setToast({ msg:'Archived', type:'success' }); load(); }
  }

  async function doDelete(id:string){
    // Strong confirmation: require typing the external deal_id
    const deal = rows.find(r=>r._id===id);
    const extId = deal?.deal_id || '';
    const msg = extId ? `Type the Deal ID (${extId}) to confirm permanent deletion:` : 'Type DELETE to confirm permanent deletion:';
    const input = prompt(msg, '');
    if(extId){ if(input !== extId) { alert('Confirmation did not match Deal ID.'); return; } }
    else { if((input||'').toUpperCase() !== 'DELETE') { alert('Type DELETE to confirm.'); return; } }
    const res = await deleteDealPermanent(id);
    if((res as any).error) setToast({ msg:'Delete failed', type:'error' });
    else { setToast({ msg:'Deleted', type:'success' }); load(); }
  }

  return (
    <Layout>
      <main className="page-root">
        <ModuleBackButton toSuffix="/m06" />
        <h2 style={{ marginTop:16 }}>Deals</h2>
        <div style={{ fontSize:12, color:'#555' }}>View, filter, edit, archive or delete deals.</div>
        {!workspaceId && <div style={{ fontSize:12, color:'#c33', marginTop:8 }}>Open a workspace to load deals.</div>}

        <div style={{ marginTop:12, background:'#fff', borderRadius:10, padding:14, boxShadow:'0 4px 16px rgba(17,24,39,0.06)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
            <div style={{ fontSize:12, color:'#4b5563' }}>Tip: leave dates empty to fetch all. Status defaults to Closed Won for the last 90 days.</div>
            <button className="btn-ghost" onClick={()=>load()}>Reload</button>
          </div>
          <div style={{ marginTop:12, display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12 }}>
            <div>
              <label style={{ fontSize:12, fontWeight:600 }}>Lead</label>
              <Autocomplete
                value={leadQuery}
                placeholder="Lead id / name / company"
                fetchItems={async (q)=>{ const r = await searchLeads(q); return r.leads||[]; }}
                formatItem={(l:any)=>`#${l.lead_id} ${l.First_Name||''} ${l.Last_Name||''}`.trim()}
                getValue={(l:any)=>String(l.lead_id)}
                onChange={(val,item)=>{ setLeadQuery(val); setLeadId(item? String(item.lead_id):''); }}
              />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600 }}>Closed from</label>
              <input type="date" value={from} onChange={e=>setFrom(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600 }}>Closed to</label>
              <input type="date" value={to} onChange={e=>setTo(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600 }}>Status</label>
              <select value={status} onChange={e=>setStatus(e.target.value)}>
                <option value="">All</option>
                <option value="closed_won">Closed Won</option>
                <option value="closed_lost">Closed Lost</option>
                <option value="open">Open</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600 }}>Min amount</label>
              <input value={minAmount} onChange={e=>setMinAmount(e.target.value)} placeholder="e.g., 1000" />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600 }}>Max amount</label>
              <input value={maxAmount} onChange={e=>setMaxAmount(e.target.value)} placeholder="e.g., 50000" />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600 }}>Stage</label>
              <input value={stage} onChange={e=>setStage(e.target.value)} placeholder="e.g., Closed Won" />
            </div>
            <label style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop:18 }}>
              <input type="checkbox" checked={includeArchived} onChange={e=>setIncludeArchived(e.target.checked)} /> <span style={{ fontSize:12, fontWeight:600 }}>Include archived</span>
            </label>
          </div>
        </div>
        <div style={{ marginTop:16, background:'#fff', borderRadius:8, padding:12 }}>
          {loadError && (
            <div style={{ background:'#fee', color:'#900', padding:'8px 10px', border:'1px solid #f99', borderRadius:6, marginBottom:8 }}>Could not load deals: {loadError}</div>
          )}
          {loading && <div style={{ fontSize:12 }}>Loading...</div>}
          {!loading && rows.length===0 && <div style={{ fontSize:12 }}>No deals found.</div>}
          {!loading && rows.length>0 && (
            <table style={{ width:'100%', fontSize:12, borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f5f5f5' }}>
                  <th style={{ textAlign:'left', padding:6 }}>Deal ID</th>
                  <th style={{ textAlign:'left', padding:6 }}>Lead</th>
                  <th style={{ textAlign:'left', padding:6 }}>Amount</th>
                  <th style={{ textAlign:'left', padding:6 }}>Currency</th>
                  <th style={{ textAlign:'left', padding:6 }}>Status</th>
                  <th style={{ textAlign:'left', padding:6 }}>Closed at</th>
                  <th style={{ textAlign:'left', padding:6 }}>Stage</th>
                  <th style={{ textAlign:'left', padding:6 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r=>{
                  const isEditing = editing === r._id;
                  return (
                    <tr key={r._id} style={{ borderTop:'1px solid #eee' }}>
                      <td style={{ padding:6 }}>{r.deal_id || '-'}</td>
                      <td style={{ padding:6 }}>#{r.lead_id}</td>
                      <td style={{ padding:6 }}>
                        {isEditing ? (<input value={editAmount} onChange={e=>setEditAmount(e.target.value)} style={{ fontSize:12 }} />) : r.amount }
                      </td>
                      <td style={{ padding:6 }}>{r.currency || 'USD'}</td>
                      <td style={{ padding:6 }}>
                        {isEditing ? (
                          <select value={editClosedWon} onChange={e=>setEditClosedWon(e.target.value)} style={{ fontSize:12 }}>
                            <option value="true">Closed Won</option>
                            <option value="false">Not Won</option>
                          </select>
                        ) : (r.closed_won ? 'Closed Won' : 'Open/Other')}
                      </td>
                      <td style={{ padding:6 }}>
                        {isEditing ? (<input type="datetime-local" value={editClosedAt} onChange={e=>setEditClosedAt(e.target.value)} style={{ fontSize:12 }} />) : (r.closed_at ? new Date(r.closed_at).toLocaleString() : '-')}
                      </td>
                      <td style={{ padding:6 }}>
                        {isEditing ? (<input value={editStage} onChange={e=>setEditStage(e.target.value)} style={{ fontSize:12 }} />) : (r.stage || '-')}
                      </td>
                      <td style={{ padding:6 }}>
                        {!isEditing ? (
                          <>
                            <button className="btn-ghost" style={{ fontSize:11 }} onClick={()=>startEdit(r)}>Edit</button>
                            <button className="btn-ghost" style={{ fontSize:11 }} onClick={()=>doArchive(r._id!)}>Archive</button>
                            <button className="btn-ghost" style={{ fontSize:11, color:'#c33' }} onClick={()=>doDelete(r._id!)}>Delete</button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {modalOpen && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}>
            <div style={{ background:'#fff', borderRadius:8, padding:16, width:420 }}>
              <h3 style={{ marginTop:0 }}>Edit Deal</h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:10 }}>
                <label>
                  <div style={{ fontSize:12 }}>Amount</div>
                  <input value={editAmount} onChange={e=>setEditAmount(e.target.value)} />
                </label>
                <label>
                  <div style={{ fontSize:12 }}>Closed won</div>
                  <select value={editClosedWon} onChange={e=>setEditClosedWon(e.target.value)}>
                    <option value="true">Closed Won</option>
                    <option value="false">Not Won</option>
                  </select>
                </label>
                <label>
                  <div style={{ fontSize:12 }}>Closed at</div>
                  <input type="datetime-local" value={editClosedAt} onChange={e=>setEditClosedAt(e.target.value)} />
                </label>
                <label>
                  <div style={{ fontSize:12 }}>Stage</div>
                  <input value={editStage} onChange={e=>setEditStage(e.target.value)} />
                </label>
                <label>
                  <div style={{ fontSize:12 }}>Notes</div>
                  <textarea rows={3} value={editNotes} onChange={e=>setEditNotes(e.target.value)} />
                </label>
              </div>
              <div style={{ marginTop:12, display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button className="btn-ghost" onClick={()=>{ setModalOpen(false); setEditing(null); }}>Cancel</button>
                <button className="btn-primary" onClick={saveEdit}>Save</button>
              </div>
            </div>
          </div>
        )}
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
