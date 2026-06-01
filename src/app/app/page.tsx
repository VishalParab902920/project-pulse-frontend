"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Zap,
  Footprints,
  Dumbbell,
  Clock,
  TrendingDown,
  Plus,
  Loader2,
  CloudOff,
  Sparkles,
  Scale,
  Flame,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useUserStore } from "@/store/useUserStore";
import { useDateStore } from "@/store/useDateStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { getAccessToken } from "@/lib/auth";
import { useSWR } from "@/hooks/useSWR";
import WeightLogModal from "@/components/WeightLogModal";

/**
 * Dashboard Page — High-End Bento Grid (V2 Phase 2 Polish)
 *
 * Compact layout with:
 * 1. Calorie Budget Ring + Base Goal + Macro Bars (full-width)
 * 2. Steps (left) + Training/Burn (right)
 * 3. Weight Trend Chart (full-width) with dial modal
 * 4. AI Coach Summary (full-width, fills remaining space)
 */

interface HealthSummary {
  resting_heart_rate: number | null;
  active_calories_burned: number | null;
  total_daily_steps: number | null;
  sleep_duration_seconds: number | null;
}

interface FoodData {
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
}

interface NutritionLog {
  id: string;
  serving_size_g: number;
  food: FoodData | null;
}

interface DiaryData {
  breakfast: NutritionLog[];
  lunch: NutritionLog[];
  dinner: NutritionLog[];
  snack: NutritionLog[];
}

interface MetricPoint {
  timestamp: string;
  value: number;
}

interface Targets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface WeightEntry {
  date: string;
  weight_kg: number;
}

interface CoachingResponse {
  status: string;
  date: string;
  coaching_markdown: string;
}

export default function DashboardPage() {
  const storeToken = useUserStore((s) => s.accessToken);
  const accessToken = storeToken || getAccessToken();
  const { selectedDate } = useDateStore();
  const router = useRouter();

  // SWR hooks
  const { data: bioData } = useSWR<Targets & { target_calories: number; target_protein_g: number; target_carbs_g: number; target_fat_g: number }>(
    "/api/v2/profile/biometrics"
  );
  const { data: diaryData, isLoading: nutLoading } = useSWR<DiaryData>(
    "/api/v2/nutrition/diary",
    selectedDate,
    60000
  );
  const { data: healthData } = useSWR<HealthSummary>(
    `/api/v2/telemetry/summary/${selectedDate}`,
    undefined,
    60000
  );
  const { data: stepsRaw } = useSWR<MetricPoint[]>(
    `/api/v2/telemetry/metrics?metric_type=steps&start_date=${selectedDate}&end_date=${selectedDate}`
  );
  const { data: weightHistory, mutate: mutateWeight } = useSWR<WeightEntry[]>(
    "/api/v2/profile/biometrics/weight-history?days=30"
  );
  const { data: coachingData } = useSWR<CoachingResponse>(
    `/api/v2/analytics/daily-coaching?target_date=${selectedDate}`
  );

  const targets: Targets = {
    calories: bioData?.target_calories || bioData?.calories || 2200,
    protein: bioData?.target_protein_g || bioData?.protein || 165,
    carbs: bioData?.target_carbs_g || bioData?.carbs || 220,
    fat: bioData?.target_fat_g || bioData?.fat || 73,
  };

  // Calculate eaten macros dynamically from diary logs (same source as Diary page)
  const eaten = (() => {
    if (!diaryData) return { total_calories: 0, total_protein: 0, total_carbs: 0, total_fat: 0 };
    const allLogs = [
      ...(diaryData.breakfast || []),
      ...(diaryData.lunch || []),
      ...(diaryData.dinner || []),
      ...(diaryData.snack || []),
    ];
    return allLogs.reduce(
      (acc, log) => {
        if (!log.food) return acc;
        const ratio = log.serving_size_g / 100;
        return {
          total_calories: acc.total_calories + log.food.calories_per_100g * ratio,
          total_protein: acc.total_protein + log.food.protein_per_100g * ratio,
          total_carbs: acc.total_carbs + log.food.carbs_per_100g * ratio,
          total_fat: acc.total_fat + log.food.fat_per_100g * ratio,
        };
      },
      { total_calories: 0, total_protein: 0, total_carbs: 0, total_fat: 0 }
    );
  })();

  const burned = healthData?.active_calories_burned || 0;

  // Process step data into hourly buckets
  const stepData = (stepsRaw || []).reduce<{ hour: string; steps: number }[]>((acc, m) => {
    const hour = new Date(m.timestamp).getHours();
    const key = `${hour}:00`;
    const existing = acc.find((d) => d.hour === key);
    if (existing) existing.steps += m.value;
    else acc.push({ hour: key, steps: m.value });
    return acc;
  }, []);

  // Workout session state
  const { isSessionActive, activeSession, restoreFromStorage } = useWorkoutStore();
  useEffect(() => { restoreFromStorage(); }, [restoreFromStorage]);

  const [elapsed, setElapsed] = useState("0:00");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!isSessionActive || !activeSession) return;
    const update = () => {
      const secs = Math.max(0, Math.floor((Date.now() - activeSession.startedAt) / 1000));
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      setElapsed(h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}` : `${m}:${s.toString().padStart(2, "0")}`);
    };
    update();
    timerRef.current = setInterval(update, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isSessionActive, activeSession]);

  // Weight modal state
  const [weightModalOpen, setWeightModalOpen] = useState(false);

  const calorieProgress = Math.min((eaten.total_calories / Math.max(targets.calories, 1)) * 100, 100);
  const remaining = targets.calories - eaten.total_calories + burned;
  const totalSteps = healthData?.total_daily_steps || stepData.reduce((s, d) => s + d.steps, 0);

  // Format weight chart data
  const weightChartData = (weightHistory || []).map((entry) => ({
    date: new Date(entry.date).toLocaleDateString([], { month: "short", day: "numeric" }),
    weight: entry.weight_kg,
  }));
  const currentWeight = weightChartData.length > 0 ? weightChartData[weightChartData.length - 1].weight : 75;

  if (nutLoading && !diaryData) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 text-accent-purple animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 transform-gpu flex flex-col gap-3 min-h-[calc(100dvh-4rem)]">
      {/* Card 1: Calorie Budget Ring + Macros (full-width) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass-card p-4"
      >
        <div className="flex items-center gap-4">
          {/* SVG Ring */}
          <div className="relative flex-shrink-0 w-24 h-24">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
              <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="7" />
              <circle cx="48" cy="48" r="40" fill="none" stroke="url(#dashCalGrad)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${calorieProgress * 2.513} ${251.3 - calorieProgress * 2.513}`} />
              <defs>
                <linearGradient id="dashCalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6366F1" />
                  <stop offset="100%" stopColor="#A855F7" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-white">{Math.round(remaining)}</span>
              <span className="text-[8px] text-gray-500">remaining</span>
              <span className="text-[8px] text-gray-600 mt-0.5">{targets.calories.toLocaleString()} goal</span>
            </div>
          </div>

          {/* Right side: Eaten/Burned + Macro Bars */}
          <div className="flex-1 space-y-2">
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-500">Eaten: <span className="text-accent-purple font-medium">{Math.round(eaten.total_calories)}</span></span>
              <span className="text-gray-500">Burned: <span className="text-accent-cyan font-medium">+{Math.round(burned)}</span></span>
            </div>

            {/* Macro Progress Bars */}
            <MacroBar label="Protein" current={Math.round(eaten.total_protein)} target={targets.protein} color="bg-accent-cyan" glowColor="shadow-[0_0_6px_rgba(6,182,212,0.4)]" />
            <MacroBar label="Carbs" current={Math.round(eaten.total_carbs)} target={targets.carbs} color="bg-accent-purple" glowColor="shadow-[0_0_6px_rgba(168,85,247,0.4)]" />
            <MacroBar label="Fat" current={Math.round(eaten.total_fat)} target={targets.fat} color="bg-accent-indigo" glowColor="shadow-[0_0_6px_rgba(99,102,241,0.4)]" />
          </div>
        </div>
      </motion.div>

      {/* Row 2: Steps (left) + Training/Burn (right) */}
      <div className="grid grid-cols-2 gap-3">
        {/* Steps Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-3"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Footprints className="h-3 w-3 text-accent-cyan" />
              <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wider">Steps</span>
            </div>
            <span className="text-[10px] font-bold text-white">{totalSteps.toLocaleString()}</span>
          </div>
          {stepData.length > 0 ? (
            <div className="h-20 w-full min-h-[1px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stepData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="hour" hide />
                  <YAxis hide />
                  <Bar dataKey="steps" radius={[2, 2, 0, 0]} fill="url(#stepGradient)" />
                  <defs>
                    <linearGradient id="stepGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#A855F7" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-20 w-full flex items-center justify-center">
              <CloudOff className="h-4 w-4 text-gray-700" />
            </div>
          )}
        </motion.div>

        {/* Training / Burn Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card p-3"
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Dumbbell className="h-3 w-3 text-accent-purple" />
            <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wider">
              {isSessionActive ? "Active" : "Training"}
            </span>
          </div>

          {/* Calories burned display */}
          {burned > 0 && (
            <div className="flex items-center gap-1.5 mb-2">
              <Flame className="h-3 w-3 text-status-rose" />
              <span className="text-xs font-semibold text-white">{Math.round(burned)}</span>
              <span className="text-[9px] text-gray-500">kcal</span>
            </div>
          )}

          {isSessionActive ? (
            <button
              onClick={() => router.push("/app/workout")}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-accent-indigo via-accent-purple to-accent-cyan py-2 text-[10px] font-semibold text-white shadow-[0_0_8px_rgba(168,85,247,0.3)] active:scale-95"
            >
              <Dumbbell className="h-3 w-3" />
              Resume
            </button>
          ) : (
            <button
              onClick={() => router.push("/app/workout")}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-accent-purple/10 border border-accent-purple/20 py-2 text-[10px] font-medium text-accent-purple hover:bg-accent-purple/20 transition-colors active:scale-95"
            >
              <Dumbbell className="h-3 w-3" />
              Start Session
            </button>
          )}
        </motion.div>
      </div>

      {/* Card 3: Weight Trend (full-width) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Scale className="h-3.5 w-3.5 text-accent-cyan" />
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Weight</span>
            {weightChartData.length > 0 && (
              <span className="text-xs font-bold text-white ml-1">
                {currentWeight} kg
              </span>
            )}
          </div>
          <button
            onClick={() => setWeightModalOpen(true)}
            className="flex items-center gap-1 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 px-2.5 py-1 text-[10px] font-medium text-accent-cyan hover:bg-accent-cyan/20 transition-colors active:scale-95"
          >
            <Plus className="h-3 w-3" />
            Log
          </button>
        </div>

        {weightChartData.length > 1 ? (
          <div className="h-36 w-full min-h-[1px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightChartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
                <Tooltip
                  contentStyle={{ background: "rgba(17,17,19,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "10px" }}
                  labelStyle={{ color: "#9ca3af" }}
                  formatter={(value) => [`${value} kg`, "Weight"]}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#06B6D4"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: "#06B6D4", strokeWidth: 0 }}
                  activeDot={{ r: 4, fill: "#06B6D4", strokeWidth: 2, stroke: "#fff" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-24 w-full flex items-center justify-center">
            <div className="text-center">
              <TrendingDown className="h-5 w-5 text-gray-700 mx-auto mb-1" />
              <p className="text-[9px] text-gray-600">Log weight to see your trend</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Card 4: AI Coach (fills remaining space) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="glass-card p-4 flex-1 relative overflow-hidden"
      >
        {/* Pulsing border glow */}
        <motion.div
          className="absolute inset-0 rounded-[inherit] border border-accent-purple/30"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="flex items-center gap-2 mb-2 relative z-10">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="h-3.5 w-3.5 text-accent-purple" />
          </motion.div>
          <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">AI Coach</span>
        </div>

        <div className="relative z-10">
          {coachingData?.coaching_markdown ? (
            <p className="text-xs text-gray-300 leading-relaxed">
              {coachingData.coaching_markdown}
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 text-accent-purple animate-spin" />
              <p className="text-xs text-gray-500">Generating your daily coaching...</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Weight Log Modal */}
      <WeightLogModal
        isOpen={weightModalOpen}
        onClose={() => setWeightModalOpen(false)}
        onWeightLogged={() => mutateWeight()}
        initialWeight={currentWeight}
      />
    </div>
  );
}

// =============================================================
// Macro Progress Bar with neon glow
// =============================================================

function MacroBar({
  label,
  current,
  target,
  color,
  glowColor,
}: {
  label: string;
  current: number;
  target: number;
  color: string;
  glowColor: string;
}) {
  const pct = Math.min((current / Math.max(target, 1)) * 100, 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] text-gray-500">{label}</span>
        <span className="text-[9px] text-white font-medium tabular-nums">{current}/{target}g</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color} ${pct > 0 ? glowColor : ""}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
