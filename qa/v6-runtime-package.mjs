// Test rzeczywistej paczki HTML5 z podkatalogu i lokalnego iframe.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=path.resolve('qa/out/crazygames-html5'),out='docs/art/kernelfall-v6/runtime';
const rows=[],errors=[],missing=[];const check=(name,pass,detail)=>rows.push({name,status:pass?'PASS':'FAIL',detail});
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://local');if(u.pathname==='/frame'){res.setHeader('Content-Type','text/html');res.end('<html><head><link rel="icon" href="/nested/game/assets/kernelfall-v3/brand/symbol-128.png"></head><body style="margin:0"><iframe src="/nested/game/index.html" width="907" height="510" style="border:0"></iframe></body></html>');return;}
 const f=path.resolve(root,u.pathname.replace(/^\/nested\/game\//,''));if(!f.startsWith(root+'/')||!fs.existsSync(f)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const sets=[];
try{
for(const [w,h,dpr]of [[1920,1080,1],[390,844,2],[390,844,3],[844,390,2]]){
 const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:dpr,locale:'pl-PL'});
 await ctx.addInitScript(()=>{addEventListener('DOMContentLoaded',()=>{const d=Game.prototype.draw;Game.prototype.draw=function(){window.__g=this;return d.call(this);};},{capture:true});});
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)missing.push(r.url())});
 await p.goto(base+'/nested/game/index.html');await p.waitForFunction(()=>window.__g?.sprites.loaded&&window.__g.balls.length>0);await p.waitForTimeout(600);
 const data=await p.evaluate(()=>({sources:[...__g.sprites.sources.values()].sort(),drawn:[...__g.sprites.usedSources],errors:__g.sprites.errors,fallbacks:__g.sprites.fallbacks,lang:__g.lang}));sets.push(data.sources);
 check(`Paczka ${w}×${h} DPR${dpr}: prawdziwe rysowanie V6, bez fallbacków i błędów`,data.drawn.some(s=>s.startsWith('assets/kernelfall-v6-runtime/'))&&data.sources.filter(s=>s.startsWith('assets/kernelfall-v6-runtime/')).length===32&&!data.errors.length&&!data.fallbacks.length&&data.lang==='en',data);
 if(w===390&&dpr===2){
  const rotations=await p.evaluate(()=>{const g=__g,c=document.createElement('canvas').getContext('2d'),angles=[],rotate=c.rotate.bind(c);c.rotate=a=>{angles.push(a);rotate(a);};const balls=[new Ball(30,30,0,250,5,COLORS.cyan),new Ball(60,60,Math.PI/2,250,5,COLORS.cyan),new Ball(90,90,Math.PI,250,5,COLORS.cyan)];Ball.drawAll(c,balls);return angles.map((a,i)=>({drawn:a,motion:Math.atan2(balls[i].vy,balls[i].vx)}));});
  check('Nosy dronów +X obracają się zgodnie z prędkością w trzech kierunkach',rotations.length===3&&rotations.every(r=>Math.abs(r.drawn-r.motion)<1e-9),rotations);
  await p.setViewportSize({width:844,height:390});await p.waitForTimeout(200);check('Obrót telefonu zachowuje te same PNG bez przeładowania',await p.evaluate(s=>JSON.stringify([...__g.sprites.sources.values()].sort())===JSON.stringify(s),data.sources));
 }
 await ctx.close();
}
check('PC i mobile DPR2/3: identyczne pliki materiałów',sets.every(s=>JSON.stringify(s)===JSON.stringify(sets[0])));
const ctx=await browser.newContext();await ctx.addInitScript(()=>{addEventListener('DOMContentLoaded',()=>{const d=Game.prototype.draw;Game.prototype.draw=function(){window.__g=this;return d.call(this);};},{capture:true});});const p=await ctx.newPage();await p.goto(base+'/frame');const f=p.frames().find(f=>f.url().includes('/nested/game/'));await f.waitForFunction(()=>window.__g?.sprites.loaded);check('Lokalny iframe ładuje paczkę z relatywnymi ścieżkami',await f.evaluate(()=>__g.sprites.sources.size===90&&__g.sprites.errors.length===0));await p.screenshot({path:out+'/screenshots/packaged-iframe.png'});await ctx.close();
check('Paczka: brak błędów JS i brakujących odpowiedzi HTTP',!errors.length&&!missing.length,{errors,missing});
}finally{await browser.close();server.close();}
rows.push({name:'Fizyczny iPhone / Safari',status:'NOT RUN'},{name:'Rzeczywisty iframe CrazyGames',status:'NOT RUN'});
fs.writeFileSync(out+'/package-browser-results.json',JSON.stringify({rows},null,2)+'\n');console.log(JSON.stringify(rows.map(({name,status})=>({name,status})),null,2));if(rows.some(r=>r.status==='FAIL'))process.exitCode=1;
