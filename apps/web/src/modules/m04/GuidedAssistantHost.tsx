import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
  needsAdminForward: boolean;
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
  const [topicsExpanded, setTopicsExpanded] = useState(true);
  const messagesRef = useRef<HTMLDivElement | null>(null);

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
    setTopicsExpanded(true);
  }, [page?.workspaceId, page?.pageKey]);

  useEffect(() => {
    if (!page) return;
    void loadAssistant();
  }, [page?.workspaceId, page?.pageKey]);

  async function loadAssistant(showLoading = true) {
    if (!page) return;
    if (showLoading) setLoading(true);
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
      if (showLoading) setLoading(false);
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

  useEffect(() => {
    if (!page || !bootstrap?.isAdmin) return;
    const interval = window.setInterval(() => {
      void loadAssistant(false);
    }, 10000);
    const onFocus = () => void loadAssistant(false);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [page?.workspaceId, page?.pageKey, bootstrap?.isAdmin]);

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
  const quickStartFaqs = useMemo(() => {
    if (showingFollowUps) return [];

    const nextIds = visibleFaqs
      .flatMap((faq) => faq.followUpIds || [])
      .filter((id, index, items) => items.indexOf(id) === index)
      .slice(0, 8);

    return nextIds
      .map((id) => faqLookup.get(id))
      .filter(Boolean) as AssistantFaq[];
  }, [faqLookup, showingFollowUps, visibleFaqs]);
  const matchedDraftFaqs = useMemo(() => {
    const query = draft.trim().toLowerCase();
    if (query.length < 2) return [];

    const terms = query.split(/\s+/).filter(Boolean);
    const candidates = (bootstrap?.page.faqs || [])
      .filter((faq) => faq.id !== "conversation-restart")
      .map((faq) => {
        const haystack = `${faq.label} ${faq.answer}`.toLowerCase();
        let score = 0;

        for (const term of terms) {
          if (faq.label.toLowerCase().includes(term)) score += 5;
          if (haystack.includes(term)) score += 2;
        }

        if (faq.label.toLowerCase().includes(query)) score += 8;
        if (haystack.includes(query)) score += 3;

        return { faq, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((item) => item.faq);

    return candidates;
  }, [bootstrap?.page.faqs, draft]);
  const adminInboxCount = bootstrap?.adminInbox.length || 0;

  useEffect(() => {
    if (messages.length > 0) setTopicsExpanded(false);
  }, [messages.length]);

  useEffect(() => {
    if (!open) return;
    const container = messagesRef.current;
    if (!container) return;
    window.requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [open, messages.length, bootstrap?.conversation.needsAdminForward, bootstrap?.conversation.hasPendingAdminReply, replyConversationId]);

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

  async function forwardToAdmin() {
    if (!page || !bootstrap?.conversation.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ conversation: ConversationPayload }>("/m04/assistant/forward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: page.workspaceId,
          conversationId: bootstrap.conversation.id,
        }),
      });
      setBootstrap((prev) => prev ? { ...prev, conversation: data.conversation } : prev);
      await loadAssistant();
    } catch (forwardError) {
      setError(forwardError instanceof Error ? forwardError.message : "Failed to forward question to admin");
    } finally {
      setLoading(false);
    }
  }

  async function dismissForwardPrompt() {
    if (!page || !bootstrap?.conversation.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ conversation: ConversationPayload }>("/m04/assistant/dismiss-forward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: page.workspaceId,
          conversationId: bootstrap.conversation.id,
        }),
      });
      setBootstrap((prev) => prev ? { ...prev, conversation: data.conversation } : prev);
    } catch (dismissError) {
      setError(dismissError instanceof Error ? dismissError.message : "Failed to dismiss admin forward");
    } finally {
      setLoading(false);
    }
  }

  async function clearChat() {
    if (!page) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ conversation: ConversationPayload }>("/m04/assistant/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: page.workspaceId,
          pageKey: page.pageKey,
        }),
      });
      setBootstrap((prev) => prev ? { ...prev, conversation: data.conversation } : prev);
      setDraft("");
      setReplyDraft("");
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Failed to clear chat");
    } finally {
      setLoading(false);
    }
  }

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
            width: 68,
            height: 68,
            borderRadius: 20,
            border: "none",
            cursor: "pointer",
            overflow: "visible",
            background: "linear-gradient(135deg, rgba(15,66,88,1) 0%, rgba(72,177,217,0.94) 100%)",
            color: "#fff",
            boxShadow: "0 18px 34px rgba(15,66,88,0.26)",
          }}
          aria-label="Open guided assistant"
        >
          <ChatGlyph />
          {bootstrap?.isAdmin && adminInboxCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                minWidth: 20,
                height: 20,
                borderRadius: 999,
                background: "#BE123C",
                color: "#fff",
                fontSize: 11,
                fontWeight: 800,
                display: "grid",
                placeItems: "center",
                padding: "0 6px",
                border: "2px solid #fff",
              }}
            >
              {adminInboxCount}
            </span>
          )}
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
              <div style={{ marginTop: 6, fontSize: 26, fontWeight: 900, color: "#0B2540" }}>
                {bootstrap?.page.title || page.title}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {bootstrap?.isAdmin && adminInboxCount > 0 && (
                <div
                  style={{
                    borderRadius: 999,
                    padding: "6px 10px",
                    background: "rgba(190,24,93,0.10)",
                    color: "#9D174D",
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  {adminInboxCount} pending
                </div>
              )}
              <button type="button" onClick={() => void sendFaq("conversation-restart")} style={toolbarButtonStyle}>
                Start over
              </button>
              <button type="button" onClick={() => void clearChat()} style={toolbarButtonStyle}>
                Clear chat
              </button>
              <button type="button" onClick={() => setOpen(false)} style={toolbarButtonStyle}>Close</button>
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 13, color: "#415274", lineHeight: 1.6 }}>
            {bootstrap?.page.intro || "Choose a guided topic or type your own question below."}
          </div>
        </div>

        <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid rgba(15,66,88,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#0B2540" }}>
              {showingFollowUps ? "Next options" : "Suggested questions"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {showingFollowUps && (
                <button
                  type="button"
                  onClick={() => void sendFaq("conversation-restart")}
                  style={{ ...miniButtonStyle, fontSize: 11 }}
                >
                  Start over
                </button>
              )}
              <button
                type="button"
                onClick={() => setTopicsExpanded((value) => !value)}
                style={{ ...miniButtonStyle, fontSize: 11 }}
              >
                {topicsExpanded ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          {topicsExpanded ? (
            <div
              style={{
                maxHeight: 190,
                overflowY: "auto",
                paddingRight: 4,
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {visibleFaqs.map((faq) => (
                  <button
                    key={faq.id}
                    type="button"
                    onClick={() => void sendFaq(faq.id)}
                    style={{
                      ...topicButtonStyle,
                      cursor: "pointer",
                    }}
                  >
                    {faq.label}
                  </button>
                ))}
              </div>
              {!showingFollowUps && quickStartFaqs.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#667085", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                    Quick Starts
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {quickStartFaqs.map((faq) => (
                      <button
                        key={faq.id}
                        type="button"
                        onClick={() => void sendFaq(faq.id)}
                        style={{
                          ...secondaryTopicButtonStyle,
                          cursor: "pointer",
                        }}
                      >
                        {faq.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#667085", lineHeight: 1.6 }}>
              {visibleFaqs.length} guided questions available here. Open this panel when you want ready-made prompts, or type below to see closest matches.
            </div>
          )}
        </div>

        <div ref={messagesRef} style={{ overflowY: "auto", padding: "18px 18px 14px", display: "grid", gap: 12 }}>
          {loading && messages.length === 0 && <div style={{ fontSize: 12, color: "#415274" }}>Loading assistant…</div>}
          {error && <div style={{ fontSize: 12, color: "#b42318" }}>{error}</div>}
          {messages.length === 0 && !loading && (
            <div style={{ fontSize: 12, color: "#667085", lineHeight: 1.7 }}>
              No messages yet. Pick a topic above to start the guided conversation, or type your own question below.
            </div>
          )}
          {!!bootstrap?.conversation.hasPendingAdminReply && (
            <div
              style={{
                borderRadius: 14,
                padding: 12,
                background: "rgba(245,158,11,0.10)",
                border: "1px solid rgba(245,158,11,0.18)",
                color: "#92400E",
                fontSize: 12,
                lineHeight: 1.7,
              }}
            >
              Your question has been sent to an admin. Their reply will appear here when available.
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
          {!!bootstrap?.conversation.needsAdminForward && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "86%",
                  borderRadius: 18,
                  border: "1px solid rgba(15,66,88,0.12)",
                  background: "#ffffff",
                  padding: 14,
                  display: "grid",
                  gap: 10,
                  boxShadow: "0 8px 18px rgba(13,30,60,0.05)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: "#0B2540" }}>
                  This question needs admin help
                </div>
                <div style={{ fontSize: 12, color: "#415274", lineHeight: 1.7 }}>
                  I do not have a reliable guided answer for your last question. If you want, I can forward it to an admin and their reply will appear here in this conversation.
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => void dismissForwardPrompt()} disabled={loading} style={secondaryActionButtonStyle}>
                    Not now
                  </button>
                  <button type="button" onClick={() => void forwardToAdmin()} disabled={loading} style={primaryActionButtonStyle}>
                    Send question to admin
                  </button>
                </div>
              </div>
            </div>
          )}

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
                          <button type="button" onClick={() => void sendAdminReply()} style={primaryActionButtonStyle}>
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
          {matchedDraftFaqs.length > 0 && (
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#667085", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Closest guided matches
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {matchedDraftFaqs.map((faq) => (
                  <button
                    key={faq.id}
                    type="button"
                    onClick={() => {
                      setDraft("");
                      void sendFaq(faq.id);
                    }}
                    style={{
                      ...secondaryTopicButtonStyle,
                      cursor: "pointer",
                    }}
                  >
                    {faq.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 11, color: "#667085" }}>
              Type a few keywords to see the closest guided matches. If nothing fits, send the question normally and the assistant will still try to answer it.
            </div>
            <button type="button" onClick={() => void submitQuestion()} disabled={!draft.trim() || loading} style={sendButtonStyle(!draft.trim() || loading)}>
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
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 8.5C6 6.57 7.57 5 9.5 5H14.5C16.43 5 18 6.57 18 8.5V12.5C18 14.43 16.43 16 14.5 16H11.8L8.2 19V16H9.5C7.57 16 6 14.43 6 12.5V8.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 9.75H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 12.25H13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const toolbarButtonStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(15,66,88,0.14)",
  padding: "10px 14px",
  background: "linear-gradient(180deg, #ffffff 0%, #eef5fb 100%)",
  color: "#0B3C5D",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(13,30,60,0.06)",
};

const miniButtonStyle: CSSProperties = {
  borderRadius: 999,
  border: "1px solid rgba(15,66,88,0.14)",
  padding: "7px 12px",
  background: "#f7fbff",
  color: "#0B3C5D",
  fontWeight: 700,
  cursor: "pointer",
};

const topicButtonStyle: CSSProperties = {
  borderRadius: 999,
  border: "1px solid rgba(15,66,88,0.12)",
  padding: "10px 14px",
  background: "linear-gradient(180deg, #ffffff 0%, #f2f8fc 100%)",
  color: "#0f4258",
  fontSize: 12,
  fontWeight: 800,
  boxShadow: "0 8px 16px rgba(13,30,60,0.05)",
};

const secondaryTopicButtonStyle: CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(15,66,88,0.10)",
  padding: "9px 12px",
  background: "#ffffff",
  color: "#0f4258",
  fontSize: 12,
  fontWeight: 700,
  boxShadow: "0 6px 14px rgba(13,30,60,0.04)",
};

const secondaryActionButtonStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(15,66,88,0.14)",
  padding: "10px 14px",
  background: "#ffffff",
  color: "#0B3C5D",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const primaryActionButtonStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(10,59,92,0.12)",
  padding: "10px 15px",
  background: "linear-gradient(135deg, #0f4258 0%, #1e6c88 100%)",
  color: "#ffffff",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 12px 22px rgba(15,66,88,0.18)",
};

function sendButtonStyle(disabled: boolean): CSSProperties {
  return {
    borderRadius: 14,
    border: "none",
    minWidth: 92,
    padding: "12px 18px",
    background: disabled ? "linear-gradient(135deg, #a8bfcc 0%, #96aebb 100%)" : "linear-gradient(135deg, #0f4258 0%, #195d79 100%)",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "0 14px 24px rgba(15,66,88,0.20)",
  };
}
