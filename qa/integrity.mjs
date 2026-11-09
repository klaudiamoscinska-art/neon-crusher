// Integrity (no browser): JavaScript syntax, runtime file set, zero external
// requests, save key in the source, GitHub Pages (Jekyll) safety of published
// Markdown, and -- with --base <ref> -- whether runtime files differ from a base.
// Usage: node qa/integrity.mjs [--base origin/main] [--no-runtime-change]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, Reporter, isMain, readText } from './lib.mjs';

/** Files the game loads at runtime. Changing this list is a release decision. */
export const RUNTIME_FILES = ['index.html', 'style.css', 'game.js'];

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function listFiles(dir, pred, acc = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) { if (!['.git', 'node_modules', 'out'].includes(e.name)) listFiles(rel, pred, acc); }
    else if (pred(rel)) acc.push(rel);
  }
  return acc;
}

export function run({ base = null, noRuntimeChange = false } = {}) {
  const r = new Reporter('integrity');

  // --- Syntax: node --check on every JS/MJS file (game.js is a classic script).
  const jsFiles = ['game.js', ...listFiles('qa', (f) => /\.(m?js)$/.test(f)), ...listFiles('.github', (f) => /\.(m?js)$/.test(f))];
  const bad = [];
  for (const f of jsFiles) {
    try { execFileSync(process.execPath, ['--check', path.join(ROOT, f)], { stdio: 'pipe' }); } catch (e) { bad.push(`${f}: ${String(e.stderr).split('\n').find((l) => /Error/.test(l)) || 'syntax error'}`); }
  }
  r.check(`syntax: node --check on ${jsFiles.length} JS files`, bad.length === 0, bad.join('; '));

  // --- Runtime file set read from index.html.
  const html = readText('index.html');
  const refs = [...html.matchAll(/<(?:script[^>]*\ssrc|link[^>]*\shref)="([^"]+)"/g)].map((m) => m[1]);
  r.check('index.html loads only style.css and game.js', JSON.stringify(refs.sort()) === JSON.stringify(['game.js', 'style.css']), refs.join(', '));
  r.check('runtime references are relative (CrazyGames: no absolute paths)', refs.every((u) => !/^(\/|[a-z]+:)/i.test(u)));
  r.check('every runtime file exists', RUNTIME_FILES.every((f) => fs.existsSync(path.join(ROOT, f))));

  // --- Zero third-party requests from the runtime.
  const ext = [];
  for (const f of RUNTIME_FILES) {
    const t = readText(f);
    for (const m of t.matchAll(/(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"'`)]*/gi)) ext.push(`${f}: ${m[0]}`);
    if (/@import|url\(\s*['"]?https?:/i.test(t)) ext.push(`${f}: @import/url()`);
  }
  r.check('runtime makes no external requests (no http(s) URLs in index.html/style.css/game.js)', ext.length === 0, ext.slice(0, 5).join('; '));

  // --- Save key and dev hooks in the shipped source.
  const game = readText('game.js');
  r.check("save key literal is 'neonCrusher.save.v1'", /const SAVE_KEY = 'neonCrusher\.save\.v1';/.test(game));
  r.check('no eval / new Function / document.write in the runtime', !/\beval\s*\(|new Function\s*\(|document\.write\s*\(/.test(game));
  r.check('no innerHTML in the runtime (text goes through textContent)', !/innerHTML/.test(game));

  // --- GitHub Pages builds main with Jekyll today (docs/RELEASE.md): Liquid tags
  //     in a published Markdown file break that build. .claude/ and .github/ are
  //     not published (dot folders).
  const md = listFiles('.', (f) => f.endsWith('.md') && !f.startsWith('.claude/') && !f.startsWith('.github/'));
  const liquid = md.filter((f) => /\{\{|\{%/.test(readText(f)));
  r.check(`Pages/Jekyll: no Liquid tags ({{ or {%) in ${md.length} published Markdown files`, liquid.length === 0, liquid.join(', '));

  // --- Runtime diff against a base ref.
  if (base) {
    let changed = null;
    try { changed = git(['diff', '--name-only', `${base}...HEAD`, '--', ...RUNTIME_FILES]).split('\n').filter(Boolean); }
    catch (e) { r.notRun(`runtime diff vs ${base}`, 'git diff failed (base ref missing? run git fetch origin main)'); }
    if (changed) {
      const dirty = git(['status', '--porcelain', '--', ...RUNTIME_FILES]).split('\n').filter(Boolean);
      const all = [...changed, ...dirty.map((l) => l.slice(3) + ' (uncommitted)')];
      if (noRuntimeChange) r.check(`runtime unchanged vs ${base} (committed + working tree)`, all.length === 0, all.join(', '));
      else r.info(`runtime files changed vs ${base}`, all.length ? all.join(', ') : 'none');
    }
  } else {
    r.notRun('runtime diff vs base', 'no --base given');
  }
  return r;
}

if (isMain(import.meta.url)) {
  const i = process.argv.indexOf('--base');
  process.exit(run({ base: i > 0 ? process.argv[i + 1] : null, noRuntimeChange: process.argv.includes('--no-runtime-change') }).finish());
}
