"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Mic, SendHorizonal, ListChecks, X } from "lucide-react";
import { compressImage } from "@/lib/image-utils";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const MIN_AUDIO_BYTES = 4096;

interface OmnibarProps {
  onSend: (text: string) => void;
  onAudioResult: (data: unknown) => void;
  onImageResult: (data: unknown) => void;
  onReviewOpen: () => void;
  onProcessingChange?: (processing: boolean) => void;
  disabled?: boolean;
  pendingReviews?: number;
}

export default function Omnibar({
  onSend,
  onAudioResult,
  onImageResult,
  onReviewOpen,
  onProcessingChange,
  disabled = false,
  pendingReviews = 0,
}: OmnibarProps) {
  const [inputValue, setInputValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [silentToast, setSilentToast] = useState(false);
  const [attachedImage, setAttachedImage] = useState<Blob | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("");

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const onSendRef = useRef(onSend);
  const onAudioResultRef = useRef(onAudioResult);
  const onImageResultRef = useRef(onImageResult);

  useEffect(() => { onSendRef.current = onSend; }, [onSend]);
  useEffect(() => { onAudioResultRef.current = onAudioResult; }, [onAudioResult]);
  useEffect(() => { onImageResultRef.current = onImageResult; }, [onImageResult]);

  // Cleanup preview URL on unmount or change
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const hasText = inputValue.trim().length > 0;
  const hasAttachment = attachedImage !== null;
  const canSend = hasText || hasAttachment;
  const isLocked = disabled;

  // --- Submit: text-only OR photo+caption ---
  const handleSubmit = useCallback(async () => {
    if (isLocked) return;

    if (attachedImage) {
      // Photo + optional caption → send to /api/v1/parse/image
      onProcessingChange?.(true);
      try {
        const formData = new FormData();
        formData.append("file", attachedImage, "photo.jpg");
        if (inputValue.trim()) {
          formData.append("caption", inputValue.trim());
        }

        const res = await fetch(`${BACKEND_URL}/api/v1/parse/image`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: "Unknown error" }));
          throw new Error(err.detail || `HTTP ${res.status}`);
        }

        const data = await res.json();
        onImageResultRef.current(data);
      } catch (error) {
        console.error("[Omnibar] Image+caption upload error:", error);
      } finally {
        onProcessingChange?.(false);
      }

      // Reset attachment state
      setAttachedImage(null);
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl("");
      setInputValue("");
    } else if (hasText) {
      // Text-only → send to /api/v1/parse
      onSendRef.current(inputValue.trim());
      setInputValue("");
    }

    inputRef.current?.focus();
  }, [inputValue, isLocked, attachedImage, imagePreviewUrl, hasText, onProcessingChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  // --- Camera: compress and attach (don't auto-send) ---
  const handleCameraClick = () => {
    if (isLocked) return;
    fileInputRef.current?.click();
  };

  const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      const compressed = await compressImage(file, 1200, 1200, 0.8);
      setAttachedImage(compressed);
      setImagePreviewUrl(URL.createObjectURL(compressed));
      // Focus the input so user can type a caption
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (error) {
      console.error("[Omnibar] Image compression error:", error);
    }
  }, []);

  const removeAttachment = () => {
    setAttachedImage(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl("");
  };

  // --- Cloud Recording: Hold-to-speak via MediaRecorder ---
  const startRecording = useCallback(async () => {
    if (isLocked) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mimeType });

        if (blob.size < MIN_AUDIO_BYTES) {
          setSilentToast(true);
          setTimeout(() => setSilentToast(false), 3000);
          setIsRecording(false);
          return;
        }

        setIsRecording(false);
        onProcessingChange?.(true);

        try {
          const formData = new FormData();
          formData.append("file", blob, "recording.webm");

          const res = await fetch(`${BACKEND_URL}/api/v1/parse/audio`, {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: "Unknown error" }));
            throw new Error(err.detail || `HTTP ${res.status}`);
          }

          const data = await res.json();
          onAudioResultRef.current(data);
        } catch (error) {
          console.error("[Omnibar] Cloud audio error:", error);
        } finally {
          onProcessingChange?.(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("[Omnibar] Microphone access denied:", error);
    }
  }, [isLocked, onProcessingChange]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!isLocked && !canSend) startRecording();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    stopRecording();
  };

  const handlePointerLeave = () => {
    if (isRecording) stopRecording();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: isLocked ? 0.8 : 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-50"
      >
        <div className={`bg-[#111113]/80 backdrop-blur-2xl border border-white/10 rounded-full py-2 px-3 shadow-2xl flex items-center gap-2 transition-all ${isLocked ? "pointer-events-none" : ""}`}>
          {/* Camera Button */}
          <motion.button
            whileHover={isLocked ? {} : { scale: 1.1 }}
            whileTap={isLocked ? {} : { scale: 0.9 }}
            disabled={isLocked}
            onClick={handleCameraClick}
            className={`p-1.5 flex-shrink-0 transition-all ${
              isLocked
                ? "opacity-30 grayscale pointer-events-none"
                : "text-gray-400 hover:text-white cursor-pointer"
            }`}
            aria-label="Take photo"
          >
            <Camera className="h-5 w-5" />
          </motion.button>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelected}
            className="hidden"
          />

          {/* Attached Image Thumbnail */}
          <AnimatePresence>
            {hasAttachment && imagePreviewUrl && !isLocked && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="relative flex-shrink-0"
              >
                <img
                  src={imagePreviewUrl}
                  alt="Attached"
                  className="w-8 h-8 rounded-lg border border-white/10 object-cover"
                />
                <button
                  onClick={removeAttachment}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-base border border-white/20 rounded-full flex items-center justify-center cursor-pointer hover:bg-status-rose/80 transition-colors"
                >
                  <X className="h-2.5 w-2.5 text-white" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Text Input OR Thinking Waveform */}
          <div className="flex-1 min-w-0 flex items-center">
            {isLocked ? (
              <div className="flex items-center justify-center gap-1 w-full py-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1 rounded-full bg-gradient-to-t from-indigo-400 to-cyan-400"
                    animate={{ height: [8, 20 + i * 2, 8] }}
                    transition={{
                      duration: 0.8 + i * 0.15,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: i * 0.1,
                    }}
                  />
                ))}
              </div>
            ) : (
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isRecording
                    ? "Recording..."
                    : hasAttachment
                      ? "Add a caption (optional)..."
                      : "Log a meal or workout..."
                }
                disabled={isRecording}
                readOnly={isRecording}
                className={`bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none w-full ${
                  isRecording ? "italic text-accent-cyan" : ""
                }`}
              />
            )}
          </div>

          {/* Review Queue Trigger with Badge */}
          <div className={`relative flex-shrink-0 transition-all ${isLocked ? "opacity-30 grayscale pointer-events-none" : ""}`}>
            <motion.button
              whileHover={isLocked ? {} : { scale: 1.1 }}
              whileTap={isLocked ? {} : { scale: 0.9 }}
              onClick={onReviewOpen}
              disabled={isLocked}
              className="text-gray-400 hover:text-white transition-colors cursor-pointer p-1.5"
              aria-label="Review queue"
            >
              <ListChecks className="h-5 w-5" />
            </motion.button>
            {pendingReviews > 0 && (
              <span className="absolute -top-1 -right-1 bg-status-amber text-black font-bold text-[10px] h-4 w-4 rounded-full flex items-center justify-center">
                {pendingReviews}
              </span>
            )}
          </div>

          {/* Mic / Send Button */}
          <AnimatePresence mode="wait">
            {canSend && !isRecording ? (
              <motion.button
                key="send"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.2 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleSubmit}
                disabled={isLocked}
                className="bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 hover:opacity-90 shadow-lg cursor-pointer flex items-center justify-center rounded-full p-2.5 text-white flex-shrink-0 disabled:opacity-40"
                aria-label="Send message"
              >
                <SendHorizonal className="h-4 w-4" />
              </motion.button>
            ) : (
              <motion.button
                key="mic"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.2 }}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerLeave}
                onContextMenu={(e) => e.preventDefault()}
                disabled={isLocked}
                className={`flex items-center justify-center rounded-full p-2.5 text-white flex-shrink-0 cursor-pointer shadow-lg select-none transition-all ${
                  isRecording
                    ? "bg-status-rose animate-pulse ring-2 ring-status-rose/50 scale-110"
                    : "bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 hover:opacity-90"
                } ${isLocked ? "opacity-30 grayscale pointer-events-none" : ""}`}
                style={{ touchAction: "none" }}
                aria-label="Hold to speak"
              >
                <Mic className="h-4 w-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Recording indicator */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="absolute -top-8 left-1/2 -translate-x-1/2"
            >
              <div className="flex items-center gap-2 bg-status-rose/20 border border-status-rose/30 rounded-full px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-status-rose animate-pulse" />
                <span className="text-[10px] text-status-rose font-medium">
                  Hold to speak...
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Silent Toast */}
      <AnimatePresence>
        {silentToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] bg-surface-solid border border-border-glass rounded-full px-4 py-2 shadow-lg"
          >
            <span className="text-xs text-gray-300">
              Audio was silent. Please try again.
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
