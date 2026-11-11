// Explicit old-v1 reconstruction for all twelve campaign sectors. Node VM
// simulation evidence only; visual quality and device coverage are separate.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {loadGame, FakeStorage, ROOT} from './lib.mjs';

const rows = [];
for (let level = 1; level <= 12; level++) {
  const payload = {cash: 1234, level, maxBalls: 7, fireRateLevel: 4, damageLevel: 5};
  const storage = new FakeStorage({'neonCrusher.save.v1': JSON.stringify(payload)});
  const h = loadGame({seed: 11, width: 907, height: 344, storage});
  const g = h.newGame();
  const hp = Math.round(10 * 1.5 ** (level - 1));
  const n = Math.min(3 + Math.floor((level - 1) / 2), 7);
  const expectedGridCount = n % 2 ? n * n : n * n - 3;
  const checks = {
    fields: Object.entries(payload).every(([key, value]) => g[key] === value),
    oneHeart: g.blocks.filter(b => b.kind === 'heart').length === 1,
    archetype: g.archetype === (level - 1) % 3,
    hp: g.blocks.every(b => b.hp === b.maxHp && b.maxHp === hp * (b.kind === 'heart' ? 6 : 1)),
    gridCount: level % 2 === 0 || g.blocks.length === expectedGridCount,
    supplyTree: g.powerEdges.length === g.blocks.length - 1 && g.blocks.every(b => {
      const seen = new Set();
      while (b && b.kind !== 'heart') {
        if (seen.has(b)) return false;
        seen.add(b); b = b.powerParent;
      }
      return !!b;
    }),
  };
  g.save();
  const saved = JSON.parse(storage.getItem('neonCrusher.save.v1'));
  checks.roundTrip = JSON.stringify(saved) === JSON.stringify(payload);
  rows.push({sector: level, status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL', blocks: g.blocks.length, archetype: g.archetype, edges: g.powerEdges.length, checks});
}

const result = {
  generatedAt: new Date().toISOString(),
  runtimeSHA256: crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'game.js'))).digest('hex'),
  scope: 'Node VM / v1 save reconstruction; no browser or device claim',
  fixture: {seed: 11, canvas: [907, 344], cash: 1234, maxBalls: 7, fireRateLevel: 4, damageLevel: 5},
  counts: {PASS: rows.filter(r => r.status === 'PASS').length, FAIL: rows.filter(r => r.status === 'FAIL').length},
  rows,
};
const output = path.join(ROOT, 'docs/art/kernelfall-v6/runtime');
fs.mkdirSync(output, {recursive: true});
fs.writeFileSync(path.join(output, 'reconstruction-results.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (result.counts.FAIL) process.exitCode = 1;
