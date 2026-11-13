// Seed the finish from the story's identity, so edits, reordering and re-renders
// don't shuffle its material. Keep the pigment at the edges for readable copy.
// 5.0 (flowy glass): each headline card is vespers glass lit by two of the sky's hazes (halo gold, seraph sky, blush,
// lilac), picked by the story's key, so every card catches a different light.
const LIGHTS = ['242,196,94', '156,200,244', '247,170,205', '190,170,255'];
export function pigmentFor(key) {
  let seed = 2166136261;
  for (const char of String(key)) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  const finish = seed % 4;
  const warmX = seed & 4 ? 100 : 0;
  const warmY = 58 + ((seed >>> 4) % 43);
  const coolX = 100 - warmX;
  const angle = 115 + ((seed >>> 9) % 55);
  const warm = LIGHTS[seed % LIGHTS.length], cool = LIGHTS[(seed >>> 3) % LIGHTS.length === seed % LIGHTS.length ? (seed + 1) % LIGHTS.length : (seed >>> 3) % LIGHTS.length];
  const a = [0.42, 0.3, 0.36, 0.32][finish];
  const b = [0.22, 0.3, 0.24, 0.28][finish];
  const gloss = finish === 1 || finish === 3;
  return {
    '--pigment': [
      gloss ? `linear-gradient(${angle}deg, transparent 16%, rgba(255,255,255,0.1) 30%, rgba(255,255,255,0.02) 44%, transparent 45%)` : 'linear-gradient(transparent, transparent)',
      `radial-gradient(ellipse ${60 + seed % 35}% 80% at ${coolX}% ${seed % 25}%, rgba(${cool},${b}), transparent 75%)`,
      `radial-gradient(ellipse 85% ${65 + seed % 30}% at ${warmX}% ${warmY}%, rgba(${warm},${a}), transparent 80%)`,
    ].join(', '),
    '--pigment-grain': gloss ? '0.04' : '0.1',
    '--pigment-rim': gloss ? '0.28' : '0.12',
  };
}
