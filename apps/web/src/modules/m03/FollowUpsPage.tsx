/**
 * Module: Conversation Intelligence (m03)
 * Layer: Frontend
 * File: FollowUpsPage.tsx
 * Purpose: Supports the F ol lo wU ps Pa ge flow for this module.
 * Notes: Documentation header added for maintainability.
 */

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

interface FollowUpShape {
  _id: string;
  threadId: string;
  status: "pending" | "snoozed" | "done" | "cancelled";
  dueAt?: string;
  snoozedUntil?: string;
  reason?: string;
  createdAt?: string;
}

interface ThreadShape {
  _id: string;
  subject: string;
  channel: string;
  lastMessageAt?: string;
}

interface HealthShape {
  score?: number;
  band?: HealthBand;
  trend?: "improving" | "worsening" | "flat";
}

interface FollowUpListItem {
  followUp: FollowUpShape;
  thread?: ThreadShape | null;
  latestHealth?: HealthShape | null;
}

interface FollowUpListResponse {
  items: FollowUpListItem[];
  total: number;
}

export default function FollowUpsPage() {
  const workspaceId = getWorkspaceId();

  const [items, setItems] = useState<FollowUpListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("pending_or_overdue");
  const [search, setSearch] = useState("");
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  const [total, setTotal] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch follow-ups
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function loadFollowUps() {
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
        params.set("status", statusFilter); // backend can interpret this
        params.set("workspaceId", workspaceId);
        if (search.trim()) params.set("search", search.trim());
        if (onlyOverdue) params.set("overdue", "true");

        // NOTE: endpoint name assumes /m03/followups on backend
        const res = await fetch(
          `${API_URL}/m03/followups?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const json: FollowUpListResponse | any = await res.json();
        if (!res.ok) {
          setError(json?.error || "Failed to load follow-ups.");
          setItems([]);
        } else {
          setItems(json.items || []);
          setTotal(json.total || (json.items ? json.items.length : 0));
        }
      } catch (err: any) {
        setError(err?.message || "Unexpected error while loading follow-ups.");
        setItems([]);
      } finally {
        setLoading(false);
      }
    }

    loadFollowUps();
  }, [workspaceId, statusFilter, search, onlyOverdue]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function formatDate(iso?: string) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  }

  function bandBadgeClass(band?: HealthBand) {
    if (!band) return "badge-muted";
    if (band === "healthy") return "badge-success";
    if (band === "at_risk") return "badge-danger";
    return "badge-warning";
  }

  function statusBadgeClass(status: FollowUpShape["status"]) {
    if (status === "done") return "badge-success";
    if (status === "pending") return "badge-warning";
    if (status === "snoozed") return "badge-muted";
    if (status === "cancelled") return "badge-muted";
    return "badge-muted";
  }

  function handleOpenThread(threadId: string) {
    const wid = workspaceId;
    if (!wid) return;
    window.location.hash = `#/workspace/${wid}/m03/conversations/${threadId}`;
  }

  // ---------------------------------------------------------------------------
  // Actions: mark done / snooze (optional but nice)
  // ---------------------------------------------------------------------------
  async function updateFollowUp(
    followUpId: string,
    action: "done" | "snooze_2d"
  ) {
    setUpdatingId(followUpId);
    setActionError(null);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setActionError("You are not logged in.");
        setUpdatingId(null);
        return;
      }

      let endpoint = "";
      let body: any = undefined;

      if (action === "done") {
        endpoint = `${API_URL}/m03/followups/${followUpId}/mark-done`;
      } else {
        endpoint = `${API_URL}/m03/followups/${followUpId}/snooze`;
        const now = new Date();
        const snoozeDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
        body = { snoozedUntil: snoozeDate.toISOString() };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const json = await res.json();
      if (!res.ok) {
        setActionError(json?.error || "Failed to update follow-up.");
      } else {
        // refresh list
        const params = new URLSearchParams();
        params.set("status", statusFilter ?? "");
        params.set("workspaceId", workspaceId ?? "");
        if (search?.trim()) params.set("search", search.trim());
        if (onlyOverdue) params.set("overdue", "true");

        const res2 = await fetch(
          `${API_URL}/m03/followups?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const json2: FollowUpListResponse | any = await res2.json();
        if (res2.ok) {
          setItems(json2.items || []);
          setTotal(json2.total || (json2.items ? json2.items.length : 0));
        }
      }
    } catch (err: any) {
      setActionError(
        err?.message || "Unexpected error while updating follow-up."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <Layout>
      <main className="page-root">
        {/* Header */}
        <div className="page-header">
          <ModuleBackButton toSuffix="/m03" />
          <div className="page-title-block">
            <h1 className="page-title">Follow-up queue & alerts</h1>
            <p className="page-subtitle">
              See all pending and overdue follow-ups generated from conversation
              analysis so no opportunity goes cold.
            </p>
          </div>
        </div>

        {/* Filters */}
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
          {actionError && (
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
              {actionError}
            </div>
          )}

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
                Search by subject / reason
              </label>
              <input
                type="text"
                className="input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="e.g. pricing follow-up, ACME, renewal"
              />
            </div>

            <div style={{ width: 200 }}>
              <label className="muted" style={{ fontSize: 12 }}>
                Status
              </label>
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="pending_or_overdue">Pending & overdue</option>
                <option value="pending">Only pending</option>
                <option value="overdue">Only overdue</option>
                <option value="snoozed">Snoozed</option>
                <option value="done">Completed</option>
                <option value="all">All statuses</option>
              </select>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
              }}
            >
              <input
                type="checkbox"
                checked={onlyOverdue}
                onChange={(e) => setOnlyOverdue(e.target.checked)}
              />
              <span className="muted">
                Show only overdue (ignore future due dates)
              </span>
            </label>

            <div className="muted" style={{ marginLeft: "auto", fontSize: 12 }}>
              Total: {total}
            </div>
          </div>
        </section>

        {/* Table */}
        <section className="page-section">
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
                  <th style={{ padding: "8px 12px", minWidth: 220 }}>Thread</th>
                  <th style={{ padding: "8px 12px", minWidth: 90 }}>Status</th>
                  <th style={{ padding: "8px 12px", minWidth: 140 }}>
                    Due date
                  </th>
                  <th style={{ padding: "8px 12px", minWidth: 90 }}>
                    Health score
                  </th>
                  <th style={{ padding: "8px 12px", minWidth: 90 }}>
                    Health band
                  </th>
                  <th style={{ padding: "8px 12px", minWidth: 140 }}>
                    Last message
                  </th>
                  <th style={{ padding: "8px 12px", minWidth: 180 }}>
                    Suggested reason
                  </th>
                  <th style={{ padding: "8px 12px", minWidth: 140 }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{ padding: "10px 12px", textAlign: "center" }}
                    >
                      Loading follow-ups…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{ padding: "10px 12px", textAlign: "center" }}
                    >
                      No follow-ups to show. Run conversation analysis or adjust
                      filters.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const f = item.followUp;
                    const t = item.thread;
                    const h = item.latestHealth || undefined;

                    return (
                      <tr
                        key={f._id}
                        style={{
                          borderTop: "1px solid #E5E7EB",
                        }}
                      >
                        <td style={{ padding: "8px 12px" }}>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 2,
                            }}
                          >
                            <button
                              type="button"
                              className="link-button"
                              style={{
                                textAlign: "left",
                                fontWeight: 500,
                                padding: 0,
                              }}
                              onClick={() =>
                                t?._id && handleOpenThread(t._id)
                              }
                            >
                              {t?.subject || "(No subject)"}
                            </button>
                            <span
                              className="muted"
                              style={{ fontSize: 11, textTransform: "capitalize" }}
                            >
                              {t?.channel || "unknown channel"}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <span
                            className={statusBadgeClass(f.status)}
                            style={{ fontSize: 11, textTransform: "capitalize" }}
                          >
                            {f.status}
                          </span>
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          {f.dueAt ? formatDate(f.dueAt) : "—"}
                          {f.snoozedUntil && (
                            <div className="muted" style={{ fontSize: 11 }}>
                              Snoozed until {formatDate(f.snoozedUntil)}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          {typeof h?.score === "number"
                            ? Math.round(h.score)
                            : "—"}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <span className={bandBadgeClass(h?.band)} style={{ fontSize: 11 }}>
                            {h?.band || "—"}
                          </span>
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          {t?.lastMessageAt
                            ? formatDate(t.lastMessageAt)
                            : "—"}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          {f.reason || "—"}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                            }}
                          >
                            <button
                              type="button"
                              className="btn-primary btn-xs"
                              disabled={
                                updatingId === f._id || f.status === "done"
                              }
                              onClick={() => updateFollowUp(f._id, "done")}
                            >
                              {updatingId === f._id &&
                              f.status !== "done"
                                ? "Updating…"
                                : "Mark done"}
                            </button>
                            <button
                              type="button"
                              className="btn-secondary btn-xs"
                              disabled={updatingId === f._id}
                              onClick={() => updateFollowUp(f._id, "snooze_2d")}
                            >
                              Snooze 2 days
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </Layout>
  );
}
