// Power topology, bounded erosion and v1 campaign continuity, real runtime.
import {loadGame, Reporter, isMain, FakeStorage} from './lib.mjs';
export function run() {
  const r = new Reporter('collapse');
  for (let level=1;level<=12;level++) {
    const h=loadGame({seed:7}); const g=h.newGame(); g.level=level; g.generateCore(level);
    const graph=g.powerEdges;
    r.check(`sector ${level}: every module has one supply edge`,graph.length===g.blocks.length-1 && new Set(graph.map(e=>e.b)).size===graph.length);
    r.check(`sector ${level}: connected acyclic supply to heart`,g.blocks.every(b=>{const seen=new Set();while(b && b.kind!=='heart'){if(seen.has(b))return false;seen.add(b);b=b.powerParent;}return !!b;}));
    const root=g.blocks.find(b=>b.criticalPower && graph.some(e=>e.a===b));
    if (!root) {r.check(`sector ${level}: critical branch`,false);continue;}
    root.alive=false;
    const cash=g.cash, hp=g.heart.hp;
    g.updateCollapse(0.45);
    r.check(`sector ${level}: cut disconnects descendants, never heart`,graph.some(e=>e.a===root && e.b.offline) && !g.heart.offline && g.heart.hp===hp);
    r.check(`sector ${level}: no income or instant wipe`,g.cash===cash && g.blocks.filter(b=>b.alive).length===g.blocks.length-1);
    const connected=g.blocks.filter(b=>b.alive&&!b.offline).map(b=>[b,b.hp]);
    for(let i=0;i<100;i++)g.updateCollapse(0.45);
    r.check(`sector ${level}: failure respects supply edges`,connected.every(([b,hp])=>b.hp===hp));
  }
  const storage=new FakeStorage({'neonCrusher.save.v1':JSON.stringify({cash:1234,level:13,maxBalls:8,fireRateLevel:3,damageLevel:4})});
  const h=loadGame({storage});const g=h.newGame();
  r.check('old v1 save beyond final sector continues endless',g.level===13&&g.cash===1234&&g.maxBalls===8);
  g.save();const saved=JSON.parse(storage.getItem('neonCrusher.save.v1'));
  r.check('campaign adds no save fields',Object.keys(saved).sort().join(',')==='cash,damageLevel,fireRateLevel,level,maxBalls');
  const traces=[];
  for(const hz of [60,144,165]) {
    const hh=loadGame({seed:8});const gg=hh.newGame();gg.level=6;gg.generateCore(6);
    const root=gg.blocks.find(b=>b.criticalPower);root.alive=false;
    const at=new Map();
    hh.run(20,hz,(_,g)=>at.set(g.simSteps,JSON.stringify([g.cash,g.level,g.blocks.map(b=>[b.hp,b.offline]),g.balls.map(b=>[b.x,b.y])])));
    traces.push(at);
  }
  let count=0, same=true;
  for(const [step,state] of traces[0])for(const t of traces.slice(1))if(step && t.has(step)){count++;if(t.get(step)!==state)same=false;}
  r.check('collapse simulation identical at equal fixed steps at 60/144/165 Hz',count>0&&same,`${count} comparisons`);
  const renderStates=[];
  for (const render of [true,false]) {
    const hh=loadGame({seed:19});const gg=hh.newGame();gg.level=6;gg.generateCore(6);
    gg.draw=render ? hh.Game.prototype.draw : ()=>{};
    hh.run(5,60);
    renderStates.push(JSON.stringify([gg.cash,gg.level,gg.blocks.map(b=>b.hp),gg.balls.map(b=>[b.x,b.y])]));
  }
  r.check('rendering does not affect simulation RNG or state',renderStates[0]===renderStates[1]);
  return r;
}
if(isMain(import.meta.url))process.exit(run().finish());
