"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Sparkles, Loader2, RefreshCw, Calendar } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { getAccessToken } from "@/lib/auth";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

/**
 * Analytics Page — AI Weekly Synthesis Report
 *
 * Fetches or triggers generation of the weekly AI coaching report.
 * Polls the endpoint every 3 seconds while generation is in progress.
 * Renders the returned markdown in a glassmorphic scrollable container.
 */

interface ReportData {
  status: "ready" | "generating";
  week_start_date: string;
  report_markdown?: string;
  created_at?: string;
  message?: string;
}

function getWeekStartDate(d: Date = new Date()): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday
  date.setDate(diff);
  return date.toISOString().split("T")[0];
}

function renderMarkdown(md: string): string {
  // Simple markdown-to-HTML renderer for safe display
  let html = md
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold text-white mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold text-white mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold text-white mt-6 mb-3">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em class="text-gray-300">$1</em>')
    // Bullet points
    .replace(/^- (.+)$/gm, '<li class="text-xs text-gray-300 ml-4 mb-1 list-disc">$1</li>')
    .replace(/^  - (.+)$/gm, '<li class="text-xs text-gray-400 ml-8 mb-1 list-circle">$1</li>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr class="border-white/5 my-4" />')
    // Line breaks
    .replace(/\n\n/g, '<div class="h-3"></div>')
    .replace(/\n/g, "<br />");

  return html;
}

export default function AnalyticsPage() {
  const storeToken = useUserStore((s) => s.accessToken);
  const accessToken = storeToken || getAccessToken();

  const [report, setReport] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [weekStart, setWeekStart] = useState(getWeekStartDate());
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchReport = useCallback(
    async (showLoading = true) => {
      if (!accessToken) return;
      if (showLoading) setIsLoading(true);

      try {
        const res = await fetch(
          `${BACKEND_URL}/api/v2/analytics/weekly-report?week_start_date=${weekStart}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (res.status === 200) {
          const data: ReportData = await res.json();
          setReport(data);
          setIsPolling(false);
          stopPolling();
        } else if (res.status === 202) {
          const data: ReportData = await res.json();
          setReport(data);
          setIsPolling(true);
          startPolling();
        } else {
          setReport(null);
          setIsPolling(false);
        }
      } catch (err) {
        console.error("[ANALYTICS] Fetch report failed:", err);
        setReport(null);
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken, weekStart]
  );

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return;
    pollIntervalRef.current = setInterval(() => {
      fetchReport(false);
    }, 3000);
  }, [fetchReport]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    fetchReport();
    return () => stopPolling();
  }, [fetchReport, stopPolling]);

  // Navigate weeks
  const goToPreviousWeek = useCallback(() => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() - 7);
    setWeekStart(d.toISOString().split("T")[0]);
  }, [weekStart]);

  const goToCurrentWeek = useCallback(() => {
    setWeekStart(getWeekStartDate());
  }, []);

  const weekEndDate = new Date(weekStart + "T00:00:00");
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  const weekLabel = `${new Date(weekStart + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${weekEndDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  return (
    <div className="p-4 pb-24 transform-gpu">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent-purple" />
          <h1 className="text-base font-semibold text-white">Analytics</h1>
        </div>
        <button
          onClick={goToCurrentWeek}
          className="flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-[10px] font-medium text-gray-400 hover:text-white transition-colors"
        >
          <Calendar className="h-3 w-3" />
          This Week
        </button>
      </div>

      {/* Week Navigator */}
      <div className="glass-card p-3 mb-4 flex items-center justify-between">
        <button
          onClick={goToPreviousWeek}
          className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <span className="text-xs font-medium text-white">{weekLabel}</span>
        <div className="w-8" />
      </div>

      {/* Report Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-5 w-5 text-accent-purple animate-spin" />
        </div>
      ) : isPolling || (report && report.status === "generating") ? (
        /* Generating State — Animated Spinner */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 flex flex-col items-center justify-center text-center"
        >
          <motion.div
            animate={{
              boxShadow: [
                "0 0 20px rgba(99,102,241,0.3)",
                "0 0 40px rgba(168,85,247,0.5)",
                "0 0 20px rgba(6,182,212,0.3)",
                "0 0 20px rgba(99,102,241,0.3)",
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="h-16 w-16 rounded-full ai-glow flex items-center justify-center mb-4"
          >
            <Sparkles className="h-7 w-7 text-white" />
          </motion.div>
          <motion.div
            className="w-48 h-1 rounded-full bg-white/5 overflow-hidden mb-4"
          >
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-accent-indigo via-accent-purple to-accent-cyan"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: "50%" }}
            />
          </motion.div>
          <p className="text-sm text-gray-300 font-medium">
            AI compiling your weekly report...
          </p>
          <p className="text-[10px] text-gray-600 mt-1">
            Analyzing nutrition, training, and health data
          </p>
        </motion.div>
      ) : report && report.status === "ready" && report.report_markdown ? (
        /* Report Ready — Render Markdown */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5 overflow-y-auto max-h-[65dvh] transform-gpu"
        >
          {/* Report Header */}
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/5">
            <div className="h-7 w-7 rounded-lg ai-glow flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-white">
                Weekly Pulse Report
              </p>
              <p className="text-[9px] text-gray-500">
                Generated{" "}
                {report.created_at
                  ? new Date(report.created_at).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })
                  : "recently"}
              </p>
            </div>
          </div>

          {/* Rendered Markdown Content */}
          <div
            className="prose prose-invert prose-sm max-w-none text-gray-300 leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(report.report_markdown),
            }}
          />
        </motion.div>
      ) : (
        /* No Report Available */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 flex flex-col items-center justify-center text-center"
        >
          <TrendingUp className="h-10 w-10 text-gray-700 mb-3" />
          <p className="text-sm text-gray-400">No report available for this week</p>
          <p className="text-[10px] text-gray-600 mt-1">
            Reports are generated once you have logged data for the week
          </p>
          <button
            onClick={() => fetchReport()}
            className="mt-4 flex items-center gap-1.5 rounded-xl bg-accent-purple/10 border border-accent-purple/20 px-4 py-2 text-xs font-medium text-accent-purple hover:bg-accent-purple/20 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Generate Report
          </button>
        </motion.div>
      )}
    </div>
  );
}
