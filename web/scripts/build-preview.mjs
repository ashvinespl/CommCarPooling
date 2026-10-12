// Builds the prototype as ONE self-contained HTML file (JS and CSS inlined,
// in-memory routing) for hosts that serve a single page, e.g. a private
// shareable preview link. Usage: node scripts/build-preview.mjs <out.html>
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] || 'dist-preview/commcarpooling-prototype.html';
execSync('npx vite build --outDir dist-preview --base ./', { stdio: 'inherit', env: { ...process.env, VITE_ROUTER: 'memory' } });

let html = readFileSync('dist-preview/index.html', 'utf8');
html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/([^"]+)"[^>]*>/g, (_, f) => `<style>${readFileSync(join('dist-preview', f), 'utf8')}</style>`);
html = html.replace(/<script type="module"[^>]*src="\.\/([^"]+)"[^>]*><\/script>/g, (_, f) =>
  `<script type="module">${readFileSync(join('dist-preview', f), 'utf8').replace(/<\/script/gi, '<\\/script')}</script>`);
// Module scripts in <head> run deferred, so #root exists when the app mounts.
html = html
  .replace(/<!doctype html>/i, '')
  .replace(/<\/?html[^>]*>|<\/?head>|<\/?body[^>]*>/gi, '')
  .replace('<title>CommCarPooling — prototype</title>', '<title>CommCarPooling Prototype</title>\n<style>:root{color-scheme:light}body{background:#fafaf9;color:#162028}</style>');
writeFileSync(out, html.trim() + '\n');
console.log(`Wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
