// The news clock, shared by the page and the API functions so both agree on which Sleeper snapshot is current.
// Central time; "week minutes" count from Sunday midnight.
//
// Sleeper is read on a fixed schedule only: once per morning (the key rolls over at 6am, so last night's games are
// final) plus one late pull after Sunday night football. The API redirects any other key to the current one and keeps
// each snapshot in the store (lib/snapstore.js), so deploys, odd query strings and CDN purges never cause extra pulls.
export const TZ = 'America/Chicago';

export const NEWS_CLOCK = {
  hold: [12 * 60, 22 * 60 + 45], // Sunday noon to 10:45pm: games in progress, news on hold
  holdNote: "Games in progress: news will be updated at the conclusion of tonight's matchup.",
  late: 22 * 60 + 45, // Sunday 10:45pm: the late pull
  through: 2 * 1440 + 6 * 60, // the night edition runs until Tuesday 6am
  window: [4 * 1440 + 19 * 60 + 15, 2 * 1440 + 6 * 60], // the game window: Thursday 7:15pm kickoff to Tuesday 6am
};

export function weekMinute(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) * 1440 + Number(p.hour) * 60 + Number(p.minute);
}

const ymd = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
export const centralDate = (d = new Date()) => ymd(d);
// the Central date, rolling over at 6am
export const morningKey = (d = new Date()) => ymd(new Date(d - 6 * 36e5));
// the league snapshot: the morning one, plus a "-late" copy from Sunday's late pull until Monday 6am
export function leagueKey(d = new Date()) {
  const m = weekMinute(d);
  return m >= NEWS_CLOCK.late && m < 1440 + 6 * 60 ? `${morningKey(d)}-late` : morningKey(d);
}
export function isOnHold(d = new Date()) { const m = weekMinute(d); return m >= NEWS_CLOCK.hold[0] && m < NEWS_CLOCK.hold[1]; }
export function isNightDesk(d = new Date()) { const m = weekMinute(d); return m >= NEWS_CLOCK.late && m < NEWS_CLOCK.through; }
export function inGameWindow(d = new Date()) { const m = weekMinute(d); return m >= NEWS_CLOCK.window[0] || m < NEWS_CLOCK.window[1]; }
