# The Power Hour

Power rankings, a live waiver-wire feed and data-nerd stats for the **NFL Fantasy Championship** Sleeper league.

- **Rankings**: a 0–100 power score per team, half rest-of-season roster strength and half results. Tap a team for the reasons behind its rank, a position-group radar, its best ROS lineup, weekly scoring and simulated playoff seeds.
- **Wire**: every add, drop and trade, newest first. Each move is graded by the consensus ROS value gained or lost. Also shows the best available free agents and a trade ledger.
- **Games**: projected scores and win odds for every matchup.
- **Nerd lab**: rank flow, luck index, points for vs against, weekly finishes heatmap, position-group ranks, playoff odds, lineup efficiency, biggest games, players the experts disagree on, and waiver/trade ROI. Its **Team dashboard** page (`#lab/team`) puts one team's season on seven animated paper widgets: playoff odds, key players, lineup efficiency, weekly scores, position groups, the schedule left and an all-play luck switch.

## How it stays up to date

| Data | Where it comes from | How fresh |
| --- | --- | --- |
| Rosters, scores, matchups, transactions | Sleeper API, via `/api/league` | Once each morning (6am Central), cached on the CDN for everyone |
| ROS rankings (FantasyPros, DraftSharks, LeagueLogs) | `api/ros.js`, a Vercel serverless function | Pulled once per day (first visitor each day, Central time), then cached at Vercel's edge |
| This week's player projections (FantasyPros API and Sleeper, averaged) | `api/ros.js`, alongside the rankings | Once per day, with the rankings; they drive the Games tab |

No cron job: the page requests `/api/ros?d=YYYY-MM-DD`, so each new day is a new cache key. If one ranking source fails, the others are still used and that response is only cached for an hour so it retries soon.

## Deploy to Vercel

1. Create a new GitHub repo and push this folder to it.
2. In Vercel, choose **Add New → Project** and import the repo. `vercel.json` sets the build (`npm ci`, `npm run build`, output `dist`), so the other settings can stay at their defaults. The build needs Node 20.19+ or 22.12+ (Project Settings → Build and Deployment → Node.js Version).
3. Deploy. The site is at `https://<project>.vercel.app`; share that link with the league.

The site is built with Vite and is moving to React a page at a time (the Team dashboard is the first). To work on it locally: `npm install` once, then `npx vercel dev` and open http://localhost:3000 (or `npm run dev` for the page alone, without the API). Add `?demo=1` to the URL to see the saved Week 7 snapshot without calling any APIs.

## Turn on FantasyPros weekly projections (one-time)

The Games tab projects each matchup from this week's player projections: FantasyPros' and Sleeper's, averaged. Sleeper needs no setup. For FantasyPros, add an environment variable `FANTASYPROS_API_KEY` (your key from https://secure.fantasypros.com/api-keys/request/) in the Vercel project's **Settings → Environment Variables**, then redeploy. Without it the Games tab runs on Sleeper's projections alone.

## Turn on the league desk (one-time)

The league desk is the discussion panel beside the headlines. Anyone can read it; only managers who have opened their personal link can post, and only Dan can delete. It uses the same Upstash store as fan picks, so set that up first.

1. In Vercel, add an environment variable `TALK_ADMIN_KEY`: any random string of 16 or more letters, numbers, `-` or `_` that only you know. Redeploy.
2. Open `https://<your site>/#join=<that key>` once on each of your devices. That signs you in as Dan.
3. In the panel, press **Invite links**, then **New link** for each manager, and DM each one their link. Opening it once signs that device in as them, and their comments show their first name and current team name.

A new link for someone replaces their old one and signs out every device that used it, so a leaked link is one click to fix. Authors can edit a comment for a minute after posting.

## Turn on fan picks (one-time)

Fan votes on the Games page need somewhere shared to live. Everything else works without it; until it's connected the voting box just doesn't appear.

1. In the Vercel dashboard, open the project and go to **Storage**.
2. Choose **Create Database**, pick **Upstash for Redis** (the free plan is plenty), and connect it to this project for all environments.
3. Redeploy (Deployments, then the three dots on the latest one, then **Redeploy**) so the function picks up the new `KV_REST_API_URL` and `KV_REST_API_TOKEN` variables.

Optional: add an environment variable `VOTE_SALT` with any random string; it's mixed into the hashed IP addresses used for the per-network vote cap.

How it works: each phone keeps a random voter id, so voting again from the same phone switches the pick instead of adding one. One network can cast at most 3 votes per matchup (so a few friends on the same Wi-Fi still can), voting closes as soon as the week's first points are scored, and tallies stay visible to everyone. It's built for fun among friends, not to stop a determined cheater.

## Tuning

| What | Where |
| --- | --- |
| League ID, time zone | top of `app.js` (`LEAGUE_ID`, `TZ`) |
| Power-score weights | `WEIGHTS` in `lib/engine.js` |
| Source weights (LeagueLogs counts half by default) | `SOURCE_WEIGHTS` in `lib/consensus.js` |
| Rank-to-value curve | `VALUE_DECAY` in `lib/consensus.js` |
| Tier labels and explanation wording | `tierFor` and `explain` in `lib/engine.js` |
| Name mismatches between sites and Sleeper | `NICKNAMES` in `lib/consensus.js` |

Check `/api/ros` in the browser to see how many players each source matched (`sources.*.matched`).

## Files

```
index.html, styles.css, app.js   the site
lib/engine.js                    power score, explanations, playoff simulation, transaction grading
lib/consensus.js                 matches ranking rows to Sleeper IDs and blends the three sources
lib/sources.js                   parsers for each ranking site
lib/weekly.js                    this week's projections: FantasyPros + Sleeper, averaged
api/talk.js                      the league desk: one discussion thread a week, personal sign-in links
lib/charts.js                    dependency-free SVG charts
api/ros.js                       daily rankings endpoint (Vercel function)
demo/demo.json                   saved Week 7 snapshot for ?demo=1
fixtures/, scripts/              saved source data and tests (node scripts/test-engine.mjs)
```

## If a ranking site changes its page

The parsers read specific page structures: FantasyPros' embedded `ecrData`, DraftSharks' `/ros-rankings/load-rows` table rows, and LeagueLogs' rankings table. If a site redesigns, that source shows as offline on the Rankings page and the other two carry the score until the parser in `lib/sources.js` is updated.

Rankings data belongs to FantasyPros, DraftSharks and LeagueLogs; league data comes from the Sleeper API. This is a personal, non-commercial league site.
