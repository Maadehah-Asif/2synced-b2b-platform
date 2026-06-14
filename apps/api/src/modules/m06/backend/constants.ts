/**
 * Module: Revenue Attribution & ROI (m06)
 * Layer: Backend
 * File: constants.ts
 * Purpose: Supports the c on st an ts flow for this module.
 * Notes: Documentation header added for maintainability.
 */

// Centralized constants for Module 7 touch & campaign validation
export const CHANNELS = ['email','ads','linkedin','webinar','other'] as const;
export type Channel = typeof CHANNELS[number];
export const TOUCH_TYPES = ['email_open','email_click','ad_click','webinar','form_submit','other'] as const;
export type TouchType = typeof TOUCH_TYPES[number];

export const CHANNEL_SET = new Set(CHANNELS);
export const TOUCH_TYPE_SET = new Set(TOUCH_TYPES);

// Basic validators (lightweight, reused server-side)
export function isValidChannel(v: any): v is Channel { return typeof v === 'string' && CHANNEL_SET.has(v as any); }
export function isValidTouchType(v: any): v is TouchType { return typeof v === 'string' && TOUCH_TYPE_SET.has(v as any); }
export function parseDate(value: any): Date | null {
  if(!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}
