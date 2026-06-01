"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, ChefHat, Plus, Loader2, Check } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useDateStore } from "@/store/useDateStore";
import RecipeBuilder from "@/components/RecipeBuilder";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface FoodResult {
  id: string;
  name: string;
  brand: string | null;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
}

interface NutritionHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  mealType: string;
  onFoodLogged: () => void;
}

type HubTab = "search" | "recipes" | "custom";

export default function NutritionHubModal({ isOpen, onClose, mealType, onFoodLogged }: NutritionHubModalProps) {
  const storeToken = useUserStore((s) => s.accessToken);
  const accessToken = storeToken || getAccessToken();
  const { selectedDate } = useDateStore();

  const [activeTab, setActiveTab] = useState<HubTab>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodResult | null>(null);
  const [servingGrams, setServingGrams] = useState(100);
  const [isLogging, setIsLogging] = useState(false);
  const [showRecipeBuilder, setShowRecipeBuilder] = useState(false);

  // Custom food form
  const [customName, setCustomName] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [customCal, setCustomCal] = useState("");
  const [customPro, setCustomPro] = useState("");
  const [customCarb, setCustomCarb] = useState("");
  const [customFat, setCustomFat] = useState("");
  const [isSavingCustom, setIsSavingCustom] = useState(false);
  const [customSaved, setCustomSaved] = useState(false);

  // Recipes
  const [recipes, setRecipes] = useState<Array<{ id: string; title: string; ingredients: unknown[] }>>([]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedFood(null);
      setServingGrams(100);
      setCustomSaved(false);
    }
  }, [isOpen]);

  // Fetch recipes when tab opens
  useEffect(() => {
    if (activeTab === "recipes" && accessToken) {
      apiFetch(`/api/v2/nutrition/recipes`).then(r => r.ok ? r.json() : []).then(setRecipes).catch(() => {});
    }
  }, [activeTab, accessToken]);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await apiFetch(`/api/v2/nutrition/food/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) setSearchResults(await res.json());
      } catch {} finally { setIsSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, accessToken]);

  const handleLogFood = useCallback(async () => {
    if (!selectedFood || !accessToken) return;
    setIsLogging(true);
    try {
      const res = await apiFetch(`/api/v2/nutrition/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logged_at: new Date(`${selectedDate}T12:00:00`).toISOString(),
          meal_type: mealType,
          food_id: selectedFood.id,
          recipe_id: null,
          serving_size_g: servingGrams,
        }),
      });
      if (res.ok) { onFoodLogged(); onClose(); }
    } catch {} finally { setIsLogging(false); }
  }, [selectedFood, servingGrams, mealType, selectedDate, accessToken, onFoodLogged, onClose]);

  const handleSaveCustomFood = useCallback(async () => {
    if (!customName.trim() || !accessToken) return;
    setIsSavingCustom(true);
    try {
      const res = await apiFetch(`/api/v2/nutrition/food`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customName.trim(),
          brand: customBrand.trim() || null,
          calories_per_100g: parseFloat(customCal) || 0,
          protein_per_100g: parseFloat(customPro) || 0,
          carbs_per_100g: parseFloat(customCarb) || 0,
          fat_per_100g: parseFloat(customFat) || 0,
        }),
      });
      if (res.ok) {
        setCustomSaved(true);
        setCustomName(""); setCustomBrand(""); setCustomCal(""); setCustomPro(""); setCustomCarb(""); setCustomFat("");
        setTimeout(() => setCustomSaved(false), 3000);
      }
    } catch {} finally { setIsSavingCustom(false); }
  }, [customName, customBrand, customCal, customPro, customCarb, customFat, accessToken]);

  if (!isOpen) return null;

  return (
    <>
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }} onClick={(e) => e.stopPropagation()} className="absolute bottom-0 left-0 right-0 max-h-[90dvh] rounded-t-3xl bg-surface-solid border-t border-white/10 overflow-hidden flex flex-col">
          <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-white/20" /></div>
          <div className="flex items-center justify-between px-5 pb-3">
            <h2 className="text-base font-semibold text-white">Nutrition Library</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400"><X className="h-4 w-4" /></button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-5 mb-4">
            {([["search", "Search"], ["recipes", "Recipes"], ["custom", "Custom"]] as [HubTab, string][]).map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key)} className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab === key ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}>{label}</button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-6 transform-gpu">
            {/* Search Tab */}
            {activeTab === "search" && !selectedFood && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search foods..." autoFocus className="w-full rounded-xl bg-white/5 border border-white/10 pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-purple" />
                  {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-accent-purple animate-spin" />}
                </div>
                <div className="space-y-1.5 max-h-[50dvh] overflow-y-auto">
                  {searchResults.map((food) => (
                    <button key={food.id} onClick={() => setSelectedFood(food)} className="w-full flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/[0.04] px-3 py-2.5 text-left hover:bg-white/[0.05] transition-colors">
                      <div><p className="text-xs font-medium text-white">{food.name}</p><p className="text-[10px] text-gray-500">{food.brand || "Generic"} • {food.calories_per_100g} kcal/100g</p></div>
                      <Plus className="h-4 w-4 text-gray-500" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Food — Serving Selector */}
            {activeTab === "search" && selectedFood && (
              <div className="space-y-4">
                <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
                  <p className="text-sm font-medium text-white">{selectedFood.name}</p>
                  <p className="text-[10px] text-gray-600 mt-1">Per 100g: {selectedFood.calories_per_100g} kcal</p>
                </div>
                <div>
                  <div className="flex justify-between mb-1.5"><span className="text-xs text-gray-400">Serving</span><span className="text-sm font-semibold text-white">{servingGrams}g</span></div>
                  <input type="range" min={10} max={500} step={5} value={servingGrams} onChange={(e) => setServingGrams(Number(e.target.value))} className="w-full h-2 rounded-full appearance-none bg-white/10 accent-accent-purple cursor-pointer" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedFood(null)} className="flex-1 rounded-xl bg-white/5 border border-white/10 py-3 text-xs font-medium text-gray-400">Back</button>
                  <button onClick={handleLogFood} disabled={isLogging} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-indigo via-accent-purple to-accent-cyan py-3 text-xs font-semibold text-white disabled:opacity-50 shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                    {isLogging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5" />Log</>}
                  </button>
                </div>
              </div>
            )}

            {/* Recipes Tab */}
            {activeTab === "recipes" && (
              <div className="space-y-3">
                <button onClick={() => setShowRecipeBuilder(true)} className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent-purple/10 border border-accent-purple/20 py-3 text-xs font-medium text-accent-purple hover:bg-accent-purple/20 transition-colors">
                  <ChefHat className="h-3.5 w-3.5" />Create Custom Recipe
                </button>
                {recipes.length === 0 ? (
                  <p className="text-center text-[10px] text-gray-600 py-4">No recipes yet</p>
                ) : (
                  recipes.map((r) => (
                    <div key={r.id} className="rounded-xl bg-white/[0.02] border border-white/[0.04] px-3 py-2.5">
                      <p className="text-xs font-medium text-white">{r.title}</p>
                      <p className="text-[9px] text-gray-500">{(r.ingredients as unknown[]).length} ingredients</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Custom Food Tab */}
            {activeTab === "custom" && (
              <div className="space-y-3">
                <input type="text" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Food name" className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-purple" />
                <input type="text" value={customBrand} onChange={(e) => setCustomBrand(e.target.value)} placeholder="Brand (optional)" className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-purple" />
                <p className="text-[10px] text-gray-500 font-medium">Macros per 100g:</p>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" value={customCal} onChange={(e) => setCustomCal(e.target.value)} placeholder="Calories" className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-xs text-white placeholder-gray-600 outline-none focus:border-accent-purple [appearance:textfield]" />
                  <input type="number" value={customPro} onChange={(e) => setCustomPro(e.target.value)} placeholder="Protein (g)" className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-xs text-white placeholder-gray-600 outline-none focus:border-accent-purple [appearance:textfield]" />
                  <input type="number" value={customCarb} onChange={(e) => setCustomCarb(e.target.value)} placeholder="Carbs (g)" className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-xs text-white placeholder-gray-600 outline-none focus:border-accent-purple [appearance:textfield]" />
                  <input type="number" value={customFat} onChange={(e) => setCustomFat(e.target.value)} placeholder="Fat (g)" className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-xs text-white placeholder-gray-600 outline-none focus:border-accent-purple [appearance:textfield]" />
                </div>
                {customSaved && <p className="text-xs text-status-success text-center">Food saved to your library!</p>}
                <button onClick={handleSaveCustomFood} disabled={!customName.trim() || isSavingCustom} className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-indigo via-accent-purple to-accent-cyan py-3 text-xs font-semibold text-white disabled:opacity-50 shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                  {isSavingCustom ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="h-3.5 w-3.5" />Save Custom Food</>}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
    <RecipeBuilder isOpen={showRecipeBuilder} onClose={() => setShowRecipeBuilder(false)} onRecipeSaved={onFoodLogged} />
    </>
  );
}
