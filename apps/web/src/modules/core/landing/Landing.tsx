import { useEffect } from "react";
import Layout from '../../../components/Layout';
import "../auth/auth.css";

export default function Landing() {
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) window.location.hash = '#/login';
  }, []);

  return (
    <Layout>
      <div style={{ minHeight: 'calc(100vh - 80px)', background: 'linear-gradient(180deg,#0c1725,#071228)', padding: 28 }}>
        <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ maxWidth: 1100, width: '100%', display: 'flex', gap: 24 }}>
            <section style={{ flex: 1, padding: 24 }}>
              <h1 style={{ marginTop: 0, color: '#fff', fontSize: 48 }}>Welcome back</h1>
              <p style={{ fontSize: 18, color: '#9aa4b2' }}>Manage your account and workspaces here. Create a workspace or request to join an existing one using the workspace ID. Workspace admins must approve join requests.</p>
              <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                <button className="auth-button" onClick={() => window.location.hash = '#/create-workspace'} style={{ width: 160 }}>Create Workspace</button>
                <button className="auth-button" onClick={() => window.location.hash = '#/join-workspace'} style={{ width: 160 }}>Join Workspace</button>
                <button className="auth-button" onClick={() => window.location.hash = '#/workspaces'} style={{ width: 160 }}>View My Workspaces</button>
              </div>
            </section>
            <aside style={{ width: 320, background: '#0f1724', borderRadius: 8, padding: 20 }}>
              <h3 style={{ marginTop: 0, color: '#eef2ff' }}>Quick Links</h3>
              <ul style={{ color: '#9aa4b2' }}>
                <li>Profile</li>
                <li>Manage workspaces</li>
              </ul>
            </aside>
          </div>
        </main>
      </div>
    </Layout>
  );
}
