import React from 'react';
import Header from './Header';
import WorkspaceHeader from './WorkspaceHeader';
import '../styles/components.css';
import '../modules/core/auth/auth.css';

export default function Layout({ children, fullBleed = false }: { children: React.ReactNode; fullBleed?: boolean }){
  return (
    <div className="app-root">
      <Header />
      {typeof window !== 'undefined' && (
        (window.location.hash || '').startsWith('#/workspace/') ||
        (window.location.hash || '').startsWith('#/m01/')
      ) && (
        <WorkspaceHeader />
      )}
      <div className="app-layout">
        <main className="app-main">
          <div className={fullBleed ? 'surface' : 'surface card-pad'} style={fullBleed ? { padding: 0, maxHeight: 'none', overflow: 'visible' } : {}}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
