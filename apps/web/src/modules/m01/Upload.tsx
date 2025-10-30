import { useEffect, useState } from "react";
import Layout from '../../components/Layout';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function getWorkspaceFromHash() {
  const m = window.location.hash.match(/workspace=([a-f0-9]+)/i);
  return m ? m[1] : null;
}

export default function Upload(){
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploads, setUploads] = useState<any[]>([]);
  const [previewRows, setPreviewRows] = useState<any[] | null>(null);
  const [workspace] = useState<string | null>(() => getWorkspaceFromHash());

  useEffect(() => {
    if(!workspace) return setMessage('Workspace context missing');
    fetch(`${API_URL}/m01/uploads?workspace=${workspace}`).then((r) => r.json()).then((j) => {
      if (j?.ok) setUploads(j.items || []);
    }).catch(() => {});
  }, [workspace]);

  async function handleSubmit(e: React.FormEvent){
    e.preventDefault();
    if(!workspace) return setMessage('Workspace missing');
    if(!file) return setMessage('Please choose a file');
    setMessage('Uploading...');
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('workspace', workspace);

    try{
      const res = await fetch(`${API_URL}/m01/uploads`,{ method: 'POST', body: fd });
      const j = await res.json();
      if(j?.ok){
        setMessage('Uploaded');
        const list = await (await fetch(`${API_URL}/m01/uploads?workspace=${workspace}`)).json();
        if(list?.ok) setUploads(list.items || []);
      } else {
        setMessage(j?.error || 'upload failed');
      }
    }catch(e){ setMessage('upload error'); }
  }

  async function handlePreview(id: string){
    setPreviewRows(null);
    try{
      const res = await fetch(`${API_URL}/m01/uploads/${id}/preview?rows=5&workspace=${workspace}`);
      const j = await res.json();
      if(j?.ok) setPreviewRows(j.rows || null);
      else setMessage(j?.error || 'preview failed');
    }catch(e){ setMessage('preview error'); }
  }

  function goBack(){
    if(workspace) window.location.hash = `#/workspace/${workspace}`;
    else window.location.hash = '#/landing';
  }

  return (
    <Layout>
      <main style={{ background: '#f3f6f9', padding: 20 }}>
        <div style={{ marginBottom: 12 }}>
          <button className="auth-button" onClick={goBack}>Back</button>
          <button className="auth-button" style={{ marginLeft: 8 }} onClick={() => window.location.hash = '#/landing'}>Landing</button>
        </div>

        <h2>Module 01 — Upload CSV</h2>

        <form onSubmit={handleSubmit}>
          <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button type="submit">Upload</button>
        </form>
        {message && <div style={{ marginTop: 8 }}>{message}</div>}

        <h3>Uploads</h3>
        <ul>
          {uploads.map((u:any) => (
            <li key={u._id} style={{ marginBottom: 8 }}>
              {u.filename} — {u.contentType} — {new Date(u.createdAt).toLocaleString()}
              <button style={{ marginLeft: 8 }} onClick={() => handlePreview(u._id)}>Preview</button>
            </li>
          ))}
        </ul>

        {previewRows && (
          <div>
            <h4>Preview</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {previewRows.map((r:any, i:number) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e6e9ef' }}>{r.map((c:any, j:number) => <td key={j} style={{ padding: 8 }}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </Layout>
  );
}
