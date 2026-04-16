import React from 'react';
import Header from './Header';
import WorkspaceHeader from './WorkspaceHeader';
import GuidedAssistantHost from '../modules/m04/GuidedAssistantHost';
import '../styles/components.css';
import '../modules/core/auth/auth.css';

export default function Layout({ children, fullBleed = false }: { children: React.ReactNode; fullBleed?: boolean }){
  return (
    <div className="app-root">
      <div className="app-header-shell">
        <Header />
      </div>
      {typeof window !== 'undefined' && (
        (window.location.hash || '').startsWith('#/workspace/') ||
        (window.location.hash || '').startsWith('#/m01/')
      ) && (
        <div className="workspace-header-shell">
          <WorkspaceHeader />
        </div>
      )}
      <div className="app-layout">
        <main className="app-main">
          <div className={fullBleed ? 'surface' : 'surface card-pad'} style={fullBleed ? { padding: 0, maxHeight: 'none', overflow: 'visible' } : {}}>
            {children}
          </div>
        </main>
      </div>
      <div className="guided-assistant-shell">
        <GuidedAssistantHost />
      </div>
    </div>
  );
}
