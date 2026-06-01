"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useUIStore } from "@/store/useUIStore";

/**
 * CalendarPicker — Custom glassmorphic month-view calendar modal.
 *
 * Matches the Tech-Noir design language with:
 * - Dark glass background with backdrop blur
 * - Purple accent for selected date
 * - Cyan accent for today indicator
 * - Future dates greyed out and unselectable
 */

interface CalendarPickerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string; // YYYY-MM-DD
  onDateSelect: (date: string) => void;
  maxDate?: string; // YYYY-MM-DD — dates after this are disabled
}

function getLocalTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CalendarPicker({
  isOpen,
  onClose,
  selectedDate,
  onDateSelect,
  maxDate,
}: CalendarPickerProps) {
  const todayStr = getLocalTodayString();
  const effectiveMax = maxDate || todayStr;

  // Parse the selected date to initialize the viewed month
  const initialYear = parseInt(selectedDate.split("-")[0]);
  const initialMonth = parseInt(selectedDate.split("-")[1]) - 1;

  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);

  const daysInMonth = useMemo(() => getDaysInMonth(viewYear, viewMonth), [viewYear, viewMonth]);
  const firstDay = useMemo(() => getFirstDayOfMonth(viewYear, viewMonth), [viewYear, viewMonth]);

  const handlePrevMonth = useCallback(() => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }, [viewMonth]);

  const handleNextMonth = useCallback(() => {
    // Don't allow navigating to months entirely in the future
    const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
    const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
    const firstOfNext = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-01`;
    if (firstOfNext > effectiveMax) return;

    setViewMonth(nextMonth);
    setViewYear(nextYear);
  }, [viewMonth, viewYear, effectiveMax]);

  const handleDayClick = useCallback(
    (day: number) => {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (dateStr > effectiveMax) return;
      onDateSelect(dateStr);
      onClose();
    },
    [viewYear, viewMonth, effectiveMax, onDateSelect, onClose]
  );

  // Check if next month navigation should be disabled
  const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  const firstOfNextMonth = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-01`;
  const isNextMonthDisabled = firstOfNextMonth > effectiveMax;
  const { setModalOpen } = useUIStore();
  useEffect(() => { setModalOpen(isOpen); return () => { setModalOpen(false); }; }, [isOpen, setModalOpen]);


  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center px-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[320px] rounded-2xl bg-[#0a0a0c]/95 border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4 text-gray-400" />
            </button>

            <h3 className="text-sm font-semibold text-white">
              {MONTHS[viewMonth]} {viewYear}
            </h3>

            <button
              onClick={handleNextMonth}
              disabled={isNextMonthDisabled}
              className={`p-1.5 rounded-lg transition-colors ${
                isNextMonthDisabled ? "opacity-30 cursor-not-allowed" : "hover:bg-white/5"
              }`}
              aria-label="Next month"
            >
              <ChevronRight className={`h-4 w-4 ${isNextMonthDisabled ? "text-gray-700" : "text-gray-400"}`} />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 px-3 pb-1">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="flex items-center justify-center h-8">
                <span className="text-[10px] font-medium text-gray-600 uppercase">
                  {wd}
                </span>
              </div>
            ))}
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7 px-3 pb-4 gap-y-0.5">
            {/* Empty cells for days before the 1st */}
            {Array.from({ length: firstDay }, (_, i) => (
              <div key={`empty-${i}`} className="h-9" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === todayStr;
              const isFuture = dateStr > effectiveMax;

              return (
                <button
                  key={day}
                  onClick={() => handleDayClick(day)}
                  disabled={isFuture}
                  className={`
                    h-9 w-full flex items-center justify-center rounded-lg text-xs font-medium
                    transition-all duration-150
                    ${
                      isFuture
                        ? "text-gray-800 cursor-not-allowed"
                        : isSelected
                        ? "bg-accent-purple/30 border border-accent-purple/50 text-white"
                        : isToday
                        ? "text-accent-cyan hover:bg-white/5"
                        : "text-gray-300 hover:bg-white/5"
                    }
                  `}
                >
                  {day}
                  {isToday && !isSelected && (
                    <span className="absolute mt-5 w-1 h-1 rounded-full bg-accent-cyan" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer — Quick actions */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <button
              onClick={() => {
                onDateSelect(todayStr);
                onClose();
              }}
              className="text-[11px] font-medium text-accent-cyan hover:text-white transition-colors"
            >
              Today
            </button>
            <button
              onClick={onClose}
              className="text-[11px] font-medium text-gray-500 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}


