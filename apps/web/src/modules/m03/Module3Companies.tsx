import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import ModuleBackButton from "../../components/ModuleBackButton";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function getWorkspaceId() {
  const hash = window.location.hash || "";
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
  return m ? m[1] : null;
}

interface M03CompanySummary {
  id: string;
  name: string;
  threadCount: number;
  lastMessageAt: string | null;
  lastHealthScore?: number | null;
}

interface CompaniesResponse {
  companies: M03CompanySummary[];
}

export default function Module3Companies() {
  const workspaceId = getWorkspaceId();
  const [companies, setCompanies] = useState<M03CompanySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCompanies() {
      if (!workspaceId) return;
      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setError("You are not logged in.");
          setLoading(false);
          return;
        }

        const res = await fetch(
          `${API_URL}/m03/companies?workspaceId=${encodeURIComponent(workspaceId)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data: CompaniesResponse | any = await res.json();
        if (!res.ok) {
          setError(data?.error || "Failed to load companies.");
          setCompanies([]);
        } else {
          setCompanies(data.companies || []);
        }
      } catch (err: any) {
        setError(err?.message || "Unexpected error while loading companies.");
        setCompanies([]);
      } finally {
        setLoading(false);
      }
    }

    loadCompanies();
  }, [workspaceId]);

  function formatDate(iso: string | null) {
    if (!iso) return "Never";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Never";
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  }

  function getHealthLabel(score?: number | null): string {
    if (score === null || score === undefined) return "Unknown";
    if (score >= 70) return "Healthy";
    if (score >= 40) return "Neutral";
    return "At risk";
  }

  function getHealthClass(score?: number | null): string {
    if (score === null || score === undefined) return "badge-muted";
    if (score >= 70) return "badge-success";
    if (score >= 40) return "badge-warning";
    return "badge-danger";
  }

  function handleCompanyClick(companyId: string) {
    const wid = workspaceId;
    if (!wid) return;
    window.location.hash = `#/workspace/${wid}/m03/explorer?companyId=${encodeURIComponent(companyId)}`;
  }

  return (
    <Layout>
      <main className="page-root">
        {/* Header */}
        <div className="page-header">
          <ModuleBackButton toSuffix="/m03" />
          <div className="page-title-block">
            <h1 className="page-title">Companies</h1>
            <p className="page-subtitle">
              Browse all organisations and their conversations
            </p>
          </div>
        </div>

        {/* Content */}
        <section className="page-section">
          {loading && (
            <div style={{ textAlign: "center", padding: "32px" }}>
              <div className="muted">Loading companies...</div>
            </div>
          )}

          {error && (
            <div
              className="card"
              style={{
                padding: 16,
                backgroundColor: "#FEF2F2",
                borderColor: "#FCA5A5",
                marginBottom: 16,
              }}
            >
              <div style={{ color: "#DC2626", fontSize: 14 }}>{error}</div>
            </div>
          )}

          {!loading && !error && companies.length === 0 && (
            <div className="card" style={{ padding: 32, textAlign: "center" }}>
              <div className="muted">No companies found with conversation activity.</div>
            </div>
          )}

          {!loading && !error && companies.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 16,
              }}
            >
              {companies.map((company) => (
                <div
                  key={company.id}
                  className="module-card"
                  style={{
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onClick={() => handleCompanyClick(company.id)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "";
                  }}
                >
                  <div className="label" style={{ fontSize: 18, marginBottom: 8 }}>
                    {company.name}
                  </div>
                  
                  <div style={{ marginBottom: 12 }}>
                    <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
                      Threads: <strong>{company.threadCount}</strong>
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Last activity: {formatDate(company.lastMessageAt)}
                    </div>
                  </div>

                  {company.lastHealthScore !== null && company.lastHealthScore !== undefined && (
                    <div style={{ marginTop: 8 }}>
                      <span
                        className={`badge ${getHealthClass(company.lastHealthScore)}`}
                        style={{ fontSize: 11 }}
                      >
                        Health: {getHealthLabel(company.lastHealthScore)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </Layout>
  );
}

