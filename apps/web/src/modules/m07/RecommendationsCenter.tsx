import { useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import './module7.css';
import { getRecommendations } from './funnelInsightsData';

export default function RecommendationsCenter() {
  const [typeFilter, setTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const cards = useMemo(() => getRecommendations(), []);
  const visible = cards.filter((card) => (!typeFilter || card.type === typeFilter) && (!priorityFilter || card.priority === priorityFilter) && (!ownerFilter || card.owner === ownerFilter));

  return (
    <Layout>
      <main className="page-root m07-workspace-page" style={{ padding: 20 }}>
        <div className="m07-workspace-toprow"><ModuleBackButton toSuffix="/m07" /></div>
        <section className="m07-insight-hero"><div style={{ padding: 28 }}><div className="m07-insight-badge">M07 Recommendations</div><h1 className="m07-insight-title">Recommendations</h1><div className="m07-insight-subtitle">Turn leakage, fatigue, and stagnation signals into clear next actions for owners and teams.</div></div></section>
        <section className="m07-workspace-panel m07-workspace-panel-soft">
          <div className="m07-workspace-formgrid">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="">All types</option><option value="fatigue">fatigue</option><option value="leakage">leakage</option><option value="recovery">recovery</option></select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}><option value="">All priorities</option><option value="High">High</option><option value="Medium">Medium</option></select>
            <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}><option value="">All owners</option><option value="Rep A">Rep A</option><option value="Rep B">Rep B</option><option value="Rep C">Rep C</option></select>
          </div>
        </section>
        <section className="m07-card-grid">
          {visible.map((card) => <div key={card.id} className="m07-rec-card"><div className="m07-rec-head"><span className="m07-rec-pill">{card.type}</span><span className="m07-rec-pill secondary">{card.priority}</span></div><h3>{card.leadId}</h3><div className="m07-rec-copy"><strong>Recommendation:</strong> {card.recommendation}</div><div className="m07-rec-copy"><strong>Reason:</strong> {card.reason}</div><div className="m07-rec-copy"><strong>Owner:</strong> {card.owner}</div><div className="m07-rec-copy"><strong>Confidence:</strong> {card.confidence}%</div><div className="m07-workspace-actionsrow"><button className="btn-primary">Apply</button><button className="btn-ghost">Assign to user</button><button className="btn-ghost">Dismiss</button></div></div>)}
          {!visible.length && <div className="m07-card-lite">No recommendations match the current filters.</div>}
        </section>
      </main>
    </Layout>
  );
}
