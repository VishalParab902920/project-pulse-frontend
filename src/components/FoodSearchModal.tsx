"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  ScanBarcode,
  Camera,
  CameraOff,
  Plus,
  Loader2,
  CheckCircle2,
  ChevronDown,
  Check,
  Coffee,
  Sun,
  Moon,
  Cookie,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cacheFoods, getCachedFoods } from "@/lib/offlineCache";
import { useUIStore } from "@/store/useUIStore";
import CustomFoodCreator from "@/components/nutrition/CustomFoodCreator";
import LogFoodDrawer from "@/components/nutrition/LogFoodDrawer";
import type { Food, MealType } from "@/lib/types/nutrition";

/**
 * FoodSearchModal — Search + Barcode scanner with database-first de-duplication.
 *
 * Barcode Pipeline:
 * 1. Query local food_dictionary for barcode match (Case A: instant hit)
 * 2. If miss, query Open Food Facts proxy (Case B: OFF hit → auto-save to DB)
 * 3. If double miss (Case C), show "not found" with option to create custom
 */

interface FoodResult {
  id: string;
  name: string;
  brand: string | null;
  base_unit: string;
  calories_per_100: number;
  protein_per_100: number;
  carbs_per_100: number;
  fat_per_100: number;
  is_custom: boolean;
  is_verified: boolean;
  barcode?: string | null;
  measures: { id: string; food_id: string; measure_name: string; conversion_factor: number; is_default: boolean }[];
}

interface FoodSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  mealType: string;
  onFoodLogged: () => void;
}

type TabType = "search" | "barcode";

export default function FoodSearchModal({
  isOpen,
  onClose,
  mealType,
  onFoodLogged,
}: FoodSearchModalProps) {

  const [activeTab, setActiveTab] = useState<TabType>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodResult | null>(null);
  const [isOfflineSearch, setIsOfflineSearch] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>(mealType as MealType);
  const [mealDropdownOpen, setMealDropdownOpen] = useState(false);
  const mealDropdownRef = useRef<HTMLDivElement>(null);
  const searchVersionRef = useRef(0);

  // Barcode state
  const [barcodeValue, setBarcodeValue] = useState("");
  const [cameraAvailable, setCameraAvailable] = useState(true);
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeNotFound, setBarcodeNotFound] = useState(false);
  const [showCustomCreator, setShowCustomCreator] = useState(false);
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<unknown>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedFood(null);
      setIsOfflineSearch(false);
      setBarcodeValue("");
      setIsScannerActive(false);
      setBarcodeNotFound(false);
      setShowCustomCreator(false);
      setMealDropdownOpen(false);
      stopScanner();
    } else {
      setSelectedMealType(mealType as MealType);
    }
  }, [isOpen, mealType]);

  // Close meal dropdown on outside click
  useEffect(() => {
    if (!mealDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (mealDropdownRef.current && !mealDropdownRef.current.contains(e.target as Node)) {
        setMealDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [mealDropdownOpen]);

  // Search food catalog — Dual-Layer Hybrid (online API + offline IndexedDB fallback)
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); setIsOfflineSearch(false); return; }

    const isOnline = typeof window !== "undefined" ? window.navigator.onLine : true;

    // Increment version to invalidate stale responses
    const version = ++searchVersionRef.current;

    setIsSearching(true);
    setIsOfflineSearch(false);

    if (isOnline) {
      try {
        const res = await apiFetch(
          `/api/v2/nutrition/food/search?q=${encodeURIComponent(query)}`
        );

        // If a newer search was triggered, discard this result
        if (searchVersionRef.current !== version) return;

        if (res.ok) {
          const data: FoodResult[] = await res.json();
          setSearchResults(data);
          // Asynchronously cache results for offline use
          cacheFoods(data as unknown as Food[]).catch(() => {});
        } else {
          await performOfflineSearch(query);
        }
      } catch {
        if (searchVersionRef.current !== version) return;
        await performOfflineSearch(query);
      }
    } else {
      await performOfflineSearch(query);
    }

    if (searchVersionRef.current === version) {
      setIsSearching(false);
    }
  }, []);

  // Offline search helper — regex match against local cache
  const performOfflineSearch = useCallback(async (query: string) => {
    setIsOfflineSearch(true);
    try {
      const cachedFoods = await getCachedFoods();
      const regex = new RegExp(query, "i");
      const filtered = cachedFoods.filter(
        (food) => regex.test(food.name) || (food.brand && regex.test(food.brand))
      );
      setSearchResults(filtered as unknown as FoodResult[]);
    } catch {
      setSearchResults([]);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) return;
    const timer = setTimeout(() => handleSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // =========================================================
  // Barcode De-duplication Pipeline
  // =========================================================

  const lookupBarcode = useCallback(async (code: string) => {
    setBarcodeLoading(true);
    setBarcodeNotFound(false);

    try {
      // Step 1: Check our local database first
      const res = await apiFetch(`/api/v2/nutrition/barcode/${encodeURIComponent(code)}`);

      if (res.ok) {
        // Case A: Database hit — use it directly
        const food: FoodResult = await res.json();
        setSelectedFood(food);
        setActiveTab("search");
        return;
      }

      // Step 2: Database miss — try Open Food Facts proxy
      // The backend /barcode/ endpoint already handles OFF lookup and auto-saves
      // If we got a 404, it means neither DB nor OFF had it
      if (res.status === 404) {
        // Case C: Double miss — show not found
        setBarcodeNotFound(true);
      }
    } catch (err) {
      console.error("[BARCODE] Lookup failed:", err);
      setBarcodeNotFound(true);
    } finally {
      setBarcodeLoading(false);
    }
  }, []);

  // Barcode scanner initialization
  const startScanner = useCallback(async () => {
    if (!scannerRef.current) return;

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("barcode-reader");
      html5QrCodeRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 100 } },
        (decodedText) => {
          setBarcodeValue(decodedText);
          stopScanner();
          lookupBarcode(decodedText);
        },
        () => {}
      );

      setIsScannerActive(true);
      setCameraAvailable(true);
    } catch (err) {
      console.warn("[SCANNER] Camera unavailable:", err);
      setCameraAvailable(false);
      setIsScannerActive(false);
    }
  }, [lookupBarcode]);

  const stopScanner = useCallback(() => {
    const scanner = html5QrCodeRef.current as { stop?: () => Promise<void> } | null;
    if (scanner && scanner.stop) { scanner.stop().catch(() => {}); }
    html5QrCodeRef.current = null;
    setIsScannerActive(false);
  }, []);

  const handleManualBarcode = useCallback(() => {
    if (barcodeValue.length > 4) { lookupBarcode(barcodeValue); }
  }, [barcodeValue, lookupBarcode]);

  // Start scanner when barcode tab is active
  useEffect(() => {
    if (activeTab === "barcode" && isOpen && !isScannerActive) {
      const timer = setTimeout(startScanner, 300);
      return () => clearTimeout(timer);
    }
    if (activeTab !== "barcode") { stopScanner(); }
  }, [activeTab, isOpen, isScannerActive, startScanner, stopScanner]);

  // Cleanup on unmount
  useEffect(() => { return () => stopScanner(); }, [stopScanner]);
  const { setModalOpen } = useUIStore();
  useEffect(() => { setModalOpen(isOpen); return () => { setModalOpen(false); }; }, [isOpen, setModalOpen]);


  if (!isOpen) return null;

  return (
    <>
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-0 left-0 right-0 max-h-[85dvh] rounded-t-3xl bg-surface-solid border-t border-white/10 overflow-hidden flex flex-col"
        >
          {/* Handle Bar */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Header with Meal Selector */}
          <div className="flex items-center justify-between px-5 pb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">Add to</h2>
              <div className="relative" ref={mealDropdownRef}>
                <button
                  type="button"
                  onClick={() => setMealDropdownOpen(!mealDropdownOpen)}
                  className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm font-bold text-accent-purple hover:border-accent-purple/30 focus:outline-none focus:border-accent-purple/50 focus:shadow-[0_0_12px_rgba(168,85,247,0.1)] transition-all"
                >
                  {selectedMealType.charAt(0).toUpperCase() + selectedMealType.slice(1)}
                  <ChevronDown className={`h-3.5 w-3.5 text-gray-500 transition-transform ${mealDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {mealDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-1.5 z-50 rounded-xl bg-[#0a0a0a] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl overflow-hidden w-40"
                    >
                      {([
                        { key: "breakfast", label: "Breakfast", icon: Coffee },
                        { key: "lunch", label: "Lunch", icon: Sun },
                        { key: "dinner", label: "Dinner", icon: Moon },
                        { key: "snack", label: "Snack", icon: Cookie },
                      ] as const).map(({ key, label, icon: Icon }) => {
                        const isActive = selectedMealType === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              setSelectedMealType(key);
                              setMealDropdownOpen(false);
                            }}
                            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${
                              isActive
                                ? "bg-accent-purple/10 border-l-2 border-accent-purple"
                                : "hover:bg-white/5 border-l-2 border-transparent"
                            }`}
                          >
                            <Icon className={`h-3.5 w-3.5 ${isActive ? "text-accent-purple" : "text-gray-500"}`} />
                            <span className={`text-sm font-semibold ${isActive ? "text-accent-purple" : "text-white"}`}>
                              {label}
                            </span>
                            {isActive && <Check className="h-3.5 w-3.5 text-accent-purple ml-auto" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-5 mb-4">
            <button
              onClick={() => setActiveTab("search")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab === "search" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              <Search className="h-3.5 w-3.5" />
              Search
            </button>
            <button
              onClick={() => setActiveTab("barcode")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab === "barcode" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              <ScanBarcode className="h-3.5 w-3.5" />
              Barcode
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 pb-6 transform-gpu">
            {/* Search Tab */}
            {activeTab === "search" ? (
              /* Search Tab */
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search foods..." autoFocus className="w-full rounded-xl bg-white/5 border border-white/10 pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple/50" />
                  {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-accent-purple animate-spin" />}
                </div>

                <div className="space-y-1.5 max-h-[40dvh] overflow-y-auto transform-gpu">
                  {/* Offline Mode Indicator */}
                  {isOfflineSearch && (
                    <div className="flex items-center gap-2 rounded-xl bg-amber-500/[0.07] border border-amber-500/20 px-3 py-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                      <span className="text-[10px] font-medium text-amber-400">
                        Offline Mode — Searching Local History
                      </span>
                    </div>
                  )}

                  {searchResults.map((food) => (
                    <button key={food.id} onClick={() => setSelectedFood(food)} className="w-full flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/[0.04] px-3 py-2.5 text-left hover:bg-white/[0.05] transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-medium text-white truncate">{food.name}</p>
                          {food.is_verified && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)] flex-shrink-0">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 fill-emerald-400/10" />
                              Verified
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500">{food.brand || "Generic"} • {food.calories_per_100} kcal/100{food.base_unit}</p>
                      </div>
                      <Plus className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    </button>
                  ))}

                  {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                    <p className="text-center text-[10px] text-gray-600 py-4">No results found for &ldquo;{searchQuery}&rdquo;</p>
                  )}
                </div>

                <button onClick={() => setShowCustomCreator(true)} className="w-full text-center py-3 text-[11px] font-medium text-accent-purple hover:text-accent-cyan transition-colors">
                  Can&apos;t find your food? <span className="underline">Create Custom Food</span>
                </button>
              </div>
            ) : (
              /* Barcode Tab */
              <div className="space-y-4">
                {cameraAvailable ? (
                  <div className="space-y-3">
                    <div id="barcode-reader" ref={scannerRef} className="w-full h-48 rounded-xl overflow-hidden bg-black/50 border border-white/10" />
                    {isScannerActive && (
                      <div className="flex items-center gap-2 justify-center">
                        <Camera className="h-3.5 w-3.5 text-accent-cyan" />
                        <span className="text-[10px] text-gray-400">Point camera at barcode...</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4 text-center space-y-3">
                    <CameraOff className="h-8 w-8 text-gray-600 mx-auto" />
                    <p className="text-xs text-gray-400">Camera unavailable. Type barcode manually:</p>
                  </div>
                )}

                {/* Manual barcode input — always visible */}
                <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3">
                  <p className="text-[10px] text-gray-500 mb-2">
                    {cameraAvailable ? "Or enter barcode manually:" : "Enter barcode:"}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={barcodeValue}
                      onChange={(e) => { setBarcodeValue(e.target.value); setBarcodeNotFound(false); }}
                      placeholder="Barcode number"
                      className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-accent-purple"
                    />
                    <button
                      onClick={handleManualBarcode}
                      disabled={barcodeValue.length < 5 || barcodeLoading}
                      className="rounded-lg bg-accent-purple/20 border border-accent-purple/30 px-3 py-2 text-[10px] font-medium text-accent-purple disabled:opacity-50"
                    >
                      {barcodeLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Lookup"}
                    </button>
                  </div>
                </div>

                {/* Barcode loading state */}
                {barcodeLoading && (
                  <div className="flex items-center justify-center gap-2 py-3">
                    <Loader2 className="h-4 w-4 text-accent-purple animate-spin" />
                    <span className="text-xs text-gray-400">Searching database & Open Food Facts...</span>
                  </div>
                )}

                {/* Case C: Not found anywhere */}
                {barcodeNotFound && !barcodeLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl bg-status-amber/5 border border-status-amber/20 p-4 text-center space-y-2"
                  >
                    <p className="text-xs text-status-amber">
                      Barcode not found in our database or Open Food Facts.
                    </p>
                    <button
                      onClick={() => setShowCustomCreator(true)}
                      className="text-[11px] font-medium text-accent-purple hover:text-accent-cyan transition-colors underline"
                    >
                      Create this food manually
                    </button>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>

    {/* Custom Food Creator */}
    <CustomFoodCreator
      isOpen={showCustomCreator}
      onClose={() => setShowCustomCreator(false)}
      onFoodCreated={(food: Food) => {
        setShowCustomCreator(false);
        setSelectedFood({
          id: food.id,
          name: food.name,
          brand: food.brand,
          base_unit: food.base_unit,
          calories_per_100: food.calories_per_100,
          protein_per_100: food.protein_per_100,
          carbs_per_100: food.carbs_per_100,
          fat_per_100: food.fat_per_100,
          is_custom: food.is_custom,
          is_verified: food.is_verified,
          barcode: food.barcode,
          measures: food.measures,
        });
      }}
    />

    {/* V2.5 LogFoodDrawer — opens when a food is selected */}
    {selectedFood && (
      <LogFoodDrawer
        isOpen={!!selectedFood}
        onClose={() => setSelectedFood(null)}
        food={{
          id: selectedFood.id,
          name: selectedFood.name,
          brand: selectedFood.brand,
          barcode: selectedFood.barcode ?? null,
          base_unit: (selectedFood.base_unit === "ml" ? "ml" : "g") as "g" | "ml",
          calories_per_100: selectedFood.calories_per_100,
          protein_per_100: selectedFood.protein_per_100,
          carbs_per_100: selectedFood.carbs_per_100,
          fat_per_100: selectedFood.fat_per_100,
          is_custom: selectedFood.is_custom,
          is_verified: selectedFood.is_verified,
          created_by: null,
          measures: selectedFood.measures,
        }}
        mealType={selectedMealType}
        onLogged={() => {
          setSelectedFood(null);
          onFoodLogged();
        }}
      />
    )}
    </>
  );
}


