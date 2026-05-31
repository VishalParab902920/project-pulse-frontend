"use client";

import { useState, useEffect } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  PanInfo,
} from "framer-motion";
import {
  X,
  Check,
  Pencil,
  Utensils,
  Dumbbell,
  Scale,
  StickyNote,
  ExternalLink,
} from "lucide-react";
import type { ParseResponse, FoodData, WorkoutData, BiometricData } from "@/lib/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// =============================================================
// Sponsor Card Data
// =============================================================

interface SponsorCard {
  id: string;
  type: "sponsor";
  title: string;
  description: string;
  image_url: string;
  cta_link: string;
}

const SPONSOR_CARDS: SponsorCard[] = [
  {
    id: "sponsor-1",
    type: "sponsor",
    title: "Obsidian Whey Protein",
    description: "Ultra-premium isolate. 27g protein per scoop. Zero fillers. Engineered for serious athletes.",
    image_url: "https://images.unsplash.com/photo-1593095948071-474c5cc2c4d8?w=400&h=200&fit=crop",
    cta_link: "https://example.com/obsidian-whey",
  },
  {
    id: "sponsor-2",
    type: "sponsor",
    title: "Aura Sleep Ring",
    description: "Track HRV, sleep stages, and recovery score. The ring that knows when you're ready to train.",
    image_url: "https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=400&h=200&fit=crop",
    cta_link: "https://example.com/aura-ring",
  },
  {
    id: "sponsor-3",
    type: "sponsor",
    title: "Origin Gym Chalk",
    description: "Competition-grade magnesium carbonate. Maximum grip. Minimum dust. Trusted by powerlifters.",
    image_url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=200&fit=crop",
    cta_link: "https://example.com/origin-chalk",
  },
];

// Inject a sponsor card at position 3 in the queue (after the 3rd entry)
// This ensures users see it before they finish swiping through all entries.
function injectSponsorCards(entries: ParseResponse[], showAds: boolean): (ParseResponse | SponsorCard)[] {
  if (!showAds || entries.length === 0) return entries;

  const result: (ParseResponse | SponsorCard)[] = [...entries];

  // Insert sponsor at index 3 (after 3rd card) if we have enough entries
  if (result.length >= 3) {
    result.splice(3, 0, SPONSOR_CARDS[0]);
  } else {
    // If fewer than 3 entries, put sponsor at the end
    result.push(SPONSOR_CARDS[0]);
  }

  // Insert second sponsor at index 8 if enough entries
  if (result.length >= 9) {
    result.splice(8, 0, SPONSOR_CARDS[1]);
  }

  return result;
}

// =============================================================
// Types & Helpers
// =============================================================

type QueueCard = ParseResponse | SponsorCard;

function isSponsor(card: QueueCard): card is SponsorCard {
  return "type" in card && card.type === "sponsor";
}

interface ReviewQueueProps {
  isOpen: boolean;
  onClose: () => void;
  entries: ParseResponse[];
  onConfirm: (entryId: string) => void;
  onUpdate: (entryId: string, parsedData: Record<string, unknown>) => void;
  subscriptionTier?: string;
}

function getEntryIcon(type: string) {
  switch (type) {
    case "food":
      return <Utensils className="h-4 w-4 text-status-success" />;
    case "workout":
      return <Dumbbell className="h-4 w-4 text-accent-indigo" />;
    case "biometric":
      return <Scale className="h-4 w-4 text-accent-cyan" />;
    default:
      return <StickyNote className="h-4 w-4 text-gray-400" />;
  }
}

function getEntryTitle(entry: ParseResponse): string {
  if (entry.type === "food") {
    const data = entry.parsed_data as FoodData;
    return data.items.map((i) => i.name).join(", ");
  }
  if (entry.type === "workout") {
    return (entry.parsed_data as WorkoutData).exercise_name;
  }
  if (entry.type === "biometric") {
    const data = entry.parsed_data as BiometricData;
    return data.metric_type.replace("_", " ");
  }
  return "Note";
}

function CardDetails({ entry }: { entry: ParseResponse }) {
  if (entry.type === "food") {
    const data = entry.parsed_data as FoodData;
    return (
      <div className="grid grid-cols-4 gap-3 mt-4">
        <div className="text-center">
          <p className="text-lg font-bold text-white">{data.total_macros_calculated.kcal}</p>
          <p className="text-[10px] text-gray-500 uppercase">Cals</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-accent-indigo">{data.total_macros_calculated.p}g</p>
          <p className="text-[10px] text-gray-500 uppercase">Protein</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-accent-cyan">{data.total_macros_calculated.c}g</p>
          <p className="text-[10px] text-gray-500 uppercase">Carbs</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-status-rose">{data.total_macros_calculated.f}g</p>
          <p className="text-[10px] text-gray-500 uppercase">Fats</p>
        </div>
      </div>
    );
  }

  if (entry.type === "workout") {
    const data = entry.parsed_data as WorkoutData;
    return (
      <div className="mt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Sets</span>
          <span className="text-white font-medium">{data.sets.length}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Total Volume</span>
          <span className="text-white font-medium">{data.total_volume.toFixed(1)} kg</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Muscle Group</span>
          <span className="text-white font-medium capitalize">{data.muscle_group}</span>
        </div>
      </div>
    );
  }

  if (entry.type === "biometric") {
    const data = entry.parsed_data as BiometricData;
    return (
      <div className="mt-4 text-center">
        <p className="text-3xl font-bold text-white">
          {data.original_value}
          <span className="text-sm text-gray-400 ml-1">{data.original_unit}</span>
        </p>
        <p className="text-xs text-gray-500 mt-1">
          ({data.canonical_value} {data.canonical_unit})
        </p>
      </div>
    );
  }

  return null;
}

// =============================================================
// Swipe Cards
// =============================================================

function SwipeCard({
  entry,
  isTop,
  stackIndex,
  onConfirm,
  onEdit,
}: {
  entry: ParseResponse;
  isTop: boolean;
  stackIndex: number;
  onConfirm: () => void;
  onEdit: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 120) onConfirm();
  };

  const scale = 1 - stackIndex * 0.05;
  const yOffset = stackIndex * 8;
  const timestamp = entry.created_at
    ? new Date(entry.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <motion.div
      className="absolute inset-0"
      style={{ zIndex: 10 - stackIndex }}
      initial={{ scale, y: yOffset, opacity: stackIndex > 2 ? 0 : 1 }}
      animate={{ scale, y: yOffset, opacity: stackIndex > 2 ? 0 : 1 }}
      exit={{ x: 400, opacity: 0, rotate: 15 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <motion.div
        className={`bg-[#111113] rounded-[24px] border border-border-glass overflow-hidden flex flex-col h-full ${!isTop ? "blur-[1px]" : ""}`}
        style={isTop ? { x, rotate, opacity } : {}}
        drag={isTop ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.8}
        onDragEnd={isTop ? handleDragEnd : undefined}
      >
        {entry.media_path && (
          <div className="relative h-40 w-full overflow-hidden">
            <img src={entry.media_path} alt="Food photo" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#111113] via-transparent to-transparent" />
            {timestamp && (
              <span className="absolute top-3 right-3 bg-black/60 backdrop-blur-md rounded-full text-[10px] px-3 py-1 text-white/80">{timestamp}</span>
            )}
          </div>
        )}

        {!entry.media_path && (
          <div className="relative px-5 pt-5 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">{getEntryIcon(entry.type)}</div>
              <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">{entry.type}</span>
            </div>
            {timestamp && <span className="bg-black/60 backdrop-blur-md rounded-full text-[10px] px-3 py-1 text-white/80">{timestamp}</span>}
          </div>
        )}

        <div className="flex-1 px-5 pb-4">
          <h3 className="text-lg font-bold text-white tracking-tight capitalize">{getEntryTitle(entry)}</h3>
          {entry.raw_input && <p className="text-xs text-gray-500 mt-1 line-clamp-1">&ldquo;{entry.raw_input}&rdquo;</p>}
          <CardDetails entry={entry} />
          {entry.confidence_score !== null && (
            <div className="mt-4 flex items-center gap-1.5">
              <div className={`h-1.5 w-1.5 rounded-full ${(entry.confidence_score ?? 0) >= 0.9 ? "bg-status-success" : (entry.confidence_score ?? 0) >= 0.6 ? "bg-status-amber" : "bg-status-rose"}`} />
              <span className="text-[10px] text-gray-600">{((entry.confidence_score ?? 0) * 100).toFixed(0)}% confidence</span>
            </div>
          )}
        </div>

        {isTop && (
          <div className="flex gap-3 px-5 pb-5">
            <button onClick={onEdit} className="flex-1 h-12 border border-white/10 hover:bg-white/5 text-gray-300 rounded-[16px] text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer">
              <Pencil className="h-4 w-4" /> Edit
            </button>
            <button onClick={onConfirm} className="flex-1 h-12 bg-status-success hover:bg-emerald-700 text-white font-semibold rounded-[16px] text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer">
              <Check className="h-4 w-4" /> Confirm
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function SponsorSwipeCard({
  card,
  isTop,
  stackIndex,
  onDismiss,
}: {
  card: SponsorCard;
  isTop: boolean;
  stackIndex: number;
  onDismiss: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 100) onDismiss();
  };

  const scale = 1 - stackIndex * 0.05;
  const yOffset = stackIndex * 8;

  return (
    <motion.div
      className="absolute inset-0"
      style={{ zIndex: 10 - stackIndex }}
      initial={{ scale, y: yOffset, opacity: stackIndex > 2 ? 0 : 1 }}
      animate={{ scale, y: yOffset, opacity: stackIndex > 2 ? 0 : 1 }}
      exit={{ x: 400, opacity: 0, rotate: 15 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <motion.div
        className={`bg-[#111113]/90 rounded-[24px] border border-white/10 shadow-glass-card overflow-hidden flex flex-col h-full ${!isTop ? "blur-[1px]" : ""}`}
        style={isTop ? { x, rotate, opacity } : {}}
        drag={isTop ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.8}
        onDragEnd={isTop ? handleDragEnd : undefined}
      >
        {/* Sponsor Image */}
        <div className="relative h-44 w-full overflow-hidden">
          <img src={card.image_url} alt={card.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111113] via-transparent to-transparent" />
          {/* Sponsor Badge */}
          <span className="absolute top-3 right-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-[9px] px-2.5 py-0.5 text-white/70 uppercase tracking-wider font-semibold">
            Sponsor
          </span>
        </div>

        {/* Sponsor Body */}
        <div className="flex-1 px-5 pb-4">
          <h3 className="text-lg font-bold text-white tracking-tight">{card.title}</h3>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">{card.description}</p>
        </div>

        {/* Sponsor Action Row */}
        {isTop && (
          <div className="flex gap-3 px-5 pb-5">
            <button
              onClick={onDismiss}
              className="flex-1 h-12 border border-white/10 hover:bg-white/5 text-gray-500 rounded-[16px] text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              Dismiss
            </button>
            <a
              href={card.cta_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 h-12 bg-accent-indigo hover:bg-indigo-600 text-white font-semibold rounded-[16px] text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <ExternalLink className="h-4 w-4" />
              Learn More
            </a>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// =============================================================
// Main ReviewQueue Component
// =============================================================

export default function ReviewQueue({
  isOpen,
  onClose,
  entries,
  onConfirm,
  subscriptionTier = "beta_free",
}: ReviewQueueProps) {
  const [editingEntry, setEditingEntry] = useState<ParseResponse | null>(null);
  const [localQueue, setLocalQueue] = useState<QueueCard[]>([]);

  // Initialize local queue ONCE when overlay opens with entries
  useEffect(() => {
    if (isOpen && entries.length > 0) {
      const showAds = subscriptionTier !== "pro_paid";
      const stableQueue = injectSponsorCards(entries, showAds);
      setLocalQueue(stableQueue);
    }
    if (!isOpen) {
      setLocalQueue([]);
    }
  }, [isOpen, entries, subscriptionTier]);

  // Local confirm: update backend + remove from local queue
  const handleConfirmLocal = async (cardId: string) => {
    try {
      await fetch(`${BACKEND_URL}/api/v1/entries/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      });
      onConfirm(cardId);
      setLocalQueue((prev) => prev.filter((card) => card.id !== cardId));
    } catch (error) {
      console.error("Failed to confirm entry:", error);
    }
  };

  // Dismiss sponsor: just remove from local queue (no backend call)
  const handleDismissSponsor = (sponsorId: string) => {
    setLocalQueue((prev) => prev.filter((card) => card.id !== sponsorId));
  };

  const handleConfirmAll = async () => {
    const realEntries = localQueue.filter((c) => !isSponsor(c));
    for (const entry of realEntries) {
      await handleConfirmLocal(entry.id);
    }
  };

  const realEntryCount = localQueue.filter((c) => !isSponsor(c)).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] bg-base/90 backdrop-blur-xl flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-6 pb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight text-white">Pending Reviews</h2>
              {realEntryCount > 0 && (
                <span className="bg-status-amber text-black font-bold text-[10px] h-5 px-2 rounded-full flex items-center justify-center">
                  {realEntryCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              {realEntryCount > 1 && (
                <button onClick={handleConfirmAll} className="text-xs text-white/40 hover:text-white/80 transition-colors cursor-pointer">
                  Confirm All
                </button>
              )}
              <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors cursor-pointer" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Card Stack */}
          <div className="flex-1 flex items-center justify-center px-6">
            {localQueue.length === 0 ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                <div className="w-16 h-16 rounded-full bg-status-success/20 flex items-center justify-center mx-auto mb-4">
                  <Check className="h-8 w-8 text-status-success" />
                </div>
                <p className="text-lg font-semibold text-white">All caught up</p>
                <p className="text-sm text-gray-500 mt-1">No pending entries to review</p>
              </motion.div>
            ) : (
              <div className="relative w-full max-w-sm h-[380px]">
                <AnimatePresence>
                  {localQueue.slice(0, 3).map((card, index) => {
                    if (isSponsor(card)) {
                      return (
                        <SponsorSwipeCard
                          key={card.id}
                          card={card}
                          isTop={index === 0}
                          stackIndex={index}
                          onDismiss={() => handleDismissSponsor(card.id)}
                        />
                      );
                    }
                    return (
                      <SwipeCard
                        key={card.id}
                        entry={card}
                        isTop={index === 0}
                        stackIndex={index}
                        onConfirm={() => handleConfirmLocal(card.id)}
                        onEdit={() => setEditingEntry(card)}
                      />
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Swipe hint */}
          {localQueue.length > 0 && (
            <div className="text-center pb-8">
              <p className="text-[10px] text-gray-600 tracking-wide uppercase">
                Swipe right to confirm • Tap Edit to adjust
              </p>
            </div>
          )}

          {/* Edit Modal */}
          <AnimatePresence>
            {editingEntry && (
              <EditModal
                entry={editingEntry}
                onClose={() => setEditingEntry(null)}
                onSave={async (updatedData) => {
                  try {
                    await fetch(`${BACKEND_URL}/api/v1/entries/${editingEntry.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ parsed_data: updatedData, status: "confirmed" }),
                    });
                    onConfirm(editingEntry.id);
                    setLocalQueue((prev) => prev.filter((c) => c.id !== editingEntry.id));
                    setEditingEntry(null);
                  } catch (error) {
                    console.error("Failed to update entry:", error);
                  }
                }}
              />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EditModal({
  entry,
  onClose,
  onSave,
}: {
  entry: ParseResponse;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
}) {
  const [jsonText, setJsonText] = useState(JSON.stringify(entry.parsed_data, null, 2));
  const [error, setError] = useState("");

  const handleSave = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setError("");
      onSave(parsed);
    } catch {
      setError("Invalid JSON format");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed inset-x-0 bottom-0 z-[110] bg-surface-solid border-t border-border-glass rounded-t-[24px] p-5 max-h-[70vh] overflow-y-auto"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Edit Entry</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white cursor-pointer"><X className="h-4 w-4" /></button>
      </div>
      <textarea
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
        className="w-full h-48 bg-base border border-border-glass rounded-[16px] p-4 text-xs text-gray-200 font-mono focus:outline-none focus:border-accent-indigo/50 resize-none"
      />
      {error && <p className="text-xs text-status-rose mt-2">{error}</p>}
      <div className="flex gap-3 mt-4">
        <button onClick={onClose} className="flex-1 h-10 border border-white/10 text-gray-300 rounded-[16px] text-sm cursor-pointer hover:bg-white/5 transition-colors">Cancel</button>
        <button onClick={handleSave} className="flex-1 h-10 bg-status-success text-white font-semibold rounded-[16px] text-sm cursor-pointer hover:bg-emerald-700 transition-colors">Save & Confirm</button>
      </div>
    </motion.div>
  );
}
