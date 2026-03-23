import { useState } from "react";
import Layout from "../../../components/Layout";
import "../auth/auth.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function validatePasswordLocal(password: string): string | null {
  if (!password || password.length < 12) return "Password must be at least 12 characters long.";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include at least one number.";
  if (!/[!@#$%^&*()_\-+={}\[\]|:;\"'<>,.?/~`]/.test(password)) return "Password must include at least one special character.";
  return null;
}

export default function Profile() {
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordError = validatePasswordLocal(newPass);
  const passwordsMatch = newPass === confirmPass;
  const validationItems = [
    "Minimum 12 characters",
    "At least one uppercase letter",
    "At least one lowercase letter",
    "At least one number",
    "At least one special character",
  ];

  async function onChange(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      setAttemptedSubmit(true);
      if (!newPass) throw new Error("New password is required.");
      if (!confirmPass) throw new Error("Please confirm your new password.");
      if (!passwordsMatch) throw new Error("Passwords do not match.");
      if (passwordError) throw new Error(passwordError);

      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword: newPass }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to change password");

      setMessage("Password changed successfully!");
      setNewPass("");
      setConfirmPass("");
      setAttemptedSubmit(false);
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  const onLogout = () => {
    localStorage.removeItem("token");
    window.location.hash = "#/login";
  };

  const onBack = () => {
    window.location.hash = "#/landing";
  };

  return (
    <Layout>
      <main
        className="page-root"
        style={{
          minHeight: "100%",
          background: "linear-gradient(180deg, #eef5fb 0%, #f7fbfe 26%, #fcfdff 100%)",
          padding: "28px 0 40px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 30,
            right: -100,
            width: 360,
            height: 360,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(72,177,217,0.18) 0%, rgba(72,177,217,0) 72%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px", display: "grid", gap: 18, position: "relative" }}>
          <section
            style={{
              borderRadius: 26,
              overflow: "hidden",
              background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(247,251,254,0.98) 100%)",
              border: "1px solid rgba(15,66,88,0.08)",
              boxShadow: "0 24px 60px rgba(13,30,60,0.08)",
              display: "flex",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                flex: "1 1 520px",
                padding: 28,
                background: "linear-gradient(135deg, rgba(18,59,87,0.98) 0%, rgba(15,66,88,0.94) 48%, rgba(72,177,217,0.24) 100%)",
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
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Account Settings
              </div>
              <h1 style={{ margin: "16px 0 8px", fontSize: 42, fontWeight: 900, lineHeight: 1.02, color: "#fff" }}>
                Profile
              </h1>
              <div style={{ color: "rgba(255,255,255,0.84)", fontSize: 15, lineHeight: 1.7, maxWidth: 540 }}>
                Update your password, keep your account secure, and manage your session from one clean control panel.
              </div>
            </div>

            <div
              style={{
                flex: "1 1 320px",
                padding: 28,
                display: "grid",
                gap: 14,
                alignContent: "center",
                background: "linear-gradient(180deg, rgba(255,255,255,1), rgba(244,249,253,0.96))",
              }}
            >
              <div
                style={{
                  padding: "16px 18px",
                  borderRadius: 18,
                  border: "1px solid rgba(15,66,88,0.08)",
                  background: "linear-gradient(180deg, rgba(255,255,255,1), rgba(236,247,249,0.96))",
                }}
              >
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", fontWeight: 700 }}>
                  Security
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)", marginTop: 8 }}>
                  Password Access
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={onBack}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 999,
                    background: "#ffffff",
                    border: "1px solid rgba(15,66,88,0.14)",
                    color: "var(--header-secondary)",
                    fontWeight: 700,
                    boxShadow: "0 10px 22px rgba(13,30,60,0.06)",
                  }}
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={onLogout}
                  className="btn-primary"
                  style={{
                    padding: "10px 18px",
                    borderRadius: 999,
                    minWidth: 110,
                    fontWeight: 800,
                  }}
                >
                  Logout
                </button>
              </div>
            </div>
          </section>

          <section
            style={{
              maxWidth: 720,
              margin: "0 auto",
              width: "100%",
              borderRadius: 26,
              background: "linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,253,0.98))",
              border: "1px solid rgba(15,66,88,0.08)",
              boxShadow: "0 20px 48px rgba(13,30,60,0.08)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: 22,
                background: "linear-gradient(135deg, rgba(18,59,87,0.96) 0%, rgba(15,66,88,0.90) 100%)",
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
                  background: "rgba(255,255,255,0.10)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Change Password
              </div>
              <h2 style={{ margin: "14px 0 6px", fontSize: 32, fontWeight: 900, color: "#fff" }}>Security Settings</h2>
              <div style={{ color: "rgba(255,255,255,0.82)", fontSize: 14, lineHeight: 1.7 }}>
                Use a strong password that matches the required security rules before submitting.
              </div>
            </div>

            <div style={{ padding: 22, display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18 }}>
              <form onSubmit={onChange} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: "var(--header-secondary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  New Password
                </label>
                <input
                  className="auth-input"
                  style={{ borderRadius: 14, padding: "13px 14px", border: "1px solid rgba(15,66,88,0.12)", background: "#ffffff", marginBottom: 0 }}
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Enter new password"
                />

                <label style={{ fontSize: 12, fontWeight: 800, color: "var(--header-secondary)", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 6 }}>
                  Confirm Password
                </label>
                <input
                  className="auth-input"
                  style={{ borderRadius: 14, padding: "13px 14px", border: "1px solid rgba(15,66,88,0.12)", background: "#ffffff", marginBottom: 0 }}
                  type="password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Confirm new password"
                />

                {attemptedSubmit && (!passwordsMatch || passwordError) && (
                  <div className="auth-error" style={{ marginTop: 4 }}>
                    {!passwordsMatch ? "Passwords do not match." : passwordError}
                  </div>
                )}

                {message && (
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      background: message.includes("successfully") ? "#e0f2fe" : "rgba(185,28,28,0.06)",
                      color: message.includes("successfully") ? "#0c4a6e" : "#b91c1c",
                      border: message.includes("successfully") ? "1px solid rgba(12,74,110,0.12)" : "1px solid rgba(185,28,28,0.18)",
                      fontSize: 14,
                      marginTop: 2,
                    }}
                  >
                    {message}
                  </div>
                )}

                <button className="btn-primary" disabled={loading} style={{ marginTop: 8, padding: "13px 20px", borderRadius: 14, fontSize: 15, fontWeight: 800 }}>
                  {loading ? "Changing..." : "Change Password"}
                </button>
              </form>

              <aside
                style={{
                  borderRadius: 20,
                  padding: 18,
                  background: "linear-gradient(180deg, rgba(242,247,251,0.96), rgba(255,255,255,1))",
                  border: "1px solid rgba(15,66,88,0.08)",
                  display: "grid",
                  alignContent: "start",
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--header-secondary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Password Rules
                </div>
                {validationItems.map((item) => (
                  <div
                    key={item}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      color: "var(--text-primary)",
                      fontSize: 13,
                      lineHeight: 1.6,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "var(--header-secondary)",
                        marginTop: 6,
                        flexShrink: 0,
                      }}
                    />
                    <span>{item}</span>
                  </div>
                ))}
              </aside>
            </div>
          </section>
        </div>
      </main>
    </Layout>
  );
}
