// Localization (NC-07): English + Polish string tables, language selection,
// English fallback, number formatting, every visible label translated.
// Runs the real game.js (qa/lib.mjs harness). Browser check of both
// languages: qa/browser-smoke.mjs.
// Usage: node qa/i18n.mjs
import { loadGame, Reporter, isMain, readText } from './lib.mjs';

/** Every element whose text the game sets (static labels + dynamic values). */
const TEXT_IDS = ['labelCash', 'labelLevel', 'titleBuyBall', 'titleFireRate', 'titleDamage', 'statCash', 'statLevel', 'descBuyBall', 'costBuyBall', 'descFireRate', 'costFireRate', 'descDamage', 'costDamage'];
const POLISH_CHARS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]|\b(Kasa|Poziom|Kup|Kulki|Szybkość|Siła)\b/;

function texts(h) {
  return Object.fromEntries(TEXT_IDS.map((id) => [id, h.el(id).textContent]));
}

export function run() {
  const r = new Reporter('i18n');
  const probe = loadGame();
  if (!probe.STRINGS || typeof probe.detectLanguage !== 'function') {
    r.check('game.js defines STRINGS and detectLanguage', false, 'missing (no localization)');
    return r;
  }
  const { STRINGS, detectLanguage } = probe;

  // --- Tables.
  const langs = Object.keys(STRINGS).sort();
  r.check('exactly two languages: en, pl', JSON.stringify(langs) === '["en","pl"]', langs.join(','));
  r.check('default (fallback) language is English', probe.DEFAULT_LANGUAGE === 'en');
  const keysEn = Object.keys(STRINGS.en).sort(); const keysPl = Object.keys(STRINGS.pl).sort();
  r.check('en and pl tables have the same keys', JSON.stringify(keysEn) === JSON.stringify(keysPl), `en-only: ${keysEn.filter((k) => !keysPl.includes(k))}, pl-only: ${keysPl.filter((k) => !keysEn.includes(k))}`);
  const empty = [];
  for (const l of langs) for (const [k, v] of Object.entries(STRINGS[l])) if (typeof v !== 'string' || !v.trim()) empty.push(`${l}.${k}`);
  r.check('no empty or non-string entries', empty.length === 0, empty.join(', '));
  const placeholders = keysEn.filter((k) => JSON.stringify(STRINGS.en[k].match(/\{\w+\}/g) || []) !== JSON.stringify(STRINGS.pl[k].match(/\{\w+\}/g) || []));
  r.check('placeholders ({n}) match between languages', placeholders.length === 0, placeholders.join(', '));
  const plInEn = Object.entries(STRINGS.en).filter(([, v]) => POLISH_CHARS.test(v)).map(([k]) => k);
  r.check('English table contains no Polish text', plInEn.length === 0, plInEn.join(', '));

  // --- Language selection.
  const cases = [
    [{ languages: ['pl-PL', 'pl'], language: 'pl-PL' }, '', 'pl', 'pl-PL browser'],
    [{ languages: ['en-US'], language: 'en-US' }, '', 'en', 'en-US browser'],
    [{ languages: ['de-DE', 'fr'], language: 'de-DE' }, '', 'en', 'unsupported (de, fr) -> English'],
    [{ languages: ['de-DE', 'pl'], language: 'de-DE' }, '', 'pl', 'first supported in the preference list'],
    [{ language: 'PL' }, '', 'pl', 'only navigator.language, upper case'],
    [null, '', 'en', 'no navigator -> English'],
    [{ languages: [], language: '' }, '', 'en', 'empty language info -> English'],
    [{ languages: ['pl-PL'] }, '?lang=en', 'en', '?lang=en overrides a Polish browser'],
    [{ languages: ['en-US'] }, '?x=1&lang=pl', 'pl', '?lang=pl overrides an English browser'],
    [{ languages: ['pl-PL'] }, '?lang=xx', 'pl', 'unknown ?lang ignored, browser list used'],
  ];
  const wrong = [];
  for (const [nav, search, want, name] of cases) {
    const got = detectLanguage(nav, search);
    if (got !== want) wrong.push(`${name}: got ${got}, want ${want}`);
  }
  r.check(`${cases.length} language-selection cases (URL override, browser list, English fallback)`, wrong.length === 0, wrong.join('; '));

  // --- The running game shows the selected language everywhere.
  const en = loadGame(); en.newGame();
  const enTexts = texts(en);
  r.check('no navigator (harness default) -> English UI, <html lang="en">', en.game.lang === 'en' && en.context.document.documentElement.lang === 'en' && enTexts.labelCash === 'Cash' && enTexts.titleBuyBall === STRINGS.en.buyBall);
  const pl = loadGame({ navigator: { languages: ['pl-PL'], language: 'pl-PL' } }); pl.newGame();
  const plTexts = texts(pl);
  r.check('Polish browser -> Polish UI, <html lang="pl">', pl.game.lang === 'pl' && pl.context.document.documentElement.lang === 'pl' && plTexts.labelCash === 'Kasa' && plTexts.titleBuyBall === 'Kup nową kulę' && plTexts.descBuyBall === 'Kulki: 1');
  const blank = TEXT_IDS.filter((id) => !enTexts[id] || !plTexts[id]);
  r.check(`all ${TEXT_IDS.length} text elements are filled in both languages`, blank.length === 0, blank.join(', '));
  const leak = TEXT_IDS.filter((id) => POLISH_CHARS.test(enTexts[id]));
  r.check('English UI shows no Polish words', leak.length === 0, leak.map((id) => `${id}="${enTexts[id]}"`).join(', '));
  const labels = ['labelCash', 'labelLevel', 'titleBuyBall', 'titleFireRate', 'titleDamage'];
  r.check('static labels differ between en and pl (all translated)', labels.every((id) => enTexts[id] !== plTexts[id]), labels.filter((id) => enTexts[id] === plTexts[id]).join(', '));

  // --- Numbers.
  const fm = probe.formatMoney;
  r.check('money format en: $0, $10, $1,234,567', fm(0, 'en') === '$0' && fm(10, 'en') === '$10' && fm(1234567.9, 'en') === '$1,234,567', `${fm(1234567.9, 'en')}`);
  const plBig = fm(1234567, 'pl');
  r.check('money format pl: $1 234 567 (space-grouped digits), fractions floored', /^\$1\s234\s567$/.test(plBig) && fm(9.99, 'pl') === '$9', JSON.stringify(plBig));
  {
    const h = loadGame(); const g = h.newGame();
    g.cash = 2500000; g.maxBalls = 12; g.damageLevel = 3; g.updateUI();
    const ok = h.el('statCash').textContent === '$2,500,000' && h.el('descBuyBall').textContent === 'Balls: 12' && h.el('descDamage').textContent === 'Lvl 3' && /^\$[\d,]+$/.test(h.el('costBuyBall').textContent);
    r.check('live UI after progress: cash, counters and costs formatted (en)', ok, JSON.stringify(texts(h)));
    const huge = loadGame(); const gh = huge.newGame(); gh.cash = 1e30; gh.updateUI();
    r.check('very large cash still renders as digits (no NaN/undefined)', /^\$[\d,]+$/.test(huge.el('statCash').textContent), huge.el('statCash').textContent);
  }

  // --- Static HTML default (shown before game.js runs) is English.
  const html = readText('index.html');
  r.check('index.html declares lang="en" and ships English default labels', /<html lang="en">/.test(html) && !POLISH_CHARS.test(html.replace(/<!--[\s\S]*?-->/g, '')));
  return r;
}

if (isMain(import.meta.url)) process.exit(run().finish());
