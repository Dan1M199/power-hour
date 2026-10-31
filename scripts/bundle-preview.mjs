// Builds a single self-contained HTML preview (demo data inlined) for sharing without deploying: the site's own Vite
// build (vite.config.js, React and all), with every script, stylesheet, typeface and picture inlined into one file.
// Writes dist/preview.html, and dist/artifact.html (the same page without the html/head/body skeleton).
import { build } from 'vite';
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const r = (f) => readFileSync(`${root}${f}`, 'utf8');
const tmp = 'dist/preview-build';

// the preview never shows the loader or asks for live data: drop the kicker clip and the early data script first, and
// the font preloads, so the typefaces are only named by the stylesheet and get inlined into it
const previewHtml = {
  name: 'preview-html',
  transformIndexHtml: {
    order: 'pre',
    handler: (html) => html
      .replace(/\s*<!-- the league data:[\s\S]*?-->\s*<script data-early>[\s\S]*?<\/script>/, '')
      .replace(/\s*<video class="kick"[\s\S]*?<\/video>\s*<img class="kick kick-still"[^>]*>/, '')
      .replace(/\s*<link rel="preload"[^>]*>/g, ''),
  },
};
await build({
  root,
  logLevel: 'warn',
  plugins: [previewHtml],
  build: { outDir: tmp, emptyOutDir: true, assetsInlineLimit: Number.MAX_SAFE_INTEGER, modulePreload: false },
});

// pull the built script and stylesheet into the page
const out = `${root}${tmp}`;
let html = readFileSync(`${out}/index.html`, 'utf8');
const file = (href) => readFileSync(`${out}${href}`, 'utf8');
let js = '', css = '';
html = html
  .replace(/\s*<script type="module" crossorigin src="([^"]+)"><\/script>/, (_, src) => { js = file(src); return ''; })
  .replace(/\s*<link rel="stylesheet" crossorigin href="([^"]+)">/, (_, href) => { css = file(href); return ''; });
if (/url\(\/bundle\//.test(css)) throw new Error('preview: the stylesheet still points at a file');
// anything else the page still names by file (the tab and home-screen icons) goes in as a data URI
const MIME = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', svg: 'image/svg+xml', ico: 'image/x-icon' };
html = html.replace(/(src|href)="(\/bundle\/[^"]+\.(png|webp|jpg|svg|ico))"/g, (_, attr, f, ext) => `${attr}="data:${MIME[ext]};base64,${readFileSync(`${out}${f}`).toString('base64')}"`);
if (!js || !css) throw new Error('preview: the built page has no script or no stylesheet to inline');

// the demo snapshot, the managers' headshots and the other pictures the code asks for by name (photoUrl in
// lib/members.js reads window.__HEADS__, asset() in app.js window.__ASSETS__)
const heads = Object.fromEntries(readdirSync(`${root}assets/heads`).filter((f) => f.endsWith('.jpg'))
  .map((f) => [f.slice(0, -4), `data:image/jpeg;base64,${readFileSync(`${root}assets/heads/${f}`).toString('base64')}`]));
const assets = Object.fromEntries(['assets/money-week-flyer.jpg'].map((p) => [p, `data:image/jpeg;base64,${readFileSync(`${root}${p}`).toString('base64')}`]));
const demo = r('demo/demo.json').replace(/<\//g, '<\\/');
const inline = (s) => s.replace(/<\/(script|style)/gi, '<\\/$1');
html = html.replace('</head>', () => `<style>${inline(css)}</style>
<script>window.__DEMO__ = ${demo}; window.__HEADS__ = ${JSON.stringify(heads)}; window.__ASSETS__ = ${JSON.stringify(assets)};</script>
<script type="module">${inline(js)}</script>
</head>`);
rmSync(out, { recursive: true, force: true });

writeFileSync(`${root}dist/preview.html`, html);
console.log('dist/preview.html', html.length, 'bytes');

// Artifact variant: page content only (the host adds the html/head/body skeleton).
const head = html.match(/<head>([\s\S]*)<\/head>/)[1].replace(/<meta charset[^>]*>\s*/, '').replace(/<meta name="viewport"[^>]*>\s*/, '');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
writeFileSync(`${root}dist/artifact.html`, `${head}\n${body}`);
console.log('dist/artifact.html written');
