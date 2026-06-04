"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

const DAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** Parse an ISO date string "YYYY-MM-DD" → { year, month (0-based), day } */
function parseISO(value: string): { year: number; month: number; day: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { year: y, month: m - 1, day: d };
}

/** Format a Date → "DD/MM/YYYY" for display */
function formatDisplay(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Build an ISO "YYYY-MM-DD" string from year/month/day */
function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Return number of days in a given month */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Parse manually typed "DD/MM/YYYY", "DD / MM / YYYY", or "DDMMYYYY" into an ISO string */
function parseTypedDate(typed: string): string | null {
  const sanitized = typed.replace(/\s+/g, "");
  
  // Try format with slashes (allows 1 or 2 digits for day/month)
  const matchSlash = sanitized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (matchSlash) {
    return validateAndIso(Number(matchSlash[1]), Number(matchSlash[2]), Number(matchSlash[3]));
  }

  // Try 8 straight digits DDMMYYYY
  const matchDigits = sanitized.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (matchDigits) {
    return validateAndIso(Number(matchDigits[1]), Number(matchDigits[2]), Number(matchDigits[3]));
  }
  
  return null;
}

function validateAndIso(d: number, m: number, y: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900) return null;
  // Also check if days in month is valid
  if (d > daysInMonth(y, m - 1)) return null;
  return toISO(y, m - 1, d);
}

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

interface CustomDatePickerProps {
  /** ISO "YYYY-MM-DD" controlled value */
  value: string;
  onChange: (iso: string) => void;
  /** Max selectable date as ISO string (defaults to today) */
  maxDate?: string;
  /** Min selectable date as ISO string */
  minDate?: string;
  label?: string;
  placeholder?: string;
  id?: string;
}

type ViewMode = "calendar" | "year" | "month";

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

export default function CustomDatePicker({
  value,
  onChange,
  maxDate,
  minDate,
  placeholder = "DD/MM/YYYY",
  id = "custom-date-picker",
}: CustomDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");

  const [inputValue, setInputValue] = useState("");

  // The month/year currently shown in the calendar grid
  const today = useMemo(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  }, []);

  const parsed = useMemo(() => parseISO(value), [value]);

  const [viewYear, setViewYear] = useState<number>(parsed?.year ?? today.year);
  const [viewMonth, setViewMonth] = useState<number>(parsed?.month ?? today.month);

  // Sync view when external value changes
  useEffect(() => {
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
      setInputValue(formatDisplay(new Date(parsed.year, parsed.month, parsed.day)));
    } else {
      setInputValue("");
    }
  }, [parsed]);

  // SSR safety
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Close on outside click
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        // On blur out of the picker entirely, restore input text if invalid
        if (parsed) {
          setInputValue(formatDisplay(new Date(parsed.year, parsed.month, parsed.day)));
        } else {
          setInputValue("");
        }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, parsed]);

  // ── Boundary helpers ──────────────────────────────────────────
  const maxParsed = useMemo(() => parseISO(maxDate ?? ""), [maxDate]);
  const minParsed = useMemo(() => parseISO(minDate ?? ""), [minDate]);

  const isAfterMax = useCallback(
    (y: number, m: number, d: number) => {
      if (!maxParsed) return false;
      const a = y * 10000 + m * 100 + d;
      const b = maxParsed.year * 10000 + maxParsed.month * 100 + maxParsed.day;
      return a > b;
    },
    [maxParsed]
  );

  const isBeforeMin = useCallback(
    (y: number, m: number, d: number) => {
      if (!minParsed) return false;
      const a = y * 10000 + m * 100 + d;
      const b = minParsed.year * 10000 + minParsed.month * 100 + minParsed.day;
      return a < b;
    },
    [minParsed]
  );

  const isDayDisabled = useCallback(
    (y: number, m: number, d: number) => isAfterMax(y, m, d) || isBeforeMin(y, m, d),
    [isAfterMax, isBeforeMin]
  );

  // ── Navigation ────────────────────────────────────────────────
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setOpen(true);
    const parsedIso = parseTypedDate(e.target.value);
    if (parsedIso) {
      const parts = parseISO(parsedIso);
      if (parts && !isDayDisabled(parts.year, parts.month, parts.day)) {
        onChange(parsedIso);
        setViewYear(parts.year);
        setViewMonth(parts.month);
        setViewMode("calendar");
        
        // Auto-close and format if the user has typed a complete date (e.g. 8 digits or DD/MM/YYYY)
        const stripped = e.target.value.replace(/\s+/g, "");
        if (stripped.length >= 8) {
          setInputValue(formatDisplay(new Date(parts.year, parts.month, parts.day)));
          setOpen(false);
        }
      }
    }
  };

  // ── Grid builder ──────────────────────────────────────────────
  const cells = useMemo(() => {
    const firstDow = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
    const total = daysInMonth(viewYear, viewMonth);

    // Previous month tail
    const prevTotal = daysInMonth(
      viewMonth === 0 ? viewYear - 1 : viewYear,
      viewMonth === 0 ? 11 : viewMonth - 1
    );

    const result: Array<{
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
    }> = [];

    for (let i = firstDow - 1; i >= 0; i--) {
      const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
      result.push({ day: prevTotal - i, month: prevM, year: prevY, isCurrentMonth: false });
    }
    for (let d = 1; d <= total; d++) {
      result.push({ day: d, month: viewMonth, year: viewYear, isCurrentMonth: true });
    }
    // Next month head
    const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
    const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
    let d = 1;
    while (result.length % 7 !== 0) {
      result.push({ day: d++, month: nextM, year: nextY, isCurrentMonth: false });
    }
    return result;
  }, [viewYear, viewMonth]);

  const yearCells = useMemo(() => {
    const currentY = today.year;
    const years = [];
    for (let y = 1920; y <= currentY; y++) {
      years.push(y);
    }
    return years.reverse();
  }, [today.year]);

  // ── Select handler ────────────────────────────────────────────
  const selectDay = useCallback(
    (year: number, month: number, day: number) => {
      if (isDayDisabled(year, month, day)) return;
      onChange(toISO(year, month, day));
      setViewYear(year);
      setViewMonth(month);
      setOpen(false);
    },
    [isDayDisabled, onChange]
  );

  const selectYear = (y: number) => {
    setViewYear(y);
    setViewMode("month");
  };

  const selectMonth = (m: number) => {
    setViewMonth(m);
    setViewMode("calendar");
  };

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="relative w-full" id={id}>
      {/* Trigger input */}
      <div
        className={`
          w-full flex items-center justify-between
          rounded-xl bg-[#111113] border px-4 py-3
          text-sm outline-none transition-all duration-200 focus-within:border-accent-indigo focus-within:ring-1 focus-within:ring-accent-indigo/50
          ${open
            ? "border-accent-indigo ring-1 ring-accent-indigo/50"
            : "border-white/10 hover:border-white/20"
          }
        `}
      >
        <input
          type="text"
          value={isMounted ? inputValue : ""}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="bg-transparent text-white outline-none w-full placeholder:text-gray-600"
        />
        <CalendarDays
          className={`h-4 w-4 flex-shrink-0 transition-colors cursor-pointer ${
            open ? "text-accent-indigo" : "text-gray-500 hover:text-white"
          }`}
          onClick={() => setOpen((v) => !v)}
        />
      </div>

      {/* Popover */}
      {isMounted && open && (
        <div
          className={`
            absolute z-50 mt-2 w-full min-w-[300px] rounded-2xl
            bg-[#111113]/95 backdrop-blur-xl
            border border-white/10
            shadow-[0_24px_64px_rgba(0,0,0,0.6)]
            p-4
            animate-in fade-in slide-in-from-top-2 duration-150
          `}
          role="dialog"
          aria-label="Date picker calendar"
        >
          {viewMode === "calendar" && (
            <>
              {/* ── Month / Year Navigation ── */}
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode("year")}
                  className="text-sm font-semibold text-white tracking-wide hover:bg-white/10 px-3 py-1 rounded-lg transition-colors"
                >
                  {MONTHS_LONG[viewMonth]} {viewYear}
                </button>

                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* ── Day-of-week Header ── */}
              <div className="grid grid-cols-7 mb-2">
                {DAYS_SHORT.map((dow) => (
                  <div
                    key={dow}
                    className="text-center text-[10px] font-bold text-gray-600 uppercase tracking-wider py-1"
                  >
                    {dow}
                  </div>
                ))}
              </div>

              {/* ── Day Grid ── */}
              <div className="grid grid-cols-7 gap-y-1">
                {cells.map((cell, idx) => {
                  const isSelected =
                    parsed?.year === cell.year &&
                    parsed?.month === cell.month &&
                    parsed?.day === cell.day;

                  const isToday =
                    today.year === cell.year &&
                    today.month === cell.month &&
                    today.day === cell.day;

                  const disabled = isDayDisabled(cell.year, cell.month, cell.day);

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={disabled}
                      onClick={() => selectDay(cell.year, cell.month, cell.day)}
                      aria-label={`${cell.day} ${MONTHS_LONG[cell.month]} ${cell.year}`}
                      aria-pressed={isSelected}
                      className={`
                        relative mx-auto flex h-8 w-8 items-center justify-center rounded-full
                        text-[12px] font-medium transition-all duration-150
                        ${disabled
                          ? "opacity-20 cursor-not-allowed"
                          : "cursor-pointer hover:bg-white/10"
                        }
                        ${!cell.isCurrentMonth && !disabled ? "text-gray-600" : ""}
                        ${cell.isCurrentMonth && !isSelected && !disabled ? "text-gray-300" : ""}
                        ${isSelected
                          ? "bg-accent-indigo text-white shadow-[0_0_12px_rgba(99,102,241,0.4)] font-bold"
                          : ""
                        }
                        ${isToday && !isSelected ? "ring-1 ring-accent-indigo/50 text-white" : ""}
                      `}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {viewMode === "year" && (
            <div className="flex flex-col h-[280px]">
              <div className="text-center mb-4">
                <span className="text-sm font-semibold text-white tracking-wide">Select Year</span>
              </div>
              <div className="grid grid-cols-4 gap-2 overflow-y-auto pr-1 custom-scrollbar pb-2">
                {yearCells.map((y) => (
                  <button
                    key={y}
                    onClick={() => selectYear(y)}
                    className={`
                      py-2 rounded-lg text-xs font-medium transition-colors
                      ${viewYear === y ? "bg-accent-indigo text-white shadow-[0_0_10px_rgba(99,102,241,0.3)]" : "text-gray-400 hover:bg-white/10 hover:text-white"}
                    `}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          )}

          {viewMode === "month" && (
            <div className="flex flex-col h-[280px]">
              <div className="flex justify-between items-center mb-4">
                <button
                  type="button"
                  onClick={() => setViewMode("year")}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold text-white tracking-wide">{viewYear}</span>
                <div className="w-7"></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MONTHS_LONG.map((m, idx) => (
                  <button
                    key={m}
                    onClick={() => selectMonth(idx)}
                    className={`
                      py-3 rounded-lg text-xs font-medium transition-colors
                      ${viewMonth === idx ? "bg-accent-indigo text-white shadow-[0_0_10px_rgba(99,102,241,0.3)]" : "text-gray-400 hover:bg-white/10 hover:text-white"}
                    `}
                  >
                    {m.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Footer quick-nav ── */}
          <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center">
            <button
              type="button"
              onClick={() => {
                const maxD = maxParsed ?? today;
                setViewYear(maxD.year);
                setViewMonth(maxD.month);
                setViewMode("calendar");
                onChange(toISO(maxD.year, maxD.month, maxD.day));
              }}
              className="text-[10px] text-gray-500 hover:text-accent-indigo transition-colors uppercase tracking-wider font-bold"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[10px] text-gray-500 hover:text-white transition-colors uppercase tracking-wider font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
