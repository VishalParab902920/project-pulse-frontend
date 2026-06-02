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
  created_by: string | null;
  measures: FoodMeasure[];
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
}
