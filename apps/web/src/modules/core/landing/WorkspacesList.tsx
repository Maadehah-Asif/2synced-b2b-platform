import { useEffect, useState } from "react";
import Layout from "../../../components/Layout";
import "../auth/auth.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const PRIMARY = "#0f4258";

export default function WorkspacesList() {
  const [list, setList] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/workspaces`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load workspaces");
        setList(data.workspaces || []);
      } catch (e: any) {
        setError(e.message);
      }
      setLoading(false);
    })();
  }, []);

  const onBack = () => {
    window.location.hash = "#/landing";
  };

  const onCreate = () => {
    window.location.hash = "#/create-workspace";
  };

  const onCopyId = (shareId?: string | null) => {
    if (!shareId) return;
    navigator.clipboard?.writeText(shareId);
    alert("Share ID copied to clipboard");
  };

  const onView = (id: string) => {
    window.location.hash = `#/workspace/${id}`;
  };

  return (
    <Layout>
      <main
        className="page-root"
        style={{
          background: "linear-gradient(180deg, rgba(15,66,88,0.08) 0%, rgba(255,255,255,0.86) 18%, rgba(249,251,254,1) 100%)",
          minHeight: "100%",
        }}
      >
        <div className="container-centered" style={{ maxWidth: 1180, padding: "28px 18px 40px" }}>
          <section
            className="card"
            style={{
              borderRadius: 28,
              padding: 26,
              boxShadow: "0 22px 58px rgba(15, 66, 88, 0.16)",
              background: "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(247,250,253,0.98) 100%)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -110,
                right: -40,
                width: 280,
                height: 280,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(72,177,217,0.20) 0%, rgba(72,177,217,0) 72%)",
                pointerEvents: "none",
              }}
            />

            <div style={{ position: "relative", display: "grid", gap: 20 }}>
              <section
                style={{
                  borderRadius: 22,
                  padding: 24,
                  background: "linear-gradient(135deg, rgba(11,37,64,0.98) 0%, rgba(15,66,88,0.96) 62%, rgba(72,177,217,0.88) 100%)",
                  color: "#fff",
                  boxShadow: "0 24px 52px rgba(11,37,64,0.16)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                    <button
                      className="btn-ghost"
                      onClick={onBack}
                      style={{
                        borderRadius: 999,
                        border: "1px solid rgba(255,255,255,0.24)",
                        padding: "10px 18px",
                        fontWeight: 600,
                        color: "#fff",
                        background: "rgba(255,255,255,0.08)",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      Back
                    </button>
                    <div style={{ maxWidth: 560 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.76 }}>
                        Workspace Hub
                      </div>
                      <h2 style={{ margin: "8px 0 6px", fontSize: 34, lineHeight: 1.1, color: "#fff" }}>
                        Your Workspaces
                      </h2>
                      <div style={{ fontSize: 15, lineHeight: 1.65, color: "rgba(255,255,255,0.82)" }}>
                        Select a workspace, copy its share ID, or create a new one without changing any existing flow.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 10, minWidth: 220 }}>
                    <div
                      style={{
                        padding: "14px 16px",
                        borderRadius: 18,
                        background: "rgba(255,255,255,0.10)",
                        border: "1px solid rgba(255,255,255,0.16)",
                      }}
                    >
                      <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.72)" }}>
                        Total Workspaces
                      </div>
                      <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{list.length}</div>
                    </div>
                    <button
                      className="btn-primary"
                      onClick={onCreate}
                      style={{
                        borderRadius: 999,
                        padding: "12px 22px",
                        backgroundColor: "#ffffff",
                        color: PRIMARY,
                        fontWeight: 700,
                        border: "none",
                        boxShadow: "0 14px 28px rgba(11,37,64,0.18)",
                        fontSize: 14,
                      }}
                    >
                      Create workspace
                    </button>
                  </div>
                </div>
              </section>

              {loading && (
                <div
                  className="card"
                  style={{
                    padding: 18,
                    borderRadius: 18,
                    color: "var(--text-primary)",
                    fontWeight: 600,
                  }}
                >
                  Loading workspaces...
                </div>
              )}

              {error && <div className="auth-error">{error}</div>}

              {!loading && !error && (
                <>
                  {list.length === 0 ? (
                    <section
                      className="card"
                      style={{
                        padding: 28,
                        borderRadius: 22,
                        textAlign: "center",
                        background: "linear-gradient(180deg, rgba(255,255,255,1), rgba(246,250,253,0.94))",
                      }}
                    >
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: "50%",
                          margin: "0 auto 14px",
                          display: "grid",
                          placeItems: "center",
                          background: "rgba(15,66,88,0.08)",
                          color: PRIMARY,
                          fontSize: 26,
                          fontWeight: 800,
                        }}
                      >
                        W
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: PRIMARY, marginBottom: 8 }}>
                        No workspaces yet
                      </div>
                      <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16, maxWidth: 460, marginInline: "auto", lineHeight: 1.7 }}>
                        Create your first workspace to start organizing modules, team members, and workspace-level activity.
                      </div>
                      <button
                        className="btn-primary"
                        onClick={onCreate}
                        style={{
                          borderRadius: 999,
                          padding: "10px 20px",
                          backgroundColor: PRIMARY,
                          color: "#ffffff",
                          border: "none",
                          fontWeight: 600,
                        }}
                      >
                        Create workspace
                      </button>
                    </section>
                  ) : (
                    <section style={{ display: "grid", gap: 14 }}>
                      {list.map((w, index) => (
                        <div
                          key={w.id}
                          className="card"
                          style={{
                            padding: 20,
                            borderRadius: 22,
                            border: "1px solid rgba(15, 66, 88, 0.08)",
                            background: "linear-gradient(180deg, rgba(255,255,255,1), rgba(248,250,253,0.98))",
                            boxShadow: "0 12px 28px rgba(15, 66, 88, 0.08)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 16,
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ display: "flex", gap: 16, alignItems: "center", minWidth: 240, flex: "1 1 320px" }}>
                              <div
                                style={{
                                  width: 54,
                                  height: 54,
                                  borderRadius: 18,
                                  display: "grid",
                                  placeItems: "center",
                                  background: "linear-gradient(135deg, rgba(15,66,88,0.14), rgba(72,177,217,0.18))",
                                  color: PRIMARY,
                                  fontWeight: 800,
                                  fontSize: 18,
                                  flexShrink: 0,
                                }}
                              >
                                {(w.name || "W").trim().charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                                  <div
                                    style={{
                                      fontWeight: 800,
                                      fontSize: 20,
                                      color: "#0f172a",
                                    }}
                                  >
                                    {w.name || "Untitled workspace"}
                                  </div>
                                  <div
                                    style={{
                                      padding: "6px 10px",
                                      borderRadius: 999,
                                      background: "rgba(69,154,208,0.08)",
                                      border: "1px solid rgba(69,154,208,0.14)",
                                      color: PRIMARY,
                                      fontSize: 12,
                                      fontWeight: 700,
                                      textTransform: "uppercase",
                                      letterSpacing: "0.05em",
                                    }}
                                  >
                                    Workspace {index + 1}
                                  </div>
                                </div>
                                <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
                                  Share ID:{" "}
                                  <strong style={{ color: PRIMARY, fontWeight: 800 }}>
                                    {w.shareId || "not set"}
                                  </strong>
                                </div>
                              </div>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                gap: 10,
                                alignItems: "center",
                                flexWrap: "wrap",
                                justifyContent: "flex-end",
                              }}
                            >
                              <button
                                className="btn-primary btn-sm"
                                onClick={() => onCopyId(w.shareId)}
                                style={{
                                  padding: "9px 16px",
                                  borderRadius: 999,
                                  backgroundColor: PRIMARY,
                                  color: "#ffffff",
                                  border: "none",
                                  fontSize: 13,
                                  fontWeight: 700,
                                  boxShadow: "0 10px 22px rgba(15, 66, 88, 0.24)",
                                }}
                              >
                                Copy ID
                              </button>
                              <button
                                className="btn-ghost btn-sm"
                                onClick={() => onView(w.id)}
                                style={{
                                  padding: "9px 16px",
                                  borderRadius: 999,
                                  border: "1px solid rgba(15, 66, 88, 0.18)",
                                  backgroundColor: "#ffffff",
                                  color: PRIMARY,
                                  fontSize: 13,
                                  fontWeight: 700,
                                }}
                              >
                                View
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </section>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      </main>
    </Layout>
  );
}
