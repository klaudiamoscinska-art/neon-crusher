// Real Chromium evidence. This tool never ships in HTML5. Fixtures change
// live Game objects only in test pages, with paused simulation for stable art
// inspection; fresh-start/input checks use the normal running game.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import {ROOT} from './lib.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const OUT=path.join(ROOT,'docs/art/kernelfall-v6/runtime');
const SHOTS=path.join(OUT,'screenshots');fs.mkdirSync(SHOTS,{recursive:true});
const rows=[],contexts=[],used=new Set(),usedSources=new Set(),bad=[],external=[],consoleErrors=[];
const check=(name,pass,detail)=>rows.push({status:pass?'PASS':'FAIL',name,...detail?{detail}: {}});
const shot=async(p,name)=>{await p.screenshot({path:path.join(SHOTS,name+'.png')});};
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
const beforeRoot='/tmp/kernelfall-v3-before';fs.mkdirSync(beforeRoot,{recursive:true});
execFileSync('git',['archive','origin/main'],{cwd:ROOT,stdio:['ignore',fs.openSync('/tmp/kernelfall-v3-before.tar','w'),'pipe']});
execFileSync('tar',['-xf','/tmp/kernelfall-v3-before.tar','-C',beforeRoot]);
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);
 if(pathname==='/frame') {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><link rel="icon" href="/neon-crusher/assets/kernelfall-v3/brand/symbol-128.png"></head><body style="margin:0"><iframe title="Game" src="/neon-crusher/index.html" style="width:907px;height:510px;border:0"></iframe></body></html>');return;}
 const old=pathname.startsWith('/before/');const root=old?beforeRoot:ROOT;
 let rel=pathname.replace(old?/^\/before\//:/^\/neon-crusher\//,'');if(rel==='/'||!rel)rel='index.html';
 const file=path.resolve(root,rel.replace(/^\//,''));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',MIME[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.NC_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
async function make(w,h,dpr=1,touch=false,reduced=false,url='/neon-crusher/index.html'){
 const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:dpr,locale:'pl-PL',hasTouch:touch,isMobile:touch,reducedMotion:reduced?'reduce':'no-preference'});contexts.push(ctx);
 await ctx.addInitScript(()=>{
  localStorage.setItem('neonCrusher.audio.v1','muted');
  let seed=11;Math.random=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
  window.addEventListener('DOMContentLoaded',()=>{if(typeof Game==='undefined')return;const u=Game.prototype.update;Game.prototype.update=function(dt){window.__g=this;if(window.__paused)return;return u.call(this,dt);};},{capture:true,once:true});
 });
 const p=await ctx.newPage();p.on('pageerror',e=>consoleErrors.push({url:p.url(),message:e.message}));p.on('console',m=>{if(m.type()==='error')consoleErrors.push({url:p.url(),message:m.text()});});
 p.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:'))external.push(r.url());});p.on('response',r=>{if(r.status()>=400)bad.push({url:r.url(),status:r.status()});});
 await p.goto(base+url);await p.waitForFunction(()=>window.__g);
 if(!url.startsWith('/before'))await p.waitForFunction(()=>window.__g.sprites.loaded||window.__g.sprites.errors.length);
 return {ctx,p};
}
async function collect(p){for(const id of await p.evaluate(()=>[...window.__g.sprites.used]))used.add(id);for(const src of await p.evaluate(()=>[...window.__g.sprites.usedSources]))usedSources.add(src);}
async function atlasCacheChecks(page) {
 return page.evaluate(()=>{
  const atlas=window.__g.sprites;
  const pixelCases=[];
  for(const id of ['drones/scout_256.png','bosses/neural_intact_512.png'])for(const scale of [1,2,3]){
   const size=id.startsWith('drones/')?83.5:187;
   const raster=atlas.get(id,size*scale),extent=raster.width/scale;
   const a=document.createElement('canvas'),b=document.createElement('canvas');a.width=b.width=640;a.height=b.height=640;
   const ac=a.getContext('2d',{willReadFrequently:true}),bc=b.getContext('2d',{willReadFrequently:true});
   ac.setTransform(scale,0,0,scale,0,0);bc.setTransform(scale,0,0,scale,0,0);
   // Same top-left pivot and full cached extent; neither draw rotates.
   atlas.draw(ac,id,16,16,size,scale);bc.drawImage(raster,16,16,extent,extent);
   const ad=ac.getImageData(0,0,640,640).data,bd=bc.getImageData(0,0,640,640).data;
   let maxDiff=0,differingChannels=0;
   for(let i=0;i<ad.length;i++){const d=Math.abs(ad[i]-bd[i]);if(d)differingChannels++;if(d>maxDiff)maxDiff=d;}
   pixelCases.push({id,scale,size,pivot:[16,16],extent,maxDiff,differingChannels});
  }
  for(const boss of ['firewall','memory','neural'])for(const state of ['intact','damaged','critical','shatter','captured'])atlas.get(`bosses/${boss}_${state}_512.png`,2048);
  const actualPixels=[...atlas.cache.values()].reduce((sum,r)=>sum+r.width*r.height,0);
  const cache={entries:atlas.cache.size,accountedPixels:atlas.cachePixels,actualPixels,budgetPixels:12*1024*1024,rgbaBudgetMiB:48};
  return {pixelCases,cache};
 });
}

async function freeze(p,level=7){await p.evaluate(level=>{window.__paused=true;const g=window.__g;g.level=level;g.generateCore(level);g.coreBornAt=g.time-2;g.balls=[];g.volleyCharge=.75;g.volleyReadyFor=0;for(const t of g.turrets)t.flash=0;g.particles.active=[];g.floatTexts=[];g.rings=[];g.arcs=[];g.lances=[];g.syncFlash=0;g.exposed=null;g.toasts=[];g.breach=null;g.aim=null;g.screenFlash=0;g.shake=0;g.uiProgress=g.coreProgress;g.updateUI();g.draw();},level);}
try{
 for(const [w,h,dpr,touch]of[[1920,1080,1,false],[1366,768,1,false],[907,510,1,false],[390,844,2,true],[390,844,3,true],[375,812,2,true],[844,390,2,true]]){
  const name=`${w}x${h}-dpr${dpr}`;const{ctx,p}=await make(w,h,dpr,touch);
  await shot(p,`${name}-start`);await p.waitForTimeout(4000);await shot(p,`${name}-gameplay`);
  const metrics=await p.evaluate(()=>{const g=window.__g;const c=g.canvas.getBoundingClientRect();return {lang:g.lang,htmlLang:document.documentElement.lang,images:g.sprites.images.size,loaded:g.sprites.loaded,assetErrors:g.sprites.errors,domDecoded:[...document.images].every(i=>i.complete&&i.naturalWidth>0),scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],viewport:[innerWidth,innerHeight],canvas:[c.width,c.height],hud:g.hudLayout().map(r=>({id:r.id,x:r.x,y:r.y,w:r.w,h:r.h})),shop:[...document.querySelectorAll('.shop-btn')].map(e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,visible:b.left>=0&&b.right<=innerWidth&&b.bottom<=innerHeight,overflow:e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1};})};});
  check(`${name}: V6/V3 Canvas and DOM assets decoded`,metrics.loaded&&metrics.images===90&&metrics.assetErrors.length===0&&metrics.domDecoded,metrics);
  check(`${name}: English default with Polish browser`,metrics.lang==='en'&&metrics.htmlLang==='en');
  check(`${name}: HUD, shop and arena fit viewport`,metrics.scroll[0]===w&&metrics.scroll[1]===h&&metrics.shop.every(b=>b.visible&&!b.overflow)&&metrics.canvas[1]>=220&&metrics.hud.every(r=>r.x>=0&&r.y>=0&&r.x+r.w<=metrics.canvas[0]+1&&r.y+r.h<=metrics.canvas[1]+1),metrics);
  const point=await p.evaluate(()=>{const g=window.__g;g.volleyCharge=1;g.volleyReadyFor=0;g.updateUI();const r=g.canvas.getBoundingClientRect();return{x:r.x+g.heart.cx*g.viewScale,y:r.y+g.heart.cy*g.viewScale,before:g.manualVolleys};});
  if(touch)await p.touchscreen.tap(point.x,point.y);else await p.mouse.click(point.x,point.y);await p.waitForTimeout(100);
  check(`${name}: ${touch?'touch tap':'mouse click'} fires a manual volley`,await p.evaluate(before=>window.__g.manualVolleys===before+1,point.before));
  const beforeSpace=await p.evaluate(()=>{const g=window.__g;g.volleyCharge=1;g.volleyReadyFor=0;return g.manualVolleys;});await p.keyboard.press('Space');await p.waitForTimeout(100);
  check(`${name}: Space fires a manual volley`,await p.evaluate(before=>window.__g.manualVolleys===before+1,beforeSpace));
  await collect(p);await ctx.close();
 }
 // A controlled runtime scene covers every archetype/HP state and exposes
 // layering and collision bounds. This is an actual canvas draw, not a mockup.
 const{ctx,p}=await make(907,510);await freeze(p,7);
 for(const [boss,level]of[['firewall',7],['memory',8],['neural',9]]){
  for(const [state,hp]of[['intact',1],['damaged',.6],['critical',.2]]){
   await freeze(p,level);await p.evaluate(hp=>{const g=window.__g;for(const b of g.blocks)b.hp=b.maxHp*hp;g.uiProgress=g.coreProgress;g.draw();},hp);
   await shot(p,`fixture-${boss}-${state}-907x510`);await collect(p);
  }
  await freeze(p,level);const collapse=await p.evaluate(()=>{const g=window.__g;const root=g.blocks.find(b=>b.criticalPower&&g.powerEdges.some(e=>e.a===b));g.hitBlock(root,root.hp,root.cx,root.cy,'lance',true);g.updateCollapse(1/240);g.draw();return{offline:g.blocks.filter(b=>b.alive&&b.offline).length,edges:g.powerEdges.filter(e=>e.b.offline).length};});
  check(`${boss}: genuine supply cut propagates offline`,collapse.offline>0&&collapse.edges>0,collapse);await shot(p,`fixture-${boss}-graph-cut-907x510`);await collect(p);
  await freeze(p,level);await p.evaluate(()=>{const g=window.__g;g.hitBlock(g.heart,g.heart.hp,g.heart.cx,g.heart.cy,'lance',true);g.draw();});await shot(p,`fixture-${boss}-shatter-907x510`);await collect(p);
  await p.evaluate(()=>{const g=window.__g;g.breach.t=.5;g.draw();});await shot(p,`fixture-${boss}-captured-907x510`);await collect(p);
 }
 // Five module roles, with exact production Block.drawCore, through the
 // manifest priority states. A paused live board keeps the fixtures visible.
 for(const [state,hp]of[['intact',1],['damaged',.6],['critical',.2],['isolated',1],['broken',0]]){
  await freeze(p,7);await p.evaluate(({state,hp})=>{const g=window.__g;let i=0;for(const b of g.blocks){if(b.kind==='heart')continue;const role=i++%5;b.kind=role===3?'relay':'armor';b.firewall=role===4;b.variant=Math.min(role,2);b.hp=b.maxHp*hp;b.offline=state==='isolated';b.alive=state!=='broken';b.hitFlash=state==='broken'?1:0;}g.uiProgress=g.coreProgress;g.draw();},{state,hp});
  await shot(p,`fixture-module-${state}-907x510`);await collect(p);
 }
 // Regression: a fading broken module must not leak globalAlpha into the
 // subsequent live heart hitbox. Spy on the real draw command, not source.
 await freeze(p,7);const heartAlpha=await p.evaluate(()=>{const g=window.__g;const m=g.blocks.find(b=>b.kind!=='heart');m.alive=false;m.hitFlash=.1;let alpha=null;const stroke=g.ctx.strokeRect;g.ctx.strokeRect=function(x,y,w,h){if(x===g.heart.x&&y===g.heart.y&&w===g.heart.size)alpha=this.globalAlpha;return stroke.call(this,x,y,w,h);};g.draw();g.ctx.strokeRect=stroke;return alpha;});check('broken module alpha cannot hide live heart rim',heartAlpha===1,{heartAlpha});
 // Uplink states and drone variants use the normal production draw calls.
 for(const[state,charge,flash]of[['idle',0,0],['charging',.5,0],['ready',1,0],['firing',0,1]]){
  await freeze(p,7);await p.evaluate(({charge,flash})=>{const g=window.__g;g.volleyCharge=charge;for(const t of g.turrets)t.flash=flash;for(let i=0;i<3;i++){g.spawnBallFromTurret(g.turrets[i%g.turrets.length]);const b=g.balls.at(-1);b.x=g.width*.22+i*25;b.y=g.height*.75;}g.draw();},{charge,flash});await shot(p,`fixture-uplinks-${state}-drones-907x510`);await collect(p);
 }
 await freeze(p,7);const defense=await p.evaluate(()=>{const g=window.__g;g.defenseTimer=0;g.updateDefense(1/240);g.draw();return!!g.defense;});check('real shield raises on live node',defense);await shot(p,'fixture-shield-up-907x510');
 const defenseStates=await p.evaluate(()=>{const g=window.__g;const n=g.defense.node;const ids=[];const draw=g.sprites.draw;g.sprites.draw=function(ctx,id,...args){ids.push(id);return draw.call(this,ctx,id,...args);};n.hp=n.maxHp*.2;g.drawDefense(g.ctx);n.offline=true;g.drawDefense(g.ctx);n.offline=false;g.sprites.draw=draw;return ids;});check('defense overlay preserves critical and isolated sprite states',defenseStates.includes('modules/firewall_critical_256.png')&&defenseStates.includes('modules/firewall_isolated_256.png'),defenseStates);
 const broken=await p.evaluate(()=>{const g=window.__g;const n=g.defense?.node;if(!n)return false;g.hitBlock(n,n.hp,n.cx,n.cy,'lance',true);g.draw();return!!g.exposed&&!g.defense;});check('real shield node destruction exposes core',broken);await shot(p,'fixture-shield-break-907x510');await collect(p);
 for(let frame=0;frame<8;frame++)await p.evaluate(frame=>{const g=window.__g;if(g.exposed)g.exposed.t=EXPOSE_TIME-(frame+.25)/8*.7;g.draw();},frame);
 await collect(p);
 // Actual campaign completion through hitBlock + existing update path.
 await freeze(p,12);await p.evaluate(()=>{const g=window.__g;g.hitBlock(g.heart,g.heart.hp,g.heart.cx,g.heart.cy,'lance',true);g.draw();});await shot(p,'fixture-core-shatter-907x510');await collect(p);
 for(let frame=0;frame<8;frame++)await p.evaluate(frame=>{const g=window.__g;if(g.breach)g.breach.t=(frame+.25)/8*g.breach.life;g.draw();},frame);
 await collect(p);await shot(p,'fixture-core-captured-907x510');
 const victory=await p.evaluate(()=>{const g=window.__g;g.breach=null;/* advance the real shatter wave, then one live update transitions sectors */g.updateShatter(2);window.__paused=false;g.update(1/240);window.__paused=true;g.updateUI();g.draw();return{level:g.level,toasts:g.toasts.map(t=>t.text),victory:g.t('victory')};});check('sector 12 result continues to endless sector 13',victory.level===13&&victory.toasts.includes(victory.victory),victory);await shot(p,'fixture-victory-result-907x510');
 // Restart here means the existing reload flow; Basic has no new-game menu.
 await p.evaluate(()=>window.__g.save());await p.reload();await p.waitForFunction(()=>window.__g?.sprites.loaded);check('reload restart retains campaign v1 save',await p.evaluate(()=>window.__g.level===13&&window.__g.lang==='en'));await shot(p,'restart-907x510');await collect(p);
 // Independent decode of every manifest item proves packaging/network paths,
 // while used tracks actual runtime draw calls separately.
 const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/kernelfall-v3/manifest.json')));
 const decoded=await p.evaluate(async files=>Promise.all(files.map(file=>new Promise(resolve=>{const i=new Image();i.onload=()=>resolve({path:file.path,w:i.naturalWidth,h:i.naturalHeight,ok:i.naturalWidth===file.width&&i.naturalHeight===file.height});i.onerror=()=>resolve({path:file.path,ok:false});i.src='assets/kernelfall-v3/'+file.path;}))),manifest.files);
 check('all 100 original PNGs decode through nested Pages path',decoded.length===100&&decoded.every(i=>i.ok),decoded);
 // A clearly labelled source-frame specimen demonstrates all 40 FX frames
 // through production atlas.fx; not counted as natural gameplay coverage.
 await p.evaluate(()=>{const g=window.__g;window.__paused=true;const c=document.createElement('canvas');c.id='v3FxSpecimen';c.width=1100;c.height=720;c.style='position:fixed;inset:0;z-index:999;background:#070b14;width:100vw;height:100vh;object-fit:contain';document.body.append(c);const ctx=c.getContext('2d');ctx.fillStyle='#070b14';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#d8faff';ctx.font='18px Arial';ctx.fillText('QA FIXTURE — actual production SpriteAtlas FX frames (not gameplay)',20,28);for(const[row,kind]of['impact','chain','shield_break','core_collapse','override'].entries()){ctx.fillStyle='#d8faff';ctx.font='13px Arial';ctx.fillText(kind,15,80+row*125);for(let i=0;i<8;i++)g.sprites.fx(ctx,kind,180+i*120,100+row*125,105,(i+.1)/8,false);}});
 await p.locator('#v3FxSpecimen').screenshot({path:path.join(SHOTS,'fixture-all-fx-frames.png')});await collect(p);await p.evaluate(()=>document.getElementById('v3FxSpecimen').remove());
 // Before/after are identical viewport/seed/time fixture draws from main and
 // candidate. Labels live in the contact sheet, outside the screenshots.
 const{ctx:bc,p:bp}=await make(907,510,1,false,false,'/before/index.html?lang=en');await freeze(bp,1);await bp.evaluate(()=>{const g=window.__g;g.cash=0;g.time=4;g.coreBornAt=0;g.updateUI();g.draw();});const beforeGeometry=await bp.evaluate(()=>window.__g.blocks.map(b=>[b.x,b.y,b.size,b.kind,b.hp,b.maxHp]));await shot(bp,'before-main-907x510');await bc.close();
 await freeze(p,1);await p.evaluate(()=>{const g=window.__g;g.cash=0;g.time=4;g.coreBornAt=0;g.updateUI();g.draw();});const afterGeometry=await p.evaluate(()=>window.__g.blocks.map(b=>[b.x,b.y,b.size,b.kind,b.hp,b.maxHp]));check('before/after fixture preserves collision geometry',JSON.stringify(beforeGeometry)===JSON.stringify(afterGeometry));await shot(p,'after-v6-907x510');await collect(p);
 const optChecks=await atlasCacheChecks(p);
 check('transparent margin blit preserves visible pixels and pivot',optChecks.pixelCases.every(c=>c.maxDiff<=1),optChecks.pixelCases);
 check('15 boss rasters at 2048px respect 48 MiB FIFO cache budget',optChecks.cache.accountedPixels<=optChecks.cache.budgetPixels&&optChecks.cache.actualPixels===optChecks.cache.accountedPixels,optChecks.cache);
 await ctx.close();
 // Nested iframe boots its local resources with the same path convention.
 const{ctx:ic,p:ip}=await make(1000,600,1,false,false);await ip.goto(base+'/frame');const frame=ip.frames().find(f=>f.url().includes('/neon-crusher/'));await frame.waitForFunction(()=>window.__g?.sprites.loaded);check('nested HTML5 iframe uses production V6 assets',await frame.evaluate(()=>window.__g.sprites.errors.length===0&&window.__g.lang==='en'));await shot(ip,'nested-iframe-907x510');await ic.close();
 // Reduced motion is explicit preference; same images remain loaded.
 const{ctx:rc,p:rp}=await make(390,844,2,true,true);check('reduced motion preserves production V6 assets',await rp.evaluate(()=>window.__g.reducedMotion&&window.__g.sprites.loaded&&window.__g.sprites.images.size===90));await shot(rp,'390x844-dpr2-reduced-motion');await collect(rp);await rc.close();
 // Deliberately broken PNG: real image decode error must hold the V3
 // loading gate and display its English failure text, never legacy shapes.
 const ec=await browser.newContext({viewport:{width:390,height:844},locale:'pl-PL'});
 await ec.addInitScript(()=>{const fill=CanvasRenderingContext2D.prototype.fillText;window.__painted=[];CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.__painted.push(text);return fill.call(this,text,...args);};window.addEventListener('DOMContentLoaded',()=>{if(typeof Game==='undefined')return;const u=Game.prototype.update;Game.prototype.update=function(dt){window.__g=this;return u.call(this,dt);};},{capture:true});});
 const ep=await ec.newPage();await ep.route('**/bosses/firewall_intact_512.png',r=>r.fulfill({status:200,contentType:'image/png',body:'deliberately invalid PNG for QA'}));await ep.goto(base+'/neon-crusher/index.html');await ep.waitForFunction(()=>window.__g?.sprites.errors.length>0&&window.__painted.includes('Artwork could not load. Please reload.'));
 check('failed PNG displays English error without vector fallback',await ep.evaluate(()=>!window.__g.sprites.loaded&&window.__g.sprites.errors.includes('bosses/firewall_intact_512.png')&&window.__painted.includes(window.__g.t('artError'))&&![...window.__g.sprites.used].some(id=>/^(bosses|modules|drones|uplinks)\//.test(id))));await shot(ep,'fixture-art-load-error-390x844');await ec.close();

 // Błąd wariantu V6 musi uruchomić prawdziwy V3, z poprawnym obrotem.
 const fc=await browser.newContext({viewport:{width:390,height:844}});
 await fc.addInitScript(()=>{addEventListener('DOMContentLoaded',()=>{const u=Game.prototype.update;Game.prototype.update=function(dt){window.__g=this;return u.call(this,dt);};},{capture:true});});
 const fp=await fc.newPage();
 await fp.route('**/kernelfall-v6-runtime/drones/scout_256.png',r=>r.fulfill({status:200,contentType:'image/png',body:'invalid'}));
 await fp.goto(base+'/neon-crusher/index.html');await fp.waitForFunction(()=>window.__g?.sprites.loaded);
 check('uszkodzony V6 ładuje V3 i zachowuje kierunek -Y',await fp.evaluate(()=>{const a=__g.sprites;return a.fallbacks.length===1&&a.sources.get('drones/scout_256.png')==='assets/kernelfall-v3/drones/scout_256.png'&&a.rotationOffset('drones/scout_256.png')===Math.PI/2&&a.errors.length===0;}));
 await shot(fp,'fixture-v6-fallback');await fc.close();
 const runtimeManifest=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/kernelfall-v6-runtime/manifest.json')));
 check('wszystkie poprawione V6 rysowane przez produkcyjny atlas',runtimeManifest.files.every(f=>usedSources.has(f.path)),{expected:runtimeManifest.files.length,drawn:[...usedSources].filter(f=>f.startsWith('assets/kernelfall-v6-runtime/'))});
 // Browser-rendered contact sheets from actual screenshot files.

 const sheets=await browser.newContext({viewport:{width:1440,height:1000}});const sp=await sheets.newPage();
 const uri=name=>'data:image/png;base64,'+fs.readFileSync(path.join(SHOTS,name+'.png')).toString('base64');
 await sp.setContent(`<html><body style="margin:0;padding:24px;background:#080d16;color:#d9f7ff;font:18px Arial"><h2 style="margin:0 0 18px">KERNELFALL V6 — actual Chromium runtime / desktop and mobile</h2><div style="display:flex;gap:24px;align-items:flex-start"><div><p>1920×1080 / DPR 1</p><img src="${uri('1920x1080-dpr1-gameplay')}" style="width:960px"></div><div><p>390×844 / DPR 2</p><img src="${uri('390x844-dpr2-gameplay')}" style="width:360px"></div></div></body></html>`);await sp.screenshot({path:path.join(SHOTS,'comparison-desktop-mobile.png')});
 await sp.setViewportSize({width:1854,height:610});await sp.setContent(`<html><body style="margin:0;padding:10px;background:#080d16;color:#d9f7ff;font:16px Arial"><h2 style="margin:0 0 12px">Actual runtime at 907×510 — controlled seed/time fixture</h2><div style="display:flex;gap:20px"><div><p>BEFORE: origin/main c32a1371</p><img src="${uri('before-main-907x510')}" width="907"></div><div><p>AFTER: ART V6 runtime</p><img src="${uri('after-v6-907x510')}" width="907"></div></div></body></html>`);await sp.screenshot({path:path.join(SHOTS,'comparison-before-after.png')});await sheets.close();
 check('all 90 Canvas asset roles draw in gameplay or labelled runtime fixtures',used.size===90,{drawn:used.size});
 check('no critical console errors, missing resources or foreign hosts',consoleErrors.length===0&&bad.length===0&&external.length===0,{consoleErrors,bad,external});
 rows.push({status:'NOT RUN',name:'physical iPhone',detail:'Only Chromium viewport/touch/DPR emulation is available; this is not a physical device PASS.'});
 rows.push({status:'NOT VERIFIED',name:'owner acceptance of ART V6 visual fidelity',detail:'Real screenshots attached for GPT/owner review; automation cannot grant aesthetic acceptance.'});
}finally{for(const c of contexts)await c.close().catch(()=>{});await browser.close();server.close();}
const result={runtimeSHA256:crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'game.js'))).digest('hex'),generatedAt:new Date().toISOString(),browser:'Chromium '+(process.env.NC_CHROMIUM||'/usr/bin/chromium'),scope:'Chromium desktop + viewport/touch/DPR emulation; fixtures labelled; no physical device claim',rows,counts:Object.fromEntries(['PASS','FAIL','NOT RUN','NOT VERIFIED'].map(s=>[s,rows.filter(r=>r.status===s).length])),runtimeDrawnScope:'Actual Canvas draw calls across fresh gameplay and explicitly labelled runtime fixtures; not all represent natural progression in this run.',runtimeDrawn:[...used].sort(),runtimeDrawnSources:[...usedSources].sort(),consoleErrors,missingResources:bad,externalRequests:external};
fs.writeFileSync(path.join(OUT,'browser-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({counts:result.counts,drawn:result.runtimeDrawn.length,failures:rows.filter(r=>r.status==='FAIL')},null,2));if(result.counts.FAIL)process.exitCode=1;
