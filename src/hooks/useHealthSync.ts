"use client";

import { useEffect, useRef } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

/**
 * Foreground Health Sync Hook
 *
 * Listens for the app returning to the foreground (tab visibility change).
 * On foreground, syncs health data to the backend:
 * - Native (Capacitor): Placeholder for HealthKit/Google Fit pull.
 * - Web Browser: Simulates a step count sync for development.
 *
 * Debounced to prevent rapid-fire syncs when switching tabs quickly.
 */
export function useHealthSync() {
  const lastSyncRef = useRef<number>(0);
  const MIN_SYNC_INTERVAL_MS = 60_000; // Don't sync more than once per minute

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;

      // Debounce: skip if synced recently
      const now = Date.now();
      if (now - lastSyncRef.current < MIN_SYNC_INTERVAL_MS) return;
      lastSyncRef.current = now;

      try {
        // Detect if running in Capacitor native shell
        const isNative = typeof (window as unknown as { Capacitor?: unknown }).Capacitor !== "undefined";

        let steps = 0;
        let heartRate = 0;

        if (isNative) {
          // TODO: Pull real data from HealthKit/Google Fit via Capacitor plugin
          // For now, use simulated values
          steps = Math.floor(Math.random() * 3000) + 6000; // 6000-9000
          heartRate = Math.floor(Math.random() * 20) + 65; // 65-85 bpm
        } else {
          // Web browser simulation for development
          steps = Math.floor(Math.random() * 2000) + 7000; // 7000-9000
          heartRate = Math.floor(Math.random() * 15) + 68; // 68-83 bpm
        }

        const payload = {
          steps,
          heart_rate_avg: heartRate,
          sleep_minutes: null,
          occurred_at: new Date().toISOString(),
        };

        const res = await fetch(`${BACKEND_URL}/api/v1/sync/health`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          console.log(
            `[Health Sync] Successfully synced local steps: ${steps}, heart_rate: ${heartRate} to backend. Rows: ${data.rows_inserted}`
          );
        } else {
          console.warn("[Health Sync] Backend returned error:", res.status);
        }
      } catch (error) {
        console.warn("[Health Sync] Failed to sync:", error);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
