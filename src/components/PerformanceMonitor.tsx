"use client";

import { useEffect } from "react";

/**
 * PerformanceMonitor — Client-side performance tracer.
 *
 * Mounts a PerformanceObserver that watches for:
 * - `longtask`: main-thread tasks blocking > 50ms (jank / thread lockup)
 * - `layout-shift`: Cumulative Layout Shift (CLS) events
 *
 * Logs structured console warnings with origin attribution so E2E test
 * runs and manual debugging can surface performance regressions.
 *
 * Mount this once near the root of the app (e.g. in the app shell layout).
 * It renders nothing.
 */

interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
  sources?: Array<{ node?: Node }>;
}

interface LongTaskAttribution {
  name: string;
  containerType: string;
  containerName: string;
  containerSrc: string;
}

interface LongTaskEntry extends PerformanceEntry {
  attribution?: LongTaskAttribution[];
}

export default function PerformanceMonitor() {
  useEffect(() => {
    if (typeof window === "undefined" || !("PerformanceObserver" in window)) {
      return;
    }

    const observers: PerformanceObserver[] = [];
    let cumulativeCLS = 0;

    // --- Long Task Observer (thread lockups > 50ms) ---
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as LongTaskEntry[]) {
          if (entry.duration > 50) {
            const attribution = entry.attribution?.[0];
            const origin = attribution
              ? `${attribution.containerType}:${attribution.containerName || attribution.containerSrc || "unknown"}`
              : "unknown";

            console.warn(
              `[PERF][longtask] Main thread blocked for ${entry.duration.toFixed(1)}ms ` +
                `(start: ${entry.startTime.toFixed(0)}ms, origin: ${origin})`
            );
          }
        }
      });
      longTaskObserver.observe({ type: "longtask", buffered: true });
      observers.push(longTaskObserver);
    } catch {
      // longtask not supported in this browser — skip silently
    }

    // --- Layout Shift Observer (CLS) ---
    try {
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as LayoutShiftEntry[]) {
          // Ignore shifts caused by recent user input (expected)
          if (entry.hadRecentInput) continue;

          cumulativeCLS += entry.value;

          const sourceNode = entry.sources?.[0]?.node as HTMLElement | undefined;
          const origin = sourceNode?.tagName
            ? `<${sourceNode.tagName.toLowerCase()}${
                sourceNode.className && typeof sourceNode.className === "string"
                  ? `.${sourceNode.className.split(" ").slice(0, 2).join(".")}`
                  : ""
              }>`
            : "unknown element";

          console.warn(
            `[PERF][layout-shift] CLS +${entry.value.toFixed(4)} ` +
              `(cumulative: ${cumulativeCLS.toFixed(4)}, origin: ${origin})`
          );

          if (cumulativeCLS > 0.1) {
            console.warn(
              `[PERF][layout-shift] ⚠️ Cumulative CLS ${cumulativeCLS.toFixed(4)} exceeds 0.1 threshold`
            );
          }
        }
      });
      clsObserver.observe({ type: "layout-shift", buffered: true });
      observers.push(clsObserver);
    } catch {
      // layout-shift not supported — skip silently
    }

    return () => {
      observers.forEach((o) => o.disconnect());
    };
  }, []);

  return null;
}
