/* Rendering only. Scenarios and economics reuse the board's own model functions. */
(function (root) {
'use strict';
const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const money = root.RadarModel.money;
function compact(value) {
if (!Number.isFinite(value)) return 'Not reported';
if (value >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
if (value >= 1e6) return '$' + (value / 1e6).toFixed(1) + 'M';
if (value >= 1e3) return '$' + (value / 1e3).toFixed(1) + 'K';
return money(value);
}
const growth = value => !Number.isFinite(value) ? '—' : (value > 0 ? '+' : '') + value.toFixed(1) + '%';
const fact = (label, value) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`;
const ratio = value => value.toFixed(3) + '×';
const band = row => `${compact(row.low)} – ${compact(row.high)}`;
const verdictClass = {Farm:'positive',Marginal:'neutral',Skip:'negative',Research:'neutral'};
const usd = x => (x < 0 ? '−$' : '$') + Math.abs(x).toFixed(2);
function estimate(row) {
return `<div class="estimate"><div class="estimate-label">Implied market cap · odds-adjusted</div><strong title="${money(row.implied_value_usd)}">${compact(row.implied_value_usd)}</strong><div class="waterfall"><span>If launches <b>${compact(row.value_if_launches)}</b></span><span>× launch odds <b>${(row.launch_odds*100).toFixed(0)}%</b></span></div><div class="range"><span>Peer range</span><b>${band(row)}</b></div>${row.flags.includes('Few similar-size peers') ? '<p class="valuation-flag">Few peers near this TVL</p>' : ''}</div>`;
}
function econResult(row, opts) {
const e = root.RadarOdds.farmEconomics(row, opts);
return `<div class="econ-head"><span class="tag ${verdictClass[e.verdict]}">${e.verdict}</span><b>${usd(e.net)}</b> net · ${e.hours.toFixed(1)} h · ${usd(e.perHour)}/h</div><dl class="facts">${fact('Expected drop', usd(e.drop))}${fact('Fee budget', usd(e.fees))}${fact('T-bill hurdle 4% · 12 wk', usd(e.hurdle))}${fact('Break-even launch odds', (e.breakEvenOdds*100).toFixed(1)+'%')}</dl><p class="note">Drop = if-launches × odds × ${(e.dropShare*100).toFixed(1)}% share × deposit/(TVL+deposit). Per $1k pro-rata: ${usd(e.dropPer1000)}. Expectation, not a promise.</p>`;
}
function economics(row) {
const dep = row.capital || 1000;
const deposits = [[1000,'$1,000'],[10000,'$10,000'],...(row.capital ? [[row.capital,'Plan $' + row.capital]] : [])];
return `<div class="econ-panel"><h3>Farm economics</h3><div class="econ-controls"><label>Deposit<select id="depAmt">${deposits.map(([v,l]) => `<option value="${v}"${v === dep ? ' selected' : ''}>${l}</option>`).join('')}</select></label><label>Drop share<select id="dropShare"><option value="0.035">3.5%</option><option value="0.07" selected>7%</option><option value="0.14">14%</option></select></label></div><div id="econResult" aria-live="polite">${econResult(row,{deposit:dep,dropShare:.07})}</div></div>`;
}
function routeCard(row) {
const budget = row.capital ? `${money(row.capital)} principal · ${money(row.feeCap)} fee budget` : 'No principal until access and an exit are verified.';
return `<div class="route-card"><h3>${escape(row.route)}</h3><p>${budget}</p><button type="button" data-panel="plan">Open four-step plan →</button></div>`;
}
function overview(row) {
const notes = [row.exclusion && `Watchlist exception: ${row.exclusion}. Kept for coverage.`, ...row.flags.filter(f => f !== 'Few similar-size peers')].filter(Boolean);
return `<dl class="facts">${fact('TVL', compact(row.tvl_usd))}${fact('7-day TVL', growth(row.change_7d))}${fact('Tracked age', row.age_days === null ? 'Unreported' : `${row.age_days} days`)}${fact('Peers within 4× TVL', `${row.calibration.nearComparable} / ${row.calibration.near.length}`)}${fact('Launch odds', (row.launch_odds*100).toFixed(1)+'%')}${fact('Category ever-rate', (row.ever*100).toFixed(0)+'%')}</dl>${notes.length ? `<ul class="flags">${notes.map(x => `<li>${escape(x)}</li>`).join('')}</ul>` : ''}${routeCard(row)}${economics(row)}`;
}
function formula(row, values) {
return `<div class="formula" aria-label="Valuation calculation">${money(values.tvl)} × ${ratio(values.multiplier)} × ${row.growthFactor.toFixed(3)} × ${row.ageFactor.toFixed(3)}</div>`;
}
function scenarios(row) {
const peers = row.calibration;
const lists = [['Nearest by TVL',peers.near],['Same category',peers.category]];
return `<div class="scenario-controls"><label for="peerCase">Peer case<select id="peerCase"><option value="downside">Lower ratios</option><option value="base" selected>Median ratios</option><option value="upside">Higher ratios</option></select></label><label for="tvlShift">TVL change <output id="shiftLabel" for="tvlShift">0%</output><input id="tvlShift" type="range" min="-50" max="50" step="5" value="0"></label><button id="resetScenario" type="button">Reset</button></div><div id="scenarioResult" class="scenario-result" aria-live="polite"></div><p class="note">Growth, tracking age and peer set held fixed; ranking stays at the base case.</p><h3>Peer evidence</h3><dl class="facts">${fact('Size-peer median', ratio(peers.nearQuantiles[1]))}${fact('Category median', peers.category.length ? ratio(peers.categoryQuantiles[1]) : 'No observations')}${fact('Category weight', (peers.categoryWeight*100).toFixed(1)+'%')}${fact('Base multiple', ratio(row.peerValues.base))}</dl>${lists.map(([title,list]) => `<details class="peer-list"><summary>${title} · ${list.length}</summary>${list.length ? `<ul>${list.map(peer => `<li><span>${escape(peer.name)}<small>${compact(peer.cap)} cap · ${compact(peer.tvl)} TVL</small></span><b title="Raw ${ratio(peer.ratio)}">${ratio(peer.used)}</b></li>`).join('')}</ul>` : '<p class="note">The size set supplies the distribution.</p>'}</details>`).join('')}`;
}
function scenarioResult(row, input) {
const values = root.RadarModel.project(row, input);
const adjusted = Math.max(1, Math.round(values.value * row.launch_odds));
const delta = (adjusted / row.implied_value_usd - 1) * 100;
const pct = Math.abs(delta) < .05 ? '0.0%' : growth(delta);
return `<div><strong>${money(adjusted)}</strong><span>${pct} vs. board</span></div>${formula(row, values)}<p class="note">If-launches ${money(values.value)} × odds ${(row.launch_odds*100).toFixed(1)}% = adjusted cap.</p>`;
}
function plan(row) {
return `<div class="plan-head"><div><p class="eyebrow">${escape(row.routeChain)}</p><h3>${escape(row.route)}</h3></div><span class="tag ${row.capital ? 'positive' : 'neutral'}">${escape(row.action_mode)}</span></div><ol class="steps">${row.plan.map(s => `<li><div><b>${escape(s.title)}</b><p>${escape(s.text)}</p><p class="step-meta">${escape(s.cost)} · ${escape(s.time)}</p></div></li>`).join('')}</ol><p class="note">${row.capital ? 'Fee figures are spending limits. Check the live quote including approval and exit.' : 'Start with product documentation; verify account and jurisdiction qualify.'} Access and rewards are unverified.</p>${row.routeSource ? `<p class="source-note">Product docs <span>${escape(row.routeSource)}</span></p>` : '<p class="source-note">Route from snapshot category; confirm in official docs.</p>'}`;
}
function render(row, panel, pinned, atLimit) {
if (!row) return '<div class="detail-empty"><h2>No protocol selected</h2><p>Clear a filter or select a row.</p></div>';
const intro = `<div class="detail-header"><div class="detail-top"><p class="eyebrow">${row.plan ? `Cap rank ${row.rank} (${row.rank_best}–${row.rank_worst}) · ${row.watchlist ? 'Watchlist' : 'Additional candidate'}` : root.RadarModel.hasToken(row) ? 'Token recorded' : 'Screened out'}</p>${row.plan ? `<button id="detailPin" type="button" aria-pressed="${pinned}" ${!pinned && atLimit ? 'disabled' : ''}>${pinned ? 'Pinned ✓' : '+ Pin'}</button>` : ''}</div><h2 id="protocolTitle">${escape(row.name)}</h2><p title="${escape(row.chains.join(', '))}">${escape(row.category || 'Uncategorized')} · ${escape(row.chains.slice(0,3).join(', ') || 'Chain unreported')}${row.chains.length > 3 ? ` +${row.chains.length - 3}` : ''}</p></div>`;
if (!row.plan) return intro + `<div class="detail-body"><dl class="facts">${fact('TVL', compact(row.tvl_usd))}${fact('7-day TVL', growth(row.change_7d))}${row.exclusion ? fact('Filter rule', row.exclusion) : fact('Reported market cap', compact(row.mcap_usd))}</dl><p class="note">${row.exclusion ? 'Screening keeps this record outside the candidate ranking.' : 'Token indicators already in the snapshot; eligible records inform peer ratios.'}</p></div>`;
const tabs = [['overview','Overview'],['model','Scenario'],['plan','Field plan']];
return intro + estimate(row) + `<nav class="detail-tabs" aria-label="Candidate detail">${tabs.map(([key,label]) => `<button type="button" data-panel="${key}" aria-pressed="${panel === key}">${label}</button>`).join('')}</nav><div class="detail-body">${panel === 'model' ? scenarios(row) : panel === 'plan' ? plan(row) : overview(row)}</div>`;
}
function launchAudit(launch) {
const v = launch.validation;
const buckets = launch.bucketStats.map(b => `<tr><th scope="row">${b.lo}–${b.hi === Infinity ? '∞' : b.hi} d</th><td>${b.withToken}/${b.n}</td><td>${(b.tokenRate*100).toFixed(1)}%</td></tr>`).join('');
return `<h3>Launch model · leave-one-out, ${v.n} aged records</h3><p>Token prediction from the rest of the snapshot: <b>${(v.accuracy*100).toFixed(1)}%</b> correct vs ${(v.baseRate*100).toFixed(1)}% majority base. Ever-rate ${(launch.everGlobal*100).toFixed(1)}% raw → ${(launch.everGlobalCorrected*100).toFixed(1)}% age-corrected.</p><div class="compare-table"><table><thead><tr><th>Tracked age</th><th>Tokenized</th><th>Rate</th></tr></thead><tbody>${buckets}</tbody></table></div>`;
}
function coverageAudit(cov) {
return `<h3>Range coverage · ${cov.n} held-out traded caps</h3><p>P20–P80 band holds the real cap <b>${(cov.coverage*100).toFixed(1)}%</b> vs 60% nominal — honestly under-covered. Within 2× of median: ${(cov.withinTwoRate*100).toFixed(1)}%.</p>`;
}
function compare(rows) {
const cells = [
['Base cap', r => `<strong>${compact(r.implied_value_usd)}</strong>`], ['Peer cases', r => band(r)],
['Launch odds', r => (r.launch_odds*100).toFixed(1)+'%'],
['Farm verdict', r => r.econ.verdict + (r.econ.deposit > 0 ? ' · ' + usd(r.econ.perHour) + '/h' : '')],
['7-day TVL', r => growth(r.change_7d)], ['Tracking age', r => r.age_days === null ? 'Unreported' : `${r.age_days} days`],
['Peer support', r => `${r.calibration.nearComparable} within 4× TVL`],
['Access route', r => escape(r.route)], ['Trial principal', r => `${money(r.capital)}${r.feeCap ? ` · ${money(r.feeCap)} fees max` : ''}`],
['Next action', r => escape(r.plan[1].title)], ['Exit check', r => escape(r.plan[3].text)]];
return `<p class="note">Base valuations, launch odds, economics and exit plans side by side.</p><div class="compare-table"><table><thead><tr><th scope="col">Measure</th>${rows.map(r => `<th scope="col"><small>Rank ${r.rank}</small>${escape(r.name)}</th>`).join('')}</tr></thead><tbody>${cells.map(([label,value]) => `<tr><th scope="row">${label}</th>${rows.map(r => `<td>${value(r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function validation(audit) {
const names = {size:'TVL-near + category', prior:'Previous category model', fixed:'Fixed 0.25×'};
if (!audit.count) return '<p>No usable held-out observations.</p>';
const items = Object.entries(names).map(([id,title]) => {
const {medianFactor, meanLog, withinTwo} = audit.metrics[id];
return `<tr><th scope="row">${title}</th><td>${medianFactor.toFixed(2)}×</td><td>${meanLog.toFixed(3)}</td><td>${withinTwo}/${audit.count}</td></tr>`;
});
return `<h3>Held-out calibration · ${audit.count} traded protocols</h3><p>Withhold the target and same-token records; predict its cap from TVL and category only. Lower error and more within-2× are better.</p><div class="compare-table"><table><thead><tr><th>Model</th><th>Median error factor</th><th>Mean abs. log error</th><th>Within 2×</th></tr></thead><tbody>${items.join('')}</tbody></table></div><p class="note">Same snapshot and exclusions for every baseline; tests the multiple on traded tokens, not launch prices.</p>`;
}
root.RadarView = {escape, compact, growth, band, usd, render, scenarioResult, compare, validation, launchAudit, coverageAudit, econResult};
})(globalThis);