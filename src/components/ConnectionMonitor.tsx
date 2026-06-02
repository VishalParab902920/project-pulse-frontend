"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff } from "lucide-react";
import { useSyncStore } from "@/store/useSyncStore";
import { useUserStore } from "@/store/useUserStore";

/**
 * ConnectionMonitor — Global network status listener and offline indicator.
 *
 * Runs at the root of the app layout to:
 * 1. Listen for window 'online'/'offline' events
 * 2. Update useSyncStore connection status
 * 3. Auto-trigger queue flush on reconnection
 * 4. Display a floating warning pill when offline
 *
 * Mount this component once in the root layout.
 */

export default function ConnectionMonitor() {
  const { isOnline, updateOnlineStatus, pendingLogs, loadQueueFromStorage } =
    useSyncStore();
  const { accessToken } = useUserStore();

  // Load persisted queue on mount
  useEffect(() => {
    loadQueueFromStorage();
  }, [loadQueueFromStorage]);

  // Register window event listeners
  useEffect(() => {
    const handleOnline = () => {
      console.log("[NETWORK] Connection restored");
      updateOnlineStatus(true, accessToken || undefined);
    };

    const handleOffline = () => {
      console.log("[NETWORK] Connection lost");
      updateOnlineStatus(false);
    };

    // Set initial state
    updateOnlineStatus(navigator.onLine, accessToken || undefined);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [updateOnlineStatus, accessToken]);

  // Auto-flush when coming back online with pending items
  useEffect(() => {
    if (isOnline && pendingLogs.length > 0 && accessToken) {
      useSyncStore.getState().flushSyncQueue(accessToken);
    }
  }, [isOnline, pendingLogs.length, accessToken]);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed top-2 left-1/2 -translate-x-1/2 z-[100]"
        >
          <div className="flex items-center gap-2 rounded-full bg-surface-glass border border-status-amber/30 backdrop-blur-xl px-4 py-2 shadow-[0_0_12px_rgba(217,119,6,0.2)]">
            <WifiOff className="h-3.5 w-3.5 text-status-amber" />
            <span className="text-[11px] font-medium text-status-amber">
              Working Offline
            </span>
            {pendingLogs.length > 0 && (
              <span className="text-[9px] text-gray-500">
                • {pendingLogs.length} pending
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
