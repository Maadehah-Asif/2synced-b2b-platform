import React from 'react';
import '../modules/core/auth/auth.css';

const sidebarStyle: React.CSSProperties = {
  width: 220,
  background: '#0f1724',
  color: '#fff',
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  minHeight: 'calc(100vh - 64px)'
};

export default function Sidebar(){
  return (
    <aside style={sidebarStyle}>
      <div>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>RevOps Platform</div>
        <div style={{ color: '#9aa4b2', fontSize: 12, marginBottom: 18 }}>Revenue Operations Suite</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button className="auth-button" style={{ background: '#0b1320' }} onClick={() => window.location.hash = '#/workspaces'}>Dashboard</button>
          <button className="auth-button" style={{ background: 'transparent', boxShadow: 'none' }} onClick={() => window.location.hash = '#/profile'}>Profile</button>
        </nav>
      </div>
      <div style={{ fontSize: 13, color: '#9aa4b2' }}>Need Help? Contact support</div>
    </aside>
  );
}
