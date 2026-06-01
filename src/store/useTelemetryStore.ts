"use client";

import { create } from "zustand";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

/**
 * Telemetry synchronization store.
 *
 * Manages wearable device data batching and sync state.
 * Simulates Apple HealthKit / Google Fit data extraction and
 * batches metrics into a single compressed POST to the backend.
 */

interface TelemetryMetric {
  timestamp: string;
  metric_type: string;
  value: number;
}

interface TelemetryState {
  isSyncing: boolean;
  lastSyncedAt: number | null;
  syncWearableData: (token: string) => Promise<void>;
}

/**
 * Generates mock 24-hour wearable telemetry data.
 * In production, this would interface with Capacitor HealthKit/Google Fit plugins.
 */
function generateMockTelemetry(): TelemetryMetric[] {
  const metrics: TelemetryMetric[] = [];
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Generate hourly step counts (simulating pedometer)
  for (let hour = 0; hour < 24; hour++) {
    const timestamp = new Date(startOfDay.getTime() + hour * 3600000);
    if (timestamp > now) break;

    // Steps: higher during morning commute and lunch
    let steps = Math.floor(Math.random() * 200) + 50;
    if (hour >= 7 && hour <= 9) steps = Math.floor(Math.random() * 800) + 400;
    if (hour >= 12 && hour <= 13) steps = Math.floor(Math.random() * 600) + 300;
    if (hour >= 17 && hour <= 19) steps = Math.floor(Math.random() * 1000) + 500;

    metrics.push({
      timestamp: timestamp.toISOString(),
      metric_type: "steps",
      value: steps,
    });
  }

  // Generate heart rate samples every 15 minutes
  for (let i = 0; i < 96; i++) {
    const timestamp = new Date(startOfDay.getTime() + i * 900000);
    if (timestamp > now) break;

    const hour = timestamp.getHours();
    let baseHR = 65;
    if (hour >= 6 && hour <= 8) baseHR = 72;
    if (hour >= 12 && hour <= 13) baseHR = 68;
    if (hour >= 17 && hour <= 19) baseHR = 85;
    if (hour >= 22 || hour <= 5) baseHR = 58;

    const hr = baseHR + Math.floor(Math.random() * 12) - 6;

    metrics.push({
      timestamp: timestamp.toISOString(),
      metric_type: "heart_rate",
      value: Math.max(45, Math.min(180, hr)),
    });
  }

  // Generate sleep data (single entry for last night)
  const lastNightStart = new Date(startOfDay.getTime() - 8 * 3600000);
  const sleepDuration = 25200 + Math.floor(Math.random() * 3600); // 7-8 hours in seconds

  metrics.push({
    timestamp: lastNightStart.toISOString(),
    metric_type: "sleep_seconds",
    value: sleepDuration,
  });

  // Generate active calories (hourly)
  for (let hour = 6; hour < 22; hour++) {
    const timestamp = new Date(startOfDay.getTime() + hour * 3600000);
    if (timestamp > now) break;

    let calories = Math.floor(Math.random() * 30) + 10;
    if (hour >= 17 && hour <= 19) calories = Math.floor(Math.random() * 150) + 80;

    metrics.push({
      timestamp: timestamp.toISOString(),
      metric_type: "active_calories",
      value: calories,
    });
  }

  return metrics;
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  isSyncing: false,
  lastSyncedAt: null,

  syncWearableData: async (token: string) => {
    set({ isSyncing: true });

    try {
      // Mock telemetry is strictly gated behind an explicit env flag so random
      // data is NEVER written to production summaries. In production this path
      // is replaced by a real Capacitor HealthKit / Google Fit bridge.
      if (process.env.NEXT_PUBLIC_ENABLE_MOCK_TELEMETRY !== "true") {
        console.warn(
          "[TELEMETRY] Mock sync ignored. Enable NEXT_PUBLIC_ENABLE_MOCK_TELEMETRY to test."
        );
        set({ isSyncing: false });
        return;
      }

      // Generate mock telemetry (dev/test only — replace with Capacitor HealthKit in production)
      const metrics = generateMockTelemetry();

      if (metrics.length === 0) {
        set({ isSyncing: false });
        return;
      }

      // POST bulk payload to backend
      const res = await fetch(`${BACKEND_URL}/api/v2/telemetry/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ metrics }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log(
          `[TELEMETRY] Synced ${data.synced_count} metrics, summary updated: ${data.summary_updated}`
        );
        set({ lastSyncedAt: Date.now() });
      } else {
        console.error("[TELEMETRY] Sync failed:", res.status);
      }
    } catch (err) {
      console.error("[TELEMETRY] Sync error:", err);
    } finally {
      set({ isSyncing: false });
    }
  },
}));
