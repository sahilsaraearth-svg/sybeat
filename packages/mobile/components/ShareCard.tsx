import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { X, ShareNetwork, Download } from "phosphor-react-native";
import * as Haptics from "expo-haptics";
import type { YouTubeTrack } from "../lib/youtube";
import ViewShot, { type ViewShotRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { toast } from "./Toast";

const C = {
  bg: "#09090B",
  indigo: "#6366F1",
  indigoDark: "#4F46E5",
  text: "#FAFAFA",
  textMuted: "#A1A1AA",
  zinc800: "#27272A",
};

interface Props {
  visible: boolean;
  onClose: () => void;
  track: YouTubeTrack | null;
}

export default function ShareCard({ visible, onClose, track }: Props) {
  const viewShotRef = useRef<ViewShotRef>(null);
  const [sharing, setSharing] = useState(false);

  if (!track) return null;

  const capture = async (): Promise<string> => {
    return await (viewShotRef.current as any).capture();
  };

  const handleShare = async () => {
    if (!viewShotRef.current) return;
    try {
      setSharing(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const uri = await capture();
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: `Now Playing: ${track.title}`,
        });
      }
    } catch (e) {
      console.warn("Share failed", e);
    } finally {
      setSharing(false);
    }
  };

  const handleSave = async () => {
    if (!viewShotRef.current) return;
    try {
      setSharing(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const uri = await capture();

      // On Android 10+ no explicit permission needed for gallery saves
      const asset = await MediaLibrary.createAssetAsync(uri);
      // Try to add to a Sybeat album; fall back gracefully
      try {
        const album = await MediaLibrary.getAlbumAsync("Sybeat");
        if (album) {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        } else {
          await MediaLibrary.createAlbumAsync("Sybeat", asset, false);
        }
      } catch (_) {
        // Album ops fail on some devices — asset already saved to gallery
      }

      onClose();
      toast.success("Saved to gallery!");
    } catch (e: any) {
      console.warn("Save failed", e);
      toast.error(`Could not save: ${e?.message || String(e)}`);
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.headerTitle}>Share Track</Text>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <X size={16} color={C.text} />
            </TouchableOpacity>
          </View>

          {/* Card preview */}
          <View style={s.cardWrap}>
            <ViewShot
              ref={viewShotRef}
              options={{ format: "png", quality: 1, result: "tmpfile" }}
              style={s.card}
            >
              {/* Blurred BG */}
              <Image
                source={{ uri: track.thumbnail || "https://placehold.co/400x400/18181B/6366F1?text=♪" }}
                style={[StyleSheet.absoluteFillObject, { opacity: 0.35 }]}
                blurRadius={20}
              />
              <LinearGradient
                colors={["rgba(9,9,11,0.4)", "rgba(9,9,11,0.85)", "#09090B"]}
                style={StyleSheet.absoluteFillObject}
                locations={[0, 0.5, 1]}
              />

              {/* Album art */}
              <Image
                source={{ uri: track.thumbnail || "https://placehold.co/400x400/18181B/6366F1?text=♪" }}
                style={s.cardArt}
                resizeMode="cover"
              />

              {/* Track info */}
              <View style={s.cardInfo}>
                <Text style={s.cardTitle} numberOfLines={2}>{track.title}</Text>
                <Text style={s.cardArtist} numberOfLines={1}>{track.artist}</Text>
                {track.album ? <Text style={s.cardAlbum} numberOfLines={1}>{track.album}</Text> : null}
              </View>

              {/* Waveform decoration */}
              <View style={s.cardWave}>
                {[0.3,0.6,0.5,0.9,0.7,1,0.8,0.5,0.7,0.4,0.6,0.8,0.5,0.3,0.7,0.9,0.6,0.4,0.8,0.5].map((h, i) => (
                  <View key={i} style={[s.cardWaveBar, { height: h * 20, opacity: 0.5 + h * 0.4 }]} />
                ))}
              </View>

              {/* Branding — always inside ViewShot bounds */}
              <View style={s.cardBrand}>
                <LinearGradient colors={[C.indigo, C.indigoDark]} style={s.brandIcon}>
                  <Text style={s.brandIconText}>S</Text>
                </LinearGradient>
                <Text style={s.brandName}>sybeat</Text>
              </View>
            </ViewShot>
          </View>

          {/* Actions */}
          <View style={s.actions}>
            <TouchableOpacity style={s.actionBtn} onPress={handleSave} disabled={sharing}>
              {sharing
                ? <ActivityIndicator size="small" color={C.textMuted} />
                : <Download size={20} color={C.text} />}
              <Text style={s.actionText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, s.actionBtnPrimary]} onPress={handleShare} disabled={sharing}>
              {sharing
                ? <ActivityIndicator size="small" color="#fff" />
                : <ShareNetwork size={20} color="#fff" />}
              <Text style={[s.actionText, { color: "#fff" }]}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
  },
  // No borderRadius on the outer sheet — user wants square card
  sheet: {
    width: 320,
    backgroundColor: "#18181B",
    borderRadius: 0,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(63,63,70,0.5)",
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: "rgba(63,63,70,0.3)",
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: C.text },
  closeBtn: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: "rgba(63,63,70,0.4)", alignItems: "center", justifyContent: "center",
  },

  cardWrap: { padding: 16, alignItems: "center" },

  // ViewShot card — taller to ensure brand never clips
  card: {
    width: 280,
    height: 380,           // was 340 — increased to fit brand row
    borderRadius: 0,       // no rounded corners on capture area
    overflow: "hidden",
    backgroundColor: "#09090B",
    alignItems: "center",
    borderWidth: 0,
  },

  // Smaller art (150) to give info + wave + brand room in 380px height
  cardArt: {
    width: 150, height: 150,
    borderRadius: 14, marginTop: 24,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  cardInfo: {
    paddingHorizontal: 20, marginTop: 14, alignItems: "center", width: "100%",
  },
  cardTitle: {
    fontSize: 15, fontWeight: "800", color: C.text, textAlign: "center",
    letterSpacing: -0.3, lineHeight: 19,
  },
  cardArtist: { fontSize: 12, color: C.textMuted, marginTop: 5, textAlign: "center" },
  cardAlbum: { fontSize: 11, color: "#52525B", marginTop: 3, textAlign: "center" },

  cardWave: {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "center",
    gap: 3, marginTop: 12, height: 22,
  },
  cardWaveBar: { width: 3, borderRadius: 1.5, backgroundColor: "#6366F1" },

  cardBrand: {
    flexDirection: "row", alignItems: "center", gap: 7, marginTop: 14, marginBottom: 20,
  },
  brandIcon: {
    width: 22, height: 22, borderRadius: 7,
    alignItems: "center", justifyContent: "center",
  },
  brandIconText: { fontSize: 13, fontWeight: "900", color: "#fff" },
  brandName: { fontSize: 13, fontWeight: "800", color: C.textMuted, letterSpacing: 0.5 },

  actions: {
    flexDirection: "row", gap: 10, padding: 16,
    borderTopWidth: 1, borderTopColor: "rgba(63,63,70,0.3)",
  },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 13, borderRadius: 14,
    backgroundColor: "rgba(63,63,70,0.35)",
    borderWidth: 1, borderColor: "rgba(63,63,70,0.4)",
  },
  actionBtnPrimary: { backgroundColor: "#6366F1", borderColor: "#6366F1" },
  actionText: { fontSize: 14, fontWeight: "700", color: C.textMuted },
});
