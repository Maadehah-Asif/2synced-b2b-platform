import { useEffect, useState } from "react";
import Layout from "../../../components/Layout";
import "../auth/auth.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const palette = {
  gold: "#F8C667",
  magenta: "#A72D73",
  purple: "#5F69C8",
  aqua: "#A1DDE8",
  ink: "#0B2540",
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

  return (
    <Layout>
      <main
        style={{
          minHeight: "100vh",
          background: `linear-gradient(135deg, ${palette.aqua} 0%, #e9f5fb 26%, #f9f4ff 100%)`,
          padding: "22px 0 32px",
        }}
      >
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 22px", display: "grid", gap: 16 }}>
          {/* Page heading */}
          <div
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: 18,
              boxShadow: "0 18px 50px rgba(13,30,60,0.12)",
              border: "1px solid rgba(12,30,96,0.05)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: palette.purple, fontWeight: 700 }}>Workspace Home</div>
              <h1 style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 800, color: palette.ink }}>
                Modules & quick links
              </h1>
              <div style={{ color: "#3a4a68", fontSize: 14 }}>Palette test: gold / magenta / purple / aqua</div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <ColorPill label="Gold" color={palette.gold} />
              <ColorPill label="Magenta" color={palette.magenta} />
              <ColorPill label="Purple" color={palette.purple} />
              <ColorPill label="Aqua" color={palette.aqua} textColor="#0f213e" />
            </div>
          </div>

          {/* Module cards */}
          <section
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: 20,
              boxShadow: "0 18px 50px rgba(13,30,60,0.08)",
              border: "1px solid rgba(12,30,96,0.05)",
            }}
          >
            <h3 style={{ margin: "0 0 12px", color: palette.ink }}>Modules</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 14,
              }}
            >
              {(() => {
                const moduleNames = [
                  "Module 1 - Lead Ingestion, Cleaning & AI Scoring",
                  "Module 2 - Intent Extraction & Categorization",
                  "Module 3 - Conversation Intelligence & Thread Sentiment Analysis",
                  "Module 4 - Guided Assistant (Workflow Runner)",
                  "Module 5 - Sales & Marketing Alignment Dashboard",
                  "Module 6 - Revenue Attribution & ROI Modeling",
                  "Module 7 - Funnel Leakage & Campaign Fatigue Predictor",
                  "MODULE 8 - Executive Proposal & Insight Report Generator",
                  "Module 9 - Campaign Performance Aggregation & Optimization",
                ];
                const accents = [palette.purple, palette.magenta, palette.gold, palette.aqua];
                // show selected modules only (remove modules 4,5,8,9)
                const allowed = [1, 2, 3, 6, 7];
                return allowed.map((modIndex) => {
                  const i = modIndex - 1;
                  const path = modIndex === 1 ? `#/workspace/${id}/m01` : `#/workspace/${id}/m0${modIndex}`;
                  const name = moduleNames[i] || `Module ${modIndex}`;
                  const accent = accents[i % accents.length];
                  return (
                    <div
                      key={modIndex}
                      role="button"
                      tabIndex={0}
                      onClick={() => (window.location.hash = path)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") window.location.hash = path;
                      }}
                      style={{
                        background: `linear-gradient(135deg, ${accent}1a 0%, #ffffff 100%)`,
                        borderRadius: 14,
                        padding: 14,
                        border: `1px solid ${accent}33`,
                        boxShadow: "0 12px 28px rgba(13,30,60,0.08)",
                        display: "grid",
                        gap: 8,
                        cursor: "pointer",
                        transition: "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 700, color: palette.ink }}>{name}</div>
                      <div style={{ color: "#415274", fontSize: 13 }}>Open Module {modIndex} tools and reports</div>
                      <div
                        style={{
                          marginTop: 4,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          background: "#fff",
                          padding: "6px 10px",
                          borderRadius: 999,
                          border: `1px solid ${accent}55`,
                          color: accent,
                          fontWeight: 700,
                          fontSize: 12,
                          width: "fit-content",
                          boxShadow: "0 8px 18px rgba(13,30,60,0.08)",
                        }}
                      >
                        Module {modIndex}
                        <span
                          style={{
                            background: accent,
                            color: "#0f213e",
                            padding: "4px 8px",
                            borderRadius: 8,
                            fontWeight: 800,
                            boxShadow: `0 8px 20px ${accent}44`,
                          }}
                        >
                          Go
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </section>

          {/* Share ID */}
          <section
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: 18,
              boxShadow: "0 18px 50px rgba(13,30,60,0.08)",
              border: "1px solid rgba(12,30,96,0.05)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div>
              <div style={{ color: "#556480", fontSize: 13 }}>Workspace Share ID</div>
              <div style={{ fontWeight: 800, color: palette.ink, fontSize: 18 }}>{shareId || "-"}</div>
            </div>
            <button
              className="btn-primary"
              style={{
                background: palette.magenta,
                border: "none",
                color: "#fff",
                borderRadius: 12,
                padding: "10px 14px",
                fontWeight: 700,
                boxShadow: "0 12px 26px rgba(167,45,115,0.35)",
                cursor: "pointer",
              }}
              onClick={() => shareId && navigator.clipboard?.writeText(shareId)}
            >
              Copy
            </button>
          </section>
        </div>
      </main>
    </Layout>
  );
}

function ColorPill({ label, color, textColor }: { label: string; color: string; textColor?: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: color,
        color: textColor || "#0f213e",
        padding: "8px 12px",
        borderRadius: 999,
        fontWeight: 800,
        boxShadow: `0 10px 22px ${color}55`,
        border: `1px solid ${color}aa`,
        fontSize: 12,
      }}
    >
      {label}
    </span>
  );
}
