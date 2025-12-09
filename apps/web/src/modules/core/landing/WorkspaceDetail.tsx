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
  const [, setLoading] = useState(true);
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
        {/* Page heading */}
        <div className="p-20">
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#0B2540' }}>Workspace Home</h1>
        </div>
        {/* Module cards - navigate to each module home (primary content) */}
        <section className="p-20" style={{ paddingTop: 8 }}>
          <h3 style={{ marginBottom: 12 }}>Modules</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {(() => {
              const moduleNames = [
                'Module 1 — Lead Ingestion, Cleaning & AI Scoring',
                'Module 2 — Intent Extraction & Categorization',
                'Module 3 — Conversation Intelligence & Thread Sentiment Analysis',
                'Module 4 — Guided Assistant (Workflow Runner)',
                'Module 5 — Sales & Marketing Alignment Dashboard',
                'Module 6 — Revenue Attribution & ROI Modeling',
                'Module 7 — Funnel Leakage & Campaign Fatigue Predictor',
                'MODULE 8 — Executive Proposal & Insight Report Generator',
                'Module 9 — Campaign Performance Aggregation & Optimization',
              ];
              return Array.from({ length: 9 }).map((_, i) => {
                const mod = i + 1;
                let path;
                if (mod === 1) path = `#/workspace/${id}/m01`;
                else if (mod === 7) path = `#/workspace/${id}/module7`;
                else path = `#/workspace/${id}/m0${mod}`;
                const name = moduleNames[i] || `Module ${mod}`;
                return (
                  <div key={mod} className="module-card" role="button" tabIndex={0} onClick={() => window.location.hash = path} onKeyDown={(e)=>{ if(e.key==='Enter') window.location.hash = path; }}>
                    <div className="label">{name}</div>
                    <div className="muted">Open Module {mod} tools and reports</div>
                  </div>
                );
              })
            })()}
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


