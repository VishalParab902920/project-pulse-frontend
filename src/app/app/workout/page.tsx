"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dumbbell,
  Clock,
  CheckCircle2,
  Plus,
  Loader2,
  Trophy,
  Footprints,
  Flame,
  Play,
  ClipboardList,
  ChevronRight,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useUserStore } from "@/store/useUserStore";
import { getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useSWR } from "@/hooks/useSWR";
import { useDateStore } from "@/store/useDateStore";
import FloatingRestTimer from "@/components/FloatingRestTimer";
import QuickWorkoutModal from "@/components/QuickWorkoutModal";
import RoutinesModal from "@/components/RoutinesModal";

/**
 * Workout Workspace — Full workout hub.
 *
 * When NO session is active:
 * - Header panels: Steps + Calorie Burn
 * - My Routines: horizontal swiping deck of templates
 * - Quick Actions: Start Active Session + Log Past Workout
 * - Today's Physical Activity Ledger
 *
 * When a session IS active:
 * - Full active workout tracker (exercise cards, set inputs, rest timer)
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

interface HealthSummary {
  total_daily_steps: number | null;
  active_calories_burned: number | null;
}

interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: { exercise_name: string }[];
}

interface WorkoutSession {
  id: string;
  name: string | null;
  started_at: string;
  completed_at: string | null;
  total_volume_kg: number | null;
  sets: Array<{ id: string; exercise: { name: string } | null; weight_kg: number | null; reps: number | null }>;
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
  const { selectedDate } = useDateStore();
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
        const res = await apiFetch(
          `/api/v2/training/exercise/${ex.exerciseId}/previous`
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
  }, [accessToken, completeWorkout]);

  // Search exercises
  useEffect(() => {
    if (exerciseSearch.length < 2) {
      setExerciseResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await apiFetch(
          `/api/v2/training/exercises/search?q=${encodeURIComponent(exerciseSearch)}`
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

  // =========================================================
  // NO ACTIVE SESSION — Show Workout Workspace Landing
  // =========================================================
  if (!isSessionActive || !activeSession) {
    return <WorkoutLanding onStart={handleStart} />;
  }

  // =========================================================
  // ACTIVE SESSION — Full Workout Tracker
  // =========================================================
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

// =============================================================
// Workout Landing — Shown when no session is active
// =============================================================

function WorkoutLanding({
  onStart,
}: {
  onStart: () => void;
}) {
  const router = useRouter();
  const { selectedDate } = useDateStore();

  // Fetch health data for header panels
  const { data: healthData } = useSWR<{ total_daily_steps: number | null; active_calories_burned: number | null }>(
    `/api/v2/telemetry/summary/${selectedDate}`,
    undefined,
    60000
  );

  // Fetch workout templates
  const { data: templates } = useSWR<WorkoutTemplate[]>(
    "/api/v2/training/templates"
  );

  // Fetch workout sessions for today's ledger
  const { data: sessionsData, mutate: mutateSessions } = useSWR<WorkoutSession[]>(
    `/api/v2/training/sessions`,
    selectedDate
  );

  // Filter sessions to only those matching selectedDate
  const todaySessions = (sessionsData || []).filter((session) => {
    const sessionDate = session.started_at.split("T")[0];
    return sessionDate === selectedDate;
  });

  const totalSteps = healthData?.total_daily_steps || 0;
  const caloriesBurned = healthData?.active_calories_burned || 0;

  const [quickWorkoutOpen, setQuickWorkoutOpen] = useState(false);
  const [routinesModalOpen, setRoutinesModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<WorkoutSession | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  const handleManageTemplates = () => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(10);
    }
    setRoutinesModalOpen(true);
  };

  const handleDeleteSession = async (sessionId: string) => {
    setIsDeletingSession(true);
    try {
      const res = await apiFetch(`/api/v2/training/sessions/${sessionId}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setSelectedSession(null);
        mutateSessions();
      }
    } catch {} finally {
      setIsDeletingSession(false);
    }
  };

  return (
    <>
    <div className="p-4 pb-24 transform-gpu">
      {/* Header Panels: Steps + Calorie Burn */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-card p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Footprints className="h-3.5 w-3.5 text-accent-cyan" />
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Steps</span>
          </div>
          <p className="text-xl font-bold text-white">{totalSteps.toLocaleString()}</p>
          <p className="text-[9px] text-gray-500 mt-0.5">today</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Flame className="h-3.5 w-3.5 text-status-rose" />
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Burned</span>
          </div>
          <p className="text-xl font-bold text-white">{caloriesBurned}</p>
          <p className="text-[9px] text-gray-500 mt-0.5">kcal active</p>
        </motion.div>
      </div>

      {/* My Routines — Horizontal Swiping Deck */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-4"
      >
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-semibold text-white">My Routines</h2>
          <button
            onClick={handleManageTemplates}
            className="flex items-center gap-1 rounded-lg bg-accent-purple/10 border border-accent-purple/20 px-3 py-1.5 text-[10px] font-medium text-accent-purple hover:bg-accent-purple/20 transition-colors"
          >
            <ClipboardList className="h-3 w-3" />
            Manage
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
          {(templates || []).length > 0 ? (
            (templates || []).map((template) => (
              <div
                key={template.id}
                className="glass-card p-4 min-w-[200px] max-w-[200px] snap-start flex-shrink-0"
              >
                <h3 className="text-xs font-semibold text-white mb-1.5 truncate">
                  {template.name}
                </h3>
                <p className="text-[10px] text-gray-500 mb-3">
                  {template.exercises?.length || 0} exercises
                </p>
                <div className="space-y-1 mb-3">
                  {(template.exercises || []).slice(0, 3).map((ex, i) => (
                    <p key={i} className="text-[9px] text-gray-400 truncate">
                      • {ex.exercise_name}
                    </p>
                  ))}
                  {(template.exercises || []).length > 3 && (
                    <p className="text-[9px] text-gray-600">
                      +{template.exercises.length - 3} more
                    </p>
                  )}
                </div>
                <button className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-accent-purple/10 border border-accent-purple/20 py-2 text-[10px] font-medium text-accent-purple hover:bg-accent-purple/20 transition-colors">
                  <Play className="h-3 w-3" />
                  Start
                </button>
              </div>
            ))
          ) : (
            <div className="glass-card p-4 min-w-[200px] flex flex-col items-center justify-center text-center">
              <ClipboardList className="h-6 w-6 text-gray-700 mb-2" />
              <p className="text-[10px] text-gray-500">No routines yet</p>
              <p className="text-[9px] text-gray-600 mt-0.5">Create templates to quick-start workouts</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3 mb-6"
      >
        <button
          onClick={onStart}
          className="w-full flex items-center justify-between rounded-xl bg-gradient-to-r from-accent-indigo via-accent-purple to-accent-cyan px-5 py-4 text-sm font-semibold text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-3">
            <Dumbbell className="h-5 w-5" />
            <span>Start Active Session</span>
          </div>
          <ChevronRight className="h-4 w-4 opacity-60" />
        </button>

        <button
          onClick={() => setQuickWorkoutOpen(true)}
          className="w-full flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-5 py-4 text-sm font-medium text-gray-300 hover:text-white hover:border-white/20 transition-colors active:scale-[0.98]"
        >
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-gray-500" />
            <span>Quick Log Workout</span>
          </div>
          <ChevronRight className="h-4 w-4 opacity-40" />
        </button>
      </motion.div>

      {/* Today's Physical Activity Ledger */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <div className="flex items-center gap-2 mb-3 px-1">
          <Trophy className="h-3.5 w-3.5 text-accent-cyan" />
          <h2 className="text-sm font-semibold text-white">Today&apos;s Physical Activity Ledger</h2>
        </div>

        {todaySessions.length === 0 ? (
          <div className="rounded-2xl bg-white/[0.03] backdrop-blur-md border border-white/5 p-6 text-center">
            <Dumbbell className="h-8 w-8 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-400 mb-1">No training sessions completed today.</p>
            <p className="text-[10px] text-gray-600 mb-4">
              Build consistency by starting a routine.
            </p>
            <button
              onClick={() => setQuickWorkoutOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-accent-purple/30 px-4 py-2 text-xs font-medium text-accent-purple hover:bg-accent-purple/10 transition-colors shadow-[0_0_8px_rgba(168,85,247,0.15)]"
            >
              <Plus className="h-3.5 w-3.5" />
              Quick Log Workout
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {todaySessions.map((session) => {
              // Calculate duration
              let durationStr = "In progress";
              if (session.completed_at) {
                const startMs = new Date(session.started_at).getTime();
                const endMs = new Date(session.completed_at).getTime();
                const diffMin = Math.round((endMs - startMs) / 60000);
                if (diffMin >= 60) {
                  const hrs = Math.floor(diffMin / 60);
                  const mins = diffMin % 60;
                  durationStr = `${hrs}h ${mins}m`;
                } else {
                  durationStr = `${diffMin}m`;
                }
              }

              // Group sets by exercise name
              const exerciseGroups: Record<string, { count: number; weights: string[] }> = {};
              for (const set of session.sets) {
                const name = set.exercise?.name || "Unknown Exercise";
                if (!exerciseGroups[name]) {
                  exerciseGroups[name] = { count: 0, weights: [] };
                }
                exerciseGroups[name].count += 1;
                if (set.weight_kg !== null && set.reps !== null) {
                  exerciseGroups[name].weights.push(`${set.weight_kg}kg×${set.reps}`);
                }
              }

              return (
                <button
                  key={session.id}
                  onClick={() => setSelectedSession(session)}
                  className="w-full text-left rounded-2xl bg-white/[0.03] backdrop-blur-md border border-white/5 p-4 hover:bg-white/[0.05] hover:border-white/10 transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-white">
                      {session.name || "Workout Session"}
                    </h3>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-gray-500" />
                        <span className="text-[10px] text-gray-400">{durationStr}</span>
                      </div>
                      {session.total_volume_kg !== null && (
                        <span className="text-[10px] text-accent-cyan font-medium">
                          {session.total_volume_kg.toLocaleString()} kg
                        </span>
                      )}
                    </div>
                  </div>

                  {Object.keys(exerciseGroups).length > 0 && (
                    <div className="space-y-1 mt-2 pt-2 border-t border-white/5">
                      {Object.entries(exerciseGroups).map(([name, group]) => (
                        <div key={name} className="flex items-center justify-between">
                          <p className="text-[10px] text-gray-400 truncate max-w-[60%]">{name}</p>
                          <p className="text-[10px] text-gray-500">
                            {group.count} set{group.count !== 1 ? "s" : ""}
                            {group.weights.length > 0 && (
                              <span className="text-gray-600 ml-1.5">
                                ({group.weights[group.weights.length - 1]})
                              </span>
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Quick Workout Modal */}
      <QuickWorkoutModal
        isOpen={quickWorkoutOpen}
        onClose={() => setQuickWorkoutOpen(false)}
        onWorkoutLogged={() => setQuickWorkoutOpen(false)}
      />
    </div>

    {/* Routines Modal — rendered outside transform-gpu container */}
    <RoutinesModal
      isOpen={routinesModalOpen}
      onClose={() => setRoutinesModalOpen(false)}
    />

    {/* Session Detail Modal */}
    <AnimatePresence>
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onDelete={handleDeleteSession}
          isDeleting={isDeletingSession}
          onSaved={() => { setSelectedSession(null); mutateSessions(); }}
        />
      )}
    </AnimatePresence>
    </>
  );
}

// =============================================================
// Session Detail Modal — View, Edit, Delete a completed workout
// =============================================================

function SessionDetailModal({
  session,
  onClose,
  onDelete,
  isDeleting,
  onSaved,
}: {
  session: WorkoutSession;
  onClose: () => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  onSaved: () => void;
}) {
  const [editedSets, setEditedSets] = useState<Record<string, { weight_kg: number | null; reps: number | null }>>(
    () => {
      const map: Record<string, { weight_kg: number | null; reps: number | null }> = {};
      for (const s of session.sets) {
        map[s.id] = { weight_kg: s.weight_kg, reps: s.reps };
      }
      return map;
    }
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleSetChange = (setId: string, field: "weight_kg" | "reps", value: number | null) => {
    setEditedSets(prev => ({ ...prev, [setId]: { ...prev[setId], [field]: value } }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const setsPayload = Object.entries(editedSets).map(([id, vals]) => ({
        id,
        weight_kg: vals.weight_kg,
        reps: vals.reps,
      }));
      const res = await apiFetch(`/api/v2/training/sessions/${session.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sets: setsPayload }),
      });
      if (res.ok) { onSaved(); }
    } catch {} finally { setIsSaving(false); }
  };

  // Group sets by exercise
  const exerciseGroups: Record<string, Array<{ id: string; weight_kg: number | null; reps: number | null }>> = {};
  for (const s of session.sets) {
    const name = s.exercise?.name || "Unknown";
    if (!exerciseGroups[name]) exerciseGroups[name] = [];
    exerciseGroups[name].push({ id: s.id, weight_kg: editedSets[s.id]?.weight_kg ?? s.weight_kg, reps: editedSets[s.id]?.reps ?? s.reps });
  }

  // Duration
  let durationStr = "";
  if (session.completed_at) {
    const diffMin = Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 60000);
    durationStr = diffMin >= 60 ? `${Math.floor(diffMin / 60)}h ${diffMin % 60}m` : `${diffMin}m`;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[80dvh] rounded-t-3xl bg-[#0a0a0c]/98 border-t border-white/10 backdrop-blur-xl overflow-hidden flex flex-col pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-white/20" /></div>
        <div className="flex items-center justify-between px-5 pb-3">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-accent-purple" />
            <h3 className="text-sm font-semibold text-white truncate">{session.name || "Workout"}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
          {/* Session info */}
          <div className="flex items-center gap-4 text-[10px] text-gray-500">
            {durationStr && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{durationStr}</span>
              </div>
            )}
            {session.total_volume_kg !== null && (
              <span className="text-accent-cyan font-medium">{session.total_volume_kg.toLocaleString()} kg</span>
            )}
          </div>

          {/* Editable exercises */}
          <div className="space-y-2">
            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Exercises (tap to edit)</p>
            {Object.entries(exerciseGroups).map(([name, sets]) => (
              <div key={name} className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
                <p className="text-xs font-medium text-white mb-2">{name}</p>
                <div className="space-y-1.5">
                  {sets.map((s, i) => (
                    <div key={s.id} className="grid grid-cols-[30px_1fr_1fr] gap-2 items-center">
                      <span className="text-[9px] text-gray-600 text-center">{i + 1}</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={s.weight_kg ?? ""}
                        onChange={(e) => handleSetChange(s.id, "weight_kg", e.target.value ? Number(e.target.value) : null)}
                        placeholder="kg"
                        className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white text-center outline-none focus:border-accent-purple [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        value={s.reps ?? ""}
                        onChange={(e) => handleSetChange(s.id, "reps", e.target.value ? Number(e.target.value) : null)}
                        placeholder="reps"
                        className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white text-center outline-none focus:border-accent-purple [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Save Changes */}
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-indigo via-accent-purple to-accent-cyan py-3 text-xs font-semibold text-white disabled:opacity-50 shadow-[0_0_10px_rgba(168,85,247,0.3)] active:scale-[0.98]"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Save Changes
            </button>
          )}

          {/* Delete */}
          <button
            onClick={() => onDelete(session.id)}
            disabled={isDeleting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-status-rose/5 border border-status-rose/20 py-3 text-xs font-medium text-status-rose hover:bg-status-rose/10 transition-colors disabled:opacity-50 active:scale-[0.98]"
          >
            {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete Workout
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
