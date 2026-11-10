// Controlled render-only comparison. Headless software Chromium is NOT a phone.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url), {chromium}=require('playwright');
const root=process.cwd(), before='/tmp/kernelfall-v3-performance-base';
fs.mkdirSync(before,{recursive:true});
const archive=execFileSync('git',['archive','origin/main'],{maxBuffer:64*1024*1024});
execFileSync('tar',['-x','-C',before],{input:archive});
const out=path.join(root,'docs/qa/kernelfall-art-v3');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const isBase=req.url.startsWith('/before/'), target=isBase?before:root;
 const pathname=req.url.split('?')[0].replace(/^\/(before|after)/,'');
 const file=path.join(target,pathname==='/'?'index.html':pathname);
 if(!file.startsWith(target)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.NC_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
const results=[];
try {
 for(const dpr of [1,2]) {
  const contexts=[],pages=[];
  for(const build of ['before','after']) {
   const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:dpr});contexts.push(context);
   await context.addInitScript(()=>{
    // Keep the real startup and freeze only after the game object exists.
    const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(t=>{if(!window.__freeze)cb(t)});
    addEventListener('DOMContentLoaded',()=>{const draw=Game.prototype.draw;Game.prototype.draw=function(){window.__g=this;return draw.call(this)}});
   });
   const page=await context.newPage();pages.push(page);
   await page.goto(`http://127.0.0.1:${server.address().port}/${build}/index.html?lang=en`);
   await page.waitForFunction(()=>window.__g&&(__g.sprites.ready?__g.sprites.loaded:__g.sprites.images.size===5));
   await page.waitForTimeout(500);
   await page.evaluate(()=>{
    const g=__g;window.__freeze=true;g.level=13;g.generateCore(13);g.time=20;g.coreBornAt=0;
    g.maxBalls=60;g.balls=[];g.particles.active=[];g.floatTexts=[];g.rings=[];g.lances=[];g.arcs=[];g.breach=null;g.toasts=[];g.screenFlash=0;g.shake=0;g.syncFlash=0;
    for(let i=0;i<60;i++) g.balls.push(new Ball(15+(i*37)%(g.width-30),15+(i*29)%(g.height-30),i*.7,250,5,COLORS.cyan));
    g.updateUI();g.draw();
   });
  }
  // Alternate independent draws on exactly the same static simulation scene.
  const samples={before:[],after:[]};
  for(let trial=0;trial<7;trial++) {
   for(const index of trial%2?[1,0]:[0,1]) {
    const ms=await pages[index].evaluate(()=>{
     const g=__g;for(let i=0;i<8;i++)g.draw();
     const start=performance.now();
     for(let i=0;i<50;i++){g.draw();g.ctx.getImageData(0,0,1,1);}
     return (performance.now()-start)/50;
    });samples[index?'after':'before'].push(ms);
   }
  }
  const median=a=>a.slice().sort((a,b)=>a-b)[Math.floor(a.length/2)];
  const old=median(samples.before), now=median(samples.after),change=(now/old-1)*100;
  results.push({name:`1920x1080 DPR${dpr},60 drones render+raster`,status:change<=10?'PASS':'FAIL',baselineRef:execFileSync('git',['rev-parse','origin/main'],{encoding:'utf8'}).trim(),beforeMs:old,afterMs:now,changePercent:change,samples,method:'7 alternating samples ×50 draws,50th-percentile sample. Identical static sector13 fixture,force raster via getImageData. rAF frozen; measures draw+raster only, not physical GPU/FPS.'});
  await pages[1].screenshot({path:path.join(out,`screenshots/performance-60-drones-dpr${dpr}.png`)});
  for(const context of contexts)await context.close();
 }
}finally {await browser.close();server.close();}
fs.writeFileSync(path.join(out,'performance-results.json'),JSON.stringify({environment:'Headless Debian Chromium / cloud shared CPU; software raster; physical iPhone NOT RUN',runtimeSHA256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'game.js'))).digest('hex'),results},null,2));
console.log(JSON.stringify(results,null,2));if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
