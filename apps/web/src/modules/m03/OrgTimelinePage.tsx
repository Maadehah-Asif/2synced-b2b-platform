import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import ModuleBackButton from "../../components/ModuleBackButton";
import "./org-timeline.css";
import { fetchModule3Json } from "./api";

function getWorkspaceId() {
  const hash = window.location.hash || "";
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
  return m ? m[1] : null;
}

interface OrgItem {
  id: string;
  name: string;
}

interface TimelineEvent {
  date: string;
  channel: string;
  direction: string;
  threadId: string;
  threadSubject: string;
  snippet: string;
}

interface OrgTimelineResponse {
  orgId: string;
  companyName: string;
  days: number;
  events: TimelineEvent[];
}

export default function OrgTimelinePage() {
  const workspaceId = getWorkspaceId();

  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [timeline, setTimeline] = useState<OrgTimelineResponse | null>(null);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load organisations on mount
  useEffect(() => {
    if (!workspaceId) {
      setError("Workspace id missing in URL.");
      return;
    }
    const activeWorkspaceId = workspaceId;

    async function loadOrgs() {
      setLoadingOrgs(true);
      setError(null);

      try {
        const data = await fetchModule3Json<{ orgs: OrgItem[] }>("/orgs", {
          workspaceId: activeWorkspaceId,
        });
        setOrgs(data.orgs || []);
      } catch (err: any) {
        setError(err?.message || "Unexpected error while loading organisations.");
      } finally {
        setLoadingOrgs(false);
      }
    }

    loadOrgs();
  }, [workspaceId]);

  // Load timeline when org is selected
  useEffect(() => {
    if (!workspaceId || !selectedOrgId) {
      setTimeline(null);
      return;
    }
    const activeWorkspaceId = workspaceId;
    const activeOrgId = selectedOrgId;

    async function loadTimeline() {
      setLoadingTimeline(true);
      setError(null);

      try {
        const data = await fetchModule3Json<OrgTimelineResponse>(
          `/orgs/${encodeURIComponent(activeOrgId)}/timeline`,
          {
            days: 90,
            workspaceId: activeWorkspaceId,
          }
        );
        setTimeline(data);
      } catch (err: any) {
        setError(err?.message || "Unexpected error while loading timeline.");
        setTimeline(null);
      } finally {
        setLoadingTimeline(false);
      }
    }

    loadTimeline();
  }, [workspaceId, selectedOrgId]);

  // Group events by day
  function groupEventsByDay(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
    const grouped = new Map<string, TimelineEvent[]>();

    for (const event of events) {
      const date = new Date(event.date);
      const dayKey = date.toISOString().split("T")[0]; // YYYY-MM-DD

      if (!grouped.has(dayKey)) {
        grouped.set(dayKey, []);
      }
      grouped.get(dayKey)!.push(event);
    }

    return grouped;
  }

  // Format date for display
  function formatDayLabel(dateStr: string): string {
    const date = new Date(dateStr);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }

  // Get dot class based on channel and direction
  function getDotClass(channel: string, direction: string): string {
    const base = "timeline-dot";
    if (channel === "email") {
      return direction === "inbound" ? `${base} timeline-dot-email-inbound` : `${base} timeline-dot-email-outbound`;
    }
    if (channel === "meeting") {
      return `${base} timeline-dot-meeting`;
    }
    if (channel === "whatsapp") {
      return `${base} timeline-dot-whatsapp`;
    }
    return `${base} timeline-dot-other`;
  }

  const eventsByDay = timeline ? groupEventsByDay(timeline.events) : new Map();
  const sortedDays = Array.from(eventsByDay.keys()).sort();

  return (
    <Layout>
      <main className="page-root">
        {/* Header */}
        <div className="page-header">
          <ModuleBackButton toSuffix="/m03" />
          <div className="page-title-block">
            <h1 className="page-title">Organisation conversation timeline</h1>
            <p className="page-subtitle">
              Select a company to see a timeline of all conversations (emails, messages, meeting notes) over the last 90 days.
            </p>
          </div>
        </div>

        {/* Content */}
        <section className="page-section" style={{ maxWidth: 1200 }}>
          {/* Error banner */}
          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: "12px 16px",
                borderRadius: 6,
                background: "#FEE2E2",
                color: "#991B1B",
                fontSize: 13,
                border: "1px solid #FCA5A5",
              }}
            >
              {error}
            </div>
          )}

          {/* Company dropdown */}
          <div className="card" style={{ padding: 16, marginBottom: 24 }}>
            <label className="muted" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
              Company
            </label>
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="input"
              disabled={loadingOrgs || orgs.length === 0}
            >
              <option value="">{loadingOrgs ? "Loading companies..." : orgs.length === 0 ? "No companies found" : "Select a company"}</option>
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          {/* Timeline */}
          {selectedOrgId && (
            <div className="card" style={{ padding: 16 }}>
              {loadingTimeline ? (
                <div className="muted" style={{ fontSize: 13, textAlign: "center", padding: 24 }}>
                  Loading timeline...
                </div>
              ) : timeline && timeline.events.length > 0 ? (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Showing {timeline.events.length} events for <strong>{timeline.companyName}</strong> over the last {timeline.days} days
                    </div>
                  </div>
                  <div className="org-timeline-container">
                    <div className="timeline-row">
                      {sortedDays.map((dayKey) => {
                        const dayEvents = eventsByDay.get(dayKey) || [];
                        return (
                          <div key={dayKey} className="timeline-day">
                            <div className="timeline-day-label">{formatDayLabel(dayKey)}</div>
                            <div className="timeline-day-events">
                              {dayEvents.map((event: TimelineEvent, idx: number) => (
                                <div
                                  key={`${event.threadId}-${idx}`}
                                  className={getDotClass(event.channel, event.direction)}
                                  title={`${event.threadSubject}\n\n${event.snippet}`}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : timeline && timeline.events.length === 0 ? (
                <div className="muted" style={{ fontSize: 13, textAlign: "center", padding: 24 }}>
                  No conversation events found for this company in the last {timeline.days} days.
                </div>
              ) : null}
            </div>
          )}

          {!selectedOrgId && !loadingOrgs && (
            <div className="card" style={{ padding: 24, textAlign: "center" }}>
              <div className="muted" style={{ fontSize: 13 }}>
                Select a company from the dropdown above to view its conversation timeline.
              </div>
            </div>
          )}
        </section>
      </main>
    </Layout>
  );
}

