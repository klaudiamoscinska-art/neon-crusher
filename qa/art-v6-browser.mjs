// Real pre-integration A/B evidence. All adapters live in the test-only library.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {browser,server,make,variant,capture,pair,rows,pairs,drawn,errors,bad,OUT,SHOTS,runtimeBefore} from './art-v6-browser-lib.mjs';
const ROOT=process.cwd();

try{
 for(const [w,h,dpr]of [[1920,1080,1],[1366,768,1],[907,510,1],[390,844,2],[390,844,3],[375,812,2],[844,390,2]]){
  const{ctx,p}=await make(w,h,dpr);await pair(p,`${w}x${h}-dpr${dpr}-sector7`);
  rows.push({name:`${w}x${h}-dpr${dpr} EN fit`,status:await p.evaluate(()=>__g.lang==='en'&&document.documentElement.lang==='en'&&document.documentElement.scrollWidth===innerWidth&&document.documentElement.scrollHeight===innerHeight)?'PASS':'FAIL'});
  await ctx.close();
 }
 const{ctx,p}=await make(907,510,1);
 for(const [boss,level]of [['firewall',7],['memory',8],['neural',9]]){
  for(const[state,hp]of [['intact',1],['damaged',.6],['critical',.2]])await pair(p,`${boss}-${state}`,level,new Function(`const g=__g;for(const b of g.blocks)b.hp=b.maxHp*${hp};g.uiProgress=g.coreProgress;g.draw();`));
  await pair(p,`${boss}-graph-cut`,level,()=>{const g=__g,r=g.blocks.find(b=>b.criticalPower&&g.powerEdges.some(e=>e.a===b));g.hitBlock(r,r.hp,r.cx,r.cy,'lance',true);g.updateCollapse(1/240);if(!g.blocks.some(b=>b.offline)||!g.powerEdges.some(e=>e.b.offline))throw new Error('graph cut did not disconnect live descendants');g.draw()});
  await pair(p,`${boss}-shatter`,level,()=>{const g=__g;g.hitBlock(g.heart,g.heart.hp,g.heart.cx,g.heart.cy,'lance',true);g.draw()});
  await pair(p,`${boss}-captured`,level,()=>{const g=__g;g.hitBlock(g.heart,g.heart.hp,g.heart.cx,g.heart.cy,'lance',true);g.breach.t=.5;g.draw()});
 }
 for(const[state,hp]of [['intact',1],['damaged',.6],['critical',.2],['isolated',1],['broken',0]])await pair(p,`modules-${state}`,7,new Function(`const g=__g;let i=0;for(const b of g.blocks){if(b.kind==='heart')continue;const role=i++%5;b.kind=role===3?'relay':'armor';b.firewall=role===4;b.variant=Math.min(role,2);b.hp=b.maxHp*${hp};b.offline=${state==='isolated'};b.alive=${state!=='broken'};b.hitFlash=${state==='broken'?1:0};}g.uiProgress=g.coreProgress;g.draw();`));
 for(const[state,charge,flash]of [['idle',0,0],['charging',.5,0],['ready',1,0],['firing',0,1]])await pair(p,`uplinks-${state}-drones`,7,new Function(`const g=__g;g.volleyCharge=${charge};for(const t of g.turrets)t.flash=${flash};for(let i=0;i<3;i++){g.spawnBallFromTurret(g.turrets[i%g.turrets.length]);const b=g.balls.at(-1);b.x=g.width*.22+i*25;b.y=g.height*.75;}g.draw();`));
 await pair(p,'shield-up',7,()=>{const g=__g;g.defenseTimer=0;g.updateDefense(1/240);if(!g.defense?.node?.alive)throw new Error('shield did not raise on live node');g.draw()});
 await pair(p,'shield-break',7,()=>{const g=__g;g.defenseTimer=0;g.updateDefense(1/240);const n=g.defense.node;g.hitBlock(n,n.hp,n.cx,n.cy,'lance',true);if(g.defense||!g.exposed)throw new Error('shield break did not expose core');g.draw()});
 await pair(p,'active-override',7,()=>{const g=__g;g.volleyCharge=1;g.requestVolley(g.heart.cx,g.heart.cy);window.__paused=false;g.update(1/240);window.__paused=true;if(g.manualVolleys!==1||g.lances.length===0)throw new Error('manual override did not fire lances');g.draw()});
 await pair(p,'sector12-finale',12,()=>{const g=__g;g.hitBlock(g.heart,g.heart.hp,g.heart.cx,g.heart.cy,'lance',true);g.draw()});
 await pair(p,'sector13-endless',12,()=>{const g=__g;g.hitBlock(g.heart,g.heart.hp,g.heart.cx,g.heart.cy,'lance',true);g.breach=null;g.updateShatter(2);window.__paused=false;g.update(1/240);window.__paused=true;if(g.level!==13||!g.toasts.some(t=>t.text===g.t('victory')))throw new Error('sector12 did not continue to endless victory');g.updateUI();g.draw()});
 await pair(p,'default-v3-module-crop',7,null,false);
 for(const v of ['v3','v6']){
  await variant(p,v,7);await p.evaluate(()=>{const g=__g,c=document.createElement('canvas');c.id='fxFixture';c.width=1100;c.height=720;c.style='position:fixed;inset:0;z-index:999;background:#070b14;width:100vw;height:100vh;object-fit:contain';document.body.append(c);const ctx=c.getContext('2d');ctx.fillStyle='#070b14';ctx.fillRect(0,0,1100,720);ctx.fillStyle='#d8faff';ctx.font='18px Arial';ctx.fillText('QA FIXTURE — real SpriteAtlas FX; not gameplay',20,28);for(const[row,kind]of ['impact','chain','shield_break','core_collapse','override'].entries()){ctx.fillStyle='#d8faff';ctx.font='13px Arial';ctx.fillText(kind,15,80+row*125);for(let i=0;i<8;i++)g.sprites.fx(ctx,kind,180+i*120,100+row*125,105,(i+.1)/8,false)}});await p.locator('#fxFixture').screenshot({path:path.join(SHOTS,`fx-frames-specimen-${v}.png`)});await capture(p,v,`fx-specimen-page`);await p.evaluate(()=>document.getElementById('fxFixture').remove());
 }
 // Supplemental real Canvas high-DPR boss at identical scene, not a marketing mockup.
 await ctx.close();const hi=await make(1920,1080,3);await pair(hi.p,'1920x1080-dpr3-neural-critical',9,()=>{__g.heart.hp=__g.heart.maxHp*.2;__g.draw()});await hi.ctx.close();
}finally{await browser.close();server.close()}
const runtimeAfter=Object.fromEntries(['game.js','style.css','index.html'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,f))).digest('hex')]));
rows.push({name:'runtime files unchanged during comparison',status:JSON.stringify(runtimeBefore)===JSON.stringify(runtimeAfter)?'PASS':'FAIL'});
rows.push({name:'browser errors or missing resources',status:errors.length===0&&bad.length===0?'PASS':'FAIL',errors,bad});
const result={generatedAt:new Date().toISOString(),baseSHA:execFileSync('git',['rev-parse','origin/main'],{encoding:'utf8'}).trim(),runtimeBefore,runtimeAfter,method:'Pre-integration browser-only fixture. Real Game.draw on current V3 runtime; seeded generateCore(1107), time4. V6 swaps matching image sources; module crop is alpha>32 bounding rect fit to existing square; alternate default-crop screenshot included. V6 backgrounds use existing V3 square floor slot (source aspect ratio distortion disclosed). UI icons retain V3. No production runtime change. All screenshots are actual Chromium Canvas; paused fixtures, not natural progression.',rows,pairs,runtimeDrawnFixtureSources:Object.fromEntries(Object.entries(drawn).map(([v,set])=>[v,[...set].sort()])),productionV6Drawn:[],productionV6DrawnCount:0,fixtureV6DrawnCount:[...drawn.v6].filter(s=>s.startsWith('assets/kernelfall-art-v6/')).length,fixtureRetainedV3Sources:[...drawn.v6].filter(s=>s.startsWith('assets/kernelfall-v3/')),physicalIPhone:'NOT RUN',crazyGamesPortal:'NOT RUN',ownerAestheticAcceptance:'NOT VERIFIED'};
fs.writeFileSync(path.join(OUT,'browser-ab.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({pairs:pairs.length,failures:rows.filter(r=>r.status==='FAIL'),drawn:Object.fromEntries(Object.entries(drawn).map(([v,s])=>[v,s.size]))},null,2));if(rows.some(r=>r.status==='FAIL'))process.exitCode=1;
