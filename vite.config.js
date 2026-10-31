// The build: Vite bundles index.html, app.js, lib/, src/ (the React parts) and styles.css into dist/, which Vercel
// serves (vercel.json). The site is moving to React a page at a time: src/ holds the pages already moved (JSX, through
// @vitejs/plugin-react), app.js mounts them; everything else is still the plain ES modules it was.
// - Bundled files go to dist/bundle/ with a hash in their names, so they can be cached for a year (vercel.json).
// - Nothing is translated for older browsers (target esnext): the site ships the same JS and CSS features as before.
// - Files the page asks for by name at runtime aren't seen by the bundler, so they're copied as they are: assets/
//   (headshots, videos, the flyer) and demo/ (the ?demo=1 snapshot).
// - The early data script in index.html is a plain script whose import('/lib/newsclock.js') the build points at a
//   small chunk of its own, so the league data is still asked for before the main bundle arrives.
// - api/ isn't part of this: Vercel builds those functions from the repo, as before.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync } from 'node:fs';

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

export default defineConfig({
  build: {
    outDir: 'dist',
    assetsDir: 'bundle',
    target: 'esnext',
    cssTarget: 'esnext',
    assetsInlineLimit: 0, // keep every picture and font a file of its own, as before
  },
  plugins: [react(), copyRuntimeFiles()],
});
