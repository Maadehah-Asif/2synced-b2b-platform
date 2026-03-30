/**
 * Module 3 Conversation Thread Detail / Analysis View
 * 
 * This component renders the per-thread analysis page with:
 * - Message timeline on the left (sticky on desktop)
 * - Deal health, recommended follow-up, and extracted entities on the right
 * - Inline entity highlighting in message text
 * 
 * Files modified:
 * - apps/web/src/modules/m03/ConversationThreadDetail.tsx (this file)
 * - apps/web/src/modules/m03/m03-analysis.css (styling)
 * 
 * Key functions:
 * - highlightEntitiesInMessage(): Located at lines ~248-331
 *   - Highlights entity values/snippets in message text with colored spans
 *   - Uses sourceSnippet if available, otherwise falls back to value
 *   - To extend for new entity types:
 *     1. Add CSS class in m03-analysis.css: .entity-highlight-{newtype}
 *     2. Update getHighlightClassForEntity() switch statement (lines ~233-246)
 *     3. The function will automatically use the new class pattern
 */

import { useEffect, useState, type ReactNode } from "react";
import Layout from "../../components/Layout";
import ModuleBackButton from "../../components/ModuleBackButton";
import "./m03-analysis.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function parseWorkspaceAndThread() {
  const hash = window.location.hash || "";
  // #/workspace/<wid>/m03/conversations/<threadId>
  const m = hash.match(
    /#\/workspace\/(.+?)\/m03\/conversations\/([^/]+)/
  );
  if (!m) return { workspaceId: null as string | null, threadId: null as string | null };
  return { workspaceId: m[1], threadId: m[2] };
}

type Channel = "email" | "whatsapp" | "call" | "meeting" | "note" | "other";
type Direction = "inbound" | "outbound";
type HealthBand = "healthy" | "neutral" | "at_risk";

interface ThreadShape {
  _id: string;
  subject: string;
  channel: Channel;
  messageCount?: number;
  firstMessageAt?: string;
  lastMessageAt?: string;
}

interface MessageShape {
  _id: string;
  direction: Direction;
  senderName?: string;
  senderEmail?: string;
  bodyText?: string;
  sentAt?: string;
}

interface EntityShape {
  _id: string;
  type: string; // budget | decision_maker | timeline | competitor | other
  value: string;
  confidence?: number;
  sourceMessageId?: string;
  sourceSnippet?: string; // Optional snippet from the message text
}

interface SentimentShape {
  _id: string;
  messageId?: string;
  label?: string; // positive | neutral | negative
  score?: number; // numeric score
}

interface HealthShape {
  _id: string;
  score?: number;
  band?: HealthBand;
  trend?: "improving" | "worsening" | "flat";
  signals?: Record<string, any>;
  lastComputedAt?: string;
}

interface FollowUpShape {
  _id: string;
  status: "pending" | "snoozed" | "done" | "cancelled";
  dueAt?: string;
  snoozedUntil?: string;
  reason?: string;
  createdAt?: string;
}

interface FollowUpIntentShape {
  label: string;
  confidence: number;
  suggestedMessage: string;
}

interface ConversationDetailResponse {
  thread: ThreadShape;
  messages: MessageShape[];
  entities: EntityShape[];
  sentiments: SentimentShape[];
  latestHealth?: HealthShape | null;
  followUps?: FollowUpShape[];
  followUpIntent?: FollowUpIntentShape | null;
}

export default function ConversationThreadDetail() {
  const { workspaceId, threadId } = parseWorkspaceAndThread();

  const [data, setData] = useState<ConversationDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch conversation detail
  // ---------------------------------------------------------------------------
  async function loadDetail() {
    if (!workspaceId || !threadId) {
      setError("Invalid URL: workspace or thread id is missing.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("You are not logged in.");
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_URL}/m03/conversations/${threadId}?workspaceId=${encodeURIComponent(workspaceId)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = (await res.json()) as ConversationDetailResponse | any;
      if (!res.ok) {
        setError(json?.error || "Failed to load conversation.");
        setData(null);
      } else {
        setData(json as ConversationDetailResponse);
      }
    } catch (err: any) {
      setError(err?.message || "Unexpected error while loading conversation.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, threadId]);

  // ---------------------------------------------------------------------------
  // Run full analysis (entities + sentiment + health + follow-ups)
  // ---------------------------------------------------------------------------
  async function handleRunAnalysis() {
    if (!threadId) return;
    setAnalysisMessage(null);
    setAnalysisRunning(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("You are not logged in.");
        setAnalysisRunning(false);
        return;
      }

      const res = await fetch(
        `${API_URL}/m03/conversations/${encodeURIComponent(String(threadId))}/analyze?workspaceId=${encodeURIComponent(String(workspaceId))}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Failed to run analysis.");
      } else {
        setAnalysisMessage("Analysis completed. Refreshed health and follow-ups.");
        // Reload detail to reflect latest health / follow-ups / entities / sentiments
        await loadDetail();
      }
    } catch (err: any) {
      setError(err?.message || "Unexpected error while running analysis.");
    } finally {
      setAnalysisRunning(false);
    }
  }

  function formatDate(iso?: string) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  }

  function sentimentBadgeClass(label?: string) {
    if (label === "positive") return "badge-success";
    if (label === "negative") return "badge-danger";
    if (label === "neutral") return "badge-muted";
    return "badge-muted";
  }

  function getSentimentForMessage(mid: string): SentimentShape | undefined {
    if (!data?.sentiments) return undefined;
    return data.sentiments.find((s) => s.messageId === mid);
  }

  function getEntitiesForMessage(messageId: string): EntityShape[] {
    if (!data?.entities) return [];
    return data.entities.filter((e) => e.sourceMessageId === messageId);
  }

  function groupEntities() {
    const groups: Record<string, EntityShape[]> = {};
    if (!data?.entities) return groups;
    for (const e of data.entities) {
      const key = e.type || "other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }
    return groups;
  }

  /**
   * Highlights entity values in message text with colored spans.
   * Uses sourceSnippet if available, otherwise falls back to value.
   * Processes entities from longest to shortest to avoid nested matches.
   * 
   * Location: ConversationThreadDetail.tsx (lines ~220-290)
   * 
   * To extend for new entity types:
   * 1. Add CSS class in m03-analysis.css: .entity-highlight-{newtype}
   * 2. Update getHighlightClassForEntity() switch statement
   * 3. The function will automatically use the new class pattern
   */
  function getHighlightClassForEntity(type: string): string {
    switch (type) {
      case "budget":
        return "entity-highlight-budget";
      case "decision_maker":
        return "entity-highlight-decision";
      case "timeline":
        return "entity-highlight-timeline";
      case "competitor":
        return "entity-highlight-competitor";
      default:
        return "";
    }
  }

  function highlightEntitiesInMessage(
    text: string,
    entitiesForMessage: EntityShape[]
  ): ReactNode {
    if (!text || !entitiesForMessage.length) {
      return text;
    }

    // Use sourceSnippet if present, otherwise fall back to value
    const patterns = entitiesForMessage
      .map((e) => {
        const snippet = (e.sourceSnippet || e.value || "").trim();
        if (!snippet) return null;
        return { ...e, snippet };
      })
      .filter((e): e is EntityShape & { snippet: string } => !!e);

    if (!patterns.length) return text;

    // Sort by snippet length descending to reduce nested overlaps
    patterns.sort((a, b) => b.snippet.length - a.snippet.length);

    // We will build segments from left to right
    const usedRanges: Array<{ start: number; end: number }> = [];
    const segments: ReactNode[] = [];
    let cursor = 0;

    const lower = text.toLowerCase();

    const matches: Array<{
      start: number;
      end: number;
      entity: EntityShape & { snippet: string };
    }> = [];

    for (const entity of patterns) {
      const needle = entity.snippet.toLowerCase();
      if (!needle) continue;

      let index = lower.indexOf(needle);
      while (index !== -1) {
        const start = index;
        const end = index + entity.snippet.length;

        // Check for overlap with existing ranges
        const overlaps = usedRanges.some(
          (r) => !(end <= r.start || start >= r.end)
        );
        if (!overlaps) {
          matches.push({ start, end, entity });
          usedRanges.push({ start, end });
        }

        index = lower.indexOf(needle, end);
      }
    }

    if (!matches.length) return text;

    // Sort matches by start position
    matches.sort((a, b) => a.start - b.start);

    for (const match of matches) {
      if (match.start > cursor) {
        segments.push(text.slice(cursor, match.start));
      }
      const highlightClass = getHighlightClassForEntity(match.entity.type);
      const originalText = text.slice(match.start, match.end);

      segments.push(
        <span key={`${match.entity._id}-${match.start}`} className={highlightClass}>
          {originalText}
        </span>
      );

      cursor = match.end;
    }

    if (cursor < text.length) {
      segments.push(text.slice(cursor));
    }

    return segments;
  }

  function getEntityDotClass(type: string): string {
    if (type === "budget") return "entity-dot entity-budget";
    if (type === "decision_maker") return "entity-dot entity-decision";
    if (type === "timeline") return "entity-dot entity-timeline";
    if (type === "competitor") return "entity-dot entity-competitor";
    return "entity-dot entity-budget"; // fallback
  }

  function formatIntentLabel(intent: string): string {
    const labelMap: Record<string, string> = {
      ask_for_meeting: "Ask for meeting",
      check_in_gentle: "Check in",
      confirm_decision_maker: "Confirm decision maker",
      send_pricing_clarification: "Send pricing clarification",
      nurture_later: "Nurture later",
      revive_ghosted: "Revive ghosted",
    };
    return labelMap[intent] || intent.replace(/_/g, " ");
  }

  const groupedEntities = groupEntities();
  const thread = data?.thread;
  const messages = (data?.messages || []).slice().sort((a, b) => {
    const da = a.sentAt ? new Date(a.sentAt).getTime() : 0;
    const db = b.sentAt ? new Date(b.sentAt).getTime() : 0;
    return da - db;
  });
  const health = data?.latestHealth || undefined;
  const followUps = data?.followUps || [];

  return (
    <Layout>
      <main className="page-root">
        {/* Header */}
        <div className="page-header">
          <ModuleBackButton toSuffix="/m03" />
          <div className="page-title-block">
            <h1 className="page-title">
              {thread ? thread.subject : "Conversation detail"}
            </h1>
            <p className="page-subtitle">
              View the full message timeline, extracted entities, sentiment, and deal
              health for this thread.
            </p>
          </div>
          <div>
            <button
              className="btn-run-analysis"
              onClick={handleRunAnalysis}
              disabled={analysisRunning || !threadId}
            >
              {analysisRunning ? "Running analysis…" : "Run analysis"}
            </button>
          </div>
        </div>

        {/* Status */}
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
          {analysisMessage && (
            <div
              style={{
                marginBottom: 12,
                padding: "8px 12px",
                borderRadius: 6,
                background: "#ECFDF3",
                color: "#166534",
                fontSize: 13,
              }}
            >
              {analysisMessage}
            </div>
          )}
        </section>

        {/* Main layout: left timeline / right insights */}
        <section className="page-section m03-analysis-layout">
          {/* Left: message timeline */}
          <div className="m03-thread-column">
            <div className="card" style={{ padding: 16 }}>
            <div style={{ marginBottom: 8 }}>
              <div className="muted" style={{ fontSize: 12 }}>
                Message timeline · {messages.length} messages
              </div>
              {thread && (
                <div className="muted" style={{ fontSize: 11 }}>
                  First: {formatDate(thread.firstMessageAt)} · Last:{" "}
                  {formatDate(thread.lastMessageAt)}
                </div>
              )}
            </div>

            {loading && (
              <div className="muted" style={{ fontSize: 13 }}>
                Loading messages…
              </div>
            )}

            {!loading && messages.length === 0 && (
              <div className="muted" style={{ fontSize: 13 }}>
                No messages found for this thread.
              </div>
            )}

            {!loading &&
              messages.map((m) => {
                const s = getSentimentForMessage(m._id);
                return (
                  <div
                    key={m._id}
                    style={{
                      borderLeft:
                        m.direction === "outbound"
                          ? "3px solid #2563EB"
                          : "3px solid #10B981",
                      paddingLeft: 10,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                      }}
                    >
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span
                          className="badge-muted"
                          style={{ fontSize: 11, textTransform: "capitalize" }}
                        >
                          {m.direction === "outbound" ? "From us" : "From prospect"}
                        </span>
                        {s && (
                          <span
                            className={sentimentBadgeClass(s.label)}
                            style={{ fontSize: 11, textTransform: "capitalize" }}
                          >
                            {s.label || "sentiment"}{" "}
                            {typeof s.score === "number"
                              ? `(${s.score.toFixed(2)})`
                              : ""}
                          </span>
                        )}
                      </div>
                      <div className="muted" style={{ fontSize: 11 }}>
                        {formatDate(m.sentAt)}
                      </div>
                    </div>
                    <div
                      className="muted"
                      style={{ fontSize: 11, marginTop: 2 }}
                    >
                      {m.senderName || "Unknown sender"}
                      {m.senderEmail ? ` · ${m.senderEmail}` : ""}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        marginTop: 6,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {highlightEntitiesInMessage(
                        m.bodyText || "—",
                        getEntitiesForMessage(m._id)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: health, entities, follow-ups */}
          <div className="m03-insights-column" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Deal health */}
            <section className="m03-card deal-health-card">
              <header className="m03-card-header">
                <div className="m03-card-title">Deal health score</div>
              </header>
              <div className="deal-health-main">
                <div className="deal-health-score">
                  {health?.score != null ? Math.round(health.score) : "—"}
                </div>
                {health?.band && (
                  <span
                    className={`deal-health-band deal-health-band--${health.band.replace("_", "-")}`}
                  >
                    {health.band === "at_risk" ? "At risk" : health.band.charAt(0).toUpperCase() + health.band.slice(1)}
                  </span>
                )}
              </div>
              {health?.signals && (
                <div className="deal-health-signals">
                  <div className="signals-label">Signals</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {(() => {
                      const signalEntries = Object.entries(health.signals);
                      const formattedSignals: Array<{ label: string; value: string }> = [];

                      // Format budget
                      if (signalEntries.some(([k]) => k.toLowerCase().includes("budget"))) {
                        const budgetEntry = signalEntries.find(([k]) =>
                          k.toLowerCase().includes("budget")
                        );
                        if (budgetEntry) {
                          const value = budgetEntry[1];
                          formattedSignals.push({
                            label: "Budget",
                            value:
                              typeof value === "boolean"
                                ? value
                                  ? "Confirmed"
                                  : "Not confirmed"
                                : String(value),
                          });
                        }
                      }

                      // Format decision maker
                      if (
                        signalEntries.some(([k]) =>
                          k.toLowerCase().includes("decision") || k.toLowerCase().includes("dm")
                        )
                      ) {
                        const dmEntry = signalEntries.find(
                          ([k]) =>
                            k.toLowerCase().includes("decision") || k.toLowerCase().includes("dm")
                        );
                        if (dmEntry) {
                          const value = dmEntry[1];
                          formattedSignals.push({
                            label: "Decision maker",
                            value:
                              typeof value === "boolean"
                                ? value
                                  ? "Identified"
                                  : "Not identified"
                                : String(value),
                          });
                        }
                      }

                      // Format timeline
                      if (signalEntries.some(([k]) => k.toLowerCase().includes("timeline"))) {
                        const timelineEntry = signalEntries.find(([k]) =>
                          k.toLowerCase().includes("timeline")
                        );
                        if (timelineEntry) {
                          formattedSignals.push({
                            label: "Timeline",
                            value: String(timelineEntry[1]),
                          });
                        }
                      }

                      // Format competitors
                      if (
                        signalEntries.some(([k]) =>
                          k.toLowerCase().includes("competitor")
                        )
                      ) {
                        const competitorEntry = signalEntries.find(([k]) =>
                          k.toLowerCase().includes("competitor")
                        );
                        if (competitorEntry) {
                          formattedSignals.push({
                            label: "Competitors",
                            value: String(competitorEntry[1]),
                          });
                        }
                      }

                      // Add any other signals not covered above
                      signalEntries.forEach(([k, v]) => {
                        const keyLower = k.toLowerCase();
                        if (
                          !keyLower.includes("budget") &&
                          !keyLower.includes("decision") &&
                          !keyLower.includes("dm") &&
                          !keyLower.includes("timeline") &&
                          !keyLower.includes("competitor")
                        ) {
                          formattedSignals.push({
                            label: k.charAt(0).toUpperCase() + k.slice(1),
                            value:
                              typeof v === "boolean" ? (v ? "Yes" : "No") : String(v),
                          });
                        }
                      });

                      return formattedSignals.map((signal, idx) => (
                        <div key={idx} className="signal-item">
                          <span className="signal-label">{signal.label}:</span>
                          <span className="signal-value">{signal.value}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </section>

            {/* Recommended follow-up */}
            {(followUps.length > 0 || data?.followUpIntent) && (
              <section className="m03-card follow-up-card">
                <header className="m03-card-header">
                  <div className="m03-card-title">Recommended follow-up</div>
                </header>
                <div className="follow-up-subtitle">
                  Contact lead with updates on the next course of action.
                </div>
                {followUps.length > 0 && followUps[0] && followUps[0].dueAt && (
                  <div className="follow-up-window">
                    <div className="follow-up-window-label">Recommended time window</div>
                    <div className="follow-up-window-value">
                      {(() => {
                        const dueDate = new Date(followUps[0].dueAt!);
                        const now = new Date();
                        const daysDiff = Math.ceil(
                          (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                        );
                        if (daysDiff > 0) {
                          return `Next ${daysDiff} ${daysDiff === 1 ? "day" : "days"}`;
                        }
                        return "Due soon";
                      })()}
                    </div>
                  </div>
                )}
                
                {/* AI-suggested follow-up message */}
                {data?.followUpIntent && (
                  <div className="follow-up-ai-section">
                    <div className="follow-up-ai-header">
                      <div className="follow-up-ai-title">AI-suggested follow-up message</div>
                      <div className="follow-up-ai-subtext">
                        Based on conversation tone, BANT signals and recency
                      </div>
                    </div>
                    <div className="follow-up-ai-message-box">
                      <div className="follow-up-ai-badge">
                        <span className="follow-up-ai-label">
                          {formatIntentLabel(data.followUpIntent.label)}
                        </span>
                        <span className="follow-up-ai-confidence">
                          {(data.followUpIntent.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="follow-up-ai-message-text">
                        {data.followUpIntent.suggestedMessage.split("\n").map((line, idx) => (
                          <div key={idx}>
                            {line || <br />}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {followUps.length > 0 && (
                  <a href="#" className="follow-up-calendar-link">
                    Add reminder to Google Calendar
                  </a>
                )}
              </section>
            )}

            {/* Entities */}
            <section className="m03-card">
              <header className="m03-card-header">
                <div className="m03-card-title">Extracted entities</div>
              </header>
              {(!data || !data.entities || data.entities.length === 0) && (
                <div className="muted" style={{ fontSize: 13 }}>
                  No entities extracted yet. Run analysis to detect budget, decision
                  maker, timelines, and competitors.
                </div>
              )}

              {data?.entities && data.entities.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {["budget", "decision_maker", "timeline", "competitor", "other"].map(
                    (typeKey) => {
                      const list = groupedEntities[typeKey] || [];
                      if (list.length === 0) return null;

                      const labelMap: Record<string, string> = {
                        budget: "Budget",
                        decision_maker: "Decision maker",
                        timeline: "Timeline",
                        competitor: "Competitors",
                        other: "Other",
                      };

                      return (
                        <div key={typeKey} className="entity-section">
                          <div className="entity-heading">
                            <span className={getEntityDotClass(typeKey)} />
                            <span>{labelMap[typeKey] || typeKey}</span>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {list.map((e) => (
                              <span
                                key={e._id}
                                className="badge-muted"
                                style={{
                                  fontSize: 11,
                                  borderRadius: 999,
                                  padding: "2px 8px",
                                }}
                              >
                                {e.value}
                                {typeof e.confidence === "number"
                                  ? ` · ${(e.confidence * 100).toFixed(0)}%`
                                  : ""}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </section>

          </div>
        </section>
      </main>
    </Layout>
  );
}
