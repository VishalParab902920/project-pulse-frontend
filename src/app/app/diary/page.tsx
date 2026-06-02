"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2,
  Plus,
  Droplets,
  Coffee,
  Sun,
  Moon,
  Cookie,
  Loader2,
  Search,
  ChefHat,
  PlusCircle,
} from "lucide-react";
import { useDateStore } from "@/store/useDateStore";
import { useUserStore } from "@/store/useUserStore";
import { useSyncStore } from "@/store/useSyncStore";
import { getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useSWR } from "@/hooks/useSWR";
import FoodSearchModal from "@/components/FoodSearchModal";
import NutritionHubModal from "@/components/NutritionHubModal";
import CustomFoodCreator from "@/components/nutrition/CustomFoodCreator";
import DailyTotals from "@/components/nutrition/DailyTotals";
import type { Food } from "@/lib/types/nutrition";

// =============================================================
// Types
// =============================================================

interface NutritionLog {
  id: string;
  user_id: string;
  logged_at: string;
  meal_type: string;
  food_id: string;
  measure_id: string;
  quantity: number;
  calculated_qty_base: number;
  calculated_calories: number;
  calculated_protein: number;
  calculated_carbs: number;
  calculated_fat: number;
  food?: { id: string; name: string; brand: string | null; base_unit: string; calories_per_100: number; protein_per_100: number; carbs_per_100: number; fat_per_100: number; is_custom: boolean; created_by: string | null; measures: unknown[] } | null;
  measure?: { id: string; measure_name: string; conversion_factor: number; is_default: boolean } | null;
  serving_size_g?: number;
  recipe_id?: string | null;
  recipe?: { id: string; title: string } | null;
  isPendingSync?: boolean;
}

interface DiaryData {
  breakfast: NutritionLog[];
  lunch: NutritionLog[];
  dinner: NutritionLog[];
  snack: NutritionLog[];
}

interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// =============================================================
// Net Calories Header — Extracted to DailyTotals component
// =============================================================

// =============================================================
// Quick Actions Panel — Pure Presentational
// =============================================================

function NutritionLibraryPanel({
  onSearchFoods,
  onMyRecipes,
  onCreateCustom,
}: {
  onSearchFoods: () => void;
  onMyRecipes: () => void;
  onCreateCustom: () => void;
}) {
  const triggerHaptic = () => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(10);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-2 mb-4">
      <button
        onClick={() => { triggerHaptic(); onSearchFoods(); }}
        className="glass-card p-3 flex flex-col items-center gap-2 border border-accent-purple/20 hover:border-accent-purple/40 hover:bg-accent-purple/5 transition-all active:scale-95"
      >
        <div className="w-9 h-9 rounded-xl bg-accent-purple/10 flex items-center justify-center">
          <Search className="h-4 w-4 text-accent-purple" />
        </div>
        <span className="text-[10px] font-medium text-gray-300">Search Foods</span>
      </button>
      <button
        onClick={() => { triggerHaptic(); onMyRecipes(); }}
        className="glass-card p-3 flex flex-col items-center gap-2 border border-accent-cyan/20 hover:border-accent-cyan/40 hover:bg-accent-cyan/5 transition-all active:scale-95"
      >
        <div className="w-9 h-9 rounded-xl bg-accent-cyan/10 flex items-center justify-center">
          <ChefHat className="h-4 w-4 text-accent-cyan" />
        </div>
        <span className="text-[10px] font-medium text-gray-300">My Recipes</span>
      </button>
      <button
        onClick={() => { triggerHaptic(); onCreateCustom(); }}
        className="glass-card p-3 flex flex-col items-center gap-2 border border-accent-indigo/20 hover:border-accent-indigo/40 hover:bg-accent-indigo/5 transition-all active:scale-95"
      >
        <div className="w-9 h-9 rounded-xl bg-accent-indigo/10 flex items-center justify-center">
          <PlusCircle className="h-4 w-4 text-accent-indigo" />
        </div>
        <span className="text-[10px] font-medium text-gray-300">Custom Food</span>
      </button>
    </div>
  );
}

// =============================================================
// Water Tracker — Pure Presentational
// =============================================================

function WaterTracker({ waterMl, onAdd }: { waterMl: number; onAdd: () => void }) {
  const targetMl = 2500;
  const pct = Math.min((waterMl / targetMl) * 100, 100);

  return (
    <div className="glass-card p-3 mb-3 flex items-center gap-3">
      <div className="relative w-10 h-10 flex-shrink-0">
        <div className="absolute inset-0 rounded-xl bg-white/5 overflow-hidden">
          <motion.div className="absolute bottom-0 left-0 right-0 bg-accent-cyan/30" animate={{ height: `${pct}%` }} transition={{ duration: 0.3, ease: "easeOut" }} />
        </div>
        <Droplets className="absolute inset-0 m-auto h-5 w-5 text-accent-cyan" />
      </div>
      <div className="flex-1">
        <p className="text-xs text-gray-400">
          Water: <span className="text-white font-medium">{waterMl}ml</span>
          <span className="text-gray-600"> / {targetMl}ml</span>
        </p>
      </div>
      <button
        onClick={onAdd}
        className="flex items-center gap-1 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 px-3 py-1.5 text-xs font-medium text-accent-cyan hover:bg-accent-cyan/20 transition-colors active:scale-95"
      >
        <Plus className="h-3 w-3" />
        250ml
      </button>
    </div>
  );
}

// =============================================================
// Meal Container — Pure Presentational with Pending Card Styling
// =============================================================

const MEAL_ICONS = { breakfast: Coffee, lunch: Sun, dinner: Moon, snack: Cookie };
const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" };

function MealContainer({
  mealType,
  logs,
  mealCalories,
  onDelete,
  onAddFood,
}: {
  mealType: keyof typeof MEAL_LABELS;
  logs: NutritionLog[];
  mealCalories: number;
  onDelete: (logId: string) => void;
  onAddFood: (mealType: string) => void;
}) {
  const Icon = MEAL_ICONS[mealType];

  return (
    <div className="glass-card p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-white">{MEAL_LABELS[mealType]}</span>
          {mealCalories > 0 && <span className="text-xs text-gray-500">{mealCalories} kcal</span>}
        </div>
        <button
          onClick={() => onAddFood(mealType)}
          className="flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-[10px] font-medium text-gray-400 hover:text-white hover:border-white/20 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </div>

      <div className="space-y-2 transform-gpu">
        <AnimatePresence mode="popLayout">
          {logs.map((log) => {
            const isPending = log.isPendingSync === true;
            const cal = Math.round(log.calculated_calories ?? 0);
            const pro = Math.round(log.calculated_protein ?? 0);
            const carb = Math.round(log.calculated_carbs ?? 0);
            const fat = Math.round(log.calculated_fat ?? 0);

            return (
              <motion.div
                key={log.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10, height: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                  isPending
                    ? "bg-amber-500/[0.03] border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.05)] opacity-60"
                    : "bg-white/[0.02] border border-white/[0.04]"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate ${isPending ? "text-amber-100" : "text-white"}`}>
                    {log.food?.name || "Unknown Food"}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {log.quantity}{log.measure?.measure_name || "g"} • {cal} kcal • P:{pro}g C:{carb}g F:{fat}g
                  </p>
                </div>
                {isPending ? (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-500 animate-pulse flex-shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Syncing...
                  </span>
                ) : (
                  <button
                    onClick={() => onDelete(log.id)}
                    className="flex-shrink-0 p-1.5 rounded-lg text-gray-600 hover:text-status-rose hover:bg-status-rose/10 transition-colors"
                    aria-label="Delete log"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {logs.length === 0 && (
          <p className="text-[10px] text-gray-600 text-center py-2">No entries yet</p>
        )}
      </div>
    </div>
  );
}

// =============================================================
// Skeleton Shimmer Loader
// =============================================================

function DiarySkeletonLoader() {
  return (
    <div className="p-4 pb-24 space-y-3 animate-pulse">
      {/* Header skeleton */}
      <div className="glass-card p-4 mb-3">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-white/5" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 rounded bg-white/5" />
            <div className="h-3 w-20 rounded bg-white/5" />
            <div className="h-3 w-16 rounded bg-white/5" />
          </div>
        </div>
      </div>
      {/* Meal skeletons */}
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="glass-card p-4">
          <div className="h-4 w-24 rounded bg-white/5 mb-3" />
          <div className="h-10 w-full rounded-xl bg-white/[0.02]" />
        </div>
      ))}
    </div>
  );
}

// =============================================================
// Main Diary Page — Centralized State & Client Calculations
// =============================================================

export default function DiaryPage() {
  const { selectedDate } = useDateStore();
  const storeToken = useUserStore((s) => s.accessToken);
  const token = storeToken || getAccessToken();

  // Subscribe to pending logs from sync queue (Render-Phase Merging source)
  const pendingLogs = useSyncStore((state) => state.pendingLogs);

  // =========================================================
  // CENTRALIZED SWR FETCHING — Single page-level query
  // useSWR reads from useCacheStore for instant fallback on date switch
  // =========================================================
  const { data: rawDiaryData, isLoading: diaryLoading, mutate: mutateDiary } = useSWR<NutritionLog[]>(
    "/api/v2/nutrition/diary",
    selectedDate,
    60000
  );

  // Biometrics (targets) — static, rarely changes
  const { data: bioData } = useSWR<{
    target_calories: number;
    target_protein_g: number;
    target_carbs_g: number;
    target_fat_g: number;
  }>("/api/v2/profile/biometrics");

  // =========================================================
  // RENDER-PHASE MERGING
  // Combine SWR server data + local pending queue items
  // =========================================================
  const mergedLogs: NutritionLog[] = useMemo(() => {
    const dbLogs: NutritionLog[] = rawDiaryData || [];

    const targetDatePending: NutritionLog[] = pendingLogs
      .filter((item) => {
        const itemDate = item.payload.logged_at.split("T")[0];
        return itemDate === selectedDate;
      })
      .map((item) => ({
        id: item.id,
        user_id: "",
        food_id: item.payload.food_id,
        measure_id: item.payload.measure_id,
        quantity: item.payload.quantity,
        logged_at: item.payload.logged_at,
        meal_type: item.payload.meal_type,
        calculated_qty_base: item.calculated_qty_base,
        calculated_calories: item.calculated_calories,
        calculated_protein: item.calculated_protein,
        calculated_carbs: item.calculated_carbs,
        calculated_fat: item.calculated_fat,
        isPendingSync: true,
        food: item.food as NutritionLog["food"],
        measure: item.measure as NutritionLog["measure"],
      }));

    // Prevent duplicates: DB log with same ID takes priority
    const pendingFiltered = targetDatePending.filter(
      (pending) => !dbLogs.some((dbLog) => dbLog.id === pending.id)
    );

    return [...dbLogs, ...pendingFiltered];
  }, [rawDiaryData, pendingLogs, selectedDate]);

  // =========================================================
  // CLIENT-SIDE MACRO SUMMARY — computed from mergedLogs
  // No separate /summary endpoint needed
  // =========================================================
  const dailyTotals: MacroTotals = useMemo(() => {
    return mergedLogs.reduce(
      (acc, log) => {
        acc.calories += Math.round(Number(log.calculated_calories) || 0);
        acc.protein += Math.round(Number(log.calculated_protein) || 0);
        acc.carbs += Math.round(Number(log.calculated_carbs) || 0);
        acc.fat += Math.round(Number(log.calculated_fat) || 0);
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [mergedLogs]);

  // Group merged logs into meal categories
  const diary: DiaryData = useMemo(() => {
    return mergedLogs.reduce<DiaryData>(
      (acc, log) => {
        const key = (log.meal_type?.toLowerCase() || "snack") as keyof DiaryData;
        if (acc[key]) acc[key].push(log);
        else acc.snack.push(log);
        return acc;
      },
      { breakfast: [], lunch: [], dinner: [], snack: [] }
    );
  }, [mergedLogs]);

  // Per-meal calorie totals (computed once, passed as props)
  const mealCalories = useMemo(() => ({
    breakfast: diary.breakfast.reduce((s, l) => s + Math.round(Number(l.calculated_calories) || 0), 0),
    lunch: diary.lunch.reduce((s, l) => s + Math.round(Number(l.calculated_calories) || 0), 0),
    dinner: diary.dinner.reduce((s, l) => s + Math.round(Number(l.calculated_calories) || 0), 0),
    snack: diary.snack.reduce((s, l) => s + Math.round(Number(l.calculated_calories) || 0), 0),
  }), [diary]);

  // Targets from biometrics
  const targets: MacroTotals = useMemo(() => ({
    calories: bioData?.target_calories || 2200,
    protein: bioData?.target_protein_g || 165,
    carbs: bioData?.target_carbs_g || 220,
    fat: bioData?.target_fat_g || 73,
  }), [bioData]);

  // =========================================================
  // LOCAL UI STATE
  // =========================================================
  const [localDiary, setLocalDiary] = useState<DiaryData | null>(null);
  const [waterMl, setWaterMl] = useState(0);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [nutritionHubOpen, setNutritionHubOpen] = useState(false);
  const [nutritionHubTab, setNutritionHubTab] = useState<"search" | "recipes" | "custom">("search");
  const [activeMealType, setActiveMealType] = useState<string>("snack");
  const [customFoodCreatorOpen, setCustomFoodCreatorOpen] = useState(false);

  // Reset local overrides when SWR data changes
  useEffect(() => { setLocalDiary(null); }, [rawDiaryData]);

  // Listen for sync-complete events to trigger background SWR revalidation
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleSyncComplete = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.targetDate === selectedDate) {
        mutateDiary();
      }
    };

    window.addEventListener("pulse:sync-complete", handleSyncComplete);
    return () => {
      window.removeEventListener("pulse:sync-complete", handleSyncComplete);
    };
  }, [selectedDate, mutateDiary]);

  const activeDiary = localDiary || diary;

  // =========================================================
  // EVENT HANDLERS
  // =========================================================

  const handleDelete = useCallback(
    async (logId: string) => {
      const prevDiary = activeDiary;
      const optimistic: DiaryData = {
        breakfast: activeDiary.breakfast.filter((l) => l.id !== logId),
        lunch: activeDiary.lunch.filter((l) => l.id !== logId),
        dinner: activeDiary.dinner.filter((l) => l.id !== logId),
        snack: activeDiary.snack.filter((l) => l.id !== logId),
      };
      setLocalDiary(optimistic);

      try {
        const res = await apiFetch(`/api/v2/nutrition/log/${logId}`, { method: "DELETE" });
        if (res.ok) { mutateDiary(); } else { setLocalDiary(prevDiary); }
      } catch { setLocalDiary(prevDiary); }
    },
    [activeDiary, mutateDiary]
  );

  const handleAddWater = useCallback(() => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
    const prevWater = waterMl;
    setWaterMl((prev) => prev + 250);
    apiFetch(`/api/v2/nutrition/water`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: selectedDate, amount_ml: 250 }),
    }).catch(() => { setWaterMl(prevWater); });
  }, [waterMl, selectedDate]);

  const handleAddFood = useCallback((mealType: string) => {
    setActiveMealType(mealType);
    setSearchModalOpen(true);
  }, []);

  const handleFoodLogged = useCallback(() => {
    setSearchModalOpen(false);
    setNutritionHubOpen(false);
  }, []);

  const handleOpenSearchFoods = useCallback(() => {
    setActiveMealType("snack");
    setSearchModalOpen(true);
  }, []);

  const handleOpenRecipes = useCallback(() => {
    setNutritionHubTab("recipes");
    setNutritionHubOpen(true);
  }, []);

  const handleOpenCustomFood = useCallback(() => {
    setCustomFoodCreatorOpen(true);
  }, []);

  // =========================================================
  // RENDER
  // =========================================================

  // Show skeleton ONLY for completely un-cached dates with no pending logs
  if (diaryLoading && !rawDiaryData && pendingLogs.length === 0) {
    return <DiarySkeletonLoader />;
  }

  return (
    <div className="p-4 pb-24 transform-gpu">
      {/* Net Calories Header — V2.5 DailyTotals with overflow warnings */}
      <DailyTotals eaten={dailyTotals} target={targets} burned={0} />

      {/* Quick Actions */}
      <NutritionLibraryPanel
        onSearchFoods={handleOpenSearchFoods}
        onMyRecipes={handleOpenRecipes}
        onCreateCustom={handleOpenCustomFood}
      />

      {/* Water Tracker */}
      <WaterTracker waterMl={waterMl} onAdd={handleAddWater} />

      {/* Meal Containers — receive logs + pre-computed calories as props */}
      <MealContainer mealType="breakfast" logs={activeDiary.breakfast} mealCalories={mealCalories.breakfast} onDelete={handleDelete} onAddFood={handleAddFood} />
      <MealContainer mealType="lunch" logs={activeDiary.lunch} mealCalories={mealCalories.lunch} onDelete={handleDelete} onAddFood={handleAddFood} />
      <MealContainer mealType="dinner" logs={activeDiary.dinner} mealCalories={mealCalories.dinner} onDelete={handleDelete} onAddFood={handleAddFood} />
      <MealContainer mealType="snack" logs={activeDiary.snack} mealCalories={mealCalories.snack} onDelete={handleDelete} onAddFood={handleAddFood} />

      {/* Modals */}
      <FoodSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        mealType={activeMealType}
        onFoodLogged={handleFoodLogged}
      />

      <NutritionHubModal
        isOpen={nutritionHubOpen}
        onClose={() => setNutritionHubOpen(false)}
        mealType={activeMealType}
        onFoodLogged={handleFoodLogged}
        initialTab={nutritionHubTab}
      />

      <CustomFoodCreator
        isOpen={customFoodCreatorOpen}
        onClose={() => setCustomFoodCreatorOpen(false)}
        onFoodCreated={() => {
          setCustomFoodCreatorOpen(false);
          mutateDiary();
        }}
      />
    </div>
  );
}
