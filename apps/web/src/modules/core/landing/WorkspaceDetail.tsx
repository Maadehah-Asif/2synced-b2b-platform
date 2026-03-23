import { useEffect, useState } from "react";
import Layout from "../../../components/Layout";
import "../auth/auth.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const palette = {
  ink: "#0B2540",
  slate: "#415274",
  mist: "#F4F8FC",
  line: "rgba(15,66,88,0.08)",
  aqua: "rgba(72,177,217,0.18)",
  softBlue: "#E8F2FA",
  softTeal: "#DDF1F2",
  accent: "#0f4258",
  accentStrong: "#123b57",
  panelTint: "#F3F8FC",
};

function useParamsHash() {
  const hash = window.location.hash || "";
  const m = hash.match(/#\/workspace\/(.+)/);
  return m ? m[1] : null;
}

export default function WorkspaceDetail() {
  const id = useParamsHash();
  const [loading, setLoading] = useState(true);
  const [shareId, setShareId] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string>("");

  useEffect(() => {
    (async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const token = localStorage.getItem("token");
        try {
          const res3 = await fetch(`${API_URL}/workspaces`, { headers: { Authorization: `Bearer ${token}` } });
          const d3 = await res3.json();
          if (res3.ok) {
            const found = (d3.workspaces || []).find((w: any) => w.id === id);
            if (found) setShareId(found.shareId || null);
          }
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

  return (
    <Layout>
      <main
        style={{
          minHeight: "100%",
          background: "linear-gradient(180deg, #edf4fb 0%, #f5f9fd 24%, #fcfdff 100%)",
          padding: "26px 0 40px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 10,
            right: -120,
            width: 420,
            height: 420,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(72,177,217,0.22) 0%, rgba(72,177,217,0) 72%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 180,
            left: -160,
            width: 420,
            height: 420,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(15,66,88,0.10) 0%, rgba(15,66,88,0) 76%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 22px", display: "grid", gap: 18, position: "relative" }}>
          <section
            style={{
              borderRadius: 26,
              padding: 0,
              background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(247,251,254,0.98) 100%)",
              boxShadow: "0 24px 60px rgba(13,30,60,0.09)",
              border: "1px solid rgba(15,66,88,0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
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
                alignSelf: "stretch",
                borderTopLeftRadius: 26,
                borderBottomLeftRadius: 26,
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
                Your marketing intelligence workspace with a lighter visual balance, clearer module hierarchy, and easier scanning across tools and actions.
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 12,
                minWidth: 280,
                flex: "1 1 320px",
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
                  Active Modules
                </div>
                <div style={{ fontSize: 30, fontWeight: 900, color: palette.ink, marginTop: 8 }}>5</div>
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
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--header-secondary)",
                    }}
                  >
                    {copyMessage}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section
            style={{
              borderRadius: 26,
              padding: 0,
              background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(246,250,253,0.98) 100%)",
              border: "1px solid rgba(15,66,88,0.10)",
              boxShadow: "0 22px 52px rgba(13,30,60,0.08)",
              backdropFilter: "blur(10px)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 8,
                background: "linear-gradient(90deg, rgba(15,66,88,1) 0%, rgba(72,177,217,0.85) 100%)",
              }}
            />
            <div
              style={{
                padding: 24,
                background: "linear-gradient(135deg, rgba(18,59,87,0.96) 0%, rgba(15,66,88,0.92) 52%, rgba(72,177,217,0.26) 100%)",
                borderBottom: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ maxWidth: 700 }}>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 12px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.12)",
                      border: "1px solid rgba(255,255,255,0.16)",
                      color: "#ffffff",
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    Workspace Modules
                  </div>
                  <h3 style={{ margin: "14px 0 6px", color: "#ffffff", fontSize: 34, lineHeight: 1.08 }}>Modules</h3>
                  <div style={{ color: "rgba(255,255,255,0.82)", fontSize: 14, lineHeight: 1.7 }}>
                    Choose a module to continue working in your workspace. Each module below uses the same actions, but the section now has a clearer visual entry point.
                  </div>
                </div>
                <div
                  style={{
                    padding: "14px 18px",
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.10)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    minWidth: 140,
                  }}
                >
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.72)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
                    Visible
                  </div>
                  <div style={{ fontSize: 30, color: "#ffffff", fontWeight: 900, marginTop: 8 }}>5</div>
                </div>
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
              {(() => {
                const moduleNames = [
                  "Lead Ingestion, Cleaning & AI Scoring",
                  "Intent Extraction & Behavioral Categorization",
                  "Conversation Intelligence & Thread Sentiment",
                  "Guided Assistant (Workflow Runner)",
                  "Sales & Marketing Alignment Dashboard",
                  "Revenue Attribution & ROI Modeling",
                  "Funnel Leakage & Campaign Fatigue Predictor",
                  "Executive Proposal & Insight Report Generator",
                  "Campaign Performance Aggregation & Optimization",
                ];
                const allowed = [1, 2, 3, 6, 7];

                return allowed.map((modIndex) => {
                  const i = modIndex - 1;
                  const path = modIndex === 1 ? `#/workspace/${id}/m01` : `#/workspace/${id}/m0${modIndex}`;
                  const name = moduleNames[i] || `Module ${modIndex}`;
                  const cardAccent =
                    modIndex === 1
                      ? "linear-gradient(180deg, rgba(72,177,217,0.18), rgba(72,177,217,0.04))"
                      : modIndex === 2
                      ? "linear-gradient(180deg, rgba(69,154,208,0.18), rgba(69,154,208,0.04))"
                      : modIndex === 3
                      ? "linear-gradient(180deg, rgba(15,66,88,0.16), rgba(15,66,88,0.03))"
                      : "linear-gradient(180deg, rgba(25,73,114,0.16), rgba(25,73,114,0.03))";
                  const cardBadge =
                    modIndex === 1
                      ? "Lead Quality"
                      : modIndex === 2
                      ? "Intent Signals"
                      : modIndex === 3
                      ? "Conversation AI"
                      : "Revenue Insight";

                  return (
                    <div
                      key={modIndex}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        window.location.hash = path;
                        setTimeout(() => {
                          if (window.location.hash !== path) window.location.assign(path);
                        }, 120);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          window.location.hash = path;
                          setTimeout(() => {
                            if (window.location.hash !== path) window.location.assign(path);
                          }, 120);
                        }
                      }}
                      style={{
                        borderRadius: 20,
                        overflow: "hidden",
                        background: "linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,253,0.98))",
                        border: "1px solid rgba(15,66,88,0.10)",
                        boxShadow: "0 18px 38px rgba(13,30,60,0.09)",
                        cursor: "pointer",
                        transition: "transform 140ms ease, box-shadow 140ms ease",
                        display: "flex",
                        flexDirection: "column",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          height: 6,
                          background: "linear-gradient(90deg, rgba(15,66,88,0.95) 0%, rgba(72,177,217,0.82) 100%)",
                        }}
                      />
                      <div
                        style={{
                          height: 160,
                          background: `linear-gradient(135deg, ${palette.softBlue} 0%, ${palette.softTeal} 100%)`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          position: "relative",
                        }}
                      >
                        <img
                          alt="module visual"
                          src={
                            modIndex === 1
                              ? "/src/assets/leadscoring.png"
                              : modIndex === 2
                              ? "/src/assets/intentscore.png"
                              : modIndex === 3
                              ? "/src/assets/conversation.png"
                              : modIndex === 6
                              ? "/src/assets/ROI.png"
                              : "/src/assets/funnel.png"
                          }
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
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
                            boxShadow: "0 8px 18px rgba(13,30,60,0.10)",
                          }}
                        >
                          {cardBadge}
                        </div>
                      </div>

                      <div
                        style={{
                          padding: 18,
                          background: `linear-gradient(180deg, #ffffff 0%, #fdfefe 72%, rgba(243,248,252,0.9) 100%), ${cardAccent}`,
                          display: "flex",
                          flexDirection: "column",
                          gap: 12,
                          flex: 1,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--header-secondary)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                            Module {modIndex}
                          </div>
                          <div
                            style={{
                              padding: "5px 8px",
                              borderRadius: 999,
                              background: "rgba(255,255,255,0.72)",
                              border: "1px solid rgba(15,66,88,0.08)",
                              color: palette.slate,
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            Open Tool
                          </div>
                        </div>
                        <div style={{ fontSize: 17, fontWeight: 900, color: palette.ink, lineHeight: 1.35 }}>{name}</div>
                        <div style={{ color: palette.slate, fontSize: 13, lineHeight: 1.72 }}>
                          {modIndex === 1
                            ? "Rank leads with explainable scores and preview time-window forecasts."
                            : modIndex === 2
                            ? "Extract intent, analyze behaviors, and access prioritization dashboards."
                            : modIndex === 3
                            ? "View conversation-level insights, sentiment trends, and decision-maker signals."
                            : modIndex === 6
                            ? "Measure attributed revenue, compare channels, and generate ROI projections."
                            : "Identify pipeline drop-offs and detect campaign fatigue patterns."}
                        </div>
                        <div
                          style={{
                            marginTop: "auto",
                            paddingTop: 8,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            borderTop: "1px solid rgba(15,66,88,0.08)",
                          }}
                        >
                          <div style={{ fontSize: 12, color: palette.slate, fontWeight: 700 }}>
                            Ready to open
                          </div>
                          <button
                            className="btn-primary"
                            style={{
                              padding: "10px 15px",
                              borderRadius: 12,
                              background: `linear-gradient(135deg, ${palette.accent} 0%, #195675 100%)`,
                              color: "#fff",
                              fontWeight: 800,
                              boxShadow: "0 10px 22px rgba(15,66,88,0.18)",
                            }}
                          >
                            Open
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </section>

        </div>
      </main>
    </Layout>
  );
}
