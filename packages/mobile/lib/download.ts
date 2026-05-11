/**
 * Download a track to device storage
 */
import { Platform } from "react-native";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FileSystem = require("expo-file-system/legacy") as typeof import("expo-file-system/legacy");
import { useDownloadStore } from "../store/downloadStore";
import { resolveAudioUrl, API_BASE } from "./player";
import { toast } from "../components/Toast";
import type { YouTubeTrack } from "./youtube";

export async function downloadTrack(track: YouTubeTrack): Promise<void> {
  if (Platform.OS === "web") {
    toast.info("Downloads not supported on web");
    return;
  }

  const store = useDownloadStore.getState();

  if (store.isDownloaded(track.videoId)) {
    toast.info("Already downloaded");
    return;
  }
  if (store.isDownloading(track.videoId)) {
    toast.info("Already downloading...");
    return;
  }

  store.setDownloading(track.videoId, true);

  try {
    const dir = (FileSystem.documentDirectory ?? "") + "sybeat_downloads/";

    // Ensure directory exists
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }

    const fileName = `${track.videoId}.m4a`;
    const localPath = dir + fileName;

    // Check if file already exists (edge case)
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) {
      store.addDownload({
        ...track,
        localPath,
        downloadedAt: Date.now(),
        fileSize: (fileInfo as any).size,
      });
      store.setDownloading(track.videoId, false);
      toast.success(`"${track.title}" downloaded`);
      return;
    }

    // Resolve URL
    let audioUrl: string;
    try {
      const resolved = await resolveAudioUrl(track.videoId);
      audioUrl = resolved.url;
    } catch {
      audioUrl = `${API_BASE}/api/stream/${track.videoId}`;
    }

    toast.info(`Downloading "${track.title}"...`);

    const downloadResumable = FileSystem.createDownloadResumable(
      audioUrl,
      localPath,
      {},
      (progress) => {
        const pct = Math.round(
          (progress.totalBytesWritten / (progress.totalBytesExpectedToWrite || 1)) * 100
        );
        console.log(`[download] ${track.title}: ${pct}%`);
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (!result || !result.uri) throw new Error("Download returned no URI");

    const finalInfo = await FileSystem.getInfoAsync(result.uri);

    store.addDownload({
      ...track,
      localPath: result.uri,
      downloadedAt: Date.now(),
      fileSize: (finalInfo as any).size ?? undefined,
    });

    toast.success(`"${track.title}" saved offline`);
  } catch (err: any) {
    console.error("[download error]", err?.message ?? err);
    toast.error(`Download failed: ${err?.message?.slice(0, 60) ?? "unknown error"}`);
  } finally {
    useDownloadStore.getState().setDownloading(track.videoId, false);
  }
}

export async function deleteDownload(videoId: string): Promise<void> {
  if (Platform.OS === "web") return;

  const store = useDownloadStore.getState();
  const localPath = store.getLocalPath(videoId);

  if (localPath) {
    try {
      const info = await FileSystem.getInfoAsync(localPath);
      if (info.exists) await FileSystem.deleteAsync(localPath, { idempotent: true });
    } catch (err) {
      console.warn("[deleteDownload]", err);
    }
  }

  store.removeDownload(videoId);
  toast.success("Removed from downloads");
}
