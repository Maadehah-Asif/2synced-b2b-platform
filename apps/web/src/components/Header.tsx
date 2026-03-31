import type React from 'react';
import '../styles/components.css';

export default function Header() {
  const route = window.location.hash || '#/login';

  const navItems = [
    {
      label: 'Workspaces',
      onClick: () => (window.location.hash = '#/workspaces'),
      active: route.startsWith('#/workspaces') || route.startsWith('#/workspace/'),
      icon: <GridIcon />,
    },
    {
      label: 'Profile',
      onClick: () => (window.location.hash = '#/profile'),
      active: route.startsWith('#/profile'),
      icon: <UserIcon />,
    },
  ];

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2000,
        background: 'rgba(255,255,255,0.88)',
        borderBottom: '1px solid rgba(214,226,240,0.72)',
        boxShadow: '0 16px 40px rgba(13,30,60,0.08)',
        backdropFilter: 'blur(14px)',
      }}
    >
      <div
        style={{
          maxWidth: 1220,
          margin: '0 auto',
          padding: '12px 22px',
          display: 'flex',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <button
          onClick={() => (window.location.hash = '#/landing')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            background: 'transparent',
            border: 'none',
            color: '#0f1f3a',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(135deg, rgba(15,66,88,1) 0%, rgba(72,177,217,0.92) 100%)',
              boxShadow: '0 14px 28px rgba(15,66,88,0.24)',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            <BrandGlyph />
          </span>
          <span style={{ display: 'grid', textAlign: 'left', gap: 2 }}>
            <span
              style={{
                fontWeight: 900,
                fontSize: 24,
                lineHeight: 1,
                letterSpacing: '-0.03em',
                color: '#0B2540',
              }}
            >
              2-Synced
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'rgba(11,37,64,0.58)',
              }}
            >
              B2B Intelligence
            </span>
          </span>
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              style={item.active ? activeNavBtn : navBtn}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}

          <button
            style={logoutBtn}
            onClick={() => {
              localStorage.removeItem('token');
              window.location.hash = '#/login';
            }}
          >
            <LogoutIcon />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function BrandGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 7.5C6 6.12 7.12 5 8.5 5H10.5C11.88 5 13 6.12 13 7.5C13 8.88 11.88 10 10.5 10H8.5C7.12 10 6 11.12 6 12.5C6 13.88 7.12 15 8.5 15H10.5C11.88 15 13 13.88 13 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M18 16.5C18 17.88 16.88 19 15.5 19H13.5C12.12 19 11 17.88 11 16.5C11 15.12 12.12 14 13.5 14H15.5C16.88 14 18 12.88 18 11.5C18 10.12 16.88 9 15.5 9H13.5C12.12 9 11 10.12 11 11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14" y="3" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3" y="14" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14" y="14" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 19C6.7 16.5 9.05 15.25 12 15.25C14.95 15.25 17.3 16.5 19 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 5H7C5.9 5 5 5.9 5 7V17C5 18.1 5.9 19 7 19H10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 16L18 12L14 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 12H10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const navBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.94)',
  color: '#0f4258',
  border: '1px solid rgba(15,66,88,0.14)',
  borderRadius: 14,
  padding: '10px 16px',
  minWidth: 116,
  fontWeight: 800,
  cursor: 'pointer',
  boxShadow: '0 12px 26px rgba(13,30,60,0.06)',
};

const activeNavBtn: React.CSSProperties = {
  ...navBtn,
  background: 'linear-gradient(135deg, rgba(15,66,88,1) 0%, rgba(25,73,114,0.96) 100%)',
  color: '#ffffff',
  border: '1px solid rgba(15,66,88,0.10)',
  boxShadow: '0 16px 32px rgba(15,66,88,0.20)',
};

const logoutBtn: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(11,37,64,0.98) 0%, rgba(15,66,88,1) 100%)',
  color: '#ffffff',
  border: 'none',
  borderRadius: 14,
  padding: '10px 16px',
  minWidth: 108,
  fontWeight: 800,
  cursor: 'pointer',
  boxShadow: '0 16px 32px rgba(11,37,64,0.18)',
};
