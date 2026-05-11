# Sybeat Design System

## Brand
- **Name:** Sybeat
- **Tagline:** Feel the rhythm.
- **Vibe:** Dark, premium, high-energy — Spotify meets cyberpunk

## Colors
```
Background:       #0A0A0A  (primary bg)
Surface:          #141414  (cards, modals)
Surface Elevated: #1E1E1E  (elevated cards)
Border:           #2A2A2A  (dividers)

Accent Green:     #1DB954  (primary actions, active states)
Neon Green:       #39FF14  (highlights, glow effects)
Accent Dim:       #1AA34A  (hover/pressed states)

Text Primary:     #FFFFFF
Text Secondary:   #A3A3A3
Text Muted:       #525252

Error:            #FF4C4C
Warning:          #F59E0B
```

## Typography
- **Display:** Syne (headings, logo, large text) — bold, geometric
- **Body:** Inter (UI text, labels, descriptions)
- **Mono:** JetBrains Mono (timestamps, codes)

## Spacing Scale
- 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80

## Border Radius
- sm: 8px
- md: 12px
- lg: 16px
- xl: 24px
- full: 999px

## Glassmorphism
```
background: rgba(20, 20, 20, 0.8)
backdrop-filter: blur(20px)
border: 1px solid rgba(255,255,255,0.08)
```

## Shadows / Glow
```
Neon glow: 0 0 20px rgba(57,255,20,0.3), 0 0 40px rgba(57,255,20,0.1)
Card shadow: 0 4px 30px rgba(0,0,0,0.6)
```

## Component Patterns
- **Track cards:** 56x56 album art, track name (white/bold), artist (muted), duration right-aligned
- **Player:** Full-bleed blurred album art bg, glassmorphism controls panel, radial progress arc
- **Mini-player:** Glassmorphism pill at bottom, 48px art, title marquee, prev/play/next
- **Bottom tabs:** Icon + label, active = neon green, inactive = muted gray

## Motion
- Page transitions: slide (horizontal for drill-down, vertical for modals)
- Player open: bottom sheet spring animation
- Like/heart: scale bounce + color flash
- Progress: smooth linear interpolation
