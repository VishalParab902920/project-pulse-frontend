"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Plus, Trash2, Loader2, Check, ChefHat, ChevronDown } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useUIStore } from "@/store/useUIStore";
import type { Food, FoodMeasure } from "@/lib/types/nutrition";

// =============================================================
// Types
// =============================================================

interface RecipeIngredient {
  food: Food;
  measure_id: string;
  quantityStr: string; // String state to avoid leading-zero issue
}

interface CreateRecipeProps {
  isOpen: boolean;
  onClose: () => void;
  onRecipeSaved: () => void;
}

// =============================================================
// IngredientRow — with custom animated measure dropdown
// =============================================================

function IngredientRow({
  item,
  index,
  ingredientCal,
  onUpdateQuantity,
  onUpdateMeasure,
  onRemove,
}: {
  item: RecipeIngredient;
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

  // Close dropdown on outside click
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
      {/* Food Name & Delete */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-white font-medium truncate flex-1 mr-2">
          {item.food.name}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">
            {Math.round(ingredientCal)} kcal
          </span>
          <button
            onClick={() => onRemove(index)}
            className="p-1 rounded text-gray-600 hover:text-status-rose transition-colors"
            aria-label={`Remove ${item.food.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Quantity Input + Custom Measure Dropdown — inline */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={item.quantityStr}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "" || /^\d*\.?\d*$/.test(val)) {
              onUpdateQuantity(index, val);
            }
          }}
          onBlur={(e) => {
            const parsed = parseFloat(e.target.value);
            if (!parsed || parsed <= 0) {
              onUpdateQuantity(index, "1");
            }
          }}
          className="w-16 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-white text-center outline-none focus:border-accent-purple"
        />

        {/* Custom dropdown — same style as meal type selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-bold text-accent-purple hover:border-accent-purple/30 focus:outline-none focus:border-accent-purple/50 focus:shadow-[0_0_12px_rgba(168,85,247,0.1)] transition-all"
          >
            {measureLabel}
            <ChevronDown className={`h-3 w-3 text-gray-500 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 mt-1.5 z-50 rounded-xl bg-[#0a0a0a] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl overflow-hidden min-w-[120px]"
              >
                {item.food.measures.map((measure) => {
                  const isActive = measure.id === item.measure_id;
                  return (
                    <button
                      key={measure.id}
                      type="button"
                      onClick={() => {
                        onUpdateMeasure(index, measure.id);
                        setDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${
                        isActive
                          ? "bg-accent-purple/10 border-l-2 border-accent-purple"
                          : "hover:bg-white/5 border-l-2 border-transparent"
                      }`}
                    >
                      <span className={`text-xs font-semibold ${isActive ? "text-accent-purple" : "text-white"}`}>
                        {measure.measure_name}
                      </span>
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
// CreateRecipe — V2.5 with Per-Ingredient Custom Serving Selector
// =============================================================

export default function CreateRecipe({ isOpen, onClose, onRecipeSaved }: CreateRecipeProps) {
  const storeToken = useUserStore((s) => s.accessToken);
  const accessToken = storeToken || getAccessToken();

  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [portions, setPortions] = useState(1);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Food[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setName("");
      setInstructions("");
      setPortions(1);
      setIngredients([]);
      setSearchQuery("");
      setSearchResults([]);
      setError(null);
    }
  }, [isOpen]);

  // Debounced food search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await apiFetch(
          `/api/v2/nutrition/food/search?q=${encodeURIComponent(searchQuery)}`
        );
        if (res.ok) {
          const data: Food[] = await res.json();
          setSearchResults(data);
        }
      } catch {
        // Silently fail
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, accessToken]);

  // Add ingredient with default measure and quantity = 1
  const addIngredient = useCallback((food: Food) => {
    const defaultMeasure = food.measures.find((m) => m.is_default) || food.measures[0];
    if (!defaultMeasure) return;

    setIngredients((prev) => [
      ...prev,
      { food, measure_id: defaultMeasure.id, quantityStr: "1" },
    ]);
    setSearchQuery("");
    setSearchResults([]);
  }, []);

  // Update quantity string for ingredient at index
  const updateQuantityStr = useCallback((index: number, value: string) => {
    setIngredients((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quantityStr: value } : item))
    );
  }, []);

  // Update selected measure for ingredient at index
  const updateMeasure = useCallback((index: number, measure_id: string) => {
    setIngredients((prev) =>
      prev.map((item, i) => (i === index ? { ...item, measure_id } : item))
    );
  }, []);

  // Remove ingredient at index
  const removeIngredient = useCallback((index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // =============================================================
  // Real-Time Macro Summation (Eliminates NaN bug)
  // =============================================================

  const totalMacros = useMemo(() => {
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalWeight = 0;

    for (const ingredient of ingredients) {
      const measure = ingredient.food.measures.find((m) => m.id === ingredient.measure_id);
      if (!measure) continue;

      const quantity = parseFloat(ingredient.quantityStr) || 0;
      const baseWeight = quantity * measure.conversion_factor;
      const calories = (baseWeight / 100) * ingredient.food.calories_per_100;
      const protein = (baseWeight / 100) * ingredient.food.protein_per_100;
      const carbs = (baseWeight / 100) * ingredient.food.carbs_per_100;
      const fat = (baseWeight / 100) * ingredient.food.fat_per_100;

      totalCalories += calories;
      totalProtein += protein;
      totalCarbs += carbs;
      totalFat += fat;
      totalWeight += baseWeight;
    }

    return {
      calories: Math.round(totalCalories * 10) / 10,
      protein: Math.round(totalProtein * 10) / 10,
      carbs: Math.round(totalCarbs * 10) / 10,
      fat: Math.round(totalFat * 10) / 10,
      weight: Math.round(totalWeight * 10) / 10,
    };
  }, [ingredients]);

  // =============================================================
  // Form Submission
  // =============================================================

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setError("Recipe name is required");
      return;
    }
    if (ingredients.length === 0) {
      setError("Add at least one ingredient");
      return;
    }
    if (portions < 1) {
      setError("Portions must be at least 1");
      return;
    }

    // Validate all ingredients have valid quantities
    for (const ingredient of ingredients) {
      const qty = parseFloat(ingredient.quantityStr);
      if (!qty || qty <= 0) {
        setError("All ingredients must have a quantity > 0");
        return;
      }
      const measure = ingredient.food.measures.find((m) => m.id === ingredient.measure_id);
      if (!measure) {
        setError(`Invalid measure selected for ${ingredient.food.name}`);
        return;
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/v2/nutrition/recipe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          instructions: instructions.trim() || null,
          portions,
          ingredients: ingredients.map((i) => ({
            food_id: i.food.id,
            measure_id: i.measure_id,
            quantity: parseFloat(i.quantityStr) || 0,
          })),
        }),
      });

      if (res.ok) {
        onRecipeSaved();
        onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Failed to save recipe");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [name, instructions, portions, ingredients, onRecipeSaved, onClose]);

  // Modal open/close UI tracking
  const { setModalOpen } = useUIStore();
  useEffect(() => {
    setModalOpen(isOpen);
    return () => { setModalOpen(false); };
  }, [isOpen, setModalOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-0 left-0 right-0 max-h-[90dvh] rounded-t-3xl bg-surface-solid border-t border-white/10 overflow-hidden flex flex-col"
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-3">
            <div className="flex items-center gap-2">
              <ChefHat className="h-4 w-4 text-accent-purple" />
              <h2 className="text-base font-semibold text-white">Create Recipe</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4 transform-gpu">
            {/* Recipe Name */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Recipe Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Bread Omelette"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple/50"
              />
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Instructions (optional)</label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="How to prepare..."
                rows={2}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-purple resize-none"
              />
            </div>

            {/* Portions */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Number of Portions</label>
              <input
                type="number"
                min={1}
                value={portions}
                onChange={(e) => setPortions(Math.max(1, Number(e.target.value)))}
                className="w-24 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-accent-purple [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            {/* Ingredient Search */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Add Ingredients</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search foods..."
                  className="w-full rounded-xl bg-white/5 border border-white/10 pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-purple"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-accent-purple animate-spin" />
                )}
              </div>

              {/* Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {searchResults.map((food) => (
                    <button
                      key={food.id}
                      onClick={() => addIngredient(food)}
                      className="w-full flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2 text-left hover:bg-white/[0.05] transition-colors"
                    >
                      <div>
                        <p className="text-xs text-white">{food.name}</p>
                        <p className="text-[9px] text-gray-500">
                          {food.calories_per_100} kcal/100{food.base_unit}
                          {food.brand ? ` • ${food.brand}` : ""}
                        </p>
                      </div>
                      <Plus className="h-3.5 w-3.5 text-gray-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Ingredient List with Per-Ingredient Serving Selector */}
            {ingredients.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-400">
                  Ingredients ({ingredients.length})
                </p>
                {ingredients.map((item, index) => {
                  const selectedMeasure = item.food.measures.find(
                    (m) => m.id === item.measure_id
                  );
                  const qty = parseFloat(item.quantityStr) || 0;
                  const baseWeight = selectedMeasure
                    ? qty * selectedMeasure.conversion_factor
                    : 0;
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

                {/* Total Recipe Macros Preview */}
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                      Total Recipe
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {totalMacros.weight}g total weight
                    </span>
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
                  {portions > 1 && (
                    <div className="mt-2 pt-2 border-t border-white/5">
                      <p className="text-[10px] text-gray-500 text-center">
                        Per serving ({portions} portions):{" "}
                        <span className="text-white font-medium">
                          {Math.round(totalMacros.calories / portions)} kcal
                        </span>
                        {" • "}
                        <span className="text-accent-cyan">
                          {(totalMacros.protein / portions).toFixed(1)}g P
                        </span>
                        {" • "}
                        <span className="text-accent-purple">
                          {(totalMacros.carbs / portions).toFixed(1)}g C
                        </span>
                        {" • "}
                        <span className="text-accent-indigo">
                          {(totalMacros.fat / portions).toFixed(1)}g F
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-xs text-status-rose bg-status-rose/10 border border-status-rose/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={isSaving || !name.trim() || ingredients.length === 0}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-indigo via-accent-purple to-accent-cyan py-3.5 text-sm font-semibold text-white disabled:opacity-50 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Save Recipe
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
