// Real passive progression, buying upgrades, no manual aiming. Simulation only.
import {loadGame} from './lib.mjs';
import {greedyBuy} from './economy.mjs';
const rows=[];
for(const [width,height]of [[800,279],[907,339]]){
 const h=loadGame({seed:1,width,height});const g=h.newGame();g.draw=()=>{};
 let firstPurchase=null, firstLargeCut=null,maxOffline=0;const types=new Set();
 for(let second=1;second<=300;second++){
  h.run(1,60);types.add(g.archetype);
  const n=g.blocks.filter(b=>b.alive&&b.offline).length;maxOffline=Math.max(maxOffline,n);
  if(n>=3 && firstLargeCut===null)firstLargeCut=second;
  let bought=false;while(greedyBuy(h,g))bought=true;
  if(bought && firstPurchase===null)firstPurchase=second;
 }
 rows.push({canvas:`${width}x${height}`,firstPurchaseSeconds:firstPurchase,firstCutWithAtLeastThreeOfflineSeconds:firstLargeCut,maxOffline,archetypesSeen:[...types],sectorAtFiveMinutes:g.level,pass:firstPurchase<=60&&firstLargeCut!==null&&types.size===3});
}
console.log(JSON.stringify(rows,null,2));if(rows.some(r=>!r.pass))process.exitCode=1;
