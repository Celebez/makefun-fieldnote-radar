import {readFileSync,writeFileSync,mkdirSync,cpSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {buildDossier} from './vendor/makefun-board.ts';
// Keep output computation and UI computation identical: execute the same model.
const root=fileURLToPath(new URL('.',import.meta.url));
const args=process.argv.slice(2);
const input=args.includes('--input')?args[args.indexOf('--input')+1]:'/input/snapshot.json';
const out=process.env.MAKEFUN_OUTPUT_DIR||'/output';
const snapshot=JSON.parse(readFileSync(input,'utf8'));
const context:any={};
runInNewContext(readFileSync(join(root,'dashboard/model.js'),'utf8'),context);
const radar=context.RadarModel.build(snapshot);
if(radar.rows.length<100)throw new Error('Fewer than 100 eligible protocols');
const slugs=new Set(radar.rows.map((r:any)=>r.slug));
if(snapshot.watchlist.some((s:string)=>!slugs.has(s)))throw new Error('Missing watchlist protocol');
// Fail before writing output if model changes violate the submission contract.
const inputSlugs=new Set(snapshot.protocols.map((p:any)=>p.slug));
const seen=new Set<string>();
for(let i=0;i<radar.rows.length;i++){
 const row=radar.rows[i];
 if(!inputSlugs.has(row.slug))throw new Error('Unknown protocol '+row.slug);
 if(seen.has(row.slug))throw new Error('Duplicate protocol '+row.slug);
 seen.add(row.slug);
 if(row.rank!==i+1)throw new Error('Non-contiguous rank '+row.slug);
 if(!Number.isSafeInteger(row.implied_value_usd)||row.implied_value_usd<1)
  throw new Error('Invalid valuation '+row.slug);
 if(row.implied_value_usd>100_000_000_000_000)
  throw new Error('Valuation exceeds cap '+row.slug);
 if(i&&radar.rows[i-1].implied_value_usd<row.implied_value_usd)
  throw new Error('Value ranking rises '+row.slug);
 if(row.farm_steps.length<3||row.farm_steps.length>12)
  throw new Error('Invalid step count '+row.slug);
 for(const step of row.farm_steps){
  if(typeof step!=='string'||step.trim().length<20||step.trim().length>600)
   throw new Error('Invalid farming instruction '+row.slug);
 }
 if(row.low>row.implied_value_usd||row.high<row.implied_value_usd)
  throw new Error('Sensitivity does not enclose estimate '+row.slug);
 if(row.plan[1].capital!==row.capital)
  throw new Error('Plan and badge capital disagree '+row.slug);
}
mkdirSync(out,{recursive:true});
writeFileSync(join(out,'board.json'),JSON.stringify({rows:radar.rows})+'\n');
writeFileSync(join(out,'data.js'),'const SNAPSHOT='+JSON.stringify(snapshot).replace(/</g,'\\u003c')+';\n');
cpSync(join(root,'dashboard'),join(out,'dashboard'),{recursive:true});
cpSync(join(root,'screenshots'),join(out,'screenshots'),{recursive:true});
writeFileSync(join(out,'dossier.json'),buildDossier(out,{text_max_bytes:65536}));
console.log(JSON.stringify({rows:radar.rows.length,watchlist:radar.watch_count,live:radar.live.length,peers:radar.peer_count}));
