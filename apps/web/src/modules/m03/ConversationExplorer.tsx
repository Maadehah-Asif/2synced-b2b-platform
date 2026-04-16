import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import ModuleBackButton from "../../components/ModuleBackButton";
import { fetchModule3Json } from "./api";

function getWorkspaceId() {
  const hash = window.location.hash || "";
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
  return m ? m[1] : null;
}

type Channel = "email" | "whatsapp" | "call" | "meeting" | "note" | "other";
type HealthBand = "healthy" | "steady" | "at_risk";

interface ThreadShape {
  _id: string;
  subject: string;
  channel: Channel;
  lastMessageAt?: string;
  messageCount?: number;
  leadId?: string;
  dealId?: string;
}

interface HealthShape {
  score?: number;
  band?: HealthBand;
  trend?: "improving" | "worsening" | "flat";
}

interface ConversationListItem {
  thread: ThreadShape;
  latestHealth?: HealthShape | null;
}

interface ConversationListResponse {
  items: ConversationListItem[];
  page: number;
  pageSize: number;
  total: number;
}

export default function ConversationExplorer() {
  const workspaceId = getWorkspaceId();

  // Parse companyId from hash query string
  function getCompanyIdFromHash(): string | null {
    const hash = window.location.hash || "";
    const queryMatch = hash.match(/\?([^#]+)/);
    if (!queryMatch) return null;
    const params = new URLSearchParams(queryMatch[1]);
    return params.get("companyId");
  }

  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(getCompanyIdFromHash());
  const [companyName, setCompanyName] = useState<string | null>(null);

  // Update companyId when hash changes
  useEffect(() => {
    function handleHashChange() {
      const newCompanyId = getCompanyIdFromHash();
      if (newCompanyId !== companyId) {
        setCompanyId(newCompanyId);
      }
    }
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [companyId]);

  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<string>("all");
  const [band, setBand] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  // Load company name when companyId is present
  useEffect(() => {
    async function loadCompanyName() {
      const currentCompanyId = getCompanyIdFromHash();
      if (!currentCompanyId || !workspaceId) {
        setCompanyName(null);
        return;
      }

      try {
        const data = await fetchModule3Json<{ companies: Array<{ id: string; name: string }> }>(
          "/companies",
          { workspaceId }
        );
        if (data.companies) {
          const company = data.companies.find((c: { id: string }) => c.id === currentCompanyId);
          if (company) {
            setCompanyName(company.name);
          } else {
            setCompanyName(null);
          }
        }
      } catch (err) {
        // Silently fail - company name is optional
        setCompanyName(null);
      }
    }

    loadCompanyName();
    
    // Also reload when hash changes
    function handleHashChange() {
      loadCompanyName();
    }
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [workspaceId]);

  // ---------------------------------------------------------------------------
  // Load conversations from backend
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function loadConversations() {
      if (!workspaceId) return;
      
      // Parse companyId from hash
      const currentCompanyId = getCompanyIdFromHash();
      
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
        params.set("workspaceId", workspaceId);
        if (search.trim()) params.set("search", search.trim());
        if (channel !== "all") params.set("channel", channel);
        if (band !== "all") params.set("band", band);
        if (currentCompanyId) params.set("companyId", currentCompanyId);

        const data = await fetchModule3Json<ConversationListResponse>("/conversations", {
          page,
          pageSize,
          workspaceId,
          search: search.trim() || undefined,
          channel: channel !== "all" ? channel : undefined,
          band: band !== "all" ? band : undefined,
          companyId: currentCompanyId || undefined,
        });
        setItems(data.items || []);
        setTotal(data.total || 0);
      } catch (err: any) {
        setError(err?.message || "Unexpected error while loading conversations.");
        setItems([]);
      } finally {
        setLoading(false);
      }
    }

    loadConversations();
  }, [workspaceId, page, pageSize, search, channel, band]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  function formatDate(iso?: string) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  }

  function formatBand(b?: HealthBand) {
    if (!b) return "—";
    if (b === "healthy") return "Healthy";
    if (b === "steady" || (b as string) === "monitor" || (b as string) === "neutral") return "Steady"; // Handle backward compatibility
    if (b === "at_risk") return "At risk";
    return b;
  }

  function bandBadgeClass(b?: HealthBand) {
    if (!b) return "badge-muted";
    if (b === "healthy") return "badge-success";
    if (b === "at_risk") return "badge-danger";
    return "badge-warning";
  }

  function handleRowClick(threadId: string) {
    const wid = workspaceId;
    if (!wid) return;
    // For now, just plan for a future detail page route.
    // Next step we can create ConversationThreadDetail and route /m03/conversations/:id.
    window.location.hash = `#/workspace/${wid}/m03/conversations/${threadId}`;
  }

  function handleClearCompanyFilter() {
    const wid = workspaceId;
    if (!wid) return;
    setCompanyName(null);
    // Update hash to remove companyId query param
    const hash = window.location.hash || "";
    const baseHash = hash.split("?")[0];
    window.location.hash = baseHash;
  }

  return (
    <Layout>
      <main className="page-root">
        {/* Header */}
        <div className="page-header">
          <ModuleBackButton toSuffix="/m03" />
          <div className="page-title-block">
            <h1 className="page-title">Conversation explorer</h1>
            <p className="page-subtitle">
              Browse all normalized threads from your inbox and CRM. Use filters to
              find deals by channel, health, sentiment, and recent activity.
            </p>
          </div>
        </div>

        {/* Filters + table */}
        <section className="page-section">
          {/* Company filter chip */}
          {getCompanyIdFromHash() && companyName && (
            <div
              className="card"
              style={{
                padding: 12,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
                backgroundColor: "#EFF6FF",
                borderColor: "#3B82F6",
              }}
            >
              <span style={{ fontSize: 13, color: "#1E40AF" }}>
                Filtered by company: <strong>{companyName}</strong>
              </span>
              <button
                className="btn-secondary btn-sm"
                onClick={handleClearCompanyFilter}
                style={{ marginLeft: "auto", fontSize: 12 }}
              >
                Clear
              </button>
            </div>
          )}

          {/* Filters bar */}
          <div
            className="card"
            style={{
              padding: 12,
              marginBottom: 12,
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
            }}
          >
            <div style={{ flex: "1 1 200px" }}>
              <label className="muted" style={{ fontSize: 12 }}>
                Search subject / text
              </label>
              <input
                type="text"
                className="input"
                placeholder="Search by subject, lead name, etc."
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
              />
            </div>

            <div style={{ width: 180 }}>
              <label className="muted" style={{ fontSize: 12 }}>
                Channel
              </label>
              <select
                className="input"
                value={channel}
                onChange={(e) => {
                  setPage(1);
                  setChannel(e.target.value);
                }}
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

            <div style={{ width: 180 }}>
              <label className="muted" style={{ fontSize: 12 }}>
                Deal health
              </label>
              <select
                className="input"
                value={band}
                onChange={(e) => {
                  setPage(1);
                  setBand(e.target.value);
                }}
              >
                <option value="all">All bands</option>
                <option value="healthy">Healthy</option>
                <option value="steady">Steady</option>
                <option value="at_risk">At risk</option>
              </select>
            </div>
          </div>

          {/* Error / status */}
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

          {/* Table */}
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
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
                  <th style={{ padding: "8px 12px", minWidth: 220 }}>Subject</th>
                  <th style={{ padding: "8px 12px", minWidth: 80 }}>Channel</th>
                  <th style={{ padding: "8px 12px", minWidth: 110 }}>
                    Last message
                  </th>
                  <th style={{ padding: "8px 12px", minWidth: 80 }}>
                    Msg count
                  </th>
                  <th style={{ padding: "8px 12px", minWidth: 120 }}>
                    Health band
                  </th>
                  <th style={{ padding: "8px 12px", minWidth: 90 }}>
                    Health score
                  </th>
                  <th style={{ padding: "8px 12px", minWidth: 90 }}>Trend</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{ padding: "12px", textAlign: "center" }}
                    >
                      Loading conversations…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{ padding: "12px", textAlign: "center" }}
                    >
                      No conversations found. Try changing filters or importing
                      threads first.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const t = item.thread || ({} as ThreadShape);
                    const h = item.latestHealth || undefined;
                    return (
                      <tr
                        key={t._id}
                        style={{
                          cursor: "pointer",
                          borderTop: "1px solid #E5E7EB",
                        }}
                        onClick={() => handleRowClick(t._id)}
                      >
                        <td style={{ padding: "8px 12px" }}>
                          <div style={{ fontWeight: 500 }}>{t.subject}</div>
                          <div
                            className="muted"
                            style={{ fontSize: 11, marginTop: 2 }}
                          >
                            {t.dealId
                              ? `Deal: ${t.dealId}`
                              : t.leadId
                              ? `Lead: ${t.leadId}`
                              : "Unlinked"}
                          </div>
                        </td>
                        <td style={{ padding: "8px 12px", textTransform: "capitalize" }}>
                          {t.channel || "—"}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          {formatDate(t.lastMessageAt)}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          {t.messageCount ?? "—"}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <span className={bandBadgeClass(h?.band)}>
                            {formatBand(h?.band)}
                          </span>
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          {typeof h?.score === "number"
                            ? Math.round(h.score)
                            : "—"}
                        </td>
                        <td style={{ padding: "8px 12px", textTransform: "capitalize" }}>
                          {h?.trend || "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 12,
              fontSize: 12,
            }}
          >
            <div className="muted">
              Showing page {page} of {totalPages} · {total} conversations
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                className="btn-secondary btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
