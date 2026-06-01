"use client";

import { create } from "zustand";

/**
 * Global UI State Store — Controls modal visibility and overlay states.
 */

interface UIState {
  isOmnibarOpen: boolean;
  openOmnibar: () => void;
  closeOmnibar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isOmnibarOpen: false,
  openOmnibar: () => set({ isOmnibarOpen: true }),
  closeOmnibar: () => set({ isOmnibarOpen: false }),
}));
