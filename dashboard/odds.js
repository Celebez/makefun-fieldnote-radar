/* Launch odds, farm economics, held-out validation; shared by build and page. */
(function(root){
'use strict';
const{clip,hasToken,makePeers,calibration}=root.RadarCalibration;
const DAY=86400000;
const ageOf=(p,day)=>{
  const seen=Date.parse((p.listed_at || '')+ 'T00:00:00Z');
  return Number.isFinite(seen)? Math.max(0,Math.floor((day - seen)/ DAY)):null;
};
const BUCKETS=[[0,180],[180,365],[365,730],[730,1460],[1460,Infinity]];
const bucketIndex=age=>BUCKETS.findIndex(([lo,hi])=>age>=lo && age<hi);
const shrink=(value,weight,prior,k)=>(value*weight + prior*k)/(weight + k);
/* One scoring routine for every held-out test: accuracy + Brier vs a flat base. */
const newScore=()=>({correct:0,baseCorrect:0,n:0,mB:{sum:0,n:0},bB:{sum:0,n:0}});
function addScore(s,p,pBase,majority,token){
  const y=token ? 1:0;
  if((p>=.5)===token)s.correct++;
  if(majority===token)s.baseCorrect++;
  s.mB.sum +=(p - y)*(p - y);s.mB.n++;
  s.bB.sum +=(pBase - y)*(pBase - y);s.bB.n++;
  s.n++;
}
const finScore=s=>({n:s.n,correct:s.correct,accuracy:s.n ? s.correct / s.n:0,
  baseRate:s.n ? s.baseCorrect / s.n:0,brier:s.mB.n ? s.mB.sum / s.mB.n:0,
  baseBrier:s.bB.n ? s.bB.sum / s.bB.n:0});
/* Age-corrected category ever-rate + monotone CDF F(a); odds = ever(1-F)/(1-ever*F). */
function fitCore(protocols,day){
  const total=protocols.length;
  const tokenized=protocols.filter(hasToken).length;
  const everGlobal=total ? tokenized / total:0;
  const aged=protocols.map(p=>({p,age:ageOf(p,day),token:hasToken(p)})).filter(x=>x.age!==null);
  const bucketStats=BUCKETS.map(([lo,hi])=>{
    const inBucket=aged.filter(x=>x.age>=lo && x.age<hi);
    const withToken=inBucket.filter(x=>x.token).length;
    return{lo,hi,n:inBucket.length,withToken,tokenRate:inBucket.length ? withToken / inBucket.length:everGlobal};
  });
  let running=0;
  const launchCdf=bucketStats.map(b=>{running=Math.max(running,clip(b.tokenRate / Math.max(everGlobal,1e-9),0,1));return running;});
  const meanAge=aged.length ? aged.reduce((s,x)=>s + x.age,0)/ aged.length:365;
  const fallbackF=launchCdf[bucketIndex(Math.round(meanAge))];
  const everGlobalCorrected=clip(everGlobal / Math.max(fallbackF,.1),.02,.95);
  const categories={};
  for(const p of protocols){
    const c=p.category || 'Uncategorized';
    categories[c]=categories[c]||{name:c,total:0,withToken:0,ageSum:0,ageN:0};
    categories[c].total++;
    if(hasToken(p))categories[c].withToken++;
    const age=ageOf(p,day);
    if(age!==null){categories[c].ageSum += age;categories[c].ageN++;}
  }
  function correctEver(withToken,count,ageSum,ageN){
    const raw=count ? withToken / count:everGlobal;
    const F=ageN ? launchCdf[bucketIndex(Math.round(ageSum / ageN))]:fallbackF;
    const corrected=clip(raw / Math.max(F,.1),.02,.95);
    return shrink(corrected,count,everGlobalCorrected,8);
  }
  for(const c of Object.values(categories)){
    c.rawRate=c.total ? c.withToken / c.total:0;
    c.ever=correctEver(c.withToken,c.total,c.ageSum,c.ageN);
  }
  function oddsFor(protocol){
    const c=categories[protocol.category || 'Uncategorized'];
    const ever=c ? c.ever:everGlobalCorrected;
    const age=ageOf(protocol,day);
    const F=age===null ? fallbackF:launchCdf[bucketIndex(age)];
    const denom=1 - ever*F;
    const odds=denom>0 ? ever*(1 - F)/ denom:ever;
    return{odds:clip(odds,.02,.95),ever,F,age,byNow:clip(ever*F,0,1)};
  }
  return{total,tokenized,everGlobal,everGlobalCorrected,aged,bucketStats,launchCdf,
    fallbackF,categories,correctEver,oddsFor};
}
/* Full fit + leave-one-out: predict each token record from the rest. */
function launchModel(protocols,day){
  const core=fitCore(protocols,day);
  const{aged,categories,bucketStats,correctEver,everGlobal,tokenized,total}=core;
  const s=newScore();
  const majority=tokenized>=total - tokenized;
  const pBase=total ? tokenized / total:0;
  for(const x of aged){
    const c=categories[x.p.category || 'Uncategorized'];
    const everLOO=correctEver(c.withToken -(x.token ? 1:0),c.total - 1,
      c.ageSum - x.age,c.ageN - 1);
    const b=bucketStats[bucketIndex(x.age)];
    const rateLOO=b.n>1 ?(b.withToken -(x.token ? 1:0))/(b.n - 1):everGlobal;
    const F=clip(rateLOO / Math.max(everGlobal,1e-9),0,1);
    addScore(s,clip(everLOO*F,0,1),pBase,majority,x.token);
  }
  return Object.assign(core,{validation:finScore(s)});
}
/* Walk-forward: refit on earlier listings, price later cohorts; vs train base. */
function walkForward(protocols,day,minTrain=40){
  const aged=protocols.map(p=>({p,age:ageOf(p,day),token:hasToken(p)}))
    .filter(x=>x.age!==null && x.p.listed_at);
  aged.sort((a,b)=>a.p.listed_at<b.p.listed_at ? -1:a.p.listed_at>b.p.listed_at ? 1:(a.p.slug<b.p.slug ? -1:1));
  const s=newScore();
  let dates=0,i=0;
  while(i<aged.length){
    const date=aged[i].p.listed_at;
    let j=i;
    while(j<aged.length && aged[j].p.listed_at===date)j++;
    const train=aged.slice(0,i);
    const trainTok=train.filter(x=>x.token).length;
    if(train.length>=minTrain && trainTok>=5 && train.length - trainTok>=5){
      const core=fitCore(train.map(x=>x.p),day);
      const pBase=trainTok / train.length;
      const majority=trainTok>=train.length - trainTok;
      for(const x of aged.slice(i,j))addScore(s,core.oddsFor(x.p).byNow,pBase,majority,x.token);
      dates++;
    }
    i=j;
  }
  return Object.assign(finScore(s),{dates,minTrain});
}
/* Drop net of fees, pro-rata to TVL; verdict vs 4% T-bill 12-week hurdle; effort = plan hours. */
function farmEconomics(row,{deposit,dropShare=.07,weeks=12,tbill=.04}={}){
  const raw=row.value_if_launches ?? row.implied_value_usd;
  const odds=row.launch_odds ?? 1;
  const expectedValue=raw*odds;
  const D=deposit ?? row.capital ?? 0;
  const share=D>0 ? D /(row.tvl_usd + D):0;
  const drop=expectedValue*dropShare*share;
  const fees=row.feeCap || 0;
  const net=drop - fees;
  const hours=row.plan_hours || 0;
  const perHour=hours>0 ? net / hours:0;
  const hurdle=D*tbill*weeks / 52;
  const verdict=D<=0||row.exclusion||!(row.capital>0) ? 'Research':net<=0 ? 'Skip':net>=hurdle ? 'Farm':'Marginal';
  const breakEvenOdds=raw*dropShare*share>0 ? clip(fees /(raw*dropShare*share),0,1):1;
  const dropPer1000=expectedValue*dropShare*(1000 /(row.tvl_usd + 1000));
  return{deposit:D,dropShare,drop,fees,net,hours,perHour,hurdle,verdict,breakEvenOdds,dropPer1000};
}
/* Hold out each traded cap; count hits inside the printed P20-P80 band (60% nominal). */
const coverageAudit=peers=>root.RadarCalibration.audit(peers).coverage;
/* Rank if value were upside (best) or downside (worst). */
function rankRanges(rows){
  const place=(v,r)=>1+rows.filter(p=>p!==r&&(p.implied_value_usd>v||p.implied_value_usd===v&&p.slug<r.slug)).length;
  return rows.map(r=>({best:place(r.high,r),worst:place(r.low,r)}));
}
root.RadarOdds={launchModel,fitCore,walkForward,farmEconomics,coverageAudit,rankRanges,ageOf};
})(globalThis);
