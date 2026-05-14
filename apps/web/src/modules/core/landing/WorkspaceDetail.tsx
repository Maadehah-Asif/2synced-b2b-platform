import { useEffect, useState } from "react";
import Layout from "../../../components/Layout";
import "../auth/auth.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const palette = {
  ink: "#0B2540",
  slate: "#415274",
  line: "rgba(15,66,88,0.08)",
  accent: "#0f4258",
};

const moduleDisplayNames: Record<string, string> = {
  M01: "Lead Quality & Scoring",
  M02: "Intent Signals",
  M03: "Conversation AI",
  M05: "Sales & Marketing Alignment",
  M06: "Revenue Insight",
  M07: "Funnel Insight",
  M09: "Campaign Performance Optimization",
};

function useParamsHash() {
  const hash = window.location.hash || "";
  const m = hash.match(/#\/workspace\/(.+)/);
  return m ? m[1] : null;
}

type HubCard = {
  module: string;
  title: string;
  desc: string;
  cta: string;
  kind?: string;
  entity: string;
  usedIn: string[];
  path: (id: string) => string;
};

type InsightCard = {
  module: string;
  title: string;
  desc: string;
  image: string;
  path: (id: string) => string;
};

const dataHubCards: HubCard[] = [
  {
    module: "M01",
    title: "Lead Input",
    desc: "Upload source lead files and prepare raw records used by scoring workflows.",
    cta: "Manage",
    kind: "Input",
    entity: "Leads",
    usedIn: ["M01"],
    path: (id) => `#/workspace/${id}/m01/upload`,
  },
  {
    module: "M01",
    title: "Merged CSVs",
    desc: "Review merged lead datasets before turning them into lead-quality records.",
    cta: "Manage",
    kind: "View",
    entity: "Leads",
    usedIn: ["M01"],
    path: (id) => `#/workspace/${id}/m01/merged`,
  },
  {
    module: "M02",
    title: "Intent Input Data",
    desc: "Upload and map behavior or intent-related records used by prioritization flows.",
    cta: "Manage",
    kind: "Input",
    entity: "Intent Data",
    usedIn: ["M02"],
    path: (id) => `#/workspace/${id}/m02/upload-wizard`,
  },
  {
    module: "M02",
    title: "Intent View",
    desc: "Manage generated intent records, merged outputs, and lead-level inputs.",
    cta: "Manage",
    kind: "View",
    entity: "Intent Data",
    usedIn: ["M02"],
    path: (id) => `#/workspace/${id}/m02/leads`,
  },
  {
    module: "M02",
    title: "Intent Upload",
    desc: "Open the direct upload screen for intent-source files when you do not need the wizard flow.",
    cta: "Manage",
    kind: "Input",
    entity: "Intent Data",
    usedIn: ["M02"],
    path: (id) => `#/workspace/${id}/m02/upload`,
  },
  {
    module: "M02",
    title: "Merged CSVs",
    desc: "Review merged datasets used to create lead and intent-ready records.",
    cta: "Manage",
    kind: "View",
    entity: "Intent Data",
    usedIn: ["M02"],
    path: (id) => `#/workspace/${id}/m02/merged`,
  },
    {
      module: "M06",
      title: "Campaign Workspace",
      desc: "Review, create, edit, archive, and import campaigns from one unified operational screen.",
      cta: "Manage",
      kind: "Manage",
      entity: "Campaigns",
      usedIn: ["M06"],
      path: (id) => `#/workspace/${id}/m06/campaigns`,
    },
    {
      module: "M06",
      title: "Touch Workspace",
      desc: "Review, create, import, and manage campaign touchpoint records from one unified screen.",
      cta: "Manage",
      kind: "Manage",
      entity: "Campaign Touches",
      usedIn: ["M06"],
      path: (id) => `#/workspace/${id}/m06/touch-workspace`,
    },
  {
    module: "M06",
    title: "Lead Data",
    desc: "Open the shared lead table used by both attribution and funnel workflows.",
    cta: "Manage",
    kind: "View",
    entity: "Leads",
    usedIn: ["M06", "M07"],
    path: (id) => `#/workspace/${id}/m06/leads`,
  },
    {
      module: "M06",
      title: "Deal Workspace",
      desc: "Review, add, import, and manage deal records from one unified operational screen.",
      cta: "Manage",
      kind: "Manage",
      entity: "Deals",
      usedIn: ["M06"],
      path: (id) => `#/workspace/${id}/m06/deals`,
  },
    {
      module: "M07",
      title: "Stage Workspace",
      desc: "Review, add, import, and manage funnel stage transition records from one unified screen.",
      cta: "Manage",
      kind: "Manage",
      entity: "Funnel Stages",
      usedIn: ["M07"],
      path: (id) => `#/workspace/${id}/m07/stages`,
  },
  {
    module: "M07",
    title: "Interaction Workspace",
    desc: "Review, add, import, and manage funnel interaction events from one unified operational screen.",
    cta: "Manage",
    kind: "Manage",
    entity: "Interactions",
    usedIn: ["M07"],
    path: (id) => `#/workspace/${id}/m07/interactions`,
  },
  {
    module: "M05",
    title: "Web Engagement Data",
    desc: "Upload, preview, archive, and manage web engagement CSV datasets used by the Sales & Marketing Alignment workspace.",
    cta: "Manage",
    kind: "Input",
    entity: "Web Engagement",
    usedIn: ["M05"],
    path: (id) => `#/workspace/${id}/m05?view=web-engagement`,
  },
];

const insightCards: InsightCard[] = [
  {
    module: "M01",
    title: "Lead Quality & Scoring",
    desc: "Open scoring flows and lead quality views.",
    image: "/src/assets/leadscoring.png",
    path: (id) => `#/workspace/${id}/m01`,
  },
  {
    module: "M02",
    title: "Intent Signals",
    desc: "Open prioritization and intent-focused outputs for decision making.",
    image: "/src/assets/intentscore.png",
    path: (id) => `#/workspace/${id}/m02`,
  },
  {
    module: "M03",
    title: "Conversation AI",
    desc: "Open the conversation intelligence area from the workspace insights section.",
    image: "/src/assets/conversation.png",
    path: (id) => `#/workspace/${id}/m03`,
  },
  {
    module: "M05",
    title: "Sales & Marketing Alignment",
    desc: "Open the shared alignment layer for cross-team KPIs, funnel checkpoints, and coordination signals.",
    image: "/src/assets/landing-page-img1.png",
    path: (id) => `#/workspace/${id}/m05`,
  },
  {
    module: "M06",
    title: "Revenue Insight",
    desc: "Open ROI and attribution outputs for revenue analysis.",
    image: "/src/assets/ROI.png",
    path: (id) => `#/workspace/${id}/m06`,
  },
  {
    module: "M07",
    title: "Funnel Insight",
    desc: "Open funnel diagnostics and insight entry points.",
    image: "/src/assets/funnel.png",
    path: (id) => `#/workspace/${id}/m07`,
  },
  {
    module: "M09",
    title: "Campaign Performance Optimization",
    desc: "Open the centralized campaign aggregation and optimization layer for channel-level recommendations.",
    image: "/src/assets/ROI.png",
    path: (id) => `#/workspace/${id}/m09`,
  },
];

export default function WorkspaceDetail() {
  const id = useParamsHash();
  const [loading, setLoading] = useState(true);
  const [shareId, setShareId] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string>("");
  const [memberCount, setMemberCount] = useState<number>(0);
  const [entityFilter, setEntityFilter] = useState<string>("All data");
  const [moduleFilter, setModuleFilter] = useState<string>("All modules");

  useEffect(() => {
    (async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const token = localStorage.getItem("token");
        try {
          const res = await fetch(`${API_URL}/workspaces`, { headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json();
          if (res.ok) {
            const workspaces = Array.isArray(data.workspaces) ? data.workspaces as Array<{ id?: string; shareId?: string | null }> : [];
            const found = workspaces.find((w) => w.id === id);
            if (found) setShareId(found.shareId || null);
          }
        } catch {
          /* ignore */
        }
        try {
          const membersRes = await fetch(`${API_URL}/workspaces/${id}/members`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const membersData = await membersRes.json();
          if (membersRes.ok) setMemberCount((membersData.members || []).length);
        } catch {
          /* ignore */
        }
      } catch {
        /* ignore */
      }
      setLoading(false);
    })();
  }, [id]);

  function copyShareId() {
    if (!shareId) return;
    navigator.clipboard?.writeText(shareId);
    setCopyMessage("Copied");
    window.setTimeout(() => setCopyMessage(""), 1800);
  }

  function openPath(path: string) {
    window.location.hash = path;
  }

  function openMembers() {
    if (!id) return;
    window.location.hash = `#/workspace/${id}/members`;
  }

  const entityOptions = ["All data", ...Array.from(new Set(dataHubCards.map((card) => card.entity)))];
  const moduleOptions = [
    "All modules",
    ...Array.from(new Set([...dataHubCards.flatMap((card) => card.usedIn), "M03", "M05", "M09"]))
      .sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")))
      .map((module) => moduleDisplayNames[module] || module),
  ];

  const visibleHubCards = dataHubCards.filter((card) => {
    if (entityFilter !== "All data" && card.entity !== entityFilter) return false;
    if (moduleFilter !== "All modules" && !card.usedIn.some((module) => moduleDisplayNames[module] === moduleFilter)) return false;
    return true;
  });

  return (
    <Layout>
      <main
        style={{
          minHeight: "100%",
          background: "linear-gradient(180deg, #eef5fb 0%, #f7fbfe 24%, #fcfdff 100%)",
          padding: "26px 0 40px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 20,
            right: -120,
            width: 420,
            height: 420,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(72,177,217,0.22) 0%, rgba(72,177,217,0) 72%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ maxWidth: 1600, margin: "0 auto", padding: "0 24px", display: "grid", gap: 22, position: "relative" }}>
          <section
            style={{
              borderRadius: 26,
              overflow: "hidden",
              background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(247,251,254,0.98) 100%)",
              border: "1px solid rgba(15,66,88,0.08)",
              boxShadow: "0 24px 60px rgba(13,30,60,0.09)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
              width: "100%",
            }}
          >
            <div
              style={{
                minWidth: 0,
                padding: "34px 34px 32px",
                background: "linear-gradient(135deg, rgba(18,59,87,0.98) 0%, rgba(15,66,88,0.96) 45%, rgba(72,177,217,0.24) 100%)",
                color: "#fff",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignSelf: "flex-start",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 12px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  color: "#ffffff",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Workspace Dashboard
              </div>
              <h1 style={{ margin: "14px 0 8px", fontSize: 38, fontWeight: 900, lineHeight: 1.05, color: "#ffffff" }}>
                Workspace Home
              </h1>
              <div style={{ color: "rgba(255,255,255,0.84)", fontSize: 16, lineHeight: 1.75, maxWidth: 760 }}>
                Use the Data Hub for raw records and operational screens, then open Insights for dashboards, signals, scoring, and analysis outputs.
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
                gap: 14,
                minWidth: 0,
                padding: 24,
                alignContent: "center",
                alignItems: "stretch",
                background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(245,250,254,0.98) 100%)",
              }}
            >
              <div
                style={{
                  borderRadius: 18,
                  padding: "16px 18px",
                  minHeight: 142,
                  background: "linear-gradient(180deg, rgba(255,255,255,1), rgba(234,243,250,0.96))",
                  border: `1px solid ${palette.line}`,
                  boxShadow: "0 10px 24px rgba(13,30,60,0.04)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 12,
                  minWidth: 0,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", fontWeight: 700 }}>
                    Members
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 900, color: palette.ink, marginTop: 8, lineHeight: 1 }}>
                    {loading ? "..." : memberCount}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openMembers}
                  style={{
                    marginTop: 12,
                    border: "1px solid rgba(15,66,88,0.12)",
                    background: "#ffffff",
                    color: palette.accent,
                    borderRadius: 999,
                    padding: "8px 12px",
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    boxShadow: "0 8px 18px rgba(13,30,60,0.06)",
                  }}
                >
                  Manage members
                </button>
              </div>
              <div
                style={{
                  borderRadius: 18,
                  padding: "16px 18px",
                  background: "linear-gradient(180deg, rgba(255,255,255,1), rgba(236,247,249,0.96))",
                  border: `1px solid ${palette.line}`,
                  boxShadow: "0 10px 24px rgba(13,30,60,0.04)",
                  minHeight: 142,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 12,
                  minWidth: 0,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", fontWeight: 700 }}>
                    Share ID
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: palette.ink, marginTop: 10, wordBreak: "break-word", overflowWrap: "anywhere", lineHeight: 1.35 }}>
                    {loading ? "Loading..." : shareId || "-"}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={copyShareId}
                    style={{
                      border: "1px solid rgba(15,66,88,0.12)",
                      background: "rgba(255,255,255,0.92)",
                      color: "var(--header-secondary)",
                      borderRadius: 999,
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: "0.04em",
                      boxShadow: "0 8px 18px rgba(13,30,60,0.06)",
                    }}
                  >
                    Copy
                  </button>
                  {copyMessage && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--header-secondary)" }}>
                      {copyMessage}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.08fr) minmax(420px, 0.92fr)",
              gap: 20,
              alignItems: "start",
            }}
          >
            <section
              style={{
                borderRadius: 26,
                overflow: "hidden",
                border: "1px solid rgba(15,66,88,0.10)",
                boxShadow: "0 22px 52px rgba(13,30,60,0.08)",
                background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,251,254,0.98))",
              }}
            >
              <div
                style={{
                  padding: 24,
                  background: "linear-gradient(135deg, rgba(18,59,87,0.96) 0%, rgba(15,66,88,0.92) 52%, rgba(72,177,217,0.26) 100%)",
                }}
              >
                <div style={{ display: "inline-flex", padding: "7px 12px", borderRadius: 999, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.16)", color: "#fff", fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Data Hub
                </div>
                <h3 style={{ margin: "14px 0 6px", color: "#fff", fontSize: 34, lineHeight: 1.08 }}>Data Hub</h3>
                <div style={{ color: "rgba(255,255,255,0.82)", fontSize: 14, lineHeight: 1.7, maxWidth: 720 }}>
                  Manage the input and operational data that powers scoring, attribution, and funnel analysis.
                </div>
                <div
                  style={{
                    marginTop: 18,
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 10,
                  }}
                >
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.72)" }}>
                      Data Type
                    </span>
                    <select
                      value={entityFilter}
                      onChange={(e) => setEntityFilter(e.target.value)}
                      style={{
                        width: "100%",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.16)",
                        background: "rgba(255,255,255,0.12)",
                        color: "#fff",
                        padding: "10px 12px",
                        fontSize: 13,
                        fontWeight: 700,
                        outline: "none",
                      }}
                    >
                      {entityOptions.map((option) => (
                        <option key={option} value={option} style={{ color: palette.ink }}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.72)" }}>
                      Used In
                    </span>
                    <select
                      value={moduleFilter}
                      onChange={(e) => setModuleFilter(e.target.value)}
                      style={{
                        width: "100%",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.16)",
                        background: "rgba(255,255,255,0.12)",
                        color: "#fff",
                        padding: "10px 12px",
                        fontSize: 13,
                        fontWeight: 700,
                        outline: "none",
                      }}
                    >
                      {moduleOptions.map((option) => (
                        <option key={option} value={option} style={{ color: palette.ink }}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div
                style={{
                  padding: 24,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 14,
                }}
              >
                {visibleHubCards.map((card) => (
                  <div
                    key={`${card.module}-${card.entity}-${card.title}`}
                    style={{
                      borderRadius: 18,
                      padding: 18,
                      background: "linear-gradient(180deg, rgba(255,255,255,1), rgba(244,249,253,0.98))",
                      border: "1px solid rgba(15,66,88,0.09)",
                      boxShadow: "0 14px 30px rgba(13,30,60,0.05)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", padding: "5px 10px", borderRadius: 999, background: "rgba(15,66,88,0.10)", color: palette.accent, fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        {card.entity}
                      </div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: palette.ink, lineHeight: 1.3 }}>{card.title}</div>
                    <div style={{ fontSize: 13, color: palette.slate, lineHeight: 1.7, flex: 1 }}>{card.desc}</div>
                    <div style={{ paddingTop: 8, borderTop: "1px solid rgba(15,66,88,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div style={{ fontSize: 12, color: palette.slate, fontWeight: 700 }}>
                        Used in {card.usedIn.map((module) => moduleDisplayNames[module] || module).join(", ")}
                      </div>
                      <button
                        className="btn-primary"
                        style={{ padding: "9px 13px", borderRadius: 12, fontWeight: 800 }}
                        onClick={() => openPath(card.path(id || ""))}
                      >
                        {card.cta}
                      </button>
                    </div>
                  </div>
                ))}
                {visibleHubCards.length === 0 && (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      borderRadius: 18,
                      padding: 22,
                      background: "linear-gradient(180deg, rgba(255,255,255,1), rgba(244,249,253,0.98))",
                      border: "1px dashed rgba(15,66,88,0.18)",
                      color: palette.slate,
                      fontSize: 14,
                      lineHeight: 1.7,
                    }}
                  >
                    No matching data cards for the current filters. Try a broader data type, module, or action selection.
                  </div>
                )}
              </div>
            </section>

            <section
              style={{
                borderRadius: 26,
                overflow: "hidden",
                border: "1px solid rgba(15,66,88,0.10)",
                boxShadow: "0 22px 52px rgba(13,30,60,0.08)",
                background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(246,250,253,0.98) 100%)",
                position: "sticky",
                top: 22,
              }}
            >
              <div
                style={{
                  padding: 24,
                background: "linear-gradient(135deg, rgba(18,59,87,0.96) 0%, rgba(15,66,88,0.92) 52%, rgba(72,177,217,0.26) 100%)",
                }}
              >
                <div style={{ display: "inline-flex", padding: "7px 12px", borderRadius: 999, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.16)", color: "#fff", fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Insights
                </div>
                <h3 style={{ margin: "14px 0 6px", color: "#fff", fontSize: 34, lineHeight: 1.08 }}>Insights</h3>
                <div style={{ color: "rgba(255,255,255,0.82)", fontSize: 14, lineHeight: 1.7, maxWidth: 420 }}>
                  Open the analysis and intelligence tools available in this workspace.
                </div>
              </div>

              <div
                style={{
                  padding: 20,
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 14,
                }}
              >
                {insightCards.map((card) => (
                  <div
                    key={`${card.module}-${card.title}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => openPath(card.path(id || ""))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") openPath(card.path(id || ""));
                    }}
                    style={{
                      borderRadius: 20,
                      overflow: "hidden",
                      background: "linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,253,0.98))",
                      border: "1px solid rgba(15,66,88,0.10)",
                      boxShadow: "0 18px 38px rgba(13,30,60,0.09)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div style={{ height: 6, background: "linear-gradient(90deg, rgba(15,66,88,0.95) 0%, rgba(72,177,217,0.82) 100%)" }} />
                    <div style={{ height: 150, position: "relative" }}>
                      <img alt="insight visual" src={card.image} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>

                    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, flex: 1, background: "linear-gradient(180deg, #ffffff 0%, #fdfefe 100%)" }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: palette.ink, lineHeight: 1.3 }}>{card.title}</div>
                      <div style={{ fontSize: 13, color: palette.slate, lineHeight: 1.7, flex: 1 }}>{card.desc}</div>
                      <div style={{ paddingTop: 8, borderTop: "1px solid rgba(15,66,88,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <div style={{ fontSize: 12, color: palette.slate, fontWeight: 700 }}>Insight entry point</div>
                        <button
                          className="btn-primary"
                          style={{ padding: "10px 15px", borderRadius: 12, fontWeight: 800 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openPath(card.path(id || ""));
                          }}
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </Layout>
  );
}
