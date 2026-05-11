# Sybeat Feature Roadmap

## Phase 1 — Core UX Polish (do first)
- [x] Fix Save to gallery (expo-media-library)
- [ ] Top iOS-style toast system (replace all alert() calls)
- [ ] Mini player swipe-up to full player (pan gesture)
- [ ] Replay / loop single track (already has repeatMode="one", just UI)
- [ ] Shuffle with smart history (no repeat, track history stack)

## Phase 2 — Playback Features
- [ ] Sleep timer (auto-pause after X mins, countdown UI)
- [ ] Crossfade between tracks (fade out current, fade in next)
- [ ] Lock screen controls / media notification (expo-av staysActiveInBackground already set, need MediaLibrary notification)

## Phase 3 — Content & Discovery
- [ ] Search history & trending (AsyncStorage + saavn trending API)
- [ ] Recently played history (AsyncStorage, last 50 tracks)
- [ ] Artist page (tracks by artist — saavn search by artist)
- [ ] Queue reordering (drag to reorder — react-native-draggable-flatlist)

## Phase 4 — Library & Social
- [ ] Playlist create/edit/delete (local AsyncStorage playlists)
- [ ] Stats (listening time, top artists — AsyncStorage tracking)
- [ ] Download tracks for offline playback (expo-file-system, save MP3)
- [ ] Equalizer / bass boost (expo-av Audio mode settings)

## Build Order for Today
1. Toast system (used everywhere, build first)
2. Mini player swipe-up
3. Loop/repeat UI fix
4. Shuffle history
5. Sleep timer
6. Search history + recently played
7. Queue reorder
8. Playlist CRUD
9. Artist page
10. Stats page
11. Download offline
12. Crossfade
13. Lock screen (needs native build)
14. EQ (expo-av limited, basic bass/treble)
