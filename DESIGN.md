---
name: The Power Hour
description: A league sports desk staged as a day game, with cartoon liquid poured across a mowed field under a flat sky.
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
  face: "#F0FAFD"
  liq-deep: "#A8E0F3"
  liq-gold: "#FFCF3F"
  liq-board: "#2A6A45"
  tile: "#DFF2F8"
  tile-2: "#C6E7F1"
  line: "#BFE0EA"
  ink: "#12301A"
  ink-2: "#3C5A43"
  ink-3: "#4A6757"
  good: "#28702C"
  bad: "#C62828"
  flag: "#D32F2F"
  side-a: "#29B6F6"
  side-a-ink: "#0266A3"
  side-b: "#FFC107"
  side-b-ink: "#985700"
  mine-bg: "#FFF9C4"
  ledge-gold: "#E0A100"
  bead-deep: "rgba(10, 66, 100, 0.2)"
  ledge: "rgba(14, 46, 22, 0.26)"
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
  pool: "20px 28px 18px 30px / 24px 18px 28px 20px"
  drop: "38px 28px 42px 26px / 30px 40px 28px 36px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "14px"
  md: "18px"
  lg: "24px"
  flow: "42px"
  xl: "44px"
components:
  card:
    backgroundColor: "{colors.face}"
    textColor: "{colors.ink}"
    padding: "18px"
  card-featured:
    backgroundColor: "{colors.face}"
    textColor: "{colors.ink}"
  card-mine:
    backgroundColor: "{colors.mine-bg}"
    textColor: "{colors.ink}"
  pool:
    backgroundColor: "{colors.tile}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pool}"
    padding: "12px 14px"
  drop:
    backgroundColor: "{colors.face}"
    textColor: "{colors.ink}"
    rounded: "{rounded.drop}"
  scoreboard:
    backgroundColor: "{colors.board}"
    textColor: "{colors.chalk}"
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

A flat sky over a mowed football field at one in the afternoon, and across the field, cartoon liquid. The cards on a page are one poured body: an inked outline runs unbroken from card to card through necks with real fillets, drips hang off bottom edges, the sides swell slowly and the edges roll so nothing is ever quite straight. The surface is a pale water face with a crescent of deeper liquid along each bottom edge and hard white highlights on the upper left. Nothing is blurred and nothing casts a soft shadow, so a phone draws the same material as a desktop.

The page is a stadium in layers. The sky (flat bands of blue and three cartoon clouds) sits behind everything. The field starts right under each page heading: mowing stripes, a chalk yard line every two stripes and a chalk sideline, bleeding to the window edges. The liquid lies on the grass, over the painted rank numbers and under each card's contents. The footer is the end zone, a pool with a rolling surface that the last cards drain into. The header is its own small dripping body, since it scrolls apart from the page. Dark scoreboards (the headline carousel and the game of the week) are the deep end of the same body, the one place type turns white.

The energy comes from a single bold move, the power rank painted on the grass like a yard number, half under the liquid. The liquid is the material, not a second signature: it stays pale and lets the rank speak. One yellow for "you", one amber for actions, ink for all text.

**Key Characteristics:**
- Two kickoffs: the day game (light, the default) and the night game (dark), the same stadium after sunset. The device's setting picks one; the sun and moon button in the header overrides it on that device.
- One poured body: the cards in `main` are traced together into a single SVG shape, every device drawing the same shape from the same layout.
- Hard edges everywhere: inked outlines, hard highlights, hard crescents, no blur, no `backdrop-filter`, no ambient shadows.
- Beads for controls: small hard highlight, inner crescent, a squash under the finger.
- Condensed display numerals for everything that's a score, rank or name; a warm geometric sans for reading.
- Data first: charts are hand-drawn SVG, labels wear ink, never the series colour.

## Colors

A sunny sports palette: field greens and sky blues for the setting, pale water for the surface, one yellow and one amber doing all the signalling, and a deep green-black ink for every word.

### Primary
- **First-Down Yellow** (yellow): your team, always. The "You" tag, the ring on a card drawn in CSS, the week pill on page titles, the top-three yard numbers. Your own poured card uses Your Water (mine-bg) instead.
- **Goalpost Amber** (amber): actions and the active state: the active tab bead, a pressed filter, call-to-action beads. Bead Gold (ledge-gold) is its inner crescent.

### Secondary
- **Mowed Grass** (grass) with **Light Stripe** (stripe): the field. Alternating 120px mowing stripes (90px on phones) behind every page's content.
- **Spring Grass** (grass-2) and **Lime** (lime): small accents inside cards; Lime fills initials avatars.
- **Sky** (sky-1, sky-2, sky-3): the three flat bands of the background sky.

### Tertiary
- **Matchup Blue** (side-a, ink side-a-ink): the left team in any head-to-head.
- **Matchup Amber** (side-b, ink side-b-ink): the right team.
- **Good / Bad / Flag** (good, bad, flag): rises, drops, injuries and source outages.

### Neutral
- **Ink** (ink): every heading and all body copy; also the outline on the liquid and on every bead.
- **Ink 2 / Ink 3** (ink-2, ink-3): secondary and tertiary text. Both clear 4.5:1 on the Water Face and the Pool, but not on grass or on the crescent.
- **Chalk** (chalk): white type on scoreboards and yard numbers, chip and sign faces, and the liquid's highlights.
- **Water Face** (face): the surface of the liquid and of every card.
- **Deep Water / Deep Gold / Deep Board** (liq-deep, liq-gold, liq-board): the crescent along a bottom edge. Deep Water on ordinary cards, Deep Gold on featured cards, your card and notices, Deep Board on scoreboards.
- **Pool / Pool 2 / Line** (tile, tile-2, line): the panels recessed into a card, bar tracks and hover fills a step darker again, and dividers.
- **Bead Shade** (bead-deep): the inner crescent of a pale bead or chip.
- **Hard Shade** (ledge): the flat translucent shape under the body, and the offset on yard numbers.
- **Scoreboard** (board) and **End Zone** (turf): the dark deep end and the footer pool.
- **Header Sky** (header): the opaque face of the sticky header's body, because the page scrolls beneath it.

### Named Rules
**The First-Down Rule.** Yellow means "this is you". It never decorates, never marks an action, never highlights someone else's team. Leaders and winners wear Goalpost Amber (the money-week leader, for one). "You" takes one of three forms: the `mine` tone on a poured card (Your Water with a Deep Gold crescent), the 4px yellow ring on a card drawn in CSS (`--ring-w`), or Your Water on a row, cell or table line. Yellow type on a dark scoreboard is an accent, not a "you" mark.

`--mine-edge` (#F2C200) is the 2px inset that marks your row, cell or trade side.

**The Ink-On-Grass Rule.** Text sitting directly on the field must be Ink (5.2:1). Muted inks fail on green, so small text there goes on a white chip or sign.

**The Two-Ended Heat Rule.** Heat tables run sky blue (the good end) to amber (the bad end) and fade to white in the middle, never green to red, so every kind of colour vision reads them. Chart labels never fade: other teams' lines and dots dim to 38% (faces in the scatter to 70%), their names stay at Ink 3.

**The Tone Rule.** A poured card's colour comes from its tone (`--liq`: `face`, `gold`, `mine`, `board`, `notice`, `good`, `bad`, `toilet`), never from a background of its own, which the liquid discards. Where two tones meet at a neck, the colour changes at the neck's midpoint.

### The night game (dark theme)

The same stadium after sunset, under the lights. Every colour is a token on `:root` redefined under `:root[data-theme='dark']` at the end of `styles.css`; `html[data-theme]` is set before the first paint by the inline script at the top of `index.html` (a choice kept in `ph-theme`, else `prefers-color-scheme`) and flipped by the header's sun and moon button (`initTheme` in `app.js`, which also follows the device's setting while no choice is kept).

- **Night sky** (sky-1/2/3 `#0A1630`, `#0F2142`, `#162C52`): navy bands, a few stars, dim clouds.
- **Floodlit field** (grass `#2C7A31`, stripe `#33873A`): a deeper green, chalk lines dimmed to 22%.
- **Night water** (face `#14231A`, crescents liq-deep `#1F5A52`, liq-gold `#B98A10`, liq-board `#123C28`): a dark green surface with a near-black inked edge (`--outline` `#020804`), a black shape beneath and highlights turned down to 22%.
- **Pools and chips** (tile `#0C170F`, tile-2 `#23382A`, paper `#1E3226`): the pool is darker than the face, a raised chip lighter.
- **Chalk ink** (ink `#EAF4E6`, ink-2 `#BCD0BC`, ink-3 `#9AB29C`): every word, all well over 4.5:1 on the face and pools. Good, bad and links lift to `#7FD483`, `#FF8A80` and `#7AD0FF`.
- **Yellow and amber don't change**: they glow on dark. Anything on a bright fill keeps the day's dark ink through one selector list that re-scopes `--ink` on those elements.
- **The team dashboard** keeps its opposite-of-the-wheel palette, deepened: an aubergine sheet `#1E1724`, plum tiles `#2B2232`, clay `#D27354`, violet `#8E73CC`.

## Typography

**Display Font:** Big Shoulders Display (with Arial Narrow, Impact)
**Body Font:** Albert Sans (with Segoe UI, system-ui)

**Character:** A tall, condensed stadium-signage face for numbers and names against a friendly, open sans for sentences. Tabular numbers are on everywhere so scores line up. Both are self-hosted variable fonts. The team dashboard alone sets Geist, Geist Mono and Inter, downloaded only once it's open.

### Hierarchy
- **Display** (900, clamp(48px, 8.4vw, 104px), 0.86): page titles only, balanced, with the week pill sitting above at a quarter size.
- **Yard number** (900, 112px; 150px for the top three; 86px for 10 to 12): the rank painted on the grass, white with a hard offset shadow, yellow for the top three. On phones 76px, 96px and 56px.
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

Rhythm: 42px between cards (`--flow`, 34px on phones), which the necks need in order to read as necks; 18px card padding; 44px under the page heading. The body grows 5px past each card's box (4px on phones), so contents stay well inside it. Breakpoints: phones at 760px and below (one column, short tab labels, one cloud, no sideline, finer tracing, no side swells, one drip a card), a mid step at 980px, and from 1100px the Live page puts the weekly list and the standings side by side with the standings sticky. Everything must stay usable at 390px.

Ranking rows are offset left (58px, 74px for the top three, 46px on phones) to make room for the yard number. No swell ever forms on a rank row's left side, so the number stays readable.

Headings and filters on the grass are obstacles: a neck never crosses a section title, a filter row, a page head or the trade bar, and a drip only forms with open space under it.

## Elevation & Depth

Depth is built from hard, flat layers, never blur. From the bottom up, the poured body is a flat translucent copy of its own silhouette 6px below, the fill with its crescent, the 2.5px ink outline, then the hard white highlight strokes. There are no ledges under individual cards in the poured shape, and a poured card has no shadow of its own.

Sticky panels (the Live standings), overlays and the kicker card stay out of the shape, because it can't follow them, and draw the same material in CSS: the face, the 7px inner crescent, your yellow ring if it's yours, the ink outline and a hard ledge. That same CSS stands in for every card if the tracing never runs. States change only the variables (`--ring-w`, `--lift`, `--ledge-c`).

### Shadow Vocabulary
- **Body shade** (`fill: rgba(14,46,22,.26); transform: translateY(6px)` on the silhouette): the whole poured body, once.
- **CSS drop** (`box-shadow: inset 0 -7px 0 #A8E0F3, 0 0 0 var(--ring-w) #FFEB3B, 0 0 0 calc(var(--ring-w) + 2.5px) #12301A, 0 5px 0 calc(var(--ring-w) + 2.5px) rgba(14,46,22,.26)`): sticky panels, overlays and the kicker card; `#E0A100` ledge when featured.
- **Bead** (`box-shadow: 0 0 0 2px #12301A, inset 0 -3px 0 rgba(10,66,100,.2)`): beads on light surfaces; pressed, the crescent shrinks to 1px.
- **Amber bead** (`box-shadow: 0 0 0 2px #12301A, inset 0 -3px 0 #E0A100`): the active tab, a pressed filter.
- **Chip** (`box-shadow: inset 0 -2px 0 rgba(10,66,100,.2)`): small tags, no outline.
- **Pool edge** (`box-shadow: inset 0 3px 0 rgba(16,76,104,.1), inset 0 0 0 1.5px rgba(16,76,104,.13)`): panels recessed into a card.
- **Grounded pieces**: section signs (4px), the big call-to-action bead (5px gold), the manager's stat tiles (3px) and chart bars (3px) keep a short hard ledge of their own.

### Three layers
Every surface sits on one of three steps, and the step is never ambiguous:
1. **The liquid** on the field: Water Face, crescent and ink outline.
2. **A pool** inside a card (manager card, position groups, schedule, trade sides, trade-idea give/get, the breakdown's side column, odds tiles, fan picks, futures rows): Pool fill with `--pool` corners and the pool edge, no blur and no ledge. The small ones (odds tiles, futures rows) keep a plain rounded corner.
3. **A raised chip** inside a pool: white with a 1.5px Line rim and a 3px Line ledge (the manager's stat tiles), or a full bead.
Bar tracks inside a pool use Pool 2 so they still read.

### Named Rules
**The Three-Step Rule.** A panel inside a card is always a pool (Pool plus pool edge), never another raised card and never the same tone as the Water Face. If two neighbouring surfaces look alike, one of them is on the wrong step.

**The Hard-Water Rule.** No blur, no `backdrop-filter`, no soft drop shadows. Liquid here is drawn with an ink outline, a hard crescent and a hard highlight.

**The One-Body Rule.** A new card only needs `.glass` to join the body. Anything that moves on its own needs `--liq: none`. Nothing moves a poured card by itself, since its surface is the shared shape: no hover lift, and no transform on a rank row, which would lift its number above the liquid.

**The One-Soft-Edge Rule.** The kicker loader's feathered mask is the only soft edge on the site, by request. Don't add another.

## Shapes

The form language is the traced silhouette. Poured corners are uneven, each one drawn between 24px and 46px (38px on phones), and they meet necks 9–16px in radius through wide fillets. A second, thinner neck joins a long shared edge now and then, a few extra joins keep the flow from being a plain chain, and tiny pockets of grass the shape would pinch get filled, since liquid would have closed them. Drips end in a bulb, and now and then a loose drop hangs below one. The same page always draws the same shape.

Outside the tracing, shapes follow: uneven drop corners (38/28/42/26 over 30/40/28/36) for sticky panels, overlays and the kicker card, uneven pool corners (20/28/18/30 over 24/18/28/20) for the larger panels inside a card, 16px for small panels, full pills for every control, chip and tag, circles for avatars, the expand button and the "vs" badge. The radius tokens on the poured cards themselves (32px for featured cards and scoreboards, 24px for standard ones) serve focus rings and inner clipping, and the CSS stand-in. The field has 44px rounded top corners where it meets the heading; the sideline follows at 32px.

Nothing rectangular bleeds to a card's edge; a picture inside a card is inset so the silhouette stays liquid.

## Components

### Buttons
Beads, a little pressable blob of the same material.
- **Shape:** full pill (999px); circles for the small round ones.
- **Primary:** Goalpost Amber face, Ink label, 2px ink outline, Bead Gold inner crescent.
- **Secondary:** white face, Ink 2 label, 2px ink outline, Bead Shade inner crescent.
- **Highlight:** a small hard white ellipse up on the left, under the label (`--gloss` on `::before`, `isolation: isolate`). Round beads carry a smaller one; the expand button turns with its chevron, so it carries none.
- **Hover / Focus:** on a mouse, filters and picks rise 1px and white beads tint sky blue. Focus is a 3px ink outline offset 3px (yellow on dark scoreboards).
- **Active:** filter beads, and on a mouse the picks and the game of the week's button, squash (`scale(1.05, 0.92)`) with the crescent shrinking to 1px. The rest press down 2px.
- **Big call to action:** a larger amber bead on a 5px gold ledge that presses down 3px.

### Chips
- **Style:** white face, Ink 2 label at 12.5px bold, a 2px inner crescent, no outline. Optional status dot (grass for live, flag for off).
- **You tag:** First-Down Yellow with a Bead Gold inner crescent.

### Cards / Containers
- **Shape:** one traced body with its neighbours (see Shapes); a card is a region of it, not a box.
- **Background:** see-through. The Water Face, the crescent (about 8px, 6px on phones) and the highlights come from the SVG behind its contents, with Pool panels inside.
- **Tone:** gold crescent for featured cards (top-three ranks, trades, the best trade idea, the key matchup); pale yellow with a gold crescent for your team; the notice tone for notices; a brown crescent for the toilet-bowl game; green or red on the Live page's your-week note.
- **Highlights:** 5px white strokes with round caps, set 10px inside the upper left, a stroke, a short gap and a dot, 120px at most (76px on phones).
- **Border:** the outline is the silhouette's 2.5px ink stroke.
- **Internal Padding:** 18px (14–28px by size).

### Footer pool
The end zone is part of the body: full-width End Zone water with long slow waves on its surface, and up to two streams from the last cards draining into it. The CSS end zone with its white goal line only shows if the tracing never runs.

### Navigation
A sticky header drawn as its own small body, Header Sky with a Deep Water crescent, an unbroken ink outline, its own highlight and three or four short drips hanging off it (three on phones). It holds the logo, the wordmark (hidden on phones), the tab strip and the team picker. Tabs sit in a Pool groove; the active tab is an amber bead (`.tab-ink`) that rolls past its stop and rocks back. Phones get short labels (Live, Power, Wire, Games, Lab), and from 120px of scrolling the header folds into the football, the old CSS skin doing the fold while the liquid fades with the bar's other parts.

### Liquid motion
Three moves, all on the liquid's own terms, and none under `prefers-reduced-motion`:
- **Entrance swell:** on a real view change, the first screen's liquid grows out of each card's middle, necks reach across and join, it overshoots a little and settles (0.64s, the same shape traced at a rising level).
- **Droplets:** a 9px droplet runs through each neck at least 14px long, in the crescent colour of the card it left, stretching mid-way (at most 28 necks, 14 on phones, and only near the screen). It's the only motion in the liquid at rest.
- **Tab bead:** a 0.55s slide with `cubic-bezier(0.3, 1.5, 0.5, 1)`.
Opening a row or card swells the liquid with it, frame by frame, not as an animation of its own. A ranking row's first entrance moves its contents only, with the yard number popping in a beat later.

### Charts (cartoon liquid)
Charts follow the cards. Every plot stands on a plate: a Pool with chalk-white gridlines on a card, or a white plate inside a pool. Lines carry an ink casing under the team colour and a thin white line along the top; the focus team's line is heavier. Dots have a 2px ink ring and a white glint; photo marks get an ink ring around their colour ring. Bars have a 2px ink edge, a hard ledge 3px underneath and a short highlight (at most 18px by 3.5px) near the top. Chart labels wear a white halo. The scatter's quadrants are tinted by how good a place they are (green bottom right, red top left). Heat cells are tinted tiles with a shaded foot. The position-group radar is a white dartboard on a ledge. Playoff odds read as a filled pill.

### Lab ledes
A chart that answers a question opens with the desk's one-line read in a yellow callout (`.lab-lede`, Your Water fill), written to the picked team when there is one ("Dan: win 5 of your last 8 and you're in 91% of the time"). The chart is the evidence; the lede is what a casual manager takes back to the group chat.

### Manager stat tiles
The tiles in the manager card are toned by league rank: top third gets a green tint, a green number and a green ledge; bottom third gets the same in red; the middle stays white. Moves stay neutral. The tooltip says where the number ranks ("3rd of 12 in the league").

### You strip
On the power rankings, right under the page head: a poured button with your headshot, "You're No. 6", tier and move, and playoff odds. Tapping it scrolls to your row and opens it. On phones it's the first thing under the carousel, so nobody scrolls three screens to find themselves.

### Reason pips
Lists of reasons ("why this rank", "things to watch") lead each line with a 10px pip in the reason's colour, inked with a 2px outline. Never a coloured side stripe.

### Section signs
Section titles on the grass are white pill signs with an ink outline, an inner crescent and a short ledge, so their text never sits on green. Necks route around them.

### Yard numbers (signature)
Each power rank painted on the grass beside its card: Big Shoulders 900, white (top three yellow and larger), with a hard offset shadow, half under the liquid. This is the one bold move; keep it the only one.

### Scoreboards
Dark Scoreboard regions of the body with white type and yellow accents: the `board` tone, a Deep Board crescent and the same hard white highlights. The game of the week's graphic is the playoff drive, a mini field from 0% to the end zone at 100%.

### Team dashboard (its own style)
The Lab's Your team section (`.paper`, `#lab/team`) deliberately stays out of the liquid: a lilac sheet of flat bone tiles with hard ledges, thin Geist numerals, Geist Mono captions, Inter labels, and flat fills only. Its tokens are scoped to `.paper` with a `--p-` prefix. The liquid's rules don't apply inside it, and its rules don't apply outside.

## Do's and Don'ts

### Do:
- **Do** give every new card `.glass` and let the tone (`--liq`) set its colour.
- **Do** set `--liq: none` on anything sticky or fixed, so it stays a CSS drop.
- **Do** keep 42px (`--flow`, 34px on phones) between cards so the necks read as necks.
- **Do** use a pool for any panel inside a card.
- **Do** reserve First-Down Yellow for the viewer's own team and Goalpost Amber for actions and the active state.
- **Do** set figures in Big Shoulders with tabular numbers, and prose in Albert Sans.
- **Do** put small text that sits on the field onto a white chip or sign.
- **Do** keep manager headshots to one or two personal moments per page.
- **Do** honour `prefers-reduced-motion`, and keep phones on the light motion set.

### Don't:
- **Don't** use emoji or ALL-CAPS labels anywhere.
- **Don't** add blur, `backdrop-filter` or soft drop shadows; depth is outline, crescent and hard highlight.
- **Don't** give a poured card its own background, shadow, hover lift or transform; put an entrance on its contents, and never transform a rank row.
- **Don't** bleed anything rectangular to a card's edge.
- **Don't** bring the liquid into the team dashboard, or the dashboard's flat tiles into the rest of the site.
- **Don't** colour chart labels with their series colour; labels wear ink, and they never fade with their dimmed line.
- **Don't** mark a list item or callout with a coloured `border-left`; use a reason pip.
- **Don't** let a paragraph sit straight on the grass; it goes on a card or a white chip.
- **Don't** add a second bold signature next to the yard numbers.
- **Don't** hard-code a light-only colour (a white fill, a pale tint, a light chip) on a surface; use a token (`--paper`, `--good-bg`, `--bad-bg`, `--info-bg`, `--hover`, `--notice-bg`, `--header`) so the night game can redefine it.
- **Don't** put words on a bright fill (amber, yellow, lime, the matchup sides, the pastel chips) without adding that element to the night game's dark-ink list.
