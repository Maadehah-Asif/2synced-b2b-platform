/**
 * Organisation Timeline Service
 * 
 * Provides organisation-level conversation timeline data.
 */

import { Types } from "mongoose";
import ConversationThread, {
  type ConversationThreadDocument,
} from "../models/ConversationThreads.js";
import ConversationMessage, {
  type ConversationMessageDocument,
} from "../models/ConversationMessage.js";
import Company, {
  type CompanyDocument,
} from "../models/Company.js";

export interface OrgListItem {
  id: string;
  name: string;
  source?: "lead_deal" | "domain"; // Optional source indicator
}

export interface TimelineEvent {
  date: string; // ISO string
  channel: string;
  direction: string;
  threadId: string;
  threadSubject: string;
  snippet: string;
}

export interface OrgTimelineResult {
  orgId: string;
  companyName: string;
  days: number;
  events: TimelineEvent[];
}


/**
 * List all organisations (companies) with conversation activity in a workspace.
 * Uses Company model linked to ConversationThreads.
 */
export async function listOrganisationsWithActivity(
  workspaceId: string
): Promise<OrgListItem[]> {
  const wsId = new Types.ObjectId(workspaceId);

  try {
    // Get distinct companyIds from threads
    const companyIds = await ConversationThread.distinct("companyId", {
      workspaceId: wsId,
    }).exec();

    if (companyIds.length === 0) {
      return [];
    }

    // Load Company documents
    const companies = await Company.find({
      _id: { $in: companyIds },
      workspaceId: wsId,
    })
      .select("_id name")
      .lean()
      .exec();

    const orgs: OrgListItem[] = companies.map((c) => ({
      id: c._id.toString(),
      name: c.name,
    }));

    // Sort by name
    orgs.sort((a, b) => a.name.localeCompare(b.name));

    // Debug logging (minimal)
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[orgTimeline] Found ${orgs.length} companies for workspace ${workspaceId}`
      );
    }

    return orgs;
  } catch (err) {
    console.error("Error listing organisations:", err);
    return [];
  }
}

/**
 * Get timeline events for a specific organisation.
 * orgId is a Company._id (ObjectId string).
 */
export async function getOrgTimeline(
  workspaceId: string,
  orgId: string,
  days: number = 90
): Promise<OrgTimelineResult | null> {
  const wsId = new Types.ObjectId(workspaceId);
  const companyId = new Types.ObjectId(orgId);

  try {
    // Validate that company exists and belongs to workspace
    const company = await Company.findOne({
      _id: companyId,
      workspaceId: wsId,
    })
      .select("name")
      .lean()
      .exec();

    if (!company) {
      return null;
    }

    const companyName = company.name;

    // Find all threads for this company
    const threads = await ConversationThread.find({
      workspaceId: wsId,
      companyId: companyId,
    })
      .select("_id subject")
      .lean()
      .exec();

    const threadIds = threads.map((t) => t._id);

    if (threadIds.length === 0) {
      return {
        orgId,
        companyName,
        days,
        events: [],
      };
    }

    // Calculate date cutoff
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Find all messages for these threads within the date range
    const messages = await ConversationMessage.find({
      workspaceId: wsId,
      threadId: { $in: threadIds },
      sentAt: { $gte: cutoffDate },
    })
      .select("threadId sentAt channel direction bodyText")
      .sort({ sentAt: 1 })
      .lean()
      .exec();

    // Build thread map for subject lookup
    const threadMap = new Map<string, string>();
    for (const thread of threads) {
      threadMap.set(thread._id.toString(), thread.subject || "");
    }

    // Build events
    const events: TimelineEvent[] = messages.map((msg) => {
      const threadId = msg.threadId?.toString() || "";
      const threadSubject = threadMap.get(threadId) || "";
      const snippet = (msg.bodyText || "").slice(0, 120);

      return {
        date: msg.sentAt ? new Date(msg.sentAt).toISOString() : new Date().toISOString(),
        channel: msg.channel || "other",
        direction: msg.direction || "outbound",
        threadId,
        threadSubject,
        snippet,
      };
    });

    // Debug logging (minimal)
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[orgTimeline] Returning ${events.length} events for company ${orgId} (${threadIds.length} threads)`
      );
    }

    return {
      orgId,
      companyName,
      days,
      events,
    };
  } catch (err) {
    console.error("Error getting org timeline:", err);
    return null;
  }
}

