// Save: key, fields, round trip, autosave + lifecycle hooks, broken storage,
// corrupted/invalid data, validation and backup. Contract: docs/SAVE.md.
// Runs the real game.js.
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

  // --- Validation + backup (NC-04, NC-05 fixed in NC-BASIC-1; docs/SAVE.md).
  const BAK = KEY + '.bak';
  const fresh = (g) => g.cash === 0 && g.level === 1 && g.maxBalls === 1 && g.fireRateLevel === 1 && g.damageLevel === 1;
  {
    // Valid v1 saves (normal, fresh, large, fractional cash) are taken over unchanged and never backed up.
    const fixtures = [
      { cash: 0, level: 1, maxBalls: 1, fireRateLevel: 1, damageLevel: 1 },
      { cash: 12345, level: 7, maxBalls: 9, fireRateLevel: 4, damageLevel: 6 },
      { cash: 4.5e40, level: 240, maxBalls: 120, fireRateLevel: 60, damageLevel: 300 },
      { cash: 17.25, level: 1000, maxBalls: 1000, fireRateLevel: 1000, damageLevel: 1000 },
    ];
    const bad = [];
    for (const fx of fixtures) {
      const storage = new FakeStorage({ [KEY]: JSON.stringify(fx) });
      const h = loadGame({ storage }); const g = h.newGame();
      const got = { cash: g.cash, level: g.level, maxBalls: g.maxBalls, fireRateLevel: g.fireRateLevel, damageLevel: g.damageLevel };
      h.run(5.2, 60);
      const saved = JSON.parse(storage.getItem(KEY));
      const sameAfterSave = ['level', 'maxBalls', 'fireRateLevel', 'damageLevel'].every((k) => saved[k] === fx[k]) && saved.cash >= fx.cash;
      if (JSON.stringify(got) !== JSON.stringify(fx) || storage.map.has(BAK) || !sameAfterSave) bad.push(JSON.stringify(fx));
    }
    r.check(`${fixtures.length} valid v1 saves load unchanged, autosave keeps them, no backup written`, bad.length === 0, bad.join(' | '));
  }
  {
    const crashes = [];
    for (const lvl of [0, -3, 0.5, -0]) {
      try { const g = loadGame({ storage: new FakeStorage({ [KEY]: JSON.stringify({ level: lvl }) }) }).newGame(); if (g.level !== 1 || g.turrets.length < 1) crashes.push(`level=${lvl}: level ${g.level}, turrets ${g.turrets.length}`); }
      catch (e) { crashes.push(`level=${lvl}: ${e.constructor.name}`); }
    }
    const big = loadGame({ storage: new FakeStorage({ [KEY]: '{"cash":1e999,"level":1e999,"maxBalls":-1,"fireRateLevel":1e9,"damageLevel":0}' }) }).newGame();
    r.check('level <= 0 / < 1 no longer crashes the start: falls back to level 1 with a turret', crashes.length === 0, crashes.join(', '));
    r.check('Infinity / negative / zero / huge numbers fall back per field (cash 0, level 1, balls 1, fire capped 1000, damage 1)', big.cash === 0 && big.level === 1 && big.maxBalls === 1 && big.fireRateLevel === 1000 && big.damageLevel === 1 && Number.isFinite(big.fireRateCost));
  }
  {
    const storage = new FakeStorage({ [KEY]: JSON.stringify({ cash: 300, level: 4, maxBalls: 0, fireRateLevel: 2, damageLevel: 2.7 }) });
    const h = loadGame({ storage }); const g = h.newGame(); h.run(30, 60);
    r.check('mixed save: valid fields kept, maxBalls 0 -> 1, damage 2.7 -> 2; a ball spawns (no softlock)', g.level === 4 && g.fireRateLevel === 2 && g.maxBalls === 1 && g.damageLevel === 2 && g.balls.length === 1 && g.cash >= 300);
    r.check('mixed save: original string backed up before the first autosave overwrites it', storage.getItem(BAK) === JSON.stringify({ cash: 300, level: 4, maxBalls: 0, fireRateLevel: 2, damageLevel: 2.7 }));
  }
  {
    const corrupt = '{"cash": 98765, "level": 12, "maxBa';
    const storage = new FakeStorage({ [KEY]: corrupt });
    const h = loadGame({ storage }); const g = h.newGame();
    const bakBeforeAnyRun = storage.getItem(BAK); const startedFresh = fresh(g); const mainUntouched = storage.getItem(KEY) === corrupt;
    h.run(5.2, 60);
    r.check('unreadable JSON: game starts on defaults, raw string copied to "' + BAK + '" before any write', startedFresh && mainUntouched && bakBeforeAnyRun === corrupt, `bak=${bakBeforeAnyRun}`);
    r.check('unreadable JSON: backup still intact after the autosave writes a fresh save', storage.getItem(BAK) === corrupt && storage.getItem(KEY) !== corrupt && JSON.parse(storage.getItem(KEY)).level === 1);
  }
  {
    const odd = ['[1,2]', '42', 'null', '"text"', JSON.stringify({ schemaVersion: 2, cash: 50, level: 3, maxBalls: 2, fireRateLevel: 1, damageLevel: 1, gems: 4 })];
    const bad = [];
    for (const raw of odd) {
      const storage = new FakeStorage({ [KEY]: raw });
      try { const h = loadGame({ storage }); h.newGame(); h.run(5.2, 60); if (storage.getItem(BAK) !== raw) bad.push(`${raw}: no backup`); }
      catch (e) { bad.push(`${raw}: ${e.message}`); }
    }
    r.check('unsupported formats (array, number, null, string, unknown schemaVersion/extra fields) start without a crash and are backed up', bad.length === 0, bad.join(' | '));
    const g = loadGame({ storage: new FakeStorage({ [KEY]: odd[4] }) }).newGame();
    r.check('unknown-format object: known valid fields still loaded (level 3, cash 50)', g.level === 3 && g.cash === 50);
  }
  {
    // Backup impossible (quota) -> the session never overwrites the original.
    const corrupt = '{"cash": 5, "lev';
    const storage = new FakeStorage({ [KEY]: corrupt }); storage.throwOnSet = true;
    const h = loadGame({ storage }); const g = h.newGame(); storage.throwOnSet = false;
    h.run(6, 60); h.fireWindow('pagehide'); g.save();
    r.check('backup write fails -> saving is off for the session; the original save is never overwritten', storage.getItem(KEY) === corrupt && g.saveBlocked === true);
  }
  {
    const storage = new FakeStorage({ [KEY]: JSON.stringify({ cash: 70, level: 5, maxBalls: 3, fireRateLevel: 2, damageLevel: 2 }) }); storage.throwOnGet = true;
    const h = loadGame({ storage }); h.newGame(); h.run(6, 60); h.fireWindow('pagehide');
    r.check('storage unreadable at start -> no write over data the game could not read', storage.writes === 0);
  }
  {
    const h = loadGame();
    if (typeof h.sanitizeSave !== 'function') r.check('sanitizeSave exists in game.js', false, 'missing');
    else {
      const once = h.sanitizeSave({ cash: 10, level: 2.9, maxBalls: 3, fireRateLevel: 1, damageLevel: 5000 });
      const twice = h.sanitizeSave(once.values);
      r.check('sanitizeSave is idempotent (sanitised values are a valid exact save)', twice.exact === true && JSON.stringify(twice.values) === JSON.stringify(once.values) && once.exact === false);
    }
  }
  return r;
}

if (isMain(import.meta.url)) process.exit(run().finish());
