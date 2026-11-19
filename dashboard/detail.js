/* Rendering only. Scenario values use the same projection as the ranked board. */
(function (root) {
'use strict';
const escape = value => String(value ?? '').replace(/[&<>"']/g, ch =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
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
function estimate(row) {
  return `<div class="estimate"><div class="estimate-label">Implied market cap</div>
    <strong title="${money(row.implied_value_usd)}">${compact(row.implied_value_usd)}</strong>
    <div class="range"><span>Peer range</span><b>${band(row)}</b></div>
    ${row.flags.includes('Few similar-size peers') ? '<p class="valuation-flag">Few peers near this TVL</p>' : ''}</div>`;
}
function routeCard(row) {
  let budget = 'No principal until access and an exit are verified.';
  if (row.capital) budget = `${money(row.capital)} principal · ${money(row.feeCap)} fee budget`;
  return `<div class="route-card"><h3>${escape(row.route)}</h3><p>${budget}</p>
    <button type="button" data-panel="plan">Open four-step plan →</button></div>`;
}
function overview(row) {
  const notes = [row.exclusion && `Watchlist exception: ${row.exclusion}. This record is kept for coverage.`,
    ...row.flags.filter(flag => flag !== 'Few similar-size peers')].filter(Boolean);
  return `<dl class="facts">${fact('TVL', compact(row.tvl_usd))}${fact('7-day TVL', growth(row.change_7d))}
    ${fact('Tracked age', row.age_days === null ? 'Unreported' : `${row.age_days} days`)}
    ${fact('Peers within 4× TVL', `${row.calibration.nearComparable} / ${row.calibration.near.length}`)}</dl>
    ${notes.length ? `<ul class="flags">${notes.map(x => `<li>${escape(x)}</li>`).join('')}</ul>` : ''}
    ${routeCard(row)}`;
}
function formula(row, values) {
  return `<div class="formula" aria-label="Valuation calculation">${money(values.tvl)} × ${ratio(values.multiplier)} × ${row.growthFactor.toFixed(3)} × ${row.ageFactor.toFixed(3)}</div>`;
}
function scenarios(row) {
  const peers = row.calibration;
  const lists = [['Nearest by TVL',peers.near], ['Same category',peers.category]];
  return `<div class="scenario-controls">
    <label for="peerCase">Peer case<select id="peerCase"><option value="downside">Lower ratios</option><option value="base" selected>Median ratios</option><option value="upside">Higher ratios</option></select></label>
    <label for="tvlShift">TVL change <output id="shiftLabel" for="tvlShift">0%</output><input id="tvlShift" type="range" min="-50" max="50" step="5" value="0"></label>
    <button id="resetScenario" type="button">Reset</button>
  </div>
  <div id="scenarioResult" class="scenario-result" aria-live="polite"></div>
  <p class="note">Holds growth, tracking age and the peer set fixed. Ranking stays at the base case.</p>
  <h3>Peer evidence</h3>
  <dl class="facts">${fact('Size-peer median', ratio(peers.nearQuantiles[1]))}
    ${fact('Category median', peers.category.length ? ratio(peers.categoryQuantiles[1]) : 'No observations')}
    ${fact('Category weight', (peers.categoryWeight * 100).toFixed(1) + '%')}
    ${fact('Base multiple', ratio(row.peerValues.base))}</dl>
  ${lists.map(([title,list]) => `<details class="peer-list"><summary>${title} · ${list.length}</summary>
    ${list.length ? `<ul>${list.map(peer => `<li><span>${escape(peer.name)}<small>${compact(peer.cap)} cap · ${compact(peer.tvl)} TVL</small></span><b title="Raw ${ratio(peer.ratio)}">${ratio(peer.used)}</b></li>`).join('')}</ul>` : '<p class="note">The size set supplies the distribution.</p>'}</details>`).join('')}`;
}
function scenarioResult(row, input) {
  const values = root.RadarModel.project(row, input);
  const delta = (values.value / row.implied_value_usd - 1) * 100;
  const adjusted = Math.abs(delta) < .05 ? '0.0%' : growth(delta);
  return `<div><strong>${money(values.value)}</strong><span>${adjusted} vs. board</span></div>${formula(row, values)}`;
}
function plan(row) {
  return `<div class="plan-head"><div><p class="eyebrow">${escape(row.routeChain)}</p><h3>${escape(row.route)}</h3></div>
    <span class="tag ${row.capital ? 'positive' : 'neutral'}">${escape(row.action_mode)}</span></div>
    <ol class="steps">${row.plan.map(s => `<li><div><b>${escape(s.title)}</b><p>${escape(s.text)}</p><p class="step-meta">${escape(s.cost)} · ${escape(s.time)}</p></div></li>`).join('')}</ol>
    <p class="note">${row.capital ? 'Fee figures are spending limits. Check the live quote including approval and exit.' : 'Start with product documentation and verify whether the account and jurisdiction qualify.'} Access and rewards are unverified.</p>
    ${row.routeSource ? `<p class="source-note">Product docs <span>${escape(row.routeSource)}</span></p>` : '<p class="source-note">Route based on snapshot category; confirm in official docs.</p>'}`;
}
function render(row, panel, pinned, atLimit) {
  if (!row) return '<div class="detail-empty"><h2>No protocol selected</h2><p>Clear a filter or select a protocol from the board.</p></div>';
  const intro = `<div class="detail-header"><div class="detail-top"><p class="eyebrow">${row.plan ? `Cap rank ${row.rank} · ${row.watchlist ? 'Watchlist' : 'Additional candidate'}` : root.RadarModel.hasToken(row) ? 'Token recorded' : 'Screened out'}</p>
    ${row.plan ? `<button id="detailPin" type="button" aria-pressed="${pinned}" ${!pinned && atLimit ? 'disabled' : ''}>${pinned ? 'Pinned ✓' : '+ Pin'}</button>` : ''}</div>
    <h2 id="protocolTitle">${escape(row.name)}</h2><p title="${escape(row.chains.join(', '))}">${escape(row.category || 'Uncategorized')} · ${escape(row.chains.slice(0, 3).join(', ') || 'Chain unreported')}${row.chains.length > 3 ? ` +${row.chains.length - 3}` : ''}</p></div>`;
  if (!row.plan) return intro + `<div class="detail-body"><dl class="facts">
    ${fact('TVL', compact(row.tvl_usd))}${fact('7-day TVL', growth(row.change_7d))}
    ${row.exclusion ? fact('Filter rule', row.exclusion) : fact('Reported market cap', compact(row.mcap_usd))}</dl>
    <p class="note">${row.exclusion ? 'The screening rule keeps this record outside the candidate ranking.' : 'Token indicators already appear in the snapshot. Eligible records with positive TVL and market cap can inform peer ratios.'}</p></div>`;
  const tabs = [['overview','Overview'],['model','Scenario'],['plan','Field plan']];
  return intro + estimate(row) + `<nav class="detail-tabs" aria-label="Candidate detail">${tabs.map(([key, label]) => `<button type="button" data-panel="${key}" aria-pressed="${panel === key}">${label}</button>`).join('')}</nav>
    <div class="detail-body">${panel === 'model' ? scenarios(row) : panel === 'plan' ? plan(row) : overview(row)}</div>`;
}
function compare(rows) {
  const cells = [
    ['Base cap', r => `<strong>${compact(r.implied_value_usd)}</strong>`], ['Peer cases', r => band(r)],
    ['7-day TVL', r => growth(r.change_7d)], ['Tracking age', r => r.age_days === null ? 'Unreported' : `${r.age_days} days`],
    ['Peer support', r => `${r.calibration.nearComparable} within 4× TVL`],
    ['Access route', r => escape(r.route)], ['Trial principal', r => `${money(r.capital)}${r.feeCap ? ` · ${money(r.feeCap)} fees max` : ''}`],
    ['Next action', r => escape(r.plan[1].title)], ['Exit check', r => escape(r.plan[3].text)]
  ];
  return `<p class="note">Compare base-case valuations, cost limits and exit plans side by side.</p>
    <div class="compare-table"><table><thead><tr><th scope="col">Measure</th>${rows.map(r => `<th scope="col"><small>Rank ${r.rank}</small>${escape(r.name)}</th>`).join('')}</tr></thead>
    <tbody>${cells.map(([label, value]) => `<tr><th scope="row">${label}</th>${rows.map(r => `<td>${value(r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function validation(audit) {
  const names = {size:'TVL-near + category', prior:'Previous category model', fixed:'Fixed 0.25×'};
  if (!audit.count) return '<p>There are no usable held-out observations.</p>';
  const items = Object.entries(names).map(([id, title]) => {
    const {medianFactor, meanLog, withinTwo} = audit.metrics[id];
    return `<tr><th scope="row">${title}</th><td>${medianFactor.toFixed(2)}×</td><td>${meanLog.toFixed(3)}</td><td>${withinTwo}/${audit.count}</td></tr>`;
  });
  return `<h3>Held-out calibration · ${audit.count} traded protocols</h3>
    <p>Remove the target and records with its token identifiers. Predict its observed market cap from TVL and category only. Lower error and higher within-2× count are better.</p>
    <div class="compare-table"><table><thead><tr><th>Model</th><th>Median error factor</th><th>Mean abs. log error</th><th>Within 2×</th></tr></thead><tbody>${items.join('')}</tbody></table></div>
    <p class="note">Same snapshot and peer exclusions for every baseline. This checks the multiple on traded tokens. Launch pricing remains untested.</p>`;
}
root.RadarView = {escape, compact, growth, band, render, scenarioResult, compare, validation};
})(globalThis);
