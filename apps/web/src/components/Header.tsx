import React from 'react';
import '../modules/core/auth/auth.css';

const headerStyle: React.CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  top: 0,
  height: 64,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 24px',
  background: '#0a66ff',
  color: '#fff',
  zIndex: 2000
};

const navStyle: React.CSSProperties = { display: 'flex', gap: 12 };

export default function Header(){
  return (
    <header style={headerStyle}>
      <div style={{ fontWeight: 800 }}>2Synced</div>
      <nav style={navStyle}>
    <button className="auth-button" style={{ width: 'auto', padding: '8px 12px', background:'#072a6f' }} onClick={() => window.location.hash = '#/workspaces'}>Workspaces</button>
    <button className="auth-button" style={{ width: 'auto', padding: '8px 12px', background:'#072a6f' }} onClick={() => window.location.hash = '#/profile'}>Profile</button>
      </nav>
    </header>
  );
}
