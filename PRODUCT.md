# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The twelve managers of the **NFL Fantasy Championship** Sleeper league (2026 season), friends who already talk all week in a group chat. They mostly open the site on their phones from a link dropped in that chat, for short visits clustered around the football week: Tuesday morning when the new rankings land, waiver day, and the live weekend from Thursday night through Monday night. The job: find out where they stand, see who got roasted, check their odds, and grab something to argue about back in the chat.

Dan (the commissioner, a data engineer) is the editor and owner. He also uses the site as the source of stats and storylines for his league newsletter, also called The Power Hour.

## Product Purpose

The Power Hour turns one Sleeper league's data into a weekly sports desk: power rankings with reasons, a live waiver and trade feed graded by rest-of-season value, matchup odds, live-week standings, trade ideas and deeper "nerd lab" charts. It exists to make the league more fun and more talked about.

Success means:
- the rankings, headlines and roasts spark trash talk in the group chat;
- checking it becomes a weekly ritual (Tuesday rankings, the live weekend, the Monday night final);
- it feeds the newsletter with numbers and storylines Dan can lift directly.

## Positioning

It is built for exactly this league and these twelve people: their faces, their trades, their inside jokes, a defending champion, money-week side pots, a "This Guy Stinks" last place. Every number is computed the same way for everyone from one shared morning snapshot (no per-device tuning, no admin weights), so the ranks are an argument everyone sees identically. Generic fantasy apps can't be personal; this can't be generic.

## Operating Context

- The football week drives the site: morning snapshot at 6am Central, a Sunday late pull, a Monday night final call that flips the page from Live to new power rankings with a reveal.
- People arrive from the group chat link, often mid-game, on iPhones (Safari) and Android phones.
- Desktop exists but is secondary; it's where Dan and the occasional manager dig into charts and the Trade Lab.
- The newsletter is a separate ritual the site feeds; the site is not the newsletter.

## Capabilities and Constraints

- Static site on Vercel: plain HTML, CSS and ES modules, no framework, no build step, no npm dependencies. Every push to main deploys.
- Data: Sleeper API (league, rosters, matchups, transactions) and scraped ROS rankings from FantasyPros, DraftSharks and LeagueLogs. Sleeper is pulled only on the fixed clock; no new pulls for features, testing or deploys without Dan's approval.
- Pages: Live (during game weeks), Power rankings, Wire, Games (matchups), Trades (Trade Lab), Lab. Fan picks and polls through a small Upstash store.
- Must work smoothly at 390px wide and in iPhone Safari; phones get a lighter motion set.
- Hand-written SVG charts, no chart library.
- Personal, non-commercial league site; ranking data attribution stays in the footer.

## Brand Commitments

- Name: **The Power Hour**, shared with Dan's newsletter. Logo master at `assets/power_hour_logo.png`.
- Voice: a sports desk with a roast. Data-backed newsroom headlines, aggressive and funny, roasts for the bottom of the table, never mean-spirited about anyone's real life. Sentence case, plain verbs, no emoji.
- Last place always carries the tier label "This Guy Stinks" (by request).
- Manager headshots are part of the identity but used sparingly: one or two personal moments per page.
- The footer sponsor block is intentional: Dimassi's (struck through, contract expired) and current sponsor TTP (Texas Truck Parts).
- Defending champion gets a trophy mark wherever their team appears.

## Evidence on Hand

- Real league data via Sleeper; a saved week 7 snapshot in `demo/demo.json` and source fixtures in `fixtures/`.
- Manager headshots in `assets/heads/`, mapped in `lib/members.js`.
- Media: kicker loader clip, the important-message video, the Tony Pollard video headline, the money-week flyer, sponsor logos (all under `assets/`).
- There are no testimonials, user counts or external endorsements; don't invent any.

## Product Principles

1. Every claim is backed by the league's own numbers; jokes ride on data, never on made-up facts.
2. Phone-first, chat-first: a visit is a quick check from a group chat link, so the headline, your team and your odds come first.
3. One truth for everyone: identical inputs, identical ranks on every device.
4. Personal, not generic: these managers, their faces, their history, used with restraint.
5. Respect the clock: data refreshes on the league's schedule, and nothing hammers Sleeper.

## Accessibility & Inclusion

Text clears 4.5:1 contrast (including on the green field surfaces); all motion respects `prefers-reduced-motion`; video falls back to a poster and play button when autoplay is refused or Save-Data is on.
