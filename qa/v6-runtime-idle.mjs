// Development-only natural idle evidence. No inputs, purchases or fixture state.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {ROOT} from './lib.mjs';
const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const out = path.join(ROOT, 'docs/art/kernelfall-v6/runtime/idle');
fs.mkdirSync(out, {recursive: true});
const server = http.createServer((req, res) => {
 const file = path.join(ROOT, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
 if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)] || 'application/octet-stream');
 res.end(fs.readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({executablePath: process.env.NC_CHROMIUM || '/usr/bin/chromium', args:['--no-sandbox']});
const errors = [], external = [], snapshots = [], events = [];
let videoPath;
try {
 const context = await browser.newContext({viewport:{width:907,height:510},deviceScaleFactor:1,locale:'pl-PL',recordVideo:{dir:out,size:{width:907,height:510}}});
 await context.addInitScript(() => {
  let seed = 0x4b465636;
  Math.random = () => {seed |= 0;seed = seed + 0x6D2B79F5 | 0;let t = Math.imul(seed ^ seed >>> 15,1 | seed);t = t + Math.imul(t ^ t >>> 7,61 | t) ^ t;return ((t ^ t >>> 14) >>> 0) / 4294967296;};
  window.__idleEvents=[];
  addEventListener('DOMContentLoaded', () => {
   const update = Game.prototype.update;
   Game.prototype.update = function(dt) {
    window.__g=this;
    const old={level:this.level,auto:this.autoVolleys,manual:this.manualVolleys,shield:!!this.defense};
    const result=update.call(this,dt);
    if (old.level!==this.level || old.auto!==this.autoVolleys || old.manual!==this.manualVolleys || old.shield!==!!this.defense) window.__idleEvents.push({time:this.time,level:this.level,auto:this.autoVolleys,manual:this.manualVolleys,shield:!!this.defense,cash:this.cash});
    return result;
   };
  }, {capture:true});
 });
 const page = await context.newPage();
 page.on('pageerror', e => errors.push(e.message));
 page.on('request', r => {if(!r.url().startsWith(base)) external.push(r.url());});
 await page.goto(base+'/index.html');
 await page.waitForFunction(() => window.__g?.sprites.loaded);
 const startWall = Date.now();
 for(const targetSeconds of [0,15,30,45,60]) {
  if(targetSeconds) await page.waitForFunction(t=>window.__g.time>=t,targetSeconds,{timeout:180000});
  const state = await page.evaluate(() => {
   const g=window.__g;
   return {time:g.time,level:g.level,cash:g.cash,maxBalls:g.maxBalls,balls:g.balls.length,damageLevel:g.damageLevel,fireRateLevel:g.fireRateLevel,manualVolleys:g.manualVolleys,autoVolleys:g.autoVolleys,heartHP:g.heart?.hp,heartMaxHP:g.heart?.maxHp,aliveBlocks:g.blocks.filter(b=>b.alive).length,offlineBlocks:g.blocks.filter(b=>b.alive&&b.offline).length,shield:!!g.defense,charge:g.volleyCharge,lang:g.lang,loaded:g.sprites.loaded,assetErrors:g.sprites.errors,used:[...g.sprites.used].sort(),usedSources:[...g.sprites.usedSources].sort(),fallbacks:g.sprites.fallbacks,shop:[...document.querySelectorAll('.shop-btn__title')].map(e=>e.textContent),upgrades:[g.maxBalls,g.fireRateLevel,g.damageLevel],scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],viewport:[innerWidth,innerHeight]};
  });
  const name=`natural-idle-${String(targetSeconds).padStart(2,'0')}s-907x510.png`;
  await page.screenshot({path:path.join(out,name)});
  snapshots.push({targetSeconds,wallElapsedSeconds:(Date.now()-startWall)/1000,screenshot:name,...state});
  console.log(JSON.stringify({targetSeconds,time:state.time,level:state.level,cash:state.cash,autoVolleys:state.autoVolleys,manualVolleys:state.manualVolleys}));
 }
 events.push(...await page.evaluate(()=>window.__idleEvents));
 const video=page.video();
 await context.close();
 const raw=await video.path();videoPath=path.join(out,'natural-idle-60s.webm');
 fs.renameSync(raw,videoPath);
} finally {await browser.close();server.close();}
let videoMedia;
try {videoMedia=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration,size','-show_entries','stream=codec_name,width,height,r_frame_rate','-of','json',videoPath],{encoding:'utf8'}));} catch(e) {videoMedia={status:'NOT VERIFIED',reason:e.message};}
const checks = [
 {name:'natural first 60 s ran without manual override',status:snapshots.length===5&&snapshots.at(-1).time>=60&&snapshots.every(s=>s.manualVolleys===0)?'PASS':'FAIL'},
 {name:'autopilot fires during natural idle',status:snapshots.at(-1)?.autoVolleys>0?'PASS':'FAIL'},
 {name:'exactly three existing upgrades, no purchases',status:snapshots.every(s=>JSON.stringify(s.shop)===JSON.stringify(['New drone','Override charge','Breach power'])&&JSON.stringify(s.upgrades)===JSON.stringify([1,1,1]))?'PASS':'FAIL'},
 {name:'English default in Polish browser, no runtime asset load failures or page errors',status:snapshots.every(s=>s.lang==='en'&&s.loaded&&s.assetErrors.length===0)&&errors.length===0?'PASS':'FAIL'},
 {name:'zero external requests',status:external.length===0?'PASS':'FAIL'},
 {name:'physical iPhone',status:'NOT RUN',reason:'Chromium Linux viewport recording only'},
 {name:'CrazyGames real portal',status:'NOT RUN',reason:'Local HTTP only; no portal session available'}
];
const result={runtimeSHA256:crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'game.js'))).digest('hex'),generatedAt:new Date().toISOString(),scope:'Natural live Game.loop, no inputs, no purchases, no forced state; seed 0x4b465636; actual simulation times retained. Produkcyjny atlas V6, bez podmiany obrazów przez QA.',video:path.basename(videoPath),videoMedia,videoNote:'Playwright records the whole wall-clock session including asset startup. VP8 rounds the 907px viewport recording down to 906px; PNG screenshots retain exact 907x510 viewport dimensions.',snapshots,events,checks,errors,external};
fs.writeFileSync(path.join(out,'natural-idle-results.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(checks,null,2));
if(checks.some(c=>c.status==='FAIL'))process.exitCode=1;
