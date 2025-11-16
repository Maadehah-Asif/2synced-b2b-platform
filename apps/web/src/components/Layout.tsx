import React, { useEffect, useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import '../styles/components.css';
import '../modules/core/auth/auth.css';

export default function Layout({ children }: { children: React.ReactNode }){
  const [, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    function onToggle(){ setSidebarCollapsed(s => !s); }
    window.addEventListener('toggleSidebar', onToggle as EventListener);
    return () => window.removeEventListener('toggleSidebar', onToggle as EventListener);
  }, []);

  return (
    <div className="app-root">
      <Header />
      <div className="app-layout">
        <Sidebar />
        <main className="app-main">
          <div className="surface card-pad">{children}</div>
        </main>
      </div>
    </div>
  );
}
