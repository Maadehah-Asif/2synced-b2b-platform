import { useState } from "react";
import Layout from "../../../components/Layout";
import "../auth/auth.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function validatePasswordLocal(password: string): string | null {
  if (!password || password.length < 12) return "Password must be at least 12 characters long.";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include at least one number.";
  if (!/[!@#$%^&*()_\-+={}\[\]|:;"'<>,.?/~`]/.test(password)) return "Password must include at least one special character.";
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
      <div
        style={{
          maxWidth: 520,
          margin: "40px auto",
          padding: "24px",
          borderRadius: 24,
          background: "linear-gradient(180deg, #ffffff, #f7fafc)",
          boxShadow: "0 20px 45px rgba(15, 66, 88, 0.15)",
        }}
      >
        {/* Header Row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2 style={{ margin: 0, color: "var(--header-secondary)", fontSize: 24 }}>Profile</h2>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onBack}
              style={{
                padding: "8px 18px",
                borderRadius: 999,
                background: "#ffffff",
                border: `1px solid var(--header-secondary, #0f4258)40`,
                color: "var(--header-secondary)",
                fontWeight: 500,
              }}
            >
              Back
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="btn-primary"
              style={{
                padding: "8px 18px",
                borderRadius: 999,
                minWidth: 100,
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={onChange} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: "var(--header-secondary)" }}>
            Change Password
          </label>

          {/* New password */}
          <input
            className="auth-input"
            style={{ borderRadius: 12, padding: "12px 14px", border: "1px solid rgba(15,66,88,0.12)", background: "#ffffff" }}
            type="password"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            placeholder="Enter new password"
          />

          <input
            className="auth-input"
            style={{ borderRadius: 12, padding: "12px 14px", border: "1px solid rgba(15,66,88,0.12)", background: "#ffffff" }}
            type="password"
            value={confirmPass}
            onChange={(e) => setConfirmPass(e.target.value)}
            placeholder="Confirm new password"
          />

          {/* Validation message(s) — shown after user attempts submit */}
          {attemptedSubmit && (!passwordsMatch || passwordError) && (
            <div style={{ color: "#b91c1c", fontSize: 13 }}>
              {!passwordsMatch ? "Passwords do not match." : passwordError}
            </div>
          )}

          {message && (
            <div style={{ padding: "10px 14px", borderRadius: 12, background: "#e0f2fe", color: "#0c4a6e", fontSize: 14, marginTop: 6 }}>
              {message}
            </div>
          )}

          <button className="btn-primary" disabled={loading} style={{ marginTop: 8, padding: "12px 20px", borderRadius: 999, fontSize: 15, fontWeight: 600 }}>
            {loading ? "Changing..." : "Change Password"}
          </button>
        </form>
      </div>
    </Layout>
  );
}
