import { useEffect, useState } from "react";
import Layout from '../../../components/Layout';
import "../auth/auth.css";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function WorkspacesList(){
  const [list, setList] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(()=>{(async()=>{
    try{
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/workspaces`,{ headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if(!res.ok) throw new Error(data?.error||'Failed');
      setList(data.workspaces||[]);
    }catch(e:any){ setError(e.message); }
    setLoading(false);
  })()},[]);

  return (
    <Layout>
      <div className="container-centered">
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>Your Workspaces</h2>
          {loading && <div>Loading...</div>}
          {error && <div className="auth-error">{error}</div>}
          {!loading && !error && (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {list.length===0 && <div>No workspaces yet</div>}
              {list.map(w=> (
                <div key={w.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center', padding:12, borderBottom:'var(--outline)'}}>
                  <div>
                    <div style={{fontWeight:600}}>{w.name}</div>
                    <div style={{fontSize:12,color:'var(--text-muted)'}}>Share ID: <strong>{w.shareId || ''}</strong></div>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button className="btn-primary btn-sm" onClick={()=> navigator.clipboard?.writeText(w.shareId || '')}>Copy ID</button>
                    <button className="btn-ghost btn-sm" onClick={()=> window.location.hash = `#/workspace/${w.id}`}>View</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
