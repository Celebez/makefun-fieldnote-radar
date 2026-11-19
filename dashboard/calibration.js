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
function makePeers(protocols) {
  return protocols.filter(p => p.tvl_usd > 0 && p.mcap_usd > 0 && !productReason(p)).map(p => {
    const ratio = p.mcap_usd / p.tvl_usd;
    return {slug:p.slug, name:p.name, category:p.category, tvl:p.tvl_usd, cap:p.mcap_usd,
      ratio, used:clip(ratio, .05, 5), tokenKeys:[p.gecko_id && 'id:' + p.gecko_id.toLowerCase(),
        p.symbol && 'symbol:' + p.symbol.toLowerCase()].filter(Boolean)};
  });
}
function calibration(peers, target) {
  const bySize = [...peers].sort((a, b) =>
    Math.abs(Math.log(a.tvl / target.tvl_usd)) - Math.abs(Math.log(b.tvl / target.tvl_usd)) || compareKey(a.slug, b.slug));
  const near = bySize.slice(0, 23);
  const category = bySize.filter(p => p.category === target.category).slice(0, 23);
  const categoryWeight = category.length / (category.length + 8);
  const nearLogs = near.map(p => Math.log(p.used));
  const categoryLogs = category.map(p => Math.log(p.used));
  const fallback = [.1, .25, 1];
  const nearQuantiles = near.length ? [.2, .5, .8].map(p => Math.exp(percentile(nearLogs, p))) : fallback;
  const categoryQuantiles = category.length ? [.2, .5, .8].map(p => Math.exp(percentile(categoryLogs, p))) : nearQuantiles;
  const blend = (a, b) => Math.exp((1 - categoryWeight) * Math.log(a) + categoryWeight * Math.log(b));
  const range = nearQuantiles.map((x, i) => blend(x, categoryQuantiles[i]));
  const nearComparable = near.filter(x => x.tvl >= target.tvl_usd / 4 && x.tvl <= target.tvl_usd * 4).length;
  return {near, category, categoryWeight, nearComparable, nearQuantiles, categoryQuantiles, range};
}
function audit(peers) {
  // Withhold each observed market cap and any records identifying the same token.
  // This tests calibration on traded records, not launch prices for unissued tokens.
  const absoluteLogError = {fixed:[], prior:[], size:[]};
  let count = 0;
  for (const p of peers) {
    const training = peers.filter(q => q.slug !== p.slug && !q.tokenKeys.some(key => p.tokenKeys.includes(key)));
    if (!training.length) continue;
    const near = calibration(training, {category:p.category, tvl_usd:p.tvl});
    const matched = training.filter(q => p.category === q.category);
    const overall = percentile(training.map(q => q.used), .5);
    const group = matched.length ? percentile(matched.map(q => q.used), .5) : overall;
    const weight = matched.length / (matched.length + 8);
    const predictions = {fixed:.25, prior:group * weight + overall * (1 - weight), size:near.range[1]};
    for (const [name, estimate] of Object.entries(predictions)) absoluteLogError[name].push(Math.abs(Math.log(estimate / p.ratio)));
    count++;
  }
  const metrics = {};
  for (const [name, errors] of Object.entries(absoluteLogError)) {
    metrics[name] = errors.length ? {
      medianFactor:Math.exp(percentile(errors, .5)),
      meanLog:errors.reduce((sum, x) => sum + x, 0) / errors.length,
      withinTwo:errors.filter(x => x <= Math.log(2)).length
    } : null;
  }
  return {count, metrics};
}
root.RadarCalibration = {clip, compareKey, hasToken, productReason, makePeers, calibration, audit};
})(globalThis);
