(()=>{'use strict';
const data=RadarModel.build(SNAPSHOT),$=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short=n=>n===null||n===undefined?'Not reported':n>=1e9?'$'+(n/1e9).toFixed(2)+'B':n>=1e6?'$'+(n/1e6).toFixed(1)+'M':RadarModel.money(n);
const pct=n=>n===null?'—':(n>=0?'+':'')+n.toFixed(1)+'%';
let tab='early',sort='implied_value_usd',dir=-1,page=0,selected=data.rows[0]?.slug,filtered=[];
$('stamp').textContent='SNAPSHOT '+data.as_of+' / OFFLINE';
$('earlyCount').textContent=data.rows.length;
$('metrics').innerHTML=[['Research universe',data.universe+' protocols'],['Watchlist coverage',data.watch_count+' / '+data.watch_count],['No token recorded',data.rows.length+' ranked'],['Calibration set',data.peer_count+' traded peers']].map(([a,b])=>'<div><b>'+b+'</b><small>'+a.toUpperCase()+'</small></div>').join('');
$('coverage').textContent='All '+data.watch_count+' watchlist protocols included · '+data.rows.filter(r=>!r.watchlist).length+' additional candidates';
$('modelSummary').textContent='Universe median MCap/TVL: '+data.global_multiple.toFixed(3)+'× • '+data.peer_count+' eligible comparables • as of '+data.as_of;
for(const cat of [...new Set(SNAPSHOT.protocols.map(r=>r.category||'Other'))].sort())$('category').add(new Option(cat,cat));
for(const chain of [...new Set(SNAPSHOT.protocols.flatMap(r=>r.chains))].sort())$('chain').add(new Option(chain,chain));
function render(){
 const q=$('search').value.toLowerCase(),cat=$('category').value,ch=$('chain').value,scope=$('scope').value;
 const pool=tab==='early'?data.rows:tab==='live'?data.live:data.excluded;
 filtered=pool.filter(r=>(!q||(r.name+' '+r.slug+' '+r.chains.join(' ')).toLowerCase().includes(q))&&(!cat||(r.category||'Other')===cat)&&(!ch||r.chains.includes(ch))&&(!scope||scope==='watch'&&r.watchlist||scope==='below'&&r.tvl_usd<5e7||scope==='trial'&&r.action_mode==='Conditional trial'));
 if(tab!=='early'&&sort==='implied_value_usd')sort='mcap_usd';
 filtered.sort((a,b)=>typeof a[sort]==='string'?dir*a[sort].localeCompare(b[sort]):dir*((a[sort]??-1)-(b[sort]??-1))||a.slug.localeCompare(b.slug));
 page=Math.min(page,Math.max(0,Math.ceil(filtered.length/10)-1));
 $('resultCount').textContent=filtered.length+' protocols · '+(tab==='early'?'ranked by implied market cap':tab==='live'?'reported traded tokens':'product / wrapper exclusions');
 $('sortLabel').textContent=sort.replaceAll('_',' ').toUpperCase()+(dir===-1?' ↓':' ↑')+' · inspect a row';
 $('rows').innerHTML=filtered.slice(page*10,page*10+10).map((r,i)=>'<tr tabindex="0" data-slug="'+esc(r.slug)+'" class="'+(selected===r.slug?'selected':'')+'"><td>'+String(r.rank||page*10+i+1).padStart(2,'0')+'</td><td><strong>'+esc(r.name)+'</strong><small>'+esc(r.category||'Other')+' · '+esc(r.chains.slice(0,2).join(', '))+(r.watchlist?' · FLOOR':'')+'</small></td><td class="num">'+short(r.tvl_usd)+'</td><td class="num '+(r.change_7d<0?'negative':'green')+'">'+pct(r.change_7d)+'</td><td class="num value">'+short(tab==='early'?r.implied_value_usd:r.mcap_usd)+'<small>'+ (tab==='early'?short(r.low)+'–'+short(r.high):'reported market cap')+'</small></td><td><span class="badge '+(r.action_mode==='Research only'?'research':'')+'">'+(tab==='early'?(r.capital?'$'+r.capital+' trial':'Research'):(tab==='live'?'Trading':'Excluded'))+'</span></td></tr>').join('');
 if(filtered.length&&!filtered.some(r=>r.slug===selected)){selected=filtered[0].slug;detail();}
 $('empty').hidden=filtered.length>0;
 $('page').textContent=(page+1)+' / '+Math.max(1,Math.ceil(filtered.length/10));$('prev').disabled=page===0;$('next').disabled=(page+1)*10>=filtered.length;
 document.querySelectorAll('#rows tr').forEach(el=>{el.onclick=()=>{selected=el.dataset.slug;detail();render();};el.onkeydown=e=>{if(e.key==='Enter')el.click();};});
}
function detail(){
 const r=data.rows.find(r=>r.slug===selected)||data.live.find(r=>r.slug===selected)||data.excluded.find(r=>r.slug===selected);
 if(!r)return;
 if(!r.plan){$('detail').innerHTML='<p class="eyebrow">'+(RadarModel.hasToken(r)?'TRADING TOKEN':'PRODUCT EXCLUSION')+'</p><h2>'+esc(r.name)+'</h2><p class="category">'+esc(r.category)+'</p><div class="estimate"><small>REPORTED MARKET CAP</small><b>'+short(r.mcap_usd)+'</b></div><p class="note">'+(RadarModel.hasToken(r)?'This record already identifies a traded token. It is separated from prospective-token ranking and used for peer calibration where eligible.':'This record appears to be a bridge, staked/wrapped product or exchange. It is excluded unless explicitly required by the sealed watchlist.')+'</p><div class="facts"><div><span>TVL</span><b>'+short(r.tvl_usd)+'</b></div><div><span>7-day TVL growth</span><b>'+pct(r.change_7d)+'</b></div></div>';return;}
 $('detail').innerHTML='<div class="detailhead"><p class="eyebrow">PROTOCOL NOTE / '+String(r.rank).padStart(2,'0')+'</p><span class="badge">'+(r.watchlist?'WATCHLIST':'EARLY RADAR')+'</span></div><h2>'+esc(r.name)+'</h2><p class="category">'+esc(r.category)+' · '+esc(r.token_status)+'</p><div class="chips">'+esc(r.chains.join(' · '))+'</div><div class="estimate"><small>IMPLIED TOKEN MARKET CAP · SCENARIO</small><b>'+short(r.implied_value_usd)+'</b><small>Sensitivity '+short(r.low)+'–'+short(r.high)+' · '+r.confidence+'</small></div><div class="facts"><div><span>TVL</span><b>'+short(r.tvl_usd)+'</b></div><div><span>7-day TVL growth</span><b>'+pct(r.change_7d)+'</b></div><div><span>Tracked history</span><b>'+(r.age_days===null?'Unknown → 365d':r.age_days+' days')+'</b></div><div><span>Category peers</span><b>'+r.peer_count+' observations</b></div></div><div class="formula">'+short(r.tvl_usd)+' × '+r.multiple.toFixed(3)+' peers<br>× '+r.growthFactor.toFixed(3)+' growth × '+r.ageFactor.toFixed(3)+' history<br>= '+RadarModel.money(r.implied_value_usd)+'</div><details class="evidence"><summary>Peer evidence & shrinkage</summary><p class="note">Category median '+r.category_median.toFixed(3)+'×; universe '+r.global_median.toFixed(3)+'×. Category weight '+(r.shrinkage_weight*100).toFixed(1)+'%; remainder shrunk to universe. Ratios clipped to 0.05–5×.</p>'+r.comparables.map(q=>'<p class="note">'+esc(q.name)+': '+q.ratio.toFixed(3)+'× raw → '+q.clipped.toFixed(3)+'× used</p>').join('')+(r.comparables.length?'':'<p class="note">No category peers; universe median used.</p>')+'</details><div class="planheading"><h3>Field plan</h3><span class="badge '+(r.capital?'':'research')+'">'+esc(r.action_mode)+'</span></div>'+r.plan.map((s,i)=>'<div class="step"><b>0'+(i+1)+' / '+esc(s.title)+'</b><p>'+esc(s.text)+'</p><div class="cost">'+esc(s.cost)+'<br>'+esc(s.time)+'</div></div>').join('')+'<p class="note">No verified airdrop or eligibility claim. Fee estimates are planning allowances, not live quotes. Tracking age is a proxy, not founding date.</p>';
}
for(const id of ['search','category','chain','scope'])$(id).addEventListener(id==='search'?'input':'change',()=>{page=0;render();});
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;page=0;sort=tab==='early'?'implied_value_usd':'tvl_usd';document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));render();});
document.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{dir=sort===b.dataset.sort?-dir:-1;sort=b.dataset.sort;page=0;render();});
$('prev').onclick=()=>{page--;render();};$('next').onclick=()=>{page++;render();};
$('methodBtn').onclick=()=>$('method').showModal();$('closeMethod').onclick=()=>$('method').close();
$('export').onclick=()=>{const q=x=>'"'+String(x??'').replaceAll('"','""')+'"';const csv=[['rank','name','tvl_usd','implied_value_usd','category','token_status'],...filtered.map(r=>[r.rank,r.name,r.tvl_usd,r.implied_value_usd,r.category,r.token_status])].map(r=>r.map(q).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='fieldnote-filtered.csv';a.click();URL.revokeObjectURL(a.href);};
window.FIELDNOTE={data,select:slug=>{selected=slug;detail();render();}};render();detail();
})();
