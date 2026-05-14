import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import ModuleBackButton from "../../components/ModuleBackButton";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function getWorkspaceId() {
  const hash = window.location.hash || "";
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
  return m ? m[1] : null;
}

type HealthBand = "healthy" | "steady" | "at_risk" | string;
type Channel = "email" | "whatsapp" | "call" | "meeting" | "note" | "other";

interface HealthBandBucket {
  band: HealthBand;
  count: number;
}

interface TopCompetitor {
  name: string;
  count: number;
}

interface DashboardSummary {
  totalThreads: number;
  averageHealthScore: number;
  healthByBand: HealthBandBucket[];
  pendingFollowUps: number;
  overdueFollowUps: number;
  topCompetitors?: TopCompetitor[];
}

// Backend API response shape
interface DealHealthApiItem {
  thread: {
    _id: string;
    subject: string;
    channel: Channel;
    lastMessageAt?: string;
    dealId?: string;
    leadId?: string;
  };
  latestHealth: {
    _id: string;
    score: number;
    band: "healthy" | "steady" | "at_risk";
    trend?: "improving" | "worsening" | "flat";
    reasons?: string[];
  } | null;
}

interface DealHealthApiResponse {
  items: DealHealthApiItem[];
  page: number;
  pageSize: number;
  total: number;
}

// Frontend display item (mapped from API)
interface DealHealthItem {
  id: string;
  dealId?: string | null;
  threadId: string;
  accountName?: string | null;
  dealName?: string | null;
  score: number;
  band: "healthy" | "steady" | "at_risk";
  probabilityHealthy?: number;
  lastAnalyzedAt?: string;
  lastMessageAt?: string;
  reasons?: string[];
  subject: string;
  channel: Channel;
  trend?: "improving" | "worsening" | "flat";
}

export default function DealHealthBoard() {
  const workspaceId = getWorkspaceId();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [dealHealthItems, setDealHealthItems] = useState<DealHealthItem[]>([]);
  const [dealHealthLoading, setDealHealthLoading] = useState(false);
  const [dealHealthError, setDealHealthError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSummary() {
      if (!workspaceId) return;
      setSummaryLoading(true);
      setSummaryError(null);

      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setSummaryError("You are not logged in.");
          setSummaryLoading(false);
          return;
        }

        const res = await fetch(`${API_URL}/m03/dashboard/summary?workspaceId=${encodeURIComponent(workspaceId)}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const json = (await res.json()) as DashboardSummary | any;
        if (!res.ok) {
          setSummaryError(json?.error || "Failed to load dashboard summary.");
        } else {
          setSummary(json as DashboardSummary);
        }
      } catch (err: any) {
        setSummaryError(
          err?.message || "Unexpected error while loading summary."
        );
      } finally {
        setSummaryLoading(false);
      }
    }

    async function loadDealHealth() {
      if (!workspaceId) return;
      setDealHealthLoading(true);
      setDealHealthError(null);

      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setDealHealthError("You are not logged in.");
          setDealHealthLoading(false);
          return;
        }

        const res = await fetch(`${API_URL}/m03/deal-health?workspaceId=${encodeURIComponent(workspaceId)}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const json = (await res.json()) as DealHealthApiResponse | any;
        if (!res.ok) {
          setDealHealthError(
            json?.error || "Failed to load deal health data."
          );
          setDealHealthItems([]);
        } else {
          // Map API response to frontend format
          const mappedItems: DealHealthItem[] = (json.items || []).map((item: DealHealthApiItem) => {
            const health = item.latestHealth;
            return {
              id: health?._id || item.thread._id,
              threadId: item.thread._id,
              dealId: item.thread.dealId || null,
              accountName: null, // Not available in current API
              dealName: null, // Not available in current API
              score: health?.score || 0,
              band: health?.band || "steady",
              lastAnalyzedAt: undefined, // Not in current API response
              lastMessageAt: item.thread.lastMessageAt,
              reasons: health?.reasons || [],
              subject: item.thread.subject,
              channel: item.thread.channel,
              trend: health?.trend,
            };
          });
          setDealHealthItems(mappedItems);
        }
      } catch (err: any) {
        setDealHealthError(
          err?.message || "Unexpected error while loading deal health data."
        );
        setDealHealthItems([]);
      } finally {
        setDealHealthLoading(false);
      }
    }

    loadSummary();
    loadDealHealth();
  }, [workspaceId]);

  function bandCount(band: HealthBand) {
    if (!summary?.healthByBand) return 0;
    return (
      summary.healthByBand.find((b) => b.band === band)?.count || 0
    );
  }

  function totalHealthCounts() {
    if (!summary?.healthByBand) return 0;
    return summary.healthByBand.reduce((acc, b) => acc + (b.count || 0), 0);
  }

  function bandPercentage(band: HealthBand) {
    const total = totalHealthCounts();
    if (!total) return 0;
    return (bandCount(band) / total) * 100;
  }

  function bandLabel(band: HealthBand) {
    if (band === "healthy") return "Healthy";
    if (band === "steady" || band === "monitor" || band === "neutral") return "Steady"; // Handle backward compatibility
    if (band === "at_risk") return "At risk";
    return String(band);
  }

  function bandBadgeClass(band: HealthBand | undefined) {
    if (!band) return "badge-muted";
    if (band === "healthy") return "badge-success";
    if (band === "at_risk") return "badge-danger";
    return "badge-warning";
  }

  function formatDate(value?: string) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
  }

  function handleRowClick(threadId: string) {
    const wid = workspaceId;
    if (!wid) return;
    window.location.hash = `#/workspace/${wid}/m03/conversations/${threadId}`;
  }

  // Loading state
  if (dealHealthLoading && dealHealthItems.length === 0) {
    return (
      <Layout>
        <main className="page-root">
          <div className="page-header">
            <ModuleBackButton toSuffix="/m03" />
            <div className="page-title-block">
              <h1 className="page-title">Deal health board</h1>
              <p className="page-subtitle">
                High-level view of how healthy your opportunities are based on recent
                conversations, sentiment, and sales signals.
              </p>
            </div>
          </div>
          <div className="p-20">Loading deal health...</div>
        </main>
      </Layout>
    );
  }

  return (
    <Layout>
      <main className="page-root">
        {/* Header */}
        <div className="page-header">
          <ModuleBackButton toSuffix="/m03" />
          <div className="page-title-block">
            <h1 className="page-title">Deal health board</h1>
            <p className="page-subtitle">
              High-level view of how healthy your opportunities are based on recent
              conversations, sentiment, and sales signals.
            </p>
          </div>
        </div>

        {/* Top metrics */}
        <section className="page-section">
          {summaryError && (
            <div
              style={{
                marginBottom: 12,
                padding: "8px 12px",
                borderRadius: 6,
                background: "#FEE2E2",
                color: "#991B1B",
                fontSize: 13,
              }}
            >
              {summaryError}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            {/* Total conversations */}
            <div className="card" style={{ padding: 12 }}>
              <div className="muted" style={{ fontSize: 12 }}>
                Conversations analyzed
              </div>
              <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>
                {summaryLoading
                  ? "…"
                  : summary?.totalThreads != null
                  ? summary.totalThreads
                  : "—"}
              </div>
            </div>

            {/* Average health score */}
            <div className="card" style={{ padding: 12 }}>
              <div className="muted" style={{ fontSize: 12 }}>
                Average deal health
              </div>
              <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>
                {summaryLoading
                  ? "…"
                  : summary?.averageHealthScore != null
                  ? Math.round(summary.averageHealthScore)
                  : "—"}
              </div>
            </div>

            {/* Pending follow-ups */}
            <div className="card" style={{ padding: 12 }}>
              <div className="muted" style={{ fontSize: 12 }}>
                Pending follow-ups
              </div>
              <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>
                {summaryLoading
                  ? "…"
                  : summary?.pendingFollowUps != null
                  ? summary.pendingFollowUps
                  : "—"}
              </div>
            </div>

            {/* Overdue follow-ups */}
            <div className="card" style={{ padding: 12 }}>
              <div className="muted" style={{ fontSize: 12 }}>
                Overdue follow-ups
              </div>
              <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>
                {summaryLoading
                  ? "…"
                  : summary?.overdueFollowUps != null
                  ? summary.overdueFollowUps
                  : "—"}
              </div>
            </div>
          </div>

          {/* Health band distribution */}
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
              Deal health distribution
            </div>
            {!summary || totalHealthCounts() === 0 ? (
              <div className="muted" style={{ fontSize: 13 }}>
                No health scores available yet. Run analysis on your conversations to
                populate this view.
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "stretch",
                    height: 16,
                    borderRadius: 999,
                    overflow: "hidden",
                    background: "#E5E7EB",
                    marginBottom: 8,
                  }}
                >
                  {(["healthy", "steady", "at_risk"] as HealthBand[]).map(
                    (b) => {
                      const pct = bandPercentage(b);
                      if (!pct) return null;
                      const color =
                        b === "healthy"
                          ? "#22C55E"
                          : b === "steady" || b === "monitor" || b === "neutral" // Handle backward compatibility
                          ? "#FACC15"
                          : "#EF4444";
                      return (
                        <div
                          key={b}
                          style={{
                            width: `${pct}%`,
                            background: color,
                          }}
                        />
                      );
                    }
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    flexWrap: "wrap",
                    fontSize: 12,
                  }}
                >
                  {(["healthy", "steady", "at_risk"] as HealthBand[]).map(
                    (b) => (
                      <div key={b} className="muted">
                        <span
                          style={{
                            display: "inline-block",
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            marginRight: 6,
                            background:
                              b === "healthy"
                                ? "#22C55E"
                                : b === "steady" || b === "monitor" || b === "neutral" // Handle backward compatibility
                                ? "#FACC15"
                                : "#EF4444",
                          }}
                        />
                        {bandLabel(b)} · {bandCount(b)} deals (
                        {bandPercentage(b).toFixed(0)}%)
                      </div>
                    )
                  )}
                </div>
              </>
            )}
          </div>

          {/* Top competitors */}
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
              Most mentioned competitors
            </div>
            {!summary?.topCompetitors || summary.topCompetitors.length === 0 ? (
              <div className="muted" style={{ fontSize: 13 }}>
                No competitor mentions detected yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {summary.topCompetitors.map((c) => (
                  <span
                    key={c.name}
                    className="badge-muted"
                    style={{
                      fontSize: 11,
                      borderRadius: 999,
                      padding: "2px 8px",
                    }}
                  >
                    {c.name} · {c.count}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Deal health table */}
        <section className="page-section">
          {dealHealthError && (
            <div
              style={{
                marginBottom: 12,
                padding: "8px 12px",
                borderRadius: 6,
                background: "#FEF3C7",
                color: "#92400E",
                fontSize: 13,
              }}
            >
              {dealHealthError}
            </div>
          )}

          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <div
              style={{
                padding: "10px 12px",
                borderBottom: "1px solid #E5E7EB",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Deal health overview
                </div>
                <div className="muted" style={{ fontSize: 11 }}>
                  All analyzed deals with their health scores and key indicators.
                </div>
              </div>
            </div>
            {dealHealthLoading ? (
              <div style={{ padding: "20px", textAlign: "center" }}>
                Loading deal health...
              </div>
            ) : dealHealthError ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#991B1B" }}>
                {dealHealthError}
              </div>
            ) : dealHealthItems.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center" }}>
                <div className="muted" style={{ fontSize: 14, marginBottom: 8 }}>
                  No analyzed deals yet.
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  Run conversation analysis on a few threads to see deal health scores here.
                </div>
              </div>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#F9FAFB",
                      textAlign: "left",
                      borderBottom: "1px solid #E5E7EB",
                    }}
                  >
                    <th style={{ padding: "8px 12px", minWidth: 220 }}>Deal / Subject</th>
                    <th style={{ padding: "8px 12px", minWidth: 80 }}>Channel</th>
                    <th style={{ padding: "8px 12px", minWidth: 110 }}>
                      Last message
                    </th>
                    <th style={{ padding: "8px 12px", minWidth: 90 }}>
                      Health score
                    </th>
                    <th style={{ padding: "8px 12px", minWidth: 100 }}>
                      Status
                    </th>
                    <th style={{ padding: "8px 12px", minWidth: 200 }}>
                      Key reasons
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dealHealthItems.map((item) => {
                    const displayName = item.dealName || item.accountName || item.subject || item.threadId;
                    const topReasons = item.reasons?.slice(0, 3) || [];
                    return (
                      <tr
                        key={item.id}
                        style={{
                          cursor: "pointer",
                          borderTop: "1px solid #E5E7EB",
                        }}
                        onClick={() => handleRowClick(item.threadId)}
                      >
                        <td style={{ padding: "8px 12px" }}>
                          <div style={{ fontWeight: 500 }}>{displayName}</div>
                        </td>
                        <td
                          style={{
                            padding: "8px 12px",
                            textTransform: "capitalize",
                          }}
                        >
                          {item.channel}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          {formatDate(item.lastMessageAt)}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          {Math.round(item.score)}/100
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <span className={bandBadgeClass(item.band)}>
                            {bandLabel(item.band)}
                          </span>
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          {topReasons.length > 0 ? (
                            <div style={{ fontSize: 12, color: "#6B7280" }}>
                              {topReasons.map((reason, idx) => (
                                <div key={idx} style={{ marginBottom: 4 }}>
                                  • {reason}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
    </Layout>
  );
}
