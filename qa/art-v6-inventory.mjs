// Retained inventory separates actual production use from QA-only A/B draws.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=process.cwd(), out=path.join(root,'docs/art/kernelfall-v6/evidence');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const runtime=['game.js','index.html','style.css'].map(file=>{
 const base=execFileSync('git',['show',`origin/main:${file}`]);
 const candidate=fs.readFileSync(path.join(root,file));
 return {file,baseSHA256:hash(base),candidateSHA256:hash(candidate),identical:base.equals(candidate)};
});
if(runtime.some(r=>!r.identical))throw new Error('Runtime differs: review inventory assumptions before publishing.');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/kernelfall-art-v6/manifest.json')));
const ab=JSON.parse(fs.readFileSync(path.join(out,'browser-ab.json')));
if(ab.rows.some(r=>r.status==='FAIL'))throw new Error('A/B QA failures must be resolved or reported before inventory.');
const previews=new Set(ab.runtimeDrawnFixtureSources.v6.filter(p=>p.startsWith('assets/kernelfall-art-v6/')));
const reasons={
 bosses:'HOLD: upscaled soft detail/edge residue and bright housing compete with actual heart; preserve V3.',
 modules:'HOLD: role/state readability and square collider footprint are weaker in Canvas A/B; preserve V3.',
 drones:'REDO: opaque circular background remnants in all three hull sources; preserve V3.',
 uplinks:'REDO: non-directional orb and weak charge/fire distinction; preserve V3.',
 environment:'REDO: perspective room and decorative central target compete with top-down play; preserve V3.',
 fx:'HOLD: no demonstrated in-game improvement; see SOURCE_AUDIT_PL.md for family-specific corrections.',
 brand:'UNCHANGED: copies of existing brand PNGs, no demonstrated visual improvement.',
};
const files=manifest.files.map(f=>{
 const family=f.path.split('/')[2];
 return {path:f.path,sha256:f.sha256,productionDrawn:false,abFixtureDrawn:previews.has(f.path),decision:reasons[family]};
});
fs.writeFileSync(path.join(out,'integration-decisions.json'),JSON.stringify({
 generatedAt:new Date().toISOString(),verdict:'BLOCKED',
 baseSHA:execFileSync('git',['rev-parse','origin/main'],{encoding:'utf8'}).trim(),runtime,
 productionDrawn:[],productionUnused:files.map(f=>f.path),
 fixtureScope:'Only browser fixture image substitution and actual SpriteAtlas draw calls; not production integration or natural gameplay.',
 fixtureV6Drawn:[...previews].sort(),files,
},null,2)+'\n');

const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const screenshots=walk(out).filter(p=>p.endsWith('.png')).map(file=>{
 const b=fs.readFileSync(file);
 return {path:path.relative(root,file),bytes:b.length,sha256:hash(b),width:b.readUInt32BE(16),height:b.readUInt32BE(20),
  scope:file.includes('/idle/')?'Natural idle / real unpaused V3 runtime':'Explicit QA fixture / real Canvas; V6 only browser-side preview'};
});
fs.writeFileSync(path.join(out,'screenshots-index.json'),JSON.stringify({screenshots},null,2)+'\n');
console.log(JSON.stringify({runtimeIdentical:true,productionV6Drawn:0,productionV6Unused:files.length,fixtureV6Drawn:previews.size,screenshots:screenshots.length}));
