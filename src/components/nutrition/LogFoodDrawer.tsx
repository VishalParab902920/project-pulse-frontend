"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Loader2, Flame, Beef, Wheat, Droplets, CheckCircle2, ChevronDown } from "lucide-react";
import { useDateStore } from "@/store/useDateStore";
import { useSyncStore } from "@/store/useSyncStore";
import { useUserStore } from "@/store/useUserStore";
import { calculateBaseQty, calculateMacros } from "@/lib/conversions";
import type { Food, FoodMeasure, MealType } from "@/lib/types/nutrition";

/**
 * LogFoodDrawer — V2.5 Multi-Measure Food Logging Interface
 *
 * Features:
 * - Verified badge on food header
 * - Numeric quantity input with decimal sanitizer
 * - Measure dropdown from food.measures
 * - Quick-adjust increment chips
 * - 0ms real-time macro preview
 * - Optimistic submission via Zustand sync store
 */

interface LogFoodDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  food: Food;
  mealType: MealType;
  onLogged: () => void;
}

/** Sanitize decimal input — digits + single period only, comma → period */
function sanitizeQuantity(raw: string): string {
  let value = raw.replace(/,/g, ".");
  value = value.replace(/[^0-9.]/g, "");
  const parts = value.split(".");
  if (parts.length > 2) {
    value = parts[0] + "." + parts.slice(1).join("");
  }
  return value;
}

const QUICK_INCREMENTS = [-1, -0.5, 0.5, 1] as const;

export default function LogFoodDrawer({
  isOpen,
  onClose,
  food,
  mealType,
  onLogged,
}: LogFoodDrawerProps) {
  const { selectedDate } = useDateStore();
  const { createOfflineLog } = useSyncStore();
  const userProfile = useUserStore((s) => s.userProfile);
  const userId = userProfile?.id ?? "";

  const [quantityInput, setQuantityInput] = useState("1");
  const [selectedMeasureId, setSelectedMeasureId] = useState<string>(
    () => food.measures.find((m) => m.is_default)?.id ?? food.measures[0]?.id ?? ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [measureOpen, setMeasureOpen] = useState(false);
  const measureRef = useRef<HTMLDivElement>(null);

  // Resolve selected measure
  const selectedMeasure: FoodMeasure | null = useMemo(
    () => food.measures.find((m) => m.id === selectedMeasureId) ?? null,
    [food.measures, selectedMeasureId]
  );

  // Close measure dropdown on outside click
  useEffect(() => {
    if (!measureOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (measureRef.current && !measureRef.current.contains(e.target as Node)) {
        setMeasureOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [measureOpen]);

  // Parse quantity
  const parsedQty = useMemo(() => {
    const val = parseFloat(quantityInput);
    return isNaN(val) || val <= 0 ? 0 : val;
  }, [quantityInput]);

  // 0ms real-time macro preview
  const previewMacros = useMemo(() => {
    if (!selectedMeasure || parsedQty <= 0) {
      return { calculated_calories: 0, calculated_protein: 0, calculated_carbs: 0, calculated_fat: 0, baseQty: 0 };
    }
    const baseQty = calculateBaseQty(parsedQty, selectedMeasure.conversion_factor);
    const macros = calculateMacros(
      baseQty,
      food.calories_per_100,
      food.protein_per_100,
      food.carbs_per_100,
      food.fat_per_100
    );
    return { ...macros, baseQty };
  }, [parsedQty, selectedMeasure, food]);

  // Quantity input handler
  const handleQuantityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeQuantity(e.target.value);
    setQuantityInput(sanitized);
  }, []);

  // Quick increment handler
  const handleIncrement = useCallback((increment: number) => {
    const currentVal = parseFloat(quantityInput) || 0;
    const nextVal = Math.max(0, currentVal + increment);
    setQuantityInput(nextVal === 0 ? "0" : nextVal.toString());
  }, [quantityInput]);

  // Submit — optimistic diary creation
  const handleSubmit = useCallback(async () => {
    if (!selectedMeasure || parsedQty <= 0) return;

    setIsSubmitting(true);
    try {
      const loggedAt = new Date(`${selectedDate}T12:00:00`).toISOString();

      await createOfflineLog({
        food_id: food.id,
        measure_id: selectedMeasure.id,
        quantity: parsedQty,
        meal_type: mealType,
        logged_at: loggedAt,
        food,
        userId: userId || "pending",
        targetDate: selectedDate,
      });

      onLogged();
      onClose();
    } catch (err) {
      console.error("[LogFoodDrawer] Submit failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedMeasure, parsedQty, userId, selectedDate, food, mealType, createOfflineLog, onLogged, onClose]);

  const isValid = parsedQty > 0 && selectedMeasure !== null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t border-white/10 overflow-hidden flex flex-col"
            style={{ background: "#050505" }}
          >
            {/* Handle Bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header with Verified Badge */}
            <div className="flex items-center justify-between px-5 pb-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-white truncate">{food.name}</h2>
                  {food.is_verified && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)] flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 fill-emerald-400/10" />
                      Verified
                    </span>
                  )}
                </div>
                {food.brand && (
                  <p className="text-[10px] text-gray-500 truncate mt-0.5">{food.brand}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 transition-colors"
                aria-label="Close drawer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="px-5 pb-6 space-y-4">
              {/* Quantity + Serving Unit — Glassmorphic Control Panel */}
              <div className="flex gap-3 items-end">
                {/* Numeric Quantity Box */}
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Quantity
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={quantityInput}
                    onChange={handleQuantityChange}
                    placeholder="1.0"
                    className="w-full bg-zinc-950/80 border border-white/10 rounded-lg py-3 px-4 text-white text-lg font-bold focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all"
                  />
                </div>

                {/* Serving Unit — Custom Dropdown */}
                <div className="flex-[1.5] flex flex-col gap-1.5 relative" ref={measureRef}>
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Serving Unit
                  </label>
                  <button
                    type="button"
                    onClick={() => setMeasureOpen(!measureOpen)}
                    className="w-full bg-zinc-950/80 border border-white/10 rounded-lg py-3 px-4 text-left flex items-center justify-between gap-2 focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all"
                  >
                    <span className="text-white text-sm font-bold truncate">
                      {selectedMeasure ? selectedMeasure.measure_name : "Select"}
                    </span>
                    <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform ${measureOpen ? "rotate-180" : ""}`} />
                  </button>

                  {/* Dropdown Options */}
                  <AnimatePresence>
                    {measureOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl bg-[#0a0a0a] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl overflow-hidden max-h-48 overflow-y-auto"
                      >
                        {food.measures.map((measure) => {
                          const isActive = measure.id === selectedMeasureId;
                          return (
                            <button
                              key={measure.id}
                              type="button"
                              onClick={() => {
                                setSelectedMeasureId(measure.id);
                                setMeasureOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                                isActive
                                  ? "bg-cyan-500/10 border-l-2 border-cyan-400"
                                  : "hover:bg-white/5 border-l-2 border-transparent"
                              }`}
                            >
                              <div>
                                <p className={`text-sm font-semibold ${isActive ? "text-cyan-400" : "text-white"}`}>
                                  {measure.measure_name}
                                </p>
                                <p className="text-[10px] text-zinc-500">
                                  {Number(measure.conversion_factor)} {food.base_unit}
                                </p>
                              </div>
                              {isActive && (
                                <Check className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Quick-Adjust Increment Chips */}
              <div className="flex gap-2">
                {QUICK_INCREMENTS.map((increment) => (
                  <button
                    key={increment}
                    type="button"
                    onClick={() => handleIncrement(increment)}
                    className="bg-white/5 border border-white/5 hover:border-white/20 text-zinc-300 text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-white/10 transition-all cursor-pointer"
                  >
                    {increment > 0 ? `+${increment}` : increment}
                  </button>
                ))}
              </div>

              {/* Base quantity indicator */}
              {previewMacros.baseQty > 0 && selectedMeasure && selectedMeasure.measure_name !== food.base_unit && (
                <p className="text-[10px] text-gray-500">
                  = {previewMacros.baseQty} {food.base_unit}
                </p>
              )}

              {/* Real-Time Macro Preview Card */}
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4 backdrop-blur-xl">
                {/* Calories — Big Glowing Display */}
                <div className="text-center mb-3">
                  <div className="inline-flex items-center gap-2">
                    <Flame className="h-4 w-4 text-cyan-400" />
                    <span className="text-2xl font-bold text-cyan-400 tabular-nums drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]">
                      {previewMacros.calculated_calories}
                    </span>
                    <span className="text-xs text-gray-500">kcal</span>
                  </div>
                </div>

                {/* Macro Badges — P/C/F */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-purple-500/[0.08] border border-purple-500/20 p-2.5 text-center">
                    <Beef className="h-3 w-3 text-purple-400 mx-auto mb-1" />
                    <p className="text-sm font-bold text-purple-400 tabular-nums drop-shadow-[0_0_6px_rgba(168,85,247,0.3)]">
                      {previewMacros.calculated_protein}g
                    </p>
                    <p className="text-[9px] text-gray-500">Protein</p>
                  </div>
                  <div className="rounded-xl bg-indigo-500/[0.08] border border-indigo-500/20 p-2.5 text-center">
                    <Wheat className="h-3 w-3 text-indigo-400 mx-auto mb-1" />
                    <p className="text-sm font-bold text-indigo-400 tabular-nums drop-shadow-[0_0_6px_rgba(99,102,241,0.3)]">
                      {previewMacros.calculated_carbs}g
                    </p>
                    <p className="text-[9px] text-gray-500">Carbs</p>
                  </div>
                  <div className="rounded-xl bg-cyan-500/[0.08] border border-cyan-500/20 p-2.5 text-center">
                    <Droplets className="h-3 w-3 text-cyan-400 mx-auto mb-1" />
                    <p className="text-sm font-bold text-cyan-400 tabular-nums drop-shadow-[0_0_6px_rgba(6,182,212,0.3)]">
                      {previewMacros.calculated_fat}g
                    </p>
                    <p className="text-[9px] text-gray-500">Fat</p>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={!isValid || isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40 transition-all bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 shadow-[0_0_20px_rgba(168,85,247,0.25)] hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Log {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
