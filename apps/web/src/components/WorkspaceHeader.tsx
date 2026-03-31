import { useEffect, useState } from 'react';
import '../styles/components.css';
import { getWorkspaceIdFromHash } from '../utils/workspace';

export default function WorkspaceHeader(){
  const workspaceId = getWorkspaceIdFromHash();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const route = window.location.hash || '';

  function go(path: string){
    if (!workspaceId) return;
    window.location.hash = path.replace(':workspaceId', workspaceId);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent){
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('.dropdown')) return;
      setOpenMenu(null);
    }
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const navItems = [
    {
      label: 'Overview',
      active: route === `#/workspace/${workspaceId}` || route.startsWith(`#/workspace/${workspaceId}/m`),
      onClick: () => go(`#/workspace/${workspaceId}`),
      icon: <OverviewIcon />,
    },
    {
      label: 'Members',
      active: route.includes('/members'),
      onClick: () => go(`#/workspace/${workspaceId}/members`),
      icon: <MembersIcon />,
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: 72,
        left: 0,
        right: 0,
        zIndex: 1900,
        background: 'linear-gradient(90deg, rgba(11,37,64,0.98) 0%, rgba(15,66,88,0.98) 55%, rgba(25,73,114,0.98) 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 16px 30px rgba(4,12,24,0.10)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div
        style={{
          maxWidth: 1220,
          margin: '0 auto',
          padding: '10px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              style={item.active ? activePill : pillBtn}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div
          style={{
            padding: '8px 12px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.82)',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Workspace Navigation
        </div>
      </div>
    </div>
  );
}

function OverviewIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12L12 5L20 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 10.5V19H17V10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MembersIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.5 18C5.8 15.9 7.85 14.85 10.65 14.85C13.45 14.85 15.5 15.9 16.8 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15.5 16.5C16.2 15.45 17.3 14.9 18.8 14.9C20.05 14.9 21.03 15.28 21.75 16.05" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const pillBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.10)',
  color: '#ffffff',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 14,
  padding: '10px 14px',
  fontWeight: 800,
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
};

const activePill: React.CSSProperties = {
  ...pillBtn,
  background: 'linear-gradient(135deg, rgba(255,255,255,0.20) 0%, rgba(72,177,217,0.24) 100%)',
  border: '1px solid rgba(255,255,255,0.18)',
  boxShadow: '0 10px 24px rgba(3,12,24,0.18)',
};
