#!/bin/bash
# Patch react-native-track-player MusicModule.kt for Kotlin 2.x null-safety
MUSIC_MODULE="node_modules/react-native-track-player/android/src/main/java/com/doublesymmetry/trackplayer/module/MusicModule.kt"

if [ -f "$MUSIC_MODULE" ]; then
  echo "Patching RNTP MusicModule.kt for Kotlin 2.x compatibility..."
  
  # Fix getTrack: Bundle? null safety
  sed -i 's/callback\.resolve(Arguments\.fromBundle(musicService\.tracks\[index\]\.originalItem))/val item = musicService.tracks[index].originalItem; callback.resolve(if (item != null) Arguments.fromBundle(item) else null)/' "$MUSIC_MODULE"
  
  # Fix getQueue: map with null safety  
  sed -i 's/callback\.resolve(Arguments\.fromList(musicService\.tracks\.map { it\.originalItem }))/callback.resolve(Arguments.fromList(musicService.tracks.map { t -> t.originalItem?.let { Arguments.fromBundle(it) } }))/' "$MUSIC_MODULE"
  
  # Fix getActiveTrack: null safe (multiline, use python)
  python3 -c "
import re
with open('$MUSIC_MODULE', 'r') as f:
    content = f.read()

old = '''            else Arguments.fromBundle(
                musicService.tracks[musicService.getCurrentTrackIndex()].originalItem
            )'''
new = '''            else musicService.tracks[musicService.getCurrentTrackIndex()].originalItem?.let { Arguments.fromBundle(it) }'''

content = content.replace(old, new)
with open('$MUSIC_MODULE', 'w') as f:
    f.write(content)
print('Patch applied successfully')
"
else
  echo "WARNING: MusicModule.kt not found at $MUSIC_MODULE"
fi
