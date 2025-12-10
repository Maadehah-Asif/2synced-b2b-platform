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
      <div
        className="container-centered"
        style={{
          padding: "32px 16px",
        }}
      >
        <div
          className="card"
          style={{
            padding: 24,
            borderRadius: 24,
            maxWidth: 960,
            margin: "0 auto",
            boxShadow: "0 18px 45px rgba(15, 66, 88, 0.18)",
            background:
              "radial-gradient(circle at top left, #f0f7fb, #ffffff 45%, #f7fafc)",
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <button
                className="btn-ghost"
                onClick={onBack}
                style={{
                  borderRadius: 999,
                  border: `1px solid rgba(15, 66, 88, 0.15)`,
                  padding: "8px 16px",
                  fontWeight: 500,
                  color: PRIMARY,
                  backgroundColor: "#ffffff",
                }}
              >
                ← Back
              </button>
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 22,
                    color: PRIMARY,
                  }}
                >
                  Your Workspaces
                </h2>
                <div
                  style={{
                    fontSize: 13,
                    color: "rgba(15, 23, 42, 0.6)",
                    marginTop: 4,
                  }}
                >
                  You currently have{" "}
                  <strong>{list.length || 0}</strong>{" "}
                  workspace{list.length === 1 ? "" : "s"}.
                </div>
              </div>
            </div>

            {/* Clean pill button, no + icon */}
            <button
              className="btn-primary"
              onClick={onCreate}
              style={{
                borderRadius: 999,
                padding: "10px 22px",
                backgroundColor: PRIMARY,
                color: "#ffffff",
                fontWeight: 600,
                border: "none",
                boxShadow: "0 10px 25px rgba(15, 66, 88, 0.35)",
                fontSize: 14,
              }}
            >
              Create workspace
            </button>
          </div>

          {/* Status / error row */}
          {loading && (
            <div
              style={{
                marginTop: 16,
                fontSize: 14,
                color: "rgba(15, 23, 42, 0.7)",
              }}
            >
              Loading workspaces…
            </div>
          )}
          {error && (
            <div
              className="auth-error"
              style={{
                marginTop: 16,
              }}
            >
              {error}
            </div>
          )}

          {/* List */}
          {!loading && !error && (
            <>
              {list.length === 0 ? (
                <div
                  style={{
                    marginTop: 32,
                    padding: 24,
                    borderRadius: 18,
                    border: "1px dashed rgba(15, 66, 88, 0.25)",
                    backgroundColor: "rgba(240, 247, 251, 0.7)",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: PRIMARY,
                      marginBottom: 6,
                    }}
                  >
                    No workspaces yet
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "rgba(15, 23, 42, 0.7)",
                      marginBottom: 12,
                    }}
                  >
                    Create your first workspace to start tracking modules and
                    experiments.
                  </div>
                  <button
                    className="btn-primary"
                    onClick={onCreate}
                    style={{
                      borderRadius: 999,
                      padding: "8px 18px",
                      backgroundColor: PRIMARY,
                      color: "#ffffff",
                      border: "none",
                      fontWeight: 500,
                    }}
                  >
                    Create workspace
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    marginTop: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {list.map((w) => (
                    <div
                      key={w.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: 14,
                        borderRadius: 16,
                        border: "1px solid rgba(15, 66, 88, 0.08)",
                        background:
                          "linear-gradient(90deg, rgba(15,66,88,0.02), #ffffff)",
                        boxShadow: "0 6px 18px rgba(15, 66, 88, 0.06)",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 15,
                            color: "#0f172a",
                            marginBottom: 4,
                          }}
                        >
                          {w.name || "Untitled workspace"}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "rgba(15, 23, 42, 0.6)",
                          }}
                        >
                          Share ID:{" "}
                          <strong style={{ color: PRIMARY }}>
                            {w.shareId || "not set"}
                          </strong>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <button
                          className="btn-primary btn-sm"
                          onClick={() => onCopyId(w.shareId)}
                          style={{
                            padding: "6px 14px",
                            borderRadius: 999,
                            backgroundColor: PRIMARY,
                            color: "#ffffff",
                            border: "none",
                            fontSize: 13,
                            fontWeight: 500,
                            boxShadow: "0 8px 20px rgba(15, 66, 88, 0.3)",
                          }}
                        >
                          Copy ID
                        </button>
                        <button
                          className="btn-ghost btn-sm"
                          onClick={() => onView(w.id)}
                          style={{
                            padding: "6px 14px",
                            borderRadius: 999,
                            border: `1px solid rgba(15, 66, 88, 0.25)`,
                            backgroundColor: "#ffffff",
                            color: PRIMARY,
                            fontSize: 13,
                            fontWeight: 500,
                          }}
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
