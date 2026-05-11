/**
 * Sleep timer — auto-pause after X minutes
 */
import { create } from "zustand";

interface SleepTimerState {
  isActive: boolean;
  endTime: number | null; // epoch ms
  minutesLeft: number;
  start: (minutes: number) => void;
  cancel: () => void;
  tick: () => boolean; // returns true if should stop
}

export const useSleepTimerStore = create<SleepTimerState>((set, get) => ({
  isActive: false,
  endTime: null,
  minutesLeft: 0,

  start: (minutes) => {
    const endTime = Date.now() + minutes * 60 * 1000;
    set({ isActive: true, endTime, minutesLeft: minutes });
  },

  cancel: () => {
    set({ isActive: false, endTime: null, minutesLeft: 0 });
  },

  tick: () => {
    const { isActive, endTime } = get();
    if (!isActive || !endTime) return false;
    const msLeft = endTime - Date.now();
    if (msLeft <= 0) {
      set({ isActive: false, endTime: null, minutesLeft: 0 });
      return true; // caller should pause
    }
    set({ minutesLeft: Math.ceil(msLeft / 60000) });
    return false;
  },
}));
