/**
 * High-precision physiological calculators
 * Uses formulas defined in Kayan v2.5.2 spec.
 */

/**
 * Clamp and round BF% to 1 decimal place; returns null if invalid
 */
export function sanitizeBf(raw: number | null): number | null {
  if (raw === null || isNaN(raw) || raw < 1 || raw > 60) return null;
  return parseFloat(raw.toFixed(1));
}

/**
 * Calculate Body Fat Percentage using the US Navy Method.
 * All measurements can be passed in cm or inches. Set `isMetric = true` (default) if passing cm.
 *
 * @param gender 'male' | 'female'
 * @param waist Measurement in cm or inches
 * @param neck Measurement in cm or inches
 * @param height Measurement in cm or inches
 * @param hip Measurement in cm or inches (required for female)
 * @param isMetric boolean defaults to true
 * @returns Body fat percentage
 */
export function calculateNavyBodyFat(
  gender: 'male' | 'female',
  waist: number,
  neck: number,
  height: number,
  hip: number = 0,
  isMetric: boolean = true
): number {
  const toInches = (val: number) => isMetric ? val / 2.54 : val;

  const waistInches = toInches(waist);
  const neckInches = toInches(neck);
  const heightInches = toInches(height);
  const hipInches = toInches(hip);

  if (gender === 'male') {
    return 86.010 * Math.log10(waistInches - neckInches) - 70.041 * Math.log10(heightInches) + 36.76;
  } else {
    return 163.205 * Math.log10(waistInches + hipInches - neckInches) - 97.684 * Math.log10(heightInches) - 78.387;
  }
}

/**
 * Calculate Body Fat Percentage using Deurenberg BMI Formula.
 *
 * @param bmi Body Mass Index (weight_kg / (height_m^2))
 * @param age Age in years
 * @param gender 'male' | 'female'
 * @returns Body fat percentage
 */
export function calculateDeurenbergBodyFat(bmi: number, age: number, gender: 'male' | 'female'): number {
  const genderNumeric = gender === 'male' ? 1 : 0;
  return (1.20 * bmi) + (0.23 * age) - (10.8 * genderNumeric) - 5.4;
}

/**
 * Calculate Basal Metabolic Rate (BMR)
 * Uses Katch-McArdle if bodyFatPct is provided, otherwise falls back to Mifflin-St Jeor.
 *
 * @param weightKg Weight in kg
 * @param heightCm Height in cm (required for Mifflin-St Jeor fallback)
 * @param age Age in years (required for Mifflin-St Jeor fallback)
 * @param gender 'male' | 'female' (required for Mifflin-St Jeor fallback)
 * @param bodyFatPct Optional body fat percentage for Katch-McArdle
 * @returns BMR in kcal
 */
export function calculateBMR(
  weightKg: number,
  heightCm?: number,
  age?: number,
  gender?: 'male' | 'female',
  bodyFatPct?: number
): number {
  if (bodyFatPct !== undefined && bodyFatPct !== null) {
    // Katch-McArdle
    const lbm = weightKg * (1 - (bodyFatPct / 100));
    return 370 + (21.6 * lbm);
  }

  if (heightCm === undefined || age === undefined || gender === undefined) {
    throw new Error("Height, age, and gender are required if bodyFatPct is not provided.");
  }

  // Mifflin-St Jeor
  if (gender === 'male') {
    return (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
  } else {
    return (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
  }
}

export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'highly_active' | 'competitive_athlete';

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  highly_active: 1.725,
  competitive_athlete: 1.9,
};

/**
 * Calculate Total Daily Energy Expenditure (TDEE)
 *
 * @param bmr Basal Metabolic Rate in kcal
 * @param activityLevel Activity level modifier
 * @returns TDEE in kcal
 */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return bmr * ACTIVITY_MULTIPLIERS[activityLevel];
}
