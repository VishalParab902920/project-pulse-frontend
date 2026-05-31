"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Key, Check, Loader2, ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const handleTest = async () => {
    if (!apiKey.trim()) return;
    setTesting(true);
    setStatus(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/profile/byok/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      });

      const data = await res.json();
      if (data.status === "valid") {
        setStatus({ type: "success", message: data.message });
      } else {
        setStatus({ type: "error", message: data.message });
      }
    } catch {
      setStatus({ type: "error", message: "Connection failed. Check your network." });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    setStatus(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/profile/byok`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setStatus({ type: "success", message: data.message });
        setApiKey("");
      } else {
        const err = await res.json();
        setStatus({ type: "error", message: err.detail || "Failed to save key." });
      }
    } catch {
      setStatus({ type: "error", message: "Connection failed." });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/profile/byok`, { method: "DELETE" });
      if (res.ok) {
        setStatus({ type: "info", message: "API key removed. Using system quota." });
      }
    } catch {
      setStatus({ type: "error", message: "Failed to remove key." });
    }
  };

  return (
    <main className="min-h-screen p-6 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-white">Settings</h1>
      </div>

      {/* BYOK Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 space-y-5"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full ai-glow flex items-center justify-center">
            <Key className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Bring Your Own Key</h2>
            <p className="text-[10px] text-gray-500">Use your personal Gemini API quota</p>
          </div>
        </div>

        <p className="text-xs text-gray-400 leading-relaxed">
          Enter your Google AI Studio API key. Your key is fully encrypted and stored
          securely in our database vault. Once saved, all AI operations will run on your
          personal quota.
        </p>

        {/* Key Input */}
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full bg-white/5 border border-white/10 rounded-[16px] px-4 py-3 pr-10 text-white text-sm font-mono focus:outline-none focus:border-accent-indigo/50 placeholder-gray-600"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white cursor-pointer"
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleTest}
            disabled={!apiKey.trim() || testing}
            className="flex-1 h-10 border border-white/10 hover:bg-white/5 text-gray-300 rounded-[16px] text-xs font-medium cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Test Connection
          </button>
          <button
            onClick={handleSave}
            disabled={!apiKey.trim() || saving}
            className="flex-1 h-10 bg-status-success hover:bg-emerald-700 text-white font-semibold rounded-[16px] text-xs cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Save Key
          </button>
        </div>

        {/* Remove Key */}
        <button
          onClick={handleRemove}
          className="w-full h-9 border border-status-rose/30 hover:bg-status-rose/10 text-status-rose rounded-[16px] text-xs cursor-pointer transition-colors flex items-center justify-center gap-1.5"
        >
          <Trash2 className="h-3 w-3" />
          Remove Stored Key
        </button>

        {/* Status Message */}
        {status && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`text-xs p-3 rounded-[12px] ${
              status.type === "success"
                ? "bg-status-success/10 text-status-success border border-status-success/20"
                : status.type === "error"
                  ? "bg-status-rose/10 text-status-rose border border-status-rose/20"
                  : "bg-accent-indigo/10 text-accent-indigo border border-accent-indigo/20"
            }`}
          >
            {status.message}
          </motion.div>
        )}
      </motion.div>
    </main>
  );
}
