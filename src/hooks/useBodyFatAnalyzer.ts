import { useState, useCallback, useRef, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { calculateNavyBodyFat, sanitizeBf } from "@/lib/utils/calculators";

interface UseBodyFatAnalyzerProps {
  gender: "male" | "female" | "other" | null;
  age: number | null;
  heightCm: number;
  weightKg: number;
  isMetricHeight: boolean;
  heightFt?: string;
  heightIn?: string;
  onAnalysisSuccess?: (bfPct: number) => void;
}

export type BodyFatTab = "manual" | "ai" | "tape";

export function useBodyFatAnalyzer({
  gender,
  age,
  heightCm,
  weightKg,
  isMetricHeight,
  heightFt,
  heightIn,
  onAnalysisSuccess,
}: UseBodyFatAnalyzerProps) {
  const [activeTab, setActiveTab] = useState<BodyFatTab>("manual");
  const [resolvedBodyFatPct, setResolvedBodyFatPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Manual Tab
  const [manualBfInput, setManualBfInput] = useState<string>("");

  // Tape Tab
  const [navyWaist, setNavyWaist] = useState<number | "">("");
  const [navyNeck, setNavyNeck] = useState<number | "">("");
  const [navyHip, setNavyHip] = useState<number | "">("");
  const [tapeResult, setTapeResult] = useState<number | null>(null);
  const [tapeGlow, setTapeGlow] = useState(false);

  // AI Tab
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stagedAIFile, setStagedAIFile] = useState<File | null>(null);
  const [aiConsentChecked, setAiConsentChecked] = useState(false);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [aiResult, setAiResult] = useState<number | null>(null);
  const [aiGlow, setAiGlow] = useState(false);

  // Clear calculation/validation errors when inputs or tabs are modified
  useEffect(() => {
    setError(null);
  }, [gender, age, heightCm, weightKg, isMetricHeight, heightFt, heightIn, navyWaist, navyNeck, navyHip, manualBfInput, stagedAIFile, activeTab]);

  const handleTabSwitch = (tab: BodyFatTab) => {
    setActiveTab(tab);
    setResolvedBodyFatPct(null);
    setTapeResult(null);
    setAiResult(null);
    setAiGlow(false);
    setTapeGlow(false);
    setError(null);
  };

  const handleAnalyzeTape = useCallback(() => {
    setError(null);
    if (!gender || heightCm <= 0) return;
    if (typeof navyWaist !== "number" || typeof navyNeck !== "number") return;
    if (gender === "female" && typeof navyHip !== "number") return;

    const heightVal = isMetricHeight
      ? heightCm
      : (Number(heightFt) * 12 + Number(heightIn));

    const bf = calculateNavyBodyFat(
      gender === "other" ? "male" : gender,
      navyWaist,
      navyNeck,
      heightVal,
      typeof navyHip === "number" ? navyHip : 0,
      isMetricHeight
    );

    const sanitized = sanitizeBf(isNaN(bf) ? null : bf);
    if (sanitized === null) {
      setError("Body fat calculation failed. Please ensure your measurements (neck, waist, hip) are realistic for your height.");
      return;
    }

    setTapeResult(sanitized);
    setResolvedBodyFatPct(sanitized);
    setTapeGlow(true);
    setTimeout(() => setTapeGlow(false), 2000);
    if (onAnalysisSuccess) onAnalysisSuccess(sanitized);
  }, [gender, heightCm, navyWaist, navyNeck, navyHip, isMetricHeight, heightFt, heightIn, onAnalysisSuccess]);

  const handleAnalyzeAI = useCallback(async () => {
    if (!stagedAIFile || !aiConsentChecked || !gender || age === null) return;

    setIsAnalyzingAI(true);
    setError(null);

    try {
      const reader = new FileReader();
      const base64String: string = await new Promise((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] ?? "");
        };
        reader.onerror = () => reject(new Error("File read failed"));
        reader.readAsDataURL(stagedAIFile);
      });

      const res = await apiFetch(`/api/v2/profile/estimate-body-fat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: base64String,
          gender,
          age,
          height_cm: heightCm,
          weight_kg: weightKg,
        }),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.detail ?? "AI analysis failed");
      }

      const data = await res.json();
      const sanitized = sanitizeBf(
        typeof data.estimated_body_fat === "number" ? data.estimated_body_fat : null
      );
      if (sanitized === null) throw new Error("AI returned an invalid body fat value.");

      setAiResult(sanitized);
      setResolvedBodyFatPct(sanitized);
      setAiGlow(true);
      setTimeout(() => setAiGlow(false), 2000);
      if (onAnalysisSuccess) onAnalysisSuccess(sanitized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI body fat estimation failed.");
    } finally {
      setIsAnalyzingAI(false);
    }
  }, [stagedAIFile, aiConsentChecked, gender, age, heightCm, weightKg, onAnalysisSuccess]);

  return {
    activeTab,
    resolvedBodyFatPct,
    setResolvedBodyFatPct,
    error,
    setError,
    handleTabSwitch,
    
    // Manual
    manualBfInput,
    setManualBfInput,
    
    // Tape
    navyWaist, setNavyWaist,
    navyNeck, setNavyNeck,
    navyHip, setNavyHip,
    tapeResult, tapeGlow,
    handleAnalyzeTape,
    
    // AI
    fileInputRef,
    stagedAIFile, setStagedAIFile,
    aiConsentChecked, setAiConsentChecked,
    isAnalyzingAI,
    aiResult, aiGlow,
    handleAnalyzeAI,
  };
}
