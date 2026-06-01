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
  Check,
} from "lucide-react";
import { useDateStore } from "@/store/useDateStore";
import { apiFetch } from "@/lib/api";
import { useUIStore } from "@/store/useUIStore";
import RecipeBuilder from "@/components/RecipeBuilder";

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
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  barcode?: string | null;
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
  const { selectedDate } = useDateStore();

  const [activeTab, setActiveTab] = useState<TabType>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodResult | null>(null);
  const [servingGrams, setServingGrams] = useState(100);
  const [isLogging, setIsLogging] = useState(false);

  // Barcode state
  const [barcodeValue, setBarcodeValue] = useState("");
  const [cameraAvailable, setCameraAvailable] = useState(true);
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeNotFound, setBarcodeNotFound] = useState(false);
  const [showRecipeBuilder, setShowRecipeBuilder] = useState(false);
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<unknown>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedFood(null);
      setServingGrams(100);
      setBarcodeValue("");
      setIsScannerActive(false);
      setBarcodeNotFound(false);
      stopScanner();
    }
  }, [isOpen]);

  // Search food catalog
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }

    setIsSearching(true);
    try {
      const res = await apiFetch(`/api/v2/nutrition/food/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data: FoodResult[] = await res.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.error("[SEARCH] Failed:", err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) return;
    const timer = setTimeout(() => handleSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // Log food to diary
  const handleLogFood = useCallback(async () => {
    if (!selectedFood) return;
    setIsLogging(true);

    try {
      const res = await apiFetch(`/api/v2/nutrition/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logged_at: new Date(`${selectedDate}T12:00:00`).toISOString().replace("Z", ""),
          meal_type: mealType,
          food_id: selectedFood.id,
          recipe_id: null,
          serving_size_g: servingGrams,
        }),
      });
      if (res.ok) { onFoodLogged(); }
    } catch (err) {
      console.error("[LOG] Failed:", err);
    } finally {
      setIsLogging(false);
    }
  }, [selectedFood, servingGrams, mealType, selectedDate, onFoodLogged]);

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

  const servingMacros = selectedFood
    ? {
        calories: Math.round(selectedFood.calories_per_100g * (servingGrams / 100)),
        protein: Math.round(selectedFood.protein_per_100g * (servingGrams / 100)),
        carbs: Math.round(selectedFood.carbs_per_100g * (servingGrams / 100)),
        fat: Math.round(selectedFood.fat_per_100g * (servingGrams / 100)),
      }
    : null;

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

          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-3">
            <h2 className="text-base font-semibold text-white">
              Add to {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
            </h2>
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
            {/* Selected Food — Serving Size Selector */}
            {selectedFood ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
                  <p className="text-sm font-medium text-white">{selectedFood.name}</p>
                  {selectedFood.brand && <p className="text-[10px] text-gray-500">{selectedFood.brand}</p>}
                  <p className="text-[10px] text-gray-600 mt-1">
                    Per 100g: {selectedFood.calories_per_100g} kcal • P:{selectedFood.protein_per_100g}g C:{selectedFood.carbs_per_100g}g F:{selectedFood.fat_per_100g}g
                  </p>
                </div>

                {/* Serving Size Slider */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-gray-400">Serving Size</label>
                    <span className="text-sm font-semibold text-white">{servingGrams}g</span>
                  </div>
                  <input type="range" min={10} max={500} step={5} value={servingGrams} onChange={(e) => setServingGrams(Number(e.target.value))} className="w-full h-2 rounded-full appearance-none bg-white/10 accent-accent-purple cursor-pointer" />
                  <div className="flex justify-between text-[10px] text-gray-600 mt-1"><span>10g</span><span>500g</span></div>
                </div>

                {/* Calculated Macros */}
                {servingMacros && (
                  <div className="grid grid-cols-4 gap-2">
                    <div className="rounded-lg bg-white/[0.03] p-2 text-center"><p className="text-xs font-bold text-white">{servingMacros.calories}</p><p className="text-[9px] text-gray-500">kcal</p></div>
                    <div className="rounded-lg bg-white/[0.03] p-2 text-center"><p className="text-xs font-bold text-accent-cyan">{servingMacros.protein}g</p><p className="text-[9px] text-gray-500">Protein</p></div>
                    <div className="rounded-lg bg-white/[0.03] p-2 text-center"><p className="text-xs font-bold text-accent-purple">{servingMacros.carbs}g</p><p className="text-[9px] text-gray-500">Carbs</p></div>
                    <div className="rounded-lg bg-white/[0.03] p-2 text-center"><p className="text-xs font-bold text-accent-indigo">{servingMacros.fat}g</p><p className="text-[9px] text-gray-500">Fat</p></div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button onClick={() => setSelectedFood(null)} className="flex-1 rounded-xl bg-white/5 border border-white/10 py-3 text-xs font-medium text-gray-400 hover:text-white transition-colors">Back</button>
                  <button onClick={handleLogFood} disabled={isLogging} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-indigo via-accent-purple to-accent-cyan py-3 text-xs font-semibold text-white disabled:opacity-50 shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                    {isLogging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5" />Log {servingGrams}g</>}
                  </button>
                </div>
              </motion.div>
            ) : activeTab === "search" ? (
              /* Search Tab */
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search foods..." autoFocus className="w-full rounded-xl bg-white/5 border border-white/10 pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple/50" />
                  {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-accent-purple animate-spin" />}
                </div>

                <div className="space-y-1.5 max-h-[40dvh] overflow-y-auto transform-gpu">
                  {searchResults.map((food) => (
                    <button key={food.id} onClick={() => setSelectedFood(food)} className="w-full flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/[0.04] px-3 py-2.5 text-left hover:bg-white/[0.05] transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{food.name}</p>
                        <p className="text-[10px] text-gray-500">{food.brand || "Generic"} • {food.calories_per_100g} kcal/100g</p>
                      </div>
                      <Plus className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    </button>
                  ))}

                  {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                    <p className="text-center text-[10px] text-gray-600 py-4">No results found for &ldquo;{searchQuery}&rdquo;</p>
                  )}
                </div>

                <button onClick={() => setShowRecipeBuilder(true)} className="w-full text-center py-3 text-[11px] font-medium text-accent-purple hover:text-accent-cyan transition-colors">
                  Can&apos;t find your food? <span className="underline">Create Custom Recipe</span>
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
                      onClick={() => setShowRecipeBuilder(true)}
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

    {/* Recipe Builder Overlay */}
    <RecipeBuilder
      isOpen={showRecipeBuilder}
      onClose={() => setShowRecipeBuilder(false)}
      onRecipeSaved={onFoodLogged}
    />
    </>
  );
}


