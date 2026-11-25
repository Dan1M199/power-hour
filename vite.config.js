// The build: Vite bundles index.html, app.js, lib/ and src/ (the React pages, JSX through @vitejs/plugin-react) and
// styles.css into dist/, which Vercel serves (vercel.json).
// - Bundled files go to dist/bundle/ with a hash in their names, so they can be cached for a year (vercel.json).
// - Nothing is translated for older browsers (target esnext): the site ships the same JS and CSS features as before.
// - Files the page asks for by name at runtime aren't seen by the bundler, so they're copied as they are: assets/
//   (headshots, videos, the flyer) and demo/ (the ?demo=1 snapshot).
// - The early data script in index.html is a plain script whose import('/lib/newsclock.js') the build points at a
//   small chunk of its own, so the league data is still asked for before the main bundle arrives.
// - Each page is its own chunk (app.js, LOADERS); preloadFirstPage below starts the one the address asks for early.
// - api/ isn't part of this: Vercel builds those functions from the repo, as before.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, readFileSync, writeFileSync } from 'node:fs';

const COPY = ['assets', 'demo'];
function copyRuntimeFiles() {
  let out = 'dist';
  return {
    name: 'copy-runtime-files',
    apply: 'build',
    configResolved(c) { out = c.build.outDir; },
    closeBundle() { for (const p of COPY) cpSync(p, `${out}/${p}`, { recursive: true }); },
  };
}

// Link previews need the share picture's full address. Vercel names the production domain at build time.
function absoluteShareCard() {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  let out = 'dist';
  return {
    name: 'absolute-share-card',
    apply: 'build',
    configResolved(c) { out = c.build.outDir; },
    closeBundle() {
      if (!host) return;
      const page = `${out}/index.html`;
      writeFileSync(page, readFileSync(page, 'utf8').replace(/content="(\/bundle\/share-card-[^"]+)"/g, `content="https://${host}$1"`));
    },
  };
}

// Each page is a chunk of its own (app.js, LOADERS), which app.js would only ask for once the main bundle has run.
// This writes the address-to-files map into index.html, where a tiny script preloads the page the address asks for
// (rankings and Live for the bare address) as soon as the HTML arrives, so its code downloads alongside the main bundle.
const PAGE_SRC = {
  rankings: 'src/rankings/RankingsPage.jsx', live: 'src/live/LivePage.jsx', wire: 'src/wire/WirePage.jsx',
  matchups: 'src/games/GamesPage.jsx', lab: 'src/lab/Lab.jsx', admin: 'src/admin/AdminShell.jsx',
};
function preloadFirstPage() {
  let out = 'dist', map = null;
  return {
    name: 'preload-first-page',
    apply: 'build',
    configResolved(c) { out = c.build.outDir; },
    generateBundle(_, bundle) {
      const chunks = Object.values(bundle).filter((c) => c.type === 'chunk');
      const files = (c, seen = new Set()) => {
        if (!c || seen.has(c.fileName) || c.isEntry) return seen; // the main bundle has its own script tag
        seen.add(c.fileName);
        c.imports.forEach((f) => files(bundle[f], seen));
        return seen;
      };
      map = {};
      for (const [page, src] of Object.entries(PAGE_SRC)) {
        const c = chunks.find((x) => x.facadeModuleId?.endsWith(src));
        if (c) map[page] = [...files(c)];
      }
    },
    closeBundle() {
      if (!map) return;
      const page = `${out}/index.html`;
      const script = `<script data-pages>(function(){var m=${JSON.stringify(map)};var v=location.hash.slice(1).split('/')[0];if(v==='trades')v='lab';` +
        `(m[v]?[v]:['rankings','live']).forEach(function(k){(m[k]||[]).forEach(function(f){var l=document.createElement('link');` +
        `l.rel='modulepreload';l.href='/'+f;document.head.appendChild(l);});});})();</script>`;
      // before the stylesheet: an inline script waits for any stylesheet above it to arrive
      const html = readFileSync(page, 'utf8'), at = html.indexOf('<script type="module"');
      writeFileSync(page, at < 0 ? html.replace('</head>', `  ${script}\n</head>`) : `${html.slice(0, at)}${script}\n  ${html.slice(at)}`);
    },
  };
}

export default defineConfig({
  build: {
    outDir: 'dist',
    assetsDir: 'bundle',
    target: 'esnext',
    cssTarget: 'esnext',
    assetsInlineLimit: 0, // keep every picture and font a file of its own, as before
  },
  plugins: [react(), copyRuntimeFiles(), absoluteShareCard(), preloadFirstPage()],
});
