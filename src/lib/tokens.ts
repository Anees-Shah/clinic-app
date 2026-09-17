import { randomBytes } from "crypto";

/**
 * Generate a secure opaque token for cancel/reschedule links
 */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Generate a shorter claim token for waitlist
 */
export function generateClaimToken(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Calculate token expiry (24 hours from now)
 */
export function getTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 24);
  return expiry;
}

/**
 * Calculate claim token expiry (30 minutes from now)
 */
export function getClaimTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 30);
  return expiry;
}

/**
 * Verify token hasn't expired
 */
export function isTokenValid(expiry: Date | null): boolean {
  if (!expiry) return false;
  return new Date() < expiry;
}