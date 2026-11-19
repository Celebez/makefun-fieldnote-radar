/* Launch odds, farm economics and honest validation from the sealed snapshot;
   build program and offline dashboard execute this same code. */
(function (root) {
'use strict';
const {clip, hasToken, makePeers, calibration} = root.RadarCalibration;
const DAY = 86400000;
const ageOf = (p, day) => {
  const seen = Date.parse((p.listed_at || '') + 'T00:00:00Z');
  return Number.isFinite(seen) ? Math.max(0, Math.floor((day - seen) / DAY)) : null;
};
// Age buckets (days tracked): how many launches already happened.
const BUCKETS = [[0, 180], [180, 365], [365, 730], [730, 1460], [1460, Infinity]];
const bucketIndex = age => BUCKETS.findIndex(([lo, hi]) => age >= lo && age < hi);
const shrink = (value, weight, prior, k) => (value * weight + prior * k) / (weight + k);

/* Category ever-rate = observed token share corrected for the launches its typical
   tracked age should already have produced. F(a) = P(token by age a) / universe ever-rate,
   monotone. Odds a tokenless protocol still launches = ever·(1−F) / (1 − ever·F). */
function launchModel(protocols, day) {
  const total = protocols.length;
  const tokenized = protocols.filter(hasToken).length;
  const everGlobal = tokenized / total;
  const aged = protocols.map(p => ({p, age: ageOf(p, day), token: hasToken(p)})).filter(x => x.age !== null);
  const bucketStats = BUCKETS.map(([lo, hi]) => {
    const inBucket = aged.filter(x => x.age >= lo && x.age < hi);
    const withToken = inBucket.filter(x => x.token).length;
    return {lo, hi, n: inBucket.length, withToken, tokenRate: inBucket.length ? withToken / inBucket.length : everGlobal};
  });
  let running = 0;
  const launchCdf = bucketStats.map(b => { running = Math.max(running, clip(b.tokenRate / everGlobal, 0, 1)); return running; });
  const meanAge = aged.length ? aged.reduce((s, x) => s + x.age, 0) / aged.length : 365;
  const fallbackF = launchCdf[bucketIndex(Math.round(meanAge))];
  const everGlobalCorrected = clip(everGlobal / Math.max(fallbackF, .1), .02, .95);
  const categories = {};
  for (const p of protocols) {
    const c = p.category || 'Uncategorized';
    categories[c] = categories[c] || {name: c, total: 0, withToken: 0, ageSum: 0, ageN: 0};
    categories[c].total++;
    if (hasToken(p)) categories[c].withToken++;
    const age = ageOf(p, day);
    if (age !== null) { categories[c].ageSum += age; categories[c].ageN++; }
  }
  function correctEver(withToken, count, ageSum, ageN) {
    const raw = count ? withToken / count : everGlobal;
    const F = ageN ? launchCdf[bucketIndex(Math.round(ageSum / ageN))] : fallbackF;
    const corrected = clip(raw / Math.max(F, .1), .02, .95);
    return shrink(corrected, count, everGlobalCorrected, 8);
  }
  for (const c of Object.values(categories)) {
    c.rawRate = c.total ? c.withToken / c.total : 0;
    c.ever = correctEver(c.withToken, c.total, c.ageSum, c.ageN);
  }
  function oddsFor(protocol) {
    const c = categories[protocol.category || 'Uncategorized'];
    const ever = c ? c.ever : everGlobalCorrected;
    const age = ageOf(protocol, day);
    const F = age === null ? fallbackF : launchCdf[bucketIndex(age)];
    const denom = 1 - ever * F;
    const odds = denom > 0 ? ever * (1 - F) / denom : ever;
    return {odds: clip(odds, .02, .95), ever, F, age, byNow: clip(ever * F, 0, 1)};
  }
  // Leave-one-out: predict each token record from the rest.
  let correct = 0, baseCorrect = 0, n = 0;
  const majority = tokenized >= total - tokenized;
  for (const x of aged) {
    const c = categories[x.p.category || 'Uncategorized'];
    const everLOO = correctEver(c.withToken - (x.token ? 1 : 0), c.total - 1,
      c.ageSum - x.age, c.ageN - 1);
    const b = bucketStats[bucketIndex(x.age)];
    const rateLOO = b.n > 1 ? (b.withToken - (x.token ? 1 : 0)) / (b.n - 1) : everGlobal;
    const F = clip(rateLOO / everGlobal, 0, 1);
    const predict = everLOO * F >= .5;
    if (predict === x.token) correct++;
    if (majority === x.token) baseCorrect++;
    n++;
  }
  return {everGlobal, everGlobalCorrected, tokenized, total, bucketStats, launchCdf, oddsFor,
    validation: {n, correct, accuracy: n ? correct / n : 0, baseRate: n ? baseCorrect / n : 0}};
}

/* Expected drop net of fees at a chosen deposit/share, pro-rata to TVL; verdict beats
   a 4% T-bill hurdle over the plan's 12-week block; effort = the plan's own hours. */
function farmEconomics(row, {deposit, dropShare = .07, weeks = 12, tbill = .04} = {}) {
  const raw = row.value_if_launches ?? row.implied_value_usd;
  const odds = row.launch_odds ?? 1;
  const expectedValue = raw * odds;
  const D = deposit ?? row.capital ?? 0;
  const share = D > 0 ? D / (row.tvl_usd + D) : 0;
  const drop = expectedValue * dropShare * share;
  const fees = row.feeCap || 0;
  const net = drop - fees;
  const hours = row.plan_hours || 0;
  const perHour = hours > 0 ? net / hours : 0;
  const hurdle = D * tbill * weeks / 52;
  const verdict = D <= 0 ? 'Research' : net <= 0 ? 'Skip' : net >= hurdle ? 'Farm' : 'Marginal';
  const breakEvenOdds = raw * dropShare * share > 0 ? clip(fees / (raw * dropShare * share), 0, 1) : 1;
  const dropPer1000 = expectedValue * dropShare * (1000 / (row.tvl_usd + 1000));
  return {deposit: D, dropShare, drop, fees, net, hours, perHour, hurdle, verdict, breakEvenOdds, dropPer1000};
}

/* Honest coverage: withhold each traded cap, price it from the rest, count how often
   the real cap lands inside the printed downside–upside band (nominal P20–P80 = 60%). */
function coverageAudit(peers) {
  let inside = 0, withinTwo = 0, n = 0;
  for (const p of peers) {
    const training = peers.filter(q => q.slug !== p.slug && !q.tokenKeys.some(key => p.tokenKeys.includes(key)));
    if (!training.length) continue;
    const range = calibration(training, {category: p.category, tvl_usd: p.tvl}).range;
    const low = p.tvl * range[0], high = p.tvl * range[2];
    if (p.cap >= low && p.cap <= high) inside++;
    if (Math.abs(Math.log((p.tvl * range[1]) / p.cap)) <= Math.log(2)) withinTwo++;
    n++;
  }
  return {n, inside, coverage: n ? inside / n : 0, nominal: .60, withinTwo, withinTwoRate: n ? withinTwo / n : 0};
}

/* Rank uncertainty: where a row would sit if its value were its upside (best) or downside (worst). */
function rankRanges(rows) {
  const base = rows.map(r => r.implied_value_usd).sort((a, b) => b - a);
  const above = value => base.filter(v => v > value).length;
  return rows.map(r => ({best: above(r.high) + 1, worst: above(r.low) + 1}));
}
root.RadarOdds = {launchModel, farmEconomics, coverageAudit, rankRanges, ageOf};
})(globalThis);
