// Browser smoke test in real Chromium at the CrazyGames iframe sizes (DPR 1):
// loads without errors or external requests in an English and a Polish
// browser, animates, fits without page scroll, text readable and inside its
// box, save survives a reload, a corrupted save is backed up.
// Screenshots: qa/out/shots/.
// Needs Playwright already installed on the machine (never added as a repo
// dependency). Without it every check is NOT RUN -- never PASS.
// Usage: node qa/browser-smoke.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, OUT, Reporter, isMain, CG_FRAMES } from './lib.mjs';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const id of ['playwright', 'playwright-core']) { try { return require(id); } catch { /* next */ } }
  return null;
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(ROOT, url === '/' ? 'index.html' : url);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

export async function run() {
  const r = new Reporter('browser-smoke');
  // NC_QA_NO_BROWSER=1 simulates a machine without Playwright (qa/runner.mjs uses it).
  const pw = process.env.NC_QA_NO_BROWSER === '1' ? null : loadPlaywright();
  if (!pw) { r.envUnavailable('browser smoke (all checks)', 'Playwright not installed on this machine'); return r; }
  let browser;
  try { browser = await pw.chromium.launch(); } catch (e) { r.envUnavailable('browser smoke (all checks)', `Chromium failed to launch: ${e.message.split('\n')[0]}`); return r; }
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const shots = path.join(OUT, 'shots'); fs.mkdirSync(shots, { recursive: true });

  const errors = []; const external = []; const scroll = []; const shopOff = []; const still = []; const sizes = []; const fonts = [];
  const overflow = []; const smallCanvas = []; const langs = {}; const titles = {}; const hintBad = []; const hintTexts = {};
  let userSelect = null; let safeArea = null;
  try {
    for (const locale of ['en-US', 'pl-PL']) {
      for (const [w, h] of CG_FRAMES) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale });
        const page = await ctx.newPage();
        const tag = `${locale} ${w}x${h}`;
        page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
        page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag}: ${m.text()}`); });
        page.on('request', (q) => { if (!q.url().startsWith(base)) external.push(q.url()); });
        await page.goto(base + 'index.html');
        await page.waitForTimeout(600);
        const m = await page.evaluate(() => {
          const c = document.getElementById('gameCanvas').getBoundingClientRect();
          const shop = document.getElementById('shop').getBoundingClientRect();
          let minFont = 99; const over = [];
          for (const el of document.querySelectorAll('body *')) {
            if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
            minFont = Math.min(minFont, parseFloat(getComputedStyle(el).fontSize));
          }
          for (const el of document.querySelectorAll('#topbar *, .shop-btn, .shop-btn *')) if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) over.push(el.id || el.className);
          let css = '';
          for (const sheet of document.styleSheets) for (const rule of sheet.cssRules) css += rule.cssText;
          const insets = ['top', 'bottom', 'left', 'right'].filter((side) => css.includes(`safe-area-inset-${side}`));
          const hEl = document.getElementById('hint'); const hr = hEl.getBoundingClientRect();
          const hint = { visible: !hEl.hidden && hr.width > 0, text: hEl.textContent, inside: hr.left >= c.left && hr.right <= c.right && hr.top >= c.top && hr.bottom <= c.bottom,
            cut: hEl.scrollWidth > hEl.clientWidth + 1, passThrough: getComputedStyle(hEl).pointerEvents === 'none' && document.elementFromPoint(hr.left + hr.width / 2, hr.top + hr.height / 2)?.id === 'gameCanvas' };
          return { hint, cw: c.width, ch: c.height, shopBottom: shop.bottom, sh: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth, us: getComputedStyle(document.body).userSelect, minFont, over, lang: document.documentElement.lang, title: document.querySelector('.shop-btn__title').textContent, insets };
        });
        sizes.push(`${w}x${h}->${Math.round(m.cw)}x${Math.round(m.ch)}`);
        fonts.push(m.minFont);
        userSelect = userSelect === null || userSelect === 'none' ? m.us : userSelect;
        safeArea = m.insets;
        (langs[locale] ||= new Set()).add(m.lang); (titles[locale] ||= new Set()).add(m.title);
        if (m.over.length) overflow.push(`${tag}: ${m.over.join(',')}`);
        if (!m.hint.visible || !m.hint.inside || m.hint.cut || !m.hint.passThrough) hintBad.push(`${tag}: ${JSON.stringify(m.hint)}`);
        (hintTexts[locale] ||= new Set()).add(m.hint.text);
        if (m.ch / h < 0.7) smallCanvas.push(`${tag}: ${Math.round((100 * m.ch) / h)}%`);
        if (m.sh > h + 1 || m.sw > w + 1) scroll.push(tag);
        if (m.shopBottom > h + 1) shopOff.push(tag);
        const a = await page.screenshot();
        await page.waitForTimeout(400);
        const b = await page.screenshot({ path: path.join(shots, `frame-${locale}-${w}x${h}.png`) });
        if (a.equals(b)) still.push(tag);
        await ctx.close();
      }
    }
    r.check('10 CrazyGames frames x 2 languages: no page errors / console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    r.check('no request leaves the local server', external.length === 0, external.slice(0, 3).join(', '));
    r.check('no page scroll at any frame', scroll.length === 0, scroll.join(', '));
    r.check('shop fully visible at every frame', shopOff.length === 0, shopOff.join(', '));
    r.check('canvas animates (two screenshots 400 ms apart differ)', still.length === 0, still.join(', '));
    r.check('[NC-07] English browser -> English UI (lang="en", "Buy new ball") at every frame', [...langs['en-US']].join() === 'en' && [...titles['en-US']].join() === 'Buy new ball', `lang=${[...langs['en-US']]}, "${[...titles['en-US']]}"`);
    r.check('[NC-07] Polish browser -> Polish UI kept (lang="pl", "Kup nową kulę") at every frame', [...langs['pl-PL']].join() === 'pl' && [...titles['pl-PL']].join() === 'Kup nową kulę', `lang=${[...langs['pl-PL']]}, "${[...titles['pl-PL']]}"`);
    r.check('[NC-17] no text overflows its box in the top bar or the shop (both languages)', overflow.length === 0, overflow.slice(0, 4).join(' | '));
    r.check('first-minute hint on a fresh save: visible, inside the field, not cut off, taps pass through to the game (both languages)', hintBad.length === 0, hintBad.slice(0, 2).join(' | ') || `en: ${[...hintTexts['en-US']]} | pl: ${[...hintTexts['pl-PL']]}`);
    r.check('[NC-17] smallest text >= 11 px at DPR 1', Math.min(...fonts) >= 11, `${Math.min(...fonts)} px`);
    // Layout guard: canvas sizes stay pinned to the NC-FOUNDATION-1 baseline;
    // a layout change (NC-17) is its own decision. Since NC-CORE-1A the world
    // scale keeps the pace nearly independent of the canvas size (NC-09).
    const BASELINE = '907x510->907x339 1216x684->1216x513 1077x606->1077x435 821x462->821x291 1366x768->1366x597 1920x1080->1920x909 1536x864->1536x693 1280x720->1280x549 800x450->800x279 1080x607->1080x436';
    r.check('canvas size at every frame and language unchanged vs baseline (gameplay pace unaffected)', sizes.join(' ') === `${BASELINE} ${BASELINE}`, sizes.filter((x) => !BASELINE.split(' ').includes(x)).join(' '));
    r.info('[NC-17] canvas share of the iframe height below 70 % (open, see docs/RISKS.md)', smallCanvas.length ? smallCanvas.join(', ') : 'none');
    r.check('[NC-08] body has user-select: none (CrazyGames technical requirement for mobile)', userSelect === 'none', `computed: ${userSelect}`);
    r.check('[NC-18] stylesheet pads all four safe-area insets (env(safe-area-inset-*))', safeArea && safeArea.length === 4, `found: ${safeArea}`);
    r.notRun('[NC-18] safe areas on a notched phone / in the CrazyGames app', 'Chromium cannot emulate env(safe-area-inset-*); needs a device or CrazyGames Preview (owner)');

    // Breach controls (NC-ORIGINAL-1) in a real browser, observed through the
    // DOM only (no debug hooks in the runtime): when the first volley is ready
    // the hint asks for a click/tap; a click (mouse) or a tap (touch) on the
    // core fires it, which ends that hint at once. Sound toggle persists.
    for (const [label, opts, act] of [
      ['mouse', { viewport: { width: 907, height: 510 } }, async (pg, x, y) => { await pg.mouse.click(x, y); }],
      ['touch', { viewport: { width: 800, height: 450 }, hasTouch: true, isMobile: true, locale: 'pl-PL' }, async (pg, x, y) => { await pg.touchscreen.tap(x, y); }],
    ]) {
      const vctx = await browser.newContext({ deviceScaleFactor: 1, ...opts });
      const vp = await vctx.newPage();
      const verrs = [];
      vp.on('pageerror', (e) => verrs.push(e.message));
      vp.on('console', (m) => { if (m.type() === 'error') verrs.push(m.text()); });
      await vp.goto(base + 'index.html');
      const hintNow = () => vp.evaluate(() => ({ text: document.getElementById('hint').textContent, action: document.getElementById('hint').classList.contains('hint--action'), cash: document.getElementById('statCash').textContent }));
      let before = null;
      for (let i = 0; i < 40; i++) { await vp.waitForTimeout(250); before = await hintNow(); if (before.action) break; }
      const box = await vp.locator('#gameCanvas').boundingBox();
      await act(vp, box.x + box.width / 2, box.y + box.height / 2);
      await vp.waitForTimeout(250);
      const after = await hintNow();
      // Proof it was the player's volley, not the autopilot's: the volley
      // hint lasts until the first hand-aimed volley, so it must not return
      // when the next volley is ready (11 s charge + 5 s autopilot window).
      let returned = false;
      for (let i = 0; i < 13; i++) { await vp.waitForTimeout(1000); if ((await hintNow()).action) { returned = true; break; } }
      if (label === 'mouse') {
        await vp.click('#btnMute');
        const m1 = await vp.evaluate(() => ({ pressed: document.getElementById('btnMute').getAttribute('aria-pressed'), pref: localStorage.getItem('neonCrusher.audio.v1') }));
        await vp.reload(); await vp.waitForTimeout(300);
        const m2 = await vp.evaluate(() => document.getElementById('btnMute').getAttribute('aria-pressed'));
        r.check('sound toggle: aria-pressed true, preference stored under neonCrusher.audio.v1, still muted after a reload', m1.pressed === 'true' && m1.pref === 'muted' && m2 === 'true', JSON.stringify({ ...m1, afterReload: m2 }));
        await vp.screenshot({ path: path.join(shots, 'breach-mouse-907x510.png') });
      }
      r.check(`volley by ${label}: ready hint shown within 10 s, ${label === 'mouse' ? 'a click' : 'a tap'} on the core fires it (hint ends and does not return at the next charge), no errors`, before && before.action && !after.action && !returned && verrs.length === 0, JSON.stringify({ before, after, returned, verrs }));
      await vctx.close();
    }

    // Save restored on load, and the running game's own save survives a reload.
    // (Writing localStorage from outside and reloading would be overwritten by
    // the game's beforeunload save, so the save is injected before game.js runs.)
    const ctx = await browser.newContext({ viewport: { width: 907, height: 510 } });
    await ctx.addInitScript(() => {
      if (!sessionStorage.getItem('qaSeeded')) {
        sessionStorage.setItem('qaSeeded', '1');
        localStorage.setItem('neonCrusher.save.v1', JSON.stringify({ cash: 4321, level: 3, maxBalls: 2, fireRateLevel: 1, damageLevel: 2 }));
      }
    });
    const page = await ctx.newPage();
    await page.goto(base + 'index.html'); await page.waitForTimeout(300);
    const read = () => page.evaluate(() => ({ lvl: document.getElementById('statLevel').textContent, cash: document.getElementById('statCash').textContent, bak: localStorage.getItem('neonCrusher.save.v1.bak') }));
    const ui = await read();
    r.check('save in localStorage is restored on load (level 3, cash >= $4321), no backup for a valid save', ui.lvl === '3' && Number(ui.cash.replace(/\D/g, '')) >= 4321 && ui.bak === null, JSON.stringify(ui));
    await page.reload(); await page.waitForTimeout(300);
    const ui2 = await read();
    r.check('reload keeps the progress (beforeunload/pagehide save)', ui2.lvl === '3', JSON.stringify(ui2));
    await ctx.close();

    // Corrupted save in a real browser: the game starts, the original is kept.
    const corrupt = '{"cash": 98765, "level": 12, "maxBa';
    const ctx2 = await browser.newContext({ viewport: { width: 800, height: 450 } });
    await ctx2.addInitScript((raw) => {
      if (!sessionStorage.getItem('qaSeeded')) { sessionStorage.setItem('qaSeeded', '1'); localStorage.setItem('neonCrusher.save.v1', raw); }
    }, corrupt);
    const page2 = await ctx2.newPage();
    const errs2 = [];
    page2.on('pageerror', (e) => errs2.push(e.message));
    await page2.goto(base + 'index.html'); await page2.waitForTimeout(300);
    await page2.reload(); await page2.waitForTimeout(300);
    const st = await page2.evaluate(() => ({ lvl: document.getElementById('statLevel').textContent, bak: localStorage.getItem('neonCrusher.save.v1.bak'), main: localStorage.getItem('neonCrusher.save.v1') }));
    let mainOk = false; try { mainOk = JSON.parse(st.main).level === 1; } catch { mainOk = false; }
    r.check('[NC-05] corrupted save: game starts (level 1, no page error), original kept in .bak after a reload, new save valid', errs2.length === 0 && st.lvl === '1' && st.bak === corrupt && mainOk, JSON.stringify({ ...st, errs2 }));
    await ctx2.close();
  } finally {
    await browser.close();
    server.close();
  }
  return r;
}

if (isMain(import.meta.url)) run().then((r) => process.exit(r.finish({ optional: true })));
