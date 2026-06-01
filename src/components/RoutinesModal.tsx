"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Plus,
  Minus,
  Trash2,
  Loader2,
  Check,
  Search,
  ClipboardList,
  Play,
  Pencil,
  Dumbbell,
} from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useUIStore } from "@/store/useUIStore";

/**
 * RoutinesModal — Full-screen slide-up modal for managing workout routines.
 * Consistent with NutritionHubModal / RecipeModal UX pattern.
 *
 * Views:
 * 1. Routine List (default) — search, create, log, edit
 * 2. Routine Builder (sub-modal) — create/edit with exercises
 * 3. Quick Log (sub-modal) — log a routine as a past workout
 */

interface TemplateExercise {
  exercise_id: string;
  exercise_name?: string;
  target_sets: number;
  target_reps?: number;
  target_weight_kg?: number;
  default_rest_seconds: number;
}

interface Template {
  id: string;
  name: string;
  description: string;
  exercises: TemplateExercise[];
  created_at: string;
}

interface ExerciseSearchResult {
  id: string;
  name: string;
  category: string;
}

interface RoutinesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RoutinesModal({ isOpen, onClose }: RoutinesModalProps) {
  const storeToken = useUserStore((s) => s.accessToken);
  const accessToken = storeToken || getAccessToken();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Builder state
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [exercises, setExercises] = useState<TemplateExercise[]>([]);
  const [showExerciseSearch, setShowExerciseSearch] = useState(false);
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [exerciseResults, setExerciseResults] = useState<ExerciseSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Quick log
  const [isLoggingRoutine, setIsLoggingRoutine] = useState<string | null>(null);

  // Direct log a routine — posts it immediately as a completed session
  const handleLogRoutine = useCallback(async (template: Template) => {
    if (!accessToken) return;
    setIsLoggingRoutine(template.id);

    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await apiFetch(`/api/v2/training/session/quick-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name,
          logged_at: `${today}T12:00:00`,
          exercises: template.exercises.map(ex => ({
            exercise_id: ex.exercise_id,
            sets: Array.from({ length: ex.target_sets }, (_, i) => ({
              set_number: i + 1,
              weight_kg: ex.target_weight_kg || null,
              reps: ex.target_reps || null,
              rpe: null,
            })),
          })),
        }),
      });

      if (res.ok) {
        // Brief success feedback
        setTimeout(() => setIsLoggingRoutine(null), 800);
      } else {
        setIsLoggingRoutine(null);
      }
    } catch {
      setIsLoggingRoutine(null);
    }
  }, [accessToken]);

  // Fetch templates
  const fetchTemplates = useCallback(() => {
    if (!accessToken) return;
    setIsLoading(true);
    apiFetch(`/api/v2/training/templates`)
      .then(r => r.ok ? r.json() : [])
      .then(setTemplates)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [accessToken]);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      setSearchQuery("");
    }
  }, [isOpen, fetchTemplates]);

  // Exercise search for builder
  useEffect(() => {
    if (exerciseQuery.length < 2) { setExerciseResults([]); return; }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await apiFetch(`/api/v2/training/exercises/search?q=${encodeURIComponent(exerciseQuery)}`);
        if (res.ok) setExerciseResults(await res.json());
      } catch {} finally { setIsSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [exerciseQuery]);

  // Builder actions
  const openCreateBuilder = useCallback(() => {
    setEditingTemplate(null);
    setTemplateName("");
    setTemplateDescription("");
    setExercises([]);
    setShowBuilder(true);
  }, []);

  const openEditBuilder = useCallback((t: Template) => {
    setEditingTemplate(t);
    setTemplateName(t.name);
    setTemplateDescription(t.description || "");
    setExercises(t.exercises.map(e => ({ ...e, exercise_name: e.exercise_name || "" })));
    setShowBuilder(true);
  }, []);

  const closeBuilder = useCallback(() => {
    setShowBuilder(false);
    setEditingTemplate(null);
  }, []);

  const addExercise = useCallback((ex: ExerciseSearchResult) => {
    setExercises(prev => [...prev, {
      exercise_id: ex.id,
      exercise_name: ex.name,
      target_sets: 3,
      target_reps: 10,
      target_weight_kg: 0,
      default_rest_seconds: 90,
    }]);
    setShowExerciseSearch(false);
    setExerciseQuery("");
  }, []);

  const updateSets = useCallback((i: number, d: number) => {
    setExercises(prev => prev.map((e, idx) => idx === i ? { ...e, target_sets: Math.max(1, Math.min(20, e.target_sets + d)) } : e));
  }, []);

  const updateReps = useCallback((i: number, v: number) => {
    setExercises(prev => prev.map((e, idx) => idx === i ? { ...e, target_reps: Math.max(0, v) } : e));
  }, []);

  const updateWeight = useCallback((i: number, v: number) => {
    setExercises(prev => prev.map((e, idx) => idx === i ? { ...e, target_weight_kg: Math.max(0, v) } : e));
  }, []);

  const updateRest = useCallback((i: number, v: number) => {
    setExercises(prev => prev.map((e, idx) => idx === i ? { ...e, default_rest_seconds: v } : e));
  }, []);

  const removeExercise = useCallback((i: number) => {
    setExercises(prev => prev.filter((_, idx) => idx !== i));
  }, []);

  const handleSave = useCallback(async () => {
    if (!templateName.trim() || !accessToken) return;
    setIsSaving(true);
    try {
      const body = JSON.stringify({
        name: templateName.trim(),
        description: templateDescription.trim() || null,
        exercises: exercises.map(e => ({
          exercise_id: e.exercise_id,
          target_sets: e.target_sets,
          default_rest_seconds: e.default_rest_seconds,
        })),
      });
      const url = editingTemplate
        ? `/api/v2/training/templates/${editingTemplate.id}`
        : `/api/v2/training/templates`;
      const method = editingTemplate ? "PUT" : "POST";
      const res = await apiFetch(url, { method, headers: { "Content-Type": "application/json" }, body });
      if (res.ok) { closeBuilder(); fetchTemplates(); }
    } catch {} finally { setIsSaving(false); }
  }, [templateName, templateDescription, exercises, accessToken, editingTemplate, closeBuilder, fetchTemplates]);

  const handleDelete = useCallback(async () => {
    if (!editingTemplate || !accessToken) return;
    setIsDeleting(true);
    try {
      const res = await apiFetch(`/api/v2/training/templates/${editingTemplate.id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) { closeBuilder(); fetchTemplates(); }
    } catch {} finally { setIsDeleting(false); }
  }, [editingTemplate, accessToken, closeBuilder, fetchTemplates]);

  // Filter
  const filtered = searchQuery
    ? templates.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : templates;
  const { setModalOpen } = useUIStore();
  useEffect(() => { setModalOpen(isOpen); return () => { setModalOpen(false); }; }, [isOpen, setModalOpen]);


  if (!isOpen) return null;

  return (
    <>
    {/* Main Routines Modal */}
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-0 left-0 right-0 h-[85dvh] rounded-t-3xl bg-surface-solid border-t border-white/10 overflow-hidden flex flex-col"
        >
          <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-white/20" /></div>
          <div className="flex items-center justify-between px-5 pb-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-accent-purple" />
              <h2 className="text-base font-semibold text-white">My Routines</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400"><X className="h-4 w-4" /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-6 transform-gpu space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search routines..." className="w-full rounded-xl bg-white/5 border border-white/10 pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple/50" />
            </div>

            {/* New Routine Button */}
            <button onClick={openCreateBuilder} className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-indigo/20 via-accent-purple/20 to-accent-cyan/20 border border-accent-purple/30 py-3.5 text-xs font-semibold text-accent-purple hover:border-accent-purple/50 transition-colors active:scale-[0.98]">
              <Plus className="h-4 w-4" />
              Create New Routine
            </button>

            {/* Loading */}
            {isLoading && <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 text-accent-purple animate-spin" /></div>}

            {/* List */}
            {!isLoading && filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Dumbbell className="h-10 w-10 text-gray-700 mb-3" />
                <p className="text-sm text-gray-400">{searchQuery ? "No routines match" : "No routines yet"}</p>
                <p className="text-[11px] text-gray-600 mt-1 max-w-[200px]">Create routines to quickly start structured workouts</p>
              </div>
            ) : (
              !isLoading && filtered.map((t) => (
                <div key={t.id} className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3.5 hover:bg-white/[0.06] transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{t.name}</p>
                      {t.description && <p className="text-[10px] text-gray-500 mt-0.5 truncate">{t.description}</p>}
                      <p className="text-[10px] text-gray-600 mt-1">{t.exercises.length} exercise{t.exercises.length !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <button onClick={() => handleLogRoutine(t)} disabled={isLoggingRoutine === t.id} className="flex items-center gap-1 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 px-2.5 py-1.5 text-[10px] font-medium text-accent-cyan hover:bg-accent-cyan/20 transition-colors disabled:opacity-50">
                        {isLoggingRoutine === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                        {isLoggingRoutine === t.id ? "Done!" : "Log"}
                      </button>
                      <button onClick={() => openEditBuilder(t)} className="flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-[10px] font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                        <Pencil className="h-3 w-3" />Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>

    {/* Builder Sub-Modal */}
    <AnimatePresence>
      {showBuilder && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm flex items-end" onClick={closeBuilder}>
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-h-[80dvh] rounded-t-3xl bg-[#0a0a0c]/98 border-t border-white/10 backdrop-blur-xl overflow-hidden flex flex-col pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-white/20" /></div>
            <div className="flex items-center justify-between px-5 pb-3">
              <h3 className="text-sm font-semibold text-white">{editingTemplate ? "Edit Routine" : "New Routine"}</h3>
              <button onClick={closeBuilder} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400"><X className="h-4 w-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-3 transform-gpu">
              <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Routine name (e.g., Push Day)" className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-purple" />
              <input type="text" value={templateDescription} onChange={(e) => setTemplateDescription(e.target.value)} placeholder="Description (optional)" className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-purple" />

              {/* Exercise Cards */}
              {exercises.map((ex, i) => (
                <div key={`${ex.exercise_id}-${i}`} className="rounded-xl bg-white/[0.03] border border-white/5 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-white">{ex.exercise_name || "Exercise"}</p>
                    <button onClick={() => removeExercise(i)} className="p-1 text-gray-600 hover:text-status-rose"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Sets</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateSets(i, -1)} className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white"><Minus className="h-3 w-3" /></button>
                      <span className="text-xs font-medium text-white w-4 text-center">{ex.target_sets}</span>
                      <button onClick={() => updateSets(i, 1)} className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white"><Plus className="h-3 w-3" /></button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Reps</span>
                    <input type="number" min={0} value={ex.target_reps || 0} onChange={(e) => updateReps(i, Number(e.target.value))} className="w-14 rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-xs text-white text-center outline-none focus:border-accent-purple [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Weight (kg)</span>
                    <input type="number" min={0} step={0.5} value={ex.target_weight_kg || 0} onChange={(e) => updateWeight(i, Number(e.target.value))} className="w-14 rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-xs text-white text-center outline-none focus:border-accent-purple [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1"><span className="text-[10px] text-gray-500">Rest</span><span className="text-[10px] text-white">{ex.default_rest_seconds}s</span></div>
                    <input type="range" min={30} max={300} step={15} value={ex.default_rest_seconds} onChange={(e) => updateRest(i, Number(e.target.value))} className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-accent-purple cursor-pointer" />
                  </div>
                </div>
              ))}

              <button onClick={() => setShowExerciseSearch(true)} className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 border-dashed py-3 text-xs font-medium text-gray-400 hover:text-white hover:border-white/20 transition-colors">
                <Plus className="h-4 w-4" />Add Exercise
              </button>

              <button onClick={handleSave} disabled={isSaving || !templateName.trim()} className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-indigo via-accent-purple to-accent-cyan py-3.5 text-sm font-semibold text-white disabled:opacity-50 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {editingTemplate ? "Update Routine" : "Save Routine"}
              </button>

              {editingTemplate && (
                <button onClick={handleDelete} disabled={isDeleting} className="w-full flex items-center justify-center gap-2 rounded-xl bg-status-rose/5 border border-status-rose/20 py-3 text-xs font-medium text-status-rose hover:bg-status-rose/10 transition-colors disabled:opacity-50">
                  {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Delete Routine
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Exercise Search Sub-Modal */}
    <AnimatePresence>
      {showExerciseSearch && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-end" onClick={() => setShowExerciseSearch(false)}>
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 300 }} onClick={(e) => e.stopPropagation()} className="w-full max-h-[50dvh] rounded-t-3xl bg-[#0a0a0c]/98 border-t border-white/10 backdrop-blur-xl p-5 flex flex-col">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input type="text" value={exerciseQuery} onChange={(e) => setExerciseQuery(e.target.value)} placeholder="Search exercises..." autoFocus className="w-full rounded-xl bg-white/5 border border-white/10 pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-purple" />
              {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-accent-purple animate-spin" />}
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {exerciseResults.map((ex) => (
                <button key={ex.id} onClick={() => addExercise(ex)} className="w-full flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/[0.04] px-3 py-2.5 text-left hover:bg-white/[0.05] transition-colors">
                  <div><p className="text-xs font-medium text-white">{ex.name}</p><p className="text-[10px] text-gray-500">{ex.category}</p></div>
                  <Plus className="h-4 w-4 text-gray-500" />
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Quick Log Modal */}
    </>
  );
}


