---
name: The Power Hour
description: Aurora glass. Frosted translucent panels floating over a slow, blurred aurora in the league's greens, yellows and sky blues; one saturated card per page.
colors:
  aurora-base: "#EEF3F0"
  aurora-sky: "#9FD3F6"
  aurora-cyan: "#A8E3EE"
  aurora-mint: "#B4E4AE"
  aurora-lime: "#DDEB95"
  aurora-sun: "#FFE48A"
  aurora-warm-1: "#FFE01A"
  aurora-warm-2: "#F9B000"
  glass-bg: "rgba(255, 255, 255, 0.46)"
  glass-bg-strong: "rgba(255, 255, 255, 0.70)"
  glass-fill: "rgba(255, 255, 255, 0.34)"
  glass-float: "rgba(250, 252, 250, 0.84)"
  glass-border: "rgba(255, 255, 255, 0.62)"
  text-primary: "#111216"
  text-secondary: "#5A5D68"
  ink-2: "#33363F"
  hero-1: "#1F7A45"
  hero-2: "#16787A"
  hero-3: "#2A6CAE"
  yellow: "#FFE01A"
  amber: "#F9B000"
  good: "#1E6B2A"
  bad: "#B3261E"
  side-a: "#0FA0E8"
  side-b: "#F9B000"
  night-base: "#0B1322"
  night-text: "#F3F5F9"
typography:
  display:
    fontFamily: "Inter, -apple-system, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(38px, 5.4vw, 64px)"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  hero:
    fontFamily: "Inter, -apple-system, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(32px, 4.4vw, 44px)"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Inter, -apple-system, Segoe UI, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  stat:
    fontFamily: "Inter, -apple-system, Segoe UI, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.025em"
    fontFeature: "'tnum' 1"
  body:
    fontFamily: "Inter, -apple-system, Segoe UI, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "'tnum' 1"
  label:
    fontFamily: "Inter, -apple-system, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.2
rounded:
  pill: "999px"
  tile: "24px"
  card: "30px"
spacing:
  xs: "8px"
  sm: "14px"
  md: "18px"
  lg: "24px"
  xl: "44px"
components:
  glass-card:
    backgroundColor: "{colors.glass-bg}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.card}"
    padding: "24px"
  hero-card:
    backgroundColor: "{colors.hero-2}"
    textColor: "#FFFFFF"
    rounded: "{rounded.card}"
    padding: "28px"
  tile:
    backgroundColor: "{colors.glass-bg}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.tile}"
    padding: "16px 18px 18px"
  icon-chip:
    backgroundColor: "rgba(255, 255, 255, 0.4)"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    size: "48px"
  button:
    backgroundColor: "{colors.glass-bg-strong}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    padding: "0 26px"
  button-selected:
    backgroundColor: "{colors.text-primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
  button-primary:
    backgroundColor: "{colors.hero-2}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
  you-tag:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
---

# Design System: The Power Hour, 4.0 aurora glass

## Overview

**Creative North Star: "Aurora Glass"** (Dan's brief, Nov 19). Airy, weightless, calm. Frosted translucent panels float over a slow, heavily blurred aurora, and the colour lives in the background, not on the surfaces. Text stays near-black and crisp. Depth comes from layering glass over colour, never from heavy shadows. Corners are generous everywhere; nothing is sharp.

The aurora is the league's own palette, not the brief's pastel pinks: sky blue, cyan, mint, lime and the first-down yellow, with one warm streak of yellow into amber sweeping in from the left edge. The mowed field, the sky bands and the chalk lines are gone.

The rules live in the last block of `styles.css` ("4.0: aurora glass"), which redefines the older layers' tokens and wins over them. The base components also stand alone (`.ag-card`, `.ag-hero`, `.ag-dial`, `.ag-chip`, `.ag-tile`, `.ag-btn`), shown on the sample page `design/aurora.html` (open it with `npm run dev`; the build doesn't ship it).

**Key characteristics**
- One saturated card per page: the headline carousel (rankings, Live), the game of the week (Games), the team value tile (the dashboard). Everything else is clear glass.
- Selected is solid ink; primary is the hero gradient; everything else is a glass pill.
- Every press shimmers: the aurora sweeps through the thing pressed.
- Yellow still means you.
- Light (the day) and dark (the night) themes, the same aurora at lower strength at night.

## Colors

### The aurora
`--aurora-base` #EEF3F0 under five radial-gradient blobs (`--aurora-sky`, `--aurora-cyan`, `--aurora-mint`, `--aurora-lime`, `--aurora-sun`) and the warm ribbon (`--aurora-warm-1` → `--aurora-warm-2`). Drawn on the old `.sky` box (its three spans and their pseudo-elements are the blobs): radial gradients, already soft, so nothing is re-blurred while they drift. Each drifts on a 28–40 s loop, transform only, and stands still under reduced motion. Night: base #0B1322, blobs at 42%.

### Glass
- `--glass-bg` 46% white: cards, the header, the dock, section signs.
- `--glass-bg-strong` 70%: controls, chips, inputs.
- `--glass-fill` 34%: a panel inside a card (a hair whiter, never blurred again).
- `--glass-float` 84%: whatever floats over the page (sheets, the circle's panel, notes, overlay cards), so its words never sit over busy cards.
- `--glass-border` (62% white hairline, drawn as an inset shadow, so it costs no layout) and `--glass-hi` (a 1px bright inner top edge).
- `--glass-blur`: `blur(24px) saturate(160%)`. Without `backdrop-filter`, glass falls back to `--glass-solid` (86% white).
- Night: glass at 8% / 14% / 6% white, borders 14%.

### The living silk (4.1)
Since Nov 19 the aurora is a live WebGL silk (`src/silk.js`, `initSilk()` from `main()`): one sheet of colour folding over itself with a sheen along the folds and the warm streak, drawn at about 40% of the screen's resolution behind everything, at most 30 fps on phones and 45 elsewhere. It has a mood per page, all in the league's colours: Rankings green and gold, Live hot yellow and amber (and faster while games are on), Wire cool cyan and mint drifting sideways, Games sky blue folding into amber (the two sides of a matchup), the Lab mint, lime and cyan. A tab change crossfades the mood over about a second and a half and sends a surge through the silk on the pill's beat. The mouse leans on it, scrolling slides it slowly. It pauses when the tab is hidden, the page is locked or the desk is open; reduced motion and Save-Data draw one still frame per mood; without WebGL the CSS blobs above stay. Night: the same silk at a third of its strength on navy.

### The hero
`--hero-grad`: deep grass #1F7A45 → teal #16787A → deep sky #2A6CAE, with `--hero-ribbon` (soft light through it) and `--hero-dial` (two translucent rings and a ring of ticks, drawn behind the type). White type clears 4.5:1 across the whole gradient. Glass pills on it are 18% white with a white hairline and white words.

### Text
`--text-primary` #111216 (`--ink`), `--ink-2` #33363F, `--text-secondary` #5A5D68 (`--ink-3`). Never light grey on glass: over a bright blob, glass gets whiter, text never gets lighter. Night: #F3F5F9, #D4D8E1, #B7BCC8.

### Signals (kept)
- **Yellow means you.** The 3px ring on your card, the You tag, your row, your arc on a playoff ring.
- Matchup sides stay blue (`--a`) and amber (`--b`), as tints of glass on the face-off.
- Good / bad stay green / red, with tinted glass chips (`--good-bg`, `--bad-bg`).

## Typography
One face: **Inter** (variable, 400–700, roman and italic, self-hosted in `assets/fonts`, SIL OFL; the Latin file is preloaded). Headings 500–600 with -0.02em tracking (page titles -0.035em), big stats 26–32px at 600, body and labels 15–17px at 400–500, tabular numbers everywhere. Nothing under 11.5px. The headline desk keeps its newspaper faces.

## Layout
`--page` is 16px gutters on phones, at most 1180px wide. The header is a floating glass pill 14px from the top (desktop); phones have the dock and the circle at the foot. Everything stays usable at 390, 360 and 320px with no page-level sideways scroll.

## Elevation
No slabs, ledges or hard offset shadows: every `--slab*`, `--ledge*` and `--cast` token is transparent or faint. A card is glass + hairline + bright top edge + `--shadow-soft` (0 8px 32px at 9%). Featured cards and hover use `--shadow-lift`. Only the hero card carries a coloured shadow, under itself.

**Glass rule.** At most one blurred layer under any word: cards blur, panels inside them don't, and floating overlays use `--glass-float`.

## Components

### Buttons
Glass pills (`--glass-bg-strong`, hairline, top edge). Hover lifts 1px and the hairline brightens with a faint sky glow. Press: `scale(0.97)`, released on `--ease-spring` (the overshoot is the brief's, the only one outside the dashboard). Selected (pressed filter, picked team, the Lab's section): solid ink with white words (inverted at night). Primary (the call to action, the scenario invite, Share, Playoff scenarios): the hero gradient with white words. Disabled: a fainter glass fill, muted words, `not-allowed`.

### The shimmer
`src/touch.js` `initPress`: one lens on `<body>` takes the shape of whatever is pressed (mouse, finger or pen), and on each press an iridescent sweep (`--iris`: yellow, lime, mint, cyan, sky, gold) brightens and slides across in 0.7 s, a diagonal sheen crosses in 0.6 s, and a bloom grows from the pointer. Multiplied over glass so dark words stay crisp; screened over dark or saturated fills (picked from the pressed element's text colour). No control's own `::before`/`::after` is touched. Off under reduced motion.

### Navigation
Desktop: tabs with their icons in the glass header. Phones: the dock is a glass pill bar of round glass buttons; the tab you're on widens into a pill with its label (in a live week, six tabs, the labels drop). The active tab is lit all the way across (4.1): `--tab-glow`, a warm light from yellow into amber with a bright top edge, and `--tab-halo`, a soft amber glow around it; its words are dark ink in both themes.

**The glide.** A tab change stretches the pill: its leading edge sets off at once and the trailing edge catches up (`worm` in `app.js`, 560 ms), so it reaches toward the new tab and gathers itself there. On phones the dock's tabs slide to their new places on the same clock (a FLIP) and the new label fades in a beat behind. On desktop the page change is a view transition, so the same keyframes drive the transition's own pill (`::view-transition-group(tab-ink)`, drawn as real CSS and multiplied over the header so the names show through). Interrupted mid-glide, it starts from where it is. Reduced motion snaps.

### Cards and tiles
Cards 30px, tiles and nested panels 24px, controls and tags full pills, faces circles. Icon chips are 48px glass circles with solid 20px glyphs.

### Rank numbers
Big soft numerals in ink beside each ranking card, 600 weight, a white halo; the top three larger on a glowing yellow orb. The rank-1 chalk ring and the field are gone.

### Charts
Plates are faint glass with a white hairline; bars are flat and rounded (no gloss strip or ledge); the playoff ring is a glass disc with an ink number and a green arc (yellow when it's yours).

### The team dashboard
Converted (Dan, Nov 19): the Paper Widgets shapes stay; its `--p-*` tokens point at the glass. The sheet is a clear tray, each tile a glass pane, clay became grass (`--p-accent`), violet the deep sky (`--p-hot`), apricot amber; the team value tile wears the hero gradient. Inter throughout.

### Focus
A 2px white outline offset 2px plus a soft sky glow, drawn with a `drop-shadow` filter so it never replaces a surface's own glass edge.

## Do's and Don'ts
- **Do** keep text on glass: no paragraph sits on the raw aurora (page intros sit high on the pale base; section titles are glass pills).
- **Do** give a page at most one hero card.
- **Do** use tokens: every colour literal lives in a `:root` token block.
- **Do** animate only transform and opacity (plus the shimmer's background position).
- **Don't** stack blurs: no glass inside glass inside glass.
- **Don't** bring back slabs, ledges, gloss strips or hard offset shadows.
- **Don't** colour chart labels with their series; labels wear ink.
- **Don't** use emoji or ALL-CAPS labels; sentence case, plain verbs.
- The headline desk (`#admin`) keeps its newspaper look; none of this reaches it.
