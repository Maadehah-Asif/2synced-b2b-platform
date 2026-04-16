import { useEffect, useState, type CSSProperties, type MouseEvent } from "react";
import Layout from "../../components/Layout";
import ModuleBackButton from "../../components/ModuleBackButton";
import { fetchModule3Json } from "./api";

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

interface DealHealthItem {
  id: string;
  dealId?: string | null;
  leadId?: string | null;
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

const leadProfileActionStyle: CSSProperties = {
  marginTop: 6,
  padding: 0,
  border: "none",
  background: "transparent",
  color: "#0F766E",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const pageCardStyle: CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E5E7EB",
  borderRadius: 14,
  boxShadow: "0 6px 20px rgba(15, 23, 42, 0.04)",
};

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
        const json = await fetchModule3Json<DashboardSummary>("/dashboard/summary", {
          workspaceId,
        });
        setSummary(json);
      } catch (err: any) {
        setSummaryError(err?.message || "Unexpected error while loading summary.");
      } finally {
        setSummaryLoading(false);
      }
    }

    async function loadDealHealth() {
      if (!workspaceId) return;
      setDealHealthLoading(true);
      setDealHealthError(null);

      try {
        const json = await fetchModule3Json<DealHealthApiResponse>("/deal-health", {
          workspaceId,
        });
        const mappedItems: DealHealthItem[] = (json.items || []).map((item) => {
          const health = item.latestHealth;
          return {
            id: health?._id || item.thread._id,
            threadId: item.thread._id,
            dealId: item.thread.dealId || null,
            leadId: item.thread.leadId || null,
            accountName: null,
            dealName: null,
            score: health?.score || 0,
            band: health?.band || "steady",
            lastAnalyzedAt: undefined,
            lastMessageAt: item.thread.lastMessageAt,
            reasons: health?.reasons || [],
            subject: item.thread.subject,
            channel: item.thread.channel,
            trend: health?.trend,
          };
        });
        setDealHealthItems(mappedItems);
      } catch (err: any) {
        setDealHealthError(err?.message || "Unexpected error while loading deal health data.");
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
    return summary.healthByBand.find((b) => b.band === band)?.count || 0;
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
    if (band === "steady" || band === "monitor" || band === "neutral") return "Stable";
    if (band === "at_risk") return "At Risk";
    return String(band);
  }

  function bandBadgeClass(band: HealthBand | undefined) {
    if (!band) return "badge-muted";
    if (band === "healthy") return "badge-success";
    if (band === "at_risk") return "badge-danger";
    return "badge-warning";
  }

  function formatDate(value?: string) {
    if (!value) return "No recent activity";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "No recent activity";
    return d.toLocaleDateString();
  }

  function formatRelativeActivity(value?: string) {
    if (!value) return "No recent activity";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "No recent activity";
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayDiff = Math.round((startOfToday.getTime() - startOfDay.getTime()) / (1000 * 60 * 60 * 24));
    if (dayDiff <= 0) return "Today";
    if (dayDiff === 1) return "Yesterday";
    if (dayDiff < 7) return `${dayDiff} days ago`;
    return d.toLocaleDateString();
  }

  function handleRowClick(threadId: string) {
    const wid = workspaceId;
    if (!wid) return;
    window.location.hash = `#/workspace/${wid}/m03/conversations/${threadId}`;
  }

  function openLeadProfile(leadId: string, e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    const wid = workspaceId;
    if (!wid || !leadId) return;
    window.location.hash = `#/workspace/${wid}/m03/leads/${encodeURIComponent(leadId)}/profile`;
  }

  function getStatusExplanation(item: DealHealthItem) {
    const firstReason = item.reasons?.[0];
    if (firstReason) return firstReason;
    if (item.band === "healthy") {
      return "Recent conversation signals suggest this thread is moving in a healthy direction.";
    }
    if (item.band === "at_risk") {
      return "The current signals suggest this conversation could stall without a review.";
    }
    return "This conversation is still in play, but it needs closer monitoring.";
  }

  function getSuggestedNextStep(item: DealHealthItem) {
    if (item.reasons && item.reasons.length > 0) {
      if (item.band === "at_risk") {
        return "Review the most recent blocker and decide whether a direct follow-up is needed.";
      }
      if (item.band === "steady") {
        return "Check the latest thread activity and confirm the next step is still clear.";
      }
      return "Keep momentum by reviewing the latest activity and preserving the current cadence.";
    }
    return null;
  }

  const atRiskCount = bandCount("at_risk");
  const summaryCards = [
    {
      label: "Conversations analyzed",
      value: summaryLoading ? "..." : summary?.totalThreads ?? "-",
      note: "Threads with health scoring available",
    },
    {
      label: "Average health",
      value:
        summaryLoading
          ? "..."
          : summary?.averageHealthScore != null
          ? `${Math.round(summary.averageHealthScore)} / 100`
          : "-",
      note: "Overall conversation health across reviewed threads",
    },
    {
      label: "Needs follow-up",
      value:
        summaryLoading
          ? "..."
          : summary != null
          ? summary.pendingFollowUps + summary.overdueFollowUps
          : "-",
      note: "Pending and overdue follow-up pressure",
    },
    {
      label: "At-risk conversations",
      value: summaryLoading ? "..." : atRiskCount,
      note: "Threads that deserve the earliest review",
    },
  ];

  const orderedItems = [...dealHealthItems].sort((a, b) => {
    const bandRank = (band: DealHealthItem["band"]) =>
      band === "at_risk" ? 0 : band === "steady" ? 1 : 2;
    const rankDiff = bandRank(a.band) - bandRank(b.band);
    if (rankDiff !== 0) return rankDiff;
    return a.score - b.score;
  });

  const distributionSummary =
    totalHealthCounts() === 0
      ? "Health scoring will appear here after conversation analysis has run."
      : atRiskCount > 0
      ? `${atRiskCount} conversation${atRiskCount === 1 ? "" : "s"} currently need immediate review.`
      : "Most analyzed conversations are currently holding steady or better.";

  if (dealHealthLoading && dealHealthItems.length === 0) {
    return (
      <Layout>
        <main className="page-root">
          <div className="page-header">
            <ModuleBackButton toSuffix="/m03" />
            <div className="page-title-block">
              <h1 className="page-title">Deal Health Board</h1>
              <p className="page-subtitle">
                Review which conversations are healthy, which need attention, and what to look at first.
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
        <div className="page-header">
          <ModuleBackButton toSuffix="/m03" />
          <div className="page-title-block">
            <h1 className="page-title">Deal Health Board</h1>
            <p className="page-subtitle">
              Review which conversations are healthy, which need attention, and what to look at first.
            </p>
          </div>
        </div>

        <section className="page-section">
          {summaryError && (
            <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 6, background: "#FEE2E2", color: "#991B1B", fontSize: 13 }}>
              {summaryError}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {summaryCards.map((card) => (
              <div key={card.label} className="card" style={{ ...pageCardStyle, padding: 16 }}>
                <div className="muted" style={{ fontSize: 12 }}>{card.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, color: "#0F172A" }}>{card.value}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>{card.note}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="page-section">
          <div className="card" style={{ ...pageCardStyle, padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A" }}>Health distribution</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4, marginBottom: 14 }}>
              See how the analyzed conversation pool is currently spread across healthy, stable, and at-risk status.
            </div>

            {!summary || totalHealthCounts() === 0 ? (
              <div className="muted" style={{ fontSize: 13 }}>
                No health scores are available yet. Run analysis on your conversations to populate this view.
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "stretch", height: 18, borderRadius: 999, overflow: "hidden", background: "#E5E7EB", marginBottom: 14 }}>
                  {(["healthy", "steady", "at_risk"] as HealthBand[]).map((b) => {
                    const pct = bandPercentage(b);
                    if (!pct) return null;
                    const color =
                      b === "healthy"
                        ? "#22C55E"
                        : b === "steady" || b === "monitor" || b === "neutral"
                        ? "#F59E0B"
                        : "#EF4444";
                    return <div key={b} style={{ width: `${pct}%`, background: color }} />;
                  })}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                  {(["healthy", "steady", "at_risk"] as HealthBand[]).map((b) => (
                    <div key={b} style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 12, background: "#FFFFFF" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            display: "inline-block",
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            background:
                              b === "healthy"
                                ? "#22C55E"
                                : b === "steady" || b === "monitor" || b === "neutral"
                                ? "#F59E0B"
                                : "#EF4444",
                          }}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{bandLabel(b)}</span>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 8, color: "#0F172A" }}>{bandCount(b)}</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{bandPercentage(b).toFixed(0)}% of scored conversations</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 14, fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{distributionSummary}</div>
              </>
            )}
          </div>
        </section>

        <section className="page-section">
          {dealHealthError && (
            <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 6, background: "#FEF3C7", color: "#92400E", fontSize: 13 }}>
              {dealHealthError}
            </div>
          )}

          <div className="card" style={{ ...pageCardStyle, padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A" }}>Priority conversation review list</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4, marginBottom: 14 }}>
              Start with the conversations most likely to need a manager review or a next-step decision.
            </div>

            {dealHealthLoading ? (
              <div style={{ padding: "20px 0", textAlign: "center" }}>Loading deal health...</div>
            ) : dealHealthError ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: "#991B1B" }}>{dealHealthError}</div>
            ) : orderedItems.length === 0 ? (
              <div style={{ padding: "20px 0" }}>
                <div className="muted" style={{ fontSize: 14, marginBottom: 8 }}>No analyzed conversations yet.</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  Run conversation analysis on a few threads in Module 3 to populate this review board.
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {orderedItems.map((item) => {
                  const displayName = item.dealName || item.accountName || item.subject || item.threadId;
                  const topReasons = item.reasons?.slice(0, 2) || [];
                  const suggestedNextStep = getSuggestedNextStep(item);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleRowClick(item.threadId)}
                      style={{
                        textAlign: "left",
                        border: "1px solid #E5E7EB",
                        borderRadius: 14,
                        background: "#FFFFFF",
                        padding: 16,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                        <div style={{ flex: "1 1 320px" }}>
                          <div style={{ fontSize: 17, fontWeight: 700, color: "#0F172A" }}>{displayName}</div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
                            <span>Channel: {item.channel}</span>
                            <span>Last activity: {formatRelativeActivity(item.lastMessageAt)}</span>
                            <span>Last dated activity: {formatDate(item.lastMessageAt)}</span>
                          </div>
                          {item.leadId && (
                            <button type="button" style={leadProfileActionStyle} onClick={(e) => openLeadProfile(item.leadId as string, e)}>
                              Open Lead Profile
                            </button>
                          )}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <div style={{ padding: "8px 12px", borderRadius: 12, background: "#F8FAFC", border: "1px solid #E5E7EB", minWidth: 96, textAlign: "center" }}>
                            <div className="muted" style={{ fontSize: 11 }}>Health score</div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>{Math.round(item.score)}</div>
                          </div>
                          <span className={bandBadgeClass(item.band)}>{bandLabel(item.band)}</span>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)", gap: 14, marginTop: 14 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Why this status</div>
                          {topReasons.length > 0 ? (
                            <div style={{ display: "grid", gap: 6 }}>
                              {topReasons.map((reason, idx) => (
                                <div key={idx} style={{ fontSize: 13, color: "#334155", lineHeight: 1.6 }}>{reason}</div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{getStatusExplanation(item)}</div>
                          )}
                        </div>

                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Suggested next step</div>
                          <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
                            {suggestedNextStep || "Review the latest thread activity to confirm whether a next step is needed."}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="page-section">
          <div className="card" style={{ ...pageCardStyle, padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A" }}>Watchouts and competitor mentions</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4, marginBottom: 14 }}>
              Keep an eye on competitor mentions that may influence the next conversation review.
            </div>

            {!summary?.topCompetitors || summary.topCompetitors.length === 0 ? (
              <div style={{ border: "1px dashed #CBD5E1", borderRadius: 12, padding: 16, color: "#64748B", fontSize: 13, background: "#F8FAFC" }}>
                No competitor mentions have been detected yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {summary.topCompetitors.map((c) => (
                  <div key={c.name} style={{ border: "1px solid #E5E7EB", borderRadius: 999, padding: "8px 12px", background: "#FFFFFF", fontSize: 13, color: "#334155" }}>
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                    <span className="muted"> � {c.count} mention{c.count === 1 ? "" : "s"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </Layout>
  );
}
