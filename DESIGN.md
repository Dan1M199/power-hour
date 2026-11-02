---
name: The Power Hour
description: A league sports desk staged as a day game, with cartoon glass cards on a mowed field under a flat sky.
colors:
  grass: "#4CAF50"
  grass-2: "#8BC34A"
  stripe: "#5AB34F"
  lime: "#CDDC39"
  yellow: "#FFEB3B"
  amber: "#FFC107"
  sky-1: "#81D4FA"
  sky-2: "#9EDDFB"
  sky-3: "#B3E5FC"
  turf: "#1B5E20"
  board: "#13301C"
  chalk: "#FFFFFF"
  tile: "#E8F0DF"
  tile-2: "#D6E3C9"
  line: "#D2E0C4"
  ink: "#12301A"
  ink-2: "#3C5A43"
  ink-3: "#55705A"
  good: "#28702C"
  bad: "#C62828"
  flag: "#D32F2F"
  side-a: "#29B6F6"
  side-a-ink: "#0266A3"
  side-b: "#FFC107"
  side-b-ink: "#985700"
  mine-bg: "#FFF9C4"
  ledge-gold: "#E0A100"
  header: "#EAF6FC"
typography:
  display:
    fontFamily: "Big Shoulders Display, Arial Narrow, Impact, sans-serif"
    fontSize: "clamp(48px, 8.4vw, 104px)"
    fontWeight: 900
    lineHeight: 0.86
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Big Shoulders Display, Arial Narrow, Impact, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.005em"
  title:
    fontFamily: "Big Shoulders Display, Arial Narrow, Impact, sans-serif"
    fontSize: "21px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "0.01em"
  numeral:
    fontFamily: "Big Shoulders Display, Arial Narrow, Impact, sans-serif"
    fontSize: "38px"
    fontWeight: 900
    lineHeight: 0.9
  body:
    fontFamily: "Albert Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "'tnum' 1"
  label:
    fontFamily: "Albert Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.2
rounded:
  md: "16px"
  lg: "24px"
  xl: "32px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "14px"
  md: "18px"
  lg: "24px"
  xl: "44px"
components:
  card:
    backgroundColor: "rgba(255, 255, 255, 0.96)"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "18px"
  card-featured:
    backgroundColor: "rgba(255, 255, 255, 0.96)"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
  scoreboard:
    backgroundColor: "{colors.board}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.xl}"
    padding: "26px 28px"
  button-primary:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 15px"
  button-secondary:
    backgroundColor: "{colors.chalk}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "8px 15px"
  chip:
    backgroundColor: "{colors.chalk}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "5px 11px"
  you-tag:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "5px 8px"
  section-sign:
    backgroundColor: "{colors.chalk}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "10px 18px 9px"
  tab-active:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
---

# Design System: The Power Hour

## Overview

**Creative North Star: "The Day Game"**

A flat sky over a mowed football field at one in the afternoon. Every surface is cartoon glass on a hard ledge: an inked outline, a bright sheen across the top, a hint of the field showing through, and a solid ledge under it like a toy you could press down. Nothing is blurred and nothing casts a soft shadow, so a phone draws exactly what a desktop does.

The page is a stadium in layers. The sky (flat bands of blue and three cartoon clouds) sits behind everything. The field starts right under each page heading: mowing stripes, a chalk yard line every two stripes and a chalk sideline, bleeding to the window edges. Cards stand on the grass. The footer is the end zone, with a white goal line. Dark scoreboards (the headline carousel and the game of the week) are smoked glass with a cartoon glint in the corner, the one place type turns white.

The energy comes from a single bold move, the power rank painted on the grass like a yard number, half under its card. Everything else stays quiet: one yellow for "you", one amber for actions, ink for all text.

**Key Characteristics:**
- Two kickoffs: the day game (light, the default) and the night game (dark), the same stadium after sunset. The device's setting picks one; the sun and moon button in the header overrides it on that device.
- Hard edges everywhere: inked outlines, solid ledges, no blur, no `backdrop-filter`, no ambient shadows.
- Glossy and pressable: cards and buttons look like glass toys and press down when touched.
- Condensed display numerals for everything that's a score, rank or name; a warm geometric sans for reading.
- Data first: charts are hand-drawn SVG, labels wear ink, never the series colour.

## Colors

A sunny sports palette: field greens and sky blues for the setting, one yellow and one amber doing all the signalling, and a deep green-black ink for every word.

### Primary
- **First-Down Yellow** (yellow): your team, always. The ring around your card, the "You" tag, the week pill on page titles, the top-three yard numbers. Nothing else is yellow.
- **Goalpost Amber** (amber): actions and the active state: the active tab pill, a pressed filter, call-to-action pills, featured gold ledges (with Ledge Gold beneath).

### Secondary
- **Mowed Grass** (grass) with **Light Stripe** (stripe): the field. Alternating 120px mowing stripes behind every page's content.
- **Spring Grass** (grass-2) and **Lime** (lime): small accents inside cards; Lime fills initials avatars.
- **Sky** (sky-1, sky-2, sky-3): the three flat bands of the background sky.

### Tertiary
- **Matchup Blue** (side-a, ink side-a-ink): the left team in any head-to-head.
- **Matchup Amber** (side-b, ink side-b-ink): the right team.
- **Good / Bad / Flag** (good, bad, flag): rises, drops, injuries and source outages.

### Neutral
- **Ink** (ink): every heading and all body copy; also the outline on every card and button.
- **Ink 2 / Ink 3** (ink-2, ink-3): secondary and tertiary text. Both clear 4.5:1 on white, the 96% card face and the Tray, but not on grass.
- **Chalk** (chalk): white type on scoreboards and yard numbers, chip and sign faces.
- **Tray / Tray 2 / Line** (tile, tile-2, line): the recessed panels inside a card, bar tracks and hover fills a step darker again, and dividers.
- **Scoreboard** (board) and **End Zone** (turf): the dark panels and the footer.
- **Header Sky** (header): the solid sticky header, opaque because the page scrolls beneath it.

### Named Rules
**The First-Down Rule.** Yellow means "this is you". It never decorates, never marks an action, never highlights someone else's team. Leaders and winners wear Goalpost Amber (the money-week leader, for one). "You" takes one of two forms: the 4px yellow ring on a card (`--ring-w`), or Your Row (mine-bg) with a 2px `#F2C200` inset on a row, cell or table line. Yellow type on a dark scoreboard is an accent, not a "you" mark.

**The Ink-On-Grass Rule.** Text sitting directly on the field must be Ink (5.2:1). Muted inks fail on green, so small text there goes on a white chip or sign.

**The Two-Ended Heat Rule.** Heat tables run sky blue (the good end) to amber (the bad end) and fade to white in the middle, never green to red, so every kind of colour vision reads them. Chart labels never fade: other teams' lines and dots dim to 22%, their names stay at Ink 3.

**The Background-Color Rule.** Set a card's colour with `background-color`, never the `background` shorthand, or the glass sheen disappears.

### The night game (dark theme)

The same stadium after sunset, under the lights. Every colour is a token on `:root` redefined under `:root[data-theme='dark']` at the end of `styles.css`; `html[data-theme]` is set before the first paint by the inline script at the top of `index.html` (a choice kept in `ph-theme`, else `prefers-color-scheme`) and flipped by the header's sun and moon button (`initTheme` in `app.js`, which also follows the device's setting while no choice is kept).

- **Night sky** (sky-1/2/3 `#0A1630`, `#0F2142`, `#162C52`): navy bands, a few stars, dim clouds.
- **Floodlit field** (grass `#2C7A31`, stripe `#33873A`): a deeper green, chalk lines dimmed to 22%.
- **Smoked glass cards** (face `rgba(20, 35, 26, 0.97)`, a faint sheen and rim): a near-black inked edge (`--outline` `#020804`) on a black ledge.
- **Trays and chips** (tile `#0C170F`, tile-2 `#23382A`, paper `#1E3226`): the tray is darker than the card, a raised chip lighter.
- **Chalk ink** (ink `#EAF4E6`, ink-2 `#BCD0BC`, ink-3 `#9AB29C`): every word, all well over 4.5:1 on the cards and trays. Good, bad and links lift to `#7FD483`, `#FF8A80` and `#7AD0FF`.
- **Yellow and amber don't change**: they glow on dark. Anything on a bright fill keeps the day's dark ink through one selector list that re-scopes `--ink` on those elements.
- **The team dashboard** keeps its opposite-of-the-wheel palette, deepened: an aubergine sheet `#1E1724`, plum tiles `#2B2232`, clay `#D27354`, violet `#8E73CC`.

## Typography

**Display Font:** Big Shoulders Display (with Arial Narrow, Impact)
**Body Font:** Albert Sans (with Segoe UI, system-ui)

**Character:** A tall, condensed stadium-signage face for numbers and names against a friendly, open sans for sentences. Tabular numbers are on everywhere so scores line up. Both are self-hosted variable fonts.

### Hierarchy
- **Display** (900, clamp(48px, 8.4vw, 104px), 0.86): page titles only, balanced, with the week pill sitting above at a quarter size.
- **Yard number** (900, 112px; 150px for the top three): the rank painted on the grass, white with a hard offset shadow, yellow for the top three.
- **Headline** (800, 30px, 1): section headings (`h2`); scoreboard headlines run 900 at clamp(34px, 4.4vw, 56px).
- **Title** (800, 18–26px, ~1.05): team names, card heads (`h3`); 32px for the top three.
- **Numeral** (900, 34–48px, 0.9): power scores, projected points, stat-strip values.
- **Body** (400, 16px, 1.55): explanations and decks, capped near 62ch.
- **Label** (700, 12–14px): chips, tabs, filters, tier tags, small headings inside cards. Nothing on the site sets smaller than 11.5px (position tags, axis notes).

### Named Rules
**The Sentence-Case Rule.** Sentence case everywhere, no ALL-CAPS eyebrow labels, no emoji, no "A · B · C" middle-dot strings.

**The Numbers-Wear-Display Rule.** Any figure a manager would read aloud (rank, score, points, odds) is set in Big Shoulders; prose stays in Albert Sans.

## Layout

`main` is a single-column grid, at most 1180px wide (`--page`) with a 12px gutter each side on phones and 20px from 761px up, so each page's heading is always row 1 and the field starts on grid line 2. Keep every view's heading as the first child of `#app`, or the grass starts in the wrong place.

Rhythm: 14px between ranking rows, 18px card padding, 24px between sections, 44px under the page heading. Breakpoints: phones at 760px and below (one column, short tab labels, one cloud, no sideline), a mid step at 980px, and from 1100px the Live page puts the weekly list and the standings side by side with the standings sticky. Everything must stay usable at 390px.

Ranking rows are offset left (58px, 74px for the top three) to make room for the yard number half under the card.

## Elevation & Depth

Depth is built from hard, flat layers, never blur. Every card carries one shadow stack: an inset rim highlight, your team's yellow ring (0 width unless it's yours), the 2.5px ink outline around both, then a solid ledge 5px below as wide as the outline. States only change the variables (`--ring-w`, `--lift`, `--ledge-c`); the stack itself never changes. Featured cards stand on a gold ledge. Hover lifts a card and deepens the ledge (desktop only).

### Shadow Vocabulary
- **Glass card** (`box-shadow: inset 0 2px 0 #FFF, inset 0 -3px 0 rgba(18,48,26,.05), 0 0 0 var(--ring-w) #FFEB3B, 0 0 0 calc(var(--ring-w) + 2.5px) #12301A, 0 5px 0 calc(var(--ring-w) + 2.5px) rgba(14,46,22,.26)`): every card.
- **Gold ledge** (same stack, ledge `#E0A100`): top-three ranks, trades, the best trade idea, scoreboards.
- **Pill button** (`box-shadow: 0 0 0 2px #12301A, 0 3px 0 2px rgba(14,46,22,.26)`): buttons on light surfaces; pressed drops to `0 1px 0 2px` with `translateY(2px)`.
- **Chip** (`box-shadow: 0 2px 0 rgba(14,46,22,.26)`): small tags, no outline.

### Three layers
Every surface sits on one of three steps, and the step is never ambiguous:
1. **Raised glass card** on the field: the 96% white face, ink outline and ledge.
2. **Recessed tray** inside a card (manager card, position groups, schedule, trade sides, trade-idea give/get, the breakdown's side column, odds tiles, fan picks, futures rows): Tray fill with `--tray-edge`, a hard 3px inner shadow under its top edge and a faint 1.5px inked rim, no blur and no ledge.
3. **Raised chip** inside a tray: white with a 1.5px Line rim and a 3px Line ledge (the manager's stat tiles), or a full pill button.
Bar tracks inside a tray use Tray 2 so they still read.

### Named Rules
**The Three-Step Rule.** A panel inside a card is always pressed in (Tray plus tray edge), never another raised card and never the same tone as the card face. If two neighbouring surfaces look alike, one of them is on the wrong step.

**The Hard-Ledge Rule.** No blur, no `backdrop-filter`, no soft drop shadows. If something needs to stand up, give it an ink outline and a solid ledge.

**The One-Soft-Edge Rule.** The kicker loader's feathered mask is the only soft edge on the site, by request. Don't add another.

## Shapes

Radii step down with hierarchy: 32px for featured cards and scoreboards, 24px for standard cards, 16px for nested and small cards, full pills for every control, chip and tag. Circles for avatars, the expand button and the "vs" badge. The field itself has 44px rounded top corners where it meets the heading; the sideline follows at 32px.

## Components

### Buttons
Glossy and pressable cartoon pills.
- **Shape:** full pill (999px).
- **Primary:** Goalpost Amber face, Ink label, 2px ink outline, gold ledge.
- **Secondary:** white face, Ink 2 label, 2px ink outline, standard ledge.
- **Gloss:** a hard-edged white gloss over the top half sits under the label (`::before`, `isolation: isolate`).
- **Hover / Focus:** on a mouse a glint sweeps across; white pills tint sky blue. Focus is a 3px ink outline offset 3px (yellow on dark scoreboards).
- **Active:** presses down 2px and the ledge shrinks to 1px.

### Chips
- **Style:** white face, Ink 2 label at 12.5px bold, 2px ledge, no outline. Optional status dot (grass for live, flag for off).
- **You tag:** First-Down Yellow with a gold ledge.

### Cards / Containers
- **Corner Style:** 24px (32px featured, 16px nested).
- **Background:** a 96% white face over the field, a fixed 150px sheen band across the top, Tray panels inside.
- **Shadow Strategy:** the glass card stack; gold ledge when featured.
- **Border:** none; the outline is part of the shadow stack.
- **Internal Padding:** 18px (14–28px by size).

### Navigation
A solid pill-shaped sticky header in Header Sky holding the logo, the wordmark (hidden on phones), the tab strip and the team picker. Tabs sit in a Tray groove; the active tab is an amber glossy pill (`.tab-ink`) that slides between tabs. Phones get short labels (Live, Power, Wire, Games, Trades, Lab).

### Charts (cartoon glass)
Charts follow the cards. Every plot stands on a plate: a Tray with chalk-white gridlines on a card, or a white plate inside a tray. Lines carry an ink casing under the team colour and a thin white gloss along the top; the focus team's line is heavier. Dots have a 2px ink ring and a white glint; photo marks get an ink ring around their colour ring. Bars have a 2px ink edge, a hard ledge 3px underneath and a gloss strip (at most 12px) over the top. Chart labels wear a white halo. The scatter's quadrants are tinted by how good a place they are (green bottom right, red top left). Heat cells are glossy tiles with a shaded foot. The position-group radar is a white dartboard on a ledge. Playoff odds read as a filled glossy pill.

### Lab ledes
A chart that answers a question opens with the desk's one-line read in a yellow callout (`.lab-lede`, Your Row fill on a gold ledge), written to the picked team when there is one ("Dan: win 5 of your last 8 and you're in 91% of the time"). The chart is the evidence; the lede is what a casual manager takes back to the group chat.

### Manager stat tiles
The tiles in the manager card are toned by league rank: top third gets a green tint, a green number and a green ledge; bottom third gets the same in red; the middle stays white. Moves stay neutral. The tooltip says where the number ranks ("3rd of 12 in the league").

### You strip
On the power rankings, right under the page head: a glass button wearing the yellow ring and a gold ledge, with your headshot, "You're No. 6", tier and move, and playoff odds. Tapping it scrolls to your row and opens it. On phones it's the first thing under the carousel, so nobody scrolls three screens to find themselves.

### Reason pips
Lists of reasons ("why this rank", "things to watch") lead each line with a 10px pip in the reason's colour, inked with a 2px outline. Never a coloured side stripe.

### Section signs
Section titles on the grass are white pill signs with an ink outline and ledge, so their text never sits on green.

### Yard numbers (signature)
Each power rank painted on the grass beside its card: Big Shoulders 900, white (top three yellow and larger), with a hard offset shadow, half tucked under the card. This is the one bold move; keep it the only one.

### Scoreboards
Dark Scoreboard cards with white type and yellow accents: smoked-glass sheen, a faint rim and a cartoon glint (an SVG corner stroke and dot) top-left. The game of the week's graphic is the playoff drive, a mini field from 0% to the end zone at 100%.

## Do's and Don'ts

### Do:
- **Do** keep every surface on the glass card stack and change only its variables for state.
- **Do** reserve First-Down Yellow for the viewer's own team and Goalpost Amber for actions and the active state.
- **Do** set figures in Big Shoulders with tabular numbers, and prose in Albert Sans.
- **Do** put small text that sits on the field onto a white chip or sign.
- **Do** keep manager headshots to one or two personal moments per page.
- **Do** honour `prefers-reduced-motion` and keep phones on the light motion set (transform and opacity only).

### Don't:
- **Don't** use emoji or ALL-CAPS labels anywhere.
- **Don't** add blur, `backdrop-filter` or soft drop shadows; depth is outline plus ledge.
- **Don't** use the `background` shorthand on a glass card; it wipes the sheen.
- **Don't** colour chart labels with their series colour; labels wear ink, and they never fade with their dimmed line.
- **Don't** mark a list item or callout with a coloured `border-left`; use a reason pip.
- **Don't** let a paragraph sit straight on the grass; it goes on a card or a white chip.
- **Don't** add a second bold signature next to the yard numbers.
- **Don't** hard-code a light-only colour (a white fill, a pale tint, a light chip) on a surface; use a token (`--paper`, `--good-bg`, `--bad-bg`, `--info-bg`, `--hover`, `--notice-bg`, `--header`) so the night game can redefine it.
- **Don't** put words on a bright fill (amber, yellow, lime, the matchup sides, the pastel chips) without adding that element to the night game's dark-ink list.
