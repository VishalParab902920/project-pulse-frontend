"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Dumbbell,
  Clock,
  CheckCircle2,
  Plus,
  Loader2,
  Trophy,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useUserStore } from "@/store/useUserStore";
import { getAccessToken } from "@/lib/auth";
import FloatingRestTimer from "@/components/FloatingRestTimer";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

/**
 * Active Workout Page — Full-screen gym session controller.
 *
 * Features:
 * - Elapsed session chronometer
 * - Exercise cards with progressive overload reference
 * - Set input rows (weight, reps, RPE) with completion checkbox
 * - Floating rest timer triggered on set completion
 * - Session completion with total volume calculation
 */

interface PreviousSet {
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
}

interface PreviousData {
  [exerciseId: string]: PreviousSet[];
}

function formatElapsed(startedAt: number): string {
  const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function WorkoutPage() {
  const router = useRouter();
  const storeToken = useUserStore((s) => s.accessToken);
  const accessToken = storeToken || getAccessToken();
  const {
    activeSession,
    isSessionActive,
    startWorkout,
    addExercise,
    updateSetField,
    markSetCompleted,
    completeWorkout,
    restoreFromStorage,
  } = useWorkoutStore();

  const [elapsed, setElapsed] = useState("0:00");
  const [previousData, setPreviousData] = useState<PreviousData>({});
  const [isCompleting, setIsCompleting] = useState(false);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseResults, setExerciseResults] = useState<
    { id: string; name: string; category: string }[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    restoreFromStorage();
  }, [restoreFromStorage]);

  // Elapsed time chronometer
  useEffect(() => {
    if (!activeSession) return;

    const update = () => setElapsed(formatElapsed(activeSession.startedAt));
    update();
    timerRef.current = setInterval(update, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeSession]);

  // Fetch previous sets for each exercise
  useEffect(() => {
    if (!activeSession || !accessToken) return;

    activeSession.exercises.forEach(async (ex) => {
      if (previousData[ex.exerciseId]) return;

      try {
        const res = await fetch(
          `${BACKEND_URL}/api/v2/training/exercise/${ex.exerciseId}/previous`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (res.ok) {
          const data: PreviousSet[] = await res.json();
          setPreviousData((prev) => ({ ...prev, [ex.exerciseId]: data }));
        }
      } catch {
        // Silently fail — previous data is optional
      }
    });
  }, [activeSession, accessToken, previousData]);

  // Start a new workout
  const handleStart = useCallback(async () => {
    if (!accessToken) return;
    await startWorkout(accessToken, undefined, "Workout Session");
  }, [accessToken, startWorkout]);

  // Complete the workout
  const handleComplete = useCallback(async () => {
    if (!accessToken) return;
    setIsCompleting(true);
    await completeWorkout(accessToken);
    setIsCompleting(false);
    router.push("/app");
  }, [accessToken, completeWorkout, router]);

  // Search exercises
  useEffect(() => {
    if (exerciseSearch.length < 2) {
      setExerciseResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `${BACKEND_URL}/api/v2/training/exercises/search?q=${encodeURIComponent(exerciseSearch)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setExerciseResults(data);
        }
      } catch {
        // Silently fail
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [exerciseSearch, accessToken]);

  const handleAddExercise = useCallback(
    (exerciseId: string, exerciseName: string) => {
      addExercise(exerciseId, exerciseName);
      setShowAddExercise(false);
      setExerciseSearch("");
    },
    [addExercise]
  );

  const handleMarkCompleted = useCallback(
    async (exerciseId: string, setNumber: number) => {
      if (!accessToken) return;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(10);
      }
      await markSetCompleted(accessToken, exerciseId, setNumber);
    },
    [accessToken, markSetCompleted]
  );

  // No active session — show start screen
  if (!isSessionActive || !activeSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60dvh] p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-indigo via-accent-purple to-accent-cyan shadow-[0_0_20px_rgba(168,85,247,0.4)]">
            <Dumbbell className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Ready to Train?</h1>
            <p className="text-sm text-gray-500 mt-1">
              Start a new workout session to begin tracking
            </p>
          </div>
          <button
            onClick={handleStart}
            className="flex items-center gap-2 mx-auto rounded-xl bg-gradient-to-r from-accent-indigo via-accent-purple to-accent-cyan px-8 py-3.5 text-sm font-semibold text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:opacity-90 transition-opacity active:scale-95"
          >
            <Dumbbell className="h-4 w-4" />
            Start Workout
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-32 transform-gpu">
      {/* Session Header */}
      <div className="glass-card p-4 mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-white">
            {activeSession.name}
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Clock className="h-3 w-3 text-gray-500" />
            <span className="text-xs text-gray-400 tabular-nums">{elapsed}</span>
          </div>
        </div>
        <button
          onClick={handleComplete}
          disabled={isCompleting}
          className="flex items-center gap-1.5 rounded-xl bg-status-success/20 border border-status-success/30 px-4 py-2 text-xs font-medium text-status-success hover:bg-status-success/30 transition-colors disabled:opacity-50"
        >
          {isCompleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trophy className="h-3.5 w-3.5" />
          )}
          Complete
        </button>
      </div>

      {/* Exercise Cards */}
      <div className="space-y-4">
        {activeSession.exercises.map((exercise) => {
          const prevSets = previousData[exercise.exerciseId] || [];
          const prevSummary = prevSets.length > 0
            ? prevSets
                .map((s) => `${s.weight_kg || 0}kg×${s.reps || 0}`)
                .join(", ")
            : null;

          // Determine how many set rows to show (existing + 1 empty)
          const maxSetNum = exercise.sets.length > 0
            ? Math.max(...exercise.sets.map((s) => s.setNumber))
            : 0;
          const setRows = Array.from(
            { length: Math.max(maxSetNum + 1, 3) },
            (_, i) => i + 1
          );

          return (
            <div key={exercise.exerciseId} className="glass-card p-4">
              {/* Exercise Header */}
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-white">
                  {exercise.exerciseName}
                </h3>
                {prevSummary && (
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Prev: {prevSummary}
                  </p>
                )}
              </div>

              {/* Set Table Header */}
              <div className="grid grid-cols-[40px_1fr_1fr_60px_40px] gap-2 mb-2 px-1">
                <span className="text-[9px] text-gray-600 uppercase">Set</span>
                <span className="text-[9px] text-gray-600 uppercase">Kg</span>
                <span className="text-[9px] text-gray-600 uppercase">Reps</span>
                <span className="text-[9px] text-gray-600 uppercase">RPE</span>
                <span className="text-[9px] text-gray-600 uppercase text-center">✓</span>
              </div>

              {/* Set Rows */}
              <div className="space-y-1.5">
                {setRows.map((setNum) => {
                  const existingSet = exercise.sets.find(
                    (s) => s.setNumber === setNum
                  );
                  const isCompleted = existingSet?.completed || false;
                  const prevSet = prevSets.find((p) => p.set_number === setNum);

                  return (
                    <div
                      key={setNum}
                      className={`grid grid-cols-[40px_1fr_1fr_60px_40px] gap-2 items-center rounded-lg px-1 py-1.5 transition-colors ${
                        isCompleted
                          ? "bg-accent-purple/10 border border-accent-purple/20"
                          : "bg-white/[0.02]"
                      }`}
                    >
                      <span className="text-xs text-gray-500 text-center font-medium">
                        {setNum}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder={prevSet?.weight_kg?.toString() || "—"}
                        value={existingSet?.weightKg ?? ""}
                        onChange={(e) =>
                          updateSetField(
                            exercise.exerciseId,
                            setNum,
                            "weightKg",
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                        disabled={isCompleted}
                        className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white text-center outline-none focus:border-accent-purple disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder={prevSet?.reps?.toString() || "—"}
                        value={existingSet?.reps ?? ""}
                        onChange={(e) =>
                          updateSetField(
                            exercise.exerciseId,
                            setNum,
                            "reps",
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                        disabled={isCompleted}
                        className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white text-center outline-none focus:border-accent-purple disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="—"
                        value={existingSet?.rpe ?? ""}
                        onChange={(e) =>
                          updateSetField(
                            exercise.exerciseId,
                            setNum,
                            "rpe",
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                        disabled={isCompleted}
                        className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white text-center outline-none focus:border-accent-purple disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <div className="flex justify-center">
                        <button
                          onClick={() =>
                            handleMarkCompleted(exercise.exerciseId, setNum)
                          }
                          disabled={
                            isCompleted ||
                            !existingSet?.weightKg ||
                            !existingSet?.reps
                          }
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                            isCompleted
                              ? "bg-accent-purple/30 text-accent-purple"
                              : "bg-white/5 border border-white/10 text-gray-600 hover:text-white hover:border-accent-purple disabled:opacity-30"
                          }`}
                          aria-label={`Mark set ${setNum} complete`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Exercise Button */}
      <button
        onClick={() => setShowAddExercise(true)}
        className="w-full mt-4 flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 border-dashed py-3.5 text-xs font-medium text-gray-400 hover:text-white hover:border-white/20 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Add Exercise
      </button>

      {/* Add Exercise Modal */}
      {showAddExercise && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end"
          onClick={() => setShowAddExercise(false)}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-h-[60dvh] rounded-t-3xl bg-surface-solid border-t border-white/10 p-5 overflow-hidden flex flex-col"
          >
            <div className="flex justify-center mb-3">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-3">
              Add Exercise
            </h3>
            <input
              type="text"
              value={exerciseSearch}
              onChange={(e) => setExerciseSearch(e.target.value)}
              placeholder="Search exercises..."
              autoFocus
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-purple mb-3"
            />
            <div className="flex-1 overflow-y-auto space-y-1.5 transform-gpu">
              {isSearching && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 text-accent-purple animate-spin" />
                </div>
              )}
              {exerciseResults.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => handleAddExercise(ex.id, ex.name)}
                  className="w-full flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/[0.04] px-3 py-2.5 text-left hover:bg-white/[0.05] transition-colors"
                >
                  <div>
                    <p className="text-xs font-medium text-white">{ex.name}</p>
                    <p className="text-[10px] text-gray-500">{ex.category}</p>
                  </div>
                  <Plus className="h-4 w-4 text-gray-500" />
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Floating Rest Timer */}
      <FloatingRestTimer />
    </div>
  );
}
