import { useEffect, useState } from 'react';
import '../styles/components.css';

export default function Sidebar(){
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    function onToggle(){ setCollapsed(c => !c); }
    window.addEventListener('toggleSidebar', onToggle as EventListener);
    return () => window.removeEventListener('toggleSidebar', onToggle as EventListener);
  }, []);

  return (
    <aside className={"sidebar" + (collapsed ? ' collapsed' : '')}>
      <div className="flex-col gap-12">
        <div className="sidebar-title">RevOps Platform</div>
        <div className="sidebar-subtitle">Revenue Operations Suite</div>
        <nav className="nav-column">
          <button className="nav-btn" onClick={() => window.location.hash = '#/workspaces'}>Dashboard</button>
          <button className="nav-btn" onClick={() => window.location.hash = '#/profile'}>Profile</button>
        </nav>
      </div>
      <div className="sidebar-help">Need Help? Contact support</div>
    </aside>
  );
}
