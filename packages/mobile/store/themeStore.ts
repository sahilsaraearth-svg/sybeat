import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";

const THEME_KEY = "sybeat_theme";

interface ThemeState {
  isDark: boolean;
  setDark: (val: boolean) => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: true, // default dark

  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(THEME_KEY);
      if (stored !== null) {
        const isDark = stored === "dark";
        set({ isDark });
        Appearance.setColorScheme(isDark ? "dark" : "light");
      }
    } catch {}
  },

  setDark: async (val: boolean) => {
    set({ isDark: val });
    Appearance.setColorScheme(val ? "dark" : "light");
    try {
      await AsyncStorage.setItem(THEME_KEY, val ? "dark" : "light");
    } catch {}
  },
}));
