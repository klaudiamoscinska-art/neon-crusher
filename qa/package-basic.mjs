// Build the exact reviewed HTML5 files; no deployment or portal side effects.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {ROOT,OUT} from './lib.mjs';
const files=['index.html','style.css','game.js','assets/brand/wordmark-480.png','assets/brand/symbol-small-editable.svg'];
const dir=path.join(OUT,'crazygames-html5');
// Rebuild this tool-owned output folder so stale files cannot enter an upload.
fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
const manifest=[];
for(const file of files){const source=fs.readFileSync(path.join(ROOT,file));const dest=path.join(dir,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,source);manifest.push({file,bytes:source.length,sha256:crypto.createHash('sha256').update(source).digest('hex')});}
for(const file of ['index.html','style.css','game.js']){
 const s=fs.readFileSync(path.join(dir,file),'utf8').replace("const SVG_NS = 'http://www.w3.org/2000/svg';",'');
 if(/(?:src|href)=["'](?:https?:|\/)|fetch\(|@import|url\(["']?https?:/i.test(s))throw Error(`external resource: ${file}`);
}
for(const match of fs.readFileSync(path.join(dir,'index.html'),'utf8').matchAll(/(?:src|href)="([^"]+)"/g))if(!files.includes(match[1]))throw Error(`missing file ${match[1]}`);
const zip=path.join(OUT,'kernelfall-basic.zip');if(fs.existsSync(zip))fs.unlinkSync(zip);
execFileSync('zip',['-q',zip,...files],{cwd:dir});
execFileSync('unzip',['-t',zip],{stdio:'pipe'});
fs.writeFileSync(path.join(OUT,'package-manifest.json'),JSON.stringify({files:manifest,totalBytes:manifest.reduce((s,f)=>s+f.bytes,0),zipBytes:fs.statSync(zip).size,zipSHA256:crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex')},null,2));
console.log('PASS relative HTML5 folder and ZIP validated',JSON.stringify(manifest));
