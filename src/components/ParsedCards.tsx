"use client";

import { motion } from "framer-motion";
import { Utensils, Dumbbell, Scale } from "lucide-react";
import type { FoodData, WorkoutData, BiometricData, ParseResponse } from "@/lib/types";

function FoodCard({ data }: { data: FoodData }) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-status-success/20 flex items-center justify-center">
          <Utensils className="h-3 w-3 text-status-success" />
        </div>
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
          {data.meal_context}
        </span>
      </div>

      {/* Items */}
      {data.items.map((item, i) => (
        <div key={i} className="flex items-center justify-between">
          <span className="text-sm text-white font-medium">{item.name}</span>
          <span className="text-xs text-gray-400">
            {item.original_weight} {item.original_unit}
          </span>
        </div>
      ))}

      {/* Macro Bar */}
      <div className="pt-2 border-t border-white/5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-accent-indigo font-semibold">
            P: {data.total_macros_calculated.p}g
          </span>
          <span className="text-accent-cyan font-semibold">
            C: {data.total_macros_calculated.c}g
          </span>
          <span className="text-status-rose font-semibold">
            F: {data.total_macros_calculated.f}g
          </span>
          <span className="text-white font-bold">
            {data.total_macros_calculated.kcal} kcal
          </span>
        </div>
      </div>
    </div>
  );
}

function WorkoutCard({ data }: { data: WorkoutData }) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-accent-indigo/20 flex items-center justify-center">
          <Dumbbell className="h-3 w-3 text-accent-indigo" />
        </div>
        <span className="text-sm font-semibold text-white capitalize">
          {data.exercise_name}
        </span>
        <span className="text-[10px] text-gray-500 uppercase">
          {data.muscle_group}
        </span>
      </div>

      {/* Sets */}
      <div className="grid grid-cols-3 gap-2">
        {data.sets.map((set) => (
          <div
            key={set.index}
            className="bg-white/[0.03] border border-white/5 rounded-lg px-2.5 py-1.5 text-center"
          >
            <span className="text-[10px] text-gray-500 block">
              Set {set.index}
            </span>
            <span className="text-xs text-white font-medium">
              {set.reps} × {set.original_weight}
              {set.original_unit}
            </span>
          </div>
        ))}
      </div>

      {/* Volume */}
      <div className="pt-2 border-t border-white/5 flex justify-between items-center">
        <span className="text-xs text-gray-400">Total Volume</span>
        <span className="text-sm text-white font-bold">
          {data.total_volume.toFixed(1)} kg
        </span>
      </div>
    </div>
  );
}

function BiometricCard({ data }: { data: BiometricData }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-accent-cyan/20 flex items-center justify-center">
        <Scale className="h-5 w-5 text-accent-cyan" />
      </div>
      <div>
        <p className="text-sm text-gray-400 capitalize">
          {data.metric_type.replace("_", " ")}
        </p>
        <p className="text-xl font-bold text-white">
          {data.original_value}{" "}
          <span className="text-sm text-gray-400 font-normal">
            {data.original_unit}
          </span>
        </p>
        <p className="text-[10px] text-gray-600">
          ({data.canonical_value} {data.canonical_unit})
        </p>
      </div>
    </div>
  );
}

export default function ParsedCard({ response }: { response: ParseResponse }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="glass-card p-4 max-w-[85%] mr-auto"
    >
      {response.type === "food" && (
        <FoodCard data={response.parsed_data as FoodData} />
      )}
      {response.type === "workout" && (
        <WorkoutCard data={response.parsed_data as WorkoutData} />
      )}
      {response.type === "biometric" && (
        <BiometricCard data={response.parsed_data as BiometricData} />
      )}
      {response.type === "note" && (
        <div className="text-sm text-gray-300">
          📝 {(response.parsed_data as { content: string }).content}
        </div>
      )}

      {/* Confidence indicator */}
      {response.confidence_score !== null && (
        <div className="mt-3 flex items-center gap-1.5">
          <div
            className={`h-1.5 w-1.5 rounded-full ${
              response.confidence_score >= 0.9
                ? "bg-status-success"
                : response.confidence_score >= 0.6
                  ? "bg-status-amber"
                  : "bg-status-rose"
            }`}
          />
          <span className="text-[10px] text-gray-600">
            {response.confidence_score >= 0.9
              ? "High confidence"
              : response.confidence_score >= 0.6
                ? "Review suggested"
                : "Low confidence — verify"}
          </span>
        </div>
      )}
    </motion.div>
  );
}
