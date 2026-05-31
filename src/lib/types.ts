/** Timeline item types for the home stream */

export interface Macros {
  p: number;
  c: number;
  f: number;
  kcal: number;
}

export interface FoodItem {
  name: string;
  canonical_weight: number;
  canonical_unit: string;
  original_weight: number;
  original_unit: string;
  macros: Macros;
  is_estimated: boolean;
}

export interface FoodData {
  meal_context: string;
  items: FoodItem[];
  total_macros_calculated: Macros;
}

export interface WorkoutSet {
  index: number;
  reps: number;
  canonical_weight: number;
  canonical_unit: string;
  original_weight: number;
  original_unit: string;
  rpe: number | null;
}

export interface WorkoutData {
  exercise_name: string;
  muscle_group: string;
  sets: WorkoutSet[];
  total_volume: number;
}

export interface BiometricData {
  metric_type: string;
  canonical_value: number;
  canonical_unit: string;
  original_value: number;
  original_unit: string;
}

export interface NoteData {
  content: string;
  tags: string[];
}

export type ParsedData = FoodData | WorkoutData | BiometricData | NoteData;

export interface ParseResponse {
  id: string;
  user_id: string;
  type: "food" | "workout" | "biometric" | "note";
  status: string;
  raw_input: string | null;
  media_path?: string | null;
  parsed_data: ParsedData;
  confidence_score: number | null;
  short_persona_response: string;
  created_at?: string | null;
  occurred_at?: string | null;
}

export type TimelineItem =
  | { kind: "user_message"; text: string; timestamp: string }
  | { kind: "user_message_offline"; text: string; timestamp: string; offlineId?: number }
  | { kind: "assistant_message"; text: string; timestamp: string }
  | { kind: "parsed_card"; data: ParseResponse; timestamp: string }
  | { kind: "loading"; timestamp: string };
