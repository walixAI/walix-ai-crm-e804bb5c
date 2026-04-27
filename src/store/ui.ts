import { create } from "zustand";

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebar: (v: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebar: (v) => set({ sidebarCollapsed: v }),
}));