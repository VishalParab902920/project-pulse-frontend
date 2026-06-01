"use client";

import { create } from "zustand";

/**
 * Global date state store.
 *
 * Manages the currently selected date across the entire application.
 * Changing this date triggers re-fetches of food logs, workout sessions,
 * and daily progress values across all active UI components.
 */

interface DateState {
  /** Currently selected date as YYYY-MM-DD string */
  selectedDate: string;
  /** Set the selected date to a specific value */
  setDate: (date: string) => void;
  /** Move to the next day */
  incrementDate: () => void;
  /** Move to the previous day */
  decrementDate: () => void;
  /** Reset to today's date */
  resetToToday: () => void;
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + "T00:00:00");
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

export const useDateStore = create<DateState>((set) => ({
  selectedDate: getToday(),

  setDate: (date: string) => set({ selectedDate: date }),

  incrementDate: () =>
    set((state) => ({ selectedDate: addDays(state.selectedDate, 1) })),

  decrementDate: () =>
    set((state) => ({ selectedDate: addDays(state.selectedDate, -1) })),

  resetToToday: () => set({ selectedDate: getToday() }),
}));
