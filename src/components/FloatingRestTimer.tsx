"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, Plus, SkipForward } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";

/**
 * FloatingRestTimer — Background-safe animated rest countdown widget.
 *
 * Uses Date.now() comparison against stored expiration epoch to remain
 * 100% accurate even when the browser is backgrounded, suspended, or
 * the lockscreen is active. Triggers haptic + audio notification on completion.
 */

function formatTime(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function FloatingRestTimer() {
  const { restTimerExpiration, restTimerDuration, addRestTime, clearRestTimer } =
    useWorkoutStore();

  const [remainingMs, setRemainingMs] = useState(0);
  const [hasNotified, setHasNotified] = useState(false);
  const rafRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Create audio element for notification tone
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Generate a short beep using AudioContext as fallback
    audioRef.current = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGczHjqIr9PVpWQ+IUF4n8nRr3VKLkVvlcDGtIFXO0xkiLW8u4xkSEhfgKy0wJVtVUlXdZmouMKjdVxQUmqRoLLBqH1oXlRNYIGftcGpgWxiWE5Qb4ycr8OugG1kVk9Qb4ycr8OugG1kVk9Qb4ycr8Ou"
    );
    audioRef.current.volume = 0.3;
  }, []);

  // High-frequency timer loop using requestAnimationFrame
  const tick = useCallback(() => {
    if (!restTimerExpiration) {
      setRemainingMs(0);
      return;
    }

    const now = Date.now();
    const remaining = restTimerExpiration - now;
    setRemainingMs(Math.max(remaining, 0));

    if (remaining <= 0 && !hasNotified) {
      // Timer expired — trigger notification
      setHasNotified(true);

      // Haptic feedback pattern
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([100, 50, 100]);
      }

      // Play notification tone
      if (audioRef.current) {
        audioRef.current.play().catch(() => {});
      }
    }

    if (remaining > -5000) {
      // Keep ticking for 5s after expiry to show "0:00"
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [restTimerExpiration, hasNotified]);

  // Start/stop the animation frame loop
  useEffect(() => {
    if (restTimerExpiration) {
      setHasNotified(false);
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [restTimerExpiration, tick]);

  // Calculate progress percentage
  const totalDurationMs = restTimerDuration * 1000;
  const progress = restTimerExpiration
    ? Math.max(0, Math.min(1, remainingMs / totalDurationMs))
    : 0;

  const isExpired = remainingMs <= 0 && restTimerExpiration !== null;
  const isVisible = restTimerExpiration !== null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[70]"
        >
          <div
            className={`
              glass-card px-5 py-3 flex items-center gap-4 min-w-[280px]
              ${isExpired ? "border-accent-cyan/40 shadow-[0_0_20px_rgba(6,182,212,0.3)]" : "border-accent-purple/30 shadow-[0_0_15px_rgba(168,85,247,0.2)]"}
            `}
          >
            {/* Timer Icon with circular progress */}
            <div className="relative w-10 h-10 flex-shrink-0">
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  fill="none"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="3"
                />
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  fill="none"
                  stroke={isExpired ? "#06B6D4" : "#A855F7"}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${progress * 100.53} ${100.53 - progress * 100.53}`}
                  className="transition-all duration-100"
                />
              </svg>
              <Timer
                className={`absolute inset-0 m-auto h-4 w-4 ${
                  isExpired ? "text-accent-cyan" : "text-accent-purple"
                }`}
              />
            </div>

            {/* Time Display */}
            <div className="flex-1">
              <p
                className={`text-xl font-bold tabular-nums ${
                  isExpired ? "text-accent-cyan" : "text-white"
                }`}
              >
                {isExpired ? "REST OVER" : formatTime(remainingMs)}
              </p>
              <p className="text-[10px] text-gray-500">
                {isExpired ? "Time to lift!" : "Rest timer"}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => addRestTime(30)}
                className="flex items-center gap-0.5 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-[10px] font-medium text-gray-400 hover:text-white hover:border-white/20 transition-colors active:scale-95"
              >
                <Plus className="h-3 w-3" />
                30s
              </button>
              <button
                onClick={clearRestTimer}
                className="flex items-center gap-0.5 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-[10px] font-medium text-gray-400 hover:text-white hover:border-white/20 transition-colors active:scale-95"
              >
                <SkipForward className="h-3 w-3" />
                Skip
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
