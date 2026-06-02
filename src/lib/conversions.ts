/**
 * Project Pulse V2.5 — Client-Side Unit Conversion Engine
 * Mirrors backend Python conversion engine for offline-first macro calculation.
 *
 * Supports:
 *   - Mass family: g, kg, oz, lb
 *   - Volume family: ml, l, cup, fl_oz, tbsp, tsp, pt, qt, gal
 *   - Cross-family (volume ↔ mass) via density parameter
 */

/** Mass units expressed in grams */
const MASS_SCALES: Record<string, number> = {
  g: 1.0,
  kg: 1000.0,
  oz: 28.3495,
  lb: 453.592,
};

/** Volume units expressed in milliliters */
const VOLUME_SCALES: Record<string, number> = {
  ml: 1.0,
  l: 1000.0,
  cup: 240.0,
  fl_oz: 29.5735,
  tbsp: 15.0,
  tsp: 5.0,
  pt: 473.176,
  qt: 946.353,
  gal: 3785.41,
};

export type MassUnit = keyof typeof MASS_SCALES;
export type VolumeUnit = keyof typeof VOLUME_SCALES;
export type Unit = MassUnit | VolumeUnit;

function getUnitFamily(unit: string): "mass" | "volume" | null {
  if (unit in MASS_SCALES) return "mass";
  if (unit in VOLUME_SCALES) return "volume";
  return null;
}

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

export class ConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversionError";
  }
}

/**
 * Convert a numeric value between units.
 *
 * Same-family: direct mathematical scaling.
 * Cross-family (volume ↔ mass): requires density (g/ml).
 *
 * @param value - Numeric quantity to convert
 * @param fromUnit - Source unit (e.g., 'oz', 'cup', 'g')
 * @param toUnit - Target unit
 * @param density - Density in g/ml for cross-family conversions (default: 1.0)
 * @returns Converted value rounded to 2 decimal places
 * @throws ConversionError for unknown or invalid unit paths
 */
export function convertUnits(
  value: number,
  fromUnit: string,
  toUnit: string,
  density: number = 1.0
): number {
  const from = fromUnit.toLowerCase().trim();
  const to = toUnit.toLowerCase().trim();

  // Identity
  if (from === to) return roundTwo(value);

  const fromFamily = getUnitFamily(from);
  const toFamily = getUnitFamily(to);

  if (!fromFamily) {
    throw new ConversionError(`Unknown source unit: '${fromUnit}'`);
  }
  if (!toFamily) {
    throw new ConversionError(`Unknown target unit: '${toUnit}'`);
  }

  // Same family — direct scale
  if (fromFamily === toFamily) {
    if (fromFamily === "mass") {
      const grams = value * MASS_SCALES[from];
      return roundTwo(grams / MASS_SCALES[to]);
    }
    // volume
    const ml = value * VOLUME_SCALES[from];
    return roundTwo(ml / VOLUME_SCALES[to]);
  }

  // Cross-family: volume → mass
  if (fromFamily === "volume" && toFamily === "mass") {
    const ml = value * VOLUME_SCALES[from];
    const grams = ml * density;
    return roundTwo(grams / MASS_SCALES[to]);
  }

  // Cross-family: mass → volume
  if (fromFamily === "mass" && toFamily === "volume") {
    const grams = value * MASS_SCALES[from];
    const ml = grams / density;
    return roundTwo(ml / VOLUME_SCALES[to]);
  }

  throw new ConversionError(
    `Cannot convert from '${fromUnit}' (${fromFamily}) to '${toUnit}' (${toFamily})`
  );
}

/**
 * Calculate base quantity from user quantity and measure conversion factor.
 * Equivalent to: baseQty = quantity * conversionFactor
 */
export function calculateBaseQty(quantity: number, conversionFactor: number): number {
  return roundTwo(quantity * conversionFactor);
}

/**
 * Calculate macros from base quantity (in grams/ml) and per-100 values.
 */
export function calculateMacros(
  baseQty: number,
  caloriesPer100: number,
  proteinPer100: number,
  carbsPer100: number,
  fatPer100: number
): {
  calculated_calories: number;
  calculated_protein: number;
  calculated_carbs: number;
  calculated_fat: number;
} {
  const ratio = baseQty / 100;
  return {
    calculated_calories: roundTwo(ratio * caloriesPer100),
    calculated_protein: roundTwo(ratio * proteinPer100),
    calculated_carbs: roundTwo(ratio * carbsPer100),
    calculated_fat: roundTwo(ratio * fatPer100),
  };
}
