import React from 'react';
import Layout from '../../../components/Layout';
import heroImg from '../../../assets/landing-page-img1.png';
import "../auth/auth.css";

const gradient = 'linear-gradient(135deg, #0f1f3a 0%, #0f4258 45%, #1597a7 100%)';

export default function Landing() {
  return (
    <Layout fullBleed>
      <div style={{ background: '#f6f7fb', color: '#0f1f3a' }}>
        <HeroFull />
      </div>
    </Layout>
  );
}

function HeroFull() {
  return (
    <section
      style={{
        background: gradient,
        color: '#eaf7ff',
        minHeight: 'calc(100vh - 72px)',
        height: 'calc(100vh - 72px)',
        display: 'flex',
        alignItems: 'center',
        padding: 0,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1400,
          margin: '0 auto',
          padding: '24px 28px',
          display: 'grid',
          gridTemplateColumns: '1.1fr 0.9fr',
          gap: 36,
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase', opacity: 0.85 }}>
            AI layer for B2B SMEs
          </div>
          <h1 style={{ fontSize: 48, margin: '14px 0 12px', lineHeight: 1.08, color: '#fefefe' }}>
            Unify sales & marketing signals into decisions—not just dashboards
          </h1>
          <p style={{ color: '#d7eaf5', fontSize: 18, lineHeight: 1.6, maxWidth: 760 }}>
            Consolidate leads, score intent, analyze conversations, track leakage, and attribute ROI. Modular by
            design so teams stay aligned without replacing the tools they already use.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
            <button style={ghostBtn} onClick={() => (window.location.hash = '#/create-workspace')}>Create workspace</button>
          </div>
        </div>

        <div
          style={{
            background: '#0f1f3a',
            borderRadius: 18,
            padding: 18,
            boxShadow: '0 30px 80px rgba(4,12,24,0.35)',
            alignSelf: 'stretch',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={heroImg}
            alt="Product hero"
            style={{ width: '100%', height: '100%', borderRadius: 14, objectFit: 'cover', maxHeight: '72vh' }}
          />
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
