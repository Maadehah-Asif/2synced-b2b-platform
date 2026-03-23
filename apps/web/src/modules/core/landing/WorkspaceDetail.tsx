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
    cta: "Go to Data",
    kind: "Input",
    path: (id) => `#/workspace/${id}/m01/upload`,
  },
  {
    module: "M01",
    title: "Merged CSVs",
    desc: "Review merged lead datasets before turning them into module 1 lead records.",
    cta: "Open",
    kind: "View",
    path: (id) => `#/workspace/${id}/m01/merged`,
  },
  {
    module: "M02",
    title: "Intent Input Data",
    desc: "Upload and map behavior or intent-related records used by prioritization flows.",
    cta: "Go to Data",
    kind: "Input",
    path: (id) => `#/workspace/${id}/m02/upload-wizard`,
  },
  {
    module: "M02",
    title: "Intent View",
    desc: "Manage generated intent records, merged outputs, and lead-level inputs.",
    cta: "Manage",
    kind: "View",
    path: (id) => `#/workspace/${id}/m02/leads`,
  },
  {
    module: "M02",
    title: "Intent Upload",
    desc: "Open the direct upload screen for intent-source files when you do not need the wizard flow.",
    cta: "Open",
    kind: "Input",
    path: (id) => `#/workspace/${id}/m02/upload`,
  },
  {
    module: "M02",
    title: "Merged CSVs",
    desc: "Review merged datasets used to create module 2 lead and intent-ready records.",
    cta: "Open",
    kind: "View",
    path: (id) => `#/workspace/${id}/m02/merged`,
  },
  {
    module: "M06",
    title: "Campaign View",
    desc: "Browse current campaigns and inspect the operational records behind ROI analysis.",
    cta: "Open",
    kind: "View",
    path: (id) => `#/workspace/${id}/m06/campaigns`,
  },
  {
    module: "M06",
    title: "Campaign Manager",
    desc: "Create and manage campaigns that feed attribution and ROI analysis.",
    cta: "Manage",
    kind: "Manage",
    path: (id) => `#/workspace/${id}/m06/campaigns/manage`,
  },
  {
    module: "M06",
    title: "Campaign Touch Input",
    desc: "Add campaign touchpoint data used by attribution and journey analysis.",
    cta: "Go to Data",
    kind: "Input",
    path: (id) => `#/workspace/${id}/m06/touches/input`,
  },
  {
    module: "M06",
    title: "Campaign Touches",
    desc: "Record and review campaign touchpoint data used in journey and ROI flows.",
    cta: "Open",
    kind: "View",
    path: (id) => `#/workspace/${id}/m06/touches`,
  },
  {
    module: "M06",
    title: "Lead Data",
    desc: "Open imported lead records used inside revenue and attribution workflows.",
    cta: "Open",
    kind: "View",
    path: (id) => `#/workspace/${id}/m06/leads`,
  },
  {
    module: "M06",
    title: "Deal Input",
    desc: "Add new deals that feed pipeline and revenue analysis.",
    cta: "Go to Data",
    kind: "Input",
    path: (id) => `#/workspace/${id}/m06/deals/input`,
  },
  {
    module: "M06",
    title: "Deal Manager",
    desc: "View and update deal records that support attribution and revenue outputs.",
    cta: "Manage",
    kind: "View",
    path: (id) => `#/workspace/${id}/m06/deals`,
  },
  {
    module: "M07",
    title: "Funnel Leads Upload",
    desc: "Add or upload funnel lead records used across leakage and conversion analysis.",
    cta: "Go to Data",
    kind: "Input",
    path: (id) => `#/workspace/${id}/m07/leads/upload`,
  },
  {
    module: "M07",
    title: "Funnel Leads View",
    desc: "View and manage funnel leads already loaded into the workspace.",
    cta: "Manage",
    kind: "View",
    path: (id) => `#/workspace/${id}/m07/leads`,
  },
  {
    module: "M07",
    title: "Stage History Upload",
    desc: "Add or import stage transition records for funnel progression analysis.",
    cta: "Go to Data",
    kind: "Input",
    path: (id) => `#/workspace/${id}/m07/stages/upload`,
  },
  {
    module: "M07",
    title: "Stage History View",
    desc: "View and maintain stage transition records for funnel progression analysis.",
    cta: "Manage",
    kind: "View",
    path: (id) => `#/workspace/${id}/m07/stages`,
  },
  {
    module: "M07",
    title: "Interaction Upload",
    desc: "Add or upload interaction events tied to funnel behavior and engagement.",
    cta: "Go to Data",
    kind: "Input",
    path: (id) => `#/workspace/${id}/m07/interactions/upload`,
  },
  {
    module: "M07",
    title: "Interaction Manager",
    desc: "Manage interaction history and uploaded events tied to funnel behavior.",
    cta: "Manage",
    kind: "View",
    path: (id) => `#/workspace/${id}/m07/interactions`,
  },
];

const insightCards: InsightCard[] = [
  {
    module: "M01",
    title: "Lead Quality & Scoring",
    desc: "Open module 1 scoring flows and lead quality views.",
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
    module: "M06",
    title: "Revenue Insight",
    desc: "Open ROI and attribution outputs for revenue analysis.",
    image: "/src/assets/ROI.png",
    path: (id) => `#/workspace/${id}/m06`,
  },
  {
    module: "M07",
    title: "Funnel Insight",
    desc: "Open funnel diagnostics and module-level insight entry points.",
    image: "/src/assets/funnel.png",
    path: (id) => `#/workspace/${id}/m07`,
  },
];

export default function WorkspaceDetail() {
  const id = useParamsHash();
  const [loading, setLoading] = useState(true);
  const [shareId, setShareId] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string>("");
  const [memberCount, setMemberCount] = useState<number>(0);

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
            const found = (data.workspaces || []).find((w: any) => w.id === id);
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

        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 22px", display: "grid", gap: 20, position: "relative" }}>
          <section
            style={{
              borderRadius: 26,
              overflow: "hidden",
              background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(247,251,254,0.98) 100%)",
              border: "1px solid rgba(15,66,88,0.08)",
              boxShadow: "0 24px 60px rgba(13,30,60,0.09)",
              display: "flex",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                maxWidth: 760,
                flex: "1 1 540px",
                padding: 26,
                background: "linear-gradient(135deg, rgba(18,59,87,0.98) 0%, rgba(15,66,88,0.96) 45%, rgba(72,177,217,0.24) 100%)",
                color: "#fff",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
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
              <div style={{ color: "rgba(255,255,255,0.84)", fontSize: 15, lineHeight: 1.7, maxWidth: 640 }}>
                Use the Data Hub for raw records and operational screens, then open Insights for dashboards, signals, scoring, and analysis outputs.
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: 12,
                minWidth: 320,
                flex: "1 1 340px",
                padding: 26,
              }}
            >
              <div
                style={{
                  borderRadius: 18,
                  padding: "16px 18px",
                  background: "linear-gradient(180deg, rgba(255,255,255,1), rgba(234,243,250,0.96))",
                  border: `1px solid ${palette.line}`,
                  boxShadow: "0 10px 24px rgba(13,30,60,0.04)",
                }}
              >
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", fontWeight: 700 }}>
                  Members
                </div>
                <div style={{ fontSize: 30, fontWeight: 900, color: palette.ink, marginTop: 8 }}>
                  {loading ? "..." : memberCount}
                </div>
              </div>
              <div
                style={{
                  borderRadius: 18,
                  padding: "16px 18px",
                  background: "linear-gradient(180deg, rgba(255,255,255,1), rgba(236,247,249,0.96))",
                  border: `1px solid ${palette.line}`,
                  boxShadow: "0 10px 24px rgba(13,30,60,0.04)",
                  position: "relative",
                }}
              >
                <button
                  type="button"
                  onClick={copyShareId}
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    border: "1px solid rgba(15,66,88,0.12)",
                    background: "rgba(255,255,255,0.92)",
                    color: "var(--header-secondary)",
                    borderRadius: 999,
                    padding: "5px 10px",
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    boxShadow: "0 8px 18px rgba(13,30,60,0.06)",
                  }}
                >
                  Copy
                </button>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", fontWeight: 700 }}>
                  Share ID
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: palette.ink, marginTop: 10, wordBreak: "break-word" }}>
                  {loading ? "Loading..." : shareId || "-"}
                </div>
                {copyMessage && (
                  <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: "var(--header-secondary)" }}>
                    {copyMessage}
                  </div>
                )}
              </div>
            </div>
          </section>

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
              <div style={{ color: "rgba(255,255,255,0.82)", fontSize: 14, lineHeight: 1.7, maxWidth: 760 }}>
                Manage the input and operational data that powers scoring, attribution, and funnel analysis.
              </div>
            </div>

            <div
              style={{
                padding: 24,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 14,
              }}
            >
              {dataHubCards.map((card) => (
                <div
                  key={`${card.module}-${card.title}`}
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
                      {card.module}
                    </div>
                    {card.kind && (
                      <div style={{ display: "inline-flex", alignItems: "center", padding: "5px 9px", borderRadius: 999, background: "rgba(72,177,217,0.10)", color: palette.slate, fontSize: 11, fontWeight: 700 }}>
                        {card.kind}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: palette.ink, lineHeight: 1.3 }}>{card.module} - {card.title}</div>
                  <div style={{ fontSize: 13, color: palette.slate, lineHeight: 1.7, flex: 1 }}>{card.desc}</div>
                  <div style={{ paddingTop: 8, borderTop: "1px solid rgba(15,66,88,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div style={{ fontSize: 12, color: palette.slate, fontWeight: 700 }}>Operational entry point</div>
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
            </div>
          </section>

          <section
            style={{
              borderRadius: 26,
              overflow: "hidden",
              border: "1px solid rgba(15,66,88,0.10)",
              boxShadow: "0 22px 52px rgba(13,30,60,0.08)",
              background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(246,250,253,0.98) 100%)",
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
              <div style={{ color: "rgba(255,255,255,0.82)", fontSize: 14, lineHeight: 1.7, maxWidth: 760 }}>
                Open the analysis and intelligence tools available in this workspace.
              </div>
            </div>

            <div
              style={{
                padding: 24,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 16,
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
                  <div style={{ height: 160, position: "relative" }}>
                    <img alt="insight visual" src={card.image} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div
                      style={{
                        position: "absolute",
                        left: 14,
                        bottom: 12,
                        padding: "6px 10px",
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.92)",
                        border: "1px solid rgba(15,66,88,0.10)",
                        color: "var(--header-secondary)",
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      {card.module}
                    </div>
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
      </main>
    </Layout>
  );
}
