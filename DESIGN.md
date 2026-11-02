---
name: The Power Hour
description: A league sports desk on paper, with flat bone tiles on a hard ledge standing on a mowed field under a flat sky.
colors:
  amber: "#FFC107"
  ledge-gold: "#E0A100"
  you: "#6A4F9C"
  you-ink: "#FFFCF7"
  mine-bg: "#EBE3F3"
  grass: "#4CAF50"
  stripe: "#5AB34F"
  data: "#4CAF50"
  grass-2: "#8BC34A"
  lime: "#CDDC39"
  yellow: "#FFEB3B"
  sky-1: "#81D4FA"
  sky-2: "#9EDDFB"
  sky-3: "#B3E5FC"
  turf: "#1B5E20"
  board: "#13301C"
  chalk: "#FFFFFF"
  face: "#FBF6EF"
  paper: "#FFFCF7"
  tile: "#F2EAE0"
  tile-2: "#E8DDD1"
  line: "#E6DBD0"
  hover: "#EFE6DA"
  ink: "#12301A"
  ink-2: "#3C5A43"
  ink-3: "#4F6854"
  good: "#28702C"
  good-bg: "#E6F0DC"
  bad: "#C62828"
  bad-bg: "#F9E2DC"
  flag: "#D32F2F"
  info-bg: "#DCEEF6"
  side-a: "#29B6F6"
  side-a-ink: "#0266A3"
  side-b: "#FFC107"
  side-b-ink: "#8C5000"
  night-sky-1: "#0A1630"
  night-sky-2: "#0F2142"
  night-sky-3: "#162C52"
  night-grass: "#2C7A31"
  night-stripe: "#33873A"
  night-board: "#06120A"
  night-face: "#14231A"
  night-paper: "#1E3226"
  night-tile: "#0C170F"
  night-tile-2: "#23382A"
  night-outline: "#020804"
  night-ink: "#EAF4E6"
  night-ink-2: "#BCD0BC"
  night-ink-3: "#9AB29C"
  night-you: "#B39DEB"
  night-you-ink: "#1E1724"
  night-mine-bg: "#2C2640"
  night-data: "#6FBF73"
  dash-sheet: "#E4DAE6"
  dash-tile: "#FBF6EF"
  dash-ink: "#2A2230"
  dash-muted: "#6B5B66"
  dash-clay: "#B5573D"
  dash-violet: "#6A4F9C"
  dash-apricot: "#E9A66A"
  dash-dark: "#2E2235"
typography:
  page-title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(44px, 7.4vw, 92px)"
    fontWeight: 300
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  painted-rank:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "90px"
    fontWeight: 300
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(26px, 8.6cqi, 53px)"
    fontWeight: 300
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  numeral:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "46px"
    fontWeight: 300
    lineHeight: 1
    letterSpacing: "-0.02em"
  section:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 300
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  team-name:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "27px"
    fontWeight: 300
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  control:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 500
    lineHeight: 1.2
  caption:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  data-small:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.02em"
  panel-label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-0.1px"
rounded:
  cell: "9px"
  sm: "12px"
  md: "18px"
  print: "20px"
  lg: "30px"
  xl: "38px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "14px"
  md: "18px"
  lg: "22px"
  xl: "44px"
components:
  tile:
    backgroundColor: "{colors.face}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "20px"
  tile-featured:
    backgroundColor: "{colors.face}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
  well:
    backgroundColor: "{colors.tile}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
  board:
    backgroundColor: "{colors.board}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.xl}"
    padding: "26px 28px"
  button-primary:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "16px 30px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "7px 15px"
  filter-pill:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "8px 15px"
  filter-pill-active:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "8px 15px"
  tab-active:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  you-tag:
    backgroundColor: "{colors.you}"
    textColor: "{colors.you-ink}"
    rounded: "{rounded.pill}"
    padding: "5px 8px"
  your-row:
    backgroundColor: "{colors.mine-bg}"
    textColor: "{colors.ink}"
  section-sign:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "10px 18px 9px"
  poster-side-a:
    backgroundColor: "{colors.side-a}"
    textColor: "{colors.ink}"
  poster-side-b:
    backgroundColor: "{colors.side-b}"
    textColor: "{colors.ink}"
  poster-burst:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.ink}"
    size: "84px"
  dash-tile:
    backgroundColor: "{colors.dash-tile}"
    textColor: "{colors.dash-ink}"
    size: "296px"
---

# Design System: The Power Hour

## Overview

**Creative North Star: "A Day Game, on Paper"**

The Power Hour is one flat sheet of dashboard tiles standing on a football field. The ground is the world: flat sky bands and clouds at the top, mowed stripes and chalk lines below, the end zone as the footer. On that ground sit bone tiles with a dark green ink edge and a hard ledge, and inside them, warm wells. Nothing shines. Depth is an outline and a solid shape under it, so phones draw exactly what desktops draw.

The system is bold through scale, not weight. Names and numbers are very large, very thin Geist; a manager reads their rank and odds at a glance as big numerals, then opens a tile for the reasons. Everything small is plain and quiet so the numerals carry the page. A few loud moments are kept on purpose, and they are loud because everything around them is still.

The density is that of a sports desk: plenty of numbers per screen, usable at 390px, read in short visits from a group chat link. Two themes share one structure: the day game and the night game, the same stadium after sunset. The cartoon-glass league site this replaced is rejected: gloss, sheen, glint, condensed stadium lettering.

**Key Characteristics:**
- Flat bone tiles with a 2px ink edge and a hard ledge, on the sky and the mowed field.
- Bold through scale: Geist 300 for names and numbers, never heavy weights for emphasis.
- Three type voices with distinct jobs: Geist, Geist Mono, Inter.
- Amber acts, violet means you, yellow is an accent, grass measures.
- Four kept loud moments: the painted rank numbers, the dark boards, the tilted prints, the Games fight poster.
- No gloss, sheen, glint, blur or surface gradients in either theme.

## Colors

A saturated outdoor ground with quiet warm surfaces on it, where each strong colour holds exactly one job.

### Primary
- **Goalpost Amber** (#FFC107): actions and the active state. The active tab's pill, the active filter, the primary button, the amber nudge on a row that opens. Stands on its own gold ledge (#E0A100), which also marks featured tiles: the top three, trades, the best trade idea.

### Secondary
- **Your Team Violet** (#6A4F9C, night #B39DEB): your team, everywhere. The 4px ring on your tile, the 2px inset on your row, cell or trade side over Violet Wash (#EBE3F3, night #2C2640), the "You" tag, your line and dots on every chart, your face's ring in the header. Words on it use its paired ink (#FFFCF7, night #1E1724). Text selection and the text caret borrow it too.

### Tertiary
- **First-Down Yellow** (#FFEB3B): an accent on the dark boards (breaking headlines, marked names, the running dot, focus outlines), the dark end zone, the top three's painted numbers, and the poster's burst and the prints' name tags that sit with them.
- **Data Grass** (#4CAF50, night #6FBF73): the one colour for a plain measure: bars, tracks and fills that only say how much. Also the dot on a panel's label.
- **Matchup Sides**: left team Sky Blue (#29B6F6) with its ink (#0266A3), right team Amber (#FFC107) with its ink (#8C5000). Used for the win bar, the odds numerals and the fight poster.
- **Good, Bad and Flag** (#28702C, #C62828, #D32F2F): direction and warnings, on their tints (#E6F0DC, #F9E2DC). Flag also fills the "This Guy Stinks" tier.

### Neutral
- **The Ground**: Sky Bands (#81D4FA, #9EDDFB, #B3E5FC), Mown Grass and Stripe (#4CAF50, #5AB34F), Chalk (#FFFFFF), End Zone Turf (#1B5E20). Night: a dark sky with a few stars (#0A1630, #0F2142, #162C52), dimmer grass (#2C7A31, #33873A), dimmer chalk.
- **Bone Face** (#FBF6EF, night #14231A): every tile and the sticky header.
- **Warm Well** (#F2EAE0, night #0C170F): a panel pressed into a tile. Tracks and hover fills go one step darker (#E8DDD1, night #23382A) so they still read inside a well.
- **Paper** (#FFFCF7, night #1E3226): chips and inputs. Chalk stays literal white for words on boards; paper is the themed surface.
- **Field Ink** (#12301A, #3C5A43, #4F6854; night #EAF4E6, #BCD0BC, #9AB29C): text and tile edges. The muted inks clear 4.5:1 on the face and the well.
- **The Board** (#13301C, night #06120A): the flat dark green of headlines and game of the week.
- **Team Dashboard Set**: the Lab's Your team sheet has its own colours, opposite the site's on the wheel: a lilac sheet (#E4DAE6), bone tiles (#FBF6EF), aubergine ink (#2A2230), clay data (#B5573D), violet leader (#6A4F9C), apricot highlights (#E9A66A), a flat aubergine dark tile (#2E2235). Every token is scoped to the sheet, with its own night values.

### Named Rules
**The Violet Is You Rule.** Violet means your team and nothing else on the site. If a violet mark does not point at the viewer's team, it is wrong. The team dashboard's violet leader is the one scoped exception, inside its own sheet.

**The One Measure Rule.** A plain measure uses one data colour. Only give a bar a second colour when the colour itself says something: your team, a win or loss, a matchup side.

**The Sky to Amber Rule.** Heat tables run sky blue at the good end to amber at the bad end, through white, never green to red, so they read colour-blind. What it takes is the one exception and runs on grass.

**The Dark-Ink Rule.** Anything with words on a bright fill stays on the day's dark ink at night. Add every new bright chip to the dark-ink list in the night game section of the stylesheet.

## Typography

**Display and Body Font:** Geist (with system-ui, sans-serif)
**Caption and Data Font:** Geist Mono (with ui-monospace, monospace)
**Panel Label Font:** Inter (with system-ui, sans-serif)

**Character:** Thin, tight Geist at big sizes reads like a printed scoreboard with no bulk behind it. The mono brings the instrument-panel precision of a stat sheet, and Inter with its dot opens a panel the way a dashboard widget does. All three are self-hosted under the SIL Open Font License, with the Latin files preloaded.

### Hierarchy
- **Page Title** (300, clamp(44px, 7.4vw, 92px), 1.04, -0.04em): each page's name, on the sky in ink. Nothing sits above it: a page's status ("On hold during week 7", "Week 7 live") is a mono chip under the intro (`.wk`).
- **Painted Rank** (300, 90px, top three 108px, ten and up 66px; on phones 54, 62 and 40px): the yard numbers on the grass.
- **Headline** (300, clamp(26px, 8.6cqi, 53px), 1.04, -0.04em): board headlines. Game of the week runs clamp(27px, 3.6vw, 45px).
- **Numeral** (300, 46px, top three 58px, 1, -0.02em): scores and odds, stepping down to 38px for playoff odds and 30px for win odds.
- **Section** (300, 28px, 1.08, -0.03em): panel and section headings.
- **Team Name** (300, 27px, top three 34px, 1.08, -0.03em): names in ranking rows and matchups.
- **Title** (400, 18px, 1.1, -0.03em): small headings, where 300 would go faint.
- **Body** (400, 16px, 1.55): reasons and notes, capped at 62ch to 70ch. Secondary lines 13px to 14.5px.
- **Control** (500, 12.5px to 14px): tabs, pills, chips, tags and bold runs of text.
- **Caption** (Mono 400, 11.5px to 13px, -0.01em): units under a numeral, table headers, axes, timestamps.
- **Small Data** (Mono 400, 13.5px, 1, -0.02em): tight columns of figures such as player values.
- **Panel Label** (Inter 400, 14px, 1.2): a panel's own name, after a 7px inked dot.

### Named Rules
**The Bold Through Scale Rule.** Emphasis comes from size. Names and numbers go up and thin (300); reading sizes use 400; only small controls and inline bold reach 500, the heaviest weight on the site.

**The Three Voices Rule.** Geist speaks, Geist Mono measures, Inter names a panel. Don't mix the jobs.

**The Digits Line Up Rule.** Geist's digits are proportional, so tight columns of small figures take the mono, and large numerals get a fixed box and a little more tracking (-0.02em) so the decimal point does not vanish.

**The Floor Rule.** Nothing sets smaller than 11.5px. On the mono and on bright chips this is a contrast floor as much as a size floor.

**The Sentence Case Rule.** Sentence case and plain verbs everywhere, no all-caps labels, no emoji, no strings of items separated by middle dots. "This Guy Stinks" and "Toilet Time" stay title case by request.

## Layout

The page is a centred column of min(1180px, 100% minus 24px on phones, 40px from 761px). Each view's heading is the first row and sits on the sky; the field starts directly under it and bleeds to both window edges, with mowing stripes 120px tall (90px on phones), a chalk yard line every two stripes, and chalk sidelines just inside the window (hidden on phones). Paragraphs never sit straight on the grass.

Ranking rows are one column with a 92px gutter holding the painted number, clear of its tile. Matchups and the Lab run in grids (the Lab on 12 columns with an 18px gap). From 1100px the live page sets the weekly list and standings side by side; at 980px and below the league desk drops under the headlines; at 760px and below the layout goes to its phone form, with a two-row header and short tab labels. Touch screens grow small pills to 40px. Must stay usable at 390px.

The team dashboard sheet is a size container of 296px square tiles, 612px wide ones, 20px apart: three columns from 928px inside it, two from 612px, one below.

Spacing is tight between tiles (14px to 22px) and generous above a page's field (44px under the heading).

## Elevation & Depth

Depth is a solid outline and a solid ledge, with no blur at any level. There are three steps: the raised tile, the well pressed into it (a flat 1.5px inner rim, no shading), and paper chips raised inside a well. At night the same structure holds, with near-black edges and ledges.

### Shadow Vocabulary
- **Tile** (`box-shadow: 0 0 0 2px #12301A, 0 5px 0 2px rgba(14, 46, 22, 0.24)`): every tile. Hover deepens the ledge to 7px and lifts the tile 2px, on a mouse only.
- **Featured Tile**: the same stack on the gold ledge (#E0A100).
- **Your Tile**: the same stack with a 4px violet ring inside the ink edge.
- **Control** (`box-shadow: 0 0 0 2px #12301A, 0 3px 0 2px rgba(14, 46, 22, 0.24)`): pills. Pressing moves the pill 2px down and shrinks the ledge to 1px.
- **Well** (`box-shadow: inset 0 0 0 1.5px rgba(18, 48, 26, 0.12)`): panels inside a tile.
- **Print** (`box-shadow: 5px 6px 0 rgba(0, 0, 0, 0.35)`): the tilted photos, offset like a thrown print.
- **Painted Number** (`text-shadow: 3px 3px 0 #1B5E20`): the rank numbers, 2px 2px on phones.

### Named Rules
**The Hard Edge Rule.** Every shadow has zero blur. A ledge is a solid shape, as wide as the edge above it. `backdrop-filter` and `blur()` are not used anywhere. The soft edges are two small exceptions: the kicker loader's feathered clip, by request, and a mask fading the foot of a list in the team dashboard.

**The Variables Only Rule.** States change a tile's lift, ledge colour and ring through its variables, never by rewriting the shadow stack.

## Shapes

Round and friendly, stepping down with hierarchy: 38px for featured tiles and boards, 30px for tiles, 18px for wells and panels, 12px for small tiles, 9px for heat cells, full pills for every control, chip and tag. The header is a pill too (26px on phones). Sky clouds are overlapping solid circles. The field's top corners round at 44px (28px on phones). The hard straight lines belong to the poster, whose two sides meet on a diagonal, and to its 12-point burst.

## Components

### Buttons
Solid pills on a ledge that press down.
- **Shape:** full pill.
- **Primary:** amber face, ink words, gold ledge. The largest are set in thin Geist at clamp(16px, 1.8vw, 22px), with 16px 30px padding and a 5px ledge.
- **Secondary:** paper face, muted ink, ink edge and neutral ledge. Hover turns to the themed hover fill.
- **Disabled:** the well colour with a pale line edge and no press, or reduced opacity while working.
- **Focus:** a 3px ink outline offset 3px; yellow on the dark boards.

### Chips and Tags
- **Chip:** paper face with a 2px ledge, 12.5px text at weight 500, and a small status dot on source chips.
- **Tier:** pills in amber, pale green, sky, pale grey, and flag red for "This Guy Stinks".
- **Position:** pastel pills by position, always on dark ink.
- **You:** the violet tag beside your team's name.

### Tiles and Wells
- **Tile:** bone face, ink edge, hard ledge, as in Elevation & Depth. Set colour with the background colour so states keep working.
- **Well:** warm fill and flat inner rim, used for any panel inside a tile, never the tile's own tone. Tracks and hover fills sit one step darker.
- **Panel Label:** Inter with a 7px grass dot ringed in ink.

### Inputs / Fields
- **Style:** paper face, 2px pale line, full pill, custom chevron in the ink's colour for each theme.
- **Focus:** the site's 3px ink outline.

### Navigation
A bone pill stuck to the top of the page holds the logo, the tabs on a well, the theme button and the team picker. Tabs are Geist 500 at 14px in muted ink, turning full ink when active or hovered. The amber active pill is one element that slides between tabs (0.45s). Phones show short labels on a second row, and the logo stands alone. The Lab's section switcher repeats the same well and amber pill.

### Painted Rank Numbers
The signature. Each rank is painted on the grass like a yard number, in thin Geist, chalk white, top three larger and yellow, standing in the gutter beside its tile with a hard turf shadow. This is the bold move on the rankings; keep the row around it calm.

### Dark Boards
Flat dark green tiles with chalk words and yellow accents: the headline carousel and game of the week. Muted text is translucent white. Inside, the playoff drive is a miniature field from 0% to the end zone at 100%, with one football per team.

### Tilted Photo Prints
Manager headshots as prints on a board: a 4px chalk border, 20px corners, a tilt of 3 to 6 degrees, the print's hard shadow, a yellow name tag pinned under the photo and a small rotated stamp. Video headlines use the same print at 4:5. Manager faces stay sparing, one or two personal moments a page.

### Games Fight Poster
Game of the week opens with two full-bleed sides, blue and amber, meeting on a diagonal, each with a 150px tilted face, and a yellow 12-point burst holding "VS" in the middle under a hard drop shadow. It is the loudest thing on the site and appears once.

### Charts
Hand-written SVG and HTML, no library. Plots stand on a plate with chalk gridlines; labels wear ink, never the series colour; marks carry an ink ring. Your team is violet on every chart, and with a team in focus the others dim to 38% while their labels keep their ink. A fixed 12-colour team order stays checked for colour-blind separation. Plain measures use the one data colour.

### Team Dashboard
Eight flat widgets in the Lab's Your team section, in its own lilac and aubergine set: thin Geist numerals, mono captions, Inter labels with a dot, the same ink edge and hard ledge in aubergine, and solid-colour covers. It shares the world's rules, but not the site's colours.

## Do's and Don'ts

### Do:
- **Do** build every new surface from the bone face, the 2px ink edge and the hard ledge, with a well for any panel inside it.
- **Do** make emphasis larger and thinner: Geist 300 for names and numbers, 400 for reading, 500 only for small controls.
- **Do** set captions and tight columns of small figures in Geist Mono, because Geist's digits are proportional.
- **Do** open a panel with Inter and its inked dot when it needs its own label.
- **Do** use amber for actions and the active state, and violet (`--you`) for your team, on charts too.
- **Do** use `--data` for a plain measure.
- **Do** run heat tables from sky to amber through white; What it takes alone runs on grass.
- **Do** put `--ink` on anything sitting directly on the grass (5.2:1); small muted text there goes on a paper chip.
- **Do** lead reasons and things to watch with an inked pip.
- **Do** define every colour as a token with a night value, and add new bright chips to the dark-ink list.
- **Do** write in sentence case with plain verbs.
- **Do** keep the team dashboard's colours scoped to its own sheet.

### Don't:
- **Don't** add gloss, sheen, glint, blur or gradients to a surface. Hard-stop bands for the sky, the mowing stripes and a filled track are flat colour, and are fine.
- **Don't** use yellow for your team, or as an action colour on a light surface. It is an accent for dark boards and the top three's painted numbers.
- **Don't** use violet for anything but your team.
- **Don't** add another loud moment. The painted numbers, dark boards, tilted prints and fight poster are the full set.
- **Don't** hard-code a light-only colour.
- **Don't** set text below 11.5px.
- **Don't** use emoji, all-caps labels or a coloured left border on reasons.
- **Don't** put paragraphs straight on the grass.
- **Don't** use green to red for a heat scale.
- **Don't** return to condensed stadium lettering or heavy display weights.
