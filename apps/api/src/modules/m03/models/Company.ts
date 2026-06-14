/**
 * Module: Conversation Intelligence (m03)
 * Layer: Backend
 * File: Company.ts
 * Purpose: Supports the C om pa ny flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import mongoose, { Document, Types } from "mongoose";

const { Schema, model } = mongoose;

export interface CompanyDocument extends Document {
  workspaceId: Types.ObjectId;
  name: string;
  normalizedName: string;
  primaryDomain?: string;
  aliases: string[];
  createdAt: Date;
  updatedAt: Date;
}

const CompanySchema = new Schema<CompanyDocument>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Workspace",
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
    },
    primaryDomain: {
      type: String,
      trim: true,
      lowercase: true,
    },
    aliases: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Unique index: workspaceId + normalizedName
CompanySchema.index({ workspaceId: 1, normalizedName: 1 }, { unique: true });

// Sparse index: workspaceId + primaryDomain
CompanySchema.index({ workspaceId: 1, primaryDomain: 1 }, { sparse: true });

const Company = model<CompanyDocument>("Company", CompanySchema);

export default Company;

