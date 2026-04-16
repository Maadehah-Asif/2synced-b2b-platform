import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'

const FEATURE_CARD_MIN_HEIGHT = 280
const SUPPORT_CARD_MIN_HEIGHT = 198

type HomeCard = {
  tag: string
  title: string
  body: string
  path: string
  entity?: string
  actionLabel?: string
  eyebrow?: string
}

export default function Module3Home() {
  const workspaceId = getWorkspaceId()

  const featuredCard: HomeCard = {
    tag: 'Explore',
    eyebrow: 'Primary Workspace View',
    title: 'Conversation Explorer',
    body: 'Open the main review surface for searching threads, checking recent activity, and jumping into the conversation details that need attention first.',
    path: `#/workspace/${workspaceId}/m03/explorer`,
    actionLabel: 'Open Explorer',
  }

  const operationalCards: HomeCard[] = [
    {
      tag: 'Input',
      entity: 'Conversation Data',
      title: 'Conversation Upload',
      body: 'Import conversation logs from email, WhatsApp, call, or meeting CSV files into the Module 3 pipeline.',
      path: `#/workspace/${workspaceId}/m03/upload`,
      actionLabel: 'Go to Upload',
    },
    {
      tag: 'Input',
      entity: 'Conversation Data',
      title: 'Manual Conversation Log',
      body: 'Record one conversation event manually when you need to capture messages, calls, meetings, or notes without a CSV import.',
      path: `#/workspace/${workspaceId}/m03/manual-log`,
      actionLabel: 'Open Manual Log',
    },
  ]

  const insightCards: HomeCard[] = [
    {
      tag: 'Explore',
      title: 'Conversation Explorer',
      body: 'Search and filter conversation threads by company, channel, health, and recent activity.',
      path: `#/workspace/${workspaceId}/m03/explorer`,
    },
    {
      tag: 'View',
      title: 'Company Directory',
      body: 'Browse companies with tracked conversation history and jump into account-level thread exploration.',
      path: `#/workspace/${workspaceId}/m03/companies`,
    },
    {
      tag: 'Insight',
      title: 'Conversation Analytics',
      body: 'Review sentiment distribution, entity extraction trends, channel coverage, and overall message activity.',
      path: `#/workspace/${workspaceId}/m03/analytics`,
    },
    {
      tag: 'Insight',
      title: 'Deal Health Board',
      body: 'Track conversation-driven deal health, pending follow-ups, and signals that accounts may be improving or at risk.',
      path: `#/workspace/${workspaceId}/m03/deal-health`,
    },
    {
      tag: 'Action',
      title: 'Follow-Ups',
      body: 'Manage pending and overdue follow-up actions generated from conversation activity and health signals.',
      path: `#/workspace/${workspaceId}/m03/follow-ups`,
    },
    {
      tag: 'Timeline',
      title: 'Organisation Timeline',
      body: 'View a time-ordered interaction timeline for one organisation to understand thread progression across channels.',
      path: `#/workspace/${workspaceId}/m03/org-timeline`,
    },
  ]

  return (
    <Layout>
      <main className="page-root" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="" label="Back" />
          <h2 style={{ marginTop: 12, color: '#0B2540' }}>Module 3</h2>
        </div>

        <section
          style={{
            marginTop: 18,
            borderRadius: 24,
            padding: 28,
            border: '1px solid rgba(15,66,88,0.08)',
            boxShadow: '0 14px 32px rgba(13,30,60,0.05)',
            background: '#ffffff',
          }}
        >
          <div style={{ display: 'inline-flex', padding: '7px 12px', borderRadius: 999, background: 'rgba(15,66,88,0.08)', color: '#0f4258', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            M03
          </div>
          <h1 style={{ margin: '16px 0 8px', fontSize: 38, lineHeight: 1.05, fontWeight: 900, color: '#0B2540' }}>Conversation Intelligence</h1>
          <div style={{ maxWidth: 820, color: '#415274', fontSize: 15, lineHeight: 1.75 }}>
            Module 3 is the workspace layer for conversation review. Use it to bring communication data into one place, understand thread health, follow-up risk, and surface lead-level insight without jumping across disconnected screens.
          </div>
        </section>

        <section
          style={{
            marginTop: 20,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.45fr) minmax(300px, 0.75fr)',
            gap: 20,
            alignItems: 'start',
          }}
        >
          <div style={{ display: 'grid', gap: 18 }}>
            <div
              style={{
                borderRadius: 22,
                padding: 22,
                background: '#ffffff',
                border: '1px solid rgba(15,66,88,0.08)',
                boxShadow: '0 16px 36px rgba(13,30,60,0.05)',
              }}
            >
              <SectionLabel label="Primary Entry" />
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(220px, 0.75fr)', gap: 16, marginTop: 14 }}>
                <FeaturedCard card={featuredCard} />
                <div
                  style={{
                    borderRadius: 18,
                    padding: 18,
                    background: '#F8FAFC',
                    border: '1px solid rgba(15,66,88,0.08)',
                    display: 'grid',
                    gap: 12,
                    alignContent: 'start',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5B6B84' }}>
                    Why Start Here
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0B2540', lineHeight: 1.45 }}>
                    Conversation Explorer gives the clearest starting point for reviewing Module 3 activity.
                  </div>
                  <div style={{ fontSize: 13, color: '#415274', lineHeight: 1.7 }}>
                    It lets you move quickly from thread search into detailed review, health interpretation, and next-step guidance without needing manual IDs or disconnected entry paths.
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                borderRadius: 22,
                padding: 22,
                background: '#ffffff',
                border: '1px solid rgba(15,66,88,0.08)',
                boxShadow: '0 16px 36px rgba(13,30,60,0.05)',
              }}
            >
              <SectionLabel label="Operational Entry Points" />
              <div style={{ marginTop: 10, fontSize: 14, color: '#415274', lineHeight: 1.7, maxWidth: 760 }}>
                Use these screens when conversation records still need to be added or corrected before they can be reviewed downstream.
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))',
                  gap: 14,
                  marginTop: 16,
                }}
              >
                {operationalCards.map((card) => (
                  <OperationalCard key={card.title} card={card} />
                ))}
              </div>
            </div>

            <div
              style={{
                borderRadius: 22,
                padding: 22,
                background: '#ffffff',
                border: '1px solid rgba(15,66,88,0.08)',
                boxShadow: '0 16px 36px rgba(13,30,60,0.05)',
              }}
            >
              <SectionLabel label="Insight and Review" />
              <div style={{ marginTop: 10, fontSize: 14, color: '#415274', lineHeight: 1.7, maxWidth: 820 }}>
                Move here once the conversation data is already available and you want to review performance, health, follow-up needs, or organisational context.
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(200px, 1fr))',
                  gap: 14,
                  marginTop: 16,
                }}
              >
                {insightCards.map((card) => (
                  <SupportCard key={card.title} card={card} />
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            <div
              style={{
                borderRadius: 22,
                padding: 22,
                background: '#ffffff',
                border: '1px solid rgba(15,66,88,0.08)',
                boxShadow: '0 16px 36px rgba(13,30,60,0.05)',
              }}
            >
              <SectionLabel label="Workflow Guidance" />
              <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                <MiniInfo title="1. Ingest or correct records" text="Start with upload or manual logging whenever the workspace still needs message, call, meeting, or note records inside Module 3." />
                <MiniInfo title="2. Review the thread" text="Open Conversation Explorer when you want to understand the current state of communication for a specific thread or account cluster." />
                <MiniInfo title="3. Escalate into decision views" text="Use Deal Health, Follow-Ups, Analytics, and Timeline views when the question becomes prioritization, risk, or activity interpretation." />
              </div>
            </div>

            <div
              style={{
                borderRadius: 22,
                padding: 22,
                background: '#ffffff',
                border: '1px solid rgba(15,66,88,0.08)',
                boxShadow: '0 16px 36px rgba(13,30,60,0.05)',
              }}
            >
              <SectionLabel label="What Module 3 Is Best At" />
              <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                <MiniInfo title="Conversation review" text="Move from a thread list into detailed message review, health scoring, and next-step guidance in one flow." />
                <MiniInfo title="Conversation prioritization" text="See which threads look healthy, which are stable, and which deserve attention before they go cold." />
                <MiniInfo title="Operational visibility" text="Keep uploads, manual fixes, and review surfaces inside one consistent module instead of jumping between disconnected lists." />
              </div>
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

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ display: 'inline-flex', padding: '6px 11px', borderRadius: 999, background: 'rgba(15,66,88,0.08)', color: '#0f4258', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
      {label}
    </div>
  )
}

function FeaturedCard({ card }: { card: HomeCard }) {
  return (
    <button
      onClick={() => { window.location.hash = card.path }}
      style={{
        textAlign: 'left',
        borderRadius: 20,
        padding: 22,
        border: '1px solid rgba(15,66,88,0.14)',
        background: '#ffffff',
        boxShadow: '0 14px 32px rgba(13,30,60,0.05)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        minHeight: FEATURE_CARD_MIN_HEIGHT,
        height: '100%',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, minHeight: 38 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 999, background: 'rgba(15,66,88,0.08)', color: '#0f4258', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {card.tag}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: 999, background: 'rgba(72,177,217,0.10)', color: '#415274', fontSize: 11, fontWeight: 700 }}>
          M03
        </div>
      </div>
      {card.eyebrow && (
        <div style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 9px', borderRadius: 999, background: '#F8FAFC', color: '#415274', fontSize: 11, fontWeight: 700, alignSelf: 'flex-start' }}>
          {card.eyebrow}
        </div>
      )}
      <div style={{ fontSize: 28, fontWeight: 900, color: '#0B2540', lineHeight: 1.1, maxWidth: 460 }}>
        {card.title}
      </div>
      <div style={{ fontSize: 14, color: '#415274', lineHeight: 1.75, maxWidth: 540 }}>
        {card.body}
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid rgba(15,66,88,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#415274', fontWeight: 700 }}>Primary review entry point</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 14px', borderRadius: 12, background: '#0f4258', color: '#fff', fontSize: 12, fontWeight: 800 }}>
          {card.actionLabel || 'Open'}
        </span>
      </div>
    </button>
  )
}

function OperationalCard({ card }: { card: HomeCard }) {
  return (
    <button
      onClick={() => { window.location.hash = card.path }}
      style={{
        textAlign: 'left',
        borderRadius: 18,
        padding: 18,
        border: '1px solid rgba(15,66,88,0.09)',
        background: '#ffffff',
        boxShadow: '0 10px 24px rgba(13,30,60,0.04)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: SUPPORT_CARD_MIN_HEIGHT,
        height: '100%',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, minHeight: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {card.entity && (
            <div style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 999, background: 'rgba(15,66,88,0.10)', color: '#0f4258', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {card.entity}
            </div>
          )}
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: 999, background: 'rgba(72,177,217,0.10)', color: '#415274', fontSize: 11, fontWeight: 700 }}>
            {card.tag}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#0B2540', lineHeight: 1.3, minHeight: 52 }}>
        {card.title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: '#415274',
          lineHeight: 1.7,
          flex: 1,
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {card.body}
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid rgba(15,66,88,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12, color: '#415274', fontWeight: 700 }}>Operational entry point</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '9px 13px', borderRadius: 12, background: '#0f4258', color: '#fff', fontSize: 12, fontWeight: 800 }}>
          {card.actionLabel || 'Open'}
        </span>
      </div>
    </button>
  )
}

function SupportCard({ card }: { card: HomeCard }) {
  return (
    <button
      onClick={() => { window.location.hash = card.path }}
      style={{
        textAlign: 'left',
        padding: '18px',
        borderRadius: 18,
        cursor: 'pointer',
        minHeight: SUPPORT_CARD_MIN_HEIGHT,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: '#ffffff',
        border: '1px solid rgba(15,66,88,0.09)',
        boxShadow: '0 10px 24px rgba(13,30,60,0.04)',
        color: '#0B2540',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, minHeight: 40 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 999, background: 'rgba(15,66,88,0.08)', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#0f4258' }}>
          {card.tag}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: 999, background: 'rgba(72,177,217,0.10)', fontSize: 11, fontWeight: 700, color: '#415274' }}>
          M03
        </div>
      </div>
      <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.3, minHeight: 50 }}>
        {card.title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: '#415274',
          lineHeight: 1.7,
          flex: 1,
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {card.body}
      </div>
      <div style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', padding: '7px 12px', borderRadius: 999, background: 'rgba(15,66,88,0.08)', color: '#0f4258', fontSize: 12, fontWeight: 800, alignSelf: 'flex-start' }}>
        {card.actionLabel || 'Open Insight'}
      </div>
    </button>
  )
}

function MiniInfo({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ borderRadius: 16, padding: 16, border: '1px solid rgba(15,66,88,0.08)', background: '#ffffff' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#0B2540', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#415274', lineHeight: 1.7 }}>{text}</div>
    </div>
  )
}
