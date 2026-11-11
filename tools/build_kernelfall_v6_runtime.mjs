// Mechaniczny podział poprawionych arkuszy image_gen. Bez masek i retuszu alfy.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';
const root='assets/kernelfall-v6-runtime',src='docs/art/kernelfall-v6/runtime/sources';
const cuts=[];
for(const [c,role]of ['scout','assault','support'].entries())cuts.push({role:`drones/${role}_256.png`,sheet:'drones-repaired.png',crop:[512,512,c*512,256],nose:'+X'});
for(const [i,state]of ['idle','charging','ready','firing'].entries())cuts.push({role:`uplinks/${state}_256.png`,sheet:'uplinks-repaired.png',crop:[627,627,(i%2)*627,Math.floor(i/2)*627],nose:'-Y'});
for(const [r,role]of ['armor','memory','relay','port','firewall'].entries())for(const [c,state]of ['intact','damaged','critical','isolated','broken'].entries())cuts.push({role:`modules/${role}_${state}_256.png`,sheet:'modules-repaired.png',crop:[230,230,28+c*243,30+r*240]});
const files=[];
for(const cut of cuts){
 const path=`${root}/${cut.role}`;fs.mkdirSync(path.slice(0,path.lastIndexOf('/')),{recursive:true});
 const [w,h,x,y]=cut.crop;
 execFileSync('magick',[`${src}/${cut.sheet}`,'-crop',`${w}x${h}+${x}+${y}`,'+repage','-resize','256x256',path]);
 const bytes=fs.readFileSync(path);files.push({...cut,path,original:`assets/kernelfall-art-v6/${cut.role}`,width:256,height:256,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
fs.writeFileSync(`${root}/manifest.json`,JSON.stringify({status:'Podłączone do produkcyjnego renderera; odbiór właścicielki NOT VERIFIED',method:'Edycja image_gen oryginałów V6; mechaniczne kadrowanie arkuszy i resize PNG. Bez masek, blur, progowania alfy i zmian colliderów.',files},null,2)+'\n');
console.log(`PASS: ${files.length} wariantów PNG V6`);
