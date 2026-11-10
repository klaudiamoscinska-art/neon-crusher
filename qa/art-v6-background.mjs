// Supplemental aspect-correct floor adapters. All output is real Game.draw.
import fs from 'node:fs';
import path from 'node:path';
import {browser,server,make,variant,capture,rows,errors,bad,OUT} from './art-v6-browser-lib.mjs';
const results=[];
try{
 for(const [w,h,dpr,level] of [[907,510,1,7],[907,510,1,8],[907,510,1,9],[390,844,3,7]]){
  const{ctx,p}=await make(w,h,dpr);const variants={};
  for(const v of ['v3','v6']){
   await variant(p,v,level,true,true);variants[v]=await capture(p,v,`aspect-cover-${w}x${h}-dpr${dpr}-sector${level}`);
   variants[v].atlas=await p.evaluate(()=>{const a=__g.sprites,imgs=[...new Set(a.images.values())];return{imageCount:imgs.length,decodedImageRGBABytes:imgs.reduce((s,i)=>s+i.width*i.height*4,0),cacheRGBABytes:a.cachePixels*4,cacheEntries:a.cache.size,cacheBudgetBytes:48*1024*1024,backgroundRGBABytes:__g.bgCanvas.width*__g.bgCanvas.height*4,scope:'Referenced decoded image RGBA estimate + separately referenced cached raster + background. Excludes browser/GPU overhead and test-only held counterpart atlas.'}});
  }
  results.push({name:`${w}x${h}-dpr${dpr}-sector${level}`,status:variants.v3.stateHash===variants.v6.stateHash?'PASS':'FAIL',variants});await ctx.close();
 }
}finally{await browser.close();server.close()}
fs.writeFileSync(path.join(OUT,'background-cover.json'),JSON.stringify({method:'Supplementary V6 aspect-correct centred cover replaces only floor drawImage inside real renderBackground; all other Game.draw passes identical. V3 retains original background. Candidate browser fixture, not production integration.',results,errors,bad},null,2)+'\n');console.log(results.map(r=>({name:r.name,status:r.status,atlas:Object.fromEntries(Object.entries(r.variants).map(([v,x])=>[v,x.atlas]))})));
