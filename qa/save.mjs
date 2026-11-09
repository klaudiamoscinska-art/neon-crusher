// Save: key, fields, round trip, autosave + lifecycle hooks, broken storage,
// corrupted/invalid data. Contract: docs/SAVE.md. Runs the real game.js.
// Usage: node qa/save.mjs
import { loadGame, FakeStorage, Reporter, isMain } from './lib.mjs';

const KEY = 'neonCrusher.save.v1';

export function run() {
  const r = new Reporter('save');

  {
    const h = loadGame();
    r.check(`SAVE_KEY is exactly "${KEY}" (never changes)`, h.SAVE_KEY === KEY);
  }

  // --- Fresh start.
  {
    const h = loadGame(); const g = h.newGame();
    r.check('no save -> defaults (cash 0, level 1, balls 1, fire 1, damage 1)', g.cash === 0 && g.level === 1 && g.maxBalls === 1 && g.fireRateLevel === 1 && g.damageLevel === 1);
  }

  // --- Round trip through the real save()/loadSave().
  {
    const storage = new FakeStorage();
    const h = loadGame({ storage }); const g = h.newGame();
    Object.assign(g, { cash: 12345, level: 7, maxBalls: 9, fireRateLevel: 4, damageLevel: 6 });
    g.save();
    const rawStr = storage.getItem(KEY);
    const raw = rawStr ? JSON.parse(rawStr) : null;
    r.check(`save() writes under "${KEY}"`, raw !== null, rawStr === null ? `nothing under ${KEY}; keys: ${[...storage.map.keys()].join(', ')}` : '');
    r.check('save writes exactly cash, level, maxBalls, fireRateLevel, damageLevel', raw !== null && JSON.stringify(Object.keys(raw).sort()) === JSON.stringify(['cash', 'damageLevel', 'fireRateLevel', 'level', 'maxBalls']));
    const g2 = loadGame({ storage }).newGame();
    r.check('round trip restores all five fields', g2.cash === 12345 && g2.level === 7 && g2.maxBalls === 9 && g2.fireRateLevel === 4 && g2.damageLevel === 6);
    r.check('loaded level 7 regenerates its core (6x6 grid, HP 10 x 1.5^6)', g2.blocks.length === 36 && g2.blocks[0].maxHp === Math.round(10 * 1.5 ** 6));
    r.check('fire interval recomputed from the loaded level', Math.abs(g2.fireInterval - 2200 * 0.85 ** 3) < 1e-9);
  }

  // --- Autosave + lifecycle hooks.
  {
    const storage = new FakeStorage();
    const h = loadGame({ storage }); h.newGame();
    h.run(4.9, 60); const before = storage.writes;
    h.run(0.3, 60);
    r.check('autosave after 5 s of game time (not before)', before === 0 && storage.writes === 1);
    const w = storage.writes; h.fireWindow('pagehide'); h.fireWindow('beforeunload');
    h.context.document.hidden = true; h.fireDocument('visibilitychange');
    r.check('pagehide, beforeunload and visibilitychange(hidden) each save', storage.writes === w + 3);
  }

  // --- Broken storage never crashes the game.
  {
    const storage = new FakeStorage(); storage.throwOnGet = true; storage.throwOnSet = true;
    let ok = true;
    try { const h = loadGame({ storage }); const g = h.newGame(); h.run(6, 60); g.save(); ok = g.level === 1; } catch (e) { ok = false; }
    r.check('localStorage throwing on read and write (sandboxed iframe, quota) -> game runs on defaults', ok);
  }
  {
    const storage = new FakeStorage({ [KEY]: '{"cash": 50, "lev' });
    let g; let ok = true;
    try { const h = loadGame({ storage }); g = h.newGame(); } catch (e) { ok = false; }
    r.check('truncated JSON -> no crash, defaults', ok && g.cash === 0 && g.level === 1);
  }
  {
    const storage = new FakeStorage({ [KEY]: JSON.stringify({ cash: '999', level: null, maxBalls: true, fireRateLevel: [3], damageLevel: { v: 2 } }) });
    const g = loadGame({ storage }).newGame();
    r.check('fields of the wrong type are ignored', g.cash === 0 && g.level === 1 && g.maxBalls === 1 && g.fireRateLevel === 1 && g.damageLevel === 1);
  }

  // --- Known defects (docs/RISKS.md).
  {
    const corrupt = '{"cash": 98765, "level": 12, "maxBa';
    const storage = new FakeStorage({ [KEY]: corrupt });
    const h = loadGame({ storage }); h.newGame(); h.run(5.2, 60);
    r.known('NC-05', 'unreadable save is overwritten by a fresh one at the first autosave (no backup, no schema version)', storage.getItem(KEY) !== corrupt && !storage.map.has(KEY + '.bak'), `after 5 s: ${storage.getItem(KEY)}`);
  }
  {
    const accepted = [];
    const probe = (field, value) => {
      const storage = new FakeStorage({ [KEY]: JSON.stringify({ [field]: value }) });
      let g = null;
      try { g = loadGame({ storage }).newGame(); } catch (e) { accepted.push(`${field}=${value} (crash: ${e.message})`); return null; }
      if (g[field] === value) accepted.push(`${field}=${value}`);
      return g;
    };
    const crashes = [];
    for (const lvl of [0, -3, 0.5]) {
      try { loadGame({ storage: new FakeStorage({ [KEY]: JSON.stringify({ level: lvl }) }) }).newGame(); } catch (e) { crashes.push(`level=${lvl}: ${e.constructor.name}`); }
    }
    r.known('NC-04', 'save with level <= 0 crashes the Game constructor (0 turrets) on every load -- game never starts', crashes.length > 0, crashes.join(', '));
    const g0 = probe('maxBalls', 0);
    const h0 = loadGame({ storage: new FakeStorage({ [KEY]: JSON.stringify({ maxBalls: 0 }) }) }); const gs = h0.newGame(); h0.run(30, 60);
    probe('damageLevel', 0); probe('level', 2.5); probe('cash', -500); probe('fireRateLevel', 1e9);
    r.known('NC-04', 'out-of-range numbers are accepted from the save (no validation)', accepted.length > 0, accepted.join(', '));
    r.known('NC-04', 'maxBalls 0 from a save = no ball ever spawns (softlock, $0 after 30 s)', g0.maxBalls === 0 && gs.balls.length === 0 && gs.cash === 0);
  }
  return r;
}

if (isMain(import.meta.url)) process.exit(run().finish());
