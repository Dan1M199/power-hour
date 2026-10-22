# CLAUDE.md — The Power Hour

Context for Claude Code working in this repo. Read README.md for the user-facing overview.

## What this is

A shareable website for Dan's 12-team Sleeper fantasy league, **NFL Fantasy Championship** (league ID `1312001652454088704`, 2026 season). Leaguemates open it to see power rankings with explanations, a live waiver/trade feed, weekly matchup odds, and "nerd lab" stats. "The Power Hour" is also the name of Dan's league newsletter. Hosted on Vercel from GitHub; every push to the main branch deploys.

League facts the code relies on: half-PPR, 12 teams, starting slots QB, RB, RB, WR, WR, TE, FLEX, FLEX, K, DEF + 5 bench. Regular season ends week 14, playoffs start week 15, top 6 make it. Standings tiebreaker is points for. Waivers are rolling (no FAAB used in practice).

## Architecture

No framework, no build step, no npm dependencies. Plain ES modules served as static files.

- `index.html`, `styles.css`, `app.js` — the site. `app.js` fetches Sleeper directly from the browser on every page load (state, league, users, rosters, matchups weeks 1–14, transactions weeks 1–current) and calls `/api/ros?d=YYYY-MM-DD` (Central date) for rankings. Hash routing: `#rankings`, `#wire`, `#matchups`, `#lab`.
- `api/ros.js` — Vercel serverless function (Node 18+, global `fetch`). Scrapes the three ROS sources, fetches Sleeper's `/players/nfl` (~5 MB), matches players to Sleeper IDs, returns `{ updated, sources, weights, players: {id: {n,p,t,i,a}}, values: {id: {v, r, spread, pos, wk, fl, cl, ir, sos, g, rk, prk, wkEst?}} }`. Edge-cached 24h (`s-maxage=86400`), only 1h if any source failed. The `?d=` date param makes each day a new cache key, which is the whole "daily refresh" mechanism. No cron, no database.
- `lib/sources.js` — regex-only parsers (must run in Node without a DOM):
  - FantasyPros: `var ecrData = {...};` embedded in the page HTML (~400 players incl. K/DST).
  - DraftSharks: the page only server-renders 25 rows; the full list is `GET /ros-rankings/load-rows?offset=0&limit=600&...` (HTML `<tr class="player-row">` fragments, includes IDP, re-ranked within offense). Also provides weekly proj pts, floor, ceiling, injury risk %, SOS, projected games.
  - LeagueLogs: server-rendered `<table>`, 200 players incl. DST, no K. Its order nearly mirrors FantasyPros ECR, so it is weighted 0.5.
- `lib/consensus.js` — `normName` + `NICKNAMES` map, `buildIndex(sleeperPlayers)`, `matchRow`, `buildConsensus`. Rank → value is `100 * exp(-0.0115 * (rank-1))`, weighted average across sources (`SOURCE_WEIGHTS`). Missing weekly projections are filled by a per-position linear fit of DraftSharks pts vs value, falling back to `DEFAULT_FIT` if DraftSharks is down.
- `lib/engine.js` — `computeLeague(input)`: pure, no DOM, runs in browser and Node. Produces teams (sorted by power rank), weekly results, all-play, luck, efficiency, ROS best lineup (greedy fixed-then-flex), position-group ranks, power score + rank history, Monte Carlo playoff odds (10k sims, seeded), matchup previews, explanations (`explain`), tiers (`tierFor`), transaction feed with ROS value deltas, best available free agents, "divisive" players.
- `lib/stories.js` — the newsroom, pure like the engine. `buildStories(D, {now, dateKey})` scores candidate stories (fresh trades and wire moves, unbeaten/winless/streaks, last week's upsets/blowouts/nail-biters, rank moves, luck, game of the week) and returns `{lead, more}`; a date-seeded jitter rotates near-ties daily. `keyMatchup(D)` picks the game of the week by 0.55 × stakes + 0.45 × closeness, where stakes is the combined playoff-odds swing (`playoffIfWin − playoffIfLoss` from the simulation). `matchupQuips(D)` gives one data-driven one-liner per matchup, no repeated joke within a week.
- `lib/charts.js` — hand-written SVG/HTML chart builders (bump, scatter, radar, weekly bars, diverging bars, heat table). Marks carry `data-tip` for the shared tooltip in `app.js`. Deliberately no chart library.

### Power score

`WEIGHTS` in `lib/engine.js`: rosProj 0.35, depth 0.10, sos 0.10, allPlay 0.20, pfPerGame 0.10, winPct 0.10, form 0.05. Each metric is z-scored across the 12 teams; score = `50 + 22 * weighted z`, clamped 1–99. `sos` is schedule wins (`t.schedWins`): sum over the remaining regular-season games of P(win vs actual opponent) − P(win vs average opponent), using the same `projMean` and pooled SD as the playoff simulation, so the projection block runs before the power score. The rows show three sub-scores: `rosScore`, `sosScore`, `resultsScore`. If `/api/ros` fails, ROS terms are dropped (schedule stays, using points per game) and the page shows a "results-only mode" notice. Rank history holds the ROS and schedule terms at today's value, so week-to-week movement comes from results only.

## Commands

```
npx vercel dev                    # local site + api at http://localhost:3000
open http://localhost:3000/?demo=1   # saved Week 7 snapshot, no network calls
node scripts/test-consensus.mjs   # name matching against saved source data
node scripts/test-engine.mjs      # prints full rankings table, explanations, feed sample
node scripts/test-api.mjs         # runs api/ros.js with mocked fetch, incl. a DraftSharks outage
node scripts/build-demo.mjs       # rebuild demo/demo.json from fixtures/
node scripts/bundle-preview.mjs   # single-file preview in dist/ (gitignored)
```

Run `node --check` on edited JS files and `test-engine.mjs` after any engine change. `fixtures/` holds real Week 7 snapshots (compact arrays) of the three sources plus league data; `scripts/fixture.mjs` rebuilds Sleeper-shaped objects from them.

## Design system

Concept: night game under stadium lights seen through frosted (Apple liquid-glass) panels. Dark-only by design.

- Tokens in `:root` of `styles.css`: `--night #0B1638`, `--indigo #241A5E`, `--flood #FFE9B8` (floodlight, primary accent), `--cyan #5BE3FF`, `--turf #3DDC97` (good), `--flag #FF5A5F` (bad), `--amber #FFB547`.
- Type: Big Shoulders Display (numerals, team names, headings) + Albert Sans (body). Tabular numbers on.
- `.glass` = gradient fill + `backdrop-filter: blur(22px) saturate(170%)` + inset top highlight. `.glass.rim` adds the spectral conic edge; use it sparingly (top-3 ranks, trades, your own matchup).
- Signature element: the giant jersey-style rank numeral that sits partly behind each glass row. Keep that the one bold move; keep everything else quiet.
- Copy rules: sentence case, plain verbs, no ALL-CAPS eyebrow labels, no emoji, no "A · B · C" middle-dot strings.
- Must stay usable at 390px wide; check the `@media (max-width: 760px)` block when adding layout.
- Respect `prefers-reduced-motion`. The only ambient motion is the one-time row rise on the rankings page.
- `localStorage` key `ph-my-team` stores the viewer's chosen team; always wrap storage in try/catch.

## Gotchas

- Sleeper roster `fpts` etc. are split into integer + `_decimal`/100.
- Sleeper team defenses use the team abbreviation as player ID (`"DET"`). Ranking sites spell some teams differently; `TEAM_FIX` in `sources.js` normalises (JAC→JAX, WSH→WAS…).
- Players the sources haven't listed yet (fresh signings) project 0. Patch them in `OVERRIDES` in `lib/overrides.js` (`{pos, wk}`); `app.js` applies it before `computeLeague`, only while the consensus has no `wk` for that player, and the footer lists active patches. Remove entries once the sources catch up.
- Name mismatches go in `NICKNAMES` (e.g. Bam Knight → Zonovan Knight, Cameron Skattebo → Cam Skattebo). Check `/api/ros` → `sources.*.matched` after changes; ~190 of 194 rostered players should have values.
- Scrapers may be blocked from Vercel IPs (browser-like User-Agent is set). A failed source degrades gracefully; don't make the whole endpoint fail on one source.
- Sleeper asks for `/players/nfl` at most once a day; only `api/ros.js` calls it, and the edge cache enforces that. Never call it from the browser.
- Keep Sleeper usage under ~1000 calls/min. The page makes ~25 calls per load.
- Ranking data belongs to FantasyPros, DraftSharks and LeagueLogs; this is a personal, non-commercial league site. Keep the attribution in the footer.
- The footer sponsor line ("presented by Dimassi's Mediterranean Kitchen") is intentional.

## Owner preferences

Dan is a data engineer. He likes direct, data-driven analysis and visual, interactive charts over plain text. When adding stats, prefer a chart or heatmap with hover detail over a paragraph.
