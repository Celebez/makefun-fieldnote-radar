(() => {
'use strict';
RadarPlans.init(ROUTES);
const data = RadarModel.build(SNAPSHOT);
const views = {early:data.rows, live:data.live, excluded:data.excluded};
const candidates = new Map(data.rows.map(row => [row.slug,row]));
const {escape,compact,growth,band} = RadarView;
const $ = id => document.getElementById(id);
const pageSize = 10;
const tabs = [...document.querySelectorAll('[data-tab]')];
const orderButtons = [...document.querySelectorAll('[data-sort]')];
const pins = new Set();
const defaults = {early:'implied_value_usd', live:'mcap_usd', excluded:'tvl_usd'};
const sharedSorts = ['name','tvl_usd','change_7d'];
let visible = [];
let state;
function fillMenu(id, values, label, current) {
const menu = $(id);
const items = [...new Set(values)].sort(RadarModel.compareKey);
menu.replaceChildren(new Option(label,''), ...items.map(value => new Option(value,value)));
menu.value = items.includes(current) ? current : '';
}
function menus(category = '', chain = '') {
const list = views[state.tab];
fillMenu('category',list.map(r => r.category || 'Uncategorized'),'All categories',category);
fillMenu('chain',list.flatMap(r => r.chains),'All chains',chain);
$('scope').hidden = state.tab !== 'early';
}
function readHash() {
const query = new URLSearchParams(location.hash.slice(1));
const tab = Object.hasOwn(views,query.get('view')) ? query.get('view') : 'early';
const sort = query.get('sort');
const panel = query.get('panel');
state = {tab, sort:[...sharedSorts,defaults[tab]].includes(sort) ? sort : defaults[tab],
dir:query.get('dir') === 'asc' ? 1 : -1,
page:Math.max(0,Math.min(400,Number.parseInt(query.get('page'),10) || 0)),
selected:query.get('item'), panel:['overview','model','plan'].includes(panel) ? panel : 'overview'};
pins.clear();
for (const slug of query.getAll('pin')) if (pins.size < 3 && candidates.has(slug)) pins.add(slug);
menus(query.get('category'),query.get('chain'));
$('search').value = (query.get('q') || '').slice(0,120);
$('scope').value = tab === 'early' ? query.get('scope') || '' : '';
if ($('scope').selectedIndex < 0) $('scope').value = '';
}
function saveHash() {
const query = new URLSearchParams();
if (state.tab !== 'early') query.set('view',state.tab);
if (state.sort !== defaults[state.tab]) query.set('sort',state.sort);
if (state.dir === 1) query.set('dir','asc');
if (state.page) query.set('page',String(state.page));
if (state.selected) query.set('item',state.selected);
if (state.panel !== 'overview') query.set('panel',state.panel);
for (const [id,key] of [['search','q'],['category','category'],['chain','chain'],['scope','scope']]) {
if ($(id).value && !$(id).hidden) query.set(key,$(id).value);
}
pins.forEach(id => query.append('pin',id));
const url = new URL(location.href);
url.hash = query.toString();
if (url.href !== location.href) history.replaceState(null,'',url);
}
function matches(row, query, category, chain, scope) {
if (query && !`${row.name} ${row.slug} ${row.chains.join(' ')}`.toLowerCase().includes(query)) return false;
if (category && (row.category || 'Uncategorized') !== category) return false;
if (chain && !row.chains.includes(chain)) return false;
switch (scope) {
case 'watch': return row.watchlist;
case 'below': return row.tvl_usd < data.floor;
case 'trial': return row.capital > 0;
case 'sourced': return row.documentedRoute;
case 'exceptions': return Boolean(row.exclusion);
default: return true;
}
}
function sorted(a,b) {
const x = a[state.sort], y = b[state.sort];
if (x == null && y != null) return 1;
if (x != null && y == null) return -1;
const delta = state.sort === 'name' ? a.name.localeCompare(b.name,'en') : (x ?? 0) - (y ?? 0);
return state.dir * delta || RadarModel.compareKey(a.slug,b.slug);
}
function updateHeaders() {
const early = state.tab === 'early';
tabs.forEach(button => button.setAttribute('aria-pressed',String(button.dataset.tab === state.tab)));
$('valueColumn').hidden = state.tab === 'excluded';
$('econColumn').hidden = !early;
$('planColumn').hidden = state.tab === 'live';
$('planColumn').textContent = early ? 'Trial' : 'Screening reason';
$('pinColumn').hidden = !early;
$('valueSort').dataset.sort = early ? 'implied_value_usd' : 'mcap_usd';
$('valueSort').textContent = early ? 'Implied cap' : 'Market cap';
for (const button of orderButtons) {
const th = button.closest('th');
if (!th.hidden && button.dataset.sort === state.sort) th.setAttribute('aria-sort',state.dir < 0 ? 'descending' : 'ascending');
else th.removeAttribute('aria-sort');
}
}
function pinButton(row) {
const pinned = pins.has(row.slug);
return `<button type="button" class="pin-button" data-action="pin" aria-label="${pinned ? 'Unpin' : 'Pin'} ${escape(row.name)}" aria-pressed="${pinned}" ${!pinned && pins.size >= 3 ? 'disabled' : ''}>${pinned ? '✓' : 'Pin'}</button>`;
}
function rowCells(row) {
if (state.tab === 'live') return `<td class="number value" data-field="cap">${compact(row.mcap_usd)}</td>`;
if (state.tab === 'excluded') return `<td>${escape(row.exclusion)}</td>`;
const label = row.exclusion ? 'Flagged' : row.capital ? compact(row.capital) + ' max' : 'Research';
const econ = row.econ;
const econClass = {Farm:'positive',Marginal:'neutral',Skip:'negative',Research:'neutral'}[econ.verdict];
return `<td class="number value" data-field="cap">${compact(row.implied_value_usd)}<small>${band(row)}</small></td><td class="econ"><span class="tag ${econClass}">${econ.verdict}</span><small>${econ.deposit > 0 ? RadarView.usd(econ.perHour) + '/h' : 'no deposit'}</small></td><td><span class="tag ${row.capital ? 'positive' : 'neutral'}">${label}</span></td><td>${pinButton(row)}</td>`;
}
function rowHtml(row,index) {
const subtitle = [row.category,row.chains.slice(0,2).join(' / '),row.watchlist && 'Watchlist'].filter(Boolean).join(' · ');
const mark = row.change_7d > 0 ? 'growth-up' : row.change_7d < 0 ? 'growth-down' : '';
return `<tr data-slug="${escape(row.slug)}" ${row.slug === state.selected ? 'class="selected"' : ''}><td class="rank">${row.rank ?? state.page*pageSize + index + 1}${row.rank_best ? `<small>${row.rank_best}–${row.rank_worst}</small>` : ''}</td><td><button type="button" class="protocol" data-action="select" aria-controls="detail">${escape(row.name)}</button><small>${escape(subtitle)}</small></td><td class="number" data-field="tvl">${compact(row.tvl_usd)}</td><td class="number ${mark}">${growth(row.change_7d)}</td>${rowCells(row)}</tr>`;
}
function updatePins() {
$('pinCount').textContent = `${pins.size} / 3`;
$('compareBtn').disabled = pins.size < 2;
$('pins').hidden = pins.size === 0;
$('pins').innerHTML = [...pins].map(slug => {
const name = escape(candidates.get(slug).name);
return `<button type="button" data-unpin="${escape(slug)}" aria-label="Unpin ${name}">${name} ×</button>`;
}).join('');
}
function updateScenario() {
const row = candidates.get(state.selected);
const shift = $('tvlShift');
if (!row || !shift) return;
$('shiftLabel').value = (Number(shift.value)>0 ? '+' : '') + shift.value + '%';
$('scenarioResult').innerHTML = RadarView.scenarioResult(row,{tvlShift:Number(shift.value),peerCase:$('peerCase').value});
}
function updateDetail(row) {
const detail = $('detail');
const key = row ? row.slug + ':' + state.panel : 'empty';
const pinned = pins.has(row?.slug);
if (detail.dataset.selected === key) {
const pin = $('detailPin');
if (pin) {
pin.disabled = !pinned && pins.size === 3;
pin.textContent = pinned ? 'Pinned ✓' : '+ Pin';
pin.setAttribute('aria-pressed',String(pinned));
}
return;
}
detail.dataset.selected = key;
detail.innerHTML = RadarView.render(row,state.panel,pinned,pins.size === 3);
updateScenario();
}
function render() {
const active = document.activeElement;
const focusedSlug = active?.closest('#rows tr')?.dataset.slug;
const focusAction = active?.dataset.action;
updateHeaders();
const search = $('search').value.trim().toLowerCase();
const scope = $('scope').hidden ? '' : $('scope').value;
visible = views[state.tab].filter(row => matches(row,search,$('category').value,$('chain').value,scope)).sort(sorted);
const pages = Math.max(1,Math.ceil(visible.length/pageSize));
state.page = Math.min(state.page,pages-1);
const rows = visible.slice(state.page*pageSize,(state.page+1)*pageSize);
const selection = rows.find(row => row.slug === state.selected) ?? rows[0];
if (selection?.slug !== state.selected) state.panel = 'overview';
state.selected = selection?.slug ?? null;
$('rows').innerHTML = rows.map(rowHtml).join('');
const group = {early:'candidates',live:'token records',excluded:'screened records'}[state.tab];
$('resultCount').textContent = `${visible.length} ${group}${state.tab === 'early' ? ' · odds-adjusted rank' : ''}`;
$('empty').hidden = visible.length > 0;
$('boardTable').hidden = !visible.length;
$('page').textContent = `Page ${state.page+1} of ${pages}`;
$('prev').disabled = state.page === 0;
$('next').disabled = state.page+1 >= pages;
$('export').disabled = visible.length === 0;
updatePins();
updateDetail(selection);
if (focusedSlug && focusAction) {
const row = [...$('rows').children].find(tr => tr.dataset.slug === focusedSlug);
row?.querySelector(`[data-action="${focusAction}"]`)?.focus({preventScroll:true});
}
saveHash();
}
function setTab(tab) {
if (tab === state.tab) return;
state = {tab,sort:defaults[tab],dir:-1,page:0,selected:null,panel:'overview'};
menus();
$('scope').value = '';
render();
}
function togglePin(slug) {
if (pins.has(slug)) pins.delete(slug);
else if (candidates.has(slug) && pins.size < 3) pins.add(slug);
render();
}
function exportCsv() {
const column = {early:['implied_value_usd','value_if_launches','launch_odds','low','high','capital','feeCap','route'],live:['mcap_usd'],excluded:['exclusion']};
const header = ['rank','slug','name','category','tvl_usd','change_7d',...column[state.tab]];
const quote = value => {
const text = String(value ?? '');
const literal = typeof value === 'string' && /^[\t\r\n =+@-]/.test(text) ? "'"+text : text;
return '"'+literal.replaceAll('"','""')+'"';
};
const csv = [header,...visible.map(row => header.map(key => row[key]))].map(values => values.map(quote).join(',')).join('\r\n')+'\r\n';
const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
const anchor = document.createElement('a');
anchor.href = url;
anchor.download = `fieldnote-${state.tab}.csv`;
document.body.append(anchor);
anchor.click();
anchor.remove();
setTimeout(() => URL.revokeObjectURL(url),1000);
}
$('stamp').textContent = `SNAPSHOT ${data.as_of} · OFFLINE`;
$('earlyCount').textContent = data.rows.length;
$('metrics').innerHTML = [['Watchlist',`${data.watch_covered}/${data.watch_count}`],['Additional',data.rows.length-data.watch_covered],['Traded peers',data.peer_count]]
.map(([name,number]) => `<div><dt>${name}</dt><dd>${number}</dd></div>`).join('');
// Integrity seal, composition, inline validation — all traceable to board.json and the audits.
const pct = x => (x*100).toFixed(1)+'%';
const c = data.composition, v = data.launch.validation, w = data.launch.walkForward, cov = data.coverage;
$('assurance').innerHTML = `<div class="seal" role="status"><b>✓ Integrity</b> sha256 ${INTEGRITY.sha256.slice(0,12)} · ranks ${INTEGRITY.ranks} · non-increasing · watchlist ${INTEGRITY.watchlist}</div><div class="composition"><b>${c.universe}</b> = ${c.candidates} candidates (${c.watch} watch + ${c.additional} extra) + ${c.traded} traded + ${c.screened} screened</div><div class="vchips"><span>Launch LOO <b>${pct(v.accuracy)}</b> · Brier ${v.brier.toFixed(3)} vs ${v.baseBrier.toFixed(3)}</span><span>Walk-forward <b>${pct(w.accuracy)}</b> · Brier ${w.brier.toFixed(3)} vs ${w.baseBrier.toFixed(3)}</span><span>Coverage <b>${pct(cov.coverage)}</b> vs 60%</span><span>Size model <b>${data.audit.metrics.size.medianFactor.toFixed(2)}×</b> error</span></div>`;
$('coverage').textContent = `${data.universe} protocols · ${data.excluded.length} screened out · ${data.live.length} with token indicators`;
$('source').textContent = data.source;
$('modelAudit').innerHTML = RadarView.validation(data.audit);
$('launchAudit').innerHTML = RadarView.launchAudit(data.launch);
$('coverageAudit').innerHTML = RadarView.coverageAudit(cov);
for (const id of ['search','category','chain','scope']) $(id).addEventListener(id === 'search' ? 'input' : 'change',() => {state.page=0;render();});
tabs.forEach(button => button.addEventListener('click',() => setTab(button.dataset.tab)));
orderButtons.forEach(button => button.addEventListener('click',() => {
const key = button.dataset.sort;
state.dir = state.sort === key ? -state.dir : key === 'name' ? 1 : -1;
state.sort = key;
state.page = 0;
render();
}));
$('rows').addEventListener('click',event => {
const row = event.target.closest('tr[data-slug]');
if (!row) return;
if (event.target.closest('[data-action]')?.dataset.action === 'pin') return togglePin(row.dataset.slug);
state.selected = row.dataset.slug;
state.panel = 'overview';
render();
if (matchMedia('(max-width:1060px)').matches) $('detail').focus();
});
$('detail').addEventListener('click',event => {
const button = event.target.closest('button');
if (button?.dataset.panel) {
state.panel = button.dataset.panel;
render();
$('detail').querySelector(`.detail-tabs [data-panel="${state.panel}"]`)?.focus({preventScroll:true});
} else if (button?.id === 'detailPin') togglePin(state.selected);
else if (button?.id === 'resetScenario') {
$('tvlShift').value = '0';
$('peerCase').value = 'base';
updateScenario();
}
});
$('detail').addEventListener('input',event => {if (event.target.id === 'tvlShift' || event.target.id === 'peerCase') updateScenario();});
$('detail').addEventListener('change',event => {
if (event.target.id === 'peerCase') updateScenario();
if (event.target.id === 'depAmt' || event.target.id === 'dropShare') {
const row = candidates.get(state.selected);
if (row) $('econResult').innerHTML = RadarView.econResult(row,{deposit:Number($('depAmt').value),dropShare:Number($('dropShare').value)});
}
});
$('pins').addEventListener('click',event => {
const button = event.target.closest('[data-unpin]');
if (!button) return;
togglePin(button.dataset.unpin);
($('pins').querySelector('button') || $('search')).focus();
});
$('prev').addEventListener('click',() => {state.page--;render();});
$('next').addEventListener('click',() => {state.page++;render();});
$('emptyReset').addEventListener('click',() => {
for (const id of ['search','category','chain','scope']) $(id).value = '';
state.page = 0;
render();
$('search').focus();
});
$('export').addEventListener('click',exportCsv);
$('methodBtn').addEventListener('click',() => $('method').showModal());
$('closeMethod').addEventListener('click',() => $('method').close());
$('compareBtn').addEventListener('click',() => {
$('compareBody').innerHTML = RadarView.compare([...pins].map(slug => candidates.get(slug)));
$('compare').showModal();
});
$('closeCompare').addEventListener('click',() => $('compare').close());
window.addEventListener('hashchange',() => {readHash();render();});
document.addEventListener('keydown',event => {
if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !document.querySelector('dialog[open]') && !event.target.closest('input,select,textarea,[contenteditable]')) {
event.preventDefault();
$('search').focus();
}
});
readHash();
render();
})();