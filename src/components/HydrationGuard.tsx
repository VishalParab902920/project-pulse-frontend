"use client";

import { useEffect, useState } from "react";

/**
 * HydrationGuard prevents Next.js hydration mismatches by deferring
 * rendering until the component is fully mounted in the client browser.
 *
 * Wraps children that depend on client-only APIs (localStorage, window,
 * Zustand stores with persisted state, etc.) to avoid SSR/CSR divergence.
 */

interface HydrationGuardProps {
  children: React.ReactNode;
  /** Optional loading fallback shown during hydration */
  fallback?: React.ReactNode;
}

export default function HydrationGuard({
  children,
  fallback = null,
}: HydrationGuardProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
