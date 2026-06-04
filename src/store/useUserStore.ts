"use client";

import { create } from "zustand";
import localforage from "localforage";

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
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  preferred_solid_unit?: 'metric' | 'imperial';
  preferred_liquid_unit?: 'metric' | 'imperial';
  allergies?: string[];
}

interface UserState {
  /** The authenticated user's profile data — null when unauthenticated */
  userProfile: ProfileResponse | null;
  /** The current Supabase access token (JWT) — null when unauthenticated */
  accessToken: string | null;
  /** Whether the user is currently authenticated — strictly false by default */
  isAuthenticated: boolean;

  /** Unit preference for solid mass */
  preferred_solid_unit: 'metric' | 'imperial';
  /** Unit preference for liquid volume */
  preferred_liquid_unit: 'metric' | 'imperial';
  /** User's allergies array */
  allergies: string[];
  /** Whether the store has hydrated preferences from local storage */
  isHydrated: boolean;

  /** Set authentication state with a valid, non-empty token and profile */
  setAuth: (token: string, profile: ProfileResponse) => void;
  /** Clear all authentication state and remove session cookie */
  clearAuth: () => void;
  
  /** Read from localforage to hydrate preferences */
  hydratePreferences: () => Promise<void>;
  /** Update preferences in state, localforage, and asynchronously in backend */
  updatePreferences: (solid: 'metric' | 'imperial', liquid: 'metric' | 'imperial', allergies: string[]) => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  userProfile: null,
  accessToken: null,
  isAuthenticated: false,
  
  // Defaults to prevent Next.js hydration mismatches
  preferred_solid_unit: 'metric',
  preferred_liquid_unit: 'metric',
  allergies: [],
  isHydrated: false,

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
      // If profile contains preferences, we sync them into root state
      ...(profile.preferred_solid_unit && { preferred_solid_unit: profile.preferred_solid_unit }),
      ...(profile.preferred_liquid_unit && { preferred_liquid_unit: profile.preferred_liquid_unit }),
      ...(profile.allergies && { allergies: profile.allergies })
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

  hydratePreferences: async () => {
    try {
      const solid = await localforage.getItem<'metric' | 'imperial'>('preferred_solid_unit');
      const liquid = await localforage.getItem<'metric' | 'imperial'>('preferred_liquid_unit');
      const allergies = await localforage.getItem<string[]>('allergies');

      set((state) => ({
        preferred_solid_unit: solid || state.preferred_solid_unit,
        preferred_liquid_unit: liquid || state.preferred_liquid_unit,
        allergies: allergies || state.allergies,
      }));
    } catch (error) {
      // IndexedDB read failed — fall back to in-memory defaults silently.
      console.warn('[USER_STORE] Local hydration failed, falling back to defaults:', error);
    } finally {
      // CRITICAL: Always flip isHydrated to true, regardless of whether the
      // localforage reads succeeded or failed. Without this, pages gated on
      // !isHydrated will spin forever if IndexedDB is unavailable.
      set({ isHydrated: true });
    }
  },
  
  updatePreferences: async (solid, liquid, allergies) => {
    // Normalize allergies: lowercase, strip whitespace, deduplicate
    const normalizedAllergies = Array.from(
      new Set(allergies.map(a => a.trim().toLowerCase()).filter(a => a.length > 0))
    );
    
    try {
      // Update local storage
      await localforage.setItem('preferred_solid_unit', solid);
      await localforage.setItem('preferred_liquid_unit', liquid);
      await localforage.setItem('allergies', normalizedAllergies);
      
      // Update local state
      set((state) => {
        const nextProfile = state.userProfile ? {
          ...state.userProfile,
          preferred_solid_unit: solid,
          preferred_liquid_unit: liquid,
          allergies: normalizedAllergies
        } : null;

        return {
          preferred_solid_unit: solid,
          preferred_liquid_unit: liquid,
          allergies: normalizedAllergies,
          userProfile: nextProfile
        };
      });
      
      // Asynchronously dispatch API update
      const { accessToken } = get();
      if (accessToken) {
        // We do not await this fetch so it runs asynchronously in the background.
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
        fetch(`${backendUrl}/api/v2/profile/onboard`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            preferred_solid_unit: solid,
            preferred_liquid_unit: liquid,
            allergies: normalizedAllergies
          })
        }).catch(err => console.error('[AUTH] Failed to sync preferences to API', err));
      }
    } catch (error) {
       console.error('[AUTH] Failed to save preferences', error);
    }
  }
}));
