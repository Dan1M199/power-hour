// Manual projection patches for players the ranking sources haven't caught up with (fresh signings etc.).
// A patch only applies while the consensus has no weekly projection for that player, so it retires itself
// once the sources list them. Delete the entry after that happens.
//
// wk is copied across every remaining week (no games discount). v is scaled from the lowest-valued
// player at the same position that does have a projection, so trade and waiver deltas stay sensible.

export const OVERRIDES = {
  // Signed by the Rams 2026-10-22; sources still have him unlisted. Sleeper projects 6.52 for week 7.
  1433: { pos: 'K', wk: 6.52, note: 'Brandon McManus: weekly projection set by hand until the rankings list him' },
};

// Hand-set injuries the sources haven't priced in yet: through is the last NFL week he's out. The engine zeroes those
// weeks and discounts his rest-of-season average for the games lost; his consensus value (trades, the wire) is cut by the
// share of the rest of the season (playoffs included) he misses. Delete the entry once he's back or the sources catch up.
export const INJURIES = {
  // Dan, Nov 9 (week 10): Puka Nacua on IR, out four weeks at least (weeks 11 to 14)
  9493: { through: 14, note: 'Puka Nacua: on IR, out weeks 11 to 14 at least' },
};
const LAST_WEEK = 17; // the fantasy season's last week (the final)

export function applyOverrides(values, overrides = OVERRIDES, { injuries = INJURIES, upcoming = null } = {}) {
  const out = { ...values };
  const applied = [];
  for (const [id, o] of Object.entries(injuries)) {
    if (!out[id] || (upcoming != null && o.through < upcoming)) continue;
    const from = upcoming ?? 1, left = Math.max(1, LAST_WEEK - from + 1), lost = Math.max(0, Math.min(o.through, LAST_WEEK) - from + 1);
    const keep = 1 - lost / left;
    out[id] = { ...out[id], outThrough: o.through, v: out[id].v != null ? Math.round(out[id].v * keep * 10) / 10 : out[id].v };
    applied.push({ id, note: o.note });
  }
  for (const [id, o] of Object.entries(overrides)) {
    if (out[id] && out[id].wk) continue;
    const peers = Object.values(values).filter((r) => r.pos === o.pos && r.wk && r.v != null);
    const floor = peers.sort((a, b) => a.v - b.v)[0];
    const v = floor ? Math.round(floor.v * Math.min(1, o.wk / floor.wk) * 10) / 10 : 0;
    const base = { r: {}, spread: 0, fl: null, cl: null, ir: null, sos: null, rk: null, prk: null, ...out[id] };
    out[id] = { ...base, v: base.v || v, pos: o.pos, wk: o.wk, g: null, wkEst: true, manual: true };
    applied.push({ id, note: o.note });
  }
  return { values: out, applied };
}
