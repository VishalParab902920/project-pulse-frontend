"use client";

import { motion } from "framer-motion";

interface RingProps {
  label: string;
  current: number;
  target: number;
  color: string;
}

function Ring({ label, current, target, color }: RingProps) {
  const progress = Math.min(current / target, 1);
  const circumference = 2 * Math.PI * 20; // radius = 20
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-12 h-12">
        {/* Track */}
        <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="3"
          />
          <motion.circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </svg>
        {/* Center value */}
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
          {current > 999 ? `${(current / 1000).toFixed(1)}k` : Math.round(current)}
        </span>
      </div>
      <span className="text-[10px] tracking-[0.15em] text-gray-500 font-bold uppercase">
        {label}
      </span>
    </div>
  );
}

interface ProgressRingsProps {
  calories: number;
  protein: number;
  calorieTarget?: number;
  proteinTarget?: number;
  moveTarget?: number;
  moveMinutes?: number;
}

export default function ProgressRings({
  calories,
  protein,
  calorieTarget = 2200,
  proteinTarget = 150,
  moveTarget = 30,
  moveMinutes = 0,
}: ProgressRingsProps) {
  return (
    <div className="flex items-center justify-center gap-6 py-4">
      <Ring
        label="CALS"
        current={calories}
        target={calorieTarget}
        color="#059669"
      />
      <Ring
        label="PROT"
        current={protein}
        target={proteinTarget}
        color="#6366F1"
      />
      <Ring
        label="MOVE"
        current={moveMinutes}
        target={moveTarget}
        color="#D97706"
      />
    </div>
  );
}
