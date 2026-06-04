"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

/**
 * useOnboardingGuard — Route guard ensuring biometrics are set.
 *
 * Architecture note (404 state-drift fix):
 * The backend now ALWAYS returns 200 OK from GET /api/v2/profile/biometrics.
 * Newly registered (or migrated) users get a blank record with null physiological
 * fields. This guard evaluates data.weight_kg and data.height_cm to determine
 * if onboarding is still required — NOT the HTTP status code.
 *
 * This eliminates the infinite spinner caused by SWR's isLoading getting stuck
 * on an unhandled 404 exception in the fetch wrapper.
 *
 * Returns:
 * - isResolving: true while the check is in progress (show loading spinner)
 * - biometricsLoaded: true once biometrics are confirmed present and complete
 */

interface OnboardingGuardResult {
  isResolving: boolean;
  biometricsLoaded: boolean;
}

export function useOnboardingGuard(): OnboardingGuardResult {
  const router = useRouter();
  const pathname = usePathname();
  const { accessToken: storeToken, isAuthenticated } = useUserStore();
  const accessToken = storeToken || getAccessToken();

  const [isResolving, setIsResolving] = useState(true);
  const [biometricsLoaded, setBiometricsLoaded] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      setIsResolving(false);
      return;
    }

    const isOnOnboarding = pathname === "/app/onboarding";

    async function checkBiometrics() {
      try {
        const res = await apiFetch(`/api/v2/profile/biometrics?_t=${Date.now()}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        });

        if (res.ok) {
          const data = await res.json();

          // The backend guarantees 200 OK for all authenticated users.
          // A blank (un-onboarded) record has null weight_kg and height_cm.
          // Check these physiological baseline fields — NOT a 404 status — to
          // determine if onboarding is required. This is the stable contract.
          const hasValidBiometrics =
            data != null &&
            data.weight_kg !== null &&
            data.weight_kg !== undefined &&
            data.height_cm !== null &&
            data.height_cm !== undefined &&
            data.target_calories != null &&
            data.target_calories > 0;

          if (hasValidBiometrics) {
            // Onboarding complete — baseline is filled.
            setBiometricsLoaded(true);
            // If the user somehow landed on /app/onboarding after completing
            // onboarding (e.g. via browser back), send them to the dashboard.
            if (isOnOnboarding) {
              router.replace("/app");
            }
          } else {
            // Biometrics incomplete (blank record) — redirect to onboarding.
            setBiometricsLoaded(false);
            if (!isOnOnboarding) {
              router.replace("/app/onboarding");
            }
          }
        } else {
          // Non-ok response (transient 5xx, etc.).
          // The DB invariant guarantees a row exists for every authenticated user,
          // so a non-200 here is always a transient server failure — allow through
          // gracefully rather than redirecting to onboarding and hard-locking the UI.
          // A genuine 404 would indicate the endpoint URL has changed, not a
          // missing biometrics record.
          console.warn(
            `[ONBOARDING GUARD] Unexpected HTTP ${res.status} from /biometrics — allowing through gracefully.`
          );
          setBiometricsLoaded(true);
        }
      } catch (err) {
        // Network error — allow through gracefully to avoid hard-locking the UI
        // on connectivity issues (e.g. captive portals, server restart).
        console.warn("[ONBOARDING GUARD] Biometrics check failed:", err);
        setBiometricsLoaded(true);
      } finally {
        setIsResolving(false);
      }
    }

    checkBiometrics();
  }, [accessToken, isAuthenticated, pathname, router]);

  return { isResolving, biometricsLoaded };
}
