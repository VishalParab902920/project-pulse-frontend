"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Plus, Trash2, Loader2, Check, ChefHat } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

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

interface RecipeIngredient {
  food: FoodResult;
  weight_g: number;
}

interface RecipeBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onRecipeSaved: () => void;
}

export default function RecipeBuilder({ isOpen, onClose, onRecipeSaved }: RecipeBuilderProps) {
  const storeToken = useUserStore((s) => s.accessToken);
  const accessToken = storeToken || getAccessToken();

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setInstructions("");
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
        if (res.ok) setSearchResults(await res.json());
      } catch {
        // Silently fail
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, accessToken]);

  const addIngredient = useCallback((food: FoodResult) => {
    setIngredients((prev) => [...prev, { food, weight_g: 100 }]);
    setSearchQuery("");
    setSearchResults([]);
  }, []);

  const updateWeight = useCallback((index: number, weight: number) => {
    setIngredients((prev) =>
      prev.map((item, i) => (i === index ? { ...item, weight_g: weight } : item))
    );
  }, []);

  const removeIngredient = useCallback((index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      setError("Recipe title is required");
      return;
    }
    if (ingredients.length === 0) {
      setError("Add at least one ingredient");
      return;
    }
    if (ingredients.some((i) => i.weight_g <= 0)) {
      setError("All ingredients must have a weight > 0g");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/v2/nutrition/recipe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          instructions: instructions.trim() || null,
          ingredients: ingredients.map((i) => ({
            food_id: i.food.id,
            weight_g: i.weight_g,
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
  }, [title, instructions, ingredients, accessToken, onRecipeSaved, onClose]);

  // Calculate total macros
  const totalMacros = ingredients.reduce(
    (acc, i) => ({
      calories: acc.calories + (i.food.calories_per_100g * i.weight_g) / 100,
      protein: acc.protein + (i.food.protein_per_100g * i.weight_g) / 100,
      carbs: acc.carbs + (i.food.carbs_per_100g * i.weight_g) / 100,
      fat: acc.fat + (i.food.fat_per_100g * i.weight_g) / 100,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

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
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Recipe Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Morning Protein Shake"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple/50"
              />
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Instructions (optional)</label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Blend all ingredients..."
                rows={2}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-purple resize-none"
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

              {/* Search Results */}
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
                        <p className="text-[9px] text-gray-500">{food.calories_per_100g} kcal/100g</p>
                      </div>
                      <Plus className="h-3.5 w-3.5 text-gray-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Ingredient List */}
            {ingredients.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-400">
                  Ingredients ({ingredients.length})
                </p>
                {ingredients.map((item, index) => (
                  <div
                    key={`${item.food.id}-${index}`}
                    className="flex items-center gap-2 rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate">{item.food.name}</p>
                    </div>
                    <input
                      type="number"
                      value={item.weight_g}
                      onChange={(e) => updateWeight(index, Number(e.target.value))}
                      className="w-16 rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-xs text-white text-center outline-none focus:border-accent-purple [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-[10px] text-gray-500">g</span>
                    <button
                      onClick={() => removeIngredient(index)}
                      className="p-1 rounded text-gray-600 hover:text-status-rose transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                {/* Total Macros */}
                <div className="grid grid-cols-4 gap-2 mt-2">
                  <div className="rounded-lg bg-white/[0.03] p-2 text-center">
                    <p className="text-xs font-bold text-white">{Math.round(totalMacros.calories)}</p>
                    <p className="text-[8px] text-gray-500">kcal</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-2 text-center">
                    <p className="text-xs font-bold text-accent-cyan">{Math.round(totalMacros.protein)}g</p>
                    <p className="text-[8px] text-gray-500">Protein</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-2 text-center">
                    <p className="text-xs font-bold text-accent-purple">{Math.round(totalMacros.carbs)}g</p>
                    <p className="text-[8px] text-gray-500">Carbs</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-2 text-center">
                    <p className="text-xs font-bold text-accent-indigo">{Math.round(totalMacros.fat)}g</p>
                    <p className="text-[8px] text-gray-500">Fat</p>
                  </div>
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
              disabled={isSaving || !title.trim() || ingredients.length === 0}
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
