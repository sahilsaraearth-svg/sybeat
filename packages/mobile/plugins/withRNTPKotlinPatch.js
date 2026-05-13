/**
 * Expo Config Plugin: Patch react-native-track-player MusicModule.kt
 * for Kotlin 2.x null-safety compatibility.
 *
 * This plugin runs during `expo prebuild` and modifies the RNTP source
 * before the Android native build starts.
 *
 * Supports monorepo setups where node_modules may live in a parent directory.
 */
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const MUSIC_MODULE_RELATIVE = path.join(
  "node_modules",
  "react-native-track-player",
  "android",
  "src",
  "main",
  "java",
  "com",
  "doublesymmetry",
  "trackplayer",
  "module",
  "MusicModule.kt"
);

function findMusicModule(projectRoot) {
  // Try candidate directories: projectRoot, monorepo roots up to 3 levels up
  const candidates = [projectRoot];
  let dir = projectRoot;
  for (let i = 0; i < 3; i++) {
    dir = path.dirname(dir);
    candidates.push(dir);
  }
  for (const candidate of candidates) {
    const fullPath = path.join(candidate, MUSIC_MODULE_RELATIVE);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

const withRNTPKotlinPatch = (config) => {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const musicModulePath = findMusicModule(projectRoot);

      if (!musicModulePath) {
        console.warn(
          `[withRNTPKotlinPatch] MusicModule.kt not found in any candidate directory from projectRoot: ${projectRoot}. Skipping patch.`
        );
        return config;
      }

      console.log(`[withRNTPKotlinPatch] Found MusicModule.kt at: ${musicModulePath}`);

      let content = fs.readFileSync(musicModulePath, "utf8");

      let patched = 0;

      // Fix 1: getTrack - Arguments.fromBundle(Bundle?) → null-safe
      const fix1From = /callback\.resolve\(Arguments\.fromBundle\(musicService\.tracks\[index\]\.originalItem\)\)/g;
      const fix1To = "callback.resolve(musicService.tracks[index].originalItem?.let { Arguments.fromBundle(it) })";
      if (fix1From.test(content)) {
        content = content.replace(fix1From, fix1To);
        console.log("[withRNTPKotlinPatch] Applied fix 1 (getTrack)");
        patched++;
      } else {
        console.log("[withRNTPKotlinPatch] Fix 1 (getTrack) - pattern not found (already patched or different version)");
      }

      // Fix 2: getQueue - map { it.originalItem } → null-safe
      const fix2From = /callback\.resolve\(Arguments\.fromList\(musicService\.tracks\.map \{ it\.originalItem \}\)\)/g;
      const fix2To = "callback.resolve(Arguments.fromList(musicService.tracks.map { it.originalItem }))";
      // Note: fix2 just needs the map to return bundles correctly. The real issue is Bundle? in fromList.
      // Actually the error was on line 548 and 588 — let's handle the actual compile errors:
      // Line 548: Arguments.fromBundle(Bundle?) 
      // Line 588: Arguments.fromBundle(Bundle?)
      // Fix 2 is actually fine as-is (map returns List<Bundle?> which fromList accepts).
      // Only fix 1 and 3 have the error. But let's still patch fix2 to be safe.
      if (fix2From.test(content)) {
        content = content.replace(fix2From, fix2To);
        console.log("[withRNTPKotlinPatch] Applied fix 2 (getQueue) - no-op safe rewrite");
        patched++;
      } else {
        console.log("[withRNTPKotlinPatch] Fix 2 (getQueue) - pattern not found (already patched or different version)");
      }

      // Fix 3: getActiveTrack - Arguments.fromBundle(Bundle?) → null-safe
      const fix3From = /else Arguments\.fromBundle\(\s*musicService\.tracks\[musicService\.getCurrentTrackIndex\(\)\]\.originalItem\s*\)/g;
      const fix3To = "else musicService.tracks[musicService.getCurrentTrackIndex()].originalItem?.let { Arguments.fromBundle(it) }";
      if (fix3From.test(content)) {
        content = content.replace(fix3From, fix3To);
        console.log("[withRNTPKotlinPatch] Applied fix 3 (getActiveTrack)");
        patched++;
      } else {
        console.log("[withRNTPKotlinPatch] Fix 3 (getActiveTrack) - pattern not found (already patched or different version)");
      }

      fs.writeFileSync(musicModulePath, content, "utf8");

      if (patched > 0) {
        console.log(`[withRNTPKotlinPatch] Successfully patched ${patched} fix(es) in MusicModule.kt for Kotlin 2.x compatibility.`);
      } else {
        console.log("[withRNTPKotlinPatch] No patches applied — file may already be patched or is a different version.");
      }

      return config;
    },
  ]);
};

module.exports = withRNTPKotlinPatch;
