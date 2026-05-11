import React, { useEffect, useRef, useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Moon, X, Timer } from "phosphor-react-native";
import { useSleepTimerStore } from "../store/sleepTimerStore";
import { togglePlayPause } from "../lib/player";
import { usePlayerStore } from "../store/playerStore";
import { toast } from "./Toast";
import { useColors } from "../lib/colors";

const OPTIONS = [5, 10, 15, 20, 30, 45, 60];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function SleepTimerSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(400)).current;
  const { isActive, minutesLeft, start, cancel } = useSleepTimerStore();
  const { isPlaying } = usePlayerStore();
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : 400,
      useNativeDriver: true,
      tension: 65, friction: 12,
    }).start();
  }, [visible]);

  // Tick interval — check if sleep timer expired
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => {
      const shouldStop = useSleepTimerStore.getState().tick();
      if (shouldStop) {
        if (usePlayerStore.getState().isPlaying) {
          togglePlayPause();
        }
        toast.info("Sleep timer ended. Paused.");
        onClose();
      }
    }, 10000); // check every 10s
    return () => clearInterval(id);
  }, [isActive]);

  const handleSelect = (mins: number) => {
    start(mins);
    toast.info(`Sleep timer set for ${mins} min`);
    onClose();
  };

  const handleCancel = () => {
    cancel();
    toast.info("Sleep timer cancelled");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <Animated.View style={[s.sheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY }] }]}>
          <View style={s.handle} />

          <View style={s.header}>
            <Moon size={20} color={C.indigo} weight="fill" />
            <Text style={s.title}>Sleep Timer</Text>
            <TouchableOpacity onPress={onClose}><X size={18} color={C.muted} /></TouchableOpacity>
          </View>

          {isActive && (
            <View style={s.activeBox}>
              <Timer size={18} color="#4ade80" weight="fill" />
              <Text style={s.activeText}>
                Active — {minutesLeft} min remaining
              </Text>
              <TouchableOpacity style={s.cancelBtn} onPress={handleCancel}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={s.subtitle}>Auto-pause after</Text>
          <View style={s.grid}>
            {OPTIONS.map((m) => (
              <TouchableOpacity
                key={m}
                style={[s.option, isActive && minutesLeft === m && s.optionActive]}
                onPress={() => handleSelect(m)}
              >
                <Text style={[s.optionText, isActive && minutesLeft === m && s.optionTextActive]}>
                  {m} min
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
    sheet: {
      backgroundColor: C.bg2,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      borderTopWidth: 1, borderColor: C.border,
      paddingTop: 8, paddingHorizontal: 20,
    },
    handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: C.zinc700, alignSelf: "center", marginBottom: 16 },
    header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
    title: { flex: 1, fontSize: 17, fontWeight: "700", color: C.text },
    subtitle: { fontSize: 13, color: C.muted, marginBottom: 12, fontWeight: "500" },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    option: {
      paddingVertical: 12, paddingHorizontal: 16,
      borderRadius: 12, borderWidth: 1, borderColor: C.border,
      backgroundColor: C.zinc800,
    },
    optionActive: { borderColor: C.indigo, backgroundColor: "rgba(99,102,241,0.15)" },
    optionText: { fontSize: 14, fontWeight: "600", color: C.muted },
    optionTextActive: { color: C.indigo },
    activeBox: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: "rgba(74,222,128,0.08)", borderRadius: 12,
      borderWidth: 1, borderColor: "rgba(74,222,128,0.2)",
      paddingVertical: 12, paddingHorizontal: 14, marginBottom: 20,
    },
    activeText: { flex: 1, fontSize: 14, color: "#4ade80", fontWeight: "600" },
    cancelBtn: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "rgba(239,68,68,0.15)" },
    cancelText: { fontSize: 13, color: "#f87171", fontWeight: "700" },
  });
}
