import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getWorkspaceIdFromHash } from '../../utils/workspace';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const MAX_PREVIEW_ROWS = 200;
const PREVIEW_PAGE_SIZE = 12;

type WizardKind = 'leads' | 'behaviors';

export default function UploadWizard(){
  const workspaceId = getWorkspaceIdFromHash();
  const [kind, setKind] = useState<WizardKind>('leads');
  const [csvText, setCsvText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [headersPreview, setHeadersPreview] = useState<string[]>([]);
  const [rowsPreview, setRowsPreview] = useState<string[][]>([]);
  const [totalPreviewRows, setTotalPreviewRows] = useState(0);
  const [previewLimited, setPreviewLimited] = useState(false);
  const [blankRowCount, setBlankRowCount] = useState(0);
  const [previewPage, setPreviewPage] = useState(0);
  const [headerError, setHeaderError] = useState<string|null>(null);
  const [mappingConfirmed, setMappingConfirmed] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string|null>(null);
  const [toast, setToast] = useState<{msg:string,type:'success'|'error'}|null>(null);

  // Leads + Intent mapping
  const [mapLeadId, setMapLeadId] = useState('lead_id');
  const [mapIntentScore, setMapIntentScore] = useState('intent_score');
  const [mapIntentSegment, setMapIntentSegment] = useState('intent_segment');
  const [mapFullName, setMapFullName] = useState('full_name');
  const [mapJobTitle, setMapJobTitle] = useState('job_title');
  const [mapCompany, setMapCompany] = useState('company');
  const [mapLocation, setMapLocation] = useState('location');

  // Behaviors mapping
  const [mapBLeadId, setMapBLeadId] = useState('lead_id');
  const [mapTimestamp, setMapTimestamp] = useState('timestamp');
  const [mapEventType, setMapEventType] = useState('event_type');
  const [mapEngagementScore, setMapEngagementScore] = useState('engagement_score');
  const [mapSpikeFlag, setMapSpikeFlag] = useState('spike_flag');
  const [mapDropFlag, setMapDropFlag] = useState('drop_flag');

  const [startRow, setStartRow] = useState(1);
  const [endRow, setEndRow] = useState<number|undefined>(undefined);
  const leadsRef = useRef<HTMLInputElement | null>(null);
  const behaviorsRef = useRef<HTMLInputElement | null>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files && e.target.files[0];
    setFile(f || null);
    if(!f){
      resetState();
      return;
    }
    if(!f.name.toLowerCase().endsWith('.csv')){ setToast({ msg:'Please select a .csv file', type:'error' }); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      setCsvText(text);
      const normalized = text.replace(/\r\n?/g,'\n');
      const lines = normalized.split('\n');
      const headerLine = lines[0] || '';
      const cols = headerLine.split(',').map(s=>s.trim());
      setHeadersPreview(cols);
      const dataLines = lines.slice(1);
      const nonBlankLines = dataLines.filter(l=>l.trim().length>0);
      const limitedRows = nonBlankLines.slice(0, MAX_PREVIEW_ROWS).map(line => line.split(',').map(s=>s.trim()));
      setRowsPreview(limitedRows);
      setTotalPreviewRows(nonBlankLines.length);
      setPreviewLimited(nonBlankLines.length > MAX_PREVIEW_ROWS);
      setBlankRowCount(dataLines.length - nonBlankLines.length);
      setPreviewPage(0);
      const lowerCols = cols.map(c => c.toLowerCase());

      const pickHeader = (current: string, candidates: string[], fallbackIndex?: number) => {
        if(current && cols.includes(current)) return current;
        for(const c of candidates){
          const idx = lowerCols.indexOf(c);
          if(idx !== -1) return cols[idx];
        }
        if(fallbackIndex !== undefined && cols[fallbackIndex]) return cols[fallbackIndex];
        return '';
      };

      // auto-map common variants for both kinds
      setMapLeadId(prev => pickHeader(prev, ['lead_id','lead id','lead','id']));
      setMapIntentScore(prev => pickHeader(prev, ['intent_score','intent score','intent']));
      setMapIntentSegment(prev => pickHeader(prev, ['intent_segment','intent segment','segment']));
      setMapFullName(prev => pickHeader(prev, ['full_name','name','full name']));
      setMapJobTitle(prev => pickHeader(prev, ['job_title','title','job title']));
      setMapCompany(prev => pickHeader(prev, ['company','org','organization']));
      setMapLocation(prev => pickHeader(prev, ['location','city','country','region']));

      setMapBLeadId(prev => pickHeader(prev, ['lead_id','lead id','lead','id']));
      setMapTimestamp(prev => pickHeader(prev, ['timestamp','time','date','datetime']));
      setMapEventType(prev => pickHeader(prev, ['event_type','event type','type','event']));
      setMapEngagementScore(prev => pickHeader(prev, ['engagement_score','engagement score','eng']));
      setMapSpikeFlag(prev => pickHeader(prev, ['spike_flag','spike flag','spike']));
      setMapDropFlag(prev => pickHeader(prev, ['drop_flag','drop flag','drop']));

      if(cols.length < 2) setHeaderError('Could not detect valid headers. Ensure first row has column names.'); else setHeaderError(null);
    };
    reader.readAsText(f);
  }

  function resetState(){
    setHeadersPreview([]); setRowsPreview([]); setTotalPreviewRows(0); setPreviewPage(0); setPreviewLimited(false); setBlankRowCount(0); setCsvText(''); setSubmitStatus(null); setMappingConfirmed(false); setHeaderError(null);
  }

  const previewPageCount = rowsPreview.length ? Math.ceil(rowsPreview.length / PREVIEW_PAGE_SIZE) : 1;
  const currentPreviewPage = rowsPreview.length ? Math.min(previewPage, previewPageCount - 1) : 0;
  const previewPageRows = rowsPreview.slice(currentPreviewPage * PREVIEW_PAGE_SIZE, (currentPreviewPage * PREVIEW_PAGE_SIZE) + PREVIEW_PAGE_SIZE);
  const previewStartIndex = rowsPreview.length ? (currentPreviewPage * PREVIEW_PAGE_SIZE) + 1 : 0;
  const previewEndIndex = rowsPreview.length ? Math.min(rowsPreview.length, previewStartIndex + PREVIEW_PAGE_SIZE - 1) : 0;

  function resolveHeader(value: string|null|undefined){
    if(!value) return null;
    const exact = headersPreview.find(h => h === value);
    if(exact) return exact;
    const lower = value.toLowerCase();
    const match = headersPreview.find(h => h.toLowerCase() === lower);
    return match || null;
  }

  function verifyMappings(){
    const missing: string[] = [];
    if(kind==='leads'){
      if(!mapLeadId) missing.push('lead_id');
      if(!mapIntentScore) missing.push('intent_score');
      if(!mapIntentSegment) missing.push('intent_segment');
      const resolved = {
        lead_id: resolveHeader(mapLeadId),
        intent_score: resolveHeader(mapIntentScore),
        intent_segment: resolveHeader(mapIntentSegment),
        full_name: resolveHeader(mapFullName),
        job_title: resolveHeader(mapJobTitle),
        company: resolveHeader(mapCompany),
        location: resolveHeader(mapLocation),
      };
      if(!resolved.lead_id || !resolved.intent_score || !resolved.intent_segment){ setToast({ msg:`Missing required mappings: ${missing.join(', ')}`, type:'error' }); return null; }
      return resolved;
    } else {
      if(!mapBLeadId) missing.push('lead_id');
      if(!mapTimestamp) missing.push('timestamp');
      if(!mapEventType) missing.push('event_type');
      const resolved = {
        lead_id: resolveHeader(mapBLeadId),
        timestamp: resolveHeader(mapTimestamp),
        event_type: resolveHeader(mapEventType),
        engagement_score: resolveHeader(mapEngagementScore),
        spike_flag: resolveHeader(mapSpikeFlag),
        drop_flag: resolveHeader(mapDropFlag),
      };
      if(!resolved.lead_id || !resolved.timestamp || !resolved.event_type){ setToast({ msg:`Missing required mappings: ${missing.join(', ')}`, type:'error' }); return null; }
      return resolved;
    }
  }

  function transformCsv(resolvedMap: Record<string, string|null>){
    if(!csvText.trim()) return '';
    const normalized = csvText.replace(/\r\n?/g,'\n');
    const lines = normalized.split('\n');
    if(lines.length === 0) return '';
    const origHeader = lines[0].split(',');
    const lowerOrig = origHeader.map(h => h.toLowerCase());

    const renameMap: Record<string,string> = {};
    Object.entries(resolvedMap).forEach(([canonical, source]) => {
      if(!source) return;
      const idx = lowerOrig.indexOf(String(source).toLowerCase());
      if(idx !== -1){ renameMap[origHeader[idx]] = canonical; }
    });

    const newHeader = origHeader.map(h => renameMap[h] || h);

    // Select range
    const start = Math.max(1, Number(startRow || 1));
    const end = endRow && Number(endRow) ? Number(endRow) : lines.length - 1;
    const selectedBody = lines.slice(start, Math.min(lines.length, end + 1));

    return [newHeader.join(','), ...selectedBody].join('\n');
  }

  async function submit(){
    if(!workspaceId){ setToast({ msg:'Workspace required', type:'error' }); return; }
    if(!csvText.trim()){ setToast({ msg:'Upload a CSV file first', type:'error' }); return; }
    const resolved = verifyMappings();
    if(!resolved) return;
    if(!mappingConfirmed){ setToast({ msg:'Confirm mappings to proceed', type:'error' }); return; }
    const transformed = transformCsv(resolved as any);
    if(!transformed){ setToast({ msg:'Could not transform CSV', type:'error' }); return; }
    setSubmitStatus(null);
    try{
      const blob = new Blob([transformed], { type: 'text/csv' });
      const form = new FormData();
      form.append('file', blob, kind === 'leads' ? 'leads_intent.csv' : 'behaviors.csv');
      form.append('workspaceId', workspaceId);
      const url = kind === 'leads' ? `${API_URL}/m02/upload/leads-intent` : `${API_URL}/m02/upload/behaviors`;
      const res = await fetch(url, { method: 'POST', body: form });
      const j = await res.json();
      if(!res.ok || !j?.ok){ setToast({ msg: j?.error || 'Upload failed', type:'error' }); }
      else {
        setSubmitStatus(`Imported ${j.importedCount || 0}, skipped ${j.skippedCount || 0}`);
        setToast({ msg:'Upload complete', type:'success' });
      }
    }catch(e:any){ setToast({ msg: String(e?.message || 'Upload failed'), type:'error' }); }
  }

  return (
    <Layout>
      <main className="page-root">
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <ModuleBackButton toSuffix="" />
          <div>
            <h2 style={{ marginTop:16 }}>Module 2 — Upload Wizard</h2>
            <div style={{ fontSize:12, color:'#555' }}>Preview and map headers before import. Required columns will be renamed to the expected schema on upload.</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn-ghost btn-sm" onClick={() => { setKind('leads'); leadsRef.current?.click(); }}>Upload Leads CSV</button>
            <button className="btn-ghost btn-sm" onClick={() => { setKind('behaviors'); behaviorsRef.current?.click(); }}>Upload Behavior CSV</button>
            <button className="btn-ghost btn-sm" onClick={() => { setCsvText(''); setFile(null); resetState(); }}>Reset</button>
          </div>
          <input type="file" accept=".csv" style={{ display: 'none' }} ref={leadsRef as any} onChange={(e)=>{ const f = (e.target as HTMLInputElement).files?.[0]; if(f){ setKind('leads'); onFileChange(e as any); } }} />
          <input type="file" accept=".csv" style={{ display: 'none' }} ref={behaviorsRef as any} onChange={(e)=>{ const f = (e.target as HTMLInputElement).files?.[0]; if(f){ setKind('behaviors'); onFileChange(e as any); } }} />
        </div>

        <div className="card" style={{ marginTop:12, padding:12 }}>
          <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ fontSize:12 }}>Select upload type</div>
            <div style={{ display:'flex', gap:8 }}>
              <label style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                <input type="radio" name="kind" checked={kind==='leads'} onChange={()=>{ setKind('leads'); resetState(); }} />
                Leads + Intent
              </label>
              <label style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                <input type="radio" name="kind" checked={kind==='behaviors'} onChange={()=>{ setKind('behaviors'); resetState(); }} />
                Behavior Events
              </label>
            </div>
          </div>

          <div style={{ marginTop:8 }}>
            <input type="file" accept=".csv" onChange={onFileChange} />
          </div>
          {headerError && <div style={{ color:'#c33', fontSize:12 }}>{headerError}</div>}
          {!headerError && headersPreview.length > 0 && <div style={{ fontSize:12 }}>Detected headers: {headersPreview.join(', ')}</div>}

          {rowsPreview.length > 0 && (
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:12, marginBottom:6 }}>Previewing rows {previewStartIndex}-{previewEndIndex} of {rowsPreview.length}{previewLimited ? ` (showing first ${rowsPreview.length} of ${totalPreviewRows})` : totalPreviewRows ? ` (total rows: ${totalPreviewRows})` : ''}{blankRowCount>0?` • Blank lines skipped: ${blankRowCount}`:''}</div>
              <div style={{ overflowX:'auto', border:'1px solid #e5e7eb', borderRadius:6 }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'#f8f9fb' }}>
                      {headersPreview.map((h, idx)=>(<th key={idx} style={{ padding:8, borderBottom:'1px solid #e2e8f0', textAlign:'left', fontSize:12 }}>{h}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewPageRows.map((row, rIdx)=>(
                      <tr key={rIdx} style={{ background: rIdx % 2 === 0 ? '#fff' : '#fafbff' }}>
                        {headersPreview.map((_, cIdx)=>(<td key={cIdx} style={{ padding:8, borderBottom:'1px solid #edf2f7', fontSize:12 }}>{row[cIdx] ?? ''}</td>))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rowsPreview.length > PREVIEW_PAGE_SIZE && (
                <div style={{ marginTop:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ fontSize:11, color:'#555' }}>Page {currentPreviewPage + 1} of {previewPageCount}</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button className="btn-ghost" disabled={currentPreviewPage===0} onClick={()=>setPreviewPage(p=>Math.max(0,p-1))}>Prev</button>
                    <button className="btn-ghost" disabled={currentPreviewPage>=previewPageCount-1} onClick={()=>setPreviewPage(p=>Math.min(previewPageCount-1,p+1))}>Next</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12, marginTop:12 }}>
            {kind==='leads' ? (
              <>
                <div>
                  <div style={{ fontSize:12 }}>Lead ID header *</div>
                  <input list="m02-headers" value={mapLeadId} onChange={e=>setMapLeadId(e.target.value)} placeholder="Column name" style={{ width:'100%' }} />
                </div>
                <div>
                  <div style={{ fontSize:12 }}>Intent score header *</div>
                  <input list="m02-headers" value={mapIntentScore} onChange={e=>setMapIntentScore(e.target.value)} placeholder="Column name" style={{ width:'100%' }} />
                </div>
                <div>
                  <div style={{ fontSize:12 }}>Intent segment header *</div>
                  <input list="m02-headers" value={mapIntentSegment} onChange={e=>setMapIntentSegment(e.target.value)} placeholder="Column name" style={{ width:'100%' }} />
                </div>
                <div>
                  <div style={{ fontSize:12 }}>Full name header</div>
                  <input list="m02-headers" value={mapFullName} onChange={e=>setMapFullName(e.target.value)} placeholder="Optional" style={{ width:'100%' }} />
                </div>
                <div>
                  <div style={{ fontSize:12 }}>Job title header</div>
                  <input list="m02-headers" value={mapJobTitle} onChange={e=>setMapJobTitle(e.target.value)} placeholder="Optional" style={{ width:'100%' }} />
                </div>
                <div>
                  <div style={{ fontSize:12 }}>Company header</div>
                  <input list="m02-headers" value={mapCompany} onChange={e=>setMapCompany(e.target.value)} placeholder="Optional" style={{ width:'100%' }} />
                </div>
                <div>
                  <div style={{ fontSize:12 }}>Location header</div>
                  <input list="m02-headers" value={mapLocation} onChange={e=>setMapLocation(e.target.value)} placeholder="Optional" style={{ width:'100%' }} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <div style={{ fontSize:12 }}>Lead ID header *</div>
                  <input list="m02-headers" value={mapBLeadId} onChange={e=>setMapBLeadId(e.target.value)} placeholder="Column name" style={{ width:'100%' }} />
                </div>
                <div>
                  <div style={{ fontSize:12 }}>Timestamp header *</div>
                  <input list="m02-headers" value={mapTimestamp} onChange={e=>setMapTimestamp(e.target.value)} placeholder="YYYY-MM-DD HH:MM:SS" style={{ width:'100%' }} />
                </div>
                <div>
                  <div style={{ fontSize:12 }}>Event type header *</div>
                  <input list="m02-headers" value={mapEventType} onChange={e=>setMapEventType(e.target.value)} placeholder="Column name" style={{ width:'100%' }} />
                </div>
                <div>
                  <div style={{ fontSize:12 }}>Engagement score header</div>
                  <input list="m02-headers" value={mapEngagementScore} onChange={e=>setMapEngagementScore(e.target.value)} placeholder="Optional" style={{ width:'100%' }} />
                </div>
                <div>
                  <div style={{ fontSize:12 }}>Spike flag header</div>
                  <input list="m02-headers" value={mapSpikeFlag} onChange={e=>setMapSpikeFlag(e.target.value)} placeholder="Optional" style={{ width:'100%' }} />
                </div>
                <div>
                  <div style={{ fontSize:12 }}>Drop flag header</div>
                  <input list="m02-headers" value={mapDropFlag} onChange={e=>setMapDropFlag(e.target.value)} placeholder="Optional" style={{ width:'100%' }} />
                </div>
              </>
            )}
            <div>
              <div style={{ fontSize:12 }}>Start row</div>
              <input type="number" min={1} value={String(startRow)} onChange={e=>setStartRow(Number(e.target.value||1))} style={{ width:'100%' }} />
            </div>
            <div>
              <div style={{ fontSize:12 }}>End row</div>
              <input type="number" min={1} placeholder="auto" value={endRow!==undefined?String(endRow):''} onChange={e=>setEndRow(e.target.value?Number(e.target.value):undefined)} style={{ width:'100%' }} />
            </div>
          </div>
          <datalist id="m02-headers">
            {headersPreview.map(h=> (<option key={h} value={h} />))}
          </datalist>

          <label style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop:12 }}>
            <input type="checkbox" checked={mappingConfirmed} onChange={e=>setMappingConfirmed(e.target.checked)} />
            <span style={{ fontSize:12 }}>I have reviewed my mappings and confirm they are correct.</span>
          </label>

          <div style={{ marginTop:12 }}>
            <button className="btn-primary" onClick={submit}>Upload CSV</button>
            <button className="btn-ghost" onClick={()=>{ setCsvText(''); setFile(null); resetState(); }}>Cancel</button>
          </div>

          {submitStatus && <div style={{ marginTop:8 }}>{submitStatus}</div>}
        </div>

        {toast && (
          <div style={{ position:'fixed', right:16, bottom:16, background:toast.type==='success'?'#0a7':'#c33', color:'#fff', padding:'10px 14px', borderRadius:8 }}>
            <div>{toast.msg}</div>
            <button className="btn-ghost" style={{ marginTop:6, background:'#fff', color:'#333' }} onClick={()=>setToast(null)}>Close</button>
          </div>
        )}
      </main>
    </Layout>
  );
}
