import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import ModuleBackButton from "../../components/ModuleBackButton";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function getWorkspaceId() {
  const hash = window.location.hash || "";
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
  return m ? m[1] : null;
}

type Channel = "email" | "whatsapp" | "call" | "meeting" | "note" | "other";

interface SentimentDistribution {
  positive: number;
  neutral: number;
  negative: number;
}

interface SentimentPoint {
  date: string;         // e.g. "2025-12-08"
  avgScore: number;     // -1..+1 or 0..1 depending on backend
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
}

interface EntityCount {
  type: string; // budget | decision_maker | timeline | competitor | other
  count: number;
}

interface TopEntity {
  type: string;
  value: string;
  count: number;
}

interface ChannelCoverage {
  channel: Channel;
  threadCount: number;
  messageCount: number;
}

interface AnalyticsSummary {
  sentimentDistribution: SentimentDistribution;
  sentimentOverTime: SentimentPoint[];
  entityCounts: EntityCount[];
  topEntities: TopEntity[];
  channelCoverage: ChannelCoverage[];
  totalThreads: number;
  totalMessages: number;
}

export default function AnalyticsPage() {
  const workspaceId = getWorkspaceId();

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // optional: date filter / channel filter
  const [channelFilter, setChannelFilter] = useState<string>("all");

  useEffect(() => {
    async function loadAnalytics() {
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

        const params = new URLSearchParams();
        params.set("workspaceId", workspaceId);
        if (channelFilter !== "all") params.set("channel", channelFilter);

        // endpoint: implement in backend as GET /m03/analytics/summary
        const res = await fetch(
          `${API_URL}/m03/analytics/summary?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const json: AnalyticsSummary | any = await res.json();
        if (!res.ok) {
          setError(json?.error || "Failed to load analytics.");
          setSummary(null);
        } else {
          setSummary(json as AnalyticsSummary);
        }
      } catch (err: any) {
        setError(err?.message || "Unexpected error while loading analytics.");
        setSummary(null);
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, [workspaceId, channelFilter]);

  function totalSentiment(dist?: SentimentDistribution) {
    if (!dist) return 0;
    return (dist.positive || 0) + (dist.neutral || 0) + (dist.negative || 0);
  }

  function sentimentPct(
    label: keyof SentimentDistribution,
    dist?: SentimentDistribution
  ) {
    const total = totalSentiment(dist);
    if (!dist || !total) return 0;
    return ((dist[label] || 0) / total) * 100;
  }

  function barWidth(pct: number) {
    return `${Math.max(0, Math.min(100, pct))}%`;
  }

  function formatDate(d: string) {
    const parsed = new Date(d);
    if (Number.isNaN(parsed.getTime())) return d;
    return parsed.toLocaleDateString();
  }

  return (
    <Layout>
      <main className="page-root">
        {/* Header */}
        <div className="page-header">
          <ModuleBackButton toSuffix="/m03" />
          <div className="page-title-block">
            <h1 className="page-title">Sentiment & entity analytics</h1>
            <p className="page-subtitle">
              See how conversation tone and key sales signals (budget, decision makers,
              timelines, competitors) are distributed across your pipeline.
            </p>
          </div>
        </div>

        {/* Filters / errors */}
        <section className="page-section">
          {error && (
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
              {error}
            </div>
          )}

          <div
            className="card"
            style={{
              padding: 12,
              marginBottom: 16,
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
            }}
          >
            <div className="muted" style={{ fontSize: 12 }}>
              Filters
            </div>
            <div style={{ width: 200 }}>
              <label className="muted" style={{ fontSize: 12 }}>
                Channel
              </label>
              <select
                className="input"
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
              >
                <option value="all">All channels</option>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="call">Call</option>
                <option value="meeting">Meeting</option>
                <option value="note">Internal note</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="muted" style={{ marginLeft: "auto", fontSize: 12 }}>
              {loading ? "Loading…" : ""}
            </div>
          </div>
        </section>

        {/* Top overview */}
        <section className="page-section">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div className="card" style={{ padding: 12 }}>
              <div className="muted" style={{ fontSize: 12 }}>
                Total threads
              </div>
              <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>
                {summary?.totalThreads ?? "—"}
              </div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div className="muted" style={{ fontSize: 12 }}>
                Total messages analyzed
              </div>
              <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>
                {summary?.totalMessages ?? "—"}
              </div>
            </div>
          </div>
        </section>

        {/* Sentiment + entities + channel coverage */}
        <section
          className="page-section"
          style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1.6fr) minmax(0, 1.4fr)", gap: 16 }}
        >
          {/* Sentiment distribution */}
          <div className="card" style={{ padding: 16 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
              Sentiment distribution
            </div>
            {!summary ? (
              <div className="muted" style={{ fontSize: 13 }}>
                No sentiment data available yet.
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
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      width: barWidth(
                        sentimentPct("positive", summary.sentimentDistribution)
                      ),
                      background: "#22C55E",
                    }}
                  />
                  <div
                    style={{
                      width: barWidth(
                        sentimentPct("neutral", summary.sentimentDistribution)
                      ),
                      background: "#FACC15",
                    }}
                  />
                  <div
                    style={{
                      width: barWidth(
                        sentimentPct("negative", summary.sentimentDistribution)
                      ),
                      background: "#EF4444",
                    }}
                  />
                </div>
                <div style={{ fontSize: 12 }}>
                  <div className="muted">
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: "#22C55E",
                        marginRight: 6,
                      }}
                    />
                    Positive ·{" "}
                    {sentimentPct("positive", summary.sentimentDistribution).toFixed(
                      0
                    )}
                    %
                  </div>
                  <div className="muted">
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: "#FACC15",
                        marginRight: 6,
                      }}
                    />
                    Neutral ·{" "}
                    {sentimentPct("neutral", summary.sentimentDistribution).toFixed(
                      0
                    )}
                    %
                  </div>
                  <div className="muted">
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: "#EF4444",
                        marginRight: 6,
                      }}
                    />
                    Negative ·{" "}
                    {sentimentPct("negative", summary.sentimentDistribution).toFixed(
                      0
                    )}
                    %
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Entity counts */}
          <div className="card" style={{ padding: 16 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
              Entity coverage (BANT & competitors)
            </div>
            {!summary || !summary.entityCounts || summary.entityCounts.length === 0 ? (
              <div className="muted" style={{ fontSize: 13 }}>
                No entities extracted yet. Run analysis for your conversations.
              </div>
            ) : (
              <div style={{ fontSize: 12 }}>
                {summary.entityCounts.map((e) => {
                  const labelMap: Record<string, string> = {
                    budget: "Budget",
                    decision_maker: "Decision makers",
                    timeline: "Timelines",
                    competitor: "Competitors",
                    other: "Other",
                  };
                  const label = labelMap[e.type] || e.type;
                  return (
                    <div
                      key={e.type}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 6,
                      }}
                    >
                      <span>{label}</span>
                      <span className="muted">{e.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Channel coverage */}
          <div className="card" style={{ padding: 16 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
              Channel coverage
            </div>
            {!summary || !summary.channelCoverage || summary.channelCoverage.length === 0 ? (
              <div className="muted" style={{ fontSize: 13 }}>
                No conversations per channel yet.
              </div>
            ) : (
              <div style={{ fontSize: 12 }}>
                {summary.channelCoverage.map((c) => (
                  <div
                    key={c.channel}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ textTransform: "capitalize" }}>
                      {c.channel}
                    </span>
                    <span className="muted">
                      {c.threadCount} threads · {c.messageCount} messages
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Sentiment trend + top entities */}
        <section
          className="page-section"
          style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.5fr)", gap: 16 }}
        >
          {/* Sentiment over time (simple line-ish view via bars) */}
          <div className="card" style={{ padding: 16 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
              Sentiment over time
            </div>
            {!summary || !summary.sentimentOverTime || summary.sentimentOverTime.length === 0 ? (
              <div className="muted" style={{ fontSize: 13 }}>
                No time-based sentiment data yet.
              </div>
            ) : (
              <div
                style={{
                  maxHeight: 260,
                  overflowY: "auto",
                  fontSize: 12,
                }}
              >
                {summary.sentimentOverTime.map((p) => (
                  <div
                    key={p.date}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                      }}
                    >
                      <span>{formatDate(p.date)}</span>
                      <span className="muted">
                        Avg score: {p.avgScore.toFixed(2)} ·{" "}
                        {p.positiveCount}↑ / {p.neutralCount}→ /{" "}
                        {p.negativeCount}↓
                      </span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        borderRadius: 999,
                        background: "#E5E7EB",
                        overflow: "hidden",
                      }}
                    >
                      {/* Map score to 0–100 bar; if backend uses -1..1, adjust as needed */}
                      <div
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(100, ((p.avgScore + 1) / 2) * 100)
                          )}%`,
                          background:
                            p.avgScore >= 0.1
                              ? "#22C55E"
                              : p.avgScore <= -0.1
                              ? "#EF4444"
                              : "#FACC15",
                          height: "100%",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top entities */}
          <div className="card" style={{ padding: 16 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
              Most frequently mentioned entities
            </div>
            {!summary || !summary.topEntities || summary.topEntities.length === 0 ? (
              <div className="muted" style={{ fontSize: 13 }}>
                No top entities to display yet.
              </div>
            ) : (
              <div
                style={{
                  fontSize: 12,
                  maxHeight: 260,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {summary.topEntities.map((e, idx) => {
                  const labelMap: Record<string, string> = {
                    budget: "Budget",
                    decision_maker: "Decision maker",
                    timeline: "Timeline",
                    competitor: "Competitor",
                    other: "Other",
                  };
                  const label = labelMap[e.type] || e.type;
                  return (
                    <div
                      key={`${e.type}-${e.value}-${idx}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <span
                          className="badge-muted"
                          style={{
                            fontSize: 11,
                            borderRadius: 999,
                            padding: "2px 8px",
                            marginRight: 6,
                          }}
                        >
                          {label}
                        </span>
                        <span>{e.value}</span>
                      </div>
                      <span className="muted">{e.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </Layout>
  );
}
