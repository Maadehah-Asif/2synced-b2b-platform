import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { useEffect, useState } from 'react';
import Autocomplete from '../../components/Autocomplete';
import { previewJourneys, getJourney } from './services/journeys';
import { searchCampaigns } from './services/campaigns';
import { searchLeads } from './services/deals';
import { useWorkspaceId } from '../../utils/workspace';

export default function JourneyPreview(){
  const workspaceId = useWorkspaceId({ redirectToWorkspaces: true });
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('closed_won');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [leadQuery, setLeadQuery] = useState('');
  const [leadFilter, setLeadFilter] = useState('');
  const [channel, setChannel] = useState('');
  const [campaignQuery, setCampaignQuery] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
    const [dateError, setDateError] = useState<string|undefined>(undefined);
    const [amountError, setAmountError] = useState<string|undefined>(undefined);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|undefined>(undefined);
  const [selectedDealId, setSelectedDealId] = useState<string|null>(null);
  const [journey, setJourney] = useState<any|null>(null);
  const [journeyError, setJourneyError] = useState<string|undefined>(undefined);
  const [journeyOpen, setJourneyOpen] = useState(false);

  useEffect(()=>{
    // default to last 90 days
    const now = new Date();
    const past = new Date(); past.setDate(past.getDate()-90);
    setFrom(past.toISOString().slice(0,10));
    setTo(now.toISOString().slice(0,10));
  },[]);

  function validate(){
    setDateError(undefined); setAmountError(undefined);
    if(from && to){
      const a = new Date(from).getTime();
      const b = new Date(to).getTime();
      if(!isNaN(a) && !isNaN(b) && a > b){ setDateError('Start date cannot be after end date'); return false; }
    }
    if(minAmount && isNaN(Number(minAmount))){ setAmountError('Min amount must be numeric'); return false; }
    if(maxAmount && isNaN(Number(maxAmount))){ setAmountError('Max amount must be numeric'); return false; }
    return true;
  }

  async function load(){
    if(!workspaceId){
      setRows([]);
      setTotal(0);
      return;
    }
    if(!validate()) return;
    setLoading(true); setError(undefined);
    try{
      const data = await previewJourneys({ from, to, status, minAmount, maxAmount, lead: leadFilter, channel, campaignId, page, limit });
      setRows(data.rows||[]);
      setTotal(data.total||0);
    }catch(e:any){ setError(e?.message||'Failed to load'); }
    setLoading(false);
  }

  useEffect(()=>{ if(from && to) load(); },[from,to,status,minAmount,maxAmount,leadFilter,channel,page,limit,workspaceId]);

  function onPickDeal(row:any){
    setSelectedDealId(row.deal_id);
    setJourneyOpen(true);
    setJourney(null); setJourneyError(undefined);
    getJourney(row.deal_id).then(setJourney).catch((e:any)=> setJourneyError(e?.message||'Failed to load journey'));
  }

  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));

  return (
    <Layout>
      <main className="page-root">
        <ModuleBackButton toSuffix="/m06" />
        <h2 style={{ marginTop:16 }}>Journey Preview</h2>
        <div style={{ fontSize:12, color:'#555' }}>Inspect journeys for deals within an analysis window (pre-attribution).</div>
        {!workspaceId && <div style={{ fontSize:12, color:'#c33', marginTop:8 }}>Open a workspace to inspect journeys.</div>}
        <div style={{ marginTop:12, display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12 }}>
          <div>
            <div style={{ fontSize:12 }}>Closed from</div>
            <input type="date" value={from} onChange={e=>setFrom(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize:12 }}>Closed to</div>
            <input type="date" value={to} onChange={e=>setTo(e.target.value)} />
          </div>
          {dateError && <div style={{ gridColumn:'1 / span 2', color:'#c33', fontSize:11 }}>{dateError}</div>}
          <div>
            <div style={{ fontSize:12 }}>Status</div>
            <select value={status} onChange={e=>setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="closed_won">Closed Won</option>
              <option value="closed_lost">Closed Lost</option>
              <option value="open">Open/Other</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize:12 }}>Channel</div>
            <select value={channel} onChange={e=>setChannel(e.target.value)}>
              <option value="">Any</option>
              <option value="email">Email</option>
              <option value="ads">Ads</option>
              <option value="linkedin">LinkedIn</option>
              <option value="webinar">Webinar</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize:12 }}>Campaign</div>
            <Autocomplete
              value={campaignQuery}
              placeholder="Search campaigns"
              fetchItems={async (q)=> await searchCampaigns(q)}
              formatItem={(c:any)=>`${c.name} (${c.channel||'other'})`}
              getValue={(c:any)=>String(c.id)}
              onChange={(val,item)=>{ setCampaignQuery(val); setCampaignId(item? String(item.id):''); }}
            />
          </div>
          <div>
            <div style={{ fontSize:12 }}>Min amount</div>
            <input value={minAmount} onChange={e=>setMinAmount(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize:12 }}>Max amount</div>
            <input value={maxAmount} onChange={e=>setMaxAmount(e.target.value)} />
          </div>
          {amountError && <div style={{ gridColumn:'1 / span 2', color:'#c33', fontSize:11 }}>{amountError}</div>}
          <div>
            <div style={{ fontSize:12 }}>Lead</div>
            <Autocomplete
              value={leadQuery}
              placeholder="Lead id / name / company"
              fetchItems={async (q)=>{ const r = await searchLeads(q); return r.leads||[]; }}
              formatItem={(l:any)=>`#${l.lead_id} ${l.First_Name||''} ${l.Last_Name||''}`.trim()}
              getValue={(l:any)=>String(l.lead_id)}
              onChange={(val,item)=>{ setLeadQuery(val); setLeadFilter(item? String(item.lead_id):''); }}
            />
          </div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:8 }}>
            <button className="btn-ghost" onClick={()=>{ setPage(1); load(); }}>Apply</button>
            <button className="btn-ghost" onClick={()=>{ setStatus('closed_won'); setMinAmount(''); setMaxAmount(''); setLeadQuery(''); setLeadFilter(''); setChannel(''); setPage(1); }}>Reset</button>
          </div>
        </div>
        <div style={{ marginTop:16, background:'#fff', borderRadius:8, padding:12 }}>
          {error && (
            <div style={{ background:'#fee', color:'#900', padding:'8px 10px', border:'1px solid #f99', borderRadius:6, marginBottom:8 }}>
              Could not load journeys: {error}
              <div style={{ marginTop:6 }}><button className="btn-ghost" onClick={()=>load()}>Retry</button></div>
            </div>
          )}
          {loading && <div style={{ fontSize:12 }}>Loading...</div>}
          {!loading && rows.length===0 && <div style={{ fontSize:12 }}>No deals found for selected filters.</div>}
          {!loading && rows.length>0 && (
            <>
              <table style={{ width:'100%', fontSize:12, borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#f5f5f5' }}>
                    <th style={{ textAlign:'left', padding:6 }}>Deal ID</th>
                    <th style={{ textAlign:'left', padding:6 }}>Lead</th>
                    <th style={{ textAlign:'left', padding:6 }}>Email</th>
                    <th style={{ textAlign:'left', padding:6 }}>Amount</th>
                    <th style={{ textAlign:'left', padding:6 }}>Closed at</th>
                    <th style={{ textAlign:'left', padding:6 }}>Status</th>
                    <th style={{ textAlign:'left', padding:6 }}>Touches</th>
                    <th style={{ textAlign:'left', padding:6 }}>First touch</th>
                    <th style={{ textAlign:'left', padding:6 }}>Last touch</th>
                    <th style={{ textAlign:'left', padding:6 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                {rows.map((r:any)=>{
                  return (
                    <tr key={r.deal_id} style={{ borderTop:'1px solid #eee' }}>
                      <td style={{ padding:6 }}>{r.deal_external_id || r.deal_id}</td>
                      <td style={{ padding:6 }}>{r.lead_name || `#${r.lead_id}`}</td>
                      <td style={{ padding:6 }}>{r.lead_email || '-'}</td>
                      <td style={{ padding:6 }}>{r.amount}</td>
                      <td style={{ padding:6 }}>{r.closed_at ? new Date(r.closed_at).toLocaleString() : '-'}</td>
                      <td style={{ padding:6 }}>{r.status}</td>
                      <td style={{ padding:6 }}>
                        {r.touchCount===0 ? (
                          <span style={{ background:'#fee', color:'#900', padding:'2px 6px', borderRadius:6 }}>0 touches</span>
                        ) : r.touchCount===1 ? (
                          <span style={{ background:'#eef', color:'#224', padding:'2px 6px', borderRadius:6 }}>single</span>
                        ) : r.touchCount}
                      </td>
                      <td style={{ padding:6 }}>{r.firstTouchAt ? new Date(r.firstTouchAt).toLocaleString() : '-'}</td>
                      <td style={{ padding:6 }}>{r.lastTouchAt ? new Date(r.lastTouchAt).toLocaleString() : '-'}</td>
                      <td style={{ padding:6 }}>
                        <button className="btn-ghost" style={{ fontSize:11 }} onClick={()=>onPickDeal(r)}>View Journey</button>
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
              <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:8 }}>
                <button className="btn-ghost" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Prev</button>
                <span style={{ fontSize:12 }}>Page {page} of {totalPages}</span>
                <button className="btn-ghost" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Next</button>
              </div>
            </>
          )}
        </div>

        {journeyOpen && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}>
            <div style={{ background:'#fff', borderRadius:8, padding:16, width:640, maxHeight:'80vh', overflow:'auto' }}>
              <h3 style={{ marginTop:0 }}>Journey</h3>
              {journeyError && (<div style={{ background:'#fee', color:'#900', padding:'8px 10px', border:'1px solid #f99', borderRadius:6, marginBottom:8 }}>Could not load journey: {journeyError}</div>)}
              {!journey && !journeyError && (<div style={{ fontSize:12 }}>Loading journey...</div>)}
              {journey && (
                <>
                  <div style={{ fontSize:12, marginBottom:8, color:'#555' }}>
                    Deal: {journey.deal?.external_id || journey.deal?.id} • Amount: {journey.deal?.amount} • Closed: {journey.deal?.closed_at ? new Date(journey.deal.closed_at).toLocaleString() : '-'} • Status: {journey.deal?.status}
                  </div>
                  {journey.lead && (
                    <div style={{ fontSize:12, marginBottom:8 }}>Lead: {journey.lead.name || '(unknown)'} {journey.lead.email? `• ${journey.lead.email}`:''} {journey.lead.company? `• ${journey.lead.company}`:''}</div>
                  )}
                  {(!journey.journey || journey.journey.length===0) ? (
                    <div style={{ background:'#f7f7f7', padding:10, borderRadius:6, fontSize:12 }}>
                      No campaign touches found before deal close. This deal will be unattributed unless more data is added.
                    </div>
                  ) : (
                    <table style={{ width:'100%', fontSize:12, borderCollapse:'collapse' }}>
                      <thead>
                        <tr style={{ background:'#f5f5f5' }}>
                          <th style={{ textAlign:'left', padding:6 }}>Touched at</th>
                          <th style={{ textAlign:'left', padding:6 }}>Campaign</th>
                          <th style={{ textAlign:'left', padding:6 }}>Channel</th>
                          <th style={{ textAlign:'left', padding:6 }}>Type</th>
                        </tr>
                      </thead>
                      <tbody>
                      {journey.journey.map((t:any, idx:number)=> (
                        <tr key={idx} style={{ borderTop:'1px solid #eee' }}>
                          <td style={{ padding:6 }}>{new Date(t.touched_at).toLocaleString()}</td>
                          <td style={{ padding:6 }}>{t.campaignName || t.campaign_id}</td>
                          <td style={{ padding:6 }}>{t.channel || 'other'}</td>
                          <td style={{ padding:6 }}>{t.type || '-'}</td>
                        </tr>
                      ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
              <div style={{ marginTop:12, display:'flex', justifyContent:'flex-end' }}>
                <button className="btn-ghost" onClick={()=>{ setJourneyOpen(false); setSelectedDealId(null); setJourney(null); }}>Close</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </Layout>
  );
}
