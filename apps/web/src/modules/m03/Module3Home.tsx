import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
// if you want a separate CSS you can copy module6.css → module3.css
// import './module3.css';

function getWorkspaceId() {
  const hash = window.location.hash || '';
  // same regex pattern as Module6Home
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
  return m ? m[1] : null;
}

export default function Module3Home() {
  const wid = getWorkspaceId();

  function go(path: string) {
    if (!wid) return;
    // same pattern as Module6Home: substitute :workspaceId in the hash
    window.location.hash = path.replace(':workspaceId', wid);
  }

  return (
    <Layout>
      <main className="page-root">
        {/* Header row (copy Module6Home vibe) */}
        <div className="page-header">
          <ModuleBackButton />
          <div className="page-title-block">
            <h1 className="page-title">
              Module 3 — Conversation Intelligence
            </h1>
            <p className="page-subtitle">
              Inspect email and CRM threads, extract key sales signals, estimate deal
              health, and manage follow-ups so no opportunity goes cold.
            </p>
          </div>
        </div>

        {/* Main grid of actions, similar to Module 6 buttons */}
        <section className="page-section">
          <h3 className="section-title">Conversation tools</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
            }}
          >
            {/* 1 – Manual log */}
            <div className="module-card">
              <div className="label">Log conversation manually</div>
              <div className="muted">
                Capture a quick summary of a call, WhatsApp chat, or meeting and let
                the system still compute entities, sentiment, and deal health.
              </div>
              <button
                className="btn-primary btn-sm mt-12"
                onClick={() => go('#/workspace/:workspaceId/m03/manual-log')}
              >
                Open manual log
              </button>
            </div>

            {/* 2 – Upload logs */}
            <div className="module-card">
              <div className="label">Upload email / CRM logs</div>
              <div className="muted">
                Import exported threads as CSV, then normalize them into conversation
                threads and messages for further analysis.
              </div>
              <button
                className="btn-primary btn-sm mt-12"
                onClick={() => go('#/workspace/:workspaceId/m03/upload')}
              >
                Upload conversations
              </button>
            </div>

            {/* 3 – Conversation explorer */}
            <div className="module-card">
              <div className="label">Conversation explorer</div>
              <div className="muted">
                Browse all threads with filters for channel, sentiment, deal health,
                and last activity. Drill down into any thread timeline.
              </div>
              <button
                className="btn-primary btn-sm mt-12"
                onClick={() => go('#/workspace/:workspaceId/m03/explorer')}
              >
                Open explorer
              </button>
            </div>

            {/* 4 – Deal health board */}
            <div className="module-card">
              <div className="label">Deal health board</div>
              <div className="muted">
                See 0–100 health scores for each opportunity plus sentiment trend and
                key BANT signals.
              </div>
              <button
                className="btn-primary btn-sm mt-12"
                onClick={() => go('#/workspace/:workspaceId/m03/deal-health')}
              >
                View deal health
              </button>
            </div>

            {/* 5 – Follow-up queue */}
            <div className="module-card">
              <div className="label">Follow-up queue & alerts</div>
              <div className="muted">
                A prioritized list of threads where you&apos;re at risk of losing
                momentum, with suggested next actions.
              </div>
              <button
                className="btn-primary btn-sm mt-12"
                onClick={() => go('#/workspace/:workspaceId/m03/follow-ups')}
              >
                Open follow-ups
              </button>
            </div>

            {/* 6 – Analytics */}
            <div className="module-card">
              <div className="label">Sentiment & entity analytics</div>
              <div className="muted">
                Charts of positivity over time and frequency of budget / timeline /
                competitor mentions across your pipeline.
              </div>
              <button
                className="btn-primary btn-sm mt-12"
                onClick={() => go('#/workspace/:workspaceId/m03/analytics')}
              >
                View analytics
              </button>
            </div>

            {/* 7 – Organisation timeline */}
            <div className="module-card">
              <div className="label">Organisation timeline</div>
              <div className="muted">
                See all touchpoints over time for each account.
              </div>
              <button
                className="btn-primary btn-sm mt-12"
                onClick={() => go('#/workspace/:workspaceId/m03/org-timeline')}
              >
                Open timeline
              </button>
            </div>

            {/* 8 – View companies */}
            <div className="module-card">
              <div className="label">View companies</div>
              <div className="muted">
                Browse all organisations and their conversations.
              </div>
              <button
                className="btn-primary btn-sm mt-12"
                onClick={() => go('#/workspace/:workspaceId/m03/companies')}
              >
                View companies
              </button>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
