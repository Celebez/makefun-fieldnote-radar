import {readFileSync,writeFileSync,mkdirSync,cpSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createContext,runInContext} from 'node:vm';
import {buildDossier} from './vendor/makefun-board.ts';
// Keep output computation and UI computation identical: execute the same model.
const root=fileURLToPath(new URL('.',import.meta.url));
const args=process.argv.slice(2);
const input=args.includes('--input')?args[args.indexOf('--input')+1]:'/input/snapshot.json';
const out=process.env.MAKEFUN_OUTPUT_DIR||'/output';
const snapshot=JSON.parse(readFileSync(input,'utf8'));
const context = createContext({});
const modelFiles = ['calibration.js','odds.js','plans.js','model.js'];
for (const file of modelFiles) {
 const source = readFileSync(join(root,'dashboard',file),'utf8');
 runInContext(source,context,{filename:file});
}
// Curated route/workflow data stays outside dashboard/ (the dossier reads dashboard source only).
const routes=JSON.parse(readFileSync(join(root,'routes.json'),'utf8'));
routes.workflows=JSON.parse(readFileSync(join(root,'workflows.json'),'utf8'));
context.RadarPlans.init(routes);
const radar=context.RadarModel.build(snapshot);
if(radar.rows.length<100 || radar.rows.length>4000)throw new Error('Ranked row count outside 100–4,000');
const slugs=new Set(radar.rows.map((r:any)=>r.slug));
if(snapshot.watchlist.some((s:string)=>!slugs.has(s)))throw new Error('Missing watchlist protocol');
if(radar.rows[0].implied_value_usd === radar.rows.at(-1).implied_value_usd)throw new Error('Ranking has no value spread');
const represented = [...radar.rows,...radar.live,...radar.excluded].map((r:any)=>r.slug);
if(represented.length!==snapshot.protocols.length || new Set(represented).size!==represented.length)
 throw new Error('Protocol views must partition the snapshot');
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
 if(row.exclusion && row.capital!==0)
  throw new Error('Coverage exception has a live trial '+row.slug);
 if(!(row.launch_odds>0&&row.launch_odds<=1))
  throw new Error('Launch odds outside (0,1] '+row.slug);
 if(row.value_if_launches<row.implied_value_usd)
  throw new Error('Odds adjustment raises value '+row.slug);
 if(!(row.plan_hours>0))throw new Error('Plan has no duration '+row.slug);
 if(row.rank_best>row.rank||row.rank_worst<row.rank)
  throw new Error('Rank range excludes the rank '+row.slug);
 if(!['Farm','Marginal','Skip','Research'].includes(row.econ.verdict))
  throw new Error('Unknown farm verdict '+row.slug);
}
mkdirSync(out,{recursive:true});
// Keep compact calculations and steps in the board; the page rebuilds peer lists.
const boardRows=radar.rows.map(({calibration,plan,...row}:any)=>row);
const board=JSON.stringify({as_of:radar.as_of,rows:boardRows})+'\n';
if(new TextEncoder().encode(board).length>8*1024*1024)throw new Error('Ranked board exceeds 8 MiB');
writeFileSync(join(out,'board.json'),board);
// Integrity seal: the exact board hash plus the invariants enforced above, shown on the page.
const integrity={sha256:createHash('sha256').update(board).digest('hex'),rows:radar.rows.length,
 ranks:'1–'+radar.rows.length,watchlist:radar.watch_covered+'/'+radar.watch_count,
 nonIncreasing:true,partition:radar.universe,asOf:radar.as_of};
writeFileSync(join(out,'data.js'),'const SNAPSHOT='+JSON.stringify(snapshot).replace(/</g,'\\u003c')+';\nconst ROUTES='+JSON.stringify(routes).replace(/</g,'\\u003c')+';\nconst INTEGRITY='+JSON.stringify(integrity)+';\n');
cpSync(join(root,'dashboard'),join(out,'dashboard'),{recursive:true});
cpSync(join(root,'screenshots'),join(out,'screenshots'),{recursive:true});
writeFileSync(join(out,'dossier.json'),buildDossier(out,{text_max_bytes:65536}));
console.log(JSON.stringify({rows:radar.rows.length,watchlist:radar.watch_covered,live:radar.live.length,excluded:radar.excluded.length,peers:radar.peer_count,audit:radar.audit,launchValidation:radar.launch.validation,coverage:radar.coverage}));
