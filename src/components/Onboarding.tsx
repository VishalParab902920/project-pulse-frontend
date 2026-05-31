"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronRight, Check } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const VIBES = [
  { id: "Professional Coach", label: "Coach", emoji: "🏋️", desc: "Direct, motivating, no-nonsense" },
  { id: "Supportive Friend", label: "Friend", emoji: "🤝", desc: "Warm, encouraging, casual" },
  { id: "Data Scientist", label: "Scientist", emoji: "🔬", desc: "Precise, analytical, data-driven" },
  { id: "Custom", label: "Custom", emoji: "✨", desc: "Define your own style" },
];

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [personaName, setPersonaName] = useState("Atlas");
  const [selectedVibe, setSelectedVibe] = useState("Professional Coach");
  const [unitPreference, setUnitPreference] = useState<"metric" | "imperial">("metric");
  const [dailyCalories, setDailyCalories] = useState(2200);
  const [dailyProtein, setDailyProtein] = useState(150);
  const [dailyCarbs, setDailyCarbs] = useState(250);
  const [dailyFats, setDailyFats] = useState(70);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFinalize = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona_name: personaName,
          persona_vibe: selectedVibe,
          unit_preference: unitPreference,
          onboarding_status: "completed",
        }),
      });

      if (res.ok) {
        onComplete();
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-base flex flex-col items-center justify-center p-6 overflow-y-auto">
      {/* Background mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.15),transparent)]" />

      <div className="relative w-full max-w-md">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all duration-300 ${
                s === step ? "w-8 bg-accent-indigo" : s < step ? "w-2 bg-status-success" : "w-2 bg-white/10"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Persona */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="text-center">
                <div className="mx-auto mb-4 w-12 h-12 rounded-full ai-glow flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Meet your AI partner
                </h1>
                <p className="text-sm text-gray-400 mt-2">
                  Give them a name and choose their personality
                </p>
              </div>

              {/* Name input */}
              <div className="bg-surface-glass border border-border-glass backdrop-blur-xl rounded-[24px] p-4">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold block mb-2">
                  Partner Name
                </label>
                <input
                  type="text"
                  value={personaName}
                  onChange={(e) => setPersonaName(e.target.value)}
                  placeholder="Atlas"
                  className="w-full bg-white/5 border border-white/10 rounded-[16px] px-4 py-3 text-white text-sm focus:outline-none focus:border-accent-indigo/50 placeholder-gray-600"
                />
              </div>

              {/* Vibe selection */}
              <div className="grid grid-cols-2 gap-3">
                {VIBES.map((vibe) => (
                  <button
                    key={vibe.id}
                    type="button"
                    onClick={() => setSelectedVibe(vibe.id)}
                    className={`relative p-4 text-left cursor-pointer rounded-[24px] backdrop-blur-xl transition-all duration-200 ${
                      selectedVibe === vibe.id
                        ? "bg-accent-indigo/10 border-2 border-accent-indigo shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                        : "bg-surface-glass border border-border-glass hover:border-white/15"
                    }`}
                  >
                    {selectedVibe === vibe.id && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent-indigo flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                    <span className="text-xl">{vibe.emoji}</span>
                    <p className="text-sm font-semibold text-white mt-2">{vibe.label}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{vibe.desc}</p>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full h-12 bg-accent-indigo hover:bg-indigo-600 text-white font-semibold rounded-[16px] text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}

          {/* Step 2: Units */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="text-center">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Your preferences
                </h1>
                <p className="text-sm text-gray-400 mt-2">
                  How should we display measurements?
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setUnitPreference("metric")}
                  className={`flex-1 p-5 text-center cursor-pointer rounded-[24px] backdrop-blur-xl transition-all duration-200 ${
                    unitPreference === "metric"
                      ? "bg-accent-indigo/10 border-2 border-accent-indigo shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                      : "bg-surface-glass border border-border-glass hover:border-white/15"
                  }`}
                >
                  <p className="text-2xl font-bold text-white">kg</p>
                  <p className="text-xs text-gray-400 mt-1">Metric</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">kg, g, cm</p>
                </button>
                <button
                  type="button"
                  onClick={() => setUnitPreference("imperial")}
                  className={`flex-1 p-5 text-center cursor-pointer rounded-[24px] backdrop-blur-xl transition-all duration-200 ${
                    unitPreference === "imperial"
                      ? "bg-accent-indigo/10 border-2 border-accent-indigo shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                      : "bg-surface-glass border border-border-glass hover:border-white/15"
                  }`}
                >
                  <p className="text-2xl font-bold text-white">lb</p>
                  <p className="text-xs text-gray-400 mt-1">Imperial</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">lb, oz, in</p>
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 h-12 border border-white/10 hover:bg-white/5 text-gray-300 rounded-[16px] text-sm cursor-pointer transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex-1 h-12 bg-accent-indigo hover:bg-indigo-600 text-white font-semibold rounded-[16px] text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Goals */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="text-center">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Daily targets
                </h1>
                <p className="text-sm text-gray-400 mt-2">
                  Set your macro goals — you can adjust these anytime
                </p>
              </div>

              <div className="bg-surface-glass border border-border-glass backdrop-blur-xl rounded-[24px] p-5 space-y-5">
                <GoalInput label="Calories" value={dailyCalories} onChange={setDailyCalories} unit="kcal" min={1000} max={5000} step={50} />
                <GoalInput label="Protein" value={dailyProtein} onChange={setDailyProtein} unit={unitPreference === "metric" ? "g" : "oz"} min={50} max={400} step={5} />
                <GoalInput label="Carbs" value={dailyCarbs} onChange={setDailyCarbs} unit={unitPreference === "metric" ? "g" : "oz"} min={50} max={600} step={10} />
                <GoalInput label="Fats" value={dailyFats} onChange={setDailyFats} unit={unitPreference === "metric" ? "g" : "oz"} min={20} max={200} step={5} />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 h-12 border border-white/10 hover:bg-white/5 text-gray-300 rounded-[16px] text-sm cursor-pointer transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleFinalize}
                  disabled={isSubmitting}
                  className="flex-1 h-12 bg-status-success hover:bg-emerald-700 text-white font-semibold rounded-[16px] text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    "Saving..."
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Finalize
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function GoalInput({
  label,
  value,
  onChange,
  unit,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit: string;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400 font-medium">{label}</span>
        <span className="text-sm text-white font-bold">
          {value} <span className="text-gray-500 font-normal">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-indigo [&::-webkit-slider-thumb]:shadow-lg"
      />
    </div>
  );
}
