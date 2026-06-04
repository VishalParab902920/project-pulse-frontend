"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Camera, Ruler, Activity, X } from "lucide-react";
import { useSWR, globalMutate } from "@/hooks/useSWR";
import { apiFetch } from "@/lib/api";
import { calculateAge } from "@/lib/utils/date";
import { calculateBMR, calculateTDEE } from "@/lib/utils/calculators";
import CustomDatePicker from "@/components/ui/CustomDatePicker";
import { useBodyFatAnalyzer } from "@/hooks/useBodyFatAnalyzer";
import { useUserStore } from "@/store/useUserStore";

const MAJOR_ALLERGENS = [
  "peanuts", "tree nuts", "dairy", "eggs", "wheat", "soy", "fish", "shellfish", "sesame",
];

interface EditBiometricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  biometrics: any;
}

export default function EditBiometricsModal({ isOpen, onClose, biometrics }: EditBiometricsModalProps) {
  const { preferred_solid_unit } = useUserStore();

  const [gender, setGender] = useState<"male" | "female" | "other" | null>(biometrics?.gender || null);
  const [dob, setDob] = useState(biometrics?.dob || "");
  const age = useMemo(() => (dob ? calculateAge(dob) : null), [dob]);

  const [isMetricHeight, setIsMetricHeight] = useState(true);
  const [heightCm, setHeightCm] = useState<string>(biometrics?.height_cm ? String(biometrics.height_cm) : "");
  const [heightFt, setHeightFt] = useState<string>("");
  const [heightIn, setHeightIn] = useState<string>("");

  const [isMetricWeight, setIsMetricWeight] = useState(true);
  const [weightKg, setWeightKg] = useState<string>(biometrics?.weight_kg ? String(biometrics.weight_kg) : "");
  const [weightLbs, setWeightLbs] = useState<string>("");

  const [allergies, setAllergies] = useState<string[]>(biometrics?.allergies || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleTabSwitch = (tab: "manual" | "ai" | "tape") => {
    setSubmitError(null);
    bf.handleTabSwitch(tab);
  };

  useEffect(() => {
    if (isOpen && biometrics) {
      setGender(biometrics.gender || null);
      setDob(biometrics.dob || "");
      setHeightCm(biometrics.height_cm ? String(biometrics.height_cm) : "");
      setWeightKg(biometrics.weight_kg ? String(biometrics.weight_kg) : "");
      setAllergies(biometrics.allergies || []);
      bf.setResolvedBodyFatPct(biometrics.body_fat_pct || null);
      if (biometrics.body_fat_pct) bf.setManualBfInput(String(biometrics.body_fat_pct));
    }
  }, [isOpen, biometrics]);

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

  const finalHeightCm = isMetricHeight ? Number(heightCm) : Math.round((Number(heightFt) * 12 + Number(heightIn)) * 2.54);
  const finalWeightKg = isMetricWeight ? Number(weightKg) : Number(weightLbs) / 2.20462;

  const bf = useBodyFatAnalyzer({
    gender,
    age,
    heightCm: finalHeightCm,
    weightKg: finalWeightKg,
    isMetricHeight,
    heightFt,
    heightIn,
  });

  const toggleAllergy = (a: string) => {
    const lowered = a.toLowerCase();
    setAllergies((prev) => {
      const filtered = prev.filter(i => i.toLowerCase() !== lowered);
      if (filtered.length === prev.length) {
        return [...prev, lowered];
      }
      return filtered;
    });
  };

  const getActiveBfPct = () => {
    if (bf.activeTab === "manual") {
      const val = Number(bf.manualBfInput);
      return (val > 0 && val <= 100) ? val : null;
    }
    return bf.resolvedBodyFatPct;
  };
  const activeBfPct = getActiveBfPct();

  const canProceed = () => {
    return !!(gender && dob && age !== null && age >= 5 && finalHeightCm > 0 && finalWeightKg > 0 && activeBfPct !== null);
  };

  const handleSubmit = async () => {
    if (!canProceed()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // Re-calculate BMR and TDEE based on new biometrics
      const bmr = calculateBMR(finalWeightKg, finalHeightCm, age!, gender === "other" ? "male" : gender!, activeBfPct!);
      const tdee = calculateTDEE(bmr, (biometrics?.activity_level as any) || "moderately_active");

      // In real scenario we'd also recalculate macros if fitness_goal is present. We'll leave target_calories etc as they are, TunePerformanceModal handles macros.
      // Wait, actually, if BMR and TDEE change, we should probably update them.

      const res = await apiFetch(`/api/v2/profile/biometrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gender,
          dob,
          height_cm: finalHeightCm,
          weight_kg: finalWeightKg,
          body_fat_pct: activeBfPct,
          allergies: Array.from(new Set(allergies.map(a => a.toLowerCase()))),
          calculated_bmr: Math.round(bmr),
          calculated_tdee: Math.round(tdee),
          activity_level: biometrics.activity_level || "moderately_active",
          fitness_goal: biometrics.fitness_goal || "maintain",
          target_calories: biometrics.target_calories || Math.round(tdee),
          target_protein_g: biometrics.target_protein_g || Math.round((tdee * 0.3) / 4),
          target_carbs_g: biometrics.target_carbs_g || Math.round((tdee * 0.4) / 4),
          target_fat_g: biometrics.target_fat_g || Math.round((tdee * 0.3) / 9),
        }),
      });

      if (!res.ok) throw new Error("Failed to update biometrics");

      globalMutate("/api/v2/profile/biometrics");
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save biometrics");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="bg-[#0a0a0c] w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl relative">
            <div className="bg-[#0a0a0c]/90 backdrop-blur-md z-10 border-b border-white/5 px-6 py-4 flex justify-between items-center flex-shrink-0">
              <h3 className="text-lg font-bold text-white tracking-wide">Edit Biometrics</h3>
              <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
              {/* Gender */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Biological Sex</label>
                <div className="flex gap-2">
                  {(["male", "female", "other"] as const).map((g) => (
                    <button key={g} onClick={() => setGender(g)} className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${gender === g ? "bg-accent-indigo text-white" : "bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10"}`}>
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* DOB */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Date of Birth</label>
                <CustomDatePicker value={dob} onChange={setDob} placeholder="DD / MM / YYYY" />
                {age !== null && age < 5 && <p className="text-[11px] text-status-rose font-bold mt-2">Minimum age requirement is 5 years.</p>}
              </div>

              {/* Height */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Height</label>
                  <div className="flex bg-[#111113] rounded-pill p-1 border border-white/10">
                    <button onClick={() => handleHeightUnitToggle(true)} className={`px-3 py-1 rounded-pill text-[10px] font-bold ${isMetricHeight ? "bg-accent-indigo text-white" : "text-gray-500"}`}>Metric</button>
                    <button onClick={() => handleHeightUnitToggle(false)} className={`px-3 py-1 rounded-pill text-[10px] font-bold ${!isMetricHeight ? "bg-accent-indigo text-white" : "text-gray-500"}`}>Imperial</button>
                  </div>
                </div>
                {isMetricHeight ? (
                  <div className="relative">
                    <input type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-accent-indigo" placeholder="175" />
                    <span className="absolute right-4 top-3.5 text-gray-500 text-sm">cm</span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input type="number" value={heightFt} onChange={(e) => setHeightFt(e.target.value)} className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none" placeholder="5" />
                      <span className="absolute right-4 top-3.5 text-gray-500 text-sm">ft</span>
                    </div>
                    <div className="relative flex-1">
                      <input type="number" value={heightIn} onChange={(e) => setHeightIn(e.target.value)} className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none" placeholder="9" />
                      <span className="absolute right-4 top-3.5 text-gray-500 text-sm">in</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Weight */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Weight</label>
                  <div className="flex bg-[#111113] rounded-pill p-1 border border-white/10">
                    <button onClick={() => handleWeightUnitToggle(true)} className={`px-3 py-1 rounded-pill text-[10px] font-bold ${isMetricWeight ? "bg-accent-indigo text-white" : "text-gray-500"}`}>Metric</button>
                    <button onClick={() => handleWeightUnitToggle(false)} className={`px-3 py-1 rounded-pill text-[10px] font-bold ${!isMetricWeight ? "bg-accent-indigo text-white" : "text-gray-500"}`}>Imperial</button>
                  </div>
                </div>
                {isMetricWeight ? (
                  <div className="relative">
                    <input type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-accent-indigo" placeholder="75" />
                    <span className="absolute right-4 top-3.5 text-gray-500 text-sm">kg</span>
                  </div>
                ) : (
                  <div className="relative">
                    <input type="number" value={weightLbs} onChange={(e) => setWeightLbs(e.target.value)} className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-accent-indigo" placeholder="165" />
                    <span className="absolute right-4 top-3.5 text-gray-500 text-sm">lbs</span>
                  </div>
                )}
              </div>

              {/* Body Fat */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider">Body Fat %</label>
                <div className="flex gap-2 mb-4 bg-[#111113] p-1 rounded-xl border border-white/5">
                  <button onClick={() => handleTabSwitch("manual")} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors ${bf.activeTab === "manual" ? "bg-white/10 text-white" : "text-gray-500"}`}>Manual</button>
                  <button onClick={() => handleTabSwitch("ai")} className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors ${bf.activeTab === "ai" ? "bg-white/10 text-accent-cyan" : "text-gray-500"}`}><Camera className="h-3 w-3" /> AI</button>
                  <button onClick={() => handleTabSwitch("tape")} className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors ${bf.activeTab === "tape" ? "bg-white/10 text-white" : "text-gray-500"}`}><Ruler className="h-3 w-3" /> Tape</button>
                </div>
                {bf.activeTab === "manual" && (
                  <div className="relative">
                    <input type="number" value={bf.manualBfInput} onChange={(e) => bf.setManualBfInput(e.target.value)} placeholder="15.0" className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none" />
                    <span className="absolute right-4 top-3.5 text-gray-500 text-sm">%</span>
                  </div>
                )}
                {bf.activeTab === "ai" && (
                  <div className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-4">
                    <input type="file" accept="image/*" capture="environment" className="hidden" ref={bf.fileInputRef} onChange={(e) => bf.setStagedAIFile(e.target.files?.[0] ?? null)} />
                    <button type="button" onClick={() => bf.fileInputRef.current?.click()} className="w-full flex justify-center gap-2 py-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-xs font-bold uppercase"><Camera className="h-4 w-4" /> {bf.stagedAIFile ? bf.stagedAIFile.name : "Select Image"}</button>
                    <button type="button" onClick={() => bf.setAiConsentChecked(!bf.aiConsentChecked)} className="flex items-center gap-2 text-left w-full"><div className={`h-4 w-4 rounded border ${bf.aiConsentChecked ? 'bg-accent-cyan border-accent-cyan' : 'border-gray-500'} flex items-center justify-center`}></div> <span className="text-[10px] text-gray-400">Consent to ephemeral processing</span></button>
                    <button type="button" onClick={bf.handleAnalyzeAI} disabled={!bf.stagedAIFile || !bf.aiConsentChecked || bf.isAnalyzingAI} className="w-full py-3 rounded-xl bg-accent-cyan/10 text-accent-cyan text-xs font-bold uppercase disabled:opacity-50">
                      {bf.isAnalyzingAI ? "Analyzing..." : "Analyze Image"}
                    </button>
                    {bf.resolvedBodyFatPct !== null && <p className="text-center text-xl font-bold text-accent-cyan">{bf.resolvedBodyFatPct}%</p>}
                  </div>
                )}
                {bf.activeTab === "tape" && (
                  <div className="space-y-3 p-4 rounded-xl border border-white/10 bg-white/5">
                    <div className="grid grid-cols-2 gap-3">
                      <input type="number" placeholder="Neck" value={bf.navyNeck} onChange={(e) => bf.setNavyNeck(e.target.value ? Number(e.target.value) : "")} className="w-full rounded-xl bg-[#111113] border border-white/10 px-3 py-2.5 text-sm outline-none text-white" />
                      <input type="number" placeholder="Waist" value={bf.navyWaist} onChange={(e) => bf.setNavyWaist(e.target.value ? Number(e.target.value) : "")} className="w-full rounded-xl bg-[#111113] border border-white/10 px-3 py-2.5 text-sm outline-none text-white" />
                      {gender === "female" && (
                        <input type="number" placeholder="Hip" value={bf.navyHip} onChange={(e) => bf.setNavyHip(e.target.value ? Number(e.target.value) : "")} className="col-span-2 w-full rounded-xl bg-[#111113] border border-white/10 px-3 py-2.5 text-sm outline-none text-white" />
                      )}
                    </div>
                    <button type="button" onClick={bf.handleAnalyzeTape} className="w-full py-3 rounded-xl bg-accent-indigo/10 text-accent-indigo text-xs font-bold uppercase">Analyze Tape</button>
                    {bf.resolvedBodyFatPct !== null && <p className="text-center text-xl font-bold text-accent-indigo">{bf.resolvedBodyFatPct}%</p>}
                  </div>
                )}
              </div>

              {/* Allergies */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider">Allergens</label>
                <div className="flex flex-wrap gap-2">
                  {MAJOR_ALLERGENS.map((allergen) => (
                    <button key={allergen} onClick={() => toggleAllergy(allergen)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase border ${allergies.includes(allergen.toLowerCase()) ? "bg-status-rose/20 border-status-rose text-status-rose" : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"}`}>
                      {allergen}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            <div className="flex-shrink-0 bg-[#0a0a0c] border-t border-white/5">
              {(bf.error || submitError) && (
                <div className="px-6 pt-3">
                  <p className="text-status-rose text-xs text-center font-bold">{bf.error || submitError}</p>
                </div>
              )}

              <div className="p-6">
                <button onClick={handleSubmit} disabled={!canProceed() || isSubmitting} className="w-full py-3 rounded-xl bg-accent-indigo text-white text-sm font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center">
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save Changes"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
