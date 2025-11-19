import React from 'react';
import Header from './Header';
import WorkspaceHeader from './WorkspaceHeader';
import '../styles/components.css';
import '../modules/core/auth/auth.css';

export default function Layout({ children }: { children: React.ReactNode }){
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
          <div className="surface card-pad">{children}</div>
        </main>
      </div>
    </div>
  );
}
