/* Curated routes/workflows live in routes.json + workflows.json (data); main.ts and
   the page inject them via init(). Product notes never change valuation inputs. */
(function (root) {
'use strict';
let sourced = {}, knownProducts = {}, workflows = [];
function init(data) {
  sourced = data.sourced;
  knownProducts = data.knownProducts;
  workflows = data.workflows.map(w => [new RegExp(w.pattern), w.label, w.capital, w.text]);
}
function documentedProduct(protocol) {
  return Object.hasOwn(knownProducts, protocol.slug) ? knownProducts[protocol.slug] : null;
}
function makePlan(protocol, exclusion) {
  const candidate = Object.hasOwn(sourced, protocol.slug) ? sourced[protocol.slug] : null;
  const route = !exclusion && candidate && (!candidate.chain || protocol.chains.includes(candidate.chain)) ? candidate : null;
  const chain = route?.chain ?? protocol.chains[0] ?? 'Unreported';
  const activeChain = route?.chain ? 'on ' + chain : 'on a documented deployment';
  const workflow = workflows.find(([category]) => category.test(protocol.category || ''));
  const label = route?.label ?? (exclusion ? 'Coverage exception' : workflow?.[1] ?? 'Research first');
  const capital = exclusion ? 0 : route?.capital ?? workflow?.[2] ?? 0;
  const feeCap = chain === 'Ethereum' || chain === 'Bitcoin' ? 12 : 4;
  const note = route?.source ?? documentedProduct(protocol)?.source ?? null;
  const verify = route?.verify ?? (exclusion ?
    'Identify the product and its token relationship in official docs. Required watchlist record, screening flag: ' + exclusion + '.' :
    'Locate ' + protocol.name + ' in official docs; match app, chain and contract to the documented deployment; check token and participation terms.');
  const steps = [{title:'Verify deployment and access', text:verify, cost:'US$0', time:'10–20 min', minutes:15, capital:0}];
  if (capital) {
    steps.push({title:'Preview a limited trial', text:route?.trial ?? (workflow[3] + ' If fees and terms fit, cap principal at US$' + capital + ' ' + activeChain + '.'),
      cost:'Up to US$' + capital + ' principal + fees', time:'15–25 min', minutes:20, capital});
    steps.push({title:'Track the position weekly', text:(route?.follow ?? 'Track input, output and receipts; review fee, liquidity and participation terms weekly.') + ' Stop if quoted total fees would exceed the fee budget.',
      cost:'US$0 to monitor', time:'10 min × 4 weeks', minutes:40, capital:0});
    steps.push({title:'Test the exit', text:route?.exit ?? 'Quote a small return swap or redemption to the underlying asset; reconcile output with the receipt; revoke unneeded approvals.',
      cost:'US$' + feeCap + ' combined fee budget for trial and exit', time:'10–15 min + any queue', minutes:12, capital:0});
  } else {
    const investigation = exclusion ? 'Verify the underlying token, its issuer and where it trades; no deposit trial.' :
      workflow?.[3] ?? 'Identify the intended user; read access and withdrawal terms. Unclear access or exit means capital stays at zero.';
    steps.push({title:'Qualify the workflow', text:investigation, cost:'US$0', time:'15–20 min', minutes:18, capital:0});
    steps.push({title:'Track changes in terms', text:'Check the official changelog and eligibility weekly; record access, asset or redemption changes; stop on restrictions.', cost:'US$0', time:'10 min × 4 weeks', minutes:40, capital:0});
    steps.push({title:'Document the go/no-go decision', text:'Require a verified product, eligible account and documented exit before any trial; unknown or gated access means skip.', cost:'US$0', time:'10–15 min', minutes:12, capital:0});
  }
  return {steps, label, note, verifiedRoute:Boolean(route), chain:route?.chain ?? (chain === 'Unreported' ? chain : chain + ' (snapshot)'),
    capital, feeCap:capital ? feeCap : 0, hours:steps.reduce((sum, step) => sum + step.minutes, 0) / 60,
    mode:capital ? 'Conditional trial' : 'Research only'};
}
root.RadarPlans = {init, makePlan, documentedProduct};
})(globalThis);
