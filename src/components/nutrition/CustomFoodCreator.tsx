"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, Loader2, Check, FlaskConical, AlertTriangle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cacheFoods } from "@/lib/offlineCache";
import type { Food, FoodCreatePayload, FoodMeasureCreatePayload } from "@/lib/types/nutrition";

/**
 * CustomFoodCreator — V2.5.2 Custom Food + Nested Servings Interface
 *
 * Allows users to define a new food with macros per 100g/ml
 * and attach one or more custom serving sizes (measures).
 *
 * Phase 4: Allergen Tag Selector — visual click-pill grid of major
 * allergen categories. Selected keys are appended to the POST payload's
 * `allergens` array on form submission.
 *
 * Tech-Noir design: deep black bg, glassmorphism cards, glowing accents.
 */

interface CustomFoodCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onFoodCreated: (food: Food) => void;
}

interface MeasureRow {
  id: string;
  measure_name: string;
  conversion_factor: string;
}

function generateRowId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Sanitize numeric input — digits + single period only.
 */
function sanitizeNumeric(raw: string): string {
  let value = raw.replace(",", ".");
  value = value.replace(/[^0-9.]/g, "");
  const parts = value.split(".");
  if (parts.length > 2) {
    value = parts[0] + "." + parts.slice(1).join("");
  }
  return value;
}

// ---------------------------------------------------------------------------
// Phase 4: Major allergen classification list
// ---------------------------------------------------------------------------

const ALLERGEN_CATEGORIES = [
  "peanuts",
  "tree nuts",
  "dairy",
  "eggs",
  "wheat",
  "soy",
  "fish",
  "shellfish",
  "sesame",
] as const;

type AllergenCategory = (typeof ALLERGEN_CATEGORIES)[number];

export default function CustomFoodCreator({
  isOpen,
  onClose,
  onFoodCreated,
}: CustomFoodCreatorProps) {
  // Basic fields
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [barcode, setBarcode] = useState("");
  const [baseUnit, setBaseUnit] = useState<"g" | "ml">("g");

  // Macros per 100
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  // Custom measures
  const [measures, setMeasures] = useState<MeasureRow[]>([]);

  // Phase 4: Allergen selection
  const [selectedAllergens, setSelectedAllergens] = useState<Set<AllergenCategory>>(
    new Set()
  );

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add blank measure row
  const addMeasureRow = useCallback(() => {
    setMeasures((prev) => [
      ...prev,
      { id: generateRowId(), measure_name: "", conversion_factor: "" },
    ]);
  }, []);

  // Remove measure row
  const removeMeasureRow = useCallback((id: string) => {
    setMeasures((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // Update measure field
  const updateMeasure = useCallback(
    (id: string, field: "measure_name" | "conversion_factor", value: string) => {
      setMeasures((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m;
          if (field === "conversion_factor") {
            return { ...m, [field]: sanitizeNumeric(value) };
          }
          return { ...m, [field]: value };
        })
      );
    },
    []
  );

  // Phase 4: Toggle allergen pill
  const toggleAllergen = useCallback((allergen: AllergenCategory) => {
    setSelectedAllergens((prev) => {
      const next = new Set(prev);
      if (next.has(allergen)) {
        next.delete(allergen);
      } else {
        next.add(allergen);
      }
      return next;
    });
  }, []);

  // Validate form
  const isValid =
    name.trim().length > 0 &&
    parseFloat(calories) >= 0 &&
    parseFloat(protein) >= 0 &&
    parseFloat(carbs) >= 0 &&
    parseFloat(fat) >= 0 &&
    !isNaN(parseFloat(calories)) &&
    !isNaN(parseFloat(protein)) &&
    !isNaN(parseFloat(carbs)) &&
    !isNaN(parseFloat(fat));

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (!isValid) return;

    setIsSubmitting(true);
    setError(null);

    // Build measures payload — filter out incomplete rows
    const validMeasures: FoodMeasureCreatePayload[] = measures
      .filter((m) => m.measure_name.trim().length > 0 && parseFloat(m.conversion_factor) > 0)
      .map((m) => ({
        measure_name: m.measure_name.trim(),
        conversion_factor: parseFloat(m.conversion_factor),
      }));

    const payload: FoodCreatePayload = {
      name: name.trim(),
      brand: brand.trim() || null,
      barcode: barcode.trim() || null,
      base_unit: baseUnit,
      calories_per_100: parseFloat(calories),
      protein_per_100: parseFloat(protein),
      carbs_per_100: parseFloat(carbs),
      fat_per_100: parseFloat(fat),
      is_custom: true,
      measures: validMeasures,
      // Phase 4: append selected allergen keys
      allergens: Array.from(selectedAllergens),
    };

    try {
      const res = await apiFetch("/api/v2/nutrition/food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const createdFood: Food = await res.json();
        // Cache the new custom food for immediate offline availability
        await cacheFoods([createdFood]);
        onFoodCreated(createdFood);
        resetForm();
        onClose();
      } else {
        const errData = await res.json().catch(() => null);
        setError(errData?.detail || `Server error: ${res.status}`);
      }
    } catch (err) {
      setError("Network error — please try again");
      console.error("[CustomFoodCreator] Submit failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  }, [isValid, name, brand, barcode, baseUnit, calories, protein, carbs, fat, measures, selectedAllergens, onFoodCreated, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset form
  const resetForm = useCallback(() => {
    setName("");
    setBrand("");
    setBarcode("");
    setBaseUnit("g");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setMeasures([]);
    setSelectedAllergens(new Set());
    setError(null);
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-0 left-0 right-0 max-h-[90dvh] rounded-t-3xl border-t border-white/10 overflow-hidden flex flex-col"
            style={{ background: "#050505" }}
          >
            {/* Handle Bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-purple-400" />
                <h2 className="text-sm font-semibold text-white">Create Custom Food</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-5">
              {/* Basic Fields */}
              <div className="space-y-3">
                {/* Name */}
                <div>
                  <label className="text-[10px] font-medium text-gray-500 mb-1 block">
                    Food Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Homemade Granola"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-all"
                  />
                </div>

                {/* Brand + Barcode Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-medium text-gray-500 mb-1 block">Brand</label>
                    <input
                      type="text"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-gray-500 mb-1 block">Barcode</label>
                    <input
                      type="text"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-all"
                    />
                  </div>
                </div>

                {/* Base Unit Toggle */}
                <div>
                  <label className="text-[10px] font-medium text-gray-500 mb-1.5 block">
                    Macros per 100 base units
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBaseUnit("g")}
                      className={`flex-1 rounded-xl py-2.5 text-xs font-medium transition-all border ${
                        baseUnit === "g"
                          ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                          : "bg-white/5 border-white/10 text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      Solid (g)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBaseUnit("ml")}
                      className={`flex-1 rounded-xl py-2.5 text-xs font-medium transition-all border ${
                        baseUnit === "ml"
                          ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                          : "bg-white/5 border-white/10 text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      Liquid (ml)
                    </button>
                  </div>
                </div>
              </div>

              {/* Macros Section */}
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4 backdrop-blur-xl">
                <p className="text-[10px] font-medium text-gray-400 mb-3">
                  Nutrition per 100{baseUnit} <span className="text-red-400">*</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] text-gray-500 mb-1 block">Calories (kcal)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={calories}
                      onChange={(e) => setCalories(sanitizeNumeric(e.target.value))}
                      placeholder="0"
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-cyan-400 placeholder-gray-700 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 font-medium tabular-nums transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-500 mb-1 block">Protein (g)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={protein}
                      onChange={(e) => setProtein(sanitizeNumeric(e.target.value))}
                      placeholder="0"
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-purple-400 placeholder-gray-700 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 font-medium tabular-nums transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-500 mb-1 block">Carbs (g)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={carbs}
                      onChange={(e) => setCarbs(sanitizeNumeric(e.target.value))}
                      placeholder="0"
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-indigo-400 placeholder-gray-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 font-medium tabular-nums transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-500 mb-1 block">Fat (g)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={fat}
                      onChange={(e) => setFat(sanitizeNumeric(e.target.value))}
                      placeholder="0"
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-cyan-400 placeholder-gray-700 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 font-medium tabular-nums transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* ── Phase 4: Allergen Tag Selector ── */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-status-rose flex-shrink-0" />
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Allergen Categories
                  </p>
                </div>
                <p className="text-[10px] text-gray-600 italic">
                  Select any allergens present in this food.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {ALLERGEN_CATEGORIES.map((allergen) => {
                    const isSelected = selectedAllergens.has(allergen);
                    return (
                      <button
                        key={allergen}
                        type="button"
                        onClick={() => toggleAllergen(allergen)}
                        className={`px-3 py-1.5 rounded-pill text-xs cursor-pointer transition-all capitalize ${
                          isSelected
                            ? "bg-status-rose/20 border border-status-rose text-white font-bold animate-pulse"
                            : "bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10"
                        }`}
                        aria-pressed={isSelected}
                      >
                        {allergen}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Servings / Portions Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-medium text-gray-400">Custom Servings / Portions</p>
                  <button
                    type="button"
                    onClick={addMeasureRow}
                    className="flex items-center gap-1 text-[10px] font-medium text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Add Serving Unit
                  </button>
                </div>

                {measures.length === 0 && (
                  <p className="text-[10px] text-gray-600 italic">
                    Default &quot;{baseUnit}&quot; measure created automatically.
                    Add custom servings like Scoop, Cookie, Slice, etc.
                  </p>
                )}

                {/* Measure Rows */}
                <div className="space-y-2">
                  {measures.map((row) => (
                    <motion.div
                      key={row.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3"
                    >
                      <div className="flex items-center gap-2">
                        {/* Serving Name */}
                        <input
                          type="text"
                          value={row.measure_name}
                          onChange={(e) => updateMeasure(row.id, "measure_name", e.target.value)}
                          placeholder="e.g., Cup"
                          className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-purple-500 transition-all"
                        />
                        {/* Conversion Factor */}
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row.conversion_factor}
                          onChange={(e) =>
                            updateMeasure(row.id, "conversion_factor", e.target.value)
                          }
                          placeholder="150"
                          className="w-20 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-purple-500 tabular-nums transition-all"
                        />
                        <span className="text-[10px] text-gray-500">{baseUnit}</span>
                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => removeMeasureRow(row.id)}
                          className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          aria-label="Remove serving"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {/* Helper text */}
                      {row.measure_name.trim() && row.conversion_factor && (
                        <p className="text-[9px] text-gray-600 mt-1.5 pl-1">
                          1 {row.measure_name.trim()} = {row.conversion_factor} {baseUnit}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[11px] text-red-400 text-center"
                >
                  {error}
                </motion.p>
              )}

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={!isValid || isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40 transition-all bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 shadow-[0_0_20px_rgba(168,85,247,0.25)] hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Create Food
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
