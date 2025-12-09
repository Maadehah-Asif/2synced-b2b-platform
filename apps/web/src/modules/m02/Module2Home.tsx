import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { useState } from 'react';
import { getWorkspaceIdFromHash } from '../../utils/workspace';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Module2Home() {
  const wid = getWorkspaceIdFromHash();
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  function go(path: string) {
    if (wid) window.location.hash = path.replace(':workspaceId', wid);
    else window.location.hash = '#/workspaces';
  }

  async function seedDemo() {
    if (!wid) {
      window.location.hash = '#/workspaces';
      return setSeedMsg('workspace not found');
    }
    setSeeding(true);
    setSeedMsg(null);
    try {
      const res = await fetch(`${API_URL}/m02/seed-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace: wid })
      });
      const j = await res.json();
      setSeeding(false);
      if (j?.ok) {
        setSeedMsg(`Seed created runId=${j.runId}`);
        window.location.hash = `#/workspace/${wid}/m02/prioritization`;
      } else setSeedMsg(j?.error || 'seed failed');
    } catch (e) {
      setSeeding(false);
      setSeedMsg('network error');
    }
  }

  /* ------- CARD COMPONENT ------- */
  function Card({
    title,
    desc,
    onClick
  }: {
    title: string;
    desc: string;
    onClick: () => void;
  }) {
    return (
      <div
        onClick={onClick}
        style={{
          cursor: 'pointer',
          borderRadius: 14,
          padding: '26px 26px',
          background: 'linear-gradient(135deg, #0f4258 0%, #083242 100%)',
          color: 'white',
          minHeight: 150,      // 🔥 bigger height
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          boxShadow: '0 6px 16px rgba(0,0,0,0.1)',
          transition: '0.25s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
      >
        <div style={{ fontSize: 20, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 14, marginTop: 8, opacity: 0.9 }}>{desc}</div>
      </div>
    );
  }

  return (
    <Layout>
      <main className="page-root">

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="" label="Back" />
          <h2 style={{ marginTop: 16 }}>Module 2 — Home</h2>
        </div>

        <div style={{ fontSize: 12, color: '#555' }}>Quick access to Module 2 features.</div>

        {/* ⭐ FIXED 4 CARDS PER ROW + BIGGER WIDTH */}
        <div
          style={{
            marginTop: 20,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',   // ⭐ 4 cards per row
            gap: '20px',
          }}
        >

          <Card title="Upload" desc="Import lead data files." onClick={() => go(`#/workspace/:workspaceId/m02/upload`)} />

          <Card title="Upload Wizard" desc="Step-by-step guided upload." onClick={() => go(`#/workspace/:workspaceId/m02/upload-wizard`)} />

          <Card title="Leads" desc="Explore and manage leads." onClick={() => go(`#/workspace/:workspaceId/m02/leads`)} />

          <Card title="Merged List" desc="View all merged records." onClick={() => go(`#/workspace/:workspaceId/m02/merged`)} />

          <Card title="Merge Columns" desc="Map and merge imported columns." onClick={() => go(`#/workspace/:workspaceId/m02/merge-columns`)} />

          <Card title="Intent Scores" desc="Generate & analyze intent." onClick={() => go(`#/workspace/:workspaceId/m02/generate`)} />

          <Card title="Prioritization Dashboard" desc="Rank leads by conversion likelihood." onClick={() => go(`#/workspace/:workspaceId/m02/prioritization`)} />

          <Card title="Behavior Timeline" desc="Visualize lead behavior patterns." onClick={() => go(`#/workspace/:workspaceId/m02/behavior`)} />

          <Card title="Segment Behavior" desc="Compare audience segments." onClick={() => go(`#/workspace/:workspaceId/m02/segment-behavior`)} />

          <Card title="Intent Forecast" desc="Predict future engagement." onClick={() => go(`#/workspace/:workspaceId/m02/intent-forecast`)} />

          {/* Seed Card (White Style) */}
          <div
            onClick={seedDemo}
            style={{
              cursor: 'pointer',
              borderRadius: 14,
              padding: '26px 26px',
              background: '#ffffff',
              border: '1px solid #ddd',
              minHeight: 150,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              transition: '0.25s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0f4258' }}>
              {seeding ? 'Seeding…' : 'Seed Demo Data'}
            </div>
            <div style={{ fontSize: 14, marginTop: 8, color: '#444' }}>
              Generate example content.
            </div>
          </div>
        </div>

        {seedMsg && <div style={{ marginTop: 8, fontSize: 13 }}>{seedMsg}</div>}

      </main>
    </Layout>
  );
}
