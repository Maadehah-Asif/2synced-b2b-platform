import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'

export default function Module3Home() {
  const workspaceId = getWorkspaceId()
  const cards = [
    {
      tag: 'Input',
      group: 'data',
      entity: 'Conversation Data',
      title: 'Conversation Upload',
      body: 'Import conversation logs from email, WhatsApp, call, or meeting CSV files into the module 3 pipeline.',
      path: `#/workspace/${workspaceId}/m03/upload`,
    },
    {
      tag: 'Input',
      group: 'data',
      entity: 'Conversation Data',
      title: 'Manual Conversation Log',
      body: 'Record one conversation event manually when you need to capture messages, calls, meetings, or notes without a CSV import.',
      path: `#/workspace/${workspaceId}/m03/manual-log`,
    },
    {
      tag: 'View',
      group: 'insight',
      title: 'Company Directory',
      body: 'Browse companies with tracked conversation history and jump into account-level thread exploration.',
      path: `#/workspace/${workspaceId}/m03/companies`,
    },
    {
      tag: 'Explore',
      group: 'insight',
      title: 'Conversation Explorer',
      body: 'Search and filter conversation threads by company, channel, health, and recent activity.',
      path: `#/workspace/${workspaceId}/m03/explorer`,
    },
    {
      tag: 'Insight',
      group: 'insight',
      title: 'Conversation Analytics',
      body: 'Review sentiment distribution, entity extraction trends, channel coverage, and overall message activity.',
      path: `#/workspace/${workspaceId}/m03/analytics`,
    },
    {
      tag: 'Insight',
      group: 'insight',
      title: 'Deal Health Board',
      body: 'Track conversation-driven deal health, pending follow-ups, and signals that accounts may be improving or at risk.',
      path: `#/workspace/${workspaceId}/m03/deal-health`,
    },
    {
      tag: 'Action',
      group: 'insight',
      title: 'Follow-Ups',
      body: 'Manage pending and overdue follow-up actions generated from conversation activity and health signals.',
      path: `#/workspace/${workspaceId}/m03/follow-ups`,
    },
    {
      tag: 'Timeline',
      group: 'insight',
      title: 'Organisation Timeline',
      body: 'View a time-ordered interaction timeline for one organisation to understand thread progression across channels.',
      path: `#/workspace/${workspaceId}/m03/org-timeline`,
    },
  ]

  return (
    <Layout>
      <main className="page-root" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="" label="Back" />
          <h2 style={{ marginTop: 16 }}>Conversation Intelligence</h2>
        </div>

        <section
          style={{
            marginTop: 18,
            borderRadius: 24,
            overflow: 'hidden',
            border: '1px solid rgba(15,66,88,0.08)',
            boxShadow: '0 20px 46px rgba(13,30,60,0.08)',
            background: 'linear-gradient(135deg, rgba(18,59,87,0.98) 0%, rgba(15,66,88,0.94) 52%, rgba(72,177,217,0.24) 100%)',
            color: '#fff',
          }}
        >
          <div style={{ padding: 28 }}>
            <div style={{ display: 'inline-flex', padding: '7px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Conversation Intelligence
            </div>
            <h1 style={{ margin: '16px 0 8px', fontSize: 38, lineHeight: 1.05, fontWeight: 900, color: '#fff' }}>Conversation Intelligence</h1>
            <div style={{ maxWidth: 780, color: 'rgba(255,255,255,0.84)', fontSize: 15, lineHeight: 1.7 }}>
              Module 3 is the conversation intelligence layer for the workspace. Use it to ingest conversation records, inspect thread health, review follow-up pressure, and surface message-level analytics that help sales and marketing teams respond faster.
            </div>
          </div>
        </section>

        <section
          style={{
            marginTop: 18,
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: 18,
          }}
        >
          <div
            style={{
              borderRadius: 22,
              padding: 22,
              background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,253,0.98))',
              border: '1px solid rgba(15,66,88,0.08)',
              boxShadow: '0 16px 38px rgba(13,30,60,0.06)',
            }}
          >
            <div style={{ display: 'inline-flex', padding: '6px 11px', borderRadius: 999, background: 'rgba(15,66,88,0.08)', color: 'var(--header-secondary)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Module Screens
            </div>
            <h3 style={{ margin: '14px 0 12px', fontSize: 28, color: '#0B2540' }}>Open conversation workflows</h3>
            <div style={{ fontSize: 14, color: '#415274', lineHeight: 1.7, marginBottom: 16, maxWidth: 860 }}>
              Open the actual M03 screens from here. Input screens keep the operational Data Hub card treatment, while analysis and review screens follow the stronger module-home insight style.
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))',
                gap: 14,
              }}
            >
              {cards.map((card) => card.group === 'data'
                ? <DataCard key={card.title} card={card} />
                : <InsightCard key={card.title} card={card} />
              )}
            </div>
          </div>

          <div
            style={{
              borderRadius: 22,
              padding: 22,
              background: 'linear-gradient(180deg, rgba(243,248,252,0.98), rgba(255,255,255,1))',
              border: '1px solid rgba(15,66,88,0.08)',
              boxShadow: '0 16px 38px rgba(13,30,60,0.05)',
            }}
          >
            <div style={{ display: 'inline-flex', padding: '6px 11px', borderRadius: 999, background: 'rgba(72,177,217,0.12)', color: '#0B2540', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Useful Context
            </div>
            <h3 style={{ margin: '14px 0 10px', fontSize: 24, color: '#0B2540' }}>What belongs here</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <MiniInfo title="Operational entry points" text="Use conversation upload and manual logging when raw message, call, meeting, or note records still need to enter M03." />
              <MiniInfo title="Insight-side screens" text="Use explorer, analytics, deal health, follow-ups, and timeline views when the conversation data is already available and needs interpretation." />
              <MiniInfo title="Best sequence" text="Ingest records first, move into company or thread exploration second, and then use health and follow-up views to decide what needs action." />
            </div>
          </div>
        </section>
      </main>
    </Layout>
  )
}

function getWorkspaceId() {
  const hash = window.location.hash || ''
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/)
  return m ? m[1] : null
}

function DataCard({ card }: { card: { tag: string; entity?: string; title: string; body: string; path: string } }) {
  return (
    <button
      onClick={() => { window.location.hash = card.path }}
      style={{
        textAlign: 'left',
        borderRadius: 18,
        padding: 18,
        border: '1px solid rgba(15,66,88,0.09)',
        background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(244,249,253,0.98))',
        boxShadow: '0 14px 30px rgba(13,30,60,0.05)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 190,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 999, background: 'rgba(15,66,88,0.10)', color: '#0f4258', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {card.entity}
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: 999, background: 'rgba(72,177,217,0.10)', color: '#415274', fontSize: 11, fontWeight: 700 }}>
            M03
          </div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: 999, background: 'rgba(72,177,217,0.10)', color: '#415274', fontSize: 11, fontWeight: 700 }}>
          {card.tag}
        </div>
      </div>
      <div style={{ fontSize: 19, fontWeight: 900, color: '#0B2540', lineHeight: 1.3 }}>{card.title}</div>
      <div style={{ fontSize: 13, color: '#415274', lineHeight: 1.7, flex: 1 }}>{card.body}</div>
      <div style={{ paddingTop: 10, borderTop: '1px solid rgba(15,66,88,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12, color: '#415274', fontWeight: 700 }}>Operational entry point</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '9px 13px', borderRadius: 12, background: 'linear-gradient(135deg, #0f4258 0%, #195b74 100%)', color: '#fff', fontSize: 12, fontWeight: 800 }}>
          Go to Data
        </span>
      </div>
    </button>
  )
}

function InsightCard({ card }: { card: { tag: string; title: string; body: string; path: string } }) {
  return (
    <button
      onClick={() => { window.location.hash = card.path }}
      style={{
        textAlign: 'left',
        padding: '20px',
        borderRadius: 18,
        cursor: 'pointer',
        minHeight: 190,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: 'linear-gradient(145deg, #0f4258 0%, #195b74 52%, #2f7e97 100%)',
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: '0 10px 24px rgba(13,30,60,0.12)',
        color: '#fff',
      }}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.14)', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {card.tag}
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', fontSize: 11, fontWeight: 700 }}>
            M03
          </div>
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.2px', lineHeight: 1.3 }}>{card.title}</div>
        <div style={{ fontSize: 13, marginTop: 8, opacity: 0.9, lineHeight: 1.6 }}>{card.body}</div>
      </div>
      <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', padding: '7px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.14)', fontSize: 12, fontWeight: 800, alignSelf: 'flex-start' }}>
        Open Insight
      </div>
    </button>
  )
}

function MiniInfo({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ borderRadius: 16, padding: 16, border: '1px solid rgba(15,66,88,0.08)', background: 'rgba(255,255,255,0.8)' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#0B2540', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#415274', lineHeight: 1.65 }}>{text}</div>
    </div>
  );
}
