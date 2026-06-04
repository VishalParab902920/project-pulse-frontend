"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X, ChevronDown, Activity, AlertTriangle } from "lucide-react";
import { globalMutate } from "@/hooks/useSWR";
import { apiFetch } from "@/lib/api";
import { calculateBMR, calculateTDEE } from "@/lib/utils/calculators";
import { useUserStore } from "@/store/useUserStore";

type ActivityLevel = "sedentary" | "lightly_active" | "moderately_active" | "highly_active" | "competitive_athlete";
type FitnessGoal = "extreme_cut" | "cut" | "maintain" | "lean_bulk" | "aggressive_bulk" | "athletic_performance";

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
  athletic_performance: "Athletic Performance",
};

interface TunePerformanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  biometrics: any;
}

export default function TunePerformanceModal({ isOpen, onClose, biometrics }: TunePerformanceModalProps) {
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>((biometrics?.activity_level as ActivityLevel) || "moderately_active");
  const [activityDropdownOpen, setActivityDropdownOpen] = useState(false);
  const [fitnessGoal, setFitnessGoal] = useState<FitnessGoal>((biometrics?.fitness_goal as FitnessGoal) || "maintain");

  const [manualOverride, setManualOverride] = useState(false);
  const [manualCalories, setManualCalories] = useState<string>("");
  const [proteinPct, setProteinPct] = useState(30);
  const [carbsPct, setCarbsPct] = useState(40);
  const [fatPct, setFatPct] = useState(30);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && biometrics) {
      setActivityLevel((biometrics.activity_level as ActivityLevel) || "moderately_active");
      setFitnessGoal((biometrics.fitness_goal as FitnessGoal) || "maintain");
      setManualOverride(false);

      // If there are existing targets, check if they map to the calculated targets. If not, enable manual override.
      // But for simplicity, let's just initialize manual override with current targets.
      if (biometrics.target_calories) {
        setManualCalories(String(biometrics.target_calories));
        const total = biometrics.target_protein_g * 4 + biometrics.target_carbs_g * 4 + biometrics.target_fat_g * 9;
        if (total > 0) {
          setProteinPct(Math.round(((biometrics.target_protein_g * 4) / total) * 100));
          setCarbsPct(Math.round(((biometrics.target_carbs_g * 4) / total) * 100));
          setFatPct(Math.round(((biometrics.target_fat_g * 9) / total) * 100));
        }
      }
    }
  }, [isOpen, biometrics]);

  // Derived calculations if NOT manual override
  const calculatedTargets = useMemo(() => {
    if (!biometrics || !biometrics.weight_kg || !biometrics.height_cm || !biometrics.dob || !biometrics.gender) return null;

    // We trust the biometrics calculate_bmr if present, but since activity changes TDEE, we should recalculate BMR just in case.
    const bmr = biometrics.calculated_bmr || calculateBMR(
      biometrics.weight_kg, biometrics.height_cm,
      new Date().getFullYear() - new Date(biometrics.dob).getFullYear(), // simplified age 
      biometrics.gender, biometrics.body_fat_pct
    );

    const tdee = calculateTDEE(bmr, activityLevel);

    let targetCalories = tdee;
    let p = 0.35, c = 0.35, f = 0.3;

    switch (fitnessGoal) {
      case "extreme_cut": targetCalories = tdee - 750; p = 0.45; c = 0.25; f = 0.3; break;
      case "cut": targetCalories = tdee - 500; p = 0.4; c = 0.3; f = 0.3; break;
      case "lean_bulk": targetCalories = tdee + 300; p = 0.3; c = 0.45; f = 0.25; break;
      case "aggressive_bulk": targetCalories = tdee + 500; p = 0.25; c = 0.5; f = 0.25; break;
      case "maintain": targetCalories = tdee; p = 0.3; c = 0.4; f = 0.3; break;
      case "athletic_performance": targetCalories = tdee; p = 0.3; c = 0.45; f = 0.25; break;
    }

    return {
      tdee: Math.round(tdee),
      calories: Math.round(targetCalories),
      proteinG: Math.round((targetCalories * p) / 4),
      carbsG: Math.round((targetCalories * c) / 4),
      fatG: Math.round((targetCalories * f) / 9),
      pPct: p * 100, cPct: c * 100, fPct: f * 100
    };
  }, [biometrics, activityLevel, fitnessGoal]);

  const handleSliderChange = (changed: "p" | "c" | "f", val: number) => {
    if (changed === "p") {
      setProteinPct(val);
      const remaining = 100 - val;
      const otherTotal = carbsPct + fatPct;
      if (otherTotal === 0) {
        setCarbsPct(Math.round(remaining / 2));
        setFatPct(remaining - Math.round(remaining / 2));
      } else {
        const c = Math.round((carbsPct / otherTotal) * remaining);
        setCarbsPct(c);
        setFatPct(remaining - c);
      }
    } else if (changed === "c") {
      setCarbsPct(val);
      const remaining = 100 - val;
      const otherTotal = proteinPct + fatPct;
      if (otherTotal === 0) {
        setProteinPct(Math.round(remaining / 2));
        setFatPct(remaining - Math.round(remaining / 2));
      } else {
        const p = Math.round((proteinPct / otherTotal) * remaining);
        setProteinPct(p);
        setFatPct(remaining - p);
      }
    } else if (changed === "f") {
      setFatPct(val);
      const remaining = 100 - val;
      const otherTotal = proteinPct + carbsPct;
      if (otherTotal === 0) {
        setProteinPct(Math.round(remaining / 2));
        setCarbsPct(remaining - Math.round(remaining / 2));
      } else {
        const p = Math.round((proteinPct / otherTotal) * remaining);
        setProteinPct(p);
        setCarbsPct(remaining - p);
      }
    }
  };

  const totalPct = proteinPct + carbsPct + fatPct;

  const handleSubmit = async () => {
    if (manualOverride && totalPct !== 100) {
      setError("Macros must sum to exactly 100%.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    let finalCalories, finalProtein, finalCarbs, finalFat;
    if (manualOverride) {
      finalCalories = Number(manualCalories);
      finalProtein = Math.round((finalCalories * (proteinPct / 100)) / 4);
      finalCarbs = Math.round((finalCalories * (carbsPct / 100)) / 4);
      finalFat = Math.round((finalCalories * (fatPct / 100)) / 9);
    } else {
      finalCalories = calculatedTargets?.calories;
      finalProtein = calculatedTargets?.proteinG;
      finalCarbs = calculatedTargets?.carbsG;
      finalFat = calculatedTargets?.fatG;
    }

    try {
      const payload = {
        dob: biometrics.dob,
        gender: biometrics.gender,
        height_cm: biometrics.height_cm,
        weight_kg: biometrics.weight_kg,
        body_fat_pct: biometrics.body_fat_pct,
        allergies: biometrics.allergies || [],
        calculated_bmr: biometrics.calculated_bmr,
        activity_level: activityLevel,
        fitness_goal: fitnessGoal,
        target_calories: finalCalories,
        target_protein_g: finalProtein,
        target_carbs_g: finalCarbs,
        target_fat_g: finalFat,
        calculated_tdee: calculatedTargets?.tdee || biometrics.calculated_tdee,
      };

      const res = await apiFetch(`/api/v2/profile/biometrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to update performance targets");

      globalMutate("/api/v2/profile/biometrics");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save targets");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div layout initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="bg-[#0a0a0c] w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl relative">
            <div className="bg-[#0a0a0c]/90 backdrop-blur-md z-10 border-b border-white/5 px-6 py-4 flex justify-between items-center flex-shrink-0">
              <h3 className="text-lg font-bold text-white tracking-wide">Tune Performance</h3>
              <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">

              {/* Activity Level */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Activity Level</label>
                <div className="relative">
                  <button onClick={() => setActivityDropdownOpen(!activityDropdownOpen)} className="w-full flex justify-between items-center rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none hover:bg-white/10">
                    <span>{ACTIVITY_LABELS[activityLevel]}</span>
                    <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${activityDropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {activityDropdownOpen && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute z-10 w-full mt-2 rounded-xl bg-[#111113] border border-white/10 shadow-xl overflow-hidden backdrop-blur-xl">
                        {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
                          <button key={key} onClick={() => { setActivityLevel(key as ActivityLevel); setActivityDropdownOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
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
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Fitness Goal</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {(Object.keys(GOAL_LABELS) as FitnessGoal[]).map((goal) => (
                    <button key={goal} onClick={() => setFitnessGoal(goal)} className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all border ${fitnessGoal === goal ? "bg-accent-cyan/20 border-accent-cyan text-accent-cyan" : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"}`}>
                      {GOAL_LABELS[goal]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual Tuner Toggle */}
              <div className="flex items-center justify-between border-t border-white/5 pt-6">
                <div>
                  <h4 className="text-sm font-bold text-white">Manual Target Override</h4>
                  <p className="text-xs text-gray-400">Lock your own calories and macros</p>
                </div>
                <button onClick={() => setManualOverride(!manualOverride)} className={`w-12 h-6 rounded-full p-1 transition-colors ${manualOverride ? "bg-accent-cyan" : "bg-white/10"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${manualOverride ? "translate-x-6" : "translate-x-0"}`} />
                </button>
              </div>

              {manualOverride ? (
                <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Target Calories</label>
                    <div className="relative">
                      <input type="number" value={manualCalories} onChange={(e) => setManualCalories(e.target.value)} className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-accent-cyan" placeholder="2500" />
                      <span className="absolute right-4 top-3.5 text-gray-500 text-sm">kcal</span>
                    </div>
                  </div>

                  <div className="space-y-4 bg-white/5 p-4 rounded-xl border border-white/10">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Macro Split</label>
                      <span className={`text-xs font-bold ${totalPct === 100 ? "text-status-success" : "text-status-rose"}`}>{totalPct}% Total</span>
                    </div>
                    {totalPct !== 100 && (
                      <div className="flex items-center gap-2 p-2 bg-status-rose/10 rounded border border-status-rose/30 text-status-rose text-[10px] font-bold">
                        <AlertTriangle className="h-3 w-3" /> Sliders must sum to exactly 100%
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-accent-indigo">Protein ({proteinPct}%)</span>
                        <span className="text-gray-400">{Math.round((Number(manualCalories) * (proteinPct / 100)) / 4) || 0}g</span>
                      </div>
                      <input type="range" min="0" max="100" value={proteinPct} onChange={(e) => handleSliderChange("p", Number(e.target.value))} className="w-full accent-accent-indigo" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-accent-cyan">Carbs ({carbsPct}%)</span>
                        <span className="text-gray-400">{Math.round((Number(manualCalories) * (carbsPct / 100)) / 4) || 0}g</span>
                      </div>
                      <input type="range" min="0" max="100" value={carbsPct} onChange={(e) => handleSliderChange("c", Number(e.target.value))} className="w-full accent-accent-cyan" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#f59e0b]">Fats ({fatPct}%)</span>
                        <span className="text-gray-400">{Math.round((Number(manualCalories) * (fatPct / 100)) / 9) || 0}g</span>
                      </div>
                      <input type="range" min="0" max="100" value={fatPct} onChange={(e) => handleSliderChange("f", Number(e.target.value))} className="w-full accent-[#f59e0b]" />
                    </div>
                  </div>
                </motion.div>
              ) : (
                calculatedTargets && (
                  <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Calculated Targets</p>
                    <p className="text-3xl font-black text-white mb-4">{calculatedTargets.calories} <span className="text-sm text-gray-500 font-normal">kcal</span></p>
                    <div className="w-full flex h-2 rounded-full overflow-hidden bg-white/10 mb-2">
                      <div className="bg-accent-indigo" style={{ width: `${calculatedTargets.pPct}%` }} />
                      <div className="bg-accent-cyan" style={{ width: `${calculatedTargets.cPct}%` }} />
                      <div className="bg-[#f59e0b]" style={{ width: `${calculatedTargets.fPct}%` }} />
                    </div>
                    <div className="w-full flex justify-between text-[10px] font-bold uppercase tracking-wider">
                      <span className="text-accent-indigo">Pro: {calculatedTargets.proteinG}g</span>
                      <span className="text-accent-cyan">Carb: {calculatedTargets.carbsG}g</span>
                      <span className="text-[#f59e0b]">Fat: {calculatedTargets.fatG}g</span>
                    </div>
                  </motion.div>
                )
              )}
            </div>

            <div className="flex-shrink-0 bg-[#0a0a0c] border-t border-white/5">
              {error && (
                <div className="px-6 pt-3">
                  <p className="text-status-rose text-xs text-center font-bold">{error}</p>
                </div>
              )}

              <div className="p-6">
                <button onClick={handleSubmit} disabled={isSubmitting || (manualOverride && totalPct !== 100)} className="w-full py-3 rounded-xl bg-accent-cyan text-black text-sm font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center">
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save Settings"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
