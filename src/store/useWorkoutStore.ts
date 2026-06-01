"use client";

import { create } from "zustand";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const STORAGE_KEY = "pulse_active_workout";

/**
 * Active workout session state store.
 *
 * Manages the full lifecycle of a gym session: start, set logging,
 * rest timer, and completion. Persists to localStorage for crash safety.
 */

export interface WorkoutSet {
  id: string;
  exerciseId: string;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  completed: boolean;
}

export interface WorkoutExercise {
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSet[];
}

export interface ActiveSession {
  sessionId: string;
  name: string;
  templateId: string | null;
  startedAt: number; // epoch ms
  exercises: WorkoutExercise[];
}

interface WorkoutState {
  activeSession: ActiveSession | null;
  isSessionActive: boolean;
  restTimerExpiration: number | null;
  restTimerDuration: number;

  startWorkout: (
    accessToken: string,
    templateId?: string,
    name?: string
  ) => Promise<void>;
  addExercise: (exerciseId: string, exerciseName: string) => void;
  logSet: (
    accessToken: string,
    exerciseId: string,
    setNumber: number,
    weightKg: number | null,
    reps: number | null,
    rpe: number | null
  ) => Promise<void>;
  updateSetField: (
    exerciseId: string,
    setNumber: number,
    field: "weightKg" | "reps" | "rpe",
    value: number | null
  ) => void;
  markSetCompleted: (
    accessToken: string,
    exerciseId: string,
    setNumber: number
  ) => Promise<void>;
  setRestTimer: (seconds: number) => void;
  addRestTime: (seconds: number) => void;
  clearRestTimer: () => void;
  completeWorkout: (accessToken: string) => Promise<void>;
  restoreFromStorage: () => void;
}

function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function persistSession(session: ActiveSession | null, restExp: number | null) {
  if (typeof window === "undefined") return;
  if (session) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ session, restTimerExpiration: restExp })
    );
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  activeSession: null,
  isSessionActive: false,
  restTimerExpiration: null,
  restTimerDuration: 90,

  startWorkout: async (accessToken, templateId, name) => {
    const sessionName = name || "Workout Session";
    const sessionId = generateId();
    const now = Date.now();

    const newSession: ActiveSession = {
      sessionId,
      name: sessionName,
      templateId: templateId || null,
      startedAt: now,
      exercises: [],
    };

    set({
      activeSession: newSession,
      isSessionActive: true,
      restTimerExpiration: null,
    });
    persistSession(newSession, null);

    // Fire API call in background
    try {
      const params = new URLSearchParams({ name: sessionName });
      if (templateId) params.set("template_id", templateId);

      const res = await fetch(
        `${BACKEND_URL}/api/v2/training/session/start?${params.toString()}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (res.ok) {
        const data = await res.json();
        const state = get();
        if (state.activeSession) {
          const updated = { ...state.activeSession, sessionId: data.id };
          set({ activeSession: updated });
          persistSession(updated, state.restTimerExpiration);
        }
      }
    } catch (err) {
      console.error("[WORKOUT] Start session API failed:", err);
    }
  },

  addExercise: (exerciseId, exerciseName) => {
    const state = get();
    if (!state.activeSession) return;

    const exists = state.activeSession.exercises.find(
      (e) => e.exerciseId === exerciseId
    );
    if (exists) return;

    const updated: ActiveSession = {
      ...state.activeSession,
      exercises: [
        ...state.activeSession.exercises,
        { exerciseId, exerciseName, sets: [] },
      ],
    };

    set({ activeSession: updated });
    persistSession(updated, state.restTimerExpiration);
  },

  updateSetField: (exerciseId, setNumber, field, value) => {
    const state = get();
    if (!state.activeSession) return;

    const updated: ActiveSession = {
      ...state.activeSession,
      exercises: state.activeSession.exercises.map((ex) => {
        if (ex.exerciseId !== exerciseId) return ex;

        let setExists = ex.sets.find((s) => s.setNumber === setNumber);
        if (!setExists) {
          setExists = {
            id: generateId(),
            exerciseId,
            setNumber,
            weightKg: null,
            reps: null,
            rpe: null,
            completed: false,
          };
          return {
            ...ex,
            sets: [...ex.sets, { ...setExists, [field]: value }],
          };
        }

        return {
          ...ex,
          sets: ex.sets.map((s) =>
            s.setNumber === setNumber ? { ...s, [field]: value } : s
          ),
        };
      }),
    };

    set({ activeSession: updated });
    persistSession(updated, state.restTimerExpiration);
  },

  logSet: async (accessToken, exerciseId, setNumber, weightKg, reps, rpe) => {
    const state = get();
    if (!state.activeSession) return;

    const setId = generateId();
    const newSet: WorkoutSet = {
      id: setId,
      exerciseId,
      setNumber,
      weightKg,
      reps,
      rpe,
      completed: false,
    };

    const updated: ActiveSession = {
      ...state.activeSession,
      exercises: state.activeSession.exercises.map((ex) => {
        if (ex.exerciseId !== exerciseId) return ex;
        const existing = ex.sets.find((s) => s.setNumber === setNumber);
        if (existing) {
          return {
            ...ex,
            sets: ex.sets.map((s) =>
              s.setNumber === setNumber
                ? { ...s, weightKg, reps, rpe }
                : s
            ),
          };
        }
        return { ...ex, sets: [...ex.sets, newSet] };
      }),
    };

    set({ activeSession: updated });
    persistSession(updated, state.restTimerExpiration);

    // Fire API
    try {
      await fetch(
        `${BACKEND_URL}/api/v2/training/set/log?session_id=${state.activeSession.sessionId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            exercise_id: exerciseId,
            set_number: setNumber,
            weight_kg: weightKg,
            reps,
            rpe,
            completed: false,
          }),
        }
      );
    } catch (err) {
      console.error("[WORKOUT] Log set API failed:", err);
    }
  },

  markSetCompleted: async (accessToken, exerciseId, setNumber) => {
    const state = get();
    if (!state.activeSession) return;

    const updated: ActiveSession = {
      ...state.activeSession,
      exercises: state.activeSession.exercises.map((ex) => {
        if (ex.exerciseId !== exerciseId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) =>
            s.setNumber === setNumber ? { ...s, completed: true } : s
          ),
        };
      }),
    };

    set({ activeSession: updated });
    persistSession(updated, state.restTimerExpiration);

    // Start rest timer
    const duration = state.restTimerDuration;
    const expiration = Date.now() + duration * 1000;
    set({ restTimerExpiration: expiration });
    persistSession(updated, expiration);

    // Fire API
    const exercise = updated.exercises.find((e) => e.exerciseId === exerciseId);
    const completedSet = exercise?.sets.find((s) => s.setNumber === setNumber);
    if (!completedSet) return;

    try {
      await fetch(
        `${BACKEND_URL}/api/v2/training/set/log?session_id=${state.activeSession.sessionId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            exercise_id: exerciseId,
            set_number: setNumber,
            weight_kg: completedSet.weightKg,
            reps: completedSet.reps,
            rpe: completedSet.rpe,
            completed: true,
          }),
        }
      );
    } catch (err) {
      console.error("[WORKOUT] Mark set completed API failed:", err);
    }
  },

  setRestTimer: (seconds) => {
    const expiration = Date.now() + seconds * 1000;
    set({ restTimerExpiration: expiration, restTimerDuration: seconds });
    const state = get();
    persistSession(state.activeSession, expiration);
  },

  addRestTime: (seconds) => {
    const state = get();
    if (!state.restTimerExpiration) return;
    const newExp = state.restTimerExpiration + seconds * 1000;
    set({ restTimerExpiration: newExp });
    persistSession(state.activeSession, newExp);
  },

  clearRestTimer: () => {
    set({ restTimerExpiration: null });
    const state = get();
    persistSession(state.activeSession, null);
  },

  completeWorkout: async (accessToken) => {
    const state = get();
    if (!state.activeSession) return;

    try {
      await fetch(
        `${BACKEND_URL}/api/v2/training/session/${state.activeSession.sessionId}/complete`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
    } catch (err) {
      console.error("[WORKOUT] Complete session API failed:", err);
    }

    set({
      activeSession: null,
      isSessionActive: false,
      restTimerExpiration: null,
    });
    persistSession(null, null);
  },

  restoreFromStorage: () => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (parsed.session) {
        set({
          activeSession: parsed.session,
          isSessionActive: true,
          restTimerExpiration: parsed.restTimerExpiration || null,
        });
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  },
}));
