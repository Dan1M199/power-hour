// Seed the finish from the story's identity, so edits, reordering and re-renders
// don't shuffle its material. Keep the pigment at the edges for readable copy.
export function pigmentFor(key) {
  let seed = 2166136261;
  for (const char of String(key)) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  const finish = seed % 4;
  const redX = seed & 4 ? 100 : 0;
  const redY = 58 + ((seed >>> 4) % 43);
  const iceX = 100 - redX;
  const angle = 115 + ((seed >>> 9) % 55);
  const red = [0.5, 0.22, 0.38, 0.3][finish];
  const ice = [0.09, 0.23, 0.14, 0.18][finish];
  const gloss = finish === 1 || finish === 3;
  return {
    '--pigment': [
      gloss ? `linear-gradient(${angle}deg, transparent 16%, rgba(223,229,235,0.12) 30%, rgba(223,229,235,0.025) 44%, transparent 45%)` : 'linear-gradient(transparent, transparent)',
      `radial-gradient(ellipse ${60 + seed % 35}% 80% at ${iceX}% ${seed % 25}%, rgba(223,229,235,${ice}), transparent 75%)`,
      `radial-gradient(ellipse 85% ${65 + seed % 30}% at ${redX}% ${redY}%, rgba(239,35,60,${red}), transparent 80%)`,
      `radial-gradient(ellipse at ${100 - iceX}% 0%, rgba(163,18,42,0.22), transparent 65%)`,
    ].join(', '),
    '--pigment-grain': gloss ? '0.045' : '0.16',
    '--pigment-rim': gloss ? '0.28' : '0.08',
  };
}
