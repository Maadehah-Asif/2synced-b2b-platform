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
      <div style={{ minHeight: 'calc(100vh - 80px)', background: 'var(--page-bg)', padding: 28 }}>
        <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ maxWidth: 1100, width: '100%', display: 'flex', gap: 24 }}>
            <section style={{ flex: 1, padding: 24, background: 'var(--container-bg)', borderRadius: 12 }}>
              <h1 style={{ marginTop: 0, color: 'var(--text-primary)', fontSize: 48 }}>Welcome back</h1>
              <p style={{ fontSize: 18, color: 'var(--text-muted)' }}>Manage your account and workspaces here. Create a workspace or request to join an existing one using the workspace ID. Workspace admins must approve join requests.</p>
              <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                <button className="btn-primary" onClick={() => window.location.hash = '#/create-workspace'} style={{ width: 160 }}>Create Workspace</button>
                <button className="btn-primary" onClick={() => window.location.hash = '#/join-workspace'} style={{ width: 160 }}>Join Workspace</button>
                <button className="btn-primary" onClick={() => window.location.hash = '#/workspaces'} style={{ width: 160 }}>View My Workspaces</button>
              </div>
            </section>
            <aside style={{ width: 320, background: 'var(--container-bg)', borderRadius: 8, padding: 20 }}>
              <h3 style={{ marginTop: 0, color: 'var(--text-primary)' }}>Quick Links</h3>
              <ul style={{ color: 'var(--text-muted)' }}>
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
