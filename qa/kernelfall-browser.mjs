// Real nested-path iframe, asset decoding and reproducible supply-cut evidence.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {ROOT,OUT} from './lib.mjs';
const require=createRequire(import.meta.url);const {chromium}=require('playwright');
const out=path.join(OUT,'kernelfall');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 if(req.url==='/frame'){res.setHeader('Content-Type','text/html');res.end('<iframe src="/nested/index.html?lang=en" style="border:0;width:907px;height:510px"></iframe>');return;}
 const url=req.url.split('?')[0].replace(/^\/nested/,'');const file=path.join(ROOT,url==='/'?'index.html':url);
 if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.NC_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
const checks=[];const errors=[];const external=[];
try {
 const ctx=await browser.newContext({viewport:{width:1000,height:600}});
 await ctx.addInitScript(()=>{addEventListener('DOMContentLoaded',()=>{if(typeof Game==='undefined')return;const orig=Game.prototype.update;Game.prototype.update=function(dt){window.__g=this;return orig.call(this,dt);};});});
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',q=>{if(!q.url().startsWith(base))external.push(q.url());});
 await page.goto(base+'/frame');const frame=page.frames().find(f=>f.url().includes('/nested/'));await frame.waitForTimeout(1000);
 checks.push({name:'nested iframe starts and logo images decode',pass:await frame.evaluate(()=>document.title==='KERNELFALL'&&[...document.images].every(i=>i.complete&&i.naturalWidth>0)&&!!window.__g)});
 await page.screenshot({path:path.join(out,'iframe-nested.png')});
 for(const [archetype,level]of [['firewall',7],['data-memory',8],['neural-core',9]]){
  await frame.evaluate(level=>{const g=window.__g;g.level=level;g.generateCore(level);g.maxBalls=60;g.damageLevel=10;g.cash=1000;g.updateUI();},level);
  await frame.waitForTimeout(1000);await frame.locator('#gameCanvas').screenshot({path:path.join(out,`${archetype}-powered.png`)});
  // Explicit fixture cut through real hitBlock; screenshot labels distinguish this from natural play.
  await frame.evaluate(()=>{const g=window.__g;const root=g.blocks.find(b=>b.criticalPower&&b.alive);g.hitBlock(root,root.hp,root.cx,root.cy,'lance',true);});
  await frame.waitForTimeout(700);await frame.locator('#gameCanvas').screenshot({path:path.join(out,`${archetype}-cut-fixture.png`)});
  checks.push({name:`${archetype}: real graph disconnect visible`,pass:await frame.evaluate(()=>window.__g.blocks.some(b=>b.offline))});
 }
 await frame.evaluate(()=>{
  const c=document.createElement('canvas');c.id='qaSpecimens';c.width=600;c.height=240;c.style='position:absolute;inset:65px auto auto 10px;background:#080d15;z-index:99';document.body.append(c);
  const ctx=c.getContext('2d');ctx.fillStyle='#cceef5';ctx.font='14px Arial';ctx.fillText('Runtime renderer / 22, 34, 49 px / intact + damaged',12,20);
  let x=55;
  for(const size of [22,34,49]){
   for(const hp of [1,.35]){
    const blocks=[];
    for(const [i,kind]of ['armor','relay','heart'].entries()){
     const b=new Block(0,0,size,100,1,COLORS.hostile);b.kind=kind;b.hp=100*hp;b.applyCenter(x,55+i*65);blocks.push(b);
    }
    Block.drawCore(ctx,blocks,1,true,()=>{});x+=85;
   }
  }
 });
 await frame.locator('#qaSpecimens').screenshot({path:path.join(out,'runtime-specimens-22-34-49.png')});
 await frame.evaluate(()=>document.getElementById('qaSpecimens').remove());
 await frame.evaluate(()=>{const g=window.__g;g.level=12;g.generateCore(12);g.hitBlock(g.heart,g.heart.hp,g.heart.cx,g.heart.cy,'lance',true);});
 await frame.waitForTimeout(1200);await page.screenshot({path:path.join(out,'victory-fixture.png')});
 checks.push({name:'sector 12 continues to endless with victory',pass:await frame.evaluate(()=>window.__g.level===13&&window.__g.toasts.some(t=>t.text===window.__g.t('victory')))});
 checks.push({name:'zero errors or external requests',pass:errors.length===0&&external.length===0,errors,external});
 await ctx.close();
 for(const [width,height]of [[907,510],[800,450],[390,844],[1920,1080]]) {
  const fresh=await browser.newContext({viewport:{width,height},locale:'en-US',deviceScaleFactor:1});
  const shot=await fresh.newPage();await shot.goto(base+'/nested/index.html');await shot.waitForTimeout(4000);
  checks.push({name:`${width}x${height}: logo and goal fit`,pass:await shot.evaluate(()=>[...document.images].every(i=>i.naturalWidth>0)&&document.documentElement.scrollHeight===innerHeight&&document.documentElement.scrollWidth===innerWidth)});
  await shot.screenshot({path:path.join(out,`final-${width}x${height}.png`)});await fresh.close();
 }
}finally{await browser.close();server.close();}
fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(checks,null,2));console.log(JSON.stringify(checks,null,2));if(checks.some(c=>!c.pass))process.exitCode=1;
