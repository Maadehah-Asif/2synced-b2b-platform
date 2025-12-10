import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { useEffect, useMemo, useState } from 'react';
import { fetchModule6Leads, importModule6LeadsCSV } from './services/leads';

const MAX_PREVIEW_ROWS = 200;
const PREVIEW_PAGE_SIZE = 12;

export default function Module6Leads(){
  const [csvText, setCsvText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [headersPreview, setHeadersPreview] = useState<string[]>([]);
  const [rowsPreview, setRowsPreview] = useState<string[][]>([]);
  const [totalPreviewRows, setTotalPreviewRows] = useState(0);
  const [previewLimited, setPreviewLimited] = useState(false);
  const [blankRowCount, setBlankRowCount] = useState(0);
  const [previewPage, setPreviewPage] = useState(0);
  const [headerError, setHeaderError] = useState<string|null>(null);
  // Row number mapping removed per request
  const [mapLeadId, setMapLeadId] = useState('lead_id');
  const [mapName, setMapName] = useState('name');
  const [mapEmail, setMapEmail] = useState('email');
  const [startRow, setStartRow] = useState(1);
  const [endRow, setEndRow] = useState<number|undefined>(undefined);
  const [mappingConfirmed, setMappingConfirmed] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string|null>(null);
  const [importSummary, setImportSummary] = useState<any|null>(null);
  const [toast, setToast] = useState<{msg:string,type:'success'|'error'}|null>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files && e.target.files[0];
    setFile(f || null);
    if(!f){
      setHeadersPreview([]); setRowsPreview([]); setTotalPreviewRows(0); setPreviewPage(0); setPreviewLimited(false); setBlankRowCount(0); setCsvText(''); setImportSummary(null); setSubmitStatus(null); setMappingConfirmed(false);
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
      // Row number mapping removed
      setMapLeadId(prev => pickHeader(prev, ['lead_id','lead_external_id','lead id','lead','leadid']));
      setMapName(prev => pickHeader(prev, ['name','full_name','full name','first_name last_name']));
      setMapEmail(prev => pickHeader(prev, ['email','email_address','email address']));
      if(cols.length < 2) setHeaderError('Could not detect valid headers. Ensure first row has column names.'); else setHeaderError(null);
    };
    reader.readAsText(f);
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
    if(!mapLeadId) missing.push('lead_id');
    if(missing.length){ setToast({ msg:`Missing required mappings: ${missing.join(', ')}`, type:'error' }); return null; }
    const resolved = {
      // row_number removed
      lead_id: resolveHeader(mapLeadId),
      name: resolveHeader(mapName),
      email: resolveHeader(mapEmail),
    };
    if(!resolved.lead_id){ setToast({ msg:`Mapped header not found for lead_id: ${mapLeadId}`, type:'error' }); return null; }
    return resolved;
  }

  async function submitCsv(){
    if(!csvText.trim()){ setToast({ msg:'Upload a CSV file first', type:'error' }); return; }
    const resolved = verifyMappings();
    if(!resolved) return;
    if(!mappingConfirmed){ setToast({ msg:'Confirm mappings to proceed', type:'error' }); return; }
    const first = Number(startRow || 1);
    const last = endRow ? Number(endRow) : undefined;
    if(first < 1){ setToast({ msg:'Start row must be at least 1', type:'error' }); return; }
    if(last !== undefined && last < first){ setToast({ msg:'End row must be greater than or equal to start row', type:'error' }); return; }
    setSubmitStatus(null);
    try{
      // Reduce payload size: send only selected rows with header
      const normalized = csvText.replace(/\r\n?/g,'\n');
      const lines = normalized.split('\n');
      const header = lines[0] || '';
      const lastRowIndex = last !== undefined ? last : (lines.length - 1);
      const selected = [header, ...lines.slice(first, lastRowIndex + 1)];
      const csvToSend = selected.join('\n');
      const payload = { csv: csvToSend, map: resolved, startRow: 1, endRow: (lastRowIndex - first + 1) };
      const res = await importModule6LeadsCSV(payload);
      setImportSummary(res);
      setSubmitStatus(`Processed ${res.processed || 0}, inserted ${res.inserted || 0}, failed ${res.failed || 0}`);
      if(res.inserted) setToast({ msg:`Inserted ${res.inserted} leads`, type:'success' });
      else if(res.failed) setToast({ msg:`Import finished with ${res.failed} failures`, type:'error' });
    }catch(e:any){
      const msg = typeof e?.message === 'string' ? e.message : 'Import failed';
      setToast({ msg, type:'error' });
    }
  }

  return (
    <Layout>
      <main className="page-root">
        <ModuleBackButton toSuffix="/m06" />
        <h2 style={{ marginTop:16 }}>Module 6 — Leads</h2>
        <div style={{ fontSize:12, color:'#555' }}>Upload and manage Module 6 leads (collection `m06_leads`). Required import columns: `lead_id`.</div>
        <div style={{ marginTop:12, padding:12, background:'#fff', borderRadius:8 }}>
          <div style={{ marginBottom:8 }}>
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

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12, marginTop:12 }}>
            {/** Row number header UI removed */}
            <div>
              <div style={{ fontSize:12 }}>Lead ID header *</div>
              <input list="m06-leads-headers" value={mapLeadId} onChange={e=>setMapLeadId(e.target.value)} placeholder="Column name" style={{ width:'100%' }} />
            </div>
            <div>
              <div style={{ fontSize:12 }}>Name header</div>
              <input list="m06-leads-headers" value={mapName} onChange={e=>setMapName(e.target.value)} placeholder="Optional" style={{ width:'100%' }} />
            </div>
            <div>
              <div style={{ fontSize:12 }}>Email header</div>
              <input list="m06-leads-headers" value={mapEmail} onChange={e=>setMapEmail(e.target.value)} placeholder="Optional" style={{ width:'100%' }} />
            </div>
            <div>
              <div style={{ fontSize:12 }}>Start row</div>
              <input type="number" min={1} value={String(startRow)} onChange={e=>setStartRow(Number(e.target.value||1))} style={{ width:'100%' }} />
            </div>
            <div>
              <div style={{ fontSize:12 }}>End row</div>
              <input type="number" min={1} placeholder="auto" value={endRow!==undefined?String(endRow):''} onChange={e=>setEndRow(e.target.value?Number(e.target.value):undefined)} style={{ width:'100%' }} />
            </div>
          </div>
          <datalist id="m06-leads-headers">
            {headersPreview.map(h=> (<option key={h} value={h} />))}
          </datalist>

          <label style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop:12 }}>
            <input type="checkbox" checked={mappingConfirmed} onChange={e=>setMappingConfirmed(e.target.checked)} />
            <span style={{ fontSize:12 }}>I have reviewed my mappings and confirm they are correct.</span>
          </label>

          <div style={{ marginTop:12 }}>
            <button className="btn-primary" onClick={submitCsv}>Import CSV</button>
            <button className="btn-ghost" onClick={()=>{ setCsvText(''); setFile(null); setHeadersPreview([]); setRowsPreview([]); setImportSummary(null); setSubmitStatus(null); setMappingConfirmed(false); }}>Cancel</button>
          </div>

          {submitStatus && <div style={{ marginTop:8 }}>{submitStatus}</div>}
          {importSummary && (
            <div style={{ marginTop:12, background:'#f5f7fa', padding:12, borderRadius:8, fontSize:12 }}>
              <div style={{ fontWeight:600, marginBottom:4 }}>Import Summary</div>
              <div>Selected rows: {importSummary.selected}</div>
              <div>Created: {importSummary.inserted}</div>
              <div>Skipped: {importSummary.duplicates}</div>
              <div>Errors: {importSummary.failedRows ? importSummary.failedRows.length : 0}</div>
            </div>
          )}

          {toast && (
            <div style={{ position:'fixed', right:16, bottom:16, background:toast.type==='success'?'#0a7':'#c33', color:'#fff', padding:'10px 14px', borderRadius:8 }}>
              <div>{toast.msg}</div>
              <button className="btn-ghost" style={{ marginTop:6, background:'#fff', color:'#333' }} onClick={()=>setToast(null)}>Close</button>
            </div>
          )}
        </div>
      </main>
    </Layout>
  );
}
