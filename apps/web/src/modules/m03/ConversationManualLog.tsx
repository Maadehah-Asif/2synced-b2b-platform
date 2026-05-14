import type { FormEvent } from "react";
import { useState } from "react";
import Layout from "../../components/Layout";
import ModuleBackButton from "../../components/ModuleBackButton";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function getWorkspaceId() {
  const hash = window.location.hash || "";
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
  return m ? m[1] : null;
}

type ManualChannel = "email" | "whatsapp" | "call" | "meeting" | "note";
type Direction = "inbound" | "outbound";

export default function ConversationManualLog() {
  const workspaceId = getWorkspaceId();

  const [channel, setChannel] = useState<ManualChannel>("email");
  
  // Common fields
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [occurredAt, setOccurredAt] = useState(
    new Date().toISOString().slice(0, 16) // datetime-local default
  );
  const [bodyText, setBodyText] = useState("");
  const [leadId, setLeadId] = useState("");
  const [dealId, setDealId] = useState("");

  // Email-specific
  const [emailSubject, setEmailSubject] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [toEmails, setToEmails] = useState("");
  const [emailDirection, setEmailDirection] = useState<Direction>("outbound");

  // WhatsApp-specific
  const [whatsappContactName, setWhatsappContactName] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [whatsappDirection, setWhatsappDirection] = useState<Direction>("outbound");
  const [whatsappMessage, setWhatsappMessage] = useState("");

  // Call-specific
  const [callerName, setCallerName] = useState("");
  const [callDirection, setCallDirection] = useState<Direction>("outbound");
  const [callStart, setCallStart] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [callEnd, setCallEnd] = useState("");
  const [callNotes, setCallNotes] = useState("");

  // Meeting-specific
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingStart, setMeetingStart] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [meetingEnd, setMeetingEnd] = useState("");
  const [meetingParticipants, setMeetingParticipants] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");

  // Note-specific
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteDate, setNoteDate] = useState(
    new Date().toISOString().slice(0, 16)
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createdThreadId, setCreatedThreadId] = useState<string | null>(null);

  function resetForm() {
    setCompanyName("");
    setContactName("");
    setBodyText("");
    setEmailSubject("");
    setFromName("");
    setFromEmail("");
    setToEmails("");
    setWhatsappContactName("");
    setWhatsappPhone("");
    setWhatsappMessage("");
    setCallerName("");
    setCallNotes("");
    setMeetingTitle("");
    setMeetingParticipants("");
    setMeetingNotes("");
    setNoteTitle("");
    setNoteBody("");
    setLeadId("");
    setDealId("");
    setError(null);
    setSuccessMessage(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setCreatedThreadId(null);

    if (!workspaceId) {
      setError("Workspace id missing in URL.");
      return;
    }

    // Validate company name is required
    if (!companyName.trim()) {
      setError("Company name is required.");
      return;
    }

    // Channel-specific validation
    let isValid = false;
    let payload: any = {
      channel,
      companyName: companyName.trim(),
      occurredAt: new Date(occurredAt).toISOString(),
    };

    if (channel === "email") {
      if (!emailSubject.trim() || !bodyText.trim() || !fromName.trim()) {
        setError("Subject, message body, and from name are required for email.");
        return;
      }
      isValid = true;
      payload.subject = emailSubject.trim();
      payload.body = bodyText.trim();
      payload.contactName = fromName.trim();
      payload.contactEmail = fromEmail.trim() || undefined;
      payload.toEmails = toEmails.trim() || undefined;
      payload.direction = emailDirection;
      payload.participants = [fromEmail.trim()].filter(Boolean);
    } else if (channel === "whatsapp") {
      if (!whatsappMessage.trim() || !whatsappContactName.trim()) {
        setError("Message text and contact name are required for WhatsApp.");
        return;
      }
      isValid = true;
      payload.subject = `WhatsApp conversation with ${whatsappContactName}`;
      payload.body = whatsappMessage.trim();
      payload.contactName = whatsappContactName.trim();
      payload.contactPhone = whatsappPhone.trim() || undefined;
      payload.direction = whatsappDirection;
    } else if (channel === "call") {
      if (!callNotes.trim() || !callerName.trim()) {
        setError("Call notes and caller name are required.");
        return;
      }
      isValid = true;
      payload.subject = `Call with ${callerName}`;
      payload.body = callNotes.trim();
      payload.contactName = callerName.trim();
      payload.direction = callDirection;
      payload.occurredAt = new Date(callStart).toISOString();
      if (callEnd) {
        payload.endTime = new Date(callEnd).toISOString();
      }
    } else if (channel === "meeting") {
      if (!meetingNotes.trim() || !meetingTitle.trim()) {
        setError("Meeting title and notes are required.");
        return;
      }
      isValid = true;
      payload.subject = meetingTitle.trim();
      payload.body = meetingNotes.trim();
      payload.contactName = contactName.trim() || undefined;
      payload.participants = meetingParticipants.split(",").map((p) => p.trim()).filter(Boolean);
      payload.occurredAt = new Date(meetingStart).toISOString();
      if (meetingEnd) {
        payload.endTime = new Date(meetingEnd).toISOString();
      }
      // Meetings might not have direction, default to outbound
      payload.direction = "outbound";
    } else if (channel === "note") {
      if (!noteBody.trim()) {
        setError("Note body is required.");
        return;
      }
      isValid = true;
      payload.subject = noteTitle.trim() || "Internal note";
      payload.body = noteBody.trim();
      payload.occurredAt = new Date(noteDate).toISOString();
      // Notes don't have direction
      payload.direction = "outbound";
    }

    if (!isValid) {
      return;
    }

    // Only send leadId / dealId if user filled them
    if (leadId.trim()) payload.leadId = leadId.trim();
    if (dealId.trim()) payload.dealId = dealId.trim();

    const token = localStorage.getItem("token");
    if (!token) {
      setError("You are not logged in. Please log in again.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    setCreatedThreadId(null);

    try {
      const res = await fetch(`${API_URL}/m03/conversations/manual-log?workspaceId=${encodeURIComponent(workspaceId)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg = data?.error || data?.message || `Failed to save conversation. Please try again. (Status: ${res.status})`;
        setError(errorMsg);
        setSuccessMessage(null);
        return;
      }

      setSuccessMessage("Conversation saved successfully. You can now run analysis.");
      setError(null);
      if (data.thread?._id) {
        setCreatedThreadId(data.thread._id);
      }
      // Optionally clear the form fields here
      resetForm();
    } catch (err: any) {
      setError("Unexpected error while saving conversation.");
      setSuccessMessage(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <main className="page-root">
        {/* Header */}
        <div className="page-header">
          <ModuleBackButton toSuffix="/m03" />
          <div className="page-title-block">
            <h1 className="page-title">Log conversation manually</h1>
            <p className="page-subtitle">
              Capture a quick summary of a call, WhatsApp chat, or ad-hoc email so
              Conversation Intelligence can still extract entities, compute sentiment, and estimate
              deal health.
            </p>
          </div>
        </div>

        {/* Content */}
        <section className="page-section" style={{ maxWidth: 800 }}>
          {/* Status messages - show right after header */}
          {error && (
            <div
              className="alert alert-error"
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
          {successMessage && (
            <div
              className="alert alert-success"
              style={{
                marginBottom: 16,
                padding: "12px 16px",
                borderRadius: 6,
                background: "#ECFDF3",
                color: "#166534",
                fontSize: 13,
                border: "1px solid #86EFAC",
              }}
            >
              {successMessage}
              {createdThreadId && (
                <span style={{ display: "block", marginTop: 6, fontSize: 12 }}>
                  Thread ID:{" "}
                  <code style={{ fontSize: 11, background: "rgba(0,0,0,0.05)", padding: "2px 6px", borderRadius: 3 }}>
                    {createdThreadId}
                  </code>
                </span>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="card" style={{ padding: 16 }}>
            {/* Channel selector */}
            <div style={{ marginBottom: 16 }}>
              <label className="muted" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
                Channel
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(["email", "whatsapp", "call", "meeting", "note"] as ManualChannel[]).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => {
                      setChannel(ch);
                      resetForm();
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid #D1D5DB",
                      background: channel === ch ? "#3B82F6" : "white",
                      color: channel === ch ? "white" : "#374151",
                      fontSize: 13,
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    {ch === "whatsapp" ? "WhatsApp" : ch === "note" ? "Note" : ch}
                  </button>
                ))}
              </div>
            </div>

            {/* Company name - required for all channels */}
            <div style={{ marginBottom: 16 }}>
              <label className="muted" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
                Company name<span style={{ color: "#DC2626" }}> *</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="input"
                placeholder="ACME Corp"
                required
              />
              <div className="muted" style={{ marginTop: 4, fontSize: 11 }}>
                The company this conversation belongs to. Will be created or matched automatically.
              </div>
            </div>

            {/* Email channel fields */}
            {channel === "email" && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Subject<span style={{ color: "#DC2626" }}> *</span>
                  </label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="input"
                    placeholder="Intro: ACME <> 2Synced"
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <label className="muted" style={{ fontSize: 12 }}>
                      From name<span style={{ color: "#DC2626" }}> *</span>
                    </label>
                    <input
                      type="text"
                      value={fromName}
                      onChange={(e) => setFromName(e.target.value)}
                      className="input"
                      placeholder="Your name or prospect name"
                    />
                  </div>
                  <div>
                    <label className="muted" style={{ fontSize: 12 }}>
                      From email
                    </label>
                    <input
                      type="email"
                      value={fromEmail}
                      onChange={(e) => setFromEmail(e.target.value)}
                      className="input"
                      placeholder="from@example.com"
                    />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label className="muted" style={{ fontSize: 12 }}>
                    To email(s) (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={toEmails}
                    onChange={(e) => setToEmails(e.target.value)}
                    className="input"
                    placeholder="to@example.com, cc@example.com"
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Direction
                  </label>
                  <select
                    value={emailDirection}
                    onChange={(e) => setEmailDirection(e.target.value as Direction)}
                    className="input"
                  >
                    <option value="outbound">We emailed prospect</option>
                    <option value="inbound">Prospect emailed us</option>
                  </select>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Message body<span style={{ color: "#DC2626" }}> *</span>
                  </label>
                  <textarea
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    className="input"
                    rows={6}
                    placeholder="Email content..."
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Date/time
                  </label>
                  <input
                    type="datetime-local"
                    value={occurredAt}
                    onChange={(e) => setOccurredAt(e.target.value)}
                    className="input"
                  />
                </div>
              </>
            )}

            {/* WhatsApp channel fields */}
            {channel === "whatsapp" && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Contact name<span style={{ color: "#DC2626" }}> *</span>
                  </label>
                  <input
                    type="text"
                    value={whatsappContactName}
                    onChange={(e) => setWhatsappContactName(e.target.value)}
                    className="input"
                    placeholder="Contact name"
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Contact phone number
                  </label>
                  <input
                    type="text"
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                    className="input"
                    placeholder="+1234567890"
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Direction
                  </label>
                  <select
                    value={whatsappDirection}
                    onChange={(e) => setWhatsappDirection(e.target.value as Direction)}
                    className="input"
                  >
                    <option value="outbound">We replied</option>
                    <option value="inbound">Prospect sent a message</option>
                  </select>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Message text<span style={{ color: "#DC2626" }}> *</span>
                  </label>
                  <textarea
                    value={whatsappMessage}
                    onChange={(e) => setWhatsappMessage(e.target.value)}
                    className="input"
                    rows={6}
                    placeholder="Message content..."
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Date/time
                  </label>
                  <input
                    type="datetime-local"
                    value={occurredAt}
                    onChange={(e) => setOccurredAt(e.target.value)}
                    className="input"
                  />
                </div>
              </>
            )}

            {/* Call channel fields */}
            {channel === "call" && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Caller name<span style={{ color: "#DC2626" }}> *</span>
                  </label>
                  <input
                    type="text"
                    value={callerName}
                    onChange={(e) => setCallerName(e.target.value)}
                    className="input"
                    placeholder="Caller name"
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Direction
                  </label>
                  <select
                    value={callDirection}
                    onChange={(e) => setCallDirection(e.target.value as Direction)}
                    className="input"
                  >
                    <option value="outbound">Outbound call to prospect</option>
                    <option value="inbound">Inbound call from prospect</option>
                  </select>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <label className="muted" style={{ fontSize: 12 }}>
                      Call start time<span style={{ color: "#DC2626" }}> *</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={callStart}
                      onChange={(e) => setCallStart(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="muted" style={{ fontSize: 12 }}>
                      Call end time (optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={callEnd}
                      onChange={(e) => setCallEnd(e.target.value)}
                      className="input"
                    />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Call summary / notes<span style={{ color: "#DC2626" }}> *</span>
                  </label>
                  <textarea
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                    className="input"
                    rows={6}
                    placeholder="Call recap, key points discussed..."
                  />
                </div>
              </>
            )}

            {/* Meeting channel fields */}
            {channel === "meeting" && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Meeting title<span style={{ color: "#DC2626" }}> *</span>
                  </label>
                  <input
                    type="text"
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    className="input"
                    placeholder="Q4 Planning Discussion"
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Participants (comma-separated names/emails)
                  </label>
                  <input
                    type="text"
                    value={meetingParticipants}
                    onChange={(e) => setMeetingParticipants(e.target.value)}
                    className="input"
                    placeholder="John Doe, jane@acme.com"
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <label className="muted" style={{ fontSize: 12 }}>
                      Start time<span style={{ color: "#DC2626" }}> *</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={meetingStart}
                      onChange={(e) => setMeetingStart(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="muted" style={{ fontSize: 12 }}>
                      End time (optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={meetingEnd}
                      onChange={(e) => setMeetingEnd(e.target.value)}
                      className="input"
                    />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Meeting notes<span style={{ color: "#DC2626" }}> *</span>
                  </label>
                  <textarea
                    value={meetingNotes}
                    onChange={(e) => setMeetingNotes(e.target.value)}
                    className="input"
                    rows={6}
                    placeholder="Meeting notes, action items, decisions..."
                  />
                </div>
              </>
            )}

            {/* Note channel fields */}
            {channel === "note" && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Note title (optional)
                  </label>
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    className="input"
                    placeholder="Internal note"
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Note body<span style={{ color: "#DC2626" }}> *</span>
                  </label>
                  <textarea
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    className="input"
                    rows={6}
                    placeholder="Note content..."
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Note date
                  </label>
                  <input
                    type="datetime-local"
                    value={noteDate}
                    onChange={(e) => setNoteDate(e.target.value)}
                    className="input"
                  />
                </div>
              </>
            )}

            {/* Optional linkage to lead / deal */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <label className="muted" style={{ fontSize: 12 }}>
                  Lead ID (optional)
                </label>
                <input
                  type="text"
                  value={leadId}
                  onChange={(e) => setLeadId(e.target.value)}
                  className="input"
                  placeholder="Paste lead ObjectId if available"
                />
              </div>
              <div>
                <label className="muted" style={{ fontSize: 12 }}>
                  Deal ID (optional)
                </label>
                <input
                  type="text"
                  value={dealId}
                  onChange={(e) => setDealId(e.target.value)}
                  className="input"
                  placeholder="Paste deal ObjectId if available"
                />
              </div>
            </div>

            {/* Submit */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={resetForm}
              >
                Clear
              </button>
              <button
                type="submit"
                className="btn-primary btn-sm"
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Save conversation"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </Layout>
  );
}
