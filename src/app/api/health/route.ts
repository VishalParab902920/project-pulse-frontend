import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";

const BACKEND_API_URL = process.env.BACKEND_API_URL ?? "http://localhost:8000";

export async function GET() {
  const results: {
    frontend: string;
    backend: string;
    backend_details: Record<string, string> | null;
    supabase_client: string;
  } = {
    frontend: "ok",
    backend: "unreachable",
    backend_details: null,
    supabase_client: "unconfigured",
  };

  // --- Check Supabase JS client initialization ---
  results.supabase_client = isSupabaseConfigured() ? "configured" : "unconfigured";

  // --- Ping FastAPI backend health endpoint ---
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/v2/health`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      results.backend = "connected";
      results.backend_details = data;
    } else {
      results.backend = `error_${response.status}`;
    }
  } catch (error) {
    results.backend = "unreachable";
  }

  // --- Overall status ---
  const allGreen = results.backend === "connected" && results.supabase_client === "configured";

  return NextResponse.json(
    {
      status: allGreen ? "optimal" : "degraded",
      ...results,
    },
    { status: 200 }
  );
}
