// Idle vs active balance (measurement tool, not a suite; NC-AI-RECOVERY-1).
// Prints numbers, never PASS/FAIL. Compares two game.js builds on the same
// machine, seeds and canvases with the same greedy buyer (qa/economy.mjs):
//   node qa/idle-balance.mjs --base /tmp/base/game.js [--minutes 10] [--seeds 8]
//        [--canvas 907x339,1216x513] [--hz 60] [--jobs 4]
// Bots:
//   passive  never touches the field (autopilot fires every unused pulse);
//   active   fires every ready pulse within 0.25 s: at the AI's firewall node
//            while a shield is up (candidate only: `g.defense`), else at the
//            core (the base has no shields, so it always aims at the core);
//   core     fires every ready pulse at the core, ignoring the AI's shields
//            (shows whether breaking the node is worth a pulse).
// Per build x bot x canvas: median sector reached and median cash earned
// (spent + kept) at 1/3/5/10 min, median seconds to first reach sectors
// 3/5/7/9/11 (only sectors every run reached), plus shields raised / broken.
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadGame, isMain, ROOT } from './lib.mjs';
import { greedyBuy } from './economy.mjs';

const self = fileURLToPath(import.meta.url);
const MARKS = [1, 3, 5, 10];

/** One run in this process (NC_GAME_JS chooses the build). */
export function play({ seed, w, h, hz, minutes, bot }) {
  const hx = loadGame({ seed, width: w, height: h });
  const g = hx.newGame();
  // This tool measures fixed-step progression, not rendering cost.
  g.draw = () => {};
  let spent = 0;
  const at = {};
  const reach = {}; // sector -> seconds when first reached
  for (let s = 1; s <= minutes * 60; s++) {
    for (let q = 0; q < 4; q++) {
      hx.run(0.25, hz);
      if (bot === 'core' && g.volleyReady) g.requestVolley(g.width / 2, g.height / 2);
      if (bot === 'active' && g.volleyReady) {
        const node = g.defense && g.defense.node && g.defense.node.alive ? g.defense.node : null;
        if (node) g.requestVolley(node.cx, node.cy);
        else g.requestVolley(g.width / 2, g.height / 2);
      }
    }
    for (;;) { const before = g.cash; if (!greedyBuy(hx, g)) break; spent += before - g.cash; }
    if (MARKS.includes(s / 60) || s === minutes * 60) at[s / 60] = { level: g.level, earned: Math.round(g.cash + spent) };
    for (let l = 2; l <= g.level; l++) if (reach[l] === undefined) reach[l] = s;
  }
  return { at, reach, reroutes: g.reroutes || 0, broken: g.shieldsBroken || 0, playerBreaks: g.playerBreaks || 0 };
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };

function runJob(file, job) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [self, '--child', JSON.stringify(job)], { env: { ...process.env, NC_GAME_JS: file } });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => process.stderr.write(d));
    p.on('close', (code) => (code === 0 ? resolve(JSON.parse(out)) : reject(new Error(`child ${code}`))));
  });
}

async function main() {
  const argv = process.argv;
  const arg = (k, d) => { const i = argv.indexOf(k); return i > 0 ? argv[i + 1] : d; };
  if (argv[2] === '--child') { process.stdout.write(JSON.stringify(play(JSON.parse(argv[3])))); return; }
  const base = arg('--base', null);
  const minutes = Number(arg('--minutes', 10));
  const seeds = Array.from({ length: Number(arg('--seeds', 8)) }, (_, i) => i + 1);
  const canvases = arg('--canvas', '907x339,1216x513').split(',').map((c) => c.split('x').map(Number));
  const hzs = arg('--hz', '60').split(',').map(Number);
  const bots = arg('--bots', 'passive,active').split(',');
  const jobsN = Number(arg('--jobs', Math.max(1, os.cpus().length)));
  const builds = [];
  if (base) builds.push(['base', path.resolve(base)]);
  builds.push(['candidate', path.resolve(arg('--candidate', path.join(ROOT, 'game.js')))]);
  const jobs = [];
  for (const [name, file] of builds) for (const bot of bots) for (const [w, h] of canvases) for (const hz of hzs) for (const seed of seeds) jobs.push({ name, file, job: { seed, w, h, hz, minutes, bot } });
  const results = new Array(jobs.length);
  let next = 0;
  await Promise.all(Array.from({ length: jobsN }, async () => {
    while (next < jobs.length) { const i = next++; results[i] = await runJob(jobs[i].file, jobs[i].job); }
  }));
  const groups = new Map();
  jobs.forEach((j, i) => {
    const key = `${j.name} ${j.job.bot} ${j.job.w}x${j.job.h} ${j.job.hz}Hz`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(results[i]);
  });
  const table = {};
  for (const [key, rs] of groups) {
    const marks = MARKS.filter((m) => m <= minutes);
    const lv = marks.map((m) => median(rs.map((r) => r.at[m].level)));
    const cash = marks.map((m) => median(rs.map((r) => r.at[m].earned)));
    const sectors = [3, 5, 7, 9, 11, 13].filter((l) => rs.every((r) => r.reach[l] !== undefined));
    const reachT = sectors.map((l) => median(rs.map((r) => r.reach[l])));
    table[key] = { reachSectors: sectors, reachT, levels: lv, earned: cash, reroutes: median(rs.map((r) => r.reroutes)), broken: median(rs.map((r) => r.broken)), playerBreaks: median(rs.map((r) => r.playerBreaks)), finalLevels: rs.map((r) => r.at[minutes].level) };
    console.log(`${key.padEnd(36)} sector at ${marks.join('/')} min: ${lv.join('/')}  earned $ ${cash.join('/')}  reach sector ${sectors.join('/')} at ${reachT.join('/')} s  shields ${table[key].reroutes} broken ${table[key].broken} (by player ${table[key].playerBreaks})  final sectors ${table[key].finalLevels.join(',')}`);
  }
  console.log(JSON.stringify(table));
}

if (isMain(import.meta.url)) await main();
