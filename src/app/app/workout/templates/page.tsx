"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dumbbell,
  Plus,
  Minus,
  Trash2,
  Loader2,
  Check,
  Search,
  X,
  ClipboardList,
} from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface TemplateExercise {
  exercise_id: string;
  exercise_name: string;
  target_sets: number;
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

export default function TemplatesPage() {
  const storeToken = useUserStore((s) => s.accessToken);
  const accessToken = storeToken || getAccessToken();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);

  // Builder state
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [exercises, setExercises] = useState<TemplateExercise[]>([]);
  const [showExerciseSearch, setShowExerciseSearch] = useState(false);
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [exerciseResults, setExerciseResults] = useState<ExerciseSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch existing templates
  const fetchTemplates = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const res = await apiFetch(`/api/v2/training/templates`);
      if (res.ok) setTemplates(await res.json());
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Exercise search
  useEffect(() => {
    if (exerciseQuery.length < 2) {
      setExerciseResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `${BACKEND_URL}/api/v2/training/exercises/search?q=${encodeURIComponent(exerciseQuery)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (res.ok) setExerciseResults(await res.json());
      } catch {
        // Silently fail
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [exerciseQuery, accessToken]);

  const addExercise = useCallback((ex: ExerciseSearchResult) => {
    setExercises((prev) => [
      ...prev,
      {
        exercise_id: ex.id,
        exercise_name: ex.name,
        target_sets: 3,
        default_rest_seconds: 90,
      },
    ]);
    setShowExerciseSearch(false);
    setExerciseQuery("");
  }, []);

  const updateSets = useCallback((index: number, delta: number) => {
    setExercises((prev) =>
      prev.map((e, i) =>
        i === index
          ? { ...e, target_sets: Math.max(1, Math.min(20, e.target_sets + delta)) }
          : e
      )
    );
  }, []);

  const updateRest = useCallback((index: number, value: number) => {
    setExercises((prev) =>
      prev.map((e, i) => (i === index ? { ...e, default_rest_seconds: value } : e))
    );
  }, []);

  const removeExercise = useCallback((index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(async () => {
    if (!templateName.trim() || !accessToken) return;
    setIsSaving(true);

    try {
      const res = await apiFetch(`/api/v2/training/templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: templateName.trim(),
          description: templateDescription.trim() || null,
          exercises: exercises.map((e) => ({
            exercise_id: e.exercise_id,
            target_sets: e.target_sets,
            default_rest_seconds: e.default_rest_seconds,
          })),
        }),
      });

      if (res.ok) {
        setShowBuilder(false);
        setTemplateName("");
        setTemplateDescription("");
        setExercises([]);
        fetchTemplates();
      }
    } catch {
      // Silently fail
    } finally {
      setIsSaving(false);
    }
  }, [templateName, templateDescription, exercises, accessToken, fetchTemplates]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 text-accent-purple animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 transform-gpu">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-accent-purple" />
          <h1 className="text-base font-semibold text-white">Templates</h1>
        </div>
        <button
          onClick={() => setShowBuilder(true)}
          className="flex items-center gap-1.5 rounded-xl bg-accent-purple/10 border border-accent-purple/20 px-4 py-2 text-xs font-medium text-accent-purple hover:bg-accent-purple/20 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Create
        </button>
      </div>

      {/* Template List */}
      {templates.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Dumbbell className="h-8 w-8 text-gray-700 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No templates yet</p>
          <p className="text-[10px] text-gray-600 mt-1">
            Create a template to quickly start structured workouts
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-4"
            >
              <h3 className="text-sm font-semibold text-white">{t.name}</h3>
              {t.description && (
                <p className="text-[10px] text-gray-500 mt-0.5">{t.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <span className="text-[10px] text-gray-400">
                  {t.exercises.length} exercise{t.exercises.length !== 1 ? "s" : ""}
                </span>
                <span className="text-[10px] text-gray-600">
                  Created {new Date(t.created_at).toLocaleDateString()}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Builder Modal */}
      <AnimatePresence>
        {showBuilder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={() => setShowBuilder(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-0 left-0 right-0 max-h-[90dvh] rounded-t-3xl bg-surface-solid border-t border-white/10 overflow-hidden flex flex-col"
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              <div className="flex items-center justify-between px-5 pb-3">
                <h2 className="text-base font-semibold text-white">New Template</h2>
                <button onClick={() => setShowBuilder(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4 transform-gpu">
                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Template Name</label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g., Push Day, Leg Day"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-purple"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Description (optional)</label>
                  <input
                    type="text"
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Chest, shoulders, triceps"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-purple"
                  />
                </div>

                {/* Exercise Cards */}
                {exercises.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-400">Exercises ({exercises.length})</p>
                    {exercises.map((ex, index) => (
                      <div key={`${ex.exercise_id}-${index}`} className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-white">{ex.exercise_name}</p>
                          <button onClick={() => removeExercise(index)} className="p-1 text-gray-600 hover:text-status-rose">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Sets control */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] text-gray-500">Target Sets</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateSets(index, -1)}
                              className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-xs font-medium text-white w-4 text-center">{ex.target_sets}</span>
                            <button
                              onClick={() => updateSets(index, 1)}
                              className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {/* Rest slider */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-gray-500">Rest</span>
                            <span className="text-[10px] text-white font-medium">{ex.default_rest_seconds}s</span>
                          </div>
                          <input
                            type="range"
                            min={30}
                            max={300}
                            step={15}
                            value={ex.default_rest_seconds}
                            onChange={(e) => updateRest(index, Number(e.target.value))}
                            className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-accent-purple cursor-pointer"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Exercise Button */}
                <button
                  onClick={() => setShowExerciseSearch(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 border-dashed py-3 text-xs font-medium text-gray-400 hover:text-white hover:border-white/20 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Exercise
                </button>

                {/* Save */}
                <button
                  onClick={handleSave}
                  disabled={isSaving || !templateName.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-indigo via-accent-purple to-accent-cyan py-3.5 text-sm font-semibold text-white disabled:opacity-50 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {isSaving ? "Saving..." : "Save Template"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exercise Search Sub-Modal */}
      <AnimatePresence>
        {showExerciseSearch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end"
            onClick={() => setShowExerciseSearch(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-h-[50dvh] rounded-t-3xl bg-surface-solid border-t border-white/10 p-5 flex flex-col"
            >
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  type="text"
                  value={exerciseQuery}
                  onChange={(e) => setExerciseQuery(e.target.value)}
                  placeholder="Search exercises..."
                  autoFocus
                  className="w-full rounded-xl bg-white/5 border border-white/10 pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-purple"
                />
                {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-accent-purple animate-spin" />}
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 transform-gpu">
                {exerciseResults.map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => addExercise(ex)}
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
      </AnimatePresence>
    </div>
  );
}
