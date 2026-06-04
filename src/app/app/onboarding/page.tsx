"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { globalMutate } from "@/hooks/useSWR";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Activity, ChevronDown, Camera, Ruler,
  AlertCircle, ChevronLeft, ChevronRight, Zap, CheckSquare, Square,
} from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { apiFetch } from "@/lib/api";
import { calculateAge } from "@/lib/utils/date";
import {
  calculateBMR,
  calculateTDEE,
  calculateNavyBodyFat,
} from "@/lib/utils/calculators";
import CustomDatePicker from "@/components/ui/CustomDatePicker";

// ─────────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────────

type Gender = "male" | "female" | "other";
type ActivityLevel =
  | "sedentary"
  | "lightly_active"
  | "moderately_active"
  | "highly_active"
  | "competitive_athlete";
type FitnessGoal =
  | "extreme_cut"
  | "cut"
  | "maintain"
  | "lean_bulk"
  | "aggressive_bulk";

type BodyFatTab = "manual" | "ai" | "tape";

const MAJOR_ALLERGENS = [
  "peanuts", "tree nuts", "dairy", "eggs", "wheat", "soy", "fish", "shellfish", "sesame",
];

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary (desk job, minimal exercise)",
  lightly_active: "Lightly Active (1–3 days/week)",
  moderately_active: "Moderately Active (3–5 days/week)",
  highly_active: "Highly Active (6–7 days/week)",
  competitive_athlete: "Competitive Athlete (dual sessions)",
};

const GOAL_LABELS: Record<FitnessGoal, string> = {
  extreme_cut: "Extreme Cut",
  cut: "Cut",
  maintain: "Maintain",
  lean_bulk: "Lean Bulk",
  aggressive_bulk: "Aggressive Bulk",
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

function calculateMacros(tdee: number, goal: FitnessGoal): MacroSplit {
  let targetCalories = tdee;
  let proteinPct = 0.35;
  let carbsPct = 0.35;
  let fatPct = 0.3;

  switch (goal) {
    case "extreme_cut":
      targetCalories = tdee - 750;
      proteinPct = 0.45; carbsPct = 0.25; fatPct = 0.3;
      break;
    case "cut":
      targetCalories = tdee - 500;
      proteinPct = 0.4; carbsPct = 0.3; fatPct = 0.3;
      break;
    case "lean_bulk":
      targetCalories = tdee + 300;
      proteinPct = 0.3; carbsPct = 0.45; fatPct = 0.25;
      break;
    case "aggressive_bulk":
      targetCalories = tdee + 500;
      proteinPct = 0.25; carbsPct = 0.5; fatPct = 0.25;
      break;
    case "maintain":
      targetCalories = tdee;
      proteinPct = 0.3; carbsPct = 0.4; fatPct = 0.3;
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

/** Clamp and round BF% to 1 decimal place; returns null if invalid */
function sanitizeBf(raw: number | null): number | null {
  if (raw === null || isNaN(raw) || raw < 1 || raw > 60) return null;
  return parseFloat(raw.toFixed(1));
}

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

export default function OnboardingWizard() {
  const router = useRouter();
  const { accessToken: storeToken, isHydrated, updatePreferences } = useUserStore();

  const [isMounted, setIsMounted] = useState(false);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Step 1: Identity ────────────────────────────────────────────
  const [gender, setGender] = useState<Gender | null>(null);
  const [dob, setDob] = useState("");
  const age = useMemo(() => (dob ? calculateAge(dob) : null), [dob]);

  const todayISO = useMemo(() => new Date().toISOString().split("T")[0], []);

  // ── Step 2: Vitals ──────────────────────────────────────────────
  const [isMetricHeight, setIsMetricHeight] = useState(true);
  const [heightCm, setHeightCm] = useState<string>("");
  const [heightFt, setHeightFt] = useState<string>("");
  const [heightIn, setHeightIn] = useState<string>("");

  const [isMetricWeight, setIsMetricWeight] = useState(true);
  const [weightKg, setWeightKg] = useState<string>("");
  const [weightLbs, setWeightLbs] = useState<string>("");

  const handleHeightUnitToggle = (toMetric: boolean) => {
    if (toMetric && !isMetricHeight) {
      const ft = Number(heightFt) || 0;
      const inch = Number(heightIn) || 0;
      const cm = (ft * 12 + inch) * 2.54;
      setHeightCm(cm > 0 ? cm.toFixed(1) : "");
    } else if (!toMetric && isMetricHeight) {
      const cm = Number(heightCm) || 0;
      const totalInches = cm / 2.54;
      setHeightFt(cm > 0 ? Math.floor(totalInches / 12).toString() : "");
      setHeightIn(cm > 0 ? (totalInches % 12).toFixed(1) : "");
    }
    setIsMetricHeight(toMetric);
  };

  const handleWeightUnitToggle = (toMetric: boolean) => {
    if (toMetric && !isMetricWeight) {
      const lbs = Number(weightLbs) || 0;
      setWeightKg(lbs > 0 ? (lbs / 2.20462).toFixed(1) : "");
    } else if (!toMetric && isMetricWeight) {
      const kg = Number(weightKg) || 0;
      setWeightLbs(kg > 0 ? (kg * 2.20462).toFixed(1) : "");
    }
    setIsMetricWeight(toMetric);
  };

  const finalHeightCm = isMetricHeight
    ? Number(heightCm)
    : Math.round((Number(heightFt) * 12 + Number(heightIn)) * 2.54);
  const finalWeightKg = isMetricWeight
    ? Number(weightKg)
    : Number(weightLbs) / 2.20462;

  // ── Body Fat State ──────────────────────────────────────────────
  /**
   * `activeTab` tracks which BF method panel is shown.
   * `resolvedBodyFatPct` is the VERIFIED value from an explicit "Analyze" action
   * (or live manual entry). It is the sole gate for the Continue button.
   */
  const [activeTab, setActiveTab] = useState<BodyFatTab>("manual");
  const [resolvedBodyFatPct, setResolvedBodyFatPct] = useState<number | null>(null);

  // Manual tab
  const [manualBfInput, setManualBfInput] = useState<string>("");

  // Tape tab
  const [navyWaist, setNavyWaist] = useState<number | "">("");
  const [navyNeck, setNavyNeck] = useState<number | "">("");
  const [navyHip, setNavyHip] = useState<number | "">("");
  const [tapeResult, setTapeResult] = useState<number | null>(null);
  const [tapeGlow, setTapeGlow] = useState(false);

  // AI tab
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stagedAIFile, setStagedAIFile] = useState<File | null>(null);
  const [aiConsentChecked, setAiConsentChecked] = useState(false);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [aiResult, setAiResult] = useState<number | null>(null);
  const [aiGlow, setAiGlow] = useState(false);

  // Reset resolved BF when tab switches so the new tab must "earn" its value
  const handleTabSwitch = (tab: BodyFatTab) => {
    setActiveTab(tab);
    setResolvedBodyFatPct(null);
    setTapeResult(null);
    setAiResult(null);
    setAiGlow(false);
    setTapeGlow(false);
    setError(null);
  };

  // Live update for manual tab
  useEffect(() => {
    if (activeTab !== "manual") return;
    const raw = parseFloat(manualBfInput);
    setResolvedBodyFatPct(sanitizeBf(isNaN(raw) ? null : raw));
  }, [manualBfInput, activeTab]);

  // Clear calculation/validation errors when inputs or tabs are modified
  useEffect(() => {
    setError(null);
  }, [gender, age, finalHeightCm, finalWeightKg, isMetricHeight, heightFt, heightIn, weightKg, weightLbs, navyWaist, navyNeck, navyHip, manualBfInput, stagedAIFile, activeTab]);

  // ── Step 3: Lifestyle ───────────────────────────────────────────
  const [allergies, setAllergies] = useState<string[]>([]);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderately_active");
  const [activityDropdownOpen, setActivityDropdownOpen] = useState(false);
  const [fitnessGoal, setFitnessGoal] = useState<FitnessGoal>("maintain");

  const toggleAllergy = (a: string) => {
    setAllergies((prev) => prev.includes(a) ? prev.filter((i) => i !== a) : [...prev, a]);
  };

  // ── Hydration guard ─────────────────────────────────────────────
  useEffect(() => { setIsMounted(true); }, []);

  // ── Tape Analyzer ───────────────────────────────────────────────
  const handleAnalyzeTape = useCallback(() => {
    setError(null);
    if (!gender || finalHeightCm <= 0) return;
    if (typeof navyWaist !== "number" || typeof navyNeck !== "number") return;
    if (gender === "female" && typeof navyHip !== "number") return;

    const heightVal = isMetricHeight
      ? finalHeightCm
      : (Number(heightFt) * 12 + Number(heightIn));

    const bf = calculateNavyBodyFat(
      gender === "other" ? "male" : gender,
      navyWaist,
      navyNeck,
      heightVal,
      typeof navyHip === "number" ? navyHip : 0,
      isMetricHeight
    );

    const sanitized = sanitizeBf(isNaN(bf) ? null : bf);
    if (sanitized === null) {
      setError("Body fat calculation failed. Please ensure your measurements (neck, waist, hip) are realistic for your height.");
      return;
    }

    setTapeResult(sanitized);
    setResolvedBodyFatPct(sanitized);
    setTapeGlow(true);
    setTimeout(() => setTapeGlow(false), 2000);
  }, [gender, finalHeightCm, navyWaist, navyNeck, navyHip, isMetricHeight, heightFt, heightIn]);

  // ── AI Analyzer ─────────────────────────────────────────────────
  const handleAnalyzeAI = useCallback(async () => {
    if (!stagedAIFile || !aiConsentChecked || !gender || age === null) return;

    setIsAnalyzingAI(true);
    setError(null);

    try {
      const reader = new FileReader();
      const base64String: string = await new Promise((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] ?? "");
        };
        reader.onerror = () => reject(new Error("File read failed"));
        reader.readAsDataURL(stagedAIFile);
      });

      const res = await apiFetch(`/api/v2/profile/estimate-body-fat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: base64String,
          gender,
          age,
          height_cm: finalHeightCm,
          weight_kg: finalWeightKg,
        }),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.detail ?? "AI analysis failed");
      }

      const data = await res.json();
      const sanitized = sanitizeBf(
        typeof data.estimated_body_fat === "number" ? data.estimated_body_fat : null
      );
      if (sanitized === null) throw new Error("AI returned an invalid body fat value.");

      setAiResult(sanitized);
      setResolvedBodyFatPct(sanitized);
      setAiGlow(true);
      setTimeout(() => setAiGlow(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI body fat estimation failed.");
    } finally {
      setIsAnalyzingAI(false);
    }
  }, [stagedAIFile, aiConsentChecked, gender, age, finalHeightCm, finalWeightKg]);

  // ── Calculations ────────────────────────────────────────────────
  const calculations = useMemo(() => {
    if (!gender || age === null || finalHeightCm <= 0 || finalWeightKg <= 0) return null;
    const bmr = calculateBMR(
      finalWeightKg,
      finalHeightCm,
      age,
      gender === "other" ? "male" : gender,
      resolvedBodyFatPct ?? undefined
    );
    const tdee = calculateTDEE(bmr, activityLevel);
    const macros = calculateMacros(tdee, fitnessGoal);
    return { bmr: Math.round(bmr), tdee: Math.round(tdee), ...macros };
  }, [gender, age, finalHeightCm, finalWeightKg, activityLevel, fitnessGoal, resolvedBodyFatPct]);

  // ── Proceed gate ────────────────────────────────────────────────
  const canProceed = (): boolean => {
    if (step === 1) return !!(gender && dob && age !== null && age >= 13);
    if (step === 2) return finalHeightCm > 0 && finalWeightKg > 0 && resolvedBodyFatPct !== null;
    return true;
  };

  // ── Submit ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canProceed() || !calculations) return;
    setIsSubmitting(true);
    setError(null);

    // Resolve final BF% — already tab-authoritative via resolvedBodyFatPct.
    // Re-format to exactly 1 d.p. before transmit to prevent float drift.
    const payloadBF =
      resolvedBodyFatPct !== null
        ? parseFloat(resolvedBodyFatPct.toFixed(1))
        : null;

    try {
      await updatePreferences(
        isMetricWeight ? "metric" : "imperial",
        "metric",
        allergies
      );

      const res = await apiFetch(`/api/v2/profile/biometrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gender,
          dob,
          height_cm: finalHeightCm,
          weight_kg: finalWeightKg,
          body_fat_pct: payloadBF,
          activity_level: activityLevel,
          fitness_goal: fitnessGoal,
          allergies,
          calculated_bmr: calculations.bmr,
          calculated_tdee: calculations.tdee,
          target_calories: calculations.targetCalories,
          target_protein_g: calculations.proteinG,
          target_carbs_g: calculations.carbsG,
          target_fat_g: calculations.fatG,
        }),
      });

      if (!res.ok) throw new Error("Failed to save biometrics");

      globalMutate("/api/v2/profile/biometrics");
      globalMutate("/api/v2/profile/onboard");

      router.replace("/app/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── SSR guard ───────────────────────────────────────────────────
  if (!isMounted || !isHydrated) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-accent-indigo animate-spin" />
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center py-12 px-4 selection:bg-accent-indigo/30 overflow-x-hidden">

      {/* ── Progress bar ── */}
      <div className="w-full max-w-lg mb-8 flex justify-between items-center">
        <button
          onClick={() => (step > 1 ? setStep(step - 1) : router.back())}
          className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1.5 w-8 rounded-full transition-colors ${i <= step ? "bg-accent-indigo" : "bg-white/10"
                }`}
            />
          ))}
        </div>
      </div>

      <div className="w-full max-w-lg">
        <AnimatePresence mode="wait">

          {/* ═══════════════════════════════════════════
              STEP 1 — Biological Identity
          ═══════════════════════════════════════════ */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold">Biological Identity</h1>
                <p className="text-sm text-gray-500 mt-2">
                  Core data to tune your baseline equations.
                </p>
              </div>

              <div className="glass-card p-6 space-y-6">
                {/* Biological Sex */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                    Biological Sex
                  </label>
                  <div className="flex gap-2">
                    {(["male", "female", "other"] as Gender[]).map((g) => (
                      <button
                        key={g}
                        onClick={() => setGender(g)}
                        className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${gender === g
                            ? "bg-accent-indigo text-white shadow-[0_0_15px_rgba(99,102,241,0.2)] border-transparent"
                            : "bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10"
                          }`}
                      >
                        {g.charAt(0).toUpperCase() + g.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date of Birth — Custom Picker */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                    Date of Birth{" "}
                    {age !== null && (
                      <span className="text-accent-cyan normal-case tracking-normal ml-2">
                        (Age: {age} years)
                      </span>
                    )}
                  </label>
                  <CustomDatePicker
                    id="dob-picker"
                    value={dob}
                    onChange={setDob}
                    maxDate={todayISO}
                    placeholder="DD / MM / YYYY"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════
              STEP 2 — Vitals & Composition
          ═══════════════════════════════════════════ */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold">Vitals &amp; Composition</h1>
                <p className="text-sm text-gray-500 mt-2">
                  Precision telemetry for your metabolic footprint.
                </p>
              </div>

              <div className="glass-card p-6 space-y-6">

                {/* ── Height ── */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Height
                    </label>
                    <div className="flex bg-[#111113] rounded-pill p-1 border border-white/10">
                      <button
                        onClick={() => handleHeightUnitToggle(true)}
                        className={`px-3 py-1 rounded-pill text-[10px] font-bold ${isMetricHeight ? "bg-accent-indigo text-white" : "text-gray-500"
                          }`}
                      >
                        Metric
                      </button>
                      <button
                        onClick={() => handleHeightUnitToggle(false)}
                        className={`px-3 py-1 rounded-pill text-[10px] font-bold ${!isMetricHeight ? "bg-accent-indigo text-white" : "text-gray-500"
                          }`}
                      >
                        Imperial
                      </button>
                    </div>
                  </div>
                  {isMetricHeight ? (
                    <div className="relative">
                      <input
                        type="number"
                        value={heightCm}
                        onChange={(e) => setHeightCm(e.target.value.replace(/^0+/, ""))}
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-accent-indigo"
                        placeholder="175"
                      />
                      <span className="absolute right-4 top-3.5 text-gray-500 text-sm">cm</span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          value={heightFt}
                          onChange={(e) => setHeightFt(e.target.value.replace(/^0+/, ""))}
                          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-accent-indigo"
                          placeholder="5"
                        />
                        <span className="absolute right-4 top-3.5 text-gray-500 text-sm">ft</span>
                      </div>
                      <div className="relative flex-1">
                        <input
                          type="number"
                          value={heightIn}
                          onChange={(e) => setHeightIn(e.target.value.replace(/^0+/, ""))}
                          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-accent-indigo"
                          placeholder="9"
                        />
                        <span className="absolute right-4 top-3.5 text-gray-500 text-sm">in</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Weight ── */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Weight
                    </label>
                    <div className="flex bg-[#111113] rounded-pill p-1 border border-white/10">
                      <button
                        onClick={() => handleWeightUnitToggle(true)}
                        className={`px-3 py-1 rounded-pill text-[10px] font-bold ${isMetricWeight ? "bg-accent-indigo text-white" : "text-gray-500"
                          }`}
                      >
                        Metric
                      </button>
                      <button
                        onClick={() => handleWeightUnitToggle(false)}
                        className={`px-3 py-1 rounded-pill text-[10px] font-bold ${!isMetricWeight ? "bg-accent-indigo text-white" : "text-gray-500"
                          }`}
                      >
                        Imperial
                      </button>
                    </div>
                  </div>
                  {isMetricWeight ? (
                    <div className="relative">
                      <input
                        type="number"
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value.replace(/^0+/, ""))}
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-accent-indigo"
                        placeholder="75"
                      />
                      <span className="absolute right-4 top-3.5 text-gray-500 text-sm">kg</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="number"
                        value={weightLbs}
                        onChange={(e) => setWeightLbs(e.target.value.replace(/^0+/, ""))}
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-accent-indigo"
                        placeholder="165"
                      />
                      <span className="absolute right-4 top-3.5 text-gray-500 text-sm">lbs</span>
                    </div>
                  )}
                </div>

                {/* ── Body Fat Triple Pathway ── */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider">
                    Body Fat %
                    <span className="ml-2 text-[10px] text-status-rose font-bold">Required</span>
                  </label>

                  {/* Tab switcher */}
                  <div className="flex gap-2 mb-4 bg-[#111113] p-1 rounded-xl border border-white/5">
                    <button
                      onClick={() => handleTabSwitch("manual")}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors ${activeTab === "manual" ? "bg-white/10 text-white" : "text-gray-500"
                        }`}
                    >
                      Manual
                    </button>
                    <button
                      onClick={() => handleTabSwitch("ai")}
                      className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors ${activeTab === "ai" ? "bg-white/10 text-accent-cyan" : "text-gray-500"
                        }`}
                    >
                      <Camera className="h-3 w-3" /> AI Scan
                    </button>
                    <button
                      onClick={() => handleTabSwitch("tape")}
                      className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors ${activeTab === "tape" ? "bg-white/10 text-white" : "text-gray-500"
                        }`}
                    >
                      <Ruler className="h-3 w-3" /> Tape
                    </button>
                  </div>

                  {/* ── Manual Tab ── */}
                  {activeTab === "manual" && (
                    <div className="space-y-2">
                      <div className="relative">
                        <input
                          id="manual-bf-input"
                          type="number"
                          value={manualBfInput}
                          onChange={(e) => setManualBfInput(e.target.value)}
                          placeholder="15.0"
                          min={1}
                          max={60}
                          step={0.1}
                          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-accent-indigo"
                        />
                        <span className="absolute right-4 top-3.5 text-gray-500 text-sm">%</span>
                      </div>
                      {resolvedBodyFatPct !== null && (
                        <p className="text-[11px] text-accent-indigo font-bold text-right">
                          Locked in: {resolvedBodyFatPct}%
                        </p>
                      )}
                      {manualBfInput !== "" && resolvedBodyFatPct === null && (
                        <p className="text-[11px] text-status-rose font-bold text-right">
                          Enter a value between 1 – 60%
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── AI Scan Tab ── */}
                  {activeTab === "ai" && (
                    <div className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-accent-cyan flex-shrink-0 mt-0.5 opacity-80" />
                        <div>
                          <h3 className="text-sm font-bold text-white">Ephemeral AI Scan</h3>
                          <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                            Your image is processed in-memory and is never written to disk
                            or cloud storage. It is purged immediately after analysis.
                          </p>
                        </div>
                      </div>

                      {/* File staging */}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          setStagedAIFile(f);
                          setAiResult(null);
                          setResolvedBodyFatPct(null);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-colors"
                      >
                        <Camera className="h-4 w-4" />
                        {stagedAIFile ? stagedAIFile.name : "Select / Capture Image"}
                      </button>

                      {/* Consent checkbox */}
                      <button
                        type="button"
                        onClick={() => setAiConsentChecked((v) => !v)}
                        className="flex items-center gap-2 w-full text-left group"
                        aria-pressed={aiConsentChecked}
                        id="ai-consent-checkbox"
                      >
                        {aiConsentChecked ? (
                          <CheckSquare className="h-4 w-4 text-accent-cyan flex-shrink-0" />
                        ) : (
                          <Square className="h-4 w-4 text-gray-500 flex-shrink-0 group-hover:text-gray-300 transition-colors" />
                        )}
                        <span className="text-[10px] text-gray-400 group-hover:text-gray-300 transition-colors leading-relaxed">
                          I consent to ephemeral image scanning for body composition estimation.
                        </span>
                      </button>

                      {/* Analyze button */}
                      <button
                        type="button"
                        id="analyze-ai-btn"
                        onClick={handleAnalyzeAI}
                        disabled={!stagedAIFile || !aiConsentChecked || isAnalyzingAI}
                        className={`
                          w-full flex items-center justify-center gap-2 py-3 rounded-xl
                          text-xs font-bold uppercase tracking-widest transition-all
                          ${!stagedAIFile || !aiConsentChecked
                            ? "bg-white/5 border border-white/10 text-gray-600 cursor-not-allowed"
                            : "bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/20"
                          }
                          ${aiGlow ? "shadow-[0_0_20px_rgba(6,182,212,0.5)]" : ""}
                        `}
                      >
                        {isAnalyzingAI ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Analyzing…
                          </>
                        ) : (
                          <>
                            <Activity className="h-4 w-4" />
                            Analyze Image
                          </>
                        )}
                      </button>

                      {/* AI result */}
                      {aiResult !== null && (
                        <div
                          className={`
                            text-center pt-3 border-t border-white/10 transition-all duration-500
                            ${aiGlow ? "text-accent-cyan drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" : "text-white"}
                          `}
                        >
                          <p className="text-xs text-gray-400 mb-1">AI Estimate</p>
                          <p className="text-2xl font-black tracking-tight">
                            {aiResult}
                            <span className="text-base font-medium ml-1">%</span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Tape Tab ── */}
                  {activeTab === "tape" && (
                    <div className="space-y-3 p-4 rounded-xl border border-white/10 bg-white/5">
                      <p className="text-[10px] text-gray-400">
                        US Navy Circumference Method. All measurements in{" "}
                        <span className="text-white font-bold">{isMetricHeight ? "cm" : "inches"}</span>.
                      </p>

                      {/* Inputs */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                          <input
                            id="tape-neck-input"
                            type="number"
                            placeholder="Neck"
                            value={navyNeck}
                            onChange={(e) =>
                              setNavyNeck(e.target.value ? Number(e.target.value) : "")
                            }
                            className="w-full rounded-xl bg-[#111113] border border-white/10 px-3 py-2.5 text-white outline-none focus:border-accent-indigo text-sm"
                          />
                          <span className="absolute right-3 top-2.5 text-gray-500 text-[10px]">
                            {isMetricHeight ? "cm" : "in"}
                          </span>
                        </div>
                        <div className="relative">
                          <input
                            id="tape-waist-input"
                            type="number"
                            placeholder="Waist"
                            value={navyWaist}
                            onChange={(e) =>
                              setNavyWaist(e.target.value ? Number(e.target.value) : "")
                            }
                            className="w-full rounded-xl bg-[#111113] border border-white/10 px-3 py-2.5 text-white outline-none focus:border-accent-indigo text-sm"
                          />
                          <span className="absolute right-3 top-2.5 text-gray-500 text-[10px]">
                            {isMetricHeight ? "cm" : "in"}
                          </span>
                        </div>
                        {gender === "female" && (
                          <div className="relative col-span-2">
                            <input
                              id="tape-hip-input"
                              type="number"
                              placeholder="Hip"
                              value={navyHip}
                              onChange={(e) =>
                                setNavyHip(e.target.value ? Number(e.target.value) : "")
                              }
                              className="w-full rounded-xl bg-[#111113] border border-white/10 px-3 py-2.5 text-white outline-none focus:border-accent-indigo text-sm"
                            />
                            <span className="absolute right-3 top-2.5 text-gray-500 text-[10px]">
                              {isMetricHeight ? "cm" : "in"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Analyze button */}
                      <button
                        type="button"
                        id="analyze-tape-btn"
                        onClick={handleAnalyzeTape}
                        disabled={
                          typeof navyNeck !== "number" ||
                          typeof navyWaist !== "number" ||
                          finalHeightCm <= 0 ||
                          (gender === "female" && typeof navyHip !== "number")
                        }
                        className={`
                          w-full flex items-center justify-center gap-2 py-3 rounded-xl
                          text-xs font-bold uppercase tracking-widest transition-all
                          bg-accent-indigo/10 border border-accent-indigo/30 text-accent-indigo
                          hover:bg-accent-indigo/20 disabled:opacity-40 disabled:cursor-not-allowed
                          ${tapeGlow ? "shadow-[0_0_20px_rgba(99,102,241,0.6)]" : ""}
                        `}
                      >
                        <Zap className="h-4 w-4" />
                        Analyze Measurements
                      </button>

                      {/* Tape result */}
                      {tapeResult !== null && (
                        <div
                          className={`
                            text-center pt-3 border-t border-white/10 transition-all duration-500
                            ${tapeGlow ? "text-accent-cyan drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" : "text-white"}
                          `}
                        >
                          <p className="text-xs text-gray-400 mb-1">Computed BF%</p>
                          <p className="text-2xl font-black tracking-tight">
                            {tapeResult}
                            <span className="text-base font-medium ml-1">%</span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════
              STEP 3 — Lifestyle & Safety
          ═══════════════════════════════════════════ */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold">Lifestyle &amp; Safety</h1>
                <p className="text-sm text-gray-500 mt-2">
                  Safeguards and expenditure models.
                </p>
              </div>

              <div className="glass-card p-6 space-y-6">

                {/* Allergies */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                    Allergen Registry <AlertCircle className="h-3 w-3 text-status-rose" />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {MAJOR_ALLERGENS.map((allergen) => {
                      const isActive = allergies.includes(allergen);
                      return (
                        <button
                          key={allergen}
                          onClick={() => toggleAllergy(allergen)}
                          className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-colors ${isActive
                              ? "bg-status-rose/20 border-status-rose text-status-rose"
                              : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                            }`}
                        >
                          {allergen}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Activity Level */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                    Activity Level
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setActivityDropdownOpen(!activityDropdownOpen)}
                      className="w-full flex justify-between items-center rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-accent-indigo transition-colors hover:bg-white/10"
                    >
                      <span>{ACTIVITY_LABELS[activityLevel]}</span>
                      <ChevronDown
                        className={`h-4 w-4 text-gray-500 transition-transform ${activityDropdownOpen ? "rotate-180" : ""
                          }`}
                      />
                    </button>
                    <AnimatePresence>
                      {activityDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute z-10 w-full mt-2 rounded-xl bg-[#111113] border border-white/10 shadow-xl overflow-hidden backdrop-blur-xl"
                        >
                          {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
                            <button
                              key={key}
                              onClick={() => {
                                setActivityLevel(key as ActivityLevel);
                                setActivityDropdownOpen(false);
                              }}
                              className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                            >
                              {label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Fitness Goal */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                    Fitness Goal
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(GOAL_LABELS) as FitnessGoal[]).map((goal) => (
                      <button
                        key={goal}
                        onClick={() => setFitnessGoal(goal)}
                        className={`py-2 rounded-xl text-xs font-bold transition-all border ${fitnessGoal === goal
                            ? "bg-accent-indigo/20 border-accent-indigo text-accent-indigo"
                            : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                          }`}
                      >
                        {GOAL_LABELS[goal]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Navigation & Submit ── */}
        <div className="mt-8 flex flex-col gap-4">
          {error && (
            <div className="p-3 rounded-lg bg-status-rose/10 border border-status-rose text-status-rose text-xs text-center font-bold uppercase tracking-wide">
              {error}
            </div>
          )}

          {/* Step 2 hint when BF% not resolved */}
          {step === 2 && finalHeightCm > 0 && finalWeightKg > 0 && resolvedBodyFatPct === null && (
            <p className="text-[10px] text-gray-600 text-center">
              Use one of the tabs above to analyze and lock in your body fat percentage.
            </p>
          )}

          <button
            id="onboarding-continue-btn"
            onClick={step < 3 ? () => setStep(step + 1) : handleSubmit}
            disabled={!canProceed() || isSubmitting}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-accent-indigo to-accent-cyan text-white text-sm font-bold tracking-widest uppercase shadow-[0_0_24px_rgba(99,102,241,0.3)] hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                {step < 3 ? "Continue" : "Set My Targets"}
                {step < 3 && <ChevronRight className="h-4 w-4" />}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
