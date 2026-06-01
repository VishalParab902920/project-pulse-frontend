"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, Scale, Loader2, Check } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useUIStore } from "@/store/useUIStore";
import { useDateStore } from "@/store/useDateStore";

/**
 * WeightLogModal — Glassmorphic slide-up weight dial overlay.
 *
 * Features:
 * - Large bold weight display
 * - Press-and-hold +/- dial buttons with 0.1kg increments
 * - Rapid acceleration on sustained hold
 * - POST to /api/v2/profile/biometrics/weight on confirm
 */

interface WeightLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWeightLogged: () => void;
  initialWeight?: number;
}

export default function WeightLogModal({
  isOpen,
  onClose,
  onWeightLogged,
  initialWeight = 75.0,
}: WeightLogModalProps) {
  const [weight, setWeight] = useState(initialWeight);
  const [isLogging, setIsLogging] = useState(false);
  const [logged, setLogged] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { hideNav, showNav, setModalOpen } = useUIStore();

  // Hide nav when modal opens, show when it closes
  useEffect(() => {
    if (isOpen) {
      hideNav();
      setModalOpen(true);
      setWeight(initialWeight);
      setLogged(false);
    } else {
      showNav();
      setModalOpen(false);
    }
  }, [isOpen, initialWeight, hideNav, showNav, setModalOpen]);

  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startIncrement = useCallback((delta: number) => {
    // Immediate first tick
    setWeight((w) => Math.round((w + delta) * 10) / 10);

    // After 300ms delay, start rapid repeat
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        setWeight((w) => {
          const next = Math.round((w + delta) * 10) / 10;
          return Math.max(20, Math.min(300, next));
        });
      }, 80);
    }, 300);
  }, []);

  const stopIncrement = useCallback(() => {
    clearTimers();
  }, [clearTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const handleLog = useCallback(async () => {
    if (weight <= 0 || weight > 500) return;
    setIsLogging(true);
    const { selectedDate } = useDateStore.getState();

    try {
      const res = await apiFetch("/api/v2/profile/biometrics/weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weight_kg: weight,
          logged_at: selectedDate,
        }),
      });

      if (res.ok) {
        setLogged(true);
        onWeightLogged();
        // Auto-close after brief success feedback
        setTimeout(() => {
          onClose();
        }, 800);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLogging(false);
    }
  }, [weight, onWeightLogged, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-t-3xl bg-[#0a0a0c]/95 border-t border-white/10 backdrop-blur-xl overflow-hidden pb-[env(safe-area-inset-bottom)]"
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-center gap-2 pb-4">
            <Scale className="h-4 w-4 text-accent-cyan" />
            <h2 className="text-sm font-semibold text-white">Log Weight</h2>
          </div>

          {/* Weight Dial */}
          <div className="flex items-center justify-center gap-6 px-6 py-8">
            {/* Minus Button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onPointerDown={() => startIncrement(-0.1)}
              onPointerUp={stopIncrement}
              onPointerLeave={stopIncrement}
              onTouchCancel={stopIncrement}
              className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:bg-white/10 hover:border-white/20 transition-colors select-none touch-none active:bg-accent-cyan/10 active:border-accent-cyan/30"
            >
              <Minus className="h-6 w-6" />
            </motion.button>

            {/* Weight Display */}
            <div className="flex flex-col items-center">
              <span className="text-5xl font-bold text-white tabular-nums tracking-tight">
                {weight.toFixed(1)}
              </span>
              <span className="text-xs text-gray-500 mt-1">kg</span>
            </div>

            {/* Plus Button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onPointerDown={() => startIncrement(0.1)}
              onPointerUp={stopIncrement}
              onPointerLeave={stopIncrement}
              onTouchCancel={stopIncrement}
              className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:bg-white/10 hover:border-white/20 transition-colors select-none touch-none active:bg-accent-cyan/10 active:border-accent-cyan/30"
            >
              <Plus className="h-6 w-6" />
            </motion.button>
          </div>

          {/* Log Button */}
          <div className="px-6 pb-8">
            <button
              onClick={handleLog}
              disabled={isLogging || logged}
              className={`
                w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white
                transition-all active:scale-[0.98] disabled:opacity-70
                ${
                  logged
                    ? "bg-status-success/20 border border-status-success/30"
                    : "bg-gradient-to-r from-accent-indigo via-accent-purple to-accent-cyan shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                }
              `}
            >
              {isLogging ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : logged ? (
                <>
                  <Check className="h-4 w-4 text-status-success" />
                  <span className="text-status-success">Logged</span>
                </>
              ) : (
                <>
                  <Scale className="h-4 w-4" />
                  Log {weight.toFixed(1)} kg
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
