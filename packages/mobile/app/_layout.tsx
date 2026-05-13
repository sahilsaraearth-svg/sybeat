import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { useEffect } from "react";
import { initAudio } from "../lib/player";
import { Platform } from "react-native";
import { useAuthStore } from "../store/authStore";
import { ToastProvider } from "../components/Toast";
import { useRecentStore } from "../store/recentStore";
import { useSearchHistoryStore } from "../store/searchHistoryStore";
import { usePlaylistStore } from "../store/playlistStore";
import { useStatsStore } from "../store/statsStore";
import { useDownloadStore } from "../store/downloadStore";
import { useThemeStore } from "../store/themeStore";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 2 },
  },
});

function AuthGuard() {
  const { user, isInitialized, hydrate } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => { hydrate(); }, []);

  useEffect(() => {
    if (!isInitialized) return;
    const inAuth = segments[0] === "auth";
    if (!user && !inAuth) {
      router.replace("/auth");
    } else if (user && inAuth) {
      router.replace("/(tabs)");
    }
  }, [user, isInitialized, segments]);

  return null;
}

function ThemedApp() {
  const isDark = useThemeStore((s) => s.isDark);
  const bg = isDark ? "#09090B" : "#FAFAFA";

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={bg} />
      <AuthGuard />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: bg },
          animation: "fade",
        }}
      >
        <Stack.Screen name="auth" options={{ headerShown: false, animation: "fade" }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="player/[id]"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="artist/[name]"
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS !== "web") {
      import("react-native-track-player").then((mod) => {
        const TrackPlayer = mod.default ?? mod;
        TrackPlayer.registerPlaybackService(() => require("../service"));
      }).catch(() => {});
    }
    initAudio();
    useRecentStore.getState().hydrate();
    useSearchHistoryStore.getState().hydrate();
    usePlaylistStore.getState().hydrate();
    useStatsStore.getState().hydrate();
    useDownloadStore.getState().hydrate();
    useThemeStore.getState().hydrate();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ThemedApp />
        </ToastProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
