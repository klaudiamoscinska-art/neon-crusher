// Instructions & docs (no browser): CLAUDE.md budget and required rules,
// skill format and discovery rules, skill map in sync with docs/claude/SKILLS.md,
// every referenced path exists, duplicated instructions, oversized docs,
// every KNOWN defect id used by qa/ is registered in docs/RISKS.md.
// This is the periodic "efficiency control" of docs/claude/TOKENS.md.
// Usage: node qa/instructions.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, Reporter, isMain, readText } from './lib.mjs';

export const CLAUDE_BUDGET = 9000;       // bytes, loaded into every session
export const DESC_BUDGET = 300;          // chars per skill description (loaded every session)
export const DOC_BUDGET = 20000;         // bytes per on-demand doc
export const SKILL_BUDGET = 6000;        // bytes per SKILL.md body

/** One regex per non-negotiable rule that CLAUDE.md must state (or point to). */
export const REQUIRED_RULES = [
  ['Polish for owner-facing replies/reports/HANDOFF', /Polish/],
  ['one copyable code block for reports', /ONE Markdown code block/],
  ['roles: owner, GPT, Claude', /Owner.*GPT.*Claude/s],
  ['production main protected, no merge/deploy', /Never commit or push to `main`, never merge a PR/],
  ['preflight before work', /Preflight/],
  ['no destructive git', /No destructive git/],
  ['save key never changes', /`neonCrusher\.save\.v1` never changes/],
  ['runtime files need explicit scope', /`game\.js`, `index\.html`, `style\.css`/],
  ['no dependencies / no build step without owner', /No dependencies/],
  ['evidence: NOT RUN never PASS', /`NOT RUN`, never `PASS`/],
  ['HANDOFF mandatory', /HANDOFF is mandatory/],
  ['skills on demand, 1-3', /1–3 skills/],
  ['GitHub Pages deploys main', /GitHub Pages/],
  ['no CrazyGames SDK/ads before the stage', /SDK/],
  ['token rules pointer', /docs\/claude\/TOKENS\.md/],
];

const PATH_RE = /`((?:\.claude|\.github|docs|qa)\/[^`\s*]+?|CLAUDE\.md|README\.md|index\.html|style\.css|game\.js)`/g;
export function referencedPaths(text) {
  return [...new Set([...text.matchAll(PATH_RE)].map((m) => m[1].replace(/[),.:;]+$/, '').replace(/#.*$/, '')).filter((p) => !/[<>{}]|\.\.\.|…/.test(p)))];
}

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z-]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].replace(/^"(.*)"$/, '$1');
  }
  return { fm, body: text.slice(m[0].length) };
}

export function run() {
  const r = new Reporter('instructions');

  // --- CLAUDE.md
  const claude = readText('CLAUDE.md');
  r.check(`CLAUDE.md within ${CLAUDE_BUDGET} bytes`, Buffer.byteLength(claude) <= CLAUDE_BUDGET, `${Buffer.byteLength(claude)} bytes`);
  const missing = REQUIRED_RULES.filter(([, re]) => !re.test(claude)).map(([n]) => n);
  r.check(`CLAUDE.md states ${REQUIRED_RULES.length} required rules`, missing.length === 0, missing.join('; '));

  // --- Skills: format (Claude Code: .claude/skills/<name>/SKILL.md, YAML
  //     frontmatter with name + description), names, budgets.
  const skillDir = path.join(ROOT, '.claude', 'skills');
  const skills = fs.existsSync(skillDir) ? fs.readdirSync(skillDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : [];
  const fmErr = []; const descLong = []; const bodyLong = []; let descTotal = 0;
  const bodies = {};
  for (const s of skills) {
    const f = path.join(skillDir, s, 'SKILL.md');
    if (!fs.existsSync(f)) { fmErr.push(`${s}: no SKILL.md`); continue; }
    const parsed = frontmatter(fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n'));
    if (!parsed) { fmErr.push(`${s}: no frontmatter`); continue; }
    const { fm, body } = parsed;
    bodies[s] = body;
    if (fm.name !== s) fmErr.push(`${s}: name "${fm.name}" != folder`);
    if (!/^[a-z0-9-]{1,64}$/.test(fm.name || '')) fmErr.push(`${s}: bad name`);
    if (!fm.description) fmErr.push(`${s}: no description`);
    else {
      descTotal += fm.description.length;
      if (fm.description.length > DESC_BUDGET) descLong.push(`${s}: ${fm.description.length}`);
      if (/[<>]/.test(fm.description)) fmErr.push(`${s}: angle brackets in description`);
    }
    if (Buffer.byteLength(body) > SKILL_BUDGET) bodyLong.push(`${s}: ${Buffer.byteLength(body)} B`);
  }
  r.check('skills exist under .claude/skills/', skills.length > 0, `${skills.length}`);
  r.check('every skill: SKILL.md, frontmatter, name = folder, lowercase-hyphen name, description', fmErr.length === 0, fmErr.join('; '));
  r.check(`every description <= ${DESC_BUDGET} chars (loaded into every session)`, descLong.length === 0, descLong.join(', '));
  r.check(`every SKILL.md body <= ${SKILL_BUDGET} bytes`, bodyLong.length === 0, bodyLong.join(', '));
  r.info('always-loaded context', `CLAUDE.md ${Buffer.byteLength(claude)} B + ${skills.length} skill descriptions ${descTotal} chars`);

  // --- Skill map in sync.
  const map = readText('docs/claude/SKILLS.md');
  const listed = [...new Set([...map.matchAll(/`(nc-[a-z0-9-]+)`/g)].map((m) => m[1]))].sort();
  r.check('docs/claude/SKILLS.md lists exactly the installed skills', JSON.stringify(listed) === JSON.stringify(skills), `listed=${listed.join(',')} installed=${skills.join(',')}`);
  const crossRefs = [];
  for (const [s, body] of Object.entries(bodies)) for (const m of body.matchAll(/`(nc-[a-z0-9-]+)`/g)) if (!skills.includes(m[1])) crossRefs.push(`${s} -> ${m[1]}`);
  r.check('skills only reference existing skills', crossRefs.length === 0, crossRefs.join(', '));

  // --- Every referenced path exists.
  const docFiles = ['CLAUDE.md', 'qa/README.md', ...fs.readdirSync(path.join(ROOT, 'docs')).filter((f) => f.endsWith('.md')).map((f) => `docs/${f}`), ...fs.readdirSync(path.join(ROOT, 'docs', 'claude')).map((f) => `docs/claude/${f}`), ...skills.map((s) => `.claude/skills/${s}/SKILL.md`)];
  const dead = [];
  for (const f of docFiles) for (const p of referencedPaths(readText(f))) if (!p.startsWith('qa/out') && !fs.existsSync(path.join(ROOT, p))) dead.push(`${f} -> ${p}`);
  r.check(`every backticked repo path in ${docFiles.length} instruction/doc files exists`, dead.length === 0, dead.slice(0, 8).join('; '));

  // --- Oversized docs.
  const big = docFiles.filter((f) => !f.startsWith('.claude/') && Buffer.byteLength(readText(f)) > DOC_BUDGET).map((f) => `${f}: ${Buffer.byteLength(readText(f))} B`);
  r.check(`every doc <= ${DOC_BUDGET} bytes (split or trim when it grows)`, big.length === 0, big.join(', '));

  // --- Duplicated instructions: the same long line in two instruction files
  //     means a rule has two homes (one-source-of-truth violation).
  const seen = new Map(); const dups = [];
  for (const f of docFiles) {
    for (const raw of readText(f).split('\n')) {
      const line = raw.trim().replace(/^[-*>|#\d.\s]+/, '');
      if (line.length < 80 || line.startsWith('```') || /^\|/.test(raw.trim())) continue;
      if (seen.has(line) && seen.get(line) !== f) dups.push(`${seen.get(line)} & ${f}: "${line.slice(0, 50)}..."`);
      else seen.set(line, f);
    }
  }
  r.check('no instruction line (>= 80 chars) duplicated across files', dups.length === 0, dups.slice(0, 4).join(' | '));

  // --- KNOWN ids used by qa/ are in the risk register.
  const risks = readText('docs/RISKS.md');
  const ids = new Set();
  for (const f of fs.readdirSync(path.join(ROOT, 'qa')).filter((x) => x.endsWith('.mjs') && x !== 'instructions.mjs')) {
    for (const m of readText(`qa/${f}`).matchAll(/known\('(NC-\d+)'/g)) ids.add(m[1]);
    for (const m of readText(`qa/${f}`).matchAll(/notRun\('\[(NC-\d+)\]/g)) ids.add(m[1]);
  }
  const unregistered = [...ids].filter((id) => !new RegExp(`\\b${id}\\b`).test(risks));
  r.check(`${ids.size} known-defect ids used by qa/ are registered in docs/RISKS.md`, ids.size > 0 && unregistered.length === 0, unregistered.join(', '));
  return r;
}

if (isMain(import.meta.url)) process.exit(run().finish());
