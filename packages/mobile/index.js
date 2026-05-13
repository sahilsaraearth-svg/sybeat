import { Platform } from "react-native";
import "expo-router/entry";

// RNTP registerPlaybackService must be called at module level, before React mounts.
// Doing it here (top-level, outside any component) is the correct pattern per RNTP docs.
if (Platform.OS !== "web") {
  try {
    const TrackPlayer = require("react-native-track-player").default;
    const { PlaybackService } = require("./service");
    TrackPlayer.registerPlaybackService(() => PlaybackService);
  } catch (e) {
    console.warn("[RNTP] registerPlaybackService failed:", e?.message);
  }
}
