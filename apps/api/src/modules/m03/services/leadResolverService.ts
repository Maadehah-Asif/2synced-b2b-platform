import { Types } from "mongoose";

import Lead from "../../m01/models/Lead.js";
import { extractDomainFromEmail } from "../utils/companyResolver.js";

export interface ResolveLeadForConversationInput {
  email?: string | null | undefined;
  fullName?: string | null | undefined;
  companyName?: string | null | undefined;
  companyDomain?: string | null | undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(value?: string | null): string {
  if (!value || typeof value !== "string") {
    return "";
  }

  return value.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeCompany(value?: string | null): string {
  return normalizeText(value)
    .replace(/\b(ltd|limited|inc|llc|company|co|corp|corporation|gmbh)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLeadFullName(lead: any): string {
  const fullName = normalizeText(lead?.full_name);
  if (fullName) {
    return fullName;
  }

  return normalizeText([lead?.First_Name, lead?.Last_Name].filter(Boolean).join(" "));
}

function extractLeadCompany(lead: any): string {
  return normalizeCompany(lead?.Company);
}

function uniqueLeadId(candidates: any[]): Types.ObjectId | undefined {
  const ids = Array.from(
    new Set(
      candidates
        .map((candidate) => candidate?._id?.toString?.())
        .filter((value): value is string => Boolean(value))
    )
  );

  if (ids.length !== 1) {
    return undefined;
  }

  return new Types.ObjectId(ids[0]);
}

/**
 * Conservative best-effort lead matching for Module 3 ingestion.
 *
 * Rules:
 * 1. Exact email match wins when it resolves to exactly one lead.
 * 2. Otherwise require an exact domain match plus strong identity evidence.
 *    Current strong evidence is an exact normalized full-name match, with
 *    optional company-name agreement when company input is available.
 *
 * This utility intentionally returns no match rather than risking a wrong link.
 */
export async function resolveLeadForConversation(
  input: ResolveLeadForConversationInput
): Promise<Types.ObjectId | undefined> {
  const normalizedEmail = input.email?.trim().toLowerCase() || "";
  const normalizedFullName = normalizeText(input.fullName);
  const normalizedCompany = normalizeCompany(input.companyName);
  const normalizedDomain =
    input.companyDomain?.trim().toLowerCase() ||
    extractDomainFromEmail(normalizedEmail) ||
    "";

  if (normalizedEmail) {
    const emailRegex = new RegExp(`^${escapeRegExp(normalizedEmail)}$`, "i");
    const emailQuery = {
      $or: [{ Email: emailRegex }, { work_email: emailRegex }],
    };
    console.info("[m03.leadResolver] exact-email lookup", {
      email: normalizedEmail,
      query: {
        $or: [{ Email: normalizedEmail }, { work_email: normalizedEmail }],
      },
    });

    // Use the raw collection query here because Module 1's Lead schema does not
    // currently declare every imported email field (for example `work_email`).
    const emailMatches = await Lead.collection
      .find(emailQuery, { projection: { _id: 1, Email: 1, work_email: 1 } })
      .toArray();

    console.info("[m03.leadResolver] exact-email result", {
      email: normalizedEmail,
      matchCount: emailMatches.length,
      matchedLeadIds: emailMatches.map((candidate) => String(candidate._id)),
    });

    const emailLeadId = uniqueLeadId(emailMatches);
    if (emailLeadId) {
      console.info("[m03.leadResolver] resolved by exact email", {
        email: normalizedEmail,
        leadId: emailLeadId.toString(),
      });
      return emailLeadId;
    }
  }

  if (!normalizedDomain || !normalizedFullName) {
    return undefined;
  }

  const domainRegex = new RegExp(`^${escapeRegExp(normalizedDomain)}$`, "i");
  const domainCandidates = await Lead.find({
    Company_Domain: domainRegex,
  })
    .select("_id First_Name Last_Name full_name Company")
    .lean<any[]>()
    .exec();

  const strongMatches = domainCandidates.filter((candidate) => {
    if (extractLeadFullName(candidate) !== normalizedFullName) {
      return false;
    }

    if (normalizedCompany) {
      return extractLeadCompany(candidate) === normalizedCompany;
    }

    return true;
  });

  console.info("[m03.leadResolver] fallback result", {
    email: normalizedEmail || null,
    domain: normalizedDomain || null,
    fullName: normalizedFullName || null,
    candidateCount: domainCandidates.length,
    strongMatchCount: strongMatches.length,
  });

  return uniqueLeadId(strongMatches);
}
