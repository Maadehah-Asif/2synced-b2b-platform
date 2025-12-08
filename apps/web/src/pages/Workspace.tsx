import { useEffect, useState } from 'react';
import Layout from '../components/Layout';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const palette = {
  backdrop: '#e8ecf8',
  card: '#f7f9ff',
  navy: '#1f2f73',
  sky: '#cfd6ec',
  blue: '#2f7bdd',
  orange: '#f6a23a',
  shadow: '0 14px 36px rgba(18,36,90,0.14)',
};

export default function Workspace() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string; fullName?: string } | null>(null);
  const [memberships, setMemberships] = useState<Array<{ id: string; workspaceId: string; role: string }>>([]);

  useEffect(() => {
    async function load() {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.hash = '#/login';
        return;
      }

      try {
        const res = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          localStorage.removeItem('token');
          window.location.hash = '#/login';
          return;
        }
        const data = await res.json();
        setUser(data.user);
        setMemberships(data.memberships || []);
      } catch (err: any) {
        console.error('Workspace load failed', err);
        setError('Failed to load your account');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleLogout() {
    localStorage.removeItem('token');
    window.location.hash = '#/login';
  }

  if (loading) return <div style={{ padding: 24 }}>Loading your account...</div>;
  if (error) return <div style={{ padding: 24 }}>{error}</div>;

  return (
    <Layout>
      <div
        style={{
          background: `linear-gradient(135deg, ${palette.backdrop} 0%, #dde3f5 100%)`,
          minHeight: 'calc(100vh - 120px)',
          padding: '26px 0',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', display: 'grid', gap: 16 }}>
          <div
            style={{
              background: palette.card,
              borderRadius: 16,
              padding: 18,
              boxShadow: palette.shadow,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              border: '1px solid rgba(31,47,115,0.08)',
            }}
          >
            <div>
              <div style={{ fontSize: 14, color: palette.navy }}>Workspace overview</div>
              <h2 style={{ margin: '6px 0 0', color: palette.navy }}>
                Welcome{user?.fullName ? `, ${user.fullName}` : ''}
              </h2>
              <div style={{ color: '#3a4a68', fontSize: 14 }}>{user?.email}</div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: palette.navy,
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '10px 14px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 12px 24px rgba(18,36,90,0.2)',
              }}
            >
              Log out
            </button>
          </div>

          <div
            style={{
              background: palette.card,
              borderRadius: 16,
              padding: 18,
              boxShadow: palette.shadow,
              border: '1px solid rgba(31,47,115,0.08)',
              display: 'grid',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: palette.navy }}>Your memberships</h3>
              <span style={{ color: '#4b5d7f', fontSize: 13 }}>
                Palette preview: navy, sky, and coin orange from the concept art.
              </span>
            </div>

            {memberships.length === 0 ? (
              <p style={{ margin: 0, color: '#4b5d7f' }}>You are not a member of any workspace yet.</p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 12,
                }}
              >
                {memberships.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      background: '#ffffff',
                      borderRadius: 12,
                      padding: 14,
                      border: `1px solid ${palette.sky}`,
                      boxShadow: '0 10px 24px rgba(18,36,90,0.12)',
                      display: 'grid',
                      gap: 6,
                    }}
                  >
                    <div style={{ color: palette.navy, fontWeight: 700 }}>Workspace {m.workspaceId}</div>
                    <div style={{ color: '#3a4a68', fontSize: 14 }}>ID: {m.id}</div>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        background: 'rgba(246,162,58,0.12)',
                        color: palette.orange,
                        padding: '6px 10px',
                        borderRadius: 999,
                        border: `1px solid rgba(246,162,58,0.4)`,
                        fontWeight: 700,
                        fontSize: 12,
                        width: 'fit-content',
                      }}
                    >
                      Role
                      <span
                        style={{
                          background: palette.orange,
                          color: '#0f213e',
                          borderRadius: 6,
                          padding: '4px 8px',
                          fontWeight: 800,
                          boxShadow: '0 6px 14px rgba(246,162,58,0.35)',
                        }}
                      >
                        {m.role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              background: palette.card,
              borderRadius: 16,
              padding: 18,
              boxShadow: palette.shadow,
              border: '1px solid rgba(31,47,115,0.08)',
            }}
          >
            <h3 style={{ marginTop: 0, color: palette.navy }}>Quick actions</h3>
            <p style={{ color: '#3a4a68', marginBottom: 0 }}>
              Palette-only preview for card styling. Replace this content with your real dashboard actions.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
