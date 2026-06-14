/**
 * Module: Conversation Intelligence (m03)
 * Layer: Frontend
 * File: ConversationUpload.tsx
 * Purpose: Supports the C on ve rs at io nU pl oa d flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import type { FormEvent, ChangeEvent } from "react";
import { useState } from "react";
import Layout from "../../components/Layout";
import ModuleBackButton from "../../components/ModuleBackButton";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function getWorkspaceId() {
  const hash = window.location.hash || "";
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
  return m ? m[1] : null;
}

type ChannelOption = "email" | "whatsapp" | "call" | "meeting";

export default function ConversationUpload() {
  const workspaceId = getWorkspaceId();

  const [channel, setChannel] = useState<ChannelOption>("email");
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setError(null);
    setSuccess(null);
  }

  function getHelperText(): string {
    switch (channel) {
      case "email":
        return "CSV with one row per email: thread_key, sent_at, from_name, from_email, to_email, subject, body, direction, company (or company_name, account). Each row's company is used to tie the message to an account.";
      case "whatsapp":
        return "CSV with one row per message: thread_key, sent_at, sender_name, sender_phone, direction, message_text, company (or company_name, account).";
      case "call":
        return "CSV with call events: thread_key, call_start, call_end, caller_name, direction, notes, company (or company_name, account).";
      case "meeting":
        return "CSV with meeting notes: thread_key, meeting_start, meeting_end, participants, note_text, company (or company_name, account). Each row's company is used to tie the message to an account.";
      default:
        return "";
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!workspaceId) {
      setError("Workspace id missing in URL.");
      return;
    }
    if (!file) {
      setError("Please select a CSV file to upload.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setError("You must be logged in to import conversations.");
      return;
    }

    setRunning(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("channel", channel);

      // Include workspaceId in the URL query string so the middleware can extract it
      const res = await fetch(
        `${API_URL}/m03/upload-conversation-log?workspaceId=${encodeURIComponent(workspaceId)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            // DO NOT set Content-Type manually when using FormData - browser sets it automatically
          },
          body: form,
        }
      );

      const data = await res.json().catch(() => null);
      
      if (!res.ok) {
        // Handle 401/403 specifically
        if (res.status === 401 || res.status === 403) {
          setError(data?.error || "You are not authorized to perform this action. Please log in again.");
        } else {
          // Show error with details if available
          const errorMsg = data?.error || `Import failed with status ${res.status}`;
          const detailsMsg = data?.details ? ` ${data.details}` : "";
          setError(errorMsg + detailsMsg);
        }
        setSuccess(null);
        return;
      }

      // Success response: { status: "ok", message, threadsCreated, messagesCreated, channel }
      setSuccess(data?.message || `Conversation import started. Created ${data?.threadsCreated || 0} threads and ${data?.messagesCreated || 0} messages. You can now view threads on the Conversations page.`);
      setError(null);
      setFile(null);
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = "";
      }
    } catch (err: any) {
      setError(err?.message || "Unexpected error during upload.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Layout>
      <main className="page-root">
        {/* Header */}
        <div className="page-header">
          <ModuleBackButton toSuffix="/m03" />
          <div className="page-title-block">
            <h1 className="page-title">Upload email / CRM logs</h1>
            <p className="page-subtitle">
              Upload CSV files directly to import conversation threads and messages for analysis.
            </p>
          </div>
        </div>

        {/* Content */}
        <section className="page-section" style={{ maxWidth: 820 }}>
          {/* Errors */}
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
          {success && (
            <div
              style={{
                marginBottom: 12,
                padding: "8px 12px",
                borderRadius: 6,
                background: "#ECFDF3",
                color: "#166534",
                fontSize: 13,
              }}
            >
              {success}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="card" style={{ padding: 16 }}>
            {/* Channel selector */}
            <div style={{ marginBottom: 16 }}>
              <label className="muted" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
                Channel
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as ChannelOption)}
                className="input"
              >
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp / chat</option>
                <option value="call">Call logs</option>
                <option value="meeting">Meeting notes</option>
              </select>
            </div>

            {/* File input */}
            <div style={{ marginBottom: 16 }}>
              <label className="muted" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
                CSV File
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="input"
                style={{ padding: "6px 8px" }}
              />
              <div className="muted" style={{ marginTop: 4, fontSize: 11 }}>
                {getHelperText()}
              </div>
            </div>

            {/* Submit button */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="submit"
                className="btn-primary btn-sm"
                disabled={running || !file}
              >
                {running ? "Running import…" : "Run conversation import"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </Layout>
  );
}

