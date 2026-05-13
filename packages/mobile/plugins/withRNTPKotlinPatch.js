/**
 * Expo Config Plugin: Patch react-native-track-player MusicModule.kt
 * for Kotlin 2.x null-safety compatibility.
 *
 * This plugin runs during `expo prebuild` and modifies the RNTP source
 * before the Android native build starts.
 */
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const withRNTPKotlinPatch = (config) => {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const musicModulePath = path.join(
        projectRoot,
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

      if (!fs.existsSync(musicModulePath)) {
        console.warn("[withRNTPKotlinPatch] MusicModule.kt not found, skipping patch.");
        return config;
      }

      let content = fs.readFileSync(musicModulePath, "utf8");

      // Fix 1: getTrack - Bundle? null safety
      content = content.replace(
        /callback\.resolve\(Arguments\.fromBundle\(musicService\.tracks\[index\]\.originalItem\)\)/g,
        "val item = musicService.tracks[index].originalItem; callback.resolve(if (item != null) Arguments.fromBundle(item) else null)"
      );

      // Fix 2: getQueue - map with null safety
      content = content.replace(
        /callback\.resolve\(Arguments\.fromList\(musicService\.tracks\.map \{ it\.originalItem \}\)\)/g,
        "callback.resolve(Arguments.fromList(musicService.tracks.map { t -> t.originalItem?.let { Arguments.fromBundle(it) } }))"
      );

      // Fix 3: getActiveTrack - null safe (multiline)
      content = content.replace(
        /else Arguments\.fromBundle\(\s*musicService\.tracks\[musicService\.getCurrentTrackIndex\(\)\]\.originalItem\s*\)/g,
        "else musicService.tracks[musicService.getCurrentTrackIndex()].originalItem?.let { Arguments.fromBundle(it) }"
      );

      fs.writeFileSync(musicModulePath, content, "utf8");
      console.log("[withRNTPKotlinPatch] Successfully patched MusicModule.kt for Kotlin 2.x compatibility.");

      return config;
    },
  ]);
};

module.exports = withRNTPKotlinPatch;
