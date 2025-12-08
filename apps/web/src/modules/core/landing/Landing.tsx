import type React from 'react';
import { useEffect } from "react";
import Layout from '../../../components/Layout';
import heroImg from '../../../assets/landing-page-img1.png';
import "../auth/auth.css";

type ModuleCard = {
  id: string;
  title: string;
  summary: string;
  highlights: string[];
};

const modules: ModuleCard[] = [
  {
    id: '01',
    title: 'Lead Intelligence',
    summary:
      'Unifies leads, cleans data, scores Hot/Warm/Cold, and explains every priority.',
    highlights: [
      'Unified table across PhantomBuster, Smartlead, Clay, HeyReach',
      'Scoring with engagement + firmographic signals',
      'Reason codes and exportable ranked view',
    ],
  },
  {
    id: '02',
    title: 'Intent & Behaviors',
    summary:
      'Forecasts conversion likelihood across horizons with behavioral timelines and drivers.',
    highlights: [
      'Intent scores from opens, clicks, replies, LinkedIn responses',
      'Short/medium/long probability windows',
      'Timeline visual plus unified ranking with lead scores',
    ],
  },
  {
    id: '03',
    title: 'Conversation Signals',
    summary:
      'Parses sales emails and CRM threads to extract entities, tone, deal health, and follow-ups.',
    highlights: [
      'Budget, decision maker, timeline, competitor extraction',
      'Tone trajectory and deal health on a 0–100 scale',
      'Next-contact predictor so momentum is never lost',
    ],
  },
  {
    id: '04',
    title: 'Guided Assistant',
    summary:
      'Step-by-step assistant that orchestrates modules for tasks like scoring, funnel health, or reporting.',
    highlights: [
      'Task picker with guardrails and input prompts',
      'Reusable walkthrough templates',
      'Plain-English outcomes with deep links',
    ],
  },
  {
    id: '05',
    title: 'Pipeline Alignment',
    summary:
      'Combined sales-marketing pipeline view with shared KPIs, notes, and web engagement stitched in.',
    highlights: [
      'Unified stage counts and progression',
      'Lightweight collaboration with notes and mentions',
      'KPI dashboard for conversion + engagement trends',
    ],
  },
  {
    id: '06',
    title: 'ROI & Attribution',
    summary:
      'Links revenue to campaigns with ROI calculators, attribution splits, and leadership dashboards.',
    highlights: [
      'Revenue allocation across influencing campaigns',
      'ROI calculator with cost vs attributed revenue',
      'Forecasting and validation checks for leadership',
    ],
  },
  {
    id: '07',
    title: 'Leakage & Fatigue',
    summary:
      'Predicts drop-off risk and over-messaging so teams act before momentum stalls.',
    highlights: [
      'Funnel stage tracker with drop-off highlights',
      'Leakage predictor + fatigue alerts',
      'Heat maps and exports with actions: pause, nurture, escalate',
    ],
  },
  {
    id: '08',
    title: 'Executive Reporting',
    summary:
      'Aggregates outputs into one narrative report with validation and multi-format exports.',
    highlights: [
      'Collector for leads, intent, funnel, ROI, campaigns',
      'Executive summary builder with wins/risks/actions',
      'PDF, DOCX, HTML exports with validation layer',
    ],
  },
  {
    id: '09',
    title: 'Campaign Intelligence',
    summary:
      'Surfaces best channels, formats, and timings with concise, exportable recommendations.',
    highlights: [
      'Cross-platform performance dashboard',
      'Channel effectiveness and timing suggestions',
      'Next-wave recommendations with PDF/Excel exports',
    ],
  },
];

const comparisonRows = [
  {
    system: 'System 1',
    overview: 'Point solution focused on a single channel with basic engagement scoring.',
    limitation: 'No cross-channel context; weak explainability; no pipeline alignment.',
  },
  {
    system: 'System 2',
    overview: 'Heavier CRM plug-in that adds rules-based routing and basic alerts.',
    limitation: 'Rigid rules, minimal AI-driven forecasting, and poor cross-team visibility.',
  },
  {
    system: 'System 3',
    overview: 'Marketing automation suite with campaign analytics and nurture flows.',
    limitation: 'Limited sales signal ingestion and no shared attribution or executive rollup.',
  },
];

const gradient = 'linear-gradient(135deg, #0f1f3a 0%, #0f4258 45%, #1597a7 100%)';

export default function Landing() {
  useEffect(() => {
    const hash = window.location.hash || '';
    const [_, query = ''] = hash.split('?');
    const params = new URLSearchParams(query);
    const tokenFromUrl = params.get('token');

    if (tokenFromUrl) {
      localStorage.setItem('token', tokenFromUrl);
      window.location.hash = '#/landing';
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      window.location.hash = '#/login';
    }
  }, []);

  return (
    <Layout>
      <div style={{ background: '#f6f7fb', color: '#0f1f3a' }}>
        <Hero />
        <Alignment />
        <Modules />
        <Comparisons />
        <Workflows />
        <Assurance />
        <FooterCta />
      </div>
    </Layout>
  );
}

function Hero() {
  return (
    <section style={{ background: gradient, color: '#eaf7ff', padding: '80px 0 70px' }}>
      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '0 24px',
          display: 'grid',
          gridTemplateColumns: '1.1fr 0.9fr',
          gap: 36,
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase', opacity: 0.8 }}>
            AI layer for B2B SMEs
          </div>
          <h1 style={{ fontSize: 40, margin: '12px 0 10px', lineHeight: 1.2, color: '#fefefe' }}>
            Unify sales & marketing signals into decisions—not just dashboards
          </h1>
          <p style={{ color: '#d7eaf5', fontSize: 16, lineHeight: 1.6 }}>
            Consolidate leads, score intent, analyze conversations, track leakage, and attribute ROI. Modular by
            design so teams stay aligned without replacing the tools they already use.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
            <button style={primaryBtn}>Start free workspace</button>
            <button style={ghostBtn}>See interactive demo</button>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 20, color: '#b8d5e6', fontSize: 13 }}>
            <span>Lead intelligence</span>
            <span>Intent prediction</span>
            <span>Leakage alerts</span>
            <span>Executive rollups</span>
          </div>
        </div>
        <div
          style={{
            background: '#0f1f3a',
            borderRadius: 18,
            padding: 18,
            boxShadow: '0 30px 80px rgba(4,12,24,0.35)',
          }}
        >
          <img
            src={heroImg}
            alt="Product hero"
            style={{ width: '100%', borderRadius: 14, objectFit: 'cover', minHeight: 360, background: '#14314a' }}
          />
        </div>
      </div>
    </section>
  );
}

function Alignment() {
  const pillars = [
    {
      title: 'Alignment, not replacement',
      copy:
        'Acts as a unifying layer on top of your CRM and campaign tools. Consolidates outputs and flags gaps without forcing migration.',
    },
    {
      title: 'Explainable AI, fast',
      copy:
        'Every score, forecast, and recommendation carries a reason code—built for managers who need confidence, not black boxes.',
    },
    {
      title: 'Modular by design',
      copy:
        'Start with lead intelligence or intent scoring, then extend into leakage, ROI, and executive reporting as needs evolve.',
    },
  ];
  return (
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '70px 24px 30px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 30, margin: '0 0 12px' }}>The alignment layer for fragmented teams</h2>
          <p style={{ color: '#4c5a71', lineHeight: 1.6 }}>
            Consolidate data integration, processing, and reporting across sales and marketing workflows. Lightweight,
            AI-forward, and ready for SME timelines.
          </p>
          <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span style={tag}>Data integration</span>
            <span style={tag}>Predictive leakage</span>
            <span style={tag}>Explainable scoring</span>
            <span style={tag}>Guided workflows</span>
          </div>
        </div>
        <div
          style={{
            background: '#fff',
            borderRadius: 14,
            padding: 22,
            boxShadow: '0 16px 40px rgba(12,23,41,0.08)',
            display: 'grid',
            gap: 16,
          }}
        >
          {pillars.map((item) => (
            <div key={item.title} style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontWeight: 700 }}>{item.title}</div>
              <div style={{ color: '#4c5a71', fontSize: 14, lineHeight: 1.5 }}>{item.copy}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Modules() {
  return (
    <section style={{ background: '#ffffff', padding: '60px 0' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 28, margin: 0 }}>Nine modules, one operating picture</h2>
            <p style={{ color: '#4c5a71', marginTop: 6 }}>
              Pick the modules you need now—extend or refine as business needs evolve.
            </p>
          </div>
          <button style={ghostBtn}>Download module brief</button>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 18,
          }}
        >
          {modules.map((m) => (
            <div
              key={m.id}
              style={{
                background: '#f7f9ff',
                borderRadius: 14,
                padding: 18,
                border: '1px solid #e6ecf4',
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: '#0f4258' }}>{m.title}</span>
                <span style={{ fontSize: 13, color: '#4c5a71' }}>Module {m.id}</span>
              </div>
              <div style={{ color: '#4c5a71', fontSize: 14, lineHeight: 1.5 }}>{m.summary}</div>
              <ul style={{ paddingLeft: 18, margin: 0, display: 'grid', gap: 6, color: '#1c2c44', fontSize: 13 }}>
                {m.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Comparisons() {
  return (
    <section style={{ background: '#0f1f3a', color: '#f5f9ff', padding: '60px 0' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 28, margin: 0 }}>Where existing solutions fall short</h2>
            <p style={{ color: '#b9cee3', marginTop: 10 }}>
              We integrate, explain, and align—rather than adding another isolated system.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
              <button style={primaryBtnDark}>Show me the proof</button>
              <button style={ghostBtnDark}>See ROI model</button>
            </div>
          </div>
          <div
            style={{
              background: '#102743',
              borderRadius: 14,
              border: '1px solid #183654',
              overflow: 'hidden',
              boxShadow: '0 16px 40px rgba(2,10,22,0.4)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', background: '#12314f', color: '#d7eaf5' }}>
                  <th style={tableCell}>System</th>
                  <th style={tableCell}>Overview</th>
                  <th style={tableCell}>Limitations</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.system} style={{ borderTop: '1px solid #1b3d5f' }}>
                    <td style={tableCell}>{row.system}</td>
                    <td style={tableCellMuted}>{row.overview}</td>
                    <td style={tableCellMuted}>{row.limitation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function Workflows() {
  const cards = [
    {
      title: 'Lead intelligence + intent',
      copy: 'Ranked leads with explainable scores plus time-window intent forecasts.',
      action: 'Preview ranking view',
      image: '/assets/landing/image2.jpg',
    },
    {
      title: 'Leakage & fatigue detection',
      copy: 'Predict drop-offs, alert on over-messaged audiences, and recommend actions.',
      action: 'Open leakage report',
      image: '/assets/landing/image3.jpg',
    },
    {
      title: 'Executive-ready reporting',
      copy: 'Aggregate across modules, validate consistency, and export in PDF/DOCX/HTML.',
      action: 'See report template',
      image: '/assets/landing/image4.jpg',
    },
  ];
  return (
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '60px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 28, margin: 0 }}>Purpose-built workflows</h2>
          <p style={{ color: '#4c5a71', marginTop: 8 }}>
            Guided flows orchestrate modules so teams move from signals to action quickly.
          </p>
        </div>
        <button style={ghostBtn}>Browse workflow library</button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 18,
        }}
      >
        {cards.map((card) => (
          <div
            key={card.title}
            style={{
              background: '#fff',
              borderRadius: 14,
              overflow: 'hidden',
              border: '1px solid #e6ecf4',
              boxShadow: '0 16px 30px rgba(14,35,64,0.08)',
              display: 'grid',
              gridTemplateRows: '200px 1fr',
            }}
          >
            <div style={{ background: '#dbe7f2' }}>
              <img
                src={card.image}
                alt={`${card.title} placeholder`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
            <div style={{ padding: 18, display: 'grid', gap: 8 }}>
              <div style={{ fontWeight: 700, color: '#0f4258' }}>{card.title}</div>
              <div style={{ color: '#4c5a71', fontSize: 14, lineHeight: 1.5 }}>{card.copy}</div>
              <button style={{ ...ghostBtn, justifySelf: 'flex-start' }}>{card.action}</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Assurance() {
  const stats = [
    { label: 'Time to insight', value: '< 2 days', note: 'From first data drop to usable dashboards.' },
    { label: 'Explainability', value: '100%', note: 'Every score and forecast paired with drivers.' },
    { label: 'Exports', value: 'PDF / DOCX / HTML', note: 'Management-ready with consistency checks.' },
  ];
  return (
    <section style={{ background: '#eaf1fb', padding: '50px 0' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 24px' }}>
        <div
          style={{
            background: '#fff',
            borderRadius: 16,
            padding: 22,
            border: '1px solid #dfe7f5',
            boxShadow: '0 20px 40px rgba(20,46,82,0.08)',
            display: 'grid',
            gridTemplateColumns: '1.3fr 0.7fr',
            gap: 20,
            alignItems: 'center',
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 10px', fontSize: 22 }}>Built for clarity, not complexity</h3>
            <p style={{ color: '#4c5a71', lineHeight: 1.6 }}>
              Transparent by design: modular, explainable, and aligned to academic + SME delivery timelines. We
              integrate the tools you already run—no full-stack replacement.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <button style={primaryBtn}>Get started</button>
              <button style={ghostBtn}>Talk to an expert</button>
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12,
            }}
          >
            {stats.map((s) => (
              <div
                key={s.label}
                style={{
                  background: '#f6f9ff',
                  borderRadius: 12,
                  padding: 12,
                  border: '1px solid #e6ecf4',
                }}
              >
                <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#5c708d', letterSpacing: 0.4 }}>
                  {s.label}
                </div>
                <div style={{ fontWeight: 800, fontSize: 20, color: '#0f4258', margin: '4px 0' }}>{s.value}</div>
                <div style={{ color: '#4c5a71', fontSize: 13 }}>{s.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FooterCta() {
  return (
    <section style={{ background: '#0f1f3a', color: '#f5f9ff', padding: '40px 0 50px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
        <h3 style={{ fontSize: 26, margin: '0 0 10px' }}>Ready for aligned revenue teams?</h3>
        <p style={{ color: '#b9cee3', marginBottom: 18 }}>
          Plug in your data, pick the modules you need, and get decision-ready insights this week.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button style={primaryBtnDark}>Create workspace</button>
          <button style={ghostBtnDark}>Schedule walkthrough</button>
        </div>
      </div>
    </section>
  );
}

const primaryBtn: React.CSSProperties = {
  background: '#0f4258',
  color: '#fefefe',
  border: 'none',
  borderRadius: 10,
  padding: '12px 16px',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 10px 30px rgba(15,66,88,0.3)',
};

const ghostBtn: React.CSSProperties = {
  background: '#ffffff',
  color: '#0f4258',
  border: '1px solid #d6e2f0',
  borderRadius: 10,
  padding: '12px 14px',
  fontWeight: 600,
  cursor: 'pointer',
};

const primaryBtnDark: React.CSSProperties = {
  ...primaryBtn,
  background: '#1bb5c8',
  color: '#0a1a2f',
  boxShadow: '0 10px 30px rgba(27,181,200,0.35)',
};

const ghostBtnDark: React.CSSProperties = {
  ...ghostBtn,
  background: 'transparent',
  color: '#f5f9ff',
  border: '1px solid #1b3d5f',
};

const tag: React.CSSProperties = {
  background: '#e7f3ff',
  color: '#0f4258',
  padding: '6px 10px',
  borderRadius: 999,
  fontSize: 12,
  border: '1px solid #d6e2f0',
};

const tableCell: React.CSSProperties = {
  padding: '12px 12px',
  borderRight: '1px solid #1b3d5f',
  fontSize: 13,
};

const tableCellMuted: React.CSSProperties = {
  ...tableCell,
  color: '#b9cee3',
  fontWeight: 500,
};
