// Development-only controlled A/A measurement. V6 integration is blocked;
// neither page substitutes assets. This does not measure production V6.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=process.cwd(),before='/tmp/kernelfall-v6-performance-base';
fs.mkdirSync(before,{recursive:true});
const archive=execFileSync('git',['archive','origin/main'],{maxBuffer:64*1024*1024});
execFileSync('tar',['-x','-C',before],{input:archive});
const out=path.join(root,'docs/art/kernelfall-v6/evidence');fs.mkdirSync(out,{recursive:true});
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const server=http.createServer((req,res)=>{
 const isBase=req.url.startsWith('/before/'),target=isBase?before:root;
 const pathname=req.url.split('?')[0].replace(/^\/(before|after)/,'');
 const file=path.join(target,pathname==='/'?'index.html':pathname);
 if(!file.startsWith(target)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.NC_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
const results=[];
try{
 for(const[width,height,dpr]of[[1920,1080,1],[390,844,3]]){
  const contexts=[],pages=[],scenes=[],memories=[];
  for(const build of['before','after']){
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr});contexts.push(context);
   await context.addInitScript(()=>{
    const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(t=>{if(!window.__freeze)cb(t)});
    window.__resetSeed=()=>{let seed=0x4b465636;Math.random=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};};
    __resetSeed();addEventListener('DOMContentLoaded',()=>{const draw=Game.prototype.draw;Game.prototype.draw=function(){window.__g=this;return draw.call(this);};});
   });
   const page=await context.newPage();pages.push(page);
   await page.goto(`http://127.0.0.1:${server.address().port}/${build}/index.html?lang=en`);
   await page.waitForFunction(()=>window.__g?.sprites.loaded);
   await page.evaluate(()=>{
    window.__freeze=true;__resetSeed();const g=window.__g;g.level=13;g.generateCore(13);g.time=20;g.coreBornAt=0;
    g.cash=1000;g.maxBalls=60;g.balls=[];g.particles.active=[];g.floatTexts=[];g.rings=[];g.lances=[];g.arcs=[];g.breach=null;g.toasts=[];g.screenFlash=0;g.shake=0;g.syncFlash=0;g.exposed=null;g.defense=null;g.volleyCharge=.75;g.netPhase=0;g.uiProgress=g.coreProgress;g.bgCanvas=null;g.bgKey='';
    for(const t of g.turrets){t.flash=0;t.angle=Math.atan2(g.heart.cy-t.y,g.heart.cx-t.x);}
    for(let i=0;i<60;i++)g.balls.push(new Ball(15+(i*37)%(g.width-30),15+(i*29)%(g.height-30),i*.7,250,5,COLORS.cyan));
    g.sprites.cache.clear();g.sprites.cachePixels=0;g.updateUI();g.draw();
   });
   scenes.push(await page.evaluate(()=>{const g=window.__g;return{time:g.time,level:g.level,blocks:g.blocks.map(b=>[b.x,b.y,b.size,b.kind,b.variant,b.hp,b.maxHp,b.alive,b.offline,b.firewall]),balls:g.balls.map(b=>[b.x,b.y,b.radius,b.vx,b.vy]),turrets:g.turrets.map(t=>[t.x,t.y,t.angle]),viewport:[innerWidth,innerHeight,g.dpr],world:[g.width,g.height,g.coreExtent,g.coreScale],cash:g.cash};}));
   memories.push(await page.evaluate(()=>{const a=window.__g.sprites;return{loadedImages:a.images.size,sourceDecodedRGBABytes:[...a.images.values()].reduce((s,i)=>s+i.naturalWidth*i.naturalHeight*4,0),cacheRGBABytes:a.cachePixels*4,cacheEntries:a.cache.size,cacheActualRGBABytes:[...a.cache.values()].reduce((s,c)=>s+c.width*c.height*4,0),cacheBudgetRGBABytes:48*1024*1024,backgroundRGBABytes:window.__g.bgCanvas.width*window.__g.bgCanvas.height*4,usedScope:'Cumulative atlas usage includes startup before the deterministic fixture; not an exact fixture-only list.',used:[...a.used].sort()};}));
  }
  const samples={before:[],after:[]};
  for(let trial=0;trial<7;trial++)for(const index of trial%2?[1,0]:[0,1]){
   const ms=await pages[index].evaluate(()=>{const g=window.__g;for(let i=0;i<8;i++)g.draw();const start=performance.now();for(let i=0;i<30;i++){g.draw();g.ctx.getImageData(0,0,1,1);}return(performance.now()-start)/30;});
   samples[index?'after':'before'].push(ms);
  }
  const median=a=>a.slice().sort((a,b)=>a-b)[Math.floor(a.length/2)],old=median(samples.before),now=median(samples.after),change=(now/old-1)*100;
  results.push({name:`${width}x${height} DPR${dpr} / sector13 / 60 drones`,scope:'A/A V3 control; no V6 assets',status:sha(JSON.stringify(scenes[0]))===sha(JSON.stringify(scenes[1]))?'PASS':'FAIL',sceneSHA256:scenes.map(s=>sha(JSON.stringify(s))),beforeMs:old,afterMs:now,changePercent:change,thresholdObservation:change<=10?'PASS':'NOT VERIFIED',thresholdExplanation:change<=10?'A/A median difference is within 10%; no V6 production performance claim.':'More than 10% A/A variation despite byte-identical runtime; shared-cloud timing noise requires isolated rerun; no V6 production decision inferred.',samples,memory:{before:memories[0],after:memories[1]},memoryScope:'Computed referenced RGBA pixels in loaded images and cached canvases only. Excludes GPU copies, decoder temporaries, browser heap and total process RSS.',method:'7 alternating samples ×30 forced-raster draws, median. Warmed static identical seeded scene; native requestAnimationFrame stopped after startup. Canvas getImageData forces raster; not physical GPU/FPS.'});
  for(const c of contexts)await c.close();
 }
}finally{await browser.close();server.close();}
const result={generatedAt:new Date().toISOString(),environment:'Headless Debian Chromium / cloud shared CPU / software raster',baselineRef:execFileSync('git',['rev-parse','origin/main'],{encoding:'utf8'}).trim(),runtimeSHA256:sha(fs.readFileSync(path.join(root,'game.js'))),baselineRuntimeSHA256:sha(fs.readFileSync(path.join(before,'game.js'))),productionV6Measurement:{status:'NOT RUN',reason:'No V6 asset was admitted to the production runtime; visual gate blocked integration. A/A V3 results are baseline/control only.'},physicalIPhone:{status:'NOT RUN',reason:'No device attached'},results};
fs.writeFileSync(path.join(out,'performance-control.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
