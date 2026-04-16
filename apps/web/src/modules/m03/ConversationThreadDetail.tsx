
import { useEffect, useState, type ReactNode } from "react";
import Layout from "../../components/Layout";
import ModuleBackButton from "../../components/ModuleBackButton";
import "./m03-analysis.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function parseWorkspaceAndThread() {
  const hash = window.location.hash || "";
  const m = hash.match(/#\/workspace\/(.+?)\/m03\/conversations\/([^/]+)/);
  if (!m) {
    return { workspaceId: null as string | null, threadId: null as string | null };
  }
  return { workspaceId: m[1], threadId: m[2] };
}

type Channel = "email" | "whatsapp" | "call" | "meeting" | "note" | "other";
type Direction = "inbound" | "outbound";
type HealthBand = "healthy" | "neutral" | "at_risk";

interface ThreadShape {
  _id: string;
  subject: string;
  channel: Channel;
  messageCount?: number;
  firstMessageAt?: string;
  lastMessageAt?: string;
  companyName?: string;
  companyDomain?: string;
  contactName?: string;
  contactRole?: string;
  leadName?: string;
}

interface MessageShape {
  _id: string;
  direction: Direction;
  senderName?: string;
  senderEmail?: string;
  bodyText?: string;
  sentAt?: string;
}

interface EntityShape {
  _id: string;
  type: string;
  value: string;
  confidence?: number;
  sourceMessageId?: string;
  sourceSnippet?: string;
}

interface SentimentShape {
  _id: string;
  messageId?: string;
  label?: string;
  score?: number;
}

interface HealthShape {
  _id: string;
  score?: number;
  band?: HealthBand;
  trend?: "improving" | "worsening" | "flat";
  signals?: Record<string, any>;
  lastComputedAt?: string;
}

interface FollowUpShape {
  _id: string;
  status: "pending" | "snoozed" | "done" | "cancelled";
  dueAt?: string;
  snoozedUntil?: string;
  reason?: string;
  createdAt?: string;
}

interface FollowUpIntentShape {
  label: string;
  confidence: number;
  suggestedMessage: string;
}

interface ConversationDetailResponse {
  thread: ThreadShape;
  messages: MessageShape[];
  entities: EntityShape[];
  sentiments: SentimentShape[];
  latestHealth?: HealthShape | null;
  followUps?: FollowUpShape[];
  followUpIntent?: FollowUpIntentShape | null;
}

interface ReadableSignal {
  label: string;
  value: string;
  tone?: "positive" | "warning" | "neutral";
  detail: string;
}

interface InsightSection {
  label: string;
  items: EntityShape[];
  empty: string;
}

export default function ConversationThreadDetail() {
  const { workspaceId, threadId } = parseWorkspaceAndThread();

  const [data, setData] = useState<ConversationDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "prompt" | "context">("idle");

  async function loadDetail() {
    if (!workspaceId || !threadId) {
      setError("Invalid URL: workspace or thread id is missing.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("You are not logged in.");
        setLoading(false);
        return;
      }

      const res = await fetch(
        `${API_URL}/m03/conversations/${threadId}?workspaceId=${encodeURIComponent(workspaceId)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const json = (await res.json()) as ConversationDetailResponse | any;
      if (!res.ok) {
        setError(json?.error || "Failed to load conversation.");
        setData(null);
      } else {
        setData(json as ConversationDetailResponse);
      }
    } catch (err: any) {
      setError(err?.message || "Unexpected error while loading conversation.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetail();
  }, [workspaceId, threadId]);

  async function handleRunAnalysis() {
    if (!threadId) return;
    setAnalysisMessage(null);
    setAnalysisRunning(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("You are not logged in.");
        setAnalysisRunning(false);
        return;
      }

      const res = await fetch(
        `${API_URL}/m03/conversations/${encodeURIComponent(String(threadId))}/analyze?workspaceId=${encodeURIComponent(String(workspaceId))}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Failed to run analysis.");
      } else {
        setAnalysisMessage("Analysis completed. Refreshed health and follow-ups.");
        await loadDetail();
      }
    } catch (err: any) {
      setError(err?.message || "Unexpected error while running analysis.");
    } finally {
      setAnalysisRunning(false);
    }
  }

  function formatDate(iso?: string) {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString();
  }

  function formatRelativeActivity(iso?: string) {
    if (!iso) return "No recent activity";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "No recent activity";

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayDiff = Math.round(
      (startOfToday.getTime() - startOfDay.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (dayDiff <= 0) return "Today";
    if (dayDiff === 1) return "Yesterday";
    if (dayDiff < 7) return `${dayDiff} days ago`;
    return d.toLocaleDateString();
  }

  function sentimentBadgeClass(label?: string) {
    if (label === "positive") return "badge-success";
    if (label === "negative") return "badge-danger";
    if (label === "neutral") return "badge-muted";
    return "badge-muted";
  }

  function getSentimentForMessage(mid: string): SentimentShape | undefined {
    if (!data?.sentiments) return undefined;
    return data.sentiments.find((s) => s.messageId === mid);
  }

  function getEntitiesForMessage(messageId: string): EntityShape[] {
    if (!data?.entities) return [];
    return data.entities.filter((e) => e.sourceMessageId === messageId);
  }

  function groupEntities() {
    const groups: Record<string, EntityShape[]> = {};
    if (!data?.entities) return groups;
    for (const e of data.entities) {
      const key = e.type || "other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }
    return groups;
  }

  function getHighlightClassForEntity(type: string): string {
    switch (type) {
      case "budget":
        return "entity-highlight-budget";
      case "decision_maker":
        return "entity-highlight-decision";
      case "timeline":
        return "entity-highlight-timeline";
      case "competitor":
        return "entity-highlight-competitor";
      default:
        return "";
    }
  }

  function highlightEntitiesInMessage(
    text: string,
    entitiesForMessage: EntityShape[]
  ): ReactNode {
    if (!text || !entitiesForMessage.length) return text;

    const patterns = entitiesForMessage
      .map((e) => {
        const snippet = (e.sourceSnippet || e.value || "").trim();
        if (!snippet) return null;
        return { ...e, snippet };
      })
      .filter((e): e is EntityShape & { snippet: string } => Boolean(e));

    if (!patterns.length) return text;

    patterns.sort((a, b) => b.snippet.length - a.snippet.length);

    const usedRanges: Array<{ start: number; end: number }> = [];
    const segments: ReactNode[] = [];
    let cursor = 0;
    const lower = text.toLowerCase();
    const matches: Array<{ start: number; end: number; entity: EntityShape & { snippet: string } }> = [];

    for (const entity of patterns) {
      const needle = entity.snippet.toLowerCase();
      if (!needle) continue;

      let index = lower.indexOf(needle);
      while (index !== -1) {
        const start = index;
        const end = index + entity.snippet.length;
        const overlaps = usedRanges.some((r) => !(end <= r.start || start >= r.end));
        if (!overlaps) {
          matches.push({ start, end, entity });
          usedRanges.push({ start, end });
        }
        index = lower.indexOf(needle, end);
      }
    }

    if (!matches.length) return text;

    matches.sort((a, b) => a.start - b.start);

    for (const match of matches) {
      if (match.start > cursor) {
        segments.push(text.slice(cursor, match.start));
      }

      const highlightClass = getHighlightClassForEntity(match.entity.type);
      const originalText = text.slice(match.start, match.end);
      segments.push(
        <span key={`${match.entity._id}-${match.start}`} className={highlightClass}>
          {originalText}
        </span>
      );
      cursor = match.end;
    }

    if (cursor < text.length) {
      segments.push(text.slice(cursor));
    }

    return segments;
  }

  function getEntityDotClass(type: string): string {
    if (type === "budget") return "entity-dot entity-budget";
    if (type === "decision_maker") return "entity-dot entity-decision";
    if (type === "timeline") return "entity-dot entity-timeline";
    if (type === "competitor") return "entity-dot entity-competitor";
    return "entity-dot entity-budget";
  }

  function formatChannelLabel(channel?: string) {
    if (!channel) return "Unknown channel";
    return channel.charAt(0).toUpperCase() + channel.slice(1);
  }

  function getConversationSectionTitle(channel?: Channel) {
    if (channel === "email") return "Email conversation";
    if (channel === "whatsapp") return "WhatsApp conversation";
    if (channel === "meeting") return "Meeting conversation";
    if (channel === "call") return "Call conversation";
    if (channel === "note") return "Notes conversation";
    return "Conversation";
  }

  function getToneLabel(score?: number | null) {
    if (typeof score !== "number") return "Not available";
    if (score >= 0.35) return "Positive";
    if (score >= 0.1) return "Slightly positive";
    if (score <= -0.35) return "Negative";
    if (score <= -0.1) return "Slightly negative";
    return "Neutral";
  }

  function getRecencyLabel(days?: number | null) {
    if (days == null) return "Not available";
    if (days <= 2) return "Recent";
    if (days <= 7) return "Cooling";
    return "Stale";
  }

  function getConversationDepthLabel(count: number) {
    if (count <= 2) return "Early conversation";
    if (count <= 6) return "Developing conversation";
    return "Established thread";
  }

  function getVerdictFromScore(score?: number | null) {
    if (typeof score !== "number") return { label: "Stable", tone: "stable" as const };
    if (score >= 75) return { label: "Healthy", tone: "healthy" as const };
    if (score >= 45) return { label: "Stable", tone: "stable" as const };
    return { label: "At Risk", tone: "risk" as const };
  }

  function normalizeEntityValue(value: string) {
    return value.trim().toLowerCase();
  }

  function extractBuyerAsk(message?: string) {
    if (!message) return null;
    const lines = message
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const requestLine = lines.find((line) =>
      /(can you|could you|please|send|share|provide|need|looking for|review|pricing|security|proposal|deck|material|details|timeline|next step)/i.test(
        line
      )
    );

    if (requestLine) {
      return requestLine.length > 180 ? `${requestLine.slice(0, 177)}...` : requestLine;
    }

    const sentences = message
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    const requestSentence = sentences.find((sentence) =>
      /(can you|could you|please|send|share|provide|need|looking for|review|pricing|security|proposal|deck|material|details|timeline|next step)/i.test(
        sentence
      )
    );

    if (!requestSentence) return null;
    return requestSentence.length > 180 ? `${requestSentence.slice(0, 177)}...` : requestSentence;
  }

  const groupedEntities = groupEntities();
  const thread = data?.thread;
  const threadMeta = (thread || {}) as ThreadShape & Record<string, any>;
  const messages = (data?.messages || []).slice().sort((a, b) => {
    const da = a.sentAt ? new Date(a.sentAt).getTime() : 0;
    const db = b.sentAt ? new Date(b.sentAt).getTime() : 0;
    return da - db;
  });
  const health = data?.latestHealth || undefined;
  const followUps = data?.followUps || [];
  const openFollowUps = followUps.filter((item) => item.status === "pending" || item.status === "snoozed");
  const latestInboundMessage = [...messages]
    .filter((message) => message.direction === "inbound")
    .sort((a, b) => {
      const da = a.sentAt ? new Date(a.sentAt).getTime() : 0;
      const db = b.sentAt ? new Date(b.sentAt).getTime() : 0;
      return db - da;
    })[0];
  const sortedSentiments = (data?.sentiments || [])
    .slice()
    .sort((a, b) => {
      const messageA = messages.find((message) => message._id === a.messageId);
      const messageB = messages.find((message) => message._id === b.messageId);
      const dateA = messageA?.sentAt ? new Date(messageA.sentAt).getTime() : 0;
      const dateB = messageB?.sentAt ? new Date(messageB.sentAt).getTime() : 0;
      return dateA - dateB;
    });
  const avgSentiment =
    sortedSentiments.length > 0
      ? sortedSentiments.reduce((sum, item) => sum + (item.score || 0), 0) / sortedSentiments.length
      : null;
  const lastSentiment = sortedSentiments.length > 0 ? sortedSentiments[sortedSentiments.length - 1] : null;
  const lastActivityDate = thread?.lastMessageAt ? new Date(thread.lastMessageAt) : null;
  const daysSinceLastMessage =
    lastActivityDate && !Number.isNaN(lastActivityDate.getTime())
      ? Math.floor((Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;
  const uniqueContacts = Array.from(
    new Set(
      messages
        .map((message) => message.senderEmail || message.senderName || "")
        .filter(Boolean)
        .map((value) => value.toLowerCase())
    )
  );
  const signalEntries = Object.entries(health?.signals || {});
  const findSignalValue = (...keywords: string[]) =>
    signalEntries.find(([key]) => keywords.some((keyword) => key.toLowerCase().includes(keyword)))?.[1];
  const budgetSignal = findSignalValue("budget");
  const decisionMakerSignal = findSignalValue("decision", "dm");
  const timelineSignal = findSignalValue("timeline");
  const competitorSignal = findSignalValue("competitor");
  const budgetConfirmed =
    typeof budgetSignal === "boolean"
      ? budgetSignal
      : Boolean(budgetSignal) || (groupedEntities.budget || []).length > 0;
  const decisionMakerIdentified =
    typeof decisionMakerSignal === "boolean"
      ? decisionMakerSignal
      : Boolean(decisionMakerSignal) || (groupedEntities.decision_maker || []).length > 0;
  const activityRecent = daysSinceLastMessage != null ? daysSinceLastMessage <= 7 : false;
  const engagementActive =
    (health?.score != null && health.score >= 60) ||
    (messages.length >= 3 && (daysSinceLastMessage == null || daysSinceLastMessage <= 14));
  const verdict = getVerdictFromScore(health?.score ?? null);
  const buyerAsk =
    extractBuyerAsk(latestInboundMessage?.bodyText) ||
    groupedEntities.timeline?.[0]?.value ||
    groupedEntities.budget?.[0]?.value ||
    groupedEntities.competitor?.[0]?.value ||
    null;

  const readableSignals: ReadableSignal[] = [
    {
      label: "Engagement",
      value: engagementActive ? "Active" : "Low",
      tone: engagementActive ? "positive" : "warning",
      detail: engagementActive
        ? "Recent replies or thread depth suggest the conversation still has motion."
        : "Limited recent activity suggests the thread may need renewed attention.",
    },
    {
      label: "Buyer signals",
      value: budgetConfirmed || decisionMakerIdentified ? "Present" : "Weak",
      tone: budgetConfirmed || decisionMakerIdentified ? "positive" : "warning",
      detail:
        budgetConfirmed && decisionMakerIdentified
          ? "Budget and stakeholder clues are both present in the conversation."
          : budgetConfirmed
          ? "Budget has come up, but decision-maker coverage still looks thin."
          : decisionMakerIdentified
          ? "A likely stakeholder is present, but budget confirmation is still missing."
          : "The thread does not yet show strong buying signals such as budget or decision-maker evidence.",
    },
    {
      label: "Momentum",
      value: getRecencyLabel(daysSinceLastMessage),
      tone: activityRecent ? "positive" : "warning",
      detail: activityRecent
        ? `Last activity was ${formatRelativeActivity(thread?.lastMessageAt).toLowerCase()}, so this thread is still fresh.`
        : "The conversation has cooled off, so the next outreach should create a concrete reason to reply.",
    },
    {
      label: "Stakeholder coverage",
      value: uniqueContacts.length >= 3 ? "Broad" : uniqueContacts.length >= 2 ? "Developing" : "Limited",
      tone: uniqueContacts.length >= 2 ? "positive" : "warning",
      detail:
        uniqueContacts.length >= 3
          ? "Multiple participants appear in the thread, which reduces single-contact risk."
          : uniqueContacts.length >= 2
          ? "There is more than one active participant, but coverage is still not broad."
          : "Only one visible contact appears in the thread, which increases risk if that contact goes quiet.",
    },
  ];

  const risks: string[] = [];
  if (uniqueContacts.length <= 1 && messages.length > 0) risks.push("Only one contact is active in this thread.");
  if (!decisionMakerIdentified) risks.push("No decision maker is identified yet.");
  if (!budgetConfirmed) risks.push("Budget has not been confirmed in the conversation.");
  if (!engagementActive) risks.push("Engagement looks weak based on recent activity and health signals.");
  if (!activityRecent) risks.push("The conversation has gone stale and may need a prompt follow-up.");

  const healthExplanation =
    verdict.label === "Healthy"
      ? "The conversation shows enough recent momentum and positive signals to look in good shape right now."
      : verdict.label === "At Risk"
      ? "The thread needs attention soon because activity and buying signals look fragile."
      : "The thread is still active enough to work with, but it needs clearer progress signals to feel strong.";

  let recommendedActionLabel = "Propose next step";
  if (buyerAsk) {
    if (/(pricing|cost|quote|budget|commercial)/i.test(buyerAsk)) {
      recommendedActionLabel = "Answer buyer concern";
    } else if (/(security|legal|review|stakeholder|team|approval)/i.test(buyerAsk)) {
      recommendedActionLabel = "Schedule stakeholder review";
    } else if (/(send|share|provide|deck|proposal|material|details|doc|outline)/i.test(buyerAsk)) {
      recommendedActionLabel = "Send requested material";
    } else if (/(meeting|call|demo|next step|review)/i.test(buyerAsk)) {
      recommendedActionLabel = "Schedule review";
    }
  } else if (!activityRecent) {
    recommendedActionLabel = "Re-engage thread";
  } else if (openFollowUps.length > 0) {
    recommendedActionLabel = "Close loop";
  }

  const actionSupport =
    buyerAsk
      ? `The latest buyer message points to a specific need, so the next response should address that ask directly.`
      : !activityRecent
      ? "The thread has cooled off, so the next step should restart momentum with a clear reason to reply."
      : decisionMakerIdentified
      ? "The conversation is active enough to move toward a concrete next step instead of sending a generic check-in."
      : "The thread needs a response that creates clarity around ownership and the next step.";
  const actionSecondarySupport = buyerAsk
    ? `Buyer ask detected from the latest inbound message: ${buyerAsk}`
    : openFollowUps[0]?.reason
    ? `Open follow-up context: ${openFollowUps[0].reason}`
    : "No explicit buyer ask was detected, so the recommendation falls back to the strongest next-step signal in the thread.";

  const recommendedReasons = [
    buyerAsk ? `The latest inbound message suggests the buyer asked for: ${buyerAsk}` : null,
    decisionMakerIdentified
      ? "A likely decision maker is already visible in the thread, so the response can move toward progress."
      : "No decision maker is clearly identified yet, so the next reply should create stakeholder clarity.",
    activityRecent
      ? `The thread is still recent with activity ${formatRelativeActivity(thread?.lastMessageAt).toLowerCase()}.`
      : "The thread is stale, so a focused follow-up is more useful than a generic nudge.",
    verdict.label === "At Risk"
      ? "Deal health is at risk, so the reply should reduce friction and create a concrete next step."
      : verdict.label === "Stable"
      ? "Deal health is stable, so the reply should move the conversation forward with a specific ask or deliverable."
      : "Deal health is healthy, so the reply should keep the momentum moving with a clear outcome.",
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const linkedLead = threadMeta.leadName || threadMeta.leadTitle || threadMeta.leadId || null;
  const linkedCompany = threadMeta.companyName || threadMeta.company || threadMeta.accountName || null;
  const headerContactName =
    threadMeta.contactName ||
    latestInboundMessage?.senderName ||
    latestInboundMessage?.senderEmail ||
    (linkedLead ? String(linkedLead) : null);
  const headerContactRole = threadMeta.contactRole || null;
  const recipientName =
    latestInboundMessage?.senderName ||
    latestInboundMessage?.senderEmail ||
    (linkedLead ? String(linkedLead) : linkedCompany ? `${String(linkedCompany)} team` : "the buyer");
  const toneGuidance =
    verdict.label === "At Risk"
      ? "helpful, concise, confident, and low-friction"
      : "helpful, concise, professional, and not pushy";
  const promptGoalMap: Record<string, string> = {
    "Send requested material": "send the requested material clearly and make it easy for the buyer to continue the evaluation",
    "Answer buyer concern": "answer the buyer's concern directly and remove uncertainty before proposing a next step",
    "Propose next step": "propose a concrete next step and make it easy for the buyer to respond",
    "Schedule review": "suggest a practical review meeting or call with a clear purpose",
    "Schedule stakeholder review": "help coordinate the right stakeholders and move the review forward",
    "Re-engage thread": "restart the conversation with a concrete reason to reply",
    "Close loop": "close the loop on the open thread in a professional way and confirm the next step",
  };
  const draftingPrompt = [
    `Write a professional B2B follow-up email to ${recipientName}.`,
    buyerAsk
      ? `The buyer asked for: ${buyerAsk}.`
      : `There is no explicit buyer ask in the latest thread, so use the available context to frame a sensible next step.`,
    `The email should ${promptGoalMap[recommendedActionLabel] || "move the conversation forward with a clear next step"}.`,
    `Tone should be ${toneGuidance}.`,
    `Keep it under 140 words and avoid sounding pushy or generic.`,
    linkedCompany ? `Company context: ${String(linkedCompany)}.` : null,
    openFollowUps[0]?.reason ? `Make sure the email addresses this follow-up context: ${openFollowUps[0].reason}.` : null,
    decisionMakerIdentified
      ? "A likely decision maker is already visible in the thread, so write with forward momentum."
      : "If appropriate, ask for the right stakeholder or owner to keep the process moving.",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  const copyContextText = [
    `Thread: ${thread?.subject || "Conversation detail"}`,
    `Channel: ${formatChannelLabel(thread?.channel)}`,
    `Last activity: ${formatRelativeActivity(thread?.lastMessageAt)}`,
    `Recommended action: ${recommendedActionLabel}`,
    ...recommendedReasons.map((reason) => `- ${reason}`),
  ].join("\n");

  async function handleCopy(kind: "prompt" | "context", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState(kind);
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("idle");
    }
  }

  const supportingInsights = [
    { label: "Overall tone", value: getToneLabel(avgSentiment) },
    { label: "Latest reply tone", value: getToneLabel(lastSentiment?.score ?? null) },
    { label: "Recency", value: getRecencyLabel(daysSinceLastMessage) },
    { label: "Conversation depth", value: getConversationDepthLabel(messages.length) },
    { label: "Last analysis update", value: formatDate(health?.lastComputedAt) },
    { label: "Health score", value: health?.score != null ? `${Math.round(health.score)} / 100` : "Not available" },
    { label: "Health trend", value: health?.trend ? health.trend.replace(/_/g, " ") : "Not available" },
    { label: "Open follow-ups", value: String(openFollowUps.length) },
  ];
  const insightSections: InsightSection[] = [
    {
      label: "Buyer signals",
      items: [
        ...(groupedEntities.budget || []),
        ...(groupedEntities.decision_maker || []),
        ...(groupedEntities.timeline || []),
      ].filter(
        (entity, index, arr) =>
          arr.findIndex((item) => normalizeEntityValue(item.value) === normalizeEntityValue(entity.value)) === index
      ),
      empty: "No clear buyer signals were extracted from this thread yet.",
    },
    {
      label: "Competitive context",
      items: (groupedEntities.competitor || []).filter(
        (entity, index, arr) =>
          arr.findIndex((item) => normalizeEntityValue(item.value) === normalizeEntityValue(entity.value)) === index
      ),
      empty: "No competitor mentions were detected in the current conversation.",
    },
    {
      label: "Key findings",
      items: Object.entries(groupedEntities)
        .filter(([key]) => !["budget", "decision_maker", "timeline", "competitor"].includes(key))
        .flatMap(([, items]) => items)
        .filter(
          (entity, index, arr) =>
            arr.findIndex((item) => normalizeEntityValue(item.value) === normalizeEntityValue(entity.value)) === index
        ),
      empty: "No additional extracted findings are available for this thread yet.",
    },
  ];

  return (
    <Layout>
      <main className="page-root">
        <div className="page-header">
          <ModuleBackButton toSuffix="/m03" />
          <div className="page-title-block">
            <h1 className="page-title">{thread?.subject || "Conversation"}</h1>
            <div className="m03-page-meta-row">
              <span className="m03-meta-pill">{formatChannelLabel(thread?.channel)}</span>
              {linkedCompany && <span className="m03-meta-pill">{String(linkedCompany)}</span>}
              {headerContactName && <span className="m03-meta-pill">{String(headerContactName)}</span>}
              {headerContactRole && <span className="m03-meta-pill">{String(headerContactRole)}</span>}
              <span className="m03-meta-pill">Last activity {formatRelativeActivity(thread?.lastMessageAt)}</span>
              <span className="m03-meta-pill">{messages.length} messages</span>
            </div>
          </div>
          <div>
            <button className="btn-run-analysis" onClick={handleRunAnalysis} disabled={analysisRunning || !threadId}>
              {analysisRunning ? "Running analysis..." : "Run analysis"}
            </button>
          </div>
        </div>

        <section className="page-section">
          {error && (
            <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 6, background: "#FEE2E2", color: "#991B1B", fontSize: 13 }}>
              {error}
            </div>
          )}
          {analysisMessage && (
            <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 6, background: "#ECFDF3", color: "#166534", fontSize: 13 }}>
              {analysisMessage}
            </div>
          )}
        </section>

        <section className="page-section m03-thread-detail-grid">
          <div className="m03-thread-main-column">
            <section className="m03-card m03-conversation-evidence-card">
              <header className="m03-card-header">
                <div className="m03-section-eyebrow">Conversation</div>
                <div className="m03-section-title">{getConversationSectionTitle(thread?.channel)}</div>
              </header>

              {loading && <div className="muted" style={{ fontSize: 13 }}>Loading messages...</div>}
              {!loading && messages.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No messages found for this thread.</div>}

              {!loading && messages.map((m) => {
                const s = getSentimentForMessage(m._id);
                const senderLabel =
                  m.senderName ||
                  m.senderEmail ||
                  (m.direction === "outbound" ? "Team member" : headerContactName || "Contact");
                const senderContext =
                  m.direction === "inbound"
                    ? [threadMeta.contactRole, linkedCompany].filter(Boolean).join(" at ")
                    : m.senderName
                    ? "Our team"
                    : "";
                return (
                  <div key={m._id} className={`m03-message-item ${m.direction === "outbound" ? "m03-message-item--ours" : "m03-message-item--contact"}`}>
                    <div className="m03-message-topline">
                      <div className="m03-message-participants">
                        <span className="badge-muted" style={{ fontSize: 11, textTransform: "capitalize" }}>
                          {m.direction === "outbound" ? "From us" : "From contact"}
                        </span>
                        {s && (
                          <span className={sentimentBadgeClass(s.label)} style={{ fontSize: 11, textTransform: "capitalize" }}>
                            {getToneLabel(s.score)}
                          </span>
                        )}
                      </div>
                      <div className="muted" style={{ fontSize: 11 }}>{formatDate(m.sentAt)}</div>
                    </div>
                    <div className="m03-message-sender">{senderLabel}</div>
                    {senderContext && <div className="m03-message-context">{senderContext}</div>}
                    <div className="m03-message-body">
                      {highlightEntitiesInMessage(m.bodyText || "-", getEntitiesForMessage(m._id))}
                    </div>
                  </div>
                );
              })}
            </section>
          </div>

          <div className="m03-thread-side-column">
            <section className={`m03-card m03-health-hero m03-health-hero--${verdict.tone}`}>
              <header className="m03-card-header">
                <div className="m03-section-eyebrow">Health verdict</div>
                <div className="m03-section-title m03-health-verdict-title">
                  <span className={`m03-health-verdict-dot m03-health-verdict-dot--${verdict.tone}`} />
                  <span>{verdict.label}</span>
                </div>
              </header>
              <div className="m03-health-hero-content">
                <div>
                  <div className="m03-health-hero-explainer">{healthExplanation}</div>
                </div>
                <div className="m03-health-score-block">
                  <div className="m03-health-score-label">Score</div>
                  <div className="m03-health-score-value">{health?.score != null ? Math.round(health.score) : "-"}</div>
                </div>
              </div>
            </section>

            <section className="m03-card">
              <header className="m03-card-header">
                <div className="m03-section-eyebrow">Why this status?</div>
                <div className="m03-section-title">Signals shaping the verdict</div>
              </header>
              <div className="m03-signal-grid m03-signal-grid--stacked">
                {readableSignals.map((signal) => (
                  <div key={signal.label} className="m03-signal-box m03-signal-box--interactive">
                    <div className="m03-signal-box-topline">
                      <div className="m03-signal-box-label">{signal.label}</div>
                      <div className={`m03-signal-box-value m03-signal-box-value--${signal.tone || "neutral"}`}>{signal.value}</div>
                    </div>
                    <div className="m03-signal-box-detail-wrap">
                      <div className="m03-signal-box-detail">{signal.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="m03-card">
              <header className="m03-card-header">
                <div className="m03-section-eyebrow">Watchouts</div>
                <div className="m03-section-title">What may block progress</div>
              </header>
              {risks.length > 0 ? (
                <ul className="m03-risk-list">{risks.map((risk) => <li key={risk}>{risk}</li>)}</ul>
              ) : (
                <div className="m03-empty-note">No clear risks stand out from the current thread data.</div>
              )}
            </section>

            <section className="m03-card">
              <header className="m03-card-header">
                <div className="m03-section-eyebrow">Supporting details</div>
                <div className="m03-section-title">Secondary metrics</div>
              </header>
              <div className="m03-secondary-list">
                {supportingInsights.map((item) => (
                  <div key={item.label} className="signal-item"><span className="signal-label">{item.label}</span><span className="signal-value">{item.value}</span></div>
                ))}
              </div>
              {(timelineSignal || competitorSignal) && (
                <div className="deal-health-signals">
                  {timelineSignal && <div className="signal-item"><span className="signal-label">Timing signal</span><span className="signal-value">{String(timelineSignal)}</span></div>}
                  {competitorSignal && <div className="signal-item"><span className="signal-label">Competitor mention signal</span><span className="signal-value">{String(competitorSignal)}</span></div>}
                </div>
              )}
            </section>
          </div>
        </section>

        <section className="page-section m03-thread-lower-grid">
          <section className="m03-card">
            <header className="m03-card-header">
              <div className="m03-section-eyebrow">Extracted insights</div>
              <div className="m03-section-title">What the conversation points to</div>
            </header>
            <div className="m03-insight-sections">
              {insightSections.map((section) => (
                <div key={section.label} className="m03-insight-group">
                  <div className="m03-insight-group-title">{section.label}</div>
                  {section.items.length > 0 ? (
                    <div className="m03-entity-badge-row">
                      {section.items.map((entity) => (
                        <span key={entity._id} className="m03-entity-badge">
                          <span className={getEntityDotClass(entity.type)} />
                          <span>{entity.value}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="m03-empty-note">{section.empty}</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="page-section">
          <section className="m03-card follow-up-card">
            <header className="m03-card-header">
              <div className="m03-section-eyebrow">Recommended next action</div>
              <div className="m03-section-title">Recommended next step</div>
            </header>
            <div className="m03-action-recommendation">
              <div className="m03-action-tag">{recommendedActionLabel}</div>
              {data?.followUpIntent && (
                <div className="follow-up-ai-confidence">
                  {(data.followUpIntent.confidence * 100).toFixed(0)}% confidence
                </div>
              )}
            </div>
            <div className="m03-action-headline">{actionSupport}</div>
            <div className="follow-up-subtitle">{actionSecondarySupport}</div>

            <div className="m03-action-panels">
              <div className="m03-action-panel">
                <div className="m03-action-panel-label">Why this is recommended</div>
                <ul className="m03-reason-list">
                  {recommendedReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>

              <div className="m03-action-panel m03-action-panel--draft">
                <div className="m03-action-panel-header">
                  <div>
                    <div className="m03-action-panel-label">AI drafting prompt</div>
                    <div className="follow-up-ai-subtext">Copy this prompt into another AI tool to draft the actual email</div>
                  </div>
                  <div className="m03-copy-actions">
                    <button
                      type="button"
                      className="m03-copy-button"
                      onClick={() => handleCopy("prompt", draftingPrompt)}
                    >
                      {copyState === "prompt" ? "Copied prompt" : "Copy prompt"}
                    </button>
                    <button
                      type="button"
                      className="m03-copy-button m03-copy-button--secondary"
                      onClick={() => handleCopy("context", copyContextText)}
                    >
                      {copyState === "context" ? "Copied context" : "Copy context"}
                    </button>
                  </div>
                </div>
                <div className="follow-up-ai-message-box">
                  <div className="follow-up-ai-label">Prompt</div>
                  <div className="follow-up-ai-message-text">
                    {draftingPrompt.split("\n").map((line, idx) => <div key={idx}>{line || <br />}</div>)}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </section>
      </main>
    </Layout>
  );
}
