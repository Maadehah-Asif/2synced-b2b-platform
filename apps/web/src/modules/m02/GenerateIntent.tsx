import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

import { getWorkspaceIdFromHash } from '../../utils/workspace';

export default function GenerateIntent(){
  const [workspace] = useState<string|null>(() => getWorkspaceIdFromHash());
  const [files, setFiles] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [info, setInfo] = useState<any|null>(null);
  const [message, setMessage] = useState<string|null>(null);
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState<string|null>(null);
  const [preview, setPreview] = useState<any|null>(null);

  useEffect(()=>{ fetchList(); }, [workspace]);

  async function fetchList(){
    if (!workspace) { setMessage('Workspace required'); return; }
    try{
      const res = await fetch(`${API_URL}/m02/lead-score-files?workspace=${workspace}`);
      const j = await res.json();
      if (j?.ok) setFiles(j.items || []); else setMessage(j?.error || 'failed to load');
    }catch(e){ setMessage('network error'); }
  }

  function onSelect(id:string){
    setSelected(id);
    const f = files.find(x => String(x._id) === String(id));
    setInfo(f || null);
  }

  async function onGenerate(){
    if (!workspace || !selected) return setMessage('select a dataset first');
    setRunning(true); setMessage(null); setPreview(null);
    try{
      const res = await fetch(`${API_URL}/m02/generate-intent`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ leadScoreFileId: selected, workspace })
      });
      const j = await res.json();
      if (!j?.ok) { setMessage(j?.error || 'failed'); setRunning(false); return; }
      setRunId(j.intentRunId);
      // poll for preview availability
      const id = j.intentRunId;
      const start = Date.now();
      let done = false;
      while (!done && Date.now()-start < 1000*60*3) {
        await new Promise(r=>setTimeout(r, 1500));
        const p = await fetch(`${API_URL}/m02/intent-runs/${id}/preview?perPage=10&page=1`);
        if (p.status === 200) {
          const pj = await p.json();
          if (pj?.ok) { setPreview(pj); done = true; break; }
        }
      }
      setRunning(false);
      if (!done) setMessage('Processing started — preview not ready yet. Check history later.');
    }catch(e){ setMessage('network error'); setRunning(false); }
  }

  return (
    <Layout>
      <div className="p-20">
        <div style={{ display:'flex', alignItems:'center' }}>
          <ModuleBackButton toSuffix="/m02" />
          <h2 style={{ margin:0 }}>Generate Intent Scores</h2>
        </div>
        <div className="mt-8">Select a lead-score dataset and generate intent scores.</div>

        <div className="mt-12">
          <label>Dataset</label>
          <select style={{ display:'block', marginTop:8 }} value={selected||''} onChange={(e)=>onSelect(e.target.value)}>
            <option value="">-- select dataset --</option>
            {files.map(f => (
              <option key={f._id} value={f._id}>{(f.name || f.filename) + ' — ' + new Date(f.createdAt).toLocaleString()}</option>
            ))}
          </select>
        </div>

        {info && (
          <div className="mt-12 box-muted">
            <div><strong>Name:</strong> {info.name || info.filename}</div>
            <div><strong>Created at:</strong> {new Date(info.createdAt).toLocaleString()}</div>
            <div><strong>Workspace:</strong> {String(info.workspace)}</div>
            <div style={{ marginTop:8 }}><button onClick={onGenerate} disabled={running}>Generate Intent Scores</button></div>
          </div>
        )}

        {running && (
          <div className="mt-12">Running intent scoring engine... (this may take a little while)</div>
        )}

        {message && <div className="mt-12 muted">{message}</div>}

        {preview && (
          <div className="mt-12">
            <h3>Preview (first rows)</h3>
            <div style={{ overflowX:'auto' }}>
              <table className="simple-table">
                <thead>
                  <tr>{(preview.header || []).map((h:string,i:number) => <th key={i}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {(preview.rows || []).map((r:any,ri:number) => (
                    <tr key={ri}>{r.map((c:any,ci:number)=>(<td key={ci}>{c}</td>))}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-8">
              <a href={`${API_URL}/m02/intent-runs/${runId}/preview?perPage=100&page=1`} target="_blank">Open preview (raw)</a>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
