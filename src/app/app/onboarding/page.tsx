"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Activity, Check, ChevronDown } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { apiFetch } from "@/lib/api";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type Gender = "male" | "female";
type ActivityLevel = "sedentary" | "light" | "moderate" | "active";
type FitnessGoal = "cut" | "maintain" | "bulk";

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary (office job, little exercise)",
  light: "Light (1–3 days/week)",
  moderate: "Moderate (3–5 days/week)",
  active: "Active (6–7 days/week)",
};

const GOAL_LABELS: Record<FitnessGoal, string> = {
  cut: "Cut",
  maintain: "Maintain",
  bulk: "Bulk",
};

interface MacroSplit {
  targetCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
}

function calculateBMR(gender: Gender, weightKg: number, heightCm: number, ageYears: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return gender === "male" ? base + 5 : base - 161;
}

function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return bmr * ACTIVITY_MULTIPLIERS[activityLevel];
}

function calculateMacros(tdee: number, goal: FitnessGoal): MacroSplit {
  let targetCalories: number;
  let proteinPct: number;
  let carbsPct: number;
  let fatPct: number;

  switch (goal) {
    case "cut":
      targetCalories = tdee - 500;
      proteinPct = 0.4;
      carbsPct = 0.3;
      fatPct = 0.3;
      break;
    case "bulk":
      targetCalories = tdee + 300;
      proteinPct = 0.3;
      carbsPct = 0.5;
      fatPct = 0.2;
      break;
    default:
      targetCalories = tdee;
      proteinPct = 0.3;
      carbsPct = 0.4;
      fatPct = 0.3;
      break;
  }

  return {
    targetCalories: Math.round(targetCalories),
    proteinG: Math.round((targetCalories * proteinPct) / 4),
    carbsG: Math.round((targetCalories * carbsPct) / 4),
    fatG: Math.round((targetCalories * fatPct) / 9),
    proteinPct: proteinPct * 100,
    carbsPct: carbsPct * 100,
    fatPct: fatPct * 100,
  };
}

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// =============================================================
// Inline Editable Numeric Value
// =============================================================

function InlineNumericValue({
  value,
  unit,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitValue = () => {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed) && parsed >= min && parsed <= max) {
      onChange(Math.round(parsed / step) * step);
    } else {
      setInputValue(value.toString());
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={commitValue}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitValue();
            if (e.key === "Escape") {
              setInputValue(value.toString());
              setIsEditing(false);
            }
          }}
          className="w-16 rounded-lg bg-white/10 border border-accent-purple px-2 py-0.5 text-sm font-semibold text-white text-center outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-xs text-gray-400">{unit}</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        setInputValue(value.toString());
        setIsEditing(true);
      }}
      className="text-sm font-semibold text-white hover:text-accent-purple transition-colors cursor-text"
    >
      {value} {unit}
    </button>
  );
}

// =============================================================
// Custom Glassmorphic Dropdown
// =============================================================

function CustomDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { key: string; label: string }[];
  onChange: (key: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel = options.find((o) => o.key === value)?.label || value;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none transition-all hover:border-white/20 focus:border-accent-purple focus:ring-1 focus:ring-accent-purple/50"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full rounded-xl backdrop-blur-xl bg-neutral-950/95 border border-white/10 shadow-xl overflow-hidden"
          >
            {options.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  onChange(option.key);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  option.key === value
                    ? "bg-accent-purple/15 text-white"
                    : "text-gray-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================
// Main Onboarding Page
// =============================================================

export default function OnboardingPage() {
  const router = useRouter();
  const { accessToken: storeToken } = useUserStore();

  // Hydration guard: prevent SSR from evaluating browser-only APIs
  const [isMounted, setIsMounted] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    // Safely read the cookie only on the client after mount
    const token = storeToken || document.cookie
      .split(";")
      .find((c) => c.trim().startsWith("sb-access-token="))
      ?.split("=")
      .slice(1)
      .join("=") || null;
    setAccessToken(token);
  }, [storeToken]);

  const [gender, setGender] = useState<Gender | null>(null);
  const [dob, setDob] = useState("");
  const [heightCm, setHeightCm] = useState(170);
  const [weightKg, setWeightKg] = useState(70);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");
  const [fitnessGoal, setFitnessGoal] = useState<FitnessGoal>("maintain");
  const [prefilled, setPrefilled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculations = useMemo(() => {
    if (!gender || !dob) return null;
    const age = calculateAge(dob);
    if (age < 10 || age > 120) return null;
    const bmr = calculateBMR(gender, weightKg, heightCm, age);
    const tdee = calculateTDEE(bmr, activityLevel);
    const macros = calculateMacros(tdee, fitnessGoal);
    return { bmr: Math.round(bmr), tdee: Math.round(tdee), ...macros };
  }, [gender, dob, weightKg, heightCm, activityLevel, fitnessGoal]);

  const isFormValid = gender && dob && heightCm > 0 && weightKg > 0;

  const handleSubmit = useCallback(async () => {
    if (!isFormValid || !calculations) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/v2/profile/biometrics`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gender,
          dob,
          height_cm: heightCm,
          activity_level: activityLevel,
          fitness_goal: fitnessGoal,
          calculated_bmr: calculations.bmr,
          calculated_tdee: calculations.tdee,
          target_calories: calculations.targetCalories,
          target_protein_g: calculations.proteinG,
          target_carbs_g: calculations.carbsG,
          target_fat_g: calculations.fatG,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to save biometrics");
      }

      router.replace("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  }, [isFormValid, calculations, gender, dob, heightCm, activityLevel, fitnessGoal, accessToken, router]);

  // Prefill from existing biometrics if editing
  useEffect(() => {
    if (!accessToken || prefilled) return;

    apiFetch(`/api/v2/profile/biometrics`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.target_calories) {
          if (data.gender) setGender(data.gender as Gender);
          if (data.dob) setDob(data.dob);
          if (data.height_cm) setHeightCm(data.height_cm);
          if (data.activity_level) setActivityLevel(data.activity_level as ActivityLevel);
          if (data.fitness_goal) setFitnessGoal(data.fitness_goal as FitnessGoal);
        }
        setPrefilled(true);
      })
      .catch(() => setPrefilled(true));
  }, [accessToken, prefilled]);

  // Show loading spinner until client is mounted (prevents hydration mismatch).
  // IMPORTANT: This early-return MUST be placed AFTER all hook declarations above.
  if (!isMounted || (!prefilled && accessToken)) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-4 py-8 bg-[#050505]">
        <div className="w-full max-w-lg">
          {/* Shimmer Skeleton */}
          <div className="text-center mb-8">
            <div className="inline-flex h-12 w-12 rounded-2xl bg-white/5 animate-pulse mb-4" />
            <div className="h-6 w-48 rounded-lg bg-white/5 animate-pulse mx-auto mb-2" />
            <div className="h-4 w-64 rounded-lg bg-white/5 animate-pulse mx-auto" />
          </div>
          <div className="glass-card p-6 space-y-6">
            {/* Gender skeleton */}
            <div>
              <div className="h-3 w-16 rounded bg-white/5 animate-pulse mb-2" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-12 rounded-xl bg-white/5 animate-pulse" />
                <div className="h-12 rounded-xl bg-white/5 animate-pulse" />
              </div>
            </div>
            {/* DOB skeleton */}
            <div>
              <div className="h-3 w-24 rounded bg-white/5 animate-pulse mb-1.5" />
              <div className="h-12 rounded-xl bg-white/5 animate-pulse" />
            </div>
            {/* Height skeleton */}
            <div>
              <div className="flex justify-between mb-1.5">
                <div className="h-3 w-12 rounded bg-white/5 animate-pulse" />
                <div className="h-3 w-16 rounded bg-white/5 animate-pulse" />
              </div>
              <div className="h-2 rounded-full bg-white/5 animate-pulse" />
            </div>
            {/* Weight skeleton */}
            <div>
              <div className="flex justify-between mb-1.5">
                <div className="h-3 w-12 rounded bg-white/5 animate-pulse" />
                <div className="h-3 w-16 rounded bg-white/5 animate-pulse" />
              </div>
              <div className="h-2 rounded-full bg-white/5 animate-pulse" />
            </div>
            {/* Activity skeleton */}
            <div>
              <div className="h-3 w-24 rounded bg-white/5 animate-pulse mb-1.5" />
              <div className="h-12 rounded-xl bg-white/5 animate-pulse" />
            </div>
            {/* Goal skeleton */}
            <div>
              <div className="h-3 w-20 rounded bg-white/5 animate-pulse mb-2" />
              <div className="grid grid-cols-3 gap-2">
                <div className="h-10 rounded-xl bg-white/5 animate-pulse" />
                <div className="h-10 rounded-xl bg-white/5 animate-pulse" />
                <div className="h-10 rounded-xl bg-white/5 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-lg"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl ai-glow mb-4">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Set Your Baseline</h1>
          <p className="text-sm text-gray-500 mt-1">
            We&apos;ll calculate your daily targets based on your biology
          </p>
        </div>

        {/* Form Card */}
        <div className="glass-card p-6 space-y-6">
          {/* Gender */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Gender</label>
            <div className="grid grid-cols-2 gap-3">
              {(["male", "female"] as Gender[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all duration-200 border ${
                    gender === g
                      ? "bg-accent-purple/20 border-accent-purple text-white"
                      : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                  }`}
                >
                  {gender === g && <Check className="h-3.5 w-3.5" />}
                  {g === "male" ? "Male" : "Female"}
                </button>
              ))}
            </div>
          </div>

          {/* DOB */}
          <div>
            <label htmlFor="dob" className="block text-xs font-medium text-gray-400 mb-1.5">
              Date of Birth
            </label>
            <input
              id="dob"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none transition-all focus:border-accent-purple focus:ring-1 focus:ring-accent-purple/50 [color-scheme:dark]"
            />
          </div>

          {/* Height */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-400">Height</label>
              <InlineNumericValue
                value={heightCm}
                unit="cm"
                min={120}
                max={220}
                step={1}
                onChange={setHeightCm}
              />
            </div>
            <input
              type="range"
              min={120}
              max={220}
              step={1}
              value={heightCm}
              onChange={(e) => setHeightCm(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none bg-white/10 accent-accent-purple cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-600 mt-1">
              <span>120 cm</span>
              <span>220 cm</span>
            </div>
          </div>

          {/* Weight */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-400">Weight</label>
              <InlineNumericValue
                value={weightKg}
                unit="kg"
                min={30}
                max={200}
                step={0.5}
                onChange={setWeightKg}
              />
            </div>
            <input
              type="range"
              min={30}
              max={200}
              step={0.5}
              value={weightKg}
              onChange={(e) => setWeightKg(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none bg-white/10 accent-accent-purple cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-600 mt-1">
              <span>30 kg</span>
              <span>200 kg</span>
            </div>
          </div>

          {/* Activity Level — Custom Dropdown */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Activity Level
            </label>
            <CustomDropdown
              value={activityLevel}
              options={Object.entries(ACTIVITY_LABELS).map(([key, label]) => ({
                key,
                label,
              }))}
              onChange={(key) => setActivityLevel(key as ActivityLevel)}
            />
          </div>

          {/* Fitness Goal */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Fitness Goal</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(GOAL_LABELS) as FitnessGoal[]).map((goal) => (
                <button
                  key={goal}
                  type="button"
                  onClick={() => setFitnessGoal(goal)}
                  className={`flex items-center justify-center rounded-xl py-2.5 text-xs font-medium transition-all duration-200 border ${
                    fitnessGoal === goal
                      ? "bg-accent-purple/20 border-accent-purple text-white"
                      : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                  }`}
                >
                  {GOAL_LABELS[goal]}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Visualization */}
          {calculations && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.3 }}
              className="rounded-xl bg-white/[0.03] border border-white/5 p-4 space-y-4"
            >
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                  Your Daily Target
                </p>
                <p className="text-3xl font-bold text-white">
                  {calculations.targetCalories}
                  <span className="text-sm font-normal text-gray-400 ml-1">kcal</span>
                </p>
                <p className="text-[10px] text-gray-600 mt-1">
                  BMR: {calculations.bmr} kcal • TDEE: {calculations.tdee} kcal
                </p>
              </div>

              <div className="space-y-3">
                <MacroBar label="Protein" pct={calculations.proteinPct} grams={calculations.proteinG} color="bg-accent-cyan" />
                <MacroBar label="Carbs" pct={calculations.carbsPct} grams={calculations.carbsG} color="bg-accent-purple" />
                <MacroBar label="Fat" pct={calculations.fatPct} grams={calculations.fatG} color="bg-accent-indigo" />
              </div>
            </motion.div>
          )}

          {/* Error */}
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-status-rose bg-status-rose/10 border border-status-rose/20 rounded-lg px-3 py-2"
            >
              {error}
            </motion.p>
          )}

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isFormValid || !calculations || isSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-indigo via-accent-purple to-accent-cyan py-3.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(168,85,247,0.3)]"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4" />
                Set My Targets
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function MacroBar({ label, pct, grams, color }: { label: string; pct: number; grams: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">{label} ({pct}%)</span>
        <span className="text-xs font-semibold text-white">{grams}g</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
