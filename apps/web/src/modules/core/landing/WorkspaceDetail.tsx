import { useEffect, useState } from "react";
import Layout from '../../../components/Layout';
import "../auth/auth.css";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function useParamsHash(){
  const hash = window.location.hash || '';
  const m = hash.match(/#\/workspace\/(.+)/);
  return m ? m[1] : null;
}

export default function WorkspaceDetail(){
  const id = useParamsHash();
  const [loading, setLoading] = useState(true);
  const [shareId, setShareId] = useState<string|null>(null);

  useEffect(()=>{(async()=>{
    if(!id) { setLoading(false); return; }
    try{
      const token = localStorage.getItem('token');
      // Fetch workspace shareId for display
      try{
        const res3 = await fetch(`${API_URL}/workspaces`,{ headers: { Authorization: `Bearer ${token}` } });
        const d3 = await res3.json();
        if(res3.ok){
          const found = (d3.workspaces||[]).find((w:any)=> w.id === id);
          if(found) setShareId(found.shareId || null);
        }
      }catch(e){ /* ignore */ }
    }catch(e:any){ /* ignore */ }
    setLoading(false);
  })()},[id]);
  // WorkspaceDetail now serves as a high-level overview only; detailed
  // member management lives in the dedicated WorkspaceMembers screen.

  return (
    <Layout>
      <main className="page-root">
        {/* Hero */}
        <div className="hero" style={{ backgroundImage: "url('/src/assets/hero-image.png')" }}>
          <h1>Workspace Overview</h1>
          <p>Use the workspace navigation bar above to access modules and members.</p>
        </div>

        {/* Info cards (static, non-dynamic) */}
        <section className="p-20">
          <div className="stats-grid">
            <div className="stats-card">
              <div className="label">Uploads</div>
              <div className="muted">Manage source CSVs for your workspace.</div>
            </div>
            <div className="stats-card">
              <div className="label">Merged CSVs</div>
              <div className="muted">Combine, deduplicate, and normalize columns.</div>
            </div>
            <div className="stats-card">
              <div className="label">Leads Code</div>
              <div className="muted">Generate prediction CSVs and review outputs.</div>
            </div>
            <div className="stats-card">
              <div className="label">Members</div>
              <div className="muted">View all members; admins can edit roles.</div>
            </div>
          </div>
        </section>

        {/* Share ID and Admin panels */}
  <section className="p-20">
          <div className="mb-12">
            <div className="muted" style={{ fontSize: 13 }}>Workspace Share ID</div>
            <div className="font-700">{shareId || '—'} <button className="btn-primary btn-sm ml-8" onClick={() => shareId && navigator.clipboard?.writeText(shareId)}>Copy</button></div>
          </div>
        </section>

        {/* Overview only; members/admin tools live on the dedicated Members page via the workspace header. */}
      </main>
    </Layout>
  );
}


