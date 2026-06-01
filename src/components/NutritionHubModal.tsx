"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, ChefHat, Plus, Loader2, Trash2, Coffee, Sun, Moon, Cookie } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useUIStore } from "@/store/useUIStore";
import { useDateStore } from "@/store/useDateStore";
import RecipeBuilder from "@/components/RecipeBuilder";

interface RecipeData {
  id: string;
  title: string;
  ingredients: Array<{ food_id: string; weight_g: number; food_name: string | null }>;
  created_at: string;
}

interface NutritionHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  mealType: string;
  onFoodLogged: () => void;
  initialTab?: "search" | "recipes" | "custom";
}

type HubTab = "search" | "recipes" | "custom";

const MEAL_OPTIONS = [
  { key: "breakfast", label: "Breakfast", icon: Coffee },
  { key: "lunch", label: "Lunch", icon: Sun },
  { key: "dinner", label: "Dinner", icon: Moon },
  { key: "snack", label: "Snack", icon: Cookie },
];

export default function NutritionHubModal({ isOpen, onClose, mealType, onFoodLogged, initialTab }: NutritionHubModalProps) {
  const storeToken = useUserStore((s) => s.accessToken);
  const accessToken = storeToken || getAccessToken();
  const { selectedDate } = useDateStore();

  const [activeTab, setActiveTab] = useState<HubTab>(initialTab || "recipes");
  const [showRecipeBuilder, setShowRecipeBuilder] = useState(false);
  const [recipeSearchQuery, setRecipeSearchQuery] = useState("");

  // Recipe detail modal
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeData | null>(null);
  const [isLoggingRecipe, setIsLoggingRecipe] = useState(false);
  const [isDeletingRecipe, setIsDeletingRecipe] = useState(false);
  const [servingMultiplier, setServingMultiplier] = useState(1);

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
  const [recipes, setRecipes] = useState<RecipeData[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setRecipeSearchQuery("");
      setCustomSaved(false);
      setSelectedRecipe(null);
      setServingMultiplier(1);
      setCustomName(""); setCustomBrand(""); setCustomCal(""); setCustomPro(""); setCustomCarb(""); setCustomFat("");
    } else {
      if (initialTab) setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const fetchRecipes = useCallback(() => {
    if (!accessToken) return;
    setRecipesLoading(true);
    apiFetch(`/api/v2/nutrition/recipes`)
      .then(r => r.ok ? r.json() : [])
      .then(setRecipes)
      .catch(() => {})
      .finally(() => setRecipesLoading(false));
  }, [accessToken]);

  useEffect(() => {
    if (isOpen && activeTab === "recipes" && accessToken) {
      fetchRecipes();
    }
  }, [isOpen, activeTab, accessToken, fetchRecipes]);

  // Log recipe
  const handleLogRecipe = useCallback(async (mealKey: string) => {
    if (!selectedRecipe || !accessToken) return;
    setIsLoggingRecipe(true);
    try {
      const res = await apiFetch(`/api/v2/nutrition/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logged_at: `${selectedDate}T12:00:00`,
          meal_type: mealKey,
          food_id: null,
          recipe_id: selectedRecipe.id,
          serving_size_g: 100 * servingMultiplier,
        }),
      });
      if (res.ok) {
        setSelectedRecipe(null);
        onFoodLogged();
        onClose();
      }
    } catch {} finally { setIsLoggingRecipe(false); }
  }, [selectedRecipe, accessToken, selectedDate, servingMultiplier, onFoodLogged, onClose]);

  // Delete recipe
  const handleDeleteRecipe = useCallback(async (recipeId: string) => {
    if (!accessToken) return;
    setIsDeletingRecipe(true);
    try {
      const res = await apiFetch(`/api/v2/nutrition/recipe/${recipeId}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setSelectedRecipe(null);
        fetchRecipes();
      }
    } catch {} finally { setIsDeletingRecipe(false); }
  }, [accessToken, fetchRecipes]);

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

  const filteredRecipes = recipeSearchQuery.length > 0
    ? recipes.filter(r => r.title.toLowerCase().includes(recipeSearchQuery.toLowerCase()))
    : recipes;
  const { setModalOpen } = useUIStore();
  useEffect(() => { setModalOpen(isOpen); return () => { setModalOpen(false); }; }, [isOpen, setModalOpen]);


  if (!isOpen) return null;

  const showTabs = !initialTab || initialTab === "search";

  return (
    <>
    {/* Main Modal */}
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-0 left-0 right-0 h-[85dvh] rounded-t-3xl bg-surface-solid border-t border-white/10 overflow-hidden flex flex-col"
        >
          <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-white/20" /></div>

          <div className="flex items-center justify-between px-5 pb-3">
            <h2 className="text-base font-semibold text-white">
              {activeTab === "recipes" ? "My Recipes" : "Create Custom Food"}
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400"><X className="h-4 w-4" /></button>
          </div>

          {showTabs && (
            <div className="flex gap-1 px-5 mb-4">
              {([["recipes", "Recipes"], ["custom", "Custom"]] as [HubTab, string][]).map(([key, label]) => (
                <button key={key} onClick={() => setActiveTab(key)} className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab === key ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}>{label}</button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-5 pb-6 transform-gpu">
            {/* Recipes Tab */}
            {activeTab === "recipes" && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <input type="text" value={recipeSearchQuery} onChange={(e) => setRecipeSearchQuery(e.target.value)} placeholder="Search your recipes..." autoFocus className="w-full rounded-xl bg-white/5 border border-white/10 pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/50" />
                </div>

                <button onClick={() => setShowRecipeBuilder(true)} className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-indigo/20 via-accent-purple/20 to-accent-cyan/20 border border-accent-purple/30 py-3.5 text-xs font-semibold text-accent-purple hover:border-accent-purple/50 transition-colors active:scale-[0.98]">
                  <Plus className="h-4 w-4" />
                  Create New Recipe
                </button>

                {recipesLoading && (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 text-accent-purple animate-spin" /></div>
                )}

                {!recipesLoading && filteredRecipes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <ChefHat className="h-10 w-10 text-gray-700 mb-3" />
                    <p className="text-sm text-gray-400">{recipeSearchQuery ? "No recipes match your search" : "No recipes saved yet"}</p>
                    <p className="text-[11px] text-gray-600 mt-1 max-w-[200px]">{recipeSearchQuery ? "Try a different search term" : "Create custom recipes to quickly log complex meals with one tap"}</p>
                  </div>
                ) : (
                  !recipesLoading && (
                    <div className="space-y-2">
                      {filteredRecipes.map((r) => (
                        <button key={r.id} onClick={() => { setSelectedRecipe(r); setServingMultiplier(1); }} className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3.5 hover:bg-white/[0.06] hover:border-white/10 transition-all text-left active:scale-[0.98]">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{r.title}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">{r.ingredients.length} ingredient{r.ingredients.length !== 1 ? "s" : ""}</p>
                            </div>
                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent-cyan/10 flex items-center justify-center">
                              <ChefHat className="h-4 w-4 text-accent-cyan" />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )
                )}
              </div>
            )}

            {/* Custom Food Tab */}
            {activeTab === "custom" && (
              <div className="space-y-3">
                <input type="text" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Food name" autoFocus className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-purple" />
                <input type="text" value={customBrand} onChange={(e) => setCustomBrand(e.target.value)} placeholder="Brand (optional)" className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-purple" />
                <p className="text-[10px] text-gray-500 font-medium">Macros per 100g:</p>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" value={customCal} onChange={(e) => setCustomCal(e.target.value)} placeholder="Calories" className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-xs text-white placeholder-gray-600 outline-none focus:border-accent-purple [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <input type="number" value={customPro} onChange={(e) => setCustomPro(e.target.value)} placeholder="Protein (g)" className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-xs text-white placeholder-gray-600 outline-none focus:border-accent-purple [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <input type="number" value={customCarb} onChange={(e) => setCustomCarb(e.target.value)} placeholder="Carbs (g)" className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-xs text-white placeholder-gray-600 outline-none focus:border-accent-purple [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <input type="number" value={customFat} onChange={(e) => setCustomFat(e.target.value)} placeholder="Fat (g)" className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-xs text-white placeholder-gray-600 outline-none focus:border-accent-purple [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
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

    {/* Recipe Detail Sub-Modal — slides up over the main modal */}
    <AnimatePresence>
      {selectedRecipe && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setSelectedRecipe(null)}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[75dvh] rounded-t-3xl bg-[#0a0a0c]/98 border-t border-white/10 backdrop-blur-xl overflow-hidden flex flex-col pb-[env(safe-area-inset-bottom)]"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <ChefHat className="h-4 w-4 text-accent-cyan flex-shrink-0" />
                <h3 className="text-sm font-semibold text-white truncate">{selectedRecipe.title}</h3>
              </div>
              <button onClick={() => setSelectedRecipe(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
              {/* Ingredients */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                  Ingredients ({selectedRecipe.ingredients.length})
                </p>
                {selectedRecipe.ingredients.map((ing, i) => (
                  <div key={i} className="rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2.5 flex items-center justify-between">
                    <span className="text-xs text-white">{ing.food_name || "Unknown"}</span>
                    <span className="text-[10px] text-gray-500 tabular-nums">{ing.weight_g}g</span>
                  </div>
                ))}
              </div>

              {/* Serving multiplier */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-400">Servings</span>
                  <span className="text-sm font-semibold text-white">{servingMultiplier}x</span>
                </div>
                <input type="range" min={0.5} max={5} step={0.5} value={servingMultiplier} onChange={(e) => setServingMultiplier(Number(e.target.value))} className="w-full h-2 rounded-full appearance-none bg-white/10 accent-accent-purple cursor-pointer" />
                <div className="flex justify-between text-[10px] text-gray-600 mt-1"><span>0.5x</span><span>5x</span></div>
              </div>

              {/* Log to meal */}
              <div>
                <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-2">Log to meal</p>
                <div className="grid grid-cols-2 gap-2">
                  {MEAL_OPTIONS.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => handleLogRecipe(key)}
                      disabled={isLoggingRecipe}
                      className="flex items-center gap-2 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-3 text-xs font-medium text-gray-300 hover:bg-accent-purple/10 hover:border-accent-purple/30 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Icon className="h-4 w-4 text-gray-500" />
                      {label}
                    </button>
                  ))}
                </div>
                {isLoggingRecipe && (
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <Loader2 className="h-3.5 w-3.5 text-accent-purple animate-spin" />
                    <span className="text-xs text-gray-400">Logging...</span>
                  </div>
                )}
              </div>

              {/* Delete */}
              <button
                onClick={() => handleDeleteRecipe(selectedRecipe.id)}
                disabled={isDeletingRecipe}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-status-rose/5 border border-status-rose/20 py-3 text-xs font-medium text-status-rose hover:bg-status-rose/10 transition-colors disabled:opacity-50 active:scale-[0.98]"
              >
                {isDeletingRecipe ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete Recipe
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Recipe Builder */}
    <RecipeBuilder isOpen={showRecipeBuilder} onClose={() => setShowRecipeBuilder(false)} onRecipeSaved={() => { setShowRecipeBuilder(false); fetchRecipes(); }} />
    </>
  );
}


