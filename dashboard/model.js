/* Shared deterministic model: main.ts and the page execute these same functions. */
(function(root){
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const median=a=>{a=[...a].sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:null;};
const money=n=>'$'+Math.round(n).toLocaleString('en-US');
// All plans are conditional on verified access. The snapshot cannot establish
// eligibility, live fees, contract safety, revenue or future issuance.
function hasToken(p){return !!(p.symbol||p.gecko_id||(p.mcap_usd>0));}
function product(p){return /^(CEX|Bridge|Canonical Bridge|Liquid Staking|Liquid Restaking|Restaked BTC|Stablecoin Wrapper)$/.test(p.category||'')||/\b(wrapped|staked|staking)\b/i.test(p.name);}
function build(snapshot){
 const watch=new Set(snapshot.watchlist), asof=Date.parse(snapshot.as_of+'T00:00:00Z');
 const peers=snapshot.protocols.filter(p=>hasToken(p)&&p.mcap_usd>0&&p.tvl_usd>0&&!product(p));
 const ratios=peers.map(p=>clamp(p.mcap_usd/p.tvl_usd,.05,5));
 const global=median(ratios)||.5;
 const groups={}; for(const p of peers)(groups[p.category||'Other']??=[]).push(clamp(p.mcap_usd/p.tvl_usd,.05,5));
 const eligible=snapshot.protocols.filter(p=>watch.has(p.slug)||(!hasToken(p)&&!product(p)));
 const rows=eligible.map(p=>{
  const observations=groups[p.category||'Other']||[];
  const n=observations.length, weight=n/(n+8), cat=median(observations)||global;
  const multiple=weight*cat+(1-weight)*global;
  const age=p.listed_at?Math.max(0,Math.floor((asof-Date.parse(p.listed_at+'T00:00:00Z'))/86400000)):null;
  const growth=p.change_7d===null?0:clamp(p.change_7d,-50,100);
  const growthFactor=Math.exp(.30*Math.log(1+growth/100));
  const ageFactor=.70+.30*Math.min(age===null?365:age,1095)/1095;
  const implied=Math.max(1,Math.round(p.tvl_usd*multiple*growthFactor*ageFactor));
  const uncertainty=.35+(n<4?.15:0)+(age===null?.10:0)+(p.change_7d===null?.10:0);
  const low=Math.max(1,Math.round(implied*(1-uncertainty))),high=Math.round(implied*(1+uncertainty));
  const chain=p.chains[0]||'unreported chain';
  const gas=/Ethereum|Bitcoin/.test(chain)?'US$5–25':'US$0.20–3';
  const catname=p.category||'Other';
  const passive=/Risk Curators|RWA|CEX|Onchain Capital Allocator|Insurance/.test(catname);
  const budget=passive?0:/Lending|CDP/.test(catname)?100:50;
  const action=/Lending/.test(catname)?'Supply US$100 of an accepted liquid asset in the official lending market; avoid borrowing for this trial.':/Dexs|Liquidity Manager/.test(catname)?'Make one US$10 swap, then test US$50 of stable-pair liquidity only if a suitable pool exists.':/CDP/.test(catname)?'Open a US$100 collateral position only if supported, targeting at most 20% loan-to-value; otherwise skip.':/Derivatives|Options|Prediction/.test(catname)?'Read the settlement rules and use a demo first; if proceeding, cap any live position at US$10 and use no leverage.':/Restaking/.test(catname)?'Review slashing and withdrawal terms; test no more than US$50 only if deposits and exits are verifiable.':passive?'Check whether a public permissionless vault, pool or application is actually available. If gated, stay in research mode and commit US$0.':'Test a US$50 deposit only if a public product and withdrawal route are available; otherwise remain in research mode.';
  const plan=[
   {title:'Verify access',text:'Find '+p.name+' through its official documentation and verify contracts and the '+chain+' deployment. Token absence is only a snapshot record; independently check token and eligibility announcements.',cost:'US$0',time:'10–15 min',capital:0},
   {title:passive?'Research before funding':'Small product trial',text:action,cost:passive?'US$0 until access verified':money(budget)+' principal + '+gas+' estimated network fees',time:'15–25 min; gated access may take longer',capital:budget},
   {title:'Maintain useful activity',text:passive?'Recheck public-access and eligibility documentation once weekly for four weeks. Do not pay for points or impersonate an eligible investor.':'For four weeks, review the position weekly and make at most one useful product interaction. Stop if fees exceed US$20, liquidity deteriorates or eligibility excludes you.',cost:passive?'US$0':gas+' per interaction; US$20 fee stop',time:'10 min weekly × 4',capital:0},
   {title:'Test the exit',text:passive?'Before any future deposit, confirm access restrictions, withdrawal gates and who bears counterparty losses. Archive the terms; skip any unavailable exit.':'Withdraw a small portion first, revoke unused approvals and keep transaction receipts. Principal remains at risk; no points, token launch or reward is promised.',cost:passive?'US$0':gas+' exit estimate',time:'10–15 min plus any protocol withdrawal delay',capital:0}
  ];
  return {...p,rank:0,age_days:age,watchlist:watch.has(p.slug),token_status:'No token recorded',implied_value_usd:implied,low,high,multiple,peer_count:n,growthFactor,ageFactor,confidence:n>=8&&age!==null&&p.change_7d!==null?'Better evidenced':'Sparse evidence',action_mode:passive?'Research only':'Conditional trial',capital:budget,plan,farm_steps:plan.map(s=>s.title+': '+s.text+' Cost: '+s.cost+'. Time: '+s.time+'.')};
 }).sort((a,b)=>b.implied_value_usd-a.implied_value_usd||a.slug.localeCompare(b.slug));
 rows.forEach((r,i)=>r.rank=i+1);
 return {rows,live:snapshot.protocols.filter(hasToken).sort((a,b)=>(b.mcap_usd||0)-(a.mcap_usd||0)),excluded:snapshot.protocols.filter(p=>!hasToken(p)&&product(p)&&!watch.has(p.slug)),as_of:snapshot.as_of,source:snapshot.source,watch_count:watch.size,global_multiple:global,peer_count:peers.length,universe:snapshot.protocols.length};
}
root.RadarModel={build,money,hasToken};
})(globalThis);
