"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Mic,
  MicOff,
  Camera,
  Send,
  Loader2,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { useDateStore } from "@/store/useDateStore";
import { useCacheStore } from "@/store/useCacheStore";
import { getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useUIStore } from "@/store/useUIStore";
import { useSWR } from "@/hooks/useSWR";
import AudioWaveform from "@/components/AudioWaveform";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

/**
 * OmnibarModal — Full-screen glassmorphic AI capture overlay.
 *
 * Multimodal interfaces:
 * A) Conversational chat history with auto-scroll
 * B) Manual text input with send button
 * C) Voice capture with hold-to-record and live waveform
 *
 * Submits to POST /api/v2/ai/capture with FormData (text or audio file).
 */

interface NutritionPayload {
  meal_type: string;
  items: Array<{ name: string; serving_size_g: number; calories: number; protein: number; carbs: number; fat: number }>;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
}

interface TrainingPayload {
  session_name: string;
  exercises: Array<{ name: string; category: string; sets: Array<{ set_number: number; weight_kg: number | null; reps: number | null; rpe: number | null }> }>;
  total_sets: number;
  total_volume_kg: number | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  type?: "nutrition" | "training";
  payload?: NutritionPayload | TrainingPayload;
}

interface OmnibarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HistoryMessage {
  id: string;
  role: string;
  content: string;
  created_at: string | null;
}

interface HistoryResponse {
  conversation_id: string;
  messages: HistoryMessage[];
}

function getSupportedMimeType(): { mimeType: string; extension: string } {
  const types = [
    { mimeType: "audio/webm;codecs=opus", extension: "webm" },
    { mimeType: "audio/webm", extension: "webm" },
    { mimeType: "audio/mp4", extension: "mp4" },
    { mimeType: "audio/ogg;codecs=opus", extension: "ogg" },
    { mimeType: "audio/wav", extension: "wav" },
  ];

  for (const t of types) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t.mimeType)) {
      return t;
    }
  }

  return { mimeType: "audio/webm", extension: "webm" };
}

function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export default function OmnibarModal({ isOpen, onClose }: OmnibarModalProps) {
  const storeToken = useUserStore((s) => s.accessToken);
  const accessToken = storeToken || getAccessToken();
  const { selectedDate } = useDateStore();

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [textInput, setTextInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [micPermission, setMicPermission] = useState<"granted" | "denied" | "prompt">("prompt");
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const textInputRef = useRef<HTMLInputElement>(null);

  // Camera/photo capture state
  const fileInputRef = useRef<HTMLInputElement>(null);

  // SWR History Hydration — fetch chat history on modal mount
  const { data: historyData, isLoading: historyLoading } = useSWR<HistoryResponse>(
    "/api/v2/ai/history"
  );

  // Hydrate local messages state from history data (once loaded, only if messages are empty)
  const historyHydratedRef = useRef(false);
  useEffect(() => {
    if (!historyData || historyHydratedRef.current) return;
    if (historyData.messages && historyData.messages.length > 0) {
      const hydrated: ChatMessage[] = historyData.messages.map((msg) => {
        // Attempt to parse structured JSON payload from content
        let parsedType: "nutrition" | "training" | undefined;
        let parsedPayload: NutritionPayload | TrainingPayload | undefined;

        if (msg.role === "assistant") {
          try {
            const parsed = JSON.parse(msg.content);
            if (parsed && parsed.type && parsed.payload) {
              parsedType = parsed.type as "nutrition" | "training";
              parsedPayload = parsed.payload;
            }
          } catch {
            // Content is plain text, not JSON — that's fine
          }
        }

        return {
          id: msg.id,
          role: msg.role as "user" | "assistant",
          content: parsedType && parsedPayload
            ? (JSON.parse(msg.content).summary_text || msg.content)
            : msg.content,
          timestamp: msg.created_at
            ? new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "",
          type: parsedType,
          payload: parsedPayload,
        };
      });
      setMessages(hydrated);
      historyHydratedRef.current = true;
    }
  }, [historyData]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Check mic permission on mount
  useEffect(() => {
    if (!isOpen) return;
    if (typeof navigator === "undefined" || !navigator.permissions) return;

    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((result) => {
        setMicPermission(result.state as "granted" | "denied" | "prompt");
        result.onchange = () => {
          setMicPermission(result.state as "granted" | "denied" | "prompt");
        };
      })
      .catch(() => {
        // Permissions API not supported — will check on first use
      });
  }, [isOpen]);

  // Cleanup media stream on close
  useEffect(() => {
    if (!isOpen && mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
      setIsRecording(false);
    }
    // Reset hydration flag when modal closes so history re-fetches on next open
    if (!isOpen) {
      historyHydratedRef.current = false;
    }
  }, [isOpen, mediaStream]);

  // Submit to AI capture endpoint with strict 15-second timeout
  const submitCapture = useCallback(
    async (audioBlob?: Blob, textQuery?: string) => {
      if (!accessToken) return;
      setIsProcessing(true);

      const userContent = textQuery || "[Voice input]";
      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: userContent,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const formData = new FormData();
        formData.append(
          "timezone",
          Intl.DateTimeFormat().resolvedOptions().timeZone
        );

        if (audioBlob) {
          const { extension } = getSupportedMimeType();
          formData.append("file", audioBlob, `audio.${extension}`);
        } else if (textQuery) {
          formData.append("text", textQuery);
        }

        // Strict 30-second timeout via AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const res = await apiFetch(`/api/v2/ai/capture`, {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();

          // Build rich assistant response with structured payload
          const assistantMsg: ChatMessage = {
            id: generateId(),
            role: "assistant",
            content: data.summary_text || "Logged successfully.",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            type: data.type as "nutrition" | "training" | undefined,
            payload: data.payload,
          };
          setMessages((prev) => [...prev, assistantMsg]);

          // Instant cache invalidation — silently refetch diary and summary
          const { setCache } = useCacheStore.getState();
          // Invalidate diary cache
          apiFetch(`/api/v2/nutrition/diary?target_date=${selectedDate}`)
            .then(r => r.ok ? r.json() : null).then(d => {
              if (d) setCache(`/api/v2/nutrition/diary_${selectedDate}`, d);
            }).catch(() => {});
          // Invalidate nutrition summary cache
          apiFetch(`/api/v2/nutrition/summary/${selectedDate}`)
            .then(r => r.ok ? r.json() : null).then(d => {
              if (d) setCache(`/api/v2/nutrition/summary/${selectedDate}`, d);
            }).catch(() => {});
        } else {
          const errData = await res.json().catch(() => ({}));
          const assistantMsg: ChatMessage = {
            id: generateId(),
            role: "assistant",
            content: `Sorry, I couldn't process that. ${errData.detail || "Please try again."}`,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          };
          setMessages((prev) => [...prev, assistantMsg]);
        }
      } catch (err) {
        console.error("[OMNIBAR] Capture failed:", err);

        // Determine if it was a timeout or a network error
        const isTimeout = err instanceof DOMException && err.name === "AbortError";
        const errorContent = isTimeout
          ? "AI processing timed out (30s). Please verify your BYOK key or try again."
          : "AI processing failed. Please verify your BYOK key or try again.";

        const assistantMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: errorContent,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } finally {
        setIsProcessing(false);
      }
    },
    [accessToken, selectedDate]
  );

  // Handle image/photo capture from camera
  const handleImageCapture = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !accessToken) return;

      setIsProcessing(true);

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: "📷 Photo captured",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const formData = new FormData();
        formData.append("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
        formData.append("file", file, file.name);

        const res = await apiFetch(`/api/v2/ai/capture`, {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          let responseText = "";
          if (data.entry_type === "nutrition") {
            responseText = `Logged ${data.items_logged} food item${data.items_logged > 1 ? "s" : ""} from photo.`;
          } else if (data.entry_type === "workout") {
            responseText = `Logged ${data.exercises_logged} exercise${data.exercises_logged > 1 ? "s" : ""} from photo.`;
          } else {
            responseText = "Photo processed successfully.";
          }

          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              role: "assistant",
              content: responseText,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);

          // Trigger diary re-fetch
          useDateStore.getState().setDate(selectedDate);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              role: "assistant",
              content: "Could not process the photo. Please try again.",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: "assistant",
            content: "Network error while uploading photo.",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      } finally {
        setIsProcessing(false);
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [accessToken, selectedDate]
  );

  // Handle text send
  const handleTextSend = useCallback(() => {
    const text = textInput.trim();
    if (!text || isProcessing) return;
    setTextInput("");
    submitCapture(undefined, text);
  }, [textInput, isProcessing, submitCapture]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleTextSend();
      }
    },
    [handleTextSend]
  );

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      setMediaStream(stream);
      setMicPermission("granted");
      setIsRecording(true);

      const { mimeType } = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const { mimeType: mt } = getSupportedMimeType();
        const blob = new Blob(chunksRef.current, { type: mt });
        chunksRef.current = [];

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
        setMediaStream(null);
        setIsRecording(false);

        // Submit if we have audio data
        if (blob.size > 0) {
          submitCapture(blob);
        }
      };

      recorder.start(100); // Collect data every 100ms

      // Haptic feedback
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(30);
      }
    } catch (err) {
      console.error("[OMNIBAR] Microphone access denied:", err);
      setMicPermission("denied");
      setIsRecording(false);

      // Focus text input as fallback
      if (textInputRef.current) {
        textInputRef.current.focus();
      }
    }
  }, [submitCapture]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    // Haptic feedback
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(15);
    }
  }, []);

  const { setModalOpen } = useUIStore();
  useEffect(() => { setModalOpen(isOpen); return () => { setModalOpen(false); }; }, [isOpen, setModalOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[80] backdrop-blur-2xl bg-black/80 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg ai-glow flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-medium text-white">Kayan AI</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 transform-gpu">
          {historyLoading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="h-10 w-10 rounded-full ai-glow animate-pulse flex items-center justify-center mb-3">
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              </div>
              <p className="text-xs text-gray-500">Loading conversation...</p>
            </div>
          )}

          {messages.length === 0 && !historyLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 20px rgba(99,102,241,0.3)",
                    "0 0 40px rgba(168,85,247,0.4)",
                    "0 0 20px rgba(6,182,212,0.3)",
                    "0 0 20px rgba(99,102,241,0.3)",
                  ],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="h-16 w-16 rounded-full ai-glow flex items-center justify-center mb-4"
              >
                <Sparkles className="h-7 w-7 text-white" />
              </motion.div>
              <p className="text-sm text-gray-400">
                Log anything — a meal, a workout, a weigh-in.
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Voice, text, or photo. Your call.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full ai-glow flex items-center justify-center mr-2 mt-0.5">
                  <Sparkles className="h-3 w-3 text-white" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  msg.role === "user"
                    ? "bg-white/[0.06] border border-white/[0.08]"
                    : msg.content.includes("failed") || msg.content.includes("timed out") || msg.content.includes("error")
                      ? "bg-status-rose/10 border border-status-rose/20"
                      : "bg-accent-purple/10 border border-accent-purple/20"
                }`}
              >
                <p className={`text-sm leading-relaxed ${
                  msg.role === "assistant" && (msg.content.includes("failed") || msg.content.includes("timed out") || msg.content.includes("error"))
                    ? "text-status-rose/90"
                    : "text-gray-200"
                }`}>
                  {msg.content}
                </p>

                {/* Rich Nutrition Card */}
                {msg.type === "nutrition" && msg.payload && (
                  <div className="mt-2 space-y-1.5 pt-2 border-t border-white/5">
                    {(msg.payload as NutritionPayload).items.map((item, idx) => (
                      <div key={idx} className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-medium text-white">{item.name}</span>
                          <span className="text-[9px] text-gray-500">{item.serving_size_g}g • {item.calories} kcal</span>
                        </div>
                        <div className="flex gap-1.5 mt-1">
                          <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full bg-accent-cyan" style={{ width: `${Math.min((item.protein / Math.max(item.calories / 4, 1)) * 100, 100)}%` }} />
                          </div>
                          <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full bg-accent-purple" style={{ width: `${Math.min((item.carbs / Math.max(item.calories / 4, 1)) * 100, 100)}%` }} />
                          </div>
                          <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full bg-accent-indigo" style={{ width: `${Math.min((item.fat / Math.max(item.calories / 9, 1)) * 100, 100)}%` }} />
                          </div>
                        </div>
                        <div className="flex justify-between mt-0.5 text-[8px] text-gray-600">
                          <span>P:{item.protein}g</span>
                          <span>C:{item.carbs}g</span>
                          <span>F:{item.fat}g</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Rich Training Card */}
                {msg.type === "training" && msg.payload && (
                  <div className="mt-2 space-y-1.5 pt-2 border-t border-white/5">
                    <p className="text-[9px] text-gray-500 font-medium uppercase tracking-wider">
                      {(msg.payload as TrainingPayload).session_name}
                    </p>
                    {(msg.payload as TrainingPayload).exercises.map((ex, idx) => (
                      <div key={idx} className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                        <span className="text-[10px] font-medium text-white">{ex.name}</span>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {ex.sets.map((s, si) => (
                            <span key={si} className="text-[8px] text-gray-400 bg-white/5 rounded px-1.5 py-0.5">
                              {s.weight_kg}kg×{s.reps}{s.rpe ? ` @${s.rpe}` : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {(msg.payload as TrainingPayload).total_volume_kg != null && (
                      <p className="text-[9px] text-accent-purple font-medium">
                        Total: {(msg.payload as TrainingPayload).total_volume_kg}kg volume
                      </p>
                    )}
                  </div>
                )}

                <span className="text-[9px] text-gray-600 mt-1 block text-right">
                  {msg.timestamp}
                </span>
              </div>
            </motion.div>
          ))}

          {isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2"
            >
              <motion.div
                className="w-7 h-7 rounded-full ai-glow flex items-center justify-center flex-shrink-0"
                animate={{ boxShadow: ["0 0 10px rgba(168,85,247,0.3)", "0 0 20px rgba(99,102,241,0.5)", "0 0 10px rgba(168,85,247,0.3)"] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <Sparkles className="h-3 w-3 text-white" />
              </motion.div>
              <div className="bg-accent-purple/10 border border-accent-purple/20 rounded-2xl px-4 py-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 text-accent-purple animate-spin" />
                  <span className="text-xs text-gray-300">Kayan AI is analyzing...</span>
                </div>
                <div className="flex gap-1">
                  <motion.div className="w-8 h-1.5 rounded-full bg-white/10" animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0 }} />
                  <motion.div className="w-12 h-1.5 rounded-full bg-white/10" animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }} />
                  <motion.div className="w-6 h-1.5 rounded-full bg-white/10" animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.4 }} />
                </div>
              </div>
            </motion.div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Audio Waveform (visible during recording) */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-5 pb-2"
            >
              <AudioWaveform stream={mediaStream} isRecording={isRecording} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Controls */}
        <div className="px-5 pb-6 pt-3 border-t border-white/5">
          {/* Mic Permission Denied Warning */}
          {micPermission === "denied" && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-status-amber/10 border border-status-amber/20">
              <AlertCircle className="h-3.5 w-3.5 text-status-amber flex-shrink-0" />
              <span className="text-[10px] text-status-amber">
                Microphone access denied. Use text input instead.
              </span>
            </div>
          )}

          <div className="flex items-center gap-3">
            {/* Hidden file input for camera/photo capture */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleImageCapture}
            />

            {/* Camera Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing || isRecording}
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50 active:scale-95"
              aria-label="Capture photo"
            >
              <Camera className="h-4.5 w-4.5" />
            </button>

            {/* Text Input */}
            <div className="flex-1 relative">
              <input
                ref={textInputRef}
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isRecording
                    ? "Recording..."
                    : "I ate 2 eggs and toast for breakfast..."
                }
                disabled={isRecording || isProcessing}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 pr-10 text-sm text-white placeholder-gray-600 outline-none transition-all focus:border-accent-purple focus:ring-1 focus:ring-accent-purple/50 disabled:opacity-50"
              />
              {textInput.trim() && !isRecording && (
                <button
                  onClick={handleTextSend}
                  disabled={isProcessing}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-accent-purple hover:bg-accent-purple/10 transition-colors disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Voice Capture Button — Press-and-Hold gesture.
                onPointerDown/Up covers both mouse and touch.
                onPointerLeave handles drag-off on desktop.
                onTouchCancel handles mobile-specific abort (e.g., notification overlay). */}
            {micPermission !== "denied" && (
              <motion.button
                onPointerDown={startRecording}
                onPointerUp={stopRecording}
                onPointerLeave={isRecording ? stopRecording : undefined}
                onTouchCancel={isRecording ? stopRecording : undefined}
                whileTap={{ scale: 0.9 }}
                disabled={isProcessing}
                className={`
                  relative flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center
                  transition-all duration-200 disabled:opacity-50 select-none touch-none
                  ${
                    isRecording
                      ? "bg-status-rose/20 border-2 border-status-rose shadow-[0_0_20px_rgba(225,29,72,0.4)]"
                      : "bg-gradient-to-br from-accent-indigo via-accent-purple to-accent-cyan shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                  }
                `}
              >
                {isRecording ? (
                  <MicOff className="h-5 w-5 text-status-rose" />
                ) : (
                  <Mic className="h-5 w-5 text-white" />
                )}

                {/* Pulsing ring when recording */}
                {isRecording && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-status-rose"
                    animate={{
                      scale: [1, 1.4, 1],
                      opacity: [0.6, 0, 0.6],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                )}

                {/* Idle pulsing glow */}
                {!isRecording && !isProcessing && (
                  <motion.div
                    className="absolute inset-0 rounded-full bg-gradient-to-br from-accent-indigo via-accent-purple to-accent-cyan opacity-40"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.4, 0.1, 0.4],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                )}
              </motion.button>
            )}
          </div>

          {/* Recording hint */}
          {!isRecording && micPermission !== "denied" && (
            <p className="text-[9px] text-gray-600 text-center mt-2">
              Hold mic button to record • Release to send
            </p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
