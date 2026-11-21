/* Estimate a capitalization multiple from traded protocols in the sealed snapshot. */
(function (root) {
'use strict';
const clip = (value, low, high) => Math.min(high, Math.max(low, value));
const compareKey = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const hasToken = p => Boolean(p.symbol || p.gecko_id || p.mcap_usd > 0);
function productReason(p) {
  const category = p.category || '';
  if (/^(Bridge|Canonical Bridge|Cross Chain Bridge|Bridge Aggregator)$/.test(category)) return 'Bridge infrastructure';
  if (/^(Liquid Staking|Liquid Restaking|Restaked BTC|Stablecoin Wrapper)$/.test(category)) return 'Staking or wrapper product';
  if (category === 'CEX') return 'Centralized exchange';
  if (/\b(wrapped|staked|staking)\b/i.test(p.name)) return 'Wrapper or staking name';
  return '';
}
function percentile(numbers, p) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index), upper = Math.ceil(index);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}
function makePeers(protocols, day) {
  return protocols.filter(p => p.tvl_usd > 0 && p.mcap_usd > 0 && !productReason(p)).map(p => {
    const ratio = p.mcap_usd / p.tvl_usd;
    return {slug:p.slug, name:p.name, category:p.category, tvl:p.tvl_usd, cap:p.mcap_usd,
      ratio, used:ratio, listed_at:p.listed_at, growth:Number.isFinite(p.change_7d)?clip(p.change_7d,-50,100):0,
      age:p.listed_at&&Number.isFinite(day)?Math.max(0,(day-Date.parse(p.listed_at+'T00:00:00Z'))/86400000):365,
      tokenKeys:[p.gecko_id && 'id:' + p.gecko_id.toLowerCase(),
        p.symbol && 'symbol:' + p.symbol.toLowerCase()].filter(Boolean)};
  });
}
// Ridge ln(cap/TVL) on ln(TVL/$100M), penalty 2; no name-specific constants.
function fitValue(peers) {
  const n = peers.length;
  if (!n) return {beta:[Math.log(.25),0], band:[-Math.log(4),Math.log(4)], predict:()=>.25};
  const xs=peers.map(p=>Math.log(p.tvl/1e8)), ys=peers.map(p=>Math.log(p.ratio));
  const mx=xs.reduce((s,x)=>s+x,0)/n, my=ys.reduce((s,y)=>s+y,0)/n;
  const slope=xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0)/(2+xs.reduce((s,x)=>s+(x-mx)**2,0));
  const beta=[my-slope*mx,slope];
  const predict=p=>Math.exp(beta[0]+beta[1]*Math.log((p.tvl??p.tvl_usd)/1e8));
  const residuals=peers.map(p=>Math.log(p.ratio/predict(p)));
  return {beta,predict,band:[Math.min(0,percentile(residuals,.2)),Math.max(0,percentile(residuals,.8))]};
}
function calibration(peers, target) {
  const bySize=[...peers].sort((a,b)=>Math.abs(Math.log(a.tvl/target.tvl_usd))-Math.abs(Math.log(b.tvl/target.tvl_usd))||compareKey(a.slug,b.slug));
  const near=bySize.slice(0,23), category=bySize.filter(p=>p.category===target.category).slice(0,23);
  const quantiles=list=>list.length?[.2,.5,.8].map(q=>Math.exp(percentile(list.map(p=>Math.log(p.ratio)),q))):[.1,.25,1];
  const fit=fitValue(peers), base=fit.predict(target);
  const range=[base*Math.exp(fit.band[0]),base,base*Math.exp(fit.band[1])];
  return {near,category,nearQuantiles:quantiles(near),categoryQuantiles:quantiles(category),range,beta:fit.beta,
    nearComparable:near.filter(p=>p.tvl>=target.tvl_usd/4&&p.tvl<=target.tvl_usd*4).length};
}
const trainingFor=(peers,p,cohort=false)=>peers.filter(q=>q.slug!==p.slug&&!q.tokenKeys.some(k=>p.tokenKeys.includes(k))&&(!cohort||(p.listed_at&&q.listed_at&&q.listed_at<p.listed_at)));
function legacy(train,p) {
  const sorted=[...train].sort((a,b)=>Math.abs(Math.log(a.tvl/p.tvl))-Math.abs(Math.log(b.tvl/p.tvl))||compareKey(a.slug,b.slug));
  const near=sorted.slice(0,23),cat=sorted.filter(q=>q.category===p.category).slice(0,23),w=cat.length/(cat.length+8);
  const med=list=>percentile(list.map(q=>Math.log(clip(q.ratio,.05,5))),.5);
  return Math.exp(med(near)*(1-w)+(cat.length?med(cat):med(near))*w)*Math.pow(1+p.growth/100,.3)*(.7+.3*Math.min(p.age,1095)/1095);
}
function audit(peers) {
  const ids=['fixed','legacy','size','category','growth','age','control'];
  const errors=()=>Object.fromEntries(ids.map(id=>[id,[]]));
  const loo=errors(),cohort=errors();
  let inside=0,n=0;
  for(const p of peers)for(const temporal of [false,true]){
    const train=trainingFor(peers,p,temporal);
    if(!train.length||(temporal&&train.length<20))continue;
    const fit=fitValue(train),base=fit.predict(p);
    const cat=train.filter(q=>q.category===p.category).map(q=>Math.log(q.ratio/fit.predict(q)));
    const predictions={fixed:.25,legacy:legacy(train,p),size:base,
      category:base*Math.exp(cat.length?percentile(cat,.5)*cat.length/(cat.length+8):0),
      growth:base*Math.pow(1+p.growth/100,.3),age:base*(.7+.3*Math.min(p.age,1095)/1095),
      control:base*Math.exp(.3*Math.sin(p.tvl))};
    for(const id of ids)(temporal?cohort:loo)[id].push(Math.abs(Math.log(predictions[id]/p.ratio)));
    if(!temporal){n++;if(p.ratio>=base*Math.exp(fit.band[0])&&p.ratio<=base*Math.exp(fit.band[1]))inside++;}
  }
  const metrics=groups=>Object.fromEntries(Object.entries(groups).map(([id,es])=>[id,{n:es.length,
    medianFactor:es.length?Math.exp(percentile(es,.5)):null,meanLog:es.length?es.reduce((s,e)=>s+e,0)/es.length:null,
    withinTwo:es.filter(e=>e<=Math.log(2)).length}]));
  const m=metrics(loo),w=metrics(cohort);
  return {count:n,metrics:m,cohort:w,beta:fitValue(peers).beta,
    coverage:{n,inside,coverage:n?inside/n:0,nominal:.6,withinTwo:m.size.withinTwo,withinTwoRate:n?m.size.withinTwo/n:0}};
}
root.RadarCalibration = {clip, compareKey, hasToken, productReason, makePeers, calibration, audit, percentile, fitValue, trainingFor};
})(globalThis);
