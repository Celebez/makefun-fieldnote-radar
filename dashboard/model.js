/* The build program and the offline dashboard execute this same model. */
(function (root) {
'use strict';
const {clip, compareKey, hasToken, productReason, makePeers, calibration, audit} = root.RadarCalibration;
const money = amount => '$' + Math.round(amount).toLocaleString('en-US');
function positiveCap(value) {
  return Math.max(1, Math.round(value));
}
function project(row, {tvlShift = 0, peerCase = 'base'} = {}) {
  const multiplier = row.peerValues[peerCase] ?? row.peerValues.base;
  const tvl = row.tvl_usd * (1 + clip(Number.isFinite(tvlShift) ? tvlShift : 0, -50, 50) / 100);
  return {value:positiveCap(tvl * multiplier * row.growthFactor * row.ageFactor), multiplier, tvl};
}
function estimate(protocol, watch, peers, day) {
  const evidence = calibration(peers, protocol);
  const [downside, base, upside] = evidence.range;
  const peerValues = {downside, base, upside};
  const seen = Date.parse((protocol.listed_at || '') + 'T00:00:00Z');
  const age = Number.isFinite(seen) ? Math.max(0, Math.floor((day - seen) / 86400000)) : null;
  const growth = Number.isFinite(protocol.change_7d) ? clip(protocol.change_7d, -50, 100) : 0;
  const growthFactor = Math.pow(1 + growth / 100, .30);
  const ageFactor = .70 + .30 * Math.min(age ?? 365, 1095) / 1095;
  const exclusion = productReason(protocol) || root.RadarPlans.documentedProduct(protocol)?.reason ||
    (hasToken(protocol) ? 'Token indicator present' : '');
  const trial = root.RadarPlans.makePlan(protocol, exclusion);
  const sparse = evidence.nearComparable < 8;
  const flags = [sparse && 'Few similar-size peers', !evidence.category.length && 'No category peer',
    age === null && 'Tracking date missing', !Number.isFinite(protocol.change_7d) && 'Growth missing'].filter(Boolean);
  const row = {...protocol, rank:0, age_days:age, watchlist:watch.has(protocol.slug),
    token_status:hasToken(protocol) ? 'Token recorded' : 'No token recorded', exclusion,
    peerValues, growthFactor, ageFactor, flags, calibration:evidence,
    action_mode:trial.mode, capital:trial.capital, feeCap:trial.feeCap, route:trial.label,
    routeSource:trial.note, documentedRoute:trial.verifiedRoute, routeChain:trial.chain, plan:trial.steps,
    farm_steps:trial.steps.map(step => `${step.title}: ${step.text} Cost: ${step.cost}. Time: ${step.time}.`)};
  row.implied_value_usd = project(row).value;
  row.low = project(row, {peerCase:'downside'}).value;
  row.high = project(row, {peerCase:'upside'}).value;
  return row;
}
function build(snapshot) {
  const watch = new Set(snapshot.watchlist);
  const day = Date.parse(snapshot.as_of + 'T00:00:00Z');
  const peers = makePeers(snapshot.protocols);
  const rows = snapshot.protocols.filter(p => watch.has(p.slug) || (!hasToken(p) && !productReason(p)))
    .map(p => estimate(p, watch, peers, day))
    .sort((a, b) => b.implied_value_usd - a.implied_value_usd || compareKey(a.slug, b.slug));
  rows.forEach((row, i) => row.rank = i + 1);
  const covered = new Set(rows.map(row => row.slug));
  const live = snapshot.protocols.filter(p => hasToken(p) && !covered.has(p.slug))
    .map(p => ({...p, mcap_usd:p.mcap_usd > 0 ? p.mcap_usd : null}))
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || compareKey(a.slug, b.slug));
  const excluded = snapshot.protocols.filter(p => !hasToken(p) && !covered.has(p.slug))
    .map(p => ({...p, exclusion:productReason(p), mcap_usd:null}))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || compareKey(a.slug, b.slug));
  return {rows, live, excluded, as_of:snapshot.as_of, source:snapshot.source, floor:snapshot.floor_usd,
    watch_count:watch.size, watch_covered:rows.filter(r => r.watchlist).length, peer_count:peers.length,
    audit:audit(peers), universe:snapshot.protocols.length};
}
root.RadarModel = {build, project, money, hasToken, compareKey};
})(globalThis);
