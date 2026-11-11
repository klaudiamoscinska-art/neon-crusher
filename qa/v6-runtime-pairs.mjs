// Identyczne sceny rzeczywistych buildów. QA nie podmienia obrazów ani atlasu.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=process.cwd(),out=path.join(root,'docs/art/kernelfall-v6/runtime'),old='/tmp/kernelfall-v6-pairs-main';
fs.mkdirSync(old,{recursive:true});fs.mkdirSync(path.join(out,'pairs'),{recursive:true});
execFileSync('tar',['-x','-C',old],{input:execFileSync('git',['archive','origin/main'],{maxBuffer:64*1024*1024})});
const errors=[],missing=[],pairs=[],roles=new Set();
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://local'),before=u.pathname.startsWith('/before/'),base=before?old:root;const f=path.resolve(base,u.pathname.replace(/^\/(before|after)\//,''));if(!f.startsWith(base+'/')||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
for(const [w,h,dpr]of [[1920,1080,1],[1366,768,1],[907,510,1],[390,844,2],[390,844,3],[375,812,2],[844,390,2]]){
 const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:dpr,hasTouch:w<900,locale:'pl-PL'});
 await ctx.addInitScript(()=>{window.__reset=()=>{let seed=1107;Math.random=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}};__reset();localStorage.setItem('neonCrusher.audio.v1','muted');addEventListener('DOMContentLoaded',()=>{const u=Game.prototype.update;Game.prototype.update=function(dt){window.__g=this;if(!window.__paused)return u.call(this,dt);};},{capture:true,once:true});});
 const pages=[];
 for(const build of ['before','after']){const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)missing.push(r.url())});await p.goto(`${base}/${build}/index.html`);await p.waitForFunction(()=>window.__g?.sprites.loaded);await p.evaluate(()=>window.__paused=true);pages.push(p);}
 for(const level of [1,3,7,12,13])for(const scene of ['normal','damage-fx']){
  const versions=[];
  for(const [i,p]of pages.entries()){
   const state=await p.evaluate(({level,scene})=>{
    __reset();const g=__g;g.level=level;g.time=4;g.manualVolleys=0;g.autoVolleys=0;g.generateCore(level);g.time=4;g.coreBornAt=0;g.cash=0;g.balls=[];g.volleyCharge=.75;g.volleyReadyFor=0;g.particles.active=[];g.floatTexts=[];g.rings=[];g.arcs=[];g.lances=[];g.syncFlash=0;g.exposed=null;g.defense=null;g.toasts=[];g.breach=null;g.aim=null;g.screenFlash=0;g.shake=0;
    for(const t of g.turrets)t.flash=0;
    for(let j=0;j<3;j++){const b=new Ball(g.width*.18+j*25,g.height*.75,j*.6,250,5,COLORS.cyan);g.balls.push(b);}
    if(scene==='damage-fx'){
     const ns=g.blocks.filter(b=>b.kind!=='heart');for(const [j,n]of ns.entries())n.hp=n.maxHp*([.6,.2,1][j%3]);g.heart.hp=g.heart.maxHp*.3;
     g.defenseTimer=0;g.updateDefense(1/240);
     g.volleyCharge=1;g.fireVolley(g.heart.cx,g.heart.cy,true);
    }
    g.uiProgress=g.coreProgress;g.updateUI();g.draw();
    return{level:g.level,time:g.time,cash:g.cash,charge:g.volleyCharge,blocks:g.blocks.map(b=>[b.x,b.y,b.size,b.kind,b.hp,b.maxHp,b.alive,b.offline]),balls:g.balls.map(b=>[b.x,b.y,b.vx,b.vy]),manual:g.manualVolleys,defense:!!g.defense,exposed:!!g.exposed,world:[g.width,g.height]};
   },{level,scene});
   const file=`pairs/${w}x${h}-dpr${dpr}-sector${level}-${scene}-${i?'after-v6':'before-v3'}.png`;
   await p.screenshot({path:path.join(out,file)});const hash=crypto.createHash('sha256').update(JSON.stringify(state)).digest('hex');versions.push({file,state,hash});
   if(i)for(const f of await p.evaluate(()=>[...__g.sprites.usedSources]))roles.add(f);
  }
  const equal=versions[0].hash===versions[1].hash;pairs.push({viewport:[w,h,dpr],level,scene,status:equal?'PASS':'FAIL',versions});
 }
 await ctx.close();console.log(`${w}x${h} DPR${dpr}: 10 par`);
}
}finally{await browser.close();server.close();}
const result={generatedAt:new Date().toISOString(),scope:'Kontrolowane fixture realnego Game.draw z dwóch buildów HTTP; identyczny seed i stan, brak podmian atlasu.',pairs,errors,missing,drawnSources:[...roles].sort(),counts:{PASS:pairs.filter(p=>p.status==='PASS').length,FAIL:pairs.filter(p=>p.status==='FAIL').length}};
fs.writeFileSync(path.join(out,'pairs-results.json'),JSON.stringify(result,null,2)+'\n');console.log(result.counts);if(result.counts.FAIL||errors.length||missing.length)process.exitCode=1;
