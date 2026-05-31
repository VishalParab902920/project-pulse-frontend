"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { Check, Footprints, Heart, Moon, Sparkles, ToggleLeft, ToggleRight } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface WeightPoint {
  day: string;
  weight: number;
}

interface ConsistencyDay {
  day: string;
  completed: boolean;
}

interface AnalyticsData {
  weight_trend: WeightPoint[];
  consistency: ConsistencyDay[];
  latest_biometrics: Record<string, { value: number; occurred_at: string }>;
  weekly_summary: { calories: number; protein_g: number };
  ai_synthesis: string;
  include_assumed: boolean;
}

interface DashboardProps {
  onClose: () => void;
  refreshTrigger?: number;
}

export default function Dashboard({ onClose, refreshTrigger }: DashboardProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [includeAssumed, setIncludeAssumed] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/analytics`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setIncludeAssumed(json.include_assumed);
      }
    } catch (e) {
      console.error("[Dashboard] Failed to fetch analytics:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics, refreshTrigger]);

  const toggleAssumed = async () => {
    const newValue = !includeAssumed;
    setIncludeAssumed(newValue);
    try {
      await fetch(`${BACKEND_URL}/api/v1/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analytics_include_assumed: newValue }),
      });
      // Re-fetch analytics with new filter
      fetchAnalytics();
    } catch (e) {
      console.error("[Dashboard] Toggle failed:", e);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-base/95 backdrop-blur-xl flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent-indigo border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const weightChange = data?.weight_trend && data.weight_trend.length >= 2
    ? (data.weight_trend[data.weight_trend.length - 1].weight - data.weight_trend[0].weight).toFixed(1)
    : "0.0";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-base/95 backdrop-blur-xl overflow-y-auto"
    >
      <div className="max-w-md mx-auto px-5 py-6 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold tracking-tight text-white">Your Progress</h1>
          <button
            onClick={onClose}
            className="text-xs text-white/40 hover:text-white/80 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 gap-4">

          {/* Weight Trend Chart */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Weight Trend</h3>
              <span className={`text-xs font-bold ${Number(weightChange) <= 0 ? "text-status-success" : "text-status-rose"}`}>
                {Number(weightChange) > 0 ? "+" : ""}{weightChange} kg
              </span>
            </div>
            {data?.weight_trend && data.weight_trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={data.weight_trend}>
                  <YAxis domain={["dataMin - 1", "dataMax + 1"]} hide />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="rgba(255,255,255,0.8)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#06B6D4", stroke: "none" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-gray-600 text-center py-8">No weight data yet</p>
            )}
          </div>

          {/* Consistency Tracker */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-3">This Week</h3>
            <div className="flex items-center justify-between">
              {data?.consistency.map((day, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      day.completed
                        ? "bg-[#059669]/20"
                        : "border border-dashed border-white/10"
                    }`}
                  >
                    {day.completed && <Check className="h-4 w-4 text-status-success" />}
                  </div>
                  <span className="text-[9px] text-gray-600">
                    {new Date(day.day).toLocaleDateString("en", { weekday: "narrow" })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Biometrics Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-card p-3 text-center">
              <Footprints className="h-4 w-4 text-accent-indigo mx-auto mb-1" />
              <p className="text-lg font-bold text-white">
                {data?.latest_biometrics?.steps
                  ? Math.round(data.latest_biometrics.steps.value).toLocaleString()
                  : "—"}
              </p>
              <p className="text-[9px] text-gray-500 uppercase">Steps</p>
            </div>
            <div className="glass-card p-3 text-center">
              <Heart className="h-4 w-4 text-status-rose mx-auto mb-1" />
              <p className="text-lg font-bold text-white">
                {data?.latest_biometrics?.heart_rate
                  ? Math.round(data.latest_biometrics.heart_rate.value)
                  : "—"}
              </p>
              <p className="text-[9px] text-gray-500 uppercase">BPM</p>
            </div>
            <div className="glass-card p-3 text-center">
              <Moon className="h-4 w-4 text-accent-purple mx-auto mb-1" />
              <p className="text-lg font-bold text-white">
                {data?.latest_biometrics?.sleep
                  ? `${Math.round(data.latest_biometrics.sleep.value / 60)}h`
                  : "—"}
              </p>
              <p className="text-[9px] text-gray-500 uppercase">Sleep</p>
            </div>
          </div>

          {/* Weekly Summary */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-2">Weekly Totals</h3>
            <div className="flex justify-between">
              <div>
                <p className="text-2xl font-bold text-white">{data?.weekly_summary.calories.toLocaleString()}</p>
                <p className="text-[10px] text-gray-500 uppercase">Calories</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-accent-indigo">{data?.weekly_summary.protein_g}g</p>
                <p className="text-[10px] text-gray-500 uppercase">Protein</p>
              </div>
            </div>
          </div>

          {/* AI Synthesis */}
          {data?.ai_synthesis && (
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-accent-purple" />
                <h3 className="text-sm font-semibold text-white">AI Insight</h3>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed italic">
                &ldquo;{data.ai_synthesis}&rdquo;
              </p>
            </div>
          )}

          {/* Data Poisoning Toggle */}
          <div className="glass-card p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-white font-medium">Include Unverified Logs</p>
              <p className="text-[10px] text-gray-500">Show assumed/unconfirmed data in charts</p>
            </div>
            <button onClick={toggleAssumed} className="cursor-pointer">
              {includeAssumed ? (
                <ToggleRight className="h-7 w-7 text-accent-indigo" />
              ) : (
                <ToggleLeft className="h-7 w-7 text-gray-600" />
              )}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
