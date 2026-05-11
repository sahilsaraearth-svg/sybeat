import { useThemeStore } from "../store/themeStore";

export const darkColors = {
  // Backgrounds
  bg: "#09090B",
  bg2: "#18181B",
  card: "#18181B",
  zinc900: "#18181B",
  zinc800: "#27272A",
  zinc700: "#3F3F46",
  zinc600: "#52525B",
  zinc500: "#71717A",
  zinc400: "#A1A1AA",
  zinc300: "#D4D4D8",
  // Brand
  indigo: "#6366F1",
  indigoDark: "#4F46E5",
  indigoDim: "rgba(99,102,241,0.14)",
  indigoBorder: "rgba(99,102,241,0.3)",
  indigoGlow: "rgba(99,102,241,0.35)",
  // Text
  text: "#FAFAFA",
  textMuted: "#A1A1AA",
  textDim: "#71717A",
  muted: "#A1A1AA",
  // UI
  border: "rgba(39,39,42,0.8)",
  glass: "rgba(24,24,27,0.6)",
  glassBorder: "rgba(63,63,70,0.5)",
  // Accent
  gold: "#F59E0B",
  goldDim: "rgba(245,158,11,0.12)",
  amber: "#F59E0B",
  rose: "#F43F5E",
  emerald: "#10B981",
  violet: "#8B5CF6",
  error: "#F43F5E",
  success: "#22C55E",
};

export const lightColors = {
  // Backgrounds
  bg: "#FAFAFA",
  bg2: "#F4F4F5",
  card: "#FFFFFF",
  zinc900: "#18181B",
  zinc800: "#E4E4E7",
  zinc700: "#D4D4D8",
  zinc600: "#A1A1AA",
  zinc500: "#71717A",
  zinc400: "#52525B",
  zinc300: "#3F3F46",
  // Brand
  indigo: "#6366F1",
  indigoDark: "#4F46E5",
  indigoDim: "rgba(99,102,241,0.12)",
  indigoBorder: "rgba(99,102,241,0.3)",
  indigoGlow: "rgba(99,102,241,0.25)",
  // Text
  text: "#09090B",
  textMuted: "#52525B",
  textDim: "#71717A",
  muted: "#71717A",
  // UI
  border: "rgba(212,212,216,0.8)",
  glass: "rgba(255,255,255,0.7)",
  glassBorder: "rgba(212,212,216,0.6)",
  // Accent
  gold: "#D97706",
  goldDim: "rgba(217,119,6,0.12)",
  amber: "#D97706",
  rose: "#E11D48",
  emerald: "#059669",
  violet: "#7C3AED",
  error: "#E11D48",
  success: "#059669",
};

export type Colors = typeof darkColors;

export function useColors(): Colors {
  const isDark = useThemeStore((s) => s.isDark);
  return isDark ? darkColors : lightColors;
}
