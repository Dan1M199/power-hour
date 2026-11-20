---
name: The Power Hour
description: Aura. Warm frosted glass in soft morning light, near-black type in Outfit, charcoal for what's selected, one butter yellow for the accent, and one golden-hour picture card per page.
colors:
  haze-top: "#CDD3DC"
  haze-mid: "#DFDDD8"
  haze-foot: "#E6D2A8"
  sun: "#F6C978"
  glass-bg: "rgba(248, 246, 242, 0.62)"
  glass-bg-strong: "rgba(252, 250, 247, 0.84)"
  glass-fill: "rgba(255, 255, 255, 0.50)"
  glass-float: "rgba(250, 248, 244, 0.90)"
  glass-border: "rgba(255, 255, 255, 0.78)"
  ink: "#1E1D1B"
  ink-2: "#47443F"
  ink-3: "#686359"
  charcoal: "#2B2A27"
  charcoal-2: "#3B3A36"
  yellow: "#F2CF5B"
  yellow-hi: "#F8E08E"
  yellow-deep: "#E2B83A"
  butter: "#F6E5A6"
  butter-ink: "#5A4508"
  cream: "#F4F1EB"
  slate: "#6A7A90"
  good: "#3D7349"
  bad: "#B0472F"
  side-a: "#6A7A90"
  side-b: "#F2CF5B"
  night-top: "#1B1C1F"
  night-foot: "#2A2219"
  night-text: "#F3F0EA"
typography:
  display:
    fontFamily: "Outfit, -apple-system, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(34px, 4.2vw, 50px)"
    fontWeight: 400
    lineHeight: 1.04
    letterSpacing: "-0.025em"
  hero:
    fontFamily: "Outfit, -apple-system, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(25.5px, 10.5cqi, 53px)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-0.025em"
  stat:
    fontFamily: "Outfit, -apple-system, Segoe UI, system-ui, sans-serif"
    fontWeight: 300
    letterSpacing: "-0.02em"
    fontFeature: "'tnum' 1"
  name:
    fontFamily: "Outfit, -apple-system, Segoe UI, system-ui, sans-serif"
    fontWeight: 500
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Outfit, -apple-system, Segoe UI, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum' 1"
  overline:
    fontFamily: "Outfit, -apple-system, Segoe UI, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 500
    letterSpacing: "0.12em"
    textTransform: "uppercase"
rounded:
  pill: "999px"
  tile: "20px"
  card: "26px"
  hero: "28px"
components:
  glass-card:
    backgroundColor: "{colors.glass-bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
  hero-card:
    backgroundColor: "golden-hour scene (--hero-grad)"
    textColor: "#FFFFFF"
    rounded: "{rounded.hero}"
  button:
    backgroundColor: "{colors.glass-bg-strong}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
  button-selected:
    backgroundColor: "{colors.charcoal}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
  button-primary:
    backgroundColor: "{colors.charcoal}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
  button-accent:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
  chip-good-news:
    backgroundColor: "{colors.butter}"
    textColor: "{colors.butter-ink}"
    rounded: "{rounded.pill}"
---

# Design System: The Power Hour, 5.0 Aura

## Overview

**Creative North Star: "Aura"** (Dan's brief, Nov 20: a calm wellness dashboard on an iPad, "copy this, copy the colours, copy it perfectly"). Morning light through frosted glass. Almost everything is neutral: warm off-white glass, near-black warm ink, warm greys. Two things carry colour: a charcoal for what's selected and what's done, and one butter yellow for the accent (rings, today's bar, the progress fill, the pale good-news chip). One picture card per page carries the warmth: a golden-hour scene with white type.

The rules live in the last block of `styles.css` ("5.0: Aura"), which redefines the older layers' tokens and wins over them. Its constant colours are the `--au-*` tokens at its top; literals lifted out of rules are the `--au-t-<hex>` block beside them, used through `color-mix` for translucency.

**Key characteristics**
- One picture card per page: the headline carousel (rankings, Live), the game of the week (Games). The team value tile is the sheet's one charcoal card.
- Selected is a charcoal pill; the call to action is charcoal; the accent action ("Playoff scenarios") is a butter-yellow pill.
- Wide desktops (1280px and up) have the reference's left sidebar; narrower desktops keep the bar along the top; phones keep the dock.
- Yellow still means you: the ring on your card, your row's butter wash.
- Day and night themes: the night is the same room with the lights down, warm charcoal under a low amber glow.

## Colors

### The haze
`src/silk.js` draws it (WebGL, about a third of the screen's resolution, 30 fps on phones and 45 elsewhere): cool pearl blue-grey at the top of the screen (#CBD2DC), linen through the middle, sand at the foot (#E6D2A8), a wide golden sunrise glow low on the right with a peach halo, breathing slowly, three soft haze pools on minute-long paths, and a pale bloom of daylight from the top. Each page leans a little (`MOODS`): the rankings a plain morning, Live warmer and quicker, the Wire cooler, Games peach, the Lab a lilac pearl. Night (`THEMES.dark`): #1B1C1F to #2A2219, the moods dimmed to 16%, the sun at 42%. The colour at the top of the screen is read back into `--aurora-top` (the status bar). Without WebGL the CSS blobs show the same palette.

### Glass
- `--glass-bg` 62% warm white (#F8F6F2): cards, the sidebar, the dock, section signs.
- `--glass-bg-strong` 84%: controls, chips, inputs.
- `--glass-fill` 50% white: a panel inside a card, never blurred again.
- `--glass-float` 90%: anything floating over the page.
- `--glass-border` 78% white hairline (an inset shadow) and `--glass-hi` (a bright 1px top edge); `--glass-light` a faint wash down the first 120px.
- `--glass-blur`: `blur(28px) saturate(130%)`.
- Shadows are warm (`rgba(70, 58, 40, …)`), soft and low: `--shadow-soft`, `--shadow-lift`.
- Night: warm charcoal glass (#2C2A26 at 60%, #36342F at 88%), 10% white borders.

### The picture card
`--hero-grad` is one SVG (so every card can size it 100% by 100%): a warm sky from dusk umber to apricot, the sun low on the right, three dunes in amber, tan and umber with lit ridges, and scrims (darker from the left and at the foot, a touch from the top) so white type holds. Stat rows on it are dark translucent pills with a white hairline (`.cast-team`), the reference's "4.2 km" pills; small words on it carry a soft caption shadow. The glass football (4.2) still lies on the headline cards. Night: the same dunes at dusk.

### Text
`--ink` #1E1D1B, `--ink-2` #47443F, `--ink-3` #686359 (4.5:1 on the glass). Night: #F3F0EA, #D2CDC4, #A9A399.

### Signals
- **Yellow means you**: your card's 2.5px yellow ring, your row's butter wash (`--mine-bg`).
- Matchup sides: slate (`--a`, #6A7A90) and gold (`--b`, #F2CF5B), the haze's cool top and warm foot, colour-blind safe.
- Good / bad: muted sage and terracotta.
- Tiers: Team to beat on butter, then sand, pearl, and clear glass.

## Typography
One face: **Outfit** (geometric, variable 100–900, self-hosted `assets/fonts/outfit-var-latin*.woff2`, SIL OFL `OFL-Outfit.txt`, the Latin file preloaded). Page titles 400 at -0.025em, headlines on the picture card 400, big numbers light (300 to 400: the reference's "82"), names and labels 500, body 400 at 16px. The kicker and the sidebar's section labels ("Menu", "General") are the reference's small spaced capitals (11.5px, 500, 0.12–0.14em): the one deliberate exception to the house rule against tracked uppercase labels, at Dan's request to copy the reference exactly; everything else stays sentence case. Nothing under 11.5px. The headline desk keeps its newspaper faces.

## Layout
- **Sidebar (1280px and up)**: `.topbar` becomes a fixed glass panel 20px from the left, top and bottom (`--side-w` 236px), and `body` pads left to make room. Top to bottom: the logo and name, "Menu" with the tabs as 48px rows (icon and full label; the tab you're on is the charcoal pill with a yellow dot, gliding up and down: `placeInk` reads the column direction), "General" with the theme switch as a row (Night game / Day game), and your team as a golden picture card at the foot (your face, "Your team", the picker as a yellow pill). Empty you cards say "at the foot of the menu" (`.where-s`) and drop the "Start up there" sketch.
- **761–1279px**: the floating glass bar along the top, the tab you're on a charcoal pill with a yellow dot.
- **Phones**: the dock (a glass pill bar of round buttons; the tab you're on widens into the charcoal pill with its label) and the circle beside it. No sideways scroll at 390, 360 or 320px.

## Components

### Buttons
Glass pills with a hairline. Hover lifts 1px. Selected: charcoal with white words (cream with dark words at night). Primary (call to action, scenario invite, Share): charcoal. Accent ("Playoff scenarios"): a butter-yellow gradient pill with a charcoal New tag. The Lab's section switcher is the reference's Week / Month / Year segmented control.

### Charts and bars
Done in charcoal, the latest or "today" in yellow, planned as pale empty bars (the dashboard's scoring tile is the reference's Activity chart). The live list's bars: banked in charcoal, still to come in butter stripes. The playoff ring is the reference's readiness ring: a cream disc on a pale track with a butter arc (deep gold when it's yours). The tooltip is the reference's charcoal bubble.

### Rank numbers
Light (300) ink numerals beside each card; the top three on a soft butter disc.

### The team dashboard
Its `--p-*` tokens point at Aura: charcoal for done (`--p-accent`), deep gold for the leader (`--p-hot`), yellow for the sun, slate for easy games, terracotta for hard ones; the team value tile is a charcoal brokerage card (its green and orange stock colours kept).

### Focus
A 2px charcoal outline offset 2px (yellow at night).

## Do's and Don'ts
- **Do** keep colour scarce: charcoal and one yellow; everything else neutral glass.
- **Do** give a page at most one picture card.
- **Do** keep every colour literal in a `:root` token block (`node <hallmark>/scripts/sloplint.mjs styles.css --genre modern-minimal --scope app` shows 0 colour fails).
- **Do** animate only transform and opacity.
- **Don't** stack blurs: no glass inside glass inside glass.
- **Don't** bring back the turf, slabs, gloss or hard offset shadows.
- **Don't** colour chart labels with their series; labels wear ink.
- **Don't** use emoji; sentence case everywhere but the kicker and the sidebar's two labels.
- The headline desk (`#admin`) keeps its newspaper look.
