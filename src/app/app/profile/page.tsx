"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useSWR, globalMutate } from "@/hooks/useSWR";
import { User, Key, Loader2, Check, Shield, Pencil, ChevronDown, Settings, Trash2, LogOut, Sparkles, AlertTriangle, Camera } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { useCacheStore } from "@/store/useCacheStore";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { calculateAge } from "@/lib/utils/date";
import EditBiometricsModal from "@/components/profile/EditBiometricsModal";
import TunePerformanceModal from "@/components/profile/TunePerformanceModal";

interface BiometricData {
  gender: string | null;
  dob: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  body_fat_pct: number | null;
  activity_level: string | null;
  fitness_goal: string | null;
  calculated_bmr: number | null;
  calculated_tdee: number | null;
  target_calories: number | null;
  target_protein_g: number | null;
  target_carbs_g: number | null;
  target_fat_g: number | null;
  allergies: string[];
  preferred_solid_unit?: 'metric' | 'imperial';
  preferred_liquid_unit?: 'metric' | 'imperial';
}

export default function ProfilePage() {
  const router = useRouter();
  const { accessToken, isHydrated, updatePreferences, preferred_solid_unit, preferred_liquid_unit, allergies } = useUserStore();

  const { data: biometrics, isLoading } = useSWR<BiometricData>("/api/v2/profile/biometrics");

  const { data: profile, mutate: mutateProfile } = useSWR<any>("/api/v2/profile/me");

  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Name edit state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  // Avatar upload
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;
    
    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await apiFetch("/api/v2/profile/avatar", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        mutateProfile();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleNameSave = async () => {
    setIsEditingName(false);
    const trimmed = editNameValue.trim() || null;
    if (trimmed === profile?.full_name) return;

    const originalProfile = profile;
    const cacheKey = "/api/v2/profile/me";

    // Optimistically update the store and trigger local SWR state updates
    const updatedProfile = { ...profile, full_name: trimmed };
    useCacheStore.getState().setCache(cacheKey, updatedProfile);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("pulse:cache-update", {
          detail: { cacheKey, revalidate: false },
        })
      );
    }

    setIsSavingName(true);
    try {
      const res = await apiFetch(cacheKey, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: trimmed }),
      });
      if (!res.ok) {
        throw new Error("Failed to save name");
      }
      // Revalidate in background to align with server state
      globalMutate(cacheKey);
    } catch (err) {
      console.error("[PROFILE] Name save failed:", err);
      // Rollback to original value on error
      useCacheStore.getState().setCache(cacheKey, originalProfile);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("pulse:cache-update", {
            detail: { cacheKey, revalidate: false },
          })
        );
      }
      setEditNameValue(originalProfile?.full_name || "");
    } finally {
      setIsSavingName(false);
    }
  };

  // Modals state
  const [isBiometricsModalOpen, setIsBiometricsModalOpen] = useState(false);
  const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);

  // BYOK state
  const [byokKey, setByokKey] = useState("");
  const [byokSaving, setByokSaving] = useState(false);
  const [byokSaved, setByokSaved] = useState(false);
  const [byokClearing, setByokClearing] = useState(false);
  const [byokCleared, setByokCleared] = useState(false);

  // Advanced accordion
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email);
    });
  }, []);

  useEffect(() => {
    if (biometrics) {
      const solid = biometrics.preferred_solid_unit || "metric";
      const liquid = biometrics.preferred_liquid_unit || "metric";
      const userAllergies = biometrics.allergies || [];

      useUserStore.setState({
        preferred_solid_unit: solid,
        preferred_liquid_unit: liquid,
        allergies: userAllergies,
      });

      import("localforage").then((localforage) => {
        localforage.default.setItem("preferred_solid_unit", solid);
        localforage.default.setItem("preferred_liquid_unit", liquid);
        localforage.default.setItem("allergies", userAllergies);
      });
    }
  }, [biometrics]);

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
      await supabase.auth.signOut();
      useUserStore.getState().clearAuth();
      useCacheStore.getState().clearCache();
      localStorage.clear();
      sessionStorage.clear();
      try {
        const localforage = (await import("localforage")).default;
        await localforage.clear();
      } catch {}
      window.location.href = "/login";
    } catch (err) {
      console.error("[PROFILE] Sign out failed:", err);
      window.location.href = "/login";
    }
  }, []);

  if (!isMounted || !isHydrated || isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] p-4 flex flex-col gap-4">
         <div className="flex items-center gap-3 animate-pulse">
           <div className="h-10 w-10 rounded-full bg-white/5" />
           <div className="space-y-2">
             <div className="h-3 w-24 bg-white/5 rounded" />
             <div className="h-2 w-32 bg-white/5 rounded" />
           </div>
         </div>
         <div className="h-24 w-full rounded-2xl bg-white/5 animate-pulse" />
         <div className="h-48 w-full rounded-2xl bg-white/5 animate-pulse" />
         <div className="h-48 w-full rounded-2xl bg-white/5 animate-pulse" />
      </div>
    );
  }

  const macroTotal = (biometrics?.target_protein_g || 0) + (biometrics?.target_carbs_g || 0) + (biometrics?.target_fat_g || 0);
  const pPct = macroTotal > 0 ? ((biometrics?.target_protein_g || 0) / macroTotal) * 100 : 0;
  const cPct = macroTotal > 0 ? ((biometrics?.target_carbs_g || 0) / macroTotal) * 100 : 0;
  const fPct = macroTotal > 0 ? ((biometrics?.target_fat_g || 0) / macroTotal) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#050505] p-4 pb-24 text-white font-sans selection:bg-accent-indigo/30 space-y-4">
      {/* Identity & AI Summary Grid */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-[128px_1fr] gap-x-5 gap-y-1 mb-6">
        {/* Cell 1: Avatar (Row span 3, Col 1) */}
        <div className="row-span-3 flex flex-col items-center">
          <div className="relative cursor-pointer group" onClick={() => avatarInputRef.current?.click()}>
            <div className="h-32 w-32 rounded-full bg-accent-indigo/20 flex items-center justify-center border border-accent-indigo/50 shadow-[0_0_32px_rgba(99,102,241,0.2)] z-10 relative overflow-hidden">
              {isUploadingAvatar ? (
                <Loader2 className="h-8 w-8 text-accent-indigo animate-spin" />
              ) : profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <User className="h-12 w-12 text-accent-indigo" />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-100 md:opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera className="h-6 w-6 text-white" />
              </div>
            </div>
            <input type="file" accept="image/*" className="hidden" ref={avatarInputRef} onChange={handleAvatarUpload} />
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); avatarInputRef.current?.click(); }}
            className="text-[10px] text-accent-indigo font-bold uppercase tracking-wider mt-3 hover:text-white transition-colors"
          >
            {profile?.avatar_url ? 'Change Photo' : 'Upload Photo'}
          </button>
        </div>

        {/* Cell 2: Name (Row 1, Col 2) */}
        <div className="flex items-end pb-1">
          {isEditingName ? (
            <div className="flex items-center gap-2 w-full max-w-[250px]">
              <input
                autoFocus
                type="text"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                onBlur={handleNameSave}
                className="bg-transparent border-b border-accent-indigo px-1 py-1 text-xl font-bold text-white w-full focus:outline-none"
                placeholder="Enter your name"
                onKeyDown={(e) => { 
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    e.currentTarget.blur();
                  }
                }}
              />
              {isSavingName && (
                <Loader2 className="h-4 w-4 animate-spin text-accent-indigo flex-shrink-0" />
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 group/name cursor-pointer" onClick={() => { setEditNameValue(profile?.full_name || ""); setIsEditingName(true); }}>
              <h1 className="text-xl font-bold text-white tracking-wide leading-none">
                {profile?.full_name || "Add Your Name"}
              </h1>
              <Pencil className="h-3 w-3 text-gray-500 opacity-100 md:opacity-0 group-hover/name:opacity-100 transition-opacity" />
            </div>
          )}
        </div>

        {/* Cell 3: Email (Row 2, Col 2) */}
        <div className="flex items-start pt-1">
          {userEmail && <p className="text-xs text-gray-500 leading-none">{userEmail}</p>}
        </div>

        {/* Cell 4: AI Metabolic Summary (Row 3, Col 2) */}
        <div className="flex items-start pt-2">
          <div className="bg-[#111113]/70 border border-white/[0.08] backdrop-blur-xl rounded-xl p-3 shadow-[0_4px_30px_rgba(0,0,0,0.1)] relative overflow-hidden w-full">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-accent-indigo via-accent-cyan to-accent-indigo opacity-50" />
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="h-3 w-3 text-accent-cyan" />
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-accent-cyan leading-none">AI Metabolic Insights</h2>
            </div>
            <p className="text-[11px] text-gray-300 leading-relaxed">
              "Consistency at 95% over 30 days. {biometrics?.fitness_goal ? biometrics.fitness_goal.replace('_', ' ') : 'Metabolic'} caloric targets remain optimal based on your recent progression data."
            </p>
          </div>
        </div>
      </motion.div>

      {/* Vitals & Biometrics */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-[#111113]/70 border border-white/[0.08] backdrop-blur-xl rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Vitals & Biometrics</h2>
          <button onClick={() => setIsBiometricsModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold uppercase text-gray-300 hover:bg-white/10 hover:text-white transition-colors">
            <Pencil className="h-3 w-3" /> Edit
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Age / DOB</p>
            <p className="text-sm font-semibold">{biometrics?.dob ? `${calculateAge(biometrics.dob)} yrs` : '—'} <span className="text-[10px] text-gray-500 font-normal ml-1">({biometrics?.dob})</span></p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Height</p>
            <p className="text-sm font-semibold">
              {biometrics?.height_cm
                ? preferred_solid_unit === "imperial"
                  ? `${Math.floor((biometrics.height_cm / 2.54) / 12)} ft ${Math.round((biometrics.height_cm / 2.54) % 12)} in`
                  : `${biometrics.height_cm} cm`
                : "—"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Weight</p>
            <p className="text-sm font-semibold">
              {biometrics?.weight_kg
                ? preferred_solid_unit === "imperial"
                  ? `${Math.round(biometrics.weight_kg * 2.20462)} lbs`
                  : `${biometrics.weight_kg} kg`
                : "—"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Body Fat</p>
            <p className="text-sm font-semibold">
              {biometrics?.body_fat_pct ? `${biometrics.body_fat_pct}%` : "—"}
              <span className="text-[10px] text-gray-500 font-normal ml-1">
                {biometrics?.weight_kg && biometrics?.body_fat_pct
                  ? preferred_solid_unit === "imperial"
                    ? `| LBM: ${Math.round(biometrics.weight_kg * (1 - biometrics.body_fat_pct / 100) * 2.20462 * 10) / 10} lbs`
                    : `| LBM: ${Math.round(biometrics.weight_kg * (1 - biometrics.body_fat_pct / 100) * 10) / 10} kg`
                  : ""}
              </span>
            </p>
          </div>
        </div>
      </motion.div>

      {/* Performance Targets */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-[#111113]/70 border border-white/[0.08] backdrop-blur-xl rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Goal Architecture</h2>
          <button onClick={() => setIsPerformanceModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold uppercase text-gray-300 hover:bg-white/10 hover:text-white transition-colors">
            <Pencil className="h-3 w-3" /> Edit
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
           <div className="bg-white/5 rounded-xl p-3 border border-white/5">
             <p className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1">Activity</p>
             <p className="text-sm font-semibold capitalize">{biometrics?.activity_level ? biometrics.activity_level.replace('_', ' ') : '—'}</p>
           </div>
           <div className="bg-white/5 rounded-xl p-3 border border-white/5">
             <p className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1">Phase</p>
             <p className="text-sm font-semibold capitalize">{biometrics?.fitness_goal ? biometrics.fitness_goal.replace('_', ' ') : '—'}</p>
           </div>
           <div className="bg-white/5 rounded-xl p-3 border border-white/5">
             <p className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1">Target</p>
             <p className="text-lg font-bold text-accent-indigo">{biometrics?.target_calories || '—'} <span className="text-[10px] text-gray-500 font-normal ml-1">kcal</span></p>
           </div>
           <div className="bg-white/5 rounded-xl p-3 border border-white/5">
             <p className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1">TDEE</p>
             <p className="text-lg font-bold text-white">{biometrics?.calculated_tdee ? Math.round(biometrics.calculated_tdee) : '—'} <span className="text-[10px] text-gray-500 font-normal ml-1">kcal</span></p>
           </div>
        </div>
        
        {/* Macro Split Progress Bar */}
        <div className="space-y-2">
          <div className="flex w-full h-3 rounded-full overflow-hidden bg-white/10">
             <div className="bg-accent-indigo transition-all duration-1000" style={{ width: `${pPct}%` }} />
             <div className="bg-accent-cyan transition-all duration-1000" style={{ width: `${cPct}%` }} />
             <div className="bg-[#f59e0b] transition-all duration-1000" style={{ width: `${fPct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400">
             <span className="text-accent-indigo">Pro: {biometrics?.target_protein_g || 0}g</span>
             <span className="text-accent-cyan">Carb: {biometrics?.target_carbs_g || 0}g</span>
             <span className="text-[#f59e0b]">Fat: {biometrics?.target_fat_g || 0}g</span>
          </div>
        </div>
      </motion.div>

      {/* Allergens & Units Row */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Allergen Registry Box */}
        <div className="bg-[#111113]/70 border border-white/[0.08] backdrop-blur-xl rounded-2xl p-5">
           <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">Allergen Registry <AlertTriangle className="h-3 w-3 text-status-rose opacity-80" /></h2>
           {allergies && allergies.length > 0 ? (
             <div className="flex flex-wrap gap-2">
               {allergies.map(a => (
                 <span key={a} className="px-2 py-1 rounded-md bg-status-rose/10 border border-status-rose/20 text-status-rose text-[10px] font-bold uppercase tracking-wider">{a}</span>
               ))}
             </div>
           ) : (
             <p className="text-[10px] font-bold uppercase tracking-wider text-status-success bg-status-success/10 border border-status-success/20 px-3 py-2 rounded-lg inline-block">No Active Allergies</p>
           )}
        </div>

        {/* Units & Metrics Box */}
        <div className="bg-[#111113]/70 border border-white/[0.08] backdrop-blur-xl rounded-2xl p-5">
           <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Units & Metrics</h2>
           <div className="space-y-4">
             <div className="flex justify-between items-center">
               <span className="text-xs font-semibold text-gray-300">Solids</span>
               <div className="flex bg-[#050505] rounded-pill p-1 border border-white/5">
                 <button onClick={() => updatePreferences('metric', preferred_liquid_unit, allergies)} className={`px-4 py-1.5 rounded-pill text-[10px] font-bold transition-all ${preferred_solid_unit === 'metric' ? 'bg-accent-indigo text-white' : 'text-gray-500 hover:text-gray-300'}`}>Metric (g)</button>
                 <button onClick={() => updatePreferences('imperial', preferred_liquid_unit, allergies)} className={`px-4 py-1.5 rounded-pill text-[10px] font-bold transition-all ${preferred_solid_unit === 'imperial' ? 'bg-accent-indigo text-white' : 'text-gray-500 hover:text-gray-300'}`}>Imperial (oz)</button>
               </div>
             </div>
             <div className="flex justify-between items-center">
               <span className="text-xs font-semibold text-gray-300">Liquids</span>
               <div className="flex bg-[#050505] rounded-pill p-1 border border-white/5">
                 <button onClick={() => updatePreferences(preferred_solid_unit, 'metric', allergies)} className={`px-4 py-1.5 rounded-pill text-[10px] font-bold transition-all ${preferred_liquid_unit === 'metric' ? 'bg-accent-indigo text-white' : 'text-gray-500 hover:text-gray-300'}`}>Metric (ml)</button>
                 <button onClick={() => updatePreferences(preferred_solid_unit, 'imperial', allergies)} className={`px-4 py-1.5 rounded-pill text-[10px] font-bold transition-all ${preferred_liquid_unit === 'imperial' ? 'bg-accent-indigo text-white' : 'text-gray-500 hover:text-gray-300'}`}>Imperial (fl oz)</button>
               </div>
             </div>
           </div>
        </div>
      </motion.div>

      {/* Advanced Config & Logout */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-[#111113]/70 border border-white/[0.08] backdrop-blur-xl rounded-2xl overflow-hidden">
        <button onClick={() => setAdvancedOpen(!advancedOpen)} className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-accent-indigo" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Advanced Configuration</h2>
          </div>
          <motion.div animate={{ rotate: advancedOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="h-4 w-4 text-gray-500" />
          </motion.div>
        </button>

        <AnimatePresence>
          {advancedOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
                <div className="space-y-3">
                   <div className="flex items-center gap-2">
                     <Shield className="h-4 w-4 text-accent-indigo" />
                     <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">BYOK — Gemini API Key</span>
                   </div>
                   <p className="text-[10px] text-gray-500 leading-relaxed">Provide your own Gemini API key for AI features. Encrypted with your personal DEK.</p>
                   <div className="flex gap-2">
                     <input type="password" value={byokKey} onChange={(e) => setByokKey(e.target.value)} placeholder="••••••••••••••••••••" className="flex-1 rounded-xl bg-[#050505] border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-indigo" />
                     <button onClick={handleByokSave} disabled={!byokKey.trim() || byokSaving} className="flex items-center justify-center min-w-[100px] gap-1.5 rounded-xl bg-accent-indigo/10 border border-accent-indigo/20 text-xs font-bold text-accent-indigo hover:bg-accent-indigo/20 transition-colors disabled:opacity-50">
                       {byokSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : byokSaved ? <Check className="h-3.5 w-3.5" /> : <Key className="h-3.5 w-3.5" />}
                       {byokSaved ? "Saved" : "Save"}
                     </button>
                   </div>
                   <button onClick={handleByokClear} disabled={byokClearing} className="w-full flex items-center justify-center gap-2 rounded-xl bg-status-rose/5 border border-status-rose/20 py-3 text-xs font-bold text-status-rose hover:bg-status-rose/10 transition-colors disabled:opacity-50">
                     {byokClearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                     {byokCleared ? "Reverted to Server Default" : "Clear Key / Reset to Default"}
                   </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <button onClick={handleSignOut} disabled={isSigningOut} className="w-full flex items-center justify-center gap-2 rounded-xl bg-status-rose/10 border border-status-rose/30 py-4 text-sm font-bold tracking-widest uppercase text-status-rose hover:bg-status-rose/20 transition-colors disabled:opacity-50 shadow-[0_0_24px_rgba(244,63,94,0.15)]">
          {isSigningOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          {isSigningOut ? "Signing Out..." : "Sign Out"}
        </button>
      </motion.div>

      {/* Footer Metadata */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="pt-8 pb-4 text-center text-[10px] text-gray-600 flex flex-col gap-2">
        <div className="flex justify-center gap-4">
          <button className="hover:text-gray-400 transition-colors">Privacy Policy</button>
          <span>|</span>
          <button className="hover:text-gray-400 transition-colors">Terms & Conditions</button>
        </div>
        <p>Version 2.5.2-Kayan</p>
      </motion.div>
      
      {/* Modals */}
      <EditBiometricsModal isOpen={isBiometricsModalOpen} onClose={() => setIsBiometricsModalOpen(false)} biometrics={biometrics} />
      <TunePerformanceModal isOpen={isPerformanceModalOpen} onClose={() => setIsPerformanceModalOpen(false)} biometrics={biometrics} />
    </div>
  );
}
