"use client";

import { useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useDateStore } from "@/store/useDateStore";

/**
 * DateSwitcher — Horizontal scrollable date strip.
 *
 * Renders a sleek, slide-scrollable row of dates centered on the active
 * selectedDate. Includes left/right arrow navigation and a "Today" reset button.
 */

function formatDateLabel(dateStr: string): { day: string; weekday: string; isToday: boolean } {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isToday = date.toDateString() === today.toDateString();
  const day = date.getDate().toString();
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });

  return { day, weekday, isToday };
}

function generateDateRange(centerDate: string, range: number = 3): string[] {
  const dates: string[] = [];
  const center = new Date(centerDate + "T00:00:00");

  for (let i = -range; i <= range; i++) {
    const d = new Date(center);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }

  return dates;
}

/** Trigger haptic feedback if available (safe no-op on unsupported devices) */
function triggerHaptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(10);
  }
}

export default function DateSwitcher() {
  const { selectedDate, setDate, incrementDate, decrementDate, resetToToday } =
    useDateStore();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeDateRef = useRef<HTMLButtonElement>(null);

  // Scroll the active date into view when it changes
  useEffect(() => {
    if (activeDateRef.current) {
      activeDateRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [selectedDate]);

  const handlePrev = useCallback(() => {
    triggerHaptic();
    decrementDate();
  }, [decrementDate]);

  const handleNext = useCallback(() => {
    triggerHaptic();
    incrementDate();
  }, [incrementDate]);

  const handleToday = useCallback(() => {
    triggerHaptic();
    resetToToday();
  }, [resetToToday]);

  const handleDateSelect = useCallback(
    (date: string) => {
      triggerHaptic();
      setDate(date);
    },
    [setDate]
  );

  const dates = generateDateRange(selectedDate, 3);
  const todayStr = new Date().toISOString().split("T")[0];
  const isOnToday = selectedDate === todayStr;

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-white/5 bg-base/80 backdrop-blur-lg">
      {/* Left Arrow */}
      <button
        onClick={handlePrev}
        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
        aria-label="Previous day"
      >
        <ChevronLeft className="h-4 w-4 text-gray-400" />
      </button>

      {/* Scrollable Date Strip */}
      <div
        ref={scrollContainerRef}
        className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-hide scroll-smooth"
      >
        {dates.map((dateStr) => {
          const { day, weekday, isToday } = formatDateLabel(dateStr);
          const isActive = dateStr === selectedDate;

          return (
            <button
              key={dateStr}
              ref={isActive ? activeDateRef : undefined}
              onClick={() => handleDateSelect(dateStr)}
              className={`
                flex-shrink-0 flex flex-col items-center justify-center
                w-11 h-14 rounded-xl transition-all duration-200
                ${
                  isActive
                    ? "bg-white/10 border border-white/20 shadow-sm"
                    : "hover:bg-white/5"
                }
              `}
            >
              <span
                className={`text-[10px] font-medium uppercase tracking-wider ${
                  isActive ? "text-accent-purple" : "text-gray-500"
                }`}
              >
                {weekday}
              </span>
              <span
                className={`text-sm font-semibold mt-0.5 ${
                  isActive
                    ? "text-white"
                    : isToday
                    ? "text-accent-cyan"
                    : "text-gray-400"
                }`}
              >
                {day}
              </span>
              {isToday && !isActive && (
                <motion.div
                  layoutId="today-dot"
                  className="w-1 h-1 rounded-full bg-accent-cyan mt-0.5"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Right Arrow */}
      <button
        onClick={handleNext}
        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
        aria-label="Next day"
      >
        <ChevronRight className="h-4 w-4 text-gray-400" />
      </button>

      {/* Today Reset Button */}
      <button
        onClick={handleToday}
        className={`
          flex-shrink-0 p-1.5 rounded-lg transition-colors
          ${isOnToday ? "text-gray-600" : "text-accent-cyan hover:bg-white/5"}
        `}
        disabled={isOnToday}
        aria-label="Reset to today"
      >
        <CalendarDays className="h-4 w-4" />
      </button>
    </div>
  );
}
