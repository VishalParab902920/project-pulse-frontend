"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Root Page — Silent Redirection Gateway
 *
 * Inspects the sb-access-token cookie and redirects:
 * - Token present → /app (V2 dashboard)
 * - Token missing → /login
 *
 * Renders a blank dark screen while resolving.
 */

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const hasToken = document.cookie
      .split(";")
      .some((c) => c.trim().startsWith("sb-access-token="));

    if (hasToken) {
      router.replace("/app");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return <div className="bg-[#050505] min-h-screen" />;
}
