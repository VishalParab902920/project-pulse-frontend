"use client";

import { motion } from "framer-motion";

// =============================================================
// Types
// =============================================================

interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface DailyTotalsProps {
  eaten: MacroTotals;
  target: MacroTotals;
  burned: number;
}

// =============================================================
// DailyTotals — V2.5 Visual Danger Indicators
// =============================================================

export default function DailyTotals({ eaten, target, burned }: DailyTotalsProps) {
  const remaining = target.calories - eaten.calories + burned;
  const progress = Math.min((eaten.calories / Math.max(target.calories, 1)) * 100, 100);

  // Overflow detection
  const caloriesOver = eaten.calories > target.calories;
  const proteinOver = eaten.protein > target.protein;
  const carbsOver = eaten.carbs > target.carbs;
  const fatOver = eaten.fat > target.fat;

  // Excess values
  const caloriesExcess = caloriesOver ? eaten.calories - target.calories : 0;
  const carbsExcess = carbsOver ? eaten.carbs - target.carbs : 0;
  const fatExcess = fatOver ? eaten.fat - target.fat : 0;

  return (
    <div className="glass-card p-4 mb-3">
      <div className="flex items-center gap-4">
        {/* Central Progress Ring — Normal display, red glow when over target */}
        <div
          className={`relative flex-shrink-0 w-20 h-20 rounded-full ${
            caloriesOver
              ? "shadow-[0_0_25px_rgba(244,63,94,0.3)] animate-pulse"
              : ""
          }`}
        >
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="6"
            />
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke={caloriesOver ? "url(#diaryCalGradDanger)" : "url(#diaryCalGrad)"}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${progress * 2.136} ${213.6 - progress * 2.136}`}
            />
            <defs>
              <linearGradient id="diaryCalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6366F1" />
                <stop offset="100%" stopColor="#A855F7" />
              </linearGradient>
              <linearGradient id="diaryCalGradDanger" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F43F5E" />
                <stop offset="100%" stopColor="#DC2626" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-white">
              {eaten.calories}
            </span>
            <span className="text-[9px] text-gray-500">eaten</span>
          </div>
        </div>

        {/* Calorie Breakdown */}
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Target</span>
            <span className="text-white font-medium">{target.calories}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Eaten</span>
            <div className="flex items-center gap-1.5">
              <span className={`font-medium ${caloriesOver ? "text-red-400" : "text-accent-purple"}`}>
                {eaten.calories}
              </span>
              {caloriesOver && (
                <span className="text-[10px] font-bold text-red-400 animate-pulse">
                  +{caloriesExcess} kcal Over Target
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Burned</span>
            <span className="text-accent-cyan font-medium">+{burned}</span>
          </div>
        </div>
      </div>

      {/* Macro Mini Bars */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <MacroMiniBar
          label="Protein"
          current={eaten.protein}
          target={target.protein}
          color="bg-accent-cyan"
          isOver={proteinOver}
        />
        <MacroMiniBar
          label="Carbs"
          current={eaten.carbs}
          target={target.carbs}
          color="bg-accent-purple"
          isOver={carbsOver}
          excess={carbsExcess}
        />
        <MacroMiniBar
          label="Fat"
          current={eaten.fat}
          target={target.fat}
          color="bg-accent-indigo"
          isOver={fatOver}
          excess={fatExcess}
        />
      </div>
    </div>
  );
}

// =============================================================
// MacroMiniBar — With Danger Gradient on Overflow
// =============================================================

function MacroMiniBar({
  label,
  current,
  target,
  color,
  isOver,
  excess,
}: {
  label: string;
  current: number;
  target: number;
  color: string;
  isOver: boolean;
  excess?: number;
}) {
  const pct = Math.min((current / Math.max(target, 1)) * 100, 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-gray-500">{label}</span>
        <span className={`text-[10px] font-medium ${isOver ? "text-red-400" : "text-white"}`}>
          {current}/{target}g
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${
            isOver ? "bg-gradient-to-r from-rose-500 to-red-600" : color
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
      {isOver && excess !== undefined && excess > 0 && (
        <span className="text-[10px] font-bold text-red-400 animate-pulse">
          +{excess}g Over Target
        </span>
      )}
    </div>
  );
}
