import { useEffect, useMemo, useState } from "react";
import { getAssistantConfigFromHash, getAssistantPageTitle } from "./assistantConfig";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

type AssistantFaq = {
  id: string;
  label: string;
  answer: string;
  followUpIds?: string[];
};

type AssistantMessage = {
  id: string;
  sender: "user" | "assistant" | "admin";
  kind: string;
  text: string;
  faqId?: string | null;
  createdAt: string;
};

type ConversationPayload = {
  id: string;
  workspaceId: string;
  userId: string;
  pageKey: string;
  hasPendingAdminReply: boolean;
  messages: AssistantMessage[];
};

type AdminInboxItem = {
  id: string;
  pageKey: string;
  updatedAt: string;
  question: string;
  requester: {
    id: string;
    fullName?: string | null;
    email?: string | null;
  } | null;
};

type BootstrapPayload = {
  page: {
    title: string;
    intro: string;
    faqs: AssistantFaq[];
    rootFaqIds: string[];
  };
  isAdmin: boolean;
  role?: string | null;
  conversation: ConversationPayload;
  adminInbox: AdminInboxItem[];
};

function getAuthHeaders(extra: Record<string, string> = {}) {
  try {
    const token = localStorage.getItem("token");
    return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
  } catch {
    return extra;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...getAuthHeaders(init?.headers as Record<string, string> | undefined),
      ...(init?.headers || {}),
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || "request_failed");
  return json as T;
}

export default function GuidedAssistantHost() {
  const [hash, setHash] = useState<string>(() => window.location.hash || "");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [draft, setDraft] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const [replyConversationId, setReplyConversationId] = useState<string | null>(null);

  const page = useMemo(() => getAssistantConfigFromHash(hash), [hash]);

  useEffect(() => {
    const sync = () => setHash(window.location.hash || "");
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    setOpen(false);
    setBootstrap(null);
    setError(null);
    setDraft("");
    setReplyDraft("");
    setReplyConversationId(null);
  }, [page?.workspaceId, page?.pageKey]);

  async function loadAssistant() {
    if (!page) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        workspaceId: page.workspaceId,
        pageKey: page.pageKey,
      });
      const data = await apiFetch<BootstrapPayload>(`/m04/assistant?${query.toString()}`);
      setBootstrap(data);
      if (!replyConversationId && data.adminInbox.length > 0) setReplyConversationId(data.adminInbox[0].id);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load assistant");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open || !page) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams({
          workspaceId: page.workspaceId,
          pageKey: page.pageKey,
        });
        const data = await apiFetch<BootstrapPayload>(`/m04/assistant?${query.toString()}`);
        setBootstrap(data);
        if (!replyConversationId && data.adminInbox.length > 0) setReplyConversationId(data.adminInbox[0].id);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load assistant");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, page, replyConversationId]);

  async function sendFaq(faqId: string) {
    if (!page) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ conversation: ConversationPayload }>("/m04/assistant/faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: page.workspaceId,
          pageKey: page.pageKey,
          faqId,
        }),
      });
      setBootstrap((prev) => prev ? { ...prev, conversation: data.conversation } : prev);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to send FAQ");
    } finally {
      setLoading(false);
    }
  }

  async function submitQuestion() {
    if (!page || !draft.trim()) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ conversation: ConversationPayload }>("/m04/assistant/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: page.workspaceId,
          pageKey: page.pageKey,
          text: draft.trim(),
        }),
      });
      setBootstrap((prev) => prev ? { ...prev, conversation: data.conversation } : prev);
      setDraft("");
      await loadAssistant();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to submit question");
    } finally {
      setLoading(false);
    }
  }

  async function sendAdminReply() {
    if (!page || !replyConversationId || !replyDraft.trim()) return;
    setLoading(true);
    try {
      await apiFetch<{ conversation: ConversationPayload }>("/m04/assistant/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: page.workspaceId,
          conversationId: replyConversationId,
          text: replyDraft.trim(),
        }),
      });
      setReplyDraft("");
      await loadAssistant();
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : "Failed to send admin reply");
    } finally {
      setLoading(false);
    }
  }

  const messages = useMemo(() => bootstrap?.conversation.messages || [], [bootstrap]);
  const faqLookup = useMemo(() => new Map((bootstrap?.page.faqs || []).map((faq) => [faq.id, faq])), [bootstrap]);
  const lastFaqId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.faqId) return messages[index].faqId || null;
    }
    return null;
  }, [messages]);
  const currentFaqIds = useMemo(() => {
    const selected = lastFaqId ? faqLookup.get(lastFaqId) : null;
    if (selected?.followUpIds?.length) return selected.followUpIds;
    return bootstrap?.page.rootFaqIds || [];
  }, [bootstrap, faqLookup, lastFaqId]);
  const visibleFaqs = useMemo(
    () => currentFaqIds.map((id) => faqLookup.get(id)).filter(Boolean) as AssistantFaq[],
    [currentFaqIds, faqLookup],
  );
  const showingFollowUps = currentFaqIds.length > 0 && JSON.stringify(currentFaqIds) !== JSON.stringify(bootstrap?.page.rootFaqIds || []);

  if (!page) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            zIndex: 2100,
            width: 58,
            height: 58,
            borderRadius: 18,
            border: "none",
            cursor: "pointer",
            background: "linear-gradient(135deg, rgba(15,66,88,1) 0%, rgba(72,177,217,0.94) 100%)",
            color: "#fff",
            boxShadow: "0 18px 34px rgba(15,66,88,0.26)",
          }}
          aria-label="Open guided assistant"
        >
          <ChatGlyph />
        </button>
      )}

      <aside
        style={{
          position: "fixed",
          top: 78,
          right: 0,
          bottom: 0,
          width: 430,
          maxWidth: "92vw",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 220ms ease",
          zIndex: 2050,
          borderLeft: "1px solid rgba(15,66,88,0.10)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(246,249,252,0.98))",
          boxShadow: "-22px 0 38px rgba(13,30,60,0.10)",
          display: "grid",
          gridTemplateRows: "auto auto 1fr auto",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <div style={{ padding: "18px 20px 12px", borderBottom: "1px solid rgba(15,66,88,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0f4258" }}>
                Guided Assistant
              </div>
              <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#0B2540" }}>
                {bootstrap?.page.title || page.title}
              </div>
            </div>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Close</button>
          </div>
          <div style={{ marginTop: 10, fontSize: 13, color: "#415274", lineHeight: 1.6 }}>
            {bootstrap?.page.intro || "Choose a guided topic or type your own question below."}
          </div>
        </div>

        <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid rgba(15,66,88,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#0B2540" }}>
              {showingFollowUps ? "Next options" : "Choose a topic"}
            </div>
            {showingFollowUps && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => void sendFaq("conversation-restart")}
                style={{ fontSize: 11, padding: "6px 10px" }}
              >
                Start over
              </button>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {visibleFaqs.map((faq) => (
              <button
                key={faq.id}
                type="button"
                onClick={() => void sendFaq(faq.id)}
                style={{
                  borderRadius: 999,
                  border: "1px solid rgba(15,66,88,0.12)",
                  padding: "8px 12px",
                  background: "#fff",
                  color: "#0f4258",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {faq.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowY: "auto", padding: "18px 18px 14px", display: "grid", gap: 12 }}>
          {loading && messages.length === 0 && <div style={{ fontSize: 12, color: "#415274" }}>Loading assistant…</div>}
          {error && <div style={{ fontSize: 12, color: "#b42318" }}>{error}</div>}
          {messages.length === 0 && !loading && (
            <div style={{ fontSize: 12, color: "#667085", lineHeight: 1.7 }}>
              No messages yet. Pick a topic above to start the guided conversation, or type your own question below.
            </div>
          )}
          {messages.map((message) => {
            const isUser = message.sender === "user";
            return (
              <div
                key={message.id}
                style={{
                  display: "flex",
                  justifyContent: isUser ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "86%",
                    borderRadius: 18,
                    padding: "11px 13px",
                    background: isUser ? "linear-gradient(135deg, #0f4258 0%, #2d6f8a 100%)" : "#ffffff",
                    color: isUser ? "#fff" : "#17324d",
                    border: isUser ? "none" : "1px solid rgba(15,66,88,0.10)",
                    boxShadow: "0 8px 18px rgba(13,30,60,0.06)",
                  }}
                >
                  <div style={{ fontSize: 12, lineHeight: 1.7 }}>{message.text}</div>
                  <div style={{ marginTop: 6, fontSize: 10, opacity: 0.75 }}>
                    {new Date(message.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}

          {bootstrap?.isAdmin && bootstrap.adminInbox.length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 12, borderTop: "1px solid rgba(15,66,88,0.08)" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#0B2540", marginBottom: 10 }}>Admin inbox</div>
              <div style={{ display: "grid", gap: 10 }}>
                {bootstrap.adminInbox.map((item) => {
                  const selected = item.id === replyConversationId;
                  return (
                    <div key={item.id} style={{ borderRadius: 14, border: selected ? "1px solid rgba(15,66,88,0.22)" : "1px solid rgba(15,66,88,0.10)", background: "#fff", padding: 12 }}>
                      <button
                        type="button"
                        onClick={() => setReplyConversationId(item.id)}
                        style={{ background: "transparent", border: "none", padding: 0, width: "100%", textAlign: "left", cursor: "pointer" }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#0B2540" }}>
                          {item.requester?.fullName || item.requester?.email || "Workspace user"}
                        </div>
                        <div style={{ fontSize: 11, color: "#667085", marginTop: 4 }}>{getAssistantPageTitle(item.pageKey)}</div>
                        <div style={{ marginTop: 8, fontSize: 12, color: "#17324d", lineHeight: 1.6 }}>{item.question}</div>
                      </button>
                      {selected && (
                        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                          <textarea
                            value={replyDraft}
                            onChange={(event) => setReplyDraft(event.target.value)}
                            rows={3}
                            placeholder="Reply as admin"
                            style={{ width: "100%", resize: "vertical" }}
                          />
                          <button type="button" className="btn-primary" onClick={() => void sendAdminReply()}>
                            Send reply
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: 16, borderTop: "1px solid rgba(15,66,88,0.08)", background: "rgba(255,255,255,0.9)" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#0B2540", marginBottom: 8 }}>Ask your own question</div>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            placeholder="Type a question if you want help beyond the guided options."
            style={{ width: "100%", resize: "vertical" }}
          />
          <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 11, color: "#667085" }}>
              Clear questions may be answered automatically. Unclear ones can still be sent for admin follow-up.
            </div>
            <button type="button" className="btn-primary" onClick={() => void submitQuestion()} disabled={!draft.trim() || loading}>
              Send
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function ChatGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 8.5C6 6.57 7.57 5 9.5 5H14.5C16.43 5 18 6.57 18 8.5V12.5C18 14.43 16.43 16 14.5 16H11.8L8.2 19V16H9.5C7.57 16 6 14.43 6 12.5V8.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 9.75H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 12.25H13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
