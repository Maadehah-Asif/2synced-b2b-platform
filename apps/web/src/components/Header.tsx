import '../styles/components.css';

export default function Header(){
  function onToggle(){
    window.dispatchEvent(new CustomEvent('toggleSidebar'));
  }

  return (
    <header className="header-row" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 64, background: 'var(--primary-3)', color: '#fff', padding: '0 16px', zIndex: 2000 }}>
      <div className="header-row">
        <button className="btn-sm btn-ghost" onClick={onToggle} aria-label="Toggle sidebar">☰</button>
        <div className="brand" onClick={() => window.location.hash = '#/landing'}>2Synced</div>
      </div>
  <nav className="flex gap-12">
        <button className="btn-ghost btn-sm btn-ghost-light" onClick={() => window.location.hash = '#/workspaces'}>Workspaces</button>
        <button className="btn-ghost btn-sm btn-ghost-light" onClick={() => window.location.hash = '#/profile'}>Profile</button>
      </nav>
    </header>
  );
}
