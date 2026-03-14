import type React from 'react';
import '../styles/components.css';

export default function Header() {
  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2000,
        background: '#ffffff',
        borderBottom: '1px solid #e5e7ef',
        boxShadow: '0 10px 30px rgba(13,30,60,0.08)',
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '14px 22px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}
      >
        <button
          onClick={() => (window.location.hash = '#/landing')}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#0f1f3a',
            fontWeight: 800,
            fontSize: 18,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          2-Synced
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
          <button
            style={{
              ...ghostBtn,
              padding: '10px 16px',
              minWidth: 110,
            }}
            onClick={() => (window.location.hash = '#/workspaces')}
          >
            Workspaces
          </button>
          <button
            style={{
              ...primaryBtn,
              padding: '10px 16px',
              minWidth: 110,
            }}
            onClick={() => (window.location.hash = '#/profile')}
          >
            Profile
          </button>
          <button
            style={{
              ...ghostBtn,
              padding: '10px 12px',
              minWidth: 90,
              background: 'var(--header-secondary)',
              color: '#fff',
              border: 'none',
              boxShadow: '0 10px 24px rgba(15,66,88,0.15)'
            }}
            onClick={() => { localStorage.removeItem('token'); window.location.hash = '#/login'; }}
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

const primaryBtn: React.CSSProperties = {
  background: '#0f4258',
  color: '#fefefe',
  border: 'none',
  borderRadius: 12,
  padding: '12px 14px',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 12px 28px rgba(12,51,83,0.25)',
};

const ghostBtn: React.CSSProperties = {
  background: '#ffffff',
  color: '#0f4258',
  border: '1px solid #d6e2f0',
  borderRadius: 12,
  padding: '12px 14px',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 10px 24px rgba(13,30,60,0.08)',
};
