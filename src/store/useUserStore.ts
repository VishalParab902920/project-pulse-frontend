"use client";

import { create } from "zustand";

/**
 * Global user authentication state store.
 *
 * Strict enforcement:
 * - isAuthenticated defaults to false (never auto-truthy)
 * - userProfile defaults to null (never pre-populated)
 * - setAuth only accepts a non-empty token and a valid profile object
 * - clearAuth wipes all state and removes the session cookie
 *
 * No development mode bypasses. No mock fallbacks.
 */

export interface ProfileResponse {
  id: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

interface UserState {
  /** The authenticated user's profile data — null when unauthenticated */
  userProfile: ProfileResponse | null;
  /** The current Supabase access token (JWT) — null when unauthenticated */
  accessToken: string | null;
  /** Whether the user is currently authenticated — strictly false by default */
  isAuthenticated: boolean;
  /** Set authentication state with a valid, non-empty token and profile */
  setAuth: (token: string, profile: ProfileResponse) => void;
  /** Clear all authentication state and remove session cookie */
  clearAuth: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  userProfile: null,
  accessToken: null,
  isAuthenticated: false,

  setAuth: (token: string, profile: ProfileResponse) => {
    // Enforce non-empty token and valid profile
    if (!token || token.trim().length === 0) {
      console.error("[AUTH] setAuth called with empty token — ignoring");
      return;
    }
    if (!profile || !profile.id) {
      console.error("[AUTH] setAuth called with invalid profile — ignoring");
      return;
    }

    set({
      accessToken: token,
      userProfile: profile,
      isAuthenticated: true,
    });
  },

  clearAuth: () => {
    // Remove the session cookie
    if (typeof document !== "undefined") {
      document.cookie =
        "sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    }

    set({
      accessToken: null,
      userProfile: null,
      isAuthenticated: false,
    });
  },
}));
