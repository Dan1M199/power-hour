---
name: The Power Hour
description: A league sports desk staged as a day game, with see-through cartoon glass panes stacked on a mowed field under a flat sky.
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
  face: "rgba(255, 255, 255, 0.62)"
  sheet-fill: "#CDEBD3"
  sheet-gold: "#FFE184"
  tile: "rgba(24, 84, 52, 0.1)"
  tile-2: "rgba(24, 84, 52, 0.18)"
  line: "rgba(24, 84, 52, 0.2)"
  ink: "#12301A"
  ink-2: "#3C5A43"
  ink-3: "#3D5949"
  good: "#1F6123"
  bad: "#C62828"
  flag: "#D32F2F"
  side-a: "#29B6F6"
  side-a-ink: "#0266A3"
  side-b: "#FFC107"
  side-b-ink: "#985700"
  mine-bg: "#FFF9C4"
  ledge: "rgba(14, 46, 22, 0.26)"
  ledge-gold: "#E0A100"
  header: "rgba(236, 248, 253, 0.76)"
  header-solid: "rgba(236, 248, 253, 0.93)"
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
  md: "24px"
  lg: "36px"
  xl: "46px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "14px"
  md: "18px"
  lg: "24px"
  stack: "26px"
  xl: "44px"
components:
  card:
    backgroundColor: "{colors.face}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "18px"
  card-featured:
    backgroundColor: "{colors.face}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
  scoreboard:
    backgroundColor: "{colors.board}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.xl}"
    padding: "26px 28px"
  tray:
    backgroundColor: "{colors.tile}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
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
  swipe-peek:
    backgroundColor: "{colors.chalk}"
    textColor: "{colors.ink}"
    padding: "11px 16px"
  swipe-peek-armed:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.ink}"
    padding: "11px 16px"
  deck-rail:
    backgroundColor: "{colors.chalk}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "7px 13px"
---

# Design System: The Power Hour

## Overview

**Creative North Star: "The Day Game"**

A flat sky over a mowed football field at one in the afternoon. Every surface is cartoon glass, and much more glass than card: real see-through panes with big round corners, an inked outline, hard white reflections drawn across them the way a comic draws a window, and a second sheet peeking out from behind, all casting one hard shadow. Depth is the point: field, painted number, sheet, pane, tray, chip, in that order. The only soft thing anywhere is the frost a pane puts on what's behind it.

The page is a stadium in layers. The sky (flat bands of blue and three cartoon clouds) sits behind everything. The field starts right under each page heading: mowing stripes, a chalk yard line every two stripes and a chalk sideline, bleeding to the window edges. Panes stand on the grass, and you see the stripes through them. The footer is the end zone, with a white goal line. Dark scoreboards (the headline carousel and the game of the week) are the one place type turns white: solid dark faces in the same stack, with the reflections turned down.

The energy comes from a single bold move, the power rank painted on the grass like a yard number, tucked under its pane so the part underneath shows frosted through the glass. Everything else stays quiet: one yellow for "you", one amber for actions, ink for all text.

The site moves the way it stacks. A sideways swipe slides the page's panes over the still field, one a little behind the next, while the amber tab bead follows the finger.

**Key Characteristics:**
- Two kickoffs: the day game (light, the default) and the night game (dark), the same stadium after sunset. The device's setting picks one; the sun and moon button in the header overrides it on that device.
- See-through and frosted: panes show the field through a 62% white face (68% on phones) and a `backdrop-filter` frost of 9px (5px on phones).
- Hard edges everywhere else: inked outlines, hard reflections, hard cast shadows, no soft shadows.
- Round and layered: 46/36/24px corners (38/32/22 on phones), a sheet behind every pane, two on featured cards.
- Glossy and pressable: buttons look like glass toys and press down when touched.
- Condensed display numerals for everything that's a score, rank or name; a warm geometric sans for reading.
- Data first: charts are hand-drawn SVG, labels wear ink, never the series colour.

## Colors

A sunny sports palette: field greens and sky blues for the setting, one yellow and one amber doing all the signalling, and a deep green-black ink for every word.

### Primary
- **First-Down Yellow** (yellow): your team, always. The ring around your card, the "You" tag, the week pill on page titles, the top-three yard numbers. Nothing else is yellow.
- **Goalpost Amber** (amber): actions and the active state: the active tab pill, a pressed filter, call-to-action pills, and, with Ledge Gold and Gold Sheet behind, the featured stack.

### Secondary
- **Mowed Grass** (grass) with **Light Stripe** (stripe): the field. Alternating 120px mowing stripes (90px on phones) behind every page's content, and what most panes are looking through.
- **Spring Grass** (grass-2) and **Lime** (lime): small accents inside cards; Lime fills initials avatars.
- **Sky** (sky-1, sky-2, sky-3): the three flat bands of the background sky.

### Tertiary
- **Matchup Blue** (side-a, ink side-a-ink): the left team in any head-to-head.
- **Matchup Amber** (side-b, ink side-b-ink): the right team.
- **Good / Bad / Flag** (good, bad, flag): rises, drops, injuries and source outages.

### Neutral
- **Ink** (ink): every heading and all body copy; also the outline on every card and button.
- **Ink 2 / Ink 3** (ink-2, ink-3): secondary and tertiary text. Both clear 4.5:1 on a pane over the grass (Ink 3 was darkened for it), but not on bare grass.
- **Chalk** (chalk): white type on scoreboards and yard numbers, chip and sign faces.
- **Pane Face** (face): the see-through white of every pane.
- **Sheet / Gold Sheet** (sheet-fill, sheet-gold): the pale green sheet that peeks out behind a pane, and the gold one behind a featured pane.
- **Tray / Tray 2 / Line** (tile, tile-2, line): green tints, so the field still shows through: the panels pressed into a pane, bar tracks and hover fills a step darker again, and dividers.
- **Ledge / Ledge Gold** (ledge, ledge-gold): the flat colours of a hard cast shadow.
- **Scoreboard** (board) and **End Zone** (turf): the dark panels and the footer.
- **Header Sky** (header, header-solid): the sticky header, a pane like the rest above 760px. On phones it folds into a football, so its skin is the near-solid value with no frost.

### Named Rules
**The First-Down Rule.** Yellow means "this is you". It never decorates, never marks an action, never highlights someone else's team. Leaders and winners wear Goalpost Amber (the money-week leader, for one). "You" takes one of two forms: the 4px yellow ring on a card (`--ring-w`), or Your Row (mine-bg) with a 2px `#F2C200` inset on a row, cell or table line. Yellow type on a dark scoreboard is an accent, not a "you" mark.

**The Ink-On-Grass Rule.** Text sitting directly on the field must be Ink (5.2:1). Muted inks fail on green, so small text there goes on a white chip or sign.

**The Two-Ended Heat Rule.** Heat tables run sky blue (the good end) to amber (the bad end) and fade to white in the middle, never green to red, so every kind of colour vision reads them. Chart labels never fade: other teams' lines and dots dim to 38% (scatter faces to 70%), their names stay at Ink 3.

**The Background-Color Rule.** Set a pane's colour with `background-color`, never the `background` shorthand, or the reflections disappear.

### The night game (dark theme)

The same stadium after sunset, under the lights. Every colour is a token on `:root` redefined under `:root[data-theme='dark']` at the end of `styles.css`; `html[data-theme]` is set before the first paint by the inline script at the top of `index.html` (a choice kept in `ph-theme`, else `prefers-color-scheme`) and flipped by the header's sun and moon button (`initTheme` in `app.js`, which also follows the device's setting while no choice is kept).

- **Night sky** (sky-1/2/3 `#0A1630`, `#0F2142`, `#162C52`): navy bands, a few stars, dim clouds.
- **Floodlit field** (grass `#2C7A31`, stripe `#33873A`): a deeper green, chalk lines dimmed to 22%.
- **Smoked glass panes** (face `rgba(16, 30, 22, 0.76)`, 80% on phones, with the reflections, sheen and rim turned down): a near-black inked edge (`--outline` `#020804`), a dark sheet (`#1C3425`, gold `#6B5310`) and a black cast shadow.
- **Trays and chips** (tile `rgba(0, 0, 0, 0.3)`, tile-2 `rgba(234, 244, 230, 0.14)`, paper `#1E3226`): the tray is darker than the pane, a raised chip lighter.
- **Chalk ink** (ink `#EAF4E6`, ink-2 `#BCD0BC`, ink-3 `#9AB29C`): every word, all well over 4.5:1 on the panes and trays. Good, bad and links lift to `#7FD483`, `#FF8A80` and `#7AD0FF`.
- **Yellow and amber don't change**: they glow on dark. Anything on a bright fill keeps the day's dark ink through one selector list that re-scopes `--ink` on those elements.
- **The team dashboard** keeps its opposite-of-the-wheel palette, deepened: an aubergine sheet `#1E1724`, plum tiles `#2B2232`, clay `#D27354`, violet `#8E73CC`.

## Typography

**Display Font:** Big Shoulders Display (with Arial Narrow, Impact)
**Body Font:** Albert Sans (with Segoe UI, system-ui)

**Character:** A tall, condensed stadium-signage face for numbers and names against a friendly, open sans for sentences. Tabular numbers are on everywhere so scores line up. Both are self-hosted variable fonts. The team dashboard alone sets its own type (Geist, Geist Mono and Inter), downloaded only once it's open.

### Hierarchy
- **Display** (900, clamp(48px, 8.4vw, 104px), 0.86): page titles only, balanced, with the week pill sitting above at a quarter size.
- **Yard number** (900, 112px; 150px for the top three; 76px and 96px on phones): the rank painted on the grass, white with a hard offset shadow, yellow for the top three.
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

Rhythm: 26px between ranking rows and between panes in a grid (matchups, trade ideas, the Lab's charts), wide enough for each pane's sheet and cast shadow; 24px between Wire moves and sections, 28px between side-by-side columns, 18px card padding, 44px under the page heading. Breakpoints: phones at 760px and below (one column, short tab labels, one cloud, no sideline), a mid step at 980px, and from 1100px the Live page puts the weekly list and the standings side by side with the standings sticky. Everything must stay usable at 390px.

Ranking rows are offset left (46px, 62px for the top three, 38px on phones) to make room for the yard number, part of which tucks under the pane.

At 760px and below, the longer lists become sideways decks: one card at a time with the next peeking in, 14px apart, reaching the window's edge through the page's gutter. The Games list, the trade ideas, the Wire's trades and the Live page's two panels are decks under a rail; championship futures are a deck in three rows with no rail. The adds and drops and the Lab's charts stay vertical. Above 760px every one of them lays out as a normal list or grid.

## Elevation & Depth

Depth is built from stacked panes: real transparency and hard-edged layers, with one soft thing, the frost behind a pane. Every pane is a see-through face (`--face`) with a backdrop frost (`blur(var(--blur)) saturate(1.5)`), its reflections painted as background layers (a corner glint, the hard diagonal `--glare` bands, a fixed 170px `--sheen` across the top, so a card that opens doesn't stretch them), and one shadow stack. Reading out from the glass: the bevel, your team's yellow ring (0 width unless it's yours), the 2.75px ink outline around both, a sheet behind it (a narrower inked pane peeking 8px out below), then the hard cast shadow. An outer shadow is never drawn under its own box, so the sheets don't show through the pane. States only change the variables (`--ring-w`, `--lift`, `--ledge-c`); the stack itself never changes. Featured panes stack a second sheet on gold. Hover lifts a pane and deepens its shadow (desktop only). `prefers-reduced-transparency` switches the frost off and, in the day game above 760px, takes the face to 96% white.

### Shadow Vocabulary
- **Bevel** (`--rim`: `inset 0 0 0 1.5px rgba(255,255,255,.8), inset 0 3px 0 #FFF, inset 0 -6px 0 rgba(120,210,250,.3)`): a bright lip all round, brighter along the top, light caught along the bottom.
- **Glass pane** (`box-shadow: var(--rim), 0 0 0 var(--ring-w) #FFEB3B, 0 0 0 calc(var(--ring-w) + 2.75px) #12301A, 0 15px 0 calc(var(--ring-w) - 7px) #CDEBD3, 0 15px 0 calc(var(--ring-w) - 4.25px) #12301A, 0 21px 0 calc(var(--ring-w) - 4.25px) rgba(14,46,22,.26)`): every pane.
- **Featured pane** (the same stack on Gold Sheet, plus a second sheet `0 27px 0 calc(var(--ring-w) - 13px) #FFE184` inked at `- 10.25px`, and the cast shadow `0 33px 0 calc(var(--ring-w) - 10.25px) #E0A100`): top-three ranks, trades, the best trade idea, scoreboards, the overlays.
- **Tray edge** (`--tray-edge`: `inset 0 3px 0 rgba(18,48,26,.13), inset 0 -1.5px 0 rgba(255,255,255,.75), inset 0 0 0 1.5px rgba(18,48,26,.12)`): a hard inner shadow under the top, a bright bottom lip and a faint inked rim.
- **Pill button** (`box-shadow: 0 0 0 2px #12301A, 0 3px 0 2px rgba(14,46,22,.26)`): buttons on light surfaces; pressed drops to `0 1px 0 2px` with `translateY(2px)`.
- **Chip** (`box-shadow: 0 2px 0 rgba(14,46,22,.26)`): small tags, no outline.

### Three layers
Every surface sits on one of three steps, and the step is never ambiguous:
1. **Glass pane** on the field: the see-through face, ink outline, sheet and cast shadow.
2. **Pressed tray** inside a pane (manager card, position groups, schedule, trade sides, trade-idea give/get, the breakdown's side column, odds tiles, fan picks, futures rows): the Tray tint with the tray edge, so the field still shows through, with no sheet and no cast shadow.
3. **Raised chip** inside a tray: white with a 1.5px Line rim and a 3px Line ledge (the manager's stat tiles), or a full pill button. A ranking row's tier chip sits in front of the pane, on its top edge.
Bar tracks inside a tray use Tray 2 so they still read.

### Named Rules
**The Three-Step Rule.** A panel inside a pane is always pressed in (Tray plus tray edge), never another raised pane and never the same tone as the pane's face. If two neighbouring surfaces look alike, one of them is on the wrong step.

**The One-Frost Rule.** The pane's `backdrop-filter` is the only blur, and `--blur` is the one switch for all of them. Every shadow has a blur radius of zero. If something needs to stand up, give it an ink outline, a sheet and a hard cast shadow.

**The One-Soft-Edge Rule.** Frost softens what's behind a pane, never the pane's own outline. On the glass, the kicker loader's feathered mask is the only soft edge, by request. Don't add another.

## Shapes

Big and round, stepping down with hierarchy: 46px for featured cards and scoreboards, 36px for standard panes, 24px for nested panels and small cards (38/32/22px on phones), full pills for every control, chip and tag. Circles for avatars, the expand button and the "vs" badge. The field itself has 44px rounded top corners where it meets the heading (28px on phones); the sideline follows at 32px. The peek tag is a pill cut off flat at the window's edge. Team dashboard tiles keep their own shapes.

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
- **Tier chip:** on a ranking row, it sits on the pane's top edge (13px above it), in front of the glass, with gloss, a 2px ink outline and a ledge.

### Cards / Containers
- **Corner Style:** 36px (46px featured, 24px nested; 32/38/22 on phones).
- **Background:** the see-through face and frost over the field, with the glint, the glare bands and the sheen on top, and Tray panels inside.
- **Shadow Strategy:** the glass pane stack; the featured stack on gold.
- **Border:** none; the outline is part of the shadow stack.
- **Internal Padding:** 18px (14–28px by size).

### Navigation
A pill-shaped sticky header in Header Sky holding the logo, the wordmark (hidden on phones), the tab strip and the team picker. It is a frosted pane above 760px, near-solid on phones. Tabs sit in a Tray groove; the active tab is an amber glossy bead (`.tab-ink`) that slides between tabs and follows the finger during a swipe. Phones get short labels (Live, Power, Wire, Games, Lab).

### Swipe navigation
One gesture with three destinations, on touch: a sideways swipe moves a deck or the headline carousel first, a swipe on an opened ranking row goes to the next or previous team, and anything else moves between stops (the tabs, with the Lab's three sections counted separately). A deck at its end hands the next swipe to the page.
- **The page:** its panes follow the finger over the still field, each a little behind the one above (96%, 92%, 88%). With nothing further that way, it rubber-bands.
- **The peek tag:** a pill in Big Shoulders 800 comes in from the window's edge at mid-height with the next stop's name and a chevron, white with gloss, an ink outline and a ledge. It turns amber on a gold ledge once letting go would commit (28% of the window's width), and a flick commits too.
- **Ranking rows:** the card follows at 70%, the peek reads "No. 3" and the team's name, and committing uses the previous and next pills under the report.
- **Trackpad:** above 760px a two-finger swipe moves between stops the same way, and the view transition takes over at the commit.
- **Hands off:** vertical scrolling and pinch zoom stay the browser's. A swipe starting in a table that scrolls sideways, in a form control, or within 18px of the window's edge (iPhone Safari's back gesture) stays out. Reduced motion keeps the gesture and drops the slide.
- **First visit:** a phone shows once, on its own, that the page moves, with the next stop's tag beside it.

### Swipe decks
On phones, a sideways list with snap points and the next card peeking in, under a rail saying where you are, placed first because a card can be a screen tall. The rail is either a white pill with "Game 2 of 6" and dots (the active dot amber and inked), or named beads on a Scoreboard pill with the active one in amber (the Live page's two panels). Dots and beads are tappable.

### Charts (cartoon glass)
Charts follow the panes. Every plot stands on a plate: a Tray with chalk-white gridlines on a pane, or a white plate inside a tray. Lines carry an ink casing under the team colour and a thin white gloss along the top; the focus team's line is heavier. Dots have a 2px ink ring and a white glint; photo marks get an ink ring around their colour ring. Bars have a 2px ink edge, a hard ledge 3px underneath and a gloss strip (at most 12px) over the top. Chart labels wear a white halo. The scatter's quadrants are tinted by how good a place they are (green bottom right, red top left). Heat cells are glossy tiles with a shaded foot. The position-group radar is a white dartboard on a ledge. Playoff odds read as a filled glossy pill.

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
Each power rank painted on the grass beside its pane: Big Shoulders 900, white (top three yellow and larger), with a hard offset shadow, part of it tucked under the pane, where it shows frosted through the glass. This is the one bold move; keep it the only one.

### Team dashboard
The Lab's Your team section is deliberately a different material: a separate paper style of flat tiles with its own palette and type, with every token scoped to `.paper` under a `--p-` prefix. Nothing from the glass applies inside it.

### Scoreboards
Dark Scoreboard cards with white type and yellow accents: a smoked, see-through dark pane in the featured stack, with gold sheets, the glare and sheen turned down, a faint rim and a dimmed corner glint. The game of the week's graphic is the playoff drive, a mini field from 0% to the end zone at 100%.

## Do's and Don'ts

### Do:
- **Do** keep every pane on the one glass stack and change only its variables for state.
- **Do** reserve First-Down Yellow for the viewer's own team and Goalpost Amber for actions and the active state.
- **Do** set figures in Big Shoulders with tabular numbers, and prose in Albert Sans.
- **Do** put small text that sits on the field onto a white chip or sign.
- **Do** keep manager headshots to one or two personal moments per page.
- **Do** honour `prefers-reduced-motion` and keep phones on the light motion set (transform and opacity only).

### Don't:
- **Don't** use emoji or ALL-CAPS labels anywhere.
- **Don't** add blur beyond the pane's frost, or any soft drop shadow; depth is the stack: outline, sheet, hard cast shadow.
- **Don't** use the `background` shorthand on a pane; it wipes the reflections.
- **Don't** colour chart labels with their series colour; labels wear ink, and they never fade with their dimmed line.
- **Don't** mark a list item or callout with a coloured `border-left`; use a reason pip.
- **Don't** let a paragraph sit straight on the grass; it goes on a pane or a white chip.
- **Don't** add a second bold signature next to the yard numbers.
- **Don't** carry the glass into the team dashboard, or its paper style out of it.
- **Don't** hard-code a light-only colour (a white fill, a pale tint, a light chip) on a surface; use a token (`--paper`, `--good-bg`, `--bad-bg`, `--info-bg`, `--hover`, `--notice-bg`, `--header`) so the night game can redefine it.
- **Don't** put words on a bright fill (amber, yellow, lime, the matchup sides, the pastel chips) without adding that element to the night game's dark-ink list.
