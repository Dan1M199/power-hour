// The build: Vite bundles index.html, app.js, lib/ and styles.css into dist/, which Vercel serves (vercel.json). The
// code is the same plain ES modules as before; the build only bundles, minifies and fingerprints it.
// - Bundled files go to dist/bundle/ with a hash in their names, so they can be cached for a year (vercel.json).
// - Nothing is translated for older browsers (target esnext): the site ships the same JS and CSS features as before.
// - Files the page asks for by name at runtime aren't seen by the bundler, so they're copied as they are: assets/
//   (headshots, videos, the flyer) and demo/ (the ?demo=1 snapshot).
// - The early data script in index.html is a plain script whose import('/lib/newsclock.js') the build points at a
//   small chunk of its own, so the league data is still asked for before the main bundle arrives.
// - api/ isn't part of this: Vercel builds those functions from the repo, as before.
import { defineConfig } from 'vite';
import { cpSync } from 'node:fs';

const COPY = ['assets', 'demo'];

export default defineConfig({
  build: {
    outDir: 'dist',
    assetsDir: 'bundle',
    target: 'esnext',
    cssTarget: 'esnext',
    assetsInlineLimit: 0, // keep every picture and font a file of its own, as before
  },
  plugins: [{
    name: 'copy-runtime-files',
    apply: 'build',
    closeBundle() {
      for (const p of COPY) cpSync(p, `dist/${p}`, { recursive: true });
    },
  }],
});
