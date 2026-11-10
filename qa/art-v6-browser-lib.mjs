// Pre-integration A/B evidence only. Does not modify runtime files.
// Both variants use the real Game.draw. Page-only V6 image replacement and
// alpha>32 module fit are explicit candidate fixtures, not production integration.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const ROOT=process.cwd(),OUT=path.join(ROOT,'docs/art/kernelfall-v6/evidence'),SHOTS=path.join(OUT,'screenshots');
fs.mkdirSync(SHOTS,{recursive:true});
const runtimeBefore=Object.fromEntries(['game.js','style.css','index.html'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,f))).digest('hex')]));
const rows=[],pairs=[],drawn={v3:new Set(),v6:new Set()},errors=[],bad=[];
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://local').pathname;const file=path.resolve(ROOT,pathname==='/'?'index.html':'.'+pathname);if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',MIME[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.NC_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
async function make(width,height,dpr){
 const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,locale:'pl-PL',hasTouch:width<900});
 await ctx.addInitScript(()=>{
  let seed=11;window.__seed=n=>seed=n;Math.random=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
  localStorage.setItem('neonCrusher.audio.v1','muted');
  addEventListener('DOMContentLoaded',()=>{const u=Game.prototype.update;Game.prototype.update=function(dt){window.__g=this;if(!window.__paused)return u.call(this,dt)};},{capture:true,once:true});
 });
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)bad.push({url:r.url(),status:r.status()})});
 await p.goto(base);await p.waitForFunction(()=>window.__g?.sprites.loaded);await p.evaluate(async()=>{
  window.__paused=true;const a=__g.sprites;window.__v3Images=new Map(a.images);window.__v3get=a.get;window.__v3RenderBackground=__g.renderBackground;window.__v6Images=new Map();window.__sourceDrawn={v3:[],v6:[]};window.__variant='v3';
  const paths=[...a.images.keys()].filter(id=>!id.startsWith('ui/')&&!id.startsWith('environment/'));
  for(const env of ['firewall','memory','neural'])paths.push(`environment/arena_${env}_1280x720.png`);
  await Promise.all(paths.map(id=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{window.__v6Images.set(id,img);resolve()};img.onerror=()=>reject(new Error(id));img.src='assets/kernelfall-art-v6/'+id;})));
  const draw=a.draw;a.draw=function(ctx,id,...args){const r=draw.call(this,ctx,id,...args);if(r){if(id==='firewall_locked')id='modules/firewall_intact_256.png';if(id==='firewall_broken')id='modules/firewall_broken_256.png';window.__sourceDrawn[window.__variant].push((window.__variant==='v6'&&window.__v6Images.has(id)?'assets/kernelfall-art-v6/':'assets/kernelfall-v3/')+id);}return r;};
 });return {ctx,p};
}
async function variant(p,v,level=7,fit=true,backgroundCover=false){await p.evaluate(({v,level,fit,backgroundCover})=>{
 const g=__g,a=g.sprites;window.__variant=v;a.images=new Map(window.__v3Images);
 if(v==='v6')for(const [id,img]of window.__v6Images)a.images.set(id,img);
 if(v==='v6')a.images.set('environment/arena_floor_1024.png',window.__v6Images.get(`environment/arena_${['firewall','memory','neural'][(level-1)%3]}_1280x720.png`));
 a.cache.clear();a.cachePixels=0;a.bounds.clear();a.revision++;g.bgKey='';
 a.get=v==='v6'&&fit?function(id,px){
  if(!id.startsWith('modules/'))return window.__v3get.call(this,id,px);
  const img=this.images.get(id);if(!img)return null;const n=Math.max(8,Math.min(2048,Math.ceil(px))),key=id+'|'+n;if(this.cache.has(key))return this.cache.get(key);
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);const d=ctx.getImageData(0,0,256,256).data;let x0=256,y0=256,x1=0,y1=0;for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(d[(y*256+x)*4+3]>32){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1)}
  c.width=c.height=n;const g=c.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(img,x0,y0,x1-x0,y1-y0,0,0,n,n);this.storeRaster(key,c);return c;
 }:window.__v3get;
 g.renderBackground=v==='v6'&&backgroundCover?function(){
  // Preserve all production background passes; adapt only the floor blit's
  // aspect ratio with a centred cover crop into the real world rectangle.
  const draw=CanvasRenderingContext2D.prototype.drawImage,floor=this.sprites.images.get('environment/arena_floor_1024.png'),w=this.width,h=this.height;
  CanvasRenderingContext2D.prototype.drawImage=function(img,...args){
   if(img===floor&&args.length===4){const scale=Math.max(w/img.width,h/img.height),sw=w/scale,sh=h/scale;return draw.call(this,img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,0,0,w,h)}return draw.call(this,img,...args);
  };try{return window.__v3RenderBackground.call(this)}finally{CanvasRenderingContext2D.prototype.drawImage=draw}
 }:window.__v3RenderBackground;
 window.__seed(1107);g.level=level;g.time=4;g.reroutes=0;g.playerBreaks=0;g.shieldsBroken=0;g.manualVolleys=0;g.autoVolleys=0;g.generateCore(level);g.time=4;g.coreBornAt=0;g.cash=0;g.balls=[];g.volleyCharge=.75;g.volleyReadyFor=0;g.particles.active=[];g.floatTexts=[];g.rings=[];g.arcs=[];g.lances=[];g.syncFlash=0;g.exposed=null;g.toasts=[];g.breach=null;g.aim=null;g.screenFlash=0;g.shake=0;g.uiProgress=g.coreProgress;for(const t of g.turrets)t.flash=0;g.updateUI();g.draw();
 },{v,level,fit,backgroundCover});}
async function capture(p,v,name){
 const rel=`screenshots/${name}-${v}.png`;await p.screenshot({path:path.join(OUT,rel)});
 const state=await p.evaluate(()=>{const g=__g;return{seed:1107,time:g.time,level:g.level,archetype:g.archetype,blocks:g.blocks.map(b=>[b.x,b.y,b.size,b.kind,b.hp,b.maxHp,b.alive,b.offline,b.firewall]),balls:g.balls.map(b=>[b.x,b.y,b.vx,b.vy]),charge:g.volleyCharge,defense:g.defense?.t||null,exposed:g.exposed?.t||null,breach:g.breach?.t||null,canvas:[g.canvas.width,g.canvas.height],world:[g.width,g.height],viewScale:g.viewScale,dpr:g.dpr,artScale:{bossWorldSide:Math.min(g.coreExtent*g.coreScale*3,Math.min(g.width,g.height)*.86),bossCSSSide:Math.min(g.coreExtent*g.coreScale*3,Math.min(g.width,g.height)*.86)*g.viewScale,bossDeviceSide:Math.min(g.coreExtent*g.coreScale*3,Math.min(g.width,g.height)*.86)*g.viewScale*g.dpr,boss512DeviceUpscale:Math.min(g.coreExtent*g.coreScale*3,Math.min(g.width,g.height)*.86)*g.viewScale*g.dpr/512,moduleCSSSide:[Math.min(...g.blocks.filter(b=>b.kind!=='heart').map(b=>b.size*g.viewScale)),Math.max(...g.blocks.filter(b=>b.kind!=='heart').map(b=>b.size*g.viewScale))],moduleDeviceSide:[Math.min(...g.blocks.filter(b=>b.kind!=='heart').map(b=>b.size*g.viewScale*g.dpr)),Math.max(...g.blocks.filter(b=>b.kind!=='heart').map(b=>b.size*g.viewScale*g.dpr))]}}});
 const used=await p.evaluate(()=>window.__sourceDrawn[window.__variant]);for(const src of used)drawn[v].add(src);
 const env=v==='v6'?`assets/kernelfall-art-v6/environment/arena_${['firewall','memory','neural'][state.archetype]}_1280x720.png`:'assets/kernelfall-v3/environment/arena_floor_1024.png';drawn[v].add(env);
 return{image:rel,stateHash:crypto.createHash('sha256').update(JSON.stringify(state)).digest('hex'),state};
}
async function pair(p,name,level=7,action=null,fit=true){const versions={};for(const v of ['v3','v6']){await variant(p,v,level,fit);if(action)await p.evaluate(action);versions[v]=await capture(p,v,name)}const equal=versions.v3.stateHash===versions.v6.stateHash;rows.push({name,status:equal?'PASS':'FAIL',detail:'identical simulation state in both real Canvas draws'});pairs.push({name,versions,stateEqual:equal,fit});console.log(name,equal?'PASS':'FAIL');}
export {browser,server,make,variant,capture,pair,rows,pairs,drawn,errors,bad,OUT,SHOTS,runtimeBefore};
