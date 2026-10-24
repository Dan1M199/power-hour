// Builds a single self-contained HTML preview (demo data inlined) for sharing without deploying.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
const r = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const strip = (src) => src.replace(/^import .*$/gm, '').replace(/^export (const|function|async function|default )/gm, '$1');
// Wrap each library in its own scope so shared helper names don't collide.
const wrap = (src) => {
  const names = [...src.matchAll(/^export (?:const|function|async function) ([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  return `const { ${names.join(', ')} } = (() => {\n${strip(src)}\nreturn { ${names.join(', ')} };\n})();`;
};
const js = [wrap(r('lib/charts.js')), wrap(r('lib/engine.js')), wrap(r('lib/matchup.js')), wrap(r('lib/stories.js')), wrap(r('lib/overrides.js')), wrap(r('lib/trades.js')), wrap(r('lib/members.js')), strip(r('app.js'))].join('\n');
// manager headshots as data URIs (photoUrl in lib/members.js reads window.__HEADS__)
const heads = Object.fromEntries(readdirSync(new URL('../assets/heads', import.meta.url)).filter((f) => f.endsWith('.jpg'))
  .map((f) => [f.slice(0, -4), `data:image/jpeg;base64,${readFileSync(new URL(`../assets/heads/${f}`, import.meta.url)).toString('base64')}`]));
const demo = r('demo/demo.json').replace(/<\//g, '<\\/');
let html = r('index.html')
  .replace('<link rel="stylesheet" href="styles.css">', `<style>${r('styles.css')}</style>`)
  .replace('<script type="module" src="app.js"></script>', `<script>window.__DEMO__ = ${demo}; window.__HEADS__ = ${JSON.stringify(heads)};</script>\n<script type="module">${js}</script>`)
  .replace('<title>The Power Hour</title>', '<title>The Power Hour</title>')
  .replace('src="assets/ttp-logo.png"', `src="data:image/png;base64,${readFileSync(new URL('../assets/ttp-logo.png', import.meta.url)).toString('base64')}"`);
mkdirSync(new URL('../dist', import.meta.url), { recursive: true });
writeFileSync(new URL('../dist/preview.html', import.meta.url), html);
console.log('dist/preview.html', html.length, 'bytes');

// Artifact variant: page content only (the host adds the html/head/body skeleton).
const head = html.match(/<head>([\s\S]*)<\/head>/)[1].replace(/<meta charset[^>]*>\s*/, '').replace(/<meta name="viewport"[^>]*>\s*/, '');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
writeFileSync(new URL('../dist/artifact.html', import.meta.url), `${head}\n${body}`);
console.log('dist/artifact.html written');
