// The Paper Widgets easings and every motion number of the dashboard's intro, in seconds from the moment it opens.

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
/** cubic in-out, the default */
export const inOut = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
/** cubic out */
export const out = (x) => { x = clamp(x); return 1 - Math.pow(1 - x, 3); };
/** back out with an overshoot of 1.5: the step bars and the equaliser */
export const back = (x) => { x = clamp(x); const c = 1.5; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
/** progress 0..1 through the slice a → b of time t, eased */
export const seg = (t, a, b, f = inOut) => f((t - a) / (b - a));

export const TL = {
  enter: [0.1, 0.75], stagger: 0.08, rise: 22, scale: 0.955, // tile i rises in over enter + i·stagger
  count: [1.0, 2.2], sun: [1.2, 2.8], sunShow: [1.2, 1.4], marks: [2.6, 3.0], // playoff odds
  progress: [1.1, 1.6], stats: [1.3, 2.3], // key players
  ticksIn: [0.9, 1.6], tickFade: 60, tickLag: 0.6, lit: [1.4, 2.8], // efficiency dial
  steps: [1.3, 2.7], bars: [1.4, 2.0], barStagger: 0.08, // scoring
  fill: [1.5, 2.5], fillStagger: 0.12, // position groups
  rows: [1.5, 2.1], rowStagger: 0.1, rowRise: 12, chip: [2.2, 2.5], // schedule
  end: 3.1,
};
