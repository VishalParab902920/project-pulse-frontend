"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

/**
 * useOnboardingGuard — Route guard ensuring biometrics are set.
 *
 * On mount (for authenticated users not already on /app/onboarding):
 * - Fetches the user's biometrics from the backend.
 * - If biometrics are missing or target_calories is 0, redirects to /app/onboarding.
 * - If biometrics are verified and user is on /app/onboarding, redirects to /app.
 *
 * Returns:
 * - isResolving: true while the check is in progress (show loading spinner)
 * - biometricsLoaded: true once biometrics are confirmed present
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
        const res = await apiFetch(`/api/v2/profile/biometrics`);

        if (res.ok) {
          const data = await res.json();

          // Biometrics exist and have meaningful values
          const hasValidBiometrics =
            data &&
            data.target_calories &&
            data.target_calories > 0;

          if (hasValidBiometrics) {
            setBiometricsLoaded(true);
            // Allow users to stay on onboarding for re-editing
          } else {
            // Biometrics missing or incomplete — redirect to onboarding
            setBiometricsLoaded(false);
            if (!isOnOnboarding) {
              router.replace("/app/onboarding");
              return;
            }
          }
        } else if (res.status === 404) {
          // No biometrics record exists — redirect to onboarding
          setBiometricsLoaded(false);
          if (!isOnOnboarding) {
            router.replace("/app/onboarding");
            return;
          }
        } else {
          // API error — allow through (don't block on transient failures)
          setBiometricsLoaded(true);
        }
      } catch (err) {
        // Network error — allow through gracefully
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
