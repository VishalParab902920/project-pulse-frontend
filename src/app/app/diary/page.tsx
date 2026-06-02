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
import type { Food } from "@/lib/types/nutrition";

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

function calculateLogMacros(log: NutritionLog): MacroTotals {
  return {
    calories: Math.round(log.calculated_calories ?? 0),
    protein: Math.round(log.calculated_protein ?? 0),
    carbs: Math.round(log.calculated_carbs ?? 0),
    fat: Math.round(log.calculated_fat ?? 0),
  };
}

function calculateDayTotals(diary: DiaryData): MacroTotals {
  const allLogs = [
    ...diary.breakfast,
    ...diary.lunch,
    ...diary.dinner,
    ...diary.snack,
  ];
  return allLogs.reduce(
    (acc, log) => {
      const macros = calculateLogMacros(log);
      return {
        calories: acc.calories + macros.calories,
        protein: acc.protein + macros.protein,
        carbs: acc.carbs + macros.carbs,
        fat: acc.fat + macros.fat,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

// =============================================================
// Net Calories Header Widget
// =============================================================

function NetCaloriesHeader({
  eaten,
  target,
  burned,
}: {
  eaten: MacroTotals;
  target: { calories: number; protein: number; carbs: number; fat: number };
  burned: number;
}) {
  const remaining = target.calories - eaten.calories + burned;
  const progress = Math.min((eaten.calories / Math.max(target.calories, 1)) * 100, 100);

  return (
    <div className="glass-card p-4 mb-3">
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0 w-20 h-20">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
            <circle cx="40" cy="40" r="34" fill="none" stroke="url(#diaryCalGrad)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${progress * 2.136} ${213.6 - progress * 2.136}`} />
            <defs>
              <linearGradient id="diaryCalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6366F1" />
                <stop offset="100%" stopColor="#A855F7" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-white">{remaining}</span>
            <span className="text-[9px] text-gray-500">left</span>
          </div>
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Target</span>
            <span className="text-white font-medium">{target.calories}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Eaten</span>
            <span className="text-accent-purple font-medium">{eaten.calories}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Burned</span>
            <span className="text-accent-cyan font-medium">+{burned}</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4">
        <MacroMiniBar label="Protein" current={eaten.protein} target={target.protein} color="bg-accent-cyan" />
        <MacroMiniBar label="Carbs" current={eaten.carbs} target={target.carbs} color="bg-accent-purple" />
        <MacroMiniBar label="Fat" current={eaten.fat} target={target.fat} color="bg-accent-indigo" />
      </div>
    </div>
  );
}

function MacroMiniBar({ label, current, target, color }: { label: string; current: number; target: number; color: string }) {
  const pct = Math.min((current / Math.max(target, 1)) * 100, 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-gray-500">{label}</span>
        <span className="text-[10px] text-white font-medium">{current}/{target}g</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div className={`h-full rounded-full ${color}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.4, ease: "easeOut" }} />
      </div>
    </div>
  );
}

// =============================================================
// My Nutrition Library — Quick Actions Panel
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
// Water Tracker Widget
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
// Meal Container with Pending Card Styling
// =============================================================

const MEAL_ICONS = { breakfast: Coffee, lunch: Sun, dinner: Moon, snack: Cookie };
const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" };

function MealContainer({
  mealType,
  logs,
  onDelete,
  onAddFood,
}: {
  mealType: keyof typeof MEAL_LABELS;
  logs: NutritionLog[];
  onDelete: (logId: string) => void;
  onAddFood: (mealType: string) => void;
}) {
  const Icon = MEAL_ICONS[mealType];
  const totalCals = logs.reduce((sum, log) => sum + calculateLogMacros(log).calories, 0);

  return (
    <div className="glass-card p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-white">{MEAL_LABELS[mealType]}</span>
          {totalCals > 0 && <span className="text-xs text-gray-500">{totalCals} kcal</span>}
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
            const macros = calculateLogMacros(log);
            const isPending = log.isPendingSync === true;

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
                    {log.quantity}{log.measure?.measure_name || "g"} • {macros.calories} kcal • P:{macros.protein}g C:{macros.carbs}g F:{macros.fat}g
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
// Main Diary Page — Render-Phase Merging
// =============================================================

export default function DiaryPage() {
  const { selectedDate } = useDateStore();
  const storeToken = useUserStore((s) => s.accessToken);
  const accessToken = storeToken || getAccessToken();

  // Subscribe to pending logs from sync queue
  const pendingLogs = useSyncStore((state) => state.pendingLogs);

  // SWR-powered data fetching
  const { data: rawDiaryData, isLoading: diaryLoading, mutate: mutateDiary } = useSWR<NutritionLog[]>(
    "/api/v2/nutrition/diary",
    selectedDate,
    60000
  );
  const { data: summaryData } = useSWR<{ total_water_ml: number }>(
    `/api/v2/nutrition/summary/${selectedDate}`,
    undefined,
    60000
  );
  const { data: bioData } = useSWR<{ target_calories: number; target_protein_g: number; target_carbs_g: number; target_fat_g: number }>(
    "/api/v2/profile/biometrics"
  );

  // =========================================================
  // RENDER-PHASE MERGING
  // Merge SWR server data + local pending queue items
  // =========================================================
  const mergedLogs: NutritionLog[] = useMemo(() => {
    const dbLogs: NutritionLog[] = rawDiaryData || [];

    // Filter pending queue for items logged on the current selected date
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

    // Prevent duplicates: if a DB log shares the same ID as a pending item,
    // prioritize the DB log (it means the sync already completed)
    const pendingFiltered = targetDatePending.filter(
      (pending) => !dbLogs.some((dbLog) => dbLog.id === pending.id)
    );

    return [...dbLogs, ...pendingFiltered];
  }, [rawDiaryData, pendingLogs, selectedDate]);

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

  const [localDiary, setLocalDiary] = useState<DiaryData | null>(null);
  const [waterMl, setWaterMl] = useState(0);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [nutritionHubOpen, setNutritionHubOpen] = useState(false);
  const [nutritionHubTab, setNutritionHubTab] = useState<"search" | "recipes" | "custom">("search");
  const [activeMealType, setActiveMealType] = useState<string>("snack");
  const [customFoodCreatorOpen, setCustomFoodCreatorOpen] = useState(false);

  // Sync water from summary
  useEffect(() => {
    if (summaryData) setWaterMl(summaryData.total_water_ml || 0);
  }, [summaryData]);

  // Listen for sync-complete events to trigger SWR revalidation
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

  const targets = {
    calories: bioData?.target_calories || 2200,
    protein: bioData?.target_protein_g || 165,
    carbs: bioData?.target_carbs_g || 220,
    fat: bioData?.target_fat_g || 73,
  };

  const activeDiary = localDiary || diary;

  // Reset local overrides when SWR data changes
  useEffect(() => { setLocalDiary(null); }, [rawDiaryData]);

  // Delete a nutrition log (optimistic)
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

  // Water tracker
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
    // No need to mutate — Render-Phase Merging picks up the pending log automatically
  }, []);

  // Quick Actions Panel handlers
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

  const dayTotals = calculateDayTotals(activeDiary);

  if (diaryLoading && !rawDiaryData && pendingLogs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 text-accent-purple animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 transform-gpu">
      <NetCaloriesHeader eaten={dayTotals} target={targets} burned={0} />

      <NutritionLibraryPanel
        onSearchFoods={handleOpenSearchFoods}
        onMyRecipes={handleOpenRecipes}
        onCreateCustom={handleOpenCustomFood}
      />

      <WaterTracker waterMl={waterMl} onAdd={handleAddWater} />

      <MealContainer mealType="breakfast" logs={activeDiary.breakfast} onDelete={handleDelete} onAddFood={handleAddFood} />
      <MealContainer mealType="lunch" logs={activeDiary.lunch} onDelete={handleDelete} onAddFood={handleAddFood} />
      <MealContainer mealType="dinner" logs={activeDiary.dinner} onDelete={handleDelete} onAddFood={handleAddFood} />
      <MealContainer mealType="snack" logs={activeDiary.snack} onDelete={handleDelete} onAddFood={handleAddFood} />

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
        onFoodCreated={(food: Food) => {
          setCustomFoodCreatorOpen(false);
          mutateDiary();
        }}
      />
    </div>
  );
}
