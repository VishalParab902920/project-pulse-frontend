"use client";

/**
 * Auth utilities for reading the session token from cookies.
 *
 * The Zustand store only holds the token in memory (lost on refresh).
 * This utility reads the persisted cookie as the source of truth.
 */

/**
 * Reads the sb-access-token from browser cookies.
 * Returns null if not found or if running on the server.
 */
export function getAccessToken(): string | null {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split("=");
    if (name === "sb-access-token") {
      return valueParts.join("=") || null;
    }
  }
  return null;
}
