import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import './module7.css';
import { getLeadJourney } from './funnelInsightsData';

function getLeadIdFromHash() {
  const match = (window.location.hash || '').match(/\/m07\/journey\/([^/?]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export default function LeadJourneyExplorer() {
  const leadId = getLeadIdFromHash();
  const journey = getLeadJourney(leadId);

  return (
    <Layout>
      <main className="page-root m07-workspace-page" style={{ padding: 20 }}>
        <div className="m07-workspace-toprow"><ModuleBackButton toSuffix="/m07" /></div>
        <section className="m07-insight-hero"><div style={{ padding: 28 }}><div className="m07-insight-badge">M07 Lead Journey</div><h1 className="m07-insight-title">Lead Journey Explorer</h1><div className="m07-insight-subtitle">Understand why one lead converted, stalled, or dropped by reading stage history together with interaction events in one timeline.</div></div></section>

        {!journey.lead ? (
          <section className="m07-workspace-panel"><div className="m07-workspace-copy">Lead not found for this journey route.</div></section>
        ) : (
          <section className="m07-journey-layout">
            <aside className="m07-workspace-panel">
              <div className="m07-workspace-label">Lead info</div>
              <h3 className="m07-workspace-title" style={{ marginTop: 14 }}>{journey.lead.full_name}</h3>
              <div className="m07-list-line"><strong>Lead ID:</strong> {journey.lead.lead_id}</div>
              <div className="m07-list-line"><strong>Company:</strong> {journey.lead.company}</div>
              <div className="m07-list-line"><strong>Source:</strong> {journey.lead.source}</div>
              <div className="m07-list-line"><strong>Owner:</strong> {journey.lead.owner}</div>
              <div className="m07-list-line"><strong>Lead score:</strong> {journey.lead.lead_score}</div>
              <div className="m07-list-line"><strong>Intent score:</strong> {journey.lead.intent_score}</div>
            </aside>

            <section className="m07-workspace-panel">
              <div className="m07-workspace-label">Journey timeline</div>
              <h3 className="m07-workspace-title" style={{ marginTop: 14 }}>Chronological lead timeline</h3>
              <div className="m07-timeline">
                {journey.timeline.map((item, index) => (
                  <div key={`${item.kind}-${index}`} className="m07-timeline-item">
                    <div className={`m07-timeline-dot ${item.kind}`}></div>
                    <div className="m07-timeline-body">
                      <div className="m07-timeline-date">{new Date(item.date).toLocaleString()}</div>
                      <div className="m07-timeline-title">{item.title}</div>
                      <div className="m07-timeline-subtitle">{item.subtitle}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="m07-analytics-grid" style={{ marginTop: 18 }}>
                <div className="m07-card-lite">
                  <h4>Stage timeline</h4>
                  {journey.stageEvents.map((item) => <div key={item.id} className="m07-list-line">{item.stage_name} • {item.entered_at}{item.exited_at ? ` → ${item.exited_at}` : ' • active'}</div>)}
                </div>
                <div className="m07-card-lite">
                  <h4>Interaction timeline</h4>
                  {journey.interactions.map((item) => <div key={item.id} className="m07-list-line">{item.interaction_type} • {item.outcome} • {item.engagement_score}</div>)}
                </div>
              </div>

              <div className="m07-summary-grid" style={{ marginTop: 18 }}>
                <div className="m07-kpi-card"><div className="m07-kpi-label">Total Touches</div><div className="m07-kpi-value">{journey.totalTouches}</div></div>
                <div className="m07-kpi-card"><div className="m07-kpi-label">Total Interactions</div><div className="m07-kpi-value">{journey.totalInteractions}</div></div>
                <div className="m07-kpi-card"><div className="m07-kpi-label">Total Time in Funnel</div><div className="m07-kpi-value">{journey.totalTime}d</div></div>
                <div className="m07-kpi-card"><div className="m07-kpi-label">Final Status</div><div className="m07-kpi-value">{journey.finalStatus}</div></div>
              </div>
            </section>
          </section>
        )}
      </main>
    </Layout>
  );
}
