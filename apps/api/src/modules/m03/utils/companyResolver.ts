/**
 * Company Resolver Utilities
 * 
 * Handles normalization and resolution of company names and email domains
 * to create or find Company records.
 */

import { Types } from "mongoose";
import Company, { type CompanyDocument } from "../models/Company.js";

/**
 * Normalize a company name for matching.
 * - Lowercase
 * - Trim
 * - Remove punctuation
 * - Strip common suffixes
 */
export function normalizeCompanyName(raw: string): string {
  if (!raw || typeof raw !== "string") {
    return "";
  }

  let normalized = raw
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();

  // Strip common suffixes (case-insensitive)
  const suffixes = [
    /\s+ltd\s*$/i,
    /\s+limited\s*$/i,
    /\s+\(pvt\)\s+ltd\s*$/i,
    /\s+pvt\s+ltd\s*$/i,
    /\s+inc\s*$/i,
    /\s+llc\s*$/i,
    /\s+gmbh\s*$/i,
    /\s+co\.\s*$/i,
    /\s+company\s*$/i,
  ];

  for (const suffix of suffixes) {
    normalized = normalized.replace(suffix, "").trim();
  }

  return normalized;
}

/**
 * Extract domain from an email address.
 * Returns null if email is invalid or missing.
 */
export function extractDomainFromEmail(email?: string | null): string | null {
  if (!email || typeof email !== "string") {
    return null;
  }

  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.indexOf("@");

  if (atIndex === -1 || atIndex === trimmed.length - 1) {
    return null;
  }

  const domain = trimmed.substring(atIndex + 1).trim();
  if (domain.length === 0) {
    return null;
  }

  return domain;
}

/**
 * Resolve or create a Company record for given input.
 * 
 * @param workspaceId - Workspace ID
 * @param rawCompanyName - Raw company name (optional)
 * @param prospectEmail - Prospect email address (optional)
 * @returns Company document
 * @throws Error if both name and email are empty
 */
export async function resolveOrCreateCompanyForInput(
  workspaceId: Types.ObjectId,
  rawCompanyName?: string | null,
  prospectEmail?: string | null
): Promise<CompanyDocument> {
  // At least one must be provided
  if ((!rawCompanyName || !rawCompanyName.trim()) && (!prospectEmail || !prospectEmail.trim())) {
    throw new Error("Either company name or prospect email must be provided.");
  }

  const wsId = workspaceId instanceof Types.ObjectId ? workspaceId : new Types.ObjectId(workspaceId);

  // Compute normalized values
  const normalizedName = rawCompanyName ? normalizeCompanyName(rawCompanyName) : "";
  const domain = extractDomainFromEmail(prospectEmail);

  // Search for existing company
  // Try: normalizedName match OR primaryDomain match OR aliases contains normalized
  const searchConditions: any[] = [];

  if (normalizedName) {
    searchConditions.push({ normalizedName });
  }

  if (domain) {
    searchConditions.push({ primaryDomain: domain });
  }

  if (normalizedName) {
    searchConditions.push({ aliases: normalizedName });
  }

  let company: CompanyDocument | null = null;

  if (searchConditions.length > 0) {
    company = await Company.findOne({
      workspaceId: wsId,
      $or: searchConditions,
    }).exec();
  }

  if (company) {
    // Update aliases if needed
    if (normalizedName && !company.aliases.includes(normalizedName) && company.normalizedName !== normalizedName) {
      company.aliases.push(normalizedName);
      await company.save();
    }
    return company;
  }

  // Create new company
  const companyName = rawCompanyName?.trim() || (domain ? domain : "Unknown company");

  const newCompany = await Company.create({
    workspaceId: wsId,
    name: companyName,
    normalizedName: normalizedName || normalizeCompanyName(companyName),
    primaryDomain: domain || undefined,
    aliases: normalizedName && normalizedName !== normalizeCompanyName(companyName) ? [normalizedName] : [],
  });

  return newCompany;
}

