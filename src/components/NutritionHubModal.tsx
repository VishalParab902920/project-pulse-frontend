"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, ChefHat, Plus, Loader2, Trash2, Coffee, Sun, Moon, Cookie, Check, ChevronDown, Save } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useUIStore } from "@/store/useUIStore";
import { useDateStore } from "@/store/useDateStore";
import { useCacheStore } from "@/store/useCacheStore";
import CreateRecipe from "@/components/nutrition/CreateRecipe";
import CustomFoodCreator from "@/components/nutrition/CustomFoodCreator";
import type { Food, FoodMeasure } from "@/lib/types/nutrition";

// =============================================================
// Types
// =============================================================

/** Lightweight recipe item returned by GET /recipes (list view) */
interface RecipeListItem {
  id: string;
  title: string;
  food_id: string;
  created_at: string;
  calories_per_100: number;
  protein_per_100: number;
  carbs_per_100: number;
  fat_per_100: number;
  measures: Array<{ id: string; measure_name: string; conversion_factor: number; is_default: boolean }>;
  total_calories?: number;
  total_protein?: number;
  total_carbs?: number;
  total_fat?: number;
  total_weight_g?: number;
}

/** Full recipe detail returned by GET /recipe/{id} */
interface RecipeDetail {
  id: string;
  title: string;
  instructions: string | null;
  food_id: string;
  calories_per_100: number;
  protein_per_100: number;
  carbs_per_100: number;
  fat_per_100: number;
  measures: Array<{ id: string; measure_name: string; conversion_factor: number; is_default: boolean }>;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  total_weight_g: number;
  ingredients: Array<{
    food_id: string;
    weight_g: number;
    food: Food;
  }>;
  created_at: string;
}

interface EditableIngredient {
  food: Food;
  measure_id: string;
  quantityStr: string;
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

// =============================================================
// Inline Ingredient Row with Measure Dropdown
// =============================================================

function IngredientRow({
  item,
  index,
  ingredientCal,
  onUpdateQuantity,
  onUpdateMeasure,
  onRemove,
}: {
  item: EditableIngredient;
  index: number;
  ingredientCal: number;
  onUpdateQuantity: (index: number, value: string) => void;
  onUpdateMeasure: (index: number, measure_id: string) => void;
  onRemove: (index: number) => void;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedMeasure = item.food.measures.find((m) => m.id === item.measure_id);
  const measureLabel = selectedMeasure?.measure_name || "g";

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-white font-medium truncate flex-1 mr-2">{item.food.name}</p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">{Math.round(ingredientCal)} kcal</span>
          <button onClick={() => onRemove(index)} className="p-1 rounded text-gray-600 hover:text-status-rose transition-colors" aria-label={`Remove ${item.food.name}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={item.quantityStr}
          onChange={(e) => { const val = e.target.value; if (val === "" || /^\d*\.?\d*$/.test(val)) onUpdateQuantity(index, val); }}
          onBlur={(e) => { const parsed = parseFloat(e.target.value); if (!parsed || parsed <= 0) onUpdateQuantity(index, "1"); }}
          className="w-16 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-white text-center outline-none focus:border-accent-purple"
        />
        <div className="relative" ref={dropdownRef}>
          <button type="button" onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-bold text-accent-purple hover:border-accent-purple/30 focus:outline-none transition-all">
            {measureLabel}
            <ChevronDown className={`h-3 w-3 text-gray-500 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {dropdownOpen && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="absolute top-full left-0 mt-1.5 z-50 rounded-xl bg-[#0a0a0a] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl overflow-hidden min-w-[120px]">
                {item.food.measures.map((measure) => {
                  const isActive = measure.id === item.measure_id;
                  return (
                    <button key={measure.id} type="button" onClick={() => { onUpdateMeasure(index, measure.id); setDropdownOpen(false); }} className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${isActive ? "bg-accent-purple/10 border-l-2 border-accent-purple" : "hover:bg-white/5 border-l-2 border-transparent"}`}>
                      <span className={`text-xs font-semibold ${isActive ? "text-accent-purple" : "text-white"}`}>{measure.measure_name}</span>
                      {isActive && <Check className="h-3 w-3 text-accent-purple ml-auto" />}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// Shimmer Skeleton for Recipe Detail Loading
// =============================================================

function RecipeDetailShimmer() {
  return (
    <div className="px-5 pb-6 space-y-4 animate-pulse">
      {/* Name */}
      <div>
        <div className="h-3 w-12 bg-white/10 rounded mb-2" />
        <div className="h-10 w-full bg-white/5 rounded-xl" />
      </div>
      {/* Instructions */}
      <div>
        <div className="h-3 w-20 bg-white/10 rounded mb-2" />
        <div className="h-16 w-full bg-white/5 rounded-xl" />
      </div>
      {/* Portions */}
      <div>
        <div className="h-3 w-14 bg-white/10 rounded mb-2" />
        <div className="h-10 w-24 bg-white/5 rounded-xl" />
      </div>
      {/* Ingredients */}
      <div className="space-y-2">
        <div className="h-3 w-24 bg-white/10 rounded" />
        <div className="h-10 w-full bg-white/5 rounded-xl" />
        <div className="h-16 w-full bg-white/[0.03] rounded-xl" />
        <div className="h-16 w-full bg-white/[0.03] rounded-xl" />
        <div className="h-16 w-full bg-white/[0.03] rounded-xl" />
      </div>
      {/* Macros */}
      <div className="grid grid-cols-4 gap-2">
        {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-white/[0.03] rounded-lg" />)}
      </div>
      {/* Button */}
      <div className="h-12 w-full bg-white/5 rounded-xl" />
    </div>
  );
}

// =============================================================
// Main Component
// =============================================================

export default function NutritionHubModal({ isOpen, onClose, mealType, onFoodLogged, initialTab }: NutritionHubModalProps) {
  const storeToken = useUserStore((s) => s.accessToken);
  const accessToken = storeToken || getAccessToken();
  const { selectedDate } = useDateStore();

  const [activeTab, setActiveTab] = useState<HubTab>(initialTab || "recipes");
  const [showRecipeBuilder, setShowRecipeBuilder] = useState(false);
  const [recipeSearchQuery, setRecipeSearchQuery] = useState("");

  // Recipe list
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);

  // Recipe detail — loaded via single API call
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [recipeDetail, setRecipeDetail] = useState<RecipeDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Editable state (derived from recipeDetail)
  const [editName, setEditName] = useState("");
  const [editInstructions, setEditInstructions] = useState("");
  const [editPortions, setEditPortions] = useState(1);
  const [editIngredients, setEditIngredients] = useState<EditableIngredient[]>([]);
  const [ingredientSearchQuery, setIngredientSearchQuery] = useState("");
  const [ingredientSearchResults, setIngredientSearchResults] = useState<Food[]>([]);
  const [isSearchingIngredient, setIsSearchingIngredient] = useState(false);

  const [isLoggingRecipe, setIsLoggingRecipe] = useState(false);
  const [isDeletingRecipe, setIsDeletingRecipe] = useState(false);
  const [isSavingRecipe, setIsSavingRecipe] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [servingMultiplier, setServingMultiplier] = useState(1);

  // Custom food creator
  const [showCustomCreator, setShowCustomCreator] = useState(false);

  // =============================================================
  // Reset on modal close
  // =============================================================

  useEffect(() => {
    if (!isOpen) {
      setRecipeSearchQuery("");
      setSelectedRecipeId(null);
      setRecipeDetail(null);
      setServingMultiplier(1);
      setShowCustomCreator(false);
    } else {
      if (initialTab) setActiveTab(initialTab);
      if (initialTab === "custom") setShowCustomCreator(true);
    }
  }, [isOpen, initialTab]);

  // =============================================================
  // Fetch recipe list (lightweight)
  // =============================================================

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

  // =============================================================
  // Fetch recipe detail (single call with resolved ingredients)
  // =============================================================

  const openRecipeDetail = useCallback(async (recipeId: string) => {
    setSelectedRecipeId(recipeId);
    setRecipeDetail(null);
    setIsLoadingDetail(true);
    setEditIngredients([]);
    setSaveError(null);
    setIngredientSearchQuery("");
    setIngredientSearchResults([]);
    setServingMultiplier(1);

    try {
      const res = await apiFetch(`/api/v2/nutrition/recipe/${recipeId}`);
      if (res.ok) {
        const detail: RecipeDetail = await res.json();
        setRecipeDetail(detail);

        // Populate editable state from the detail response
        setEditName(detail.title);
        setEditInstructions(detail.instructions || "");

        // Compute portions from total_weight / serving factor
        if (detail.measures && detail.total_weight_g) {
          const servingMeasure = detail.measures.find((m) => m.is_default);
          if (servingMeasure && servingMeasure.conversion_factor > 0) {
            setEditPortions(Math.max(1, Math.round(detail.total_weight_g / servingMeasure.conversion_factor)));
          } else {
            setEditPortions(1);
          }
        } else {
          setEditPortions(1);
        }

        // Convert resolved ingredients to editable state
        const editable: EditableIngredient[] = [];
        for (const ing of detail.ingredients) {
          const food = ing.food;
          if (!food || !food.measures || food.measures.length === 0) continue;
          const defaultMeasure = food.measures.find((m: FoodMeasure) => m.is_default) || food.measures[0];
          const quantity = ing.weight_g / defaultMeasure.conversion_factor;
          editable.push({
            food,
            measure_id: defaultMeasure.id,
            quantityStr: String(Math.round(quantity * 100) / 100),
          });
        }
        setEditIngredients(editable);
      } else {
        setSelectedRecipeId(null);
      }
    } catch {
      setSelectedRecipeId(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  // =============================================================
  // Ingredient search for adding new ones
  // =============================================================

  useEffect(() => {
    if (!selectedRecipeId) return;
    if (ingredientSearchQuery.length < 2) {
      setIngredientSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingIngredient(true);
      try {
        const res = await apiFetch(`/api/v2/nutrition/food/search?q=${encodeURIComponent(ingredientSearchQuery)}`);
        if (res.ok) setIngredientSearchResults(await res.json());
      } catch { /* */ } finally { setIsSearchingIngredient(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [ingredientSearchQuery, selectedRecipeId]);

  const addIngredient = useCallback((food: Food) => {
    const defaultMeasure = food.measures.find((m) => m.is_default) || food.measures[0];
    if (!defaultMeasure) return;
    setEditIngredients((prev) => [...prev, { food, measure_id: defaultMeasure.id, quantityStr: "1" }]);
    setIngredientSearchQuery("");
    setIngredientSearchResults([]);
  }, []);

  const updateQuantityStr = useCallback((index: number, value: string) => {
    setEditIngredients((prev) => prev.map((item, i) => (i === index ? { ...item, quantityStr: value } : item)));
  }, []);

  const updateMeasure = useCallback((index: number, measure_id: string) => {
    setEditIngredients((prev) => prev.map((item, i) => (i === index ? { ...item, measure_id } : item)));
  }, []);

  const removeIngredient = useCallback((index: number) => {
    setEditIngredients((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // =============================================================
  // Real-time macro summation
  // =============================================================

  const totalMacros = useMemo(() => {
    let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0, totalWeight = 0;
    for (const ingredient of editIngredients) {
      const measure = ingredient.food.measures.find((m) => m.id === ingredient.measure_id);
      if (!measure) continue;
      const quantity = parseFloat(ingredient.quantityStr) || 0;
      const baseWeight = quantity * measure.conversion_factor;
      totalCalories += (baseWeight / 100) * ingredient.food.calories_per_100;
      totalProtein += (baseWeight / 100) * ingredient.food.protein_per_100;
      totalCarbs += (baseWeight / 100) * ingredient.food.carbs_per_100;
      totalFat += (baseWeight / 100) * ingredient.food.fat_per_100;
      totalWeight += baseWeight;
    }
    return {
      calories: Math.round(totalCalories * 10) / 10,
      protein: Math.round(totalProtein * 10) / 10,
      carbs: Math.round(totalCarbs * 10) / 10,
      fat: Math.round(totalFat * 10) / 10,
      weight: Math.round(totalWeight * 10) / 10,
    };
  }, [editIngredients]);

  // =============================================================
  // Save recipe changes (PUT)
  // =============================================================

  const handleSaveRecipe = useCallback(async () => {
    if (!recipeDetail) return;
    if (!editName.trim()) { setSaveError("Recipe name is required"); return; }
    if (editIngredients.length === 0) { setSaveError("Add at least one ingredient"); return; }
    if (editPortions < 1) { setSaveError("Portions must be at least 1"); return; }

    for (const ingredient of editIngredients) {
      const qty = parseFloat(ingredient.quantityStr);
      if (!qty || qty <= 0) { setSaveError("All ingredients must have a quantity > 0"); return; }
    }

    setIsSavingRecipe(true);
    setSaveError(null);

    try {
      const res = await apiFetch(`/api/v2/nutrition/recipe/${recipeDetail.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          instructions: editInstructions.trim() || null,
          portions: editPortions,
          ingredients: editIngredients.map((i) => ({
            food_id: i.food.id,
            measure_id: i.measure_id,
            quantity: parseFloat(i.quantityStr) || 0,
          })),
        }),
      });

      if (res.ok) {
        useCacheStore.getState().clearCache();
        setSelectedRecipeId(null);
        setRecipeDetail(null);
        fetchRecipes();
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.detail || "Failed to update recipe");
      }
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setIsSavingRecipe(false);
    }
  }, [recipeDetail, editName, editInstructions, editPortions, editIngredients, fetchRecipes]);

  // =============================================================
  // Log recipe
  // =============================================================

  const handleLogRecipe = useCallback(async (mealKey: string) => {
    if (!recipeDetail || !accessToken) return;

    const servingMeasure = recipeDetail.measures.find((m) => m.is_default) || recipeDetail.measures[0];
    if (!servingMeasure) return;

    setIsLoggingRecipe(true);
    try {
      const res = await apiFetch(`/api/v2/nutrition/diary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logged_at: `${selectedDate}T12:00:00`,
          meal_type: mealKey,
          food_id: recipeDetail.food_id,
          measure_id: servingMeasure.id,
          quantity: servingMultiplier,
        }),
      });
      if (res.ok) {
        setSelectedRecipeId(null);
        setRecipeDetail(null);
        onFoodLogged();
        onClose();
      }
    } catch {} finally { setIsLoggingRecipe(false); }
  }, [recipeDetail, accessToken, selectedDate, servingMultiplier, onFoodLogged, onClose]);

  // =============================================================
  // Delete recipe
  // =============================================================

  const handleDeleteRecipe = useCallback(async () => {
    if (!recipeDetail || !accessToken) return;
    setIsDeletingRecipe(true);
    try {
      const res = await apiFetch(`/api/v2/nutrition/recipe/${recipeDetail.id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setSelectedRecipeId(null);
        setRecipeDetail(null);
        fetchRecipes();
      }
    } catch {} finally { setIsDeletingRecipe(false); }
  }, [recipeDetail, accessToken, fetchRecipes]);

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
                        <button key={r.id} onClick={() => openRecipeDetail(r.id)} className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3.5 hover:bg-white/[0.06] hover:border-white/10 transition-all text-left active:scale-[0.98]">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{r.title}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                {r.total_calories !== undefined && (
                                  <span>{Math.round(r.total_calories)} kcal/serving</span>
                                )}
                              </p>
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
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                  <Plus className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white mb-1">Create Custom Food</p>
                  <p className="text-[11px] text-gray-500 max-w-[240px]">
                    Define nutrition per 100g/ml with custom serving sizes like Scoop, Slice, or Cup.
                  </p>
                </div>
                <button
                  onClick={() => setShowCustomCreator(true)}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 px-6 py-3 text-xs font-semibold text-white shadow-[0_0_20px_rgba(168,85,247,0.25)] hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] active:scale-[0.98] transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Open Food Creator
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>

    {/* Recipe Detail Sub-Modal — Single API call, shimmer on load */}
    <AnimatePresence>
      {selectedRecipeId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-end justify-center"
          onClick={() => { setSelectedRecipeId(null); setRecipeDetail(null); }}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[85dvh] rounded-t-3xl bg-[#0a0a0c]/98 border-t border-white/10 backdrop-blur-xl overflow-hidden flex flex-col pb-[env(safe-area-inset-bottom)]"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <ChefHat className="h-4 w-4 text-accent-cyan flex-shrink-0" />
                <span className="text-sm font-semibold text-white truncate">Recipe</span>
              </div>
              <button onClick={() => { setSelectedRecipeId(null); setRecipeDetail(null); }} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Shimmer while loading */}
            {isLoadingDetail && <RecipeDetailShimmer />}

            {/* Loaded content */}
            {!isLoadingDetail && recipeDetail && (
              <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4 transform-gpu">
                {/* Editable Name */}
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple/50"
                  />
                </div>

                {/* Editable Instructions */}
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">Instructions</label>
                  <textarea
                    value={editInstructions}
                    onChange={(e) => setEditInstructions(e.target.value)}
                    placeholder="How to prepare..."
                    rows={2}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-purple resize-none"
                  />
                </div>

                {/* Editable Portions */}
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">Portions</label>
                  <input
                    type="number"
                    min={1}
                    value={editPortions}
                    onChange={(e) => setEditPortions(Math.max(1, Number(e.target.value)))}
                    className="w-24 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white outline-none focus:border-accent-purple [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

                {/* Ingredients */}
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    Ingredients {editIngredients.length > 0 && `(${editIngredients.length})`}
                  </label>

                  {/* Add ingredient search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                    <input
                      type="text"
                      value={ingredientSearchQuery}
                      onChange={(e) => setIngredientSearchQuery(e.target.value)}
                      placeholder="Add ingredient..."
                      className="w-full rounded-xl bg-white/5 border border-white/10 pl-9 pr-4 py-2.5 text-xs text-white placeholder-gray-600 outline-none focus:border-accent-purple"
                    />
                    {isSearchingIngredient && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-accent-purple animate-spin" />}
                  </div>

                  {/* Search results */}
                  {ingredientSearchResults.length > 0 && (
                    <div className="space-y-1 max-h-28 overflow-y-auto">
                      {ingredientSearchResults.map((food) => (
                        <button key={food.id} onClick={() => addIngredient(food)} className="w-full flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2 text-left hover:bg-white/[0.05] transition-colors">
                          <div>
                            <p className="text-xs text-white">{food.name}</p>
                            <p className="text-[9px] text-gray-500">{food.calories_per_100} kcal/100{food.base_unit}{food.brand ? ` • ${food.brand}` : ""}</p>
                          </div>
                          <Plus className="h-3.5 w-3.5 text-gray-500" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Ingredient rows */}
                  {editIngredients.map((item, index) => {
                    const selectedMeasure = item.food.measures.find((m) => m.id === item.measure_id);
                    const qty = parseFloat(item.quantityStr) || 0;
                    const baseWeight = selectedMeasure ? qty * selectedMeasure.conversion_factor : 0;
                    const ingredientCal = (baseWeight / 100) * item.food.calories_per_100;
                    return (
                      <IngredientRow
                        key={`${item.food.id}-${index}`}
                        item={item}
                        index={index}
                        ingredientCal={ingredientCal}
                        onUpdateQuantity={updateQuantityStr}
                        onUpdateMeasure={updateMeasure}
                        onRemove={removeIngredient}
                      />
                    );
                  })}
                </div>

                {/* Live Macro Preview */}
                {editIngredients.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Total Recipe</span>
                      <span className="text-[10px] text-gray-500">{totalMacros.weight}g</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="rounded-lg bg-white/[0.03] p-2 text-center">
                        <p className="text-xs font-bold text-white">{totalMacros.calories}</p>
                        <p className="text-[8px] text-gray-500">kcal</p>
                      </div>
                      <div className="rounded-lg bg-white/[0.03] p-2 text-center">
                        <p className="text-xs font-bold text-accent-cyan">{totalMacros.protein}g</p>
                        <p className="text-[8px] text-gray-500">Protein</p>
                      </div>
                      <div className="rounded-lg bg-white/[0.03] p-2 text-center">
                        <p className="text-xs font-bold text-accent-purple">{totalMacros.carbs}g</p>
                        <p className="text-[8px] text-gray-500">Carbs</p>
                      </div>
                      <div className="rounded-lg bg-white/[0.03] p-2 text-center">
                        <p className="text-xs font-bold text-accent-indigo">{totalMacros.fat}g</p>
                        <p className="text-[8px] text-gray-500">Fat</p>
                      </div>
                    </div>
                    {editPortions > 1 && (
                      <div className="mt-2 pt-2 border-t border-white/5">
                        <p className="text-[10px] text-gray-500 text-center">
                          Per serving ({editPortions}):{" "}
                          <span className="text-white font-medium">{Math.round(totalMacros.calories / editPortions)} kcal</span>
                          {" • "}<span className="text-accent-cyan">{(totalMacros.protein / editPortions).toFixed(1)}g P</span>
                          {" • "}<span className="text-accent-purple">{(totalMacros.carbs / editPortions).toFixed(1)}g C</span>
                          {" • "}<span className="text-accent-indigo">{(totalMacros.fat / editPortions).toFixed(1)}g F</span>
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Serving multiplier for logging */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Log Servings</span>
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

                {/* Error */}
                {saveError && (
                  <p className="text-xs text-status-rose bg-status-rose/10 border border-status-rose/20 rounded-lg px-3 py-2">{saveError}</p>
                )}

                {/* Save Changes */}
                <button
                  onClick={handleSaveRecipe}
                  disabled={isSavingRecipe || !editName.trim() || editIngredients.length === 0}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-indigo via-accent-purple to-accent-cyan py-3.5 text-sm font-semibold text-white disabled:opacity-50 shadow-[0_0_15px_rgba(168,85,247,0.3)] active:scale-[0.98]"
                >
                  {isSavingRecipe ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Save Changes</>}
                </button>

                {/* Delete */}
                <button
                  onClick={handleDeleteRecipe}
                  disabled={isDeletingRecipe}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-status-rose/5 border border-status-rose/20 py-3 text-xs font-medium text-status-rose hover:bg-status-rose/10 transition-colors disabled:opacity-50 active:scale-[0.98]"
                >
                  {isDeletingRecipe ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Delete Recipe
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Recipe Builder */}
    <CreateRecipe isOpen={showRecipeBuilder} onClose={() => setShowRecipeBuilder(false)} onRecipeSaved={() => { setShowRecipeBuilder(false); fetchRecipes(); }} />

    {/* V2.5 Custom Food Creator */}
    <CustomFoodCreator
      isOpen={showCustomCreator}
      onClose={() => setShowCustomCreator(false)}
      onFoodCreated={(food: Food) => {
        setShowCustomCreator(false);
        onFoodLogged();
        onClose();
      }}
    />
    </>
  );
}
