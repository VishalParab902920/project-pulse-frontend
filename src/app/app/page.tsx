"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  Footprints,
  Heart,
  RefreshCw,
  Loader2,
  Zap,
  CloudOff,
  Dumbbell,
  Clock,
  ClipboardList,
} from "lucide-react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useUserStore } from "@/store/useUserStore";
import { useDateStore } from "@/store/useDateStore";
import { useTelemetryStore } from "@/store/useTelemetryStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { getAccessToken } from "@/lib/auth";
import { useSWR } from "@/hooks/useSWR";

/**
 * Dashboard Page — Bento-Box Analytics Grid (SWR-powered)
 *
 * All data loads instantly from the stale cache and refreshes
 * silently in the background via the useSWR hook.
 */

interface HealthSummary {
  resting_heart_rate: number | null;
  active_calories_burned: number | null;
  total_daily_steps: number | null;
  sleep_duration_seconds: number | null;
}

interface NutritionSummary {
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  total_water_ml: number;
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

export default function DashboardPage() {
  const storeToken = useUserStore((s) => s.accessToken);
  const accessToken = storeToken || getAccessToken();
  const { selectedDate } = useDateStore();
  const { isSyncing, lastSyncedAt, syncWearableData } = useTelemetryStore();

  // SWR hooks — instant from cache, background revalidation every 60s
  const { data: bioData } = useSWR<Targets & { target_calories: number; target_protein_g: number; target_carbs_g: number; target_fat_g: number }>(
    "/api/v2/profile/biometrics"
  );
  const { data: nutritionData, isLoading: nutLoading } = useSWR<NutritionSummary>(
    `/api/v2/nutrition/summary/${selectedDate}`,
    undefined,
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
  const { data: hrRaw } = useSWR<MetricPoint[]>(
    `/api/v2/telemetry/metrics?metric_type=heart_rate&start_date=${selectedDate}&end_date=${selectedDate}`
  );

  const targets: Targets = {
    calories: bioData?.target_calories || bioData?.calories || 2200,
    protein: bioData?.target_protein_g || bioData?.protein || 165,
    carbs: bioData?.target_carbs_g || bioData?.carbs || 220,
    fat: bioData?.target_fat_g || bioData?.fat || 73,
  };

  const eaten: NutritionSummary = nutritionData || { total_calories: 0, total_protein: 0, total_carbs: 0, total_fat: 0, total_water_ml: 0 };
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

  // Process heart rate data
  const heartData = (hrRaw || []).map((m) => ({
    time: new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    bpm: Math.round(m.value),
  }));

  const router = useRouter();
  const { isSessionActive, activeSession, restoreFromStorage } = useWorkoutStore();

  // Restore workout session from localStorage
  useEffect(() => { restoreFromStorage(); }, [restoreFromStorage]);

  // Elapsed timer for active session
  const [elapsed, setElapsed] = useState("0:00");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!isSessionActive || !activeSession) return;
    const update = () => {
      const secs = Math.max(0, Math.floor((Date.now() - activeSession.startedAt) / 1000));
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      setElapsed(h > 0 ? `${h}:${m.toString().padStart(2,"0")}:${s.toString().padStart(2,"0")}` : `${m}:${s.toString().padStart(2,"0")}`);
    };
    update();
    timerRef.current = setInterval(update, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isSessionActive, activeSession]);

  const handleSync = useCallback(() => {
    if (!accessToken) return;
    syncWearableData(accessToken);
  }, [accessToken, syncWearableData]);

  const calorieProgress = Math.min((eaten.total_calories / Math.max(targets.calories, 1)) * 100, 100);
  const remaining = targets.calories - eaten.total_calories + burned;
  const totalSteps = healthData?.total_daily_steps || stepData.reduce((s, d) => s + d.steps, 0);

  const lastSyncLabel = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "Never";

  // Show skeleton only if no cached data at all
  if (nutLoading && !nutritionData) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 text-accent-purple animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 transform-gpu">
      <div className="grid grid-cols-2 gap-3">
        {/* Card 1: Calorie Progress Ring */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-card p-4 col-span-1"
        >
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-3.5 w-3.5 text-accent-purple" />
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Calories</span>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative w-24 h-24">
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
                <span className="text-xl font-bold text-white">{Math.round(remaining)}</span>
                <span className="text-[9px] text-gray-500">remaining</span>
              </div>
            </div>
          </div>
          <div className="flex justify-between mt-3 text-[10px] text-gray-500">
            <span>Eaten: {Math.round(eaten.total_calories)}</span>
            <span>Burned: +{Math.round(burned)}</span>
          </div>
        </motion.div>

        {/* Card 2: Steps */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-4 col-span-1"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Footprints className="h-3.5 w-3.5 text-accent-cyan" />
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Steps</span>
            </div>
            <span className="text-xs font-bold text-white">{totalSteps.toLocaleString()}</span>
          </div>
          {stepData.length > 0 ? (
            <div className="aspect-[4/3] w-full min-h-[1px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stepData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="hour" hide />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: "rgba(17,17,19,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "10px" }} labelStyle={{ color: "#9ca3af" }} />
                  <Bar dataKey="steps" radius={[3, 3, 0, 0]} fill="url(#stepGradient)" />
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
            <div className="aspect-[4/3] w-full flex items-center justify-center">
              <div className="text-center">
                <CloudOff className="h-5 w-5 text-gray-700 mx-auto mb-1" />
                <p className="text-[9px] text-gray-600">No step data synced</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Card 3: Heart Rate */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card p-4 col-span-2"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Heart className="h-3.5 w-3.5 text-status-rose" />
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Heart Rate</span>
            </div>
            {healthData?.resting_heart_rate && (
              <span className="text-xs text-gray-400">
                Avg: <span className="text-white font-medium">{healthData.resting_heart_rate} bpm</span>
              </span>
            )}
          </div>
          {heartData.length > 0 ? (
            <div className="h-36 w-full min-h-[1px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={heartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="time" hide />
                  <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
                  <Tooltip contentStyle={{ background: "rgba(17,17,19,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "10px" }} labelStyle={{ color: "#9ca3af" }} />
                  <defs>
                    <linearGradient id="hrGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366F1" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#A855F7" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="bpm" stroke="#A855F7" strokeWidth={2} fill="url(#hrGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-36 w-full flex items-center justify-center">
              <div className="text-center">
                <CloudOff className="h-5 w-5 text-gray-700 mx-auto mb-1" />
                <p className="text-[9px] text-gray-600">No heart rate data synced today</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Card 4: Training */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-4 col-span-1"
        >
          <div className="flex items-center gap-2 mb-3">
            <Dumbbell className="h-3.5 w-3.5 text-accent-purple" />
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
              {isSessionActive ? "Active Session" : "Training"}
            </span>
          </div>
          {isSessionActive ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-status-rose animate-pulse" />
                <span className="text-xs text-white tabular-nums">{elapsed}</span>
              </div>
              <button
                onClick={() => router.push("/app/workout")}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-indigo via-accent-purple to-accent-cyan py-2.5 text-xs font-semibold text-white shadow-[0_0_10px_rgba(168,85,247,0.3)] active:scale-95"
              >
                <Dumbbell className="h-3.5 w-3.5" />
                Resume Workout
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => router.push("/app/workout")}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent-purple/10 border border-accent-purple/20 py-2.5 text-xs font-medium text-accent-purple hover:bg-accent-purple/20 transition-colors active:scale-95"
              >
                <Dumbbell className="h-3.5 w-3.5" />
                Start Session
              </button>
              <button
                onClick={() => router.push("/app/workout/templates")}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-white/5 border border-white/10 py-2 text-[10px] font-medium text-gray-400 hover:text-white hover:border-white/20 transition-colors"
              >
                <ClipboardList className="h-3 w-3" />
                Manage Templates
              </button>
            </div>
          )}
        </motion.div>

        {/* Card 5: Macro Burn-Down */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-card p-4 col-span-1"
        >
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-3.5 w-3.5 text-accent-cyan" />
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Macros</span>
          </div>
          <div className="space-y-3">
            <MacroBar label="Protein" current={Math.round(eaten.total_protein)} target={targets.protein} color="bg-accent-cyan" />
            <MacroBar label="Carbs" current={Math.round(eaten.total_carbs)} target={targets.carbs} color="bg-accent-purple" />
            <MacroBar label="Fat" current={Math.round(eaten.total_fat)} target={targets.fat} color="bg-accent-indigo" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function MacroBar({ label, current, target, color }: { label: string; current: number; target: number; color: string }) {
  const pct = Math.min((current / Math.max(target, 1)) * 100, 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-gray-500">{label}</span>
        <span className="text-[10px] text-white font-medium">{current}/{target}g</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div className={`h-full rounded-full ${color}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />
      </div>
    </div>
  );
}
