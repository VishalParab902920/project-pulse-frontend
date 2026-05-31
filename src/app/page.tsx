"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, CloudOff } from "lucide-react";
import Omnibar from "@/components/Omnibar";
import ProgressRings from "@/components/ProgressRings";
import ParsedCard from "@/components/ParsedCards";
import ReviewQueue from "@/components/ReviewQueue";
import Onboarding from "@/components/Onboarding";
import Dashboard from "@/components/Dashboard";
import type { TimelineItem, ParseResponse, FoodData } from "@/lib/types";
import { useHealthSync } from "@/hooks/useHealthSync";
import { saveOfflineLog, getOfflineLogs, clearOfflineLog } from "@/lib/indexedDb";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function Home() {
  // Health sync on foreground
  useHealthSync();

  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalCalories, setTotalCalories] = useState(0);
  const [totalProtein, setTotalProtein] = useState(0);

  // Onboarding state
  const [onboardingStatus, setOnboardingStatus] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Review Queue state
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pendingEntries, setPendingEntries] = useState<ParseResponse[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  // Dashboard state
  const [dashboardOpen, setDashboardOpen] = useState(false);

  // Offline state
  const [isOnline, setIsOnline] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch pending count on mount and after changes
  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/entries/pending/count`);
      if (res.ok) {
        const data = await res.json();
        setPendingCount(data.count);
      }
    } catch {
      // Silently fail — badge just won't update
    }
  }, []);

  // Fetch full pending entries when review queue opens
  const fetchPendingEntries = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/entries/pending`);
      if (res.ok) {
        const data: ParseResponse[] = await res.json();
        setPendingEntries(data);
        setPendingCount(data.length);
      }
    } catch {
      console.error("Failed to fetch pending entries");
    }
  }, []);

  // Fetch profile on mount to check onboarding status
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/v1/profile`);
        if (res.ok) {
          const data = await res.json();
          setOnboardingStatus(data.onboarding_status);
        }
      } catch {
        // If profile fetch fails, show the app anyway
        setOnboardingStatus("completed");
      } finally {
        setProfileLoading(false);
      }
    }
    fetchProfile();
  }, []);

  // Network status listeners + offline sync
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = async () => {
      setIsOnline(true);
      console.log("[Offline Sync] Network restored — syncing pending logs...");

      try {
        const logs = await getOfflineLogs();
        if (logs.length === 0) return;

        const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        for (const log of logs) {
          try {
            const res = await fetch(`${BACKEND_URL}/api/v1/parse`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: log.payload }),
            });

            if (res.ok) {
              const data: ParseResponse = await res.json();

              // Replace offline placeholder with real response
              setTimeline((prev) => {
                const updated = prev.filter(
                  (item) => !(item.kind === "user_message_offline" && item.offlineId === log.id)
                );
                return [
                  ...updated,
                  { kind: "user_message", text: log.payload, timestamp: now },
                  { kind: "assistant_message", text: data.short_persona_response, timestamp: now },
                  { kind: "parsed_card", data, timestamp: now },
                ];
              });

              if (data.type === "food") {
                const foodData = data.parsed_data as FoodData;
                setTotalCalories((prev) => prev + foodData.total_macros_calculated.kcal);
                setTotalProtein((prev) => prev + foodData.total_macros_calculated.p);
              }

              setPendingCount((prev) => prev + 1);
              await clearOfflineLog(log.id!);
              console.log(`[Offline Sync] ✓ Synced: "${log.payload.slice(0, 30)}..."`);
            }
          } catch (e) {
            console.warn(`[Offline Sync] Failed to sync log ${log.id}:`, e);
          }
        }
      } catch (e) {
        console.error("[Offline Sync] Error reading IndexedDB:", e);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log("[Offline] Network lost — inputs will be saved locally.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    fetchPendingCount();
  }, [fetchPendingCount]);

  // Auto-scroll to bottom when new items appear
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [timeline]);

  const handleReviewOpen = () => {
    fetchPendingEntries();
    setReviewOpen(true);
  };

  const handleConfirmEntry = (entryId: string) => {
    setPendingEntries((prev) => prev.filter((e) => e.id !== entryId));
    setPendingCount((prev) => Math.max(0, prev - 1));
  };

  const handleUpdateEntry = (entryId: string) => {
    setPendingEntries((prev) => prev.filter((e) => e.id !== entryId));
    setPendingCount((prev) => Math.max(0, prev - 1));
  };

  const handleSend = async (text: string) => {
    const now = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Offline check: save to IndexedDB instead of calling API
    if (!navigator.onLine) {
      const saved = await saveOfflineLog("text", text);
      const logs = await getOfflineLogs();
      const offlineId = logs[logs.length - 1]?.id;

      setTimeline((prev) => [
        ...prev,
        { kind: "user_message_offline", text, timestamp: now, offlineId },
      ]);
      return;
    }

    // 1. Add user message to timeline
    setTimeline((prev) => [
      ...prev,
      { kind: "user_message", text, timestamp: now },
      { kind: "loading", timestamp: now },
    ]);
    setIsProcessing(true);

    try {
      // 2. Call the backend parse API
      const res = await fetch(`${BACKEND_URL}/api/v1/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data: ParseResponse = await res.json();

      // 3. Remove loading indicator, add AI response + parsed card
      setTimeline((prev) => [
        ...prev.filter((item) => item.kind !== "loading"),
        {
          kind: "assistant_message",
          text: data.short_persona_response,
          timestamp: now,
        },
        { kind: "parsed_card", data, timestamp: now },
      ]);

      // 4. Update progress rings if food was logged
      if (data.type === "food") {
        const foodData = data.parsed_data as FoodData;
        setTotalCalories((prev) => prev + foodData.total_macros_calculated.kcal);
        setTotalProtein((prev) => prev + foodData.total_macros_calculated.p);
      }

      // 5. Update pending count (new entry is pending)
      setPendingCount((prev) => prev + 1);
    } catch {
      // Remove loading, show error
      setTimeline((prev) => [
        ...prev.filter((item) => item.kind !== "loading"),
        {
          kind: "assistant_message",
          text: "Something went wrong connecting to the server. Please try again.",
          timestamp: now,
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle cloud audio result (already parsed by backend)
  const handleAudioResult = useCallback((data: unknown) => {
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const response = data as ParseResponse;

    setTimeline((prev) => [
      ...prev,
      { kind: "user_message", text: response.raw_input || "[Voice input]", timestamp: now },
      { kind: "assistant_message", text: response.short_persona_response, timestamp: now },
      { kind: "parsed_card", data: response, timestamp: now },
    ]);

    if (response.type === "food") {
      const foodData = response.parsed_data as FoodData;
      setTotalCalories((prev) => prev + foodData.total_macros_calculated.kcal);
      setTotalProtein((prev) => prev + foodData.total_macros_calculated.p);
    }

    setPendingCount((prev) => prev + 1);
  }, []);

  // Handle image/vision result (already parsed by backend)
  const handleImageResult = useCallback((data: unknown) => {
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const response = data as ParseResponse;

    // Show caption if provided, otherwise just "📷 Photo logged"
    const userText = response.raw_input && response.raw_input !== "[Photo input]"
      ? `📷 ${response.raw_input}`
      : "📷 Photo logged";

    setTimeline((prev) => [
      ...prev,
      { kind: "user_message", text: userText, timestamp: now },
      { kind: "assistant_message", text: response.short_persona_response, timestamp: now },
      { kind: "parsed_card", data: response, timestamp: now },
    ]);

    if (response.type === "food") {
      const foodData = response.parsed_data as FoodData;
      setTotalCalories((prev) => prev + foodData.total_macros_calculated.kcal);
      setTotalProtein((prev) => prev + foodData.total_macros_calculated.p);
    }

    setPendingCount((prev) => prev + 1);
  }, []);

  // Loading state while checking profile
  if (profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 text-accent-indigo animate-spin" />
      </div>
    );
  }

  // Show onboarding if not completed
  if (onboardingStatus === "pending") {
    return <Onboarding onComplete={() => setOnboardingStatus("completed")} />;
  }

  return (
    <main className="relative flex min-h-screen flex-col">
      {/* Top Progress Rings — The Horizon */}
      <div
        className="sticky top-0 z-40 bg-base/80 backdrop-blur-lg border-b border-white/5 cursor-pointer"
        onClick={() => setDashboardOpen(true)}
      >
        <ProgressRings calories={totalCalories} protein={totalProtein} />
      </div>

      {/* Chat Stream Area — The Pulse */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pt-6 pb-28">
        {/* System Welcome Message */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex items-start gap-3 mb-6"
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-full ai-glow flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm text-gray-200 leading-relaxed font-normal">
              Hey there. I&apos;m your Pulse assistant. Log anything — a meal,
              a workout, a weigh-in — and I&apos;ll handle the rest. Voice,
              photo, or text. Your call.
            </p>
            <span className="text-[10px] text-gray-600 mt-1 block">
              Just now
            </span>
          </div>
        </motion.div>

        {/* Timeline Stream */}
        <AnimatePresence mode="popLayout">
          {timeline.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center mt-12 text-center"
            >
              <p className="text-xs text-gray-600 tracking-wide uppercase">
                Your timeline is empty
              </p>
              <p className="text-xs text-gray-700 mt-1">
                Use the Omnibar below to log your first entry
              </p>
            </motion.div>
          )}

          {timeline.map((item, index) => {
            if (item.kind === "user_message") {
              return (
                <motion.div
                  key={`user-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex justify-end mb-4"
                >
                  <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl px-4 py-3 max-w-[80%]">
                    <p className="text-sm text-gray-300 font-normal">
                      {item.text}
                    </p>
                    <span className="text-[10px] text-gray-600 mt-1 block text-right">
                      {item.timestamp}
                    </span>
                  </div>
                </motion.div>
              );
            }

            if (item.kind === "user_message_offline") {
              return (
                <motion.div
                  key={`offline-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex justify-end mb-4"
                >
                  <div className="bg-white/[0.02] border border-white/[0.04] border-dashed rounded-2xl px-4 py-3 max-w-[80%]">
                    <p className="text-sm text-gray-400 font-normal">
                      {item.text}
                    </p>
                    <div className="flex items-center justify-end gap-1.5 mt-1">
                      <CloudOff className="h-3 w-3 text-gray-500" />
                      <span className="text-[10px] text-gray-500">
                        Saved offline • Syncing when connected
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            }

            if (item.kind === "assistant_message") {
              return (
                <motion.div
                  key={`ai-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-start gap-3 mb-4"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full ai-glow flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-200 leading-relaxed font-normal">
                      {item.text}
                    </p>
                    <span className="text-[10px] text-gray-600 mt-1 block">
                      {item.timestamp}
                    </span>
                  </div>
                </motion.div>
              );
            }

            if (item.kind === "parsed_card") {
              return (
                <div key={`card-${index}`} className="mb-4">
                  <ParsedCard response={item.data} />
                </div>
              );
            }

            if (item.kind === "loading") {
              return (
                <motion.div
                  key={`loading-${index}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-3 mb-4"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full ai-glow flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="h-3.5 w-3.5 text-accent-purple animate-spin" />
                    <span className="text-xs text-gray-400">
                      Analyzing input...
                    </span>
                  </div>
                </motion.div>
              );
            }

            return null;
          })}
        </AnimatePresence>
      </div>

      {/* Floating Omnibar */}
      <Omnibar
        onSend={handleSend}
        onAudioResult={handleAudioResult}
        onImageResult={handleImageResult}
        onReviewOpen={handleReviewOpen}
        onProcessingChange={setIsProcessing}
        disabled={isProcessing}
        pendingReviews={pendingCount}
      />

      {/* Review Queue Overlay */}
      <ReviewQueue
        isOpen={reviewOpen}
        onClose={() => setReviewOpen(false)}
        entries={pendingEntries}
        onConfirm={handleConfirmEntry}
        onUpdate={handleUpdateEntry}
      />

      {/* Dashboard Overlay */}
      <AnimatePresence>
        {dashboardOpen && (
          <Dashboard onClose={() => setDashboardOpen(false)} />
        )}
      </AnimatePresence>
    </main>
  );
}
