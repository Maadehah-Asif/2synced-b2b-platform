import '../styles/components.css';

export default function Header(){
  return (
    <header style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 64, background: 'var(--header-primary)', color: '#fff', padding: '0 16px', zIndex: 2000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="brand" style={{ color: '#fff', cursor: 'pointer' }} onClick={() => window.location.hash = '#/landing'}>2Synced</div>
        </div>

        <nav className="flex gap-12">
          <button className="btn-ghost-translucent btn-sm" onClick={() => window.location.hash = '#/workspaces'} style={{ color: '#fff' }}>Workspaces</button>
          <button className="btn-ghost-translucent btn-sm" onClick={() => window.location.hash = '#/profile'} style={{ color: '#fff' }}>Profile</button>
        </nav>
      </div>
    </header>
  );
}
