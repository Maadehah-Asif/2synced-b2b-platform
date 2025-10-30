import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import '../modules/core/auth/auth.css';

export default function Layout({ children }: { children: React.ReactNode }){
  return (
    <div>
      <Header />
      <div style={{ display: 'flex', paddingTop: 80, minHeight: 'calc(100vh - 80px)', background: '#0b1116' }}>
        <Sidebar />
        <main style={{ flex: 1, padding: 20 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
