import { writeFileSync } from 'node:fs';
import { buildFixture } from './fixture.mjs';
const fx = buildFixture();
writeFileSync(new URL('../demo/demo.json', import.meta.url), JSON.stringify(fx));
console.log('demo.json written', JSON.stringify(fx).length, 'bytes');
