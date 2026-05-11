/**
 * iOS-style top toast — drops down, auto-dismisses
 * Usage: import { toast } from './Toast'
 *        toast.success('Saved!') / toast.error('Failed') / toast.info('...')
 * Render <ToastProvider /> once in _layout.tsx
 */
import React, { useEffect, useRef, createContext, useContext, useState, useCallback } from "react";
import {
  Animated,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle, XCircle, Info, X } from "phosphor-react-native";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

// Global ref so toast() can be called outside components
let _globalShow: ToastContextValue["show"] | null = null;

export const toast = {
  success: (msg: string, duration = 2800) => _globalShow?.(msg, "success", duration),
  error: (msg: string, duration = 3500) => _globalShow?.(msg, "error", duration),
  info: (msg: string, duration = 2800) => _globalShow?.(msg, "info", duration),
};

const COLORS = {
  success: { bg: "#052e16", border: "#16a34a", icon: "#4ade80", text: "#dcfce7" },
  error:   { bg: "#2d0a0a", border: "#dc2626", icon: "#f87171", text: "#fee2e2" },
  info:    { bg: "#0f172a", border: "#6366F1", icon: "#818cf8", text: "#e0e7ff" },
};

function ToastItem({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const c = COLORS[item.type];

  useEffect(() => {
    // Drop down
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 70, friction: 12 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    // Auto dismiss
    const timer = setTimeout(() => dismiss(), item.duration ?? 2800);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -120, duration: 280, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => onRemove(item.id));
  };

  const Icon = item.type === "success" ? CheckCircle : item.type === "error" ? XCircle : Info;

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          top: insets.top + 12,
          backgroundColor: c.bg,
          borderColor: c.border,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Icon size={20} color={c.icon} weight="fill" />
      <Text style={[styles.toastText, { color: c.text }]} numberOfLines={2}>
        {item.message}
      </Text>
      <TouchableOpacity onPress={dismiss} style={styles.closeBtn}>
        <X size={14} color={c.text} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, type: ToastType = "info", duration = 2800) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-2), { id, message, type, duration }]); // max 3
  }, []);

  useEffect(() => {
    _globalShow = show;
    return () => { _globalShow = null; };
  }, [show]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toasts.map((t) => (
        <ToastItem key={t.id} item={t} onRemove={remove} />
      ))}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  toastText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
  },
  closeBtn: {
    padding: 2,
  },
});
