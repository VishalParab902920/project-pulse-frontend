"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Minus, Trash2, Search, Loader2, Check, Dumbbell } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useDateStore } from "@/store/useDateStore";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface SetRow {
  set_number: number;
  weight_kg: string;
  reps: string;
  rpe: string;
}

interface ExerciseEntry {
  exercise_id: string;
  exercise_name: string;
  sets: SetRow[];
}

interface QuickWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWorkoutLogged: () => void;
}

export default function QuickWorkoutModal({ isOpen, onClose, onWorkoutLogged }: QuickWorkoutModalProps) {
  const storeToken = useUserStore((s) => s.accessToken);
  const accessToken = storeToken || getAccessToken();
  const { selectedDate } = useDateStore();

  const [sessionName, setSessionName] = useState("Workout");
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; category: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) { setExercises([]); setSessionName("Workout"); }
  }, [isOpen]);

  // Exercise search
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await apiFetch(`/api/v2/training/exercises/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) setSearchResults(await res.json());
      } catch {} finally { setIsSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, accessToken]);

  const addExercise = useCallback((id: string, name: string) => {
    setExercises((prev) => [...prev, { exercise_id: id, exercise_name: name, sets: [{ set_number: 1, weight_kg: "", reps: "", rpe: "" }] }]);
    setShowSearch(false);
    setSearchQuery("");
  }, []);

  const addSet = useCallback((exIdx: number) => {
    setExercises((prev) => prev.map((ex, i) => i === exIdx ? { ...ex, sets: [...ex.sets, { set_number: ex.sets.length + 1, weight_kg: "", reps: "", rpe: "" }] } : ex));
  }, []);

  const removeSet = useCallback((exIdx: number, setIdx: number) => {
    setExercises((prev) => prev.map((ex, i) => i === exIdx ? { ...ex, sets: ex.sets.filter((_, si) => si !== setIdx).map((s, si) => ({ ...s, set_number: si + 1 })) } : ex));
  }, []);

  const removeExercise = useCallback((exIdx: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== exIdx));
  }, []);

  const updateSet = useCallback((exIdx: number, setIdx: number, field: "weight_kg" | "reps" | "rpe", value: string) => {
    setExercises((prev) => prev.map((ex, i) => i === exIdx ? { ...ex, sets: ex.sets.map((s, si) => si === setIdx ? { ...s, [field]: value } : s) } : ex));
  }, []);

  const handleSave = useCallback(async () => {
    if (!exercises.length || !accessToken) return;
    setIsSaving(true);
    try {
      const payload = {
        name: sessionName.trim() || "Workout",
        logged_at: new Date(`${selectedDate}T12:00:00`).toISOString(),
        exercises: exercises.map((ex) => ({
          exercise_id: ex.exercise_id,
          sets: ex.sets.filter(s => s.weight_kg || s.reps).map((s) => ({
            set_number: s.set_number,
            weight_kg: s.weight_kg ? parseFloat(s.weight_kg) : null,
            reps: s.reps ? parseInt(s.reps) : null,
            rpe: s.rpe ? parseFloat(s.rpe) : null,
          })),
        })).filter(ex => ex.sets.length > 0),
      };

      const res = await apiFetch(`/api/v2/training/session/quick-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) { onWorkoutLogged(); onClose(); }
    } catch {} finally { setIsSaving(false); }
  }, [exercises, sessionName, selectedDate, accessToken, onWorkoutLogged, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }} onClick={(e) => e.stopPropagation()} className="absolute bottom-0 left-0 right-0 max-h-[90dvh] rounded-t-3xl bg-surface-solid border-t border-white/10 overflow-hidden flex flex-col">
          <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-white/20" /></div>
          <div className="flex items-center justify-between px-5 pb-3">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-accent-purple" />
              <h2 className="text-base font-semibold text-white">Quick Log Workout</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400"><X className="h-4 w-4" /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4 transform-gpu">
            {/* Session Name */}
            <input type="text" value={sessionName} onChange={(e) => setSessionName(e.target.value)} placeholder="Session name (e.g., Leg Day)" className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-purple" />

            {/* Exercise Cards */}
            {exercises.map((ex, exIdx) => (
              <div key={`${ex.exercise_id}-${exIdx}`} className="glass-card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-white">{ex.exercise_name}</p>
                  <button onClick={() => removeExercise(exIdx)} className="p-1 text-gray-600 hover:text-status-rose"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                {/* Set Header */}
                <div className="grid grid-cols-[30px_1fr_1fr_60px_30px] gap-1.5 text-[8px] text-gray-600 uppercase px-1">
                  <span>Set</span><span>Kg</span><span>Reps</span><span>RPE</span><span></span>
                </div>
                {/* Set Rows */}
                {ex.sets.map((s, setIdx) => (
                  <div key={setIdx} className="grid grid-cols-[30px_1fr_1fr_60px_30px] gap-1.5 items-center">
                    <span className="text-[10px] text-gray-500 text-center">{s.set_number}</span>
                    <input type="number" value={s.weight_kg} onChange={(e) => updateSet(exIdx, setIdx, "weight_kg", e.target.value)} placeholder="—" className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white text-center outline-none focus:border-accent-purple [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    <input type="number" value={s.reps} onChange={(e) => updateSet(exIdx, setIdx, "reps", e.target.value)} placeholder="—" className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white text-center outline-none focus:border-accent-purple [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    <input type="number" value={s.rpe} onChange={(e) => updateSet(exIdx, setIdx, "rpe", e.target.value)} placeholder="—" className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white text-center outline-none focus:border-accent-purple [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    <button onClick={() => removeSet(exIdx, setIdx)} className="p-0.5 text-gray-700 hover:text-status-rose"><Minus className="h-3 w-3" /></button>
                  </div>
                ))}
                <button onClick={() => addSet(exIdx)} className="w-full flex items-center justify-center gap-1 rounded-lg bg-white/[0.03] border border-white/5 py-1.5 text-[9px] text-gray-500 hover:text-white transition-colors">
                  <Plus className="h-2.5 w-2.5" />Add Set
                </button>
              </div>
            ))}

            {/* Add Exercise */}
            <button onClick={() => setShowSearch(true)} className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 border-dashed py-3 text-xs font-medium text-gray-400 hover:text-white hover:border-white/20 transition-colors">
              <Plus className="h-4 w-4" />Add Exercise
            </button>

            {/* Save */}
            <button onClick={handleSave} disabled={isSaving || exercises.length === 0} className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-indigo via-accent-purple to-accent-cyan py-3.5 text-sm font-semibold text-white disabled:opacity-50 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" />Save Completed Workout</>}
            </button>
          </div>
        </motion.div>
      </motion.div>

      {/* Exercise Search Sub-Modal */}
      {showSearch && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end" onClick={() => setShowSearch(false)}>
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", damping: 30, stiffness: 300 }} onClick={(e) => e.stopPropagation()} className="w-full max-h-[50dvh] rounded-t-3xl bg-surface-solid border-t border-white/10 p-5 flex flex-col">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search exercises..." autoFocus className="w-full rounded-xl bg-white/5 border border-white/10 pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-purple" />
              {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-accent-purple animate-spin" />}
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 transform-gpu">
              {searchResults.map((ex) => (
                <button key={ex.id} onClick={() => addExercise(ex.id, ex.name)} className="w-full flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/[0.04] px-3 py-2.5 text-left hover:bg-white/[0.05] transition-colors">
                  <div><p className="text-xs font-medium text-white">{ex.name}</p><p className="text-[10px] text-gray-500">{ex.category}</p></div>
                  <Plus className="h-4 w-4 text-gray-500" />
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
