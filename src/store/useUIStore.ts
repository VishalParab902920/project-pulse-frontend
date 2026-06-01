"use client";

import { create } from "zustand";

/**
 * Global UI State Store — Controls modal visibility and overlay states.
 */

interface UIState {
  isOmnibarOpen: boolean;
  isNavHidden: boolean;
  isModalOpen: boolean;
  openOmnibar: () => void;
  closeOmnibar: () => void;
  hideNav: () => void;
  showNav: () => void;
  setModalOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isOmnibarOpen: false,
  isNavHidden: false,
  isModalOpen: false,
  openOmnibar: () => set({ isOmnibarOpen: true }),
  closeOmnibar: () => set({ isOmnibarOpen: false }),
  hideNav: () => set({ isNavHidden: true }),
  showNav: () => set({ isNavHidden: false }),
  setModalOpen: (open: boolean) => set({ isModalOpen: open }),
}));
