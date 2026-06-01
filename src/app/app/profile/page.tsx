"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { User, Key, Loader2, Check, Shield, Pencil, Lock, BarChart3, ChevronDown, Settings, Trash2, LogOut } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { useCacheStore } from "@/store/useCacheStore";
import { getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";

interface BiometricData {
  gender: string | null;
  dob: string | null;
  height_cm: number | null;
  activity_level: string | null;
  fitness_goal: string | null;
  calculated_bmr: number | null;
  calculated_tdee: number | null;
  target_calories: number | null;
  target_protein_g: number | null;
  target_carbs_g: number | null;
  target_fat_g: number | null;
}

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function ProfilePage() {
  const router = useRouter();
  const storeToken = useUserStore((s) => s.accessToken);
  const accessToken = storeToken || getAccessToken();

  const [biometrics, setBiometrics] = useState<BiometricData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // BYOK state
  const [byokKey, setByokKey] = useState("");
  const [byokSaving, setByokSaving] = useState(false);
  const [byokSaved, setByokSaved] = useState(false);
  const [byokClearing, setByokClearing] = useState(false);
  const [byokCleared, setByokCleared] = useState(false);

  // Advanced accordion
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Sign out state
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (!accessToken) return;

    apiFetch(`/api/v2/profile/biometrics`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setBiometrics(data);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [accessToken]);

  const handleByokSave = useCallback(async () => {
    if (!byokKey.trim() || !accessToken) return;
    setByokSaving(true);
    setByokSaved(false);

    try {
      const res = await apiFetch(`/api/v2/profile/byok`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gemini_api_key: byokKey }),
      });

      if (res.ok) {
        setByokSaved(true);
        setByokKey("");
        setTimeout(() => setByokSaved(false), 3000);
      }
    } catch (err) {
      console.error("[PROFILE] BYOK save failed:", err);
    } finally {
      setByokSaving(false);
    }
  }, [byokKey, accessToken]);

  const handleByokClear = useCallback(async () => {
    if (!accessToken) return;
    setByokClearing(true);
    setByokCleared(false);

    try {
      const res = await apiFetch(`/api/v2/profile/byok`, { method: "DELETE" });
      if (res.ok) {
        setByokCleared(true);
        setByokKey("");
        setTimeout(() => setByokCleared(false), 3000);
      }
    } catch (err) {
      console.error("[PROFILE] BYOK clear failed:", err);
    } finally {
      setByokClearing(false);
    }
  }, [accessToken]);

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    try {
      // 1. Sign out from Supabase
      await supabase.auth.signOut();

      // 2. Clear Zustand auth store
      useUserStore.getState().clearAuth();

      // 3. Clear SWR cache store
      useCacheStore.getState().clearCache();

      // 4. Wipe browser storage
      localStorage.clear();
      sessionStorage.clear();

      // 5. Clear localforage IndexedDB (dynamic import to avoid SSR issues)
      try {
        const localforage = (await import("localforage")).default;
        await localforage.clear();
      } catch {}

      // 6. Hard redirect to login — wipes JS memory
      window.location.href = "/login";
    } catch (err) {
      console.error("[PROFILE] Sign out failed:", err);
      // Force redirect even on error
      window.location.href = "/login";
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 text-accent-purple animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 transform-gpu space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <User className="h-4 w-4 text-accent-purple" />
        <h1 className="text-base font-semibold text-white">Profile</h1>
      </div>

      {/* Biometric Summary */}
      {biometrics && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Biometrics</h2>
            <button
              onClick={() => router.push("/app/onboarding")}
              className="flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-[10px] font-medium text-gray-400 hover:text-white hover:border-white/20 transition-colors"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          </div>
          <div className="space-y-2.5">
            <ProfileRow label="Gender" value={biometrics.gender || "—"} />
            <ProfileRow label="Age" value={biometrics.dob ? `${calculateAge(biometrics.dob)} years` : "—"} />
            <ProfileRow label="Height" value={biometrics.height_cm ? `${biometrics.height_cm} cm` : "—"} />
            <ProfileRow label="Activity" value={biometrics.activity_level || "—"} />
            <ProfileRow label="Goal" value={biometrics.fitness_goal || "—"} />
          </div>
        </motion.div>
      )}

      {/* Goal Allocations */}
      {biometrics && biometrics.target_calories && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-4"
        >
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Daily Targets</h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-xl bg-white/[0.03] p-3 text-center">
              <p className="text-lg font-bold text-white">{biometrics.target_calories}</p>
              <p className="text-[9px] text-gray-500">kcal / day</p>
            </div>
            <div className="rounded-xl bg-white/[0.03] p-3 text-center">
              <p className="text-lg font-bold text-white">{Math.round(biometrics.calculated_tdee || 0)}</p>
              <p className="text-[9px] text-gray-500">TDEE</p>
            </div>
          </div>
          <div className="space-y-2.5">
            <ProfileRow label="Protein" value={`${biometrics.target_protein_g}g / day`} />
            <ProfileRow label="Carbs" value={`${biometrics.target_carbs_g}g / day`} />
            <ProfileRow label="Fat" value={`${biometrics.target_fat_g}g / day`} />
            <ProfileRow label="BMR" value={`${Math.round(biometrics.calculated_bmr || 0)} kcal`} />
          </div>
        </motion.div>
      )}

      {/* Advanced Configuration Accordion */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card overflow-hidden"
      >
        {/* Accordion Header */}
        <button
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Settings className="h-3.5 w-3.5 text-accent-indigo" />
            <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Advanced Configuration</h2>
          </div>
          <motion.div
            animate={{ rotate: advancedOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4 text-gray-500" />
          </motion.div>
        </button>

        {/* Accordion Content */}
        <AnimatePresence>
          {advancedOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                {/* BYOK Section */}
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-3.5 w-3.5 text-accent-indigo" />
                  <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">BYOK — Gemini API Key</span>
                </div>
                <p className="text-[10px] text-gray-500 mb-3">
                  Provide your own Gemini API key for AI features. Encrypted with your personal DEK.
                </p>

                {/* Key Input */}
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={byokKey}
                    onChange={(e) => setByokKey(e.target.value)}
                    placeholder="••••••••••••••••••••"
                    className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple/50"
                  />
                  <button
                    onClick={handleByokSave}
                    disabled={!byokKey.trim() || byokSaving}
                    className="flex items-center gap-1.5 rounded-xl bg-accent-indigo/10 border border-accent-indigo/20 px-4 py-2.5 text-xs font-medium text-accent-indigo hover:bg-accent-indigo/20 transition-colors disabled:opacity-50"
                  >
                    {byokSaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : byokSaved ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Key className="h-3.5 w-3.5" />
                    )}
                    {byokSaved ? "Saved" : "Save"}
                  </button>
                </div>

                {/* Clear Key Button */}
                <button
                  onClick={handleByokClear}
                  disabled={byokClearing}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-status-rose/5 border border-status-rose/20 py-2.5 text-xs font-medium text-status-rose hover:bg-status-rose/10 transition-colors disabled:opacity-50"
                >
                  {byokClearing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  {byokCleared ? "Reverted to server default" : "Clear Key / Reset to Default"}
                </button>

                {byokCleared && (
                  <p className="text-[10px] text-status-success text-center">
                    Reverted safely to server-side AI default.
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Locked Performance Insights Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-4 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-white/[0.01] backdrop-blur-[1px] z-10 flex items-center justify-center">
          <div className="flex items-center gap-1.5 rounded-full bg-white/10 border border-white/10 px-3 py-1.5">
            <Lock className="h-3 w-3 text-gray-400" />
            <span className="text-[10px] font-medium text-gray-400">Coming Soon</span>
          </div>
        </div>
        <div className="opacity-30">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-3.5 w-3.5 text-accent-purple" />
            <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Deep Performance Insights</h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/[0.03] p-3 text-center">
              <p className="text-sm font-bold text-white">—</p>
              <p className="text-[8px] text-gray-500">Strength</p>
            </div>
            <div className="rounded-xl bg-white/[0.03] p-3 text-center">
              <p className="text-sm font-bold text-white">—</p>
              <p className="text-[8px] text-gray-500">Recovery</p>
            </div>
            <div className="rounded-xl bg-white/[0.03] p-3 text-center">
              <p className="text-sm font-bold text-white">—</p>
              <p className="text-[8px] text-gray-500">Consistency</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Sign Out Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-status-rose/5 border border-status-rose/20 py-3.5 text-sm font-medium text-status-rose hover:bg-status-rose/10 transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(244,63,94,0.1)]"
        >
          {isSigningOut ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          {isSigningOut ? "Signing out..." : "Sign Out"}
        </button>
      </motion.div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-white capitalize">{value}</span>
    </div>
  );
}
