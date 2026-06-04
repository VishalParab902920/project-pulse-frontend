/**
 * Project Pulse V2.5 — Nutrition Domain Type Definitions
 * Exact client-side contracts matching backend Pydantic V2.5 schemas.
 */

export interface FoodMeasure {
  id: string;
  food_id: string;
  measure_name: string;
  conversion_factor: number;
  is_default: boolean;
}

export interface Food {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  base_unit: "g" | "ml";
  calories_per_100: number;
  protein_per_100: number;
  carbs_per_100: number;
  fat_per_100: number;
  is_custom: boolean;
  is_verified: boolean;
  is_archived?: boolean;
  created_by: string | null;
  measures: FoodMeasure[];
  allergens?: string[];
}

export interface NutritionLog {
  id: string;
  user_id: string;
  logged_at: string; // ISO 8601
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  food_id: string;
  measure_id: string;
  quantity: number;
  calculated_qty_base: number;
  calculated_calories: number;
  calculated_protein: number;
  calculated_carbs: number;
  calculated_fat: number;
  isPendingSync?: boolean;
  food?: Food;
  measure?: FoodMeasure;
}

export type MealType = NutritionLog["meal_type"];

export interface NutritionLogCreatePayload {
  food_id: string;
  measure_id: string;
  quantity: number;
  logged_at: string;
  meal_type: MealType;
}

export interface FoodMeasureCreatePayload {
  measure_name: string;
  conversion_factor: number;
}

export interface FoodCreatePayload {
  name: string;
  brand?: string | null;
  barcode?: string | null;
  base_unit: "g" | "ml";
  calories_per_100: number;
  protein_per_100: number;
  carbs_per_100: number;
  fat_per_100: number;
  is_custom: boolean;
  measures: FoodMeasureCreatePayload[];
  /** Phase 4: allergen categories selected by the user in CustomFoodCreator */
  allergens?: string[];
}

export interface RecipeIngredientData {
  food_id: string;
  weight_g: number;
  food_name: string | null;
}

export interface RecipeMeasureData {
  id: string;
  measure_name: string;
  conversion_factor: number;
  is_default: boolean;
}

export interface RecipeData {
  id: string;
  title: string;
  instructions: string | null;
  ingredients: RecipeIngredientData[];
  created_at: string;
  food_id?: string;
  calories_per_100?: number;
  protein_per_100?: number;
  carbs_per_100?: number;
  fat_per_100?: number;
  measures?: RecipeMeasureData[];
  total_calories?: number;
  total_protein?: number;
  total_carbs?: number;
  total_fat?: number;
  total_weight_g?: number;
}

export interface RecipeUpdatePayload {
  name: string;
  instructions: string | null;
  portions: number;
  ingredients: {
    food_id: string;
    measure_id: string;
    quantity: number;
  }[];
}

// --- Conversion Constants & Helpers ---

export const CONVERSIONS = {
  // Mass
  G_TO_OZ: 1 / 28.3495,
  G_TO_LB: 1 / 453.592,
  OZ_TO_G: 28.3495,
  LB_TO_G: 453.592,

  // Volume
  ML_TO_FL_OZ: 1 / 29.5735,
  FL_OZ_TO_ML: 29.5735,
};

/**
 * Helper to display values formatted according to user's unit preference.
 */
export function convertSolid(valueInGrams: number, toUnit: 'metric' | 'imperial', outputFormat: 'oz' | 'lb' = 'oz'): number {
  if (toUnit === 'metric') return valueInGrams;
  return outputFormat === 'oz' ? valueInGrams * CONVERSIONS.G_TO_OZ : valueInGrams * CONVERSIONS.G_TO_LB;
}

export function convertLiquid(valueInMl: number, toUnit: 'metric' | 'imperial'): number {
  if (toUnit === 'metric') return valueInMl;
  return valueInMl * CONVERSIONS.ML_TO_FL_OZ;
}
