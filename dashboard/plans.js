/* Product notes supply workflow context. They never change valuation inputs. */
(function (root) {
'use strict';
const sourced = {
  'steakhouse-financial': {
    chain:'Base', capital:25, label:'Morpho vault shares', source:'https://www.steakhouse.financial/docs/products/stablecoin-products/vaults',
    verify:'Find the Steakhouse curator on Morpho. Match the Base vault, deposit token, vault version and curator address to the published vault documentation. Read the cap, timelock and currently withdrawable liquidity.',
    trial:'With the accepted asset already on Base, preview minting vault shares with at most US$25. Check the assets-to-shares quote and the withdrawal preview before signing a limited approval.',
    follow:'Monitor the vault’s deployed collateral, allocation cap changes and available exit liquidity weekly.',
    exit:'Preview redemption in the underlying asset. If the vault shows available liquidity, redeem a small share amount first and reconcile the returned amount with the receipt.'
  },
  gauntlet: {
    chain:'Base', capital:25, label:'Gauntlet curated vault', source:'https://api.gauntlet.xyz/v1/vaults',
    verify:'Find Gauntlet’s USDC Prime entry for Base in its published vault directory. Match its chain, asset and curator to the vault interface. Review the market mix and current exit liquidity.',
    trial:'Preview a deposit of at most US$25 in the listed asset. Sign only a bounded approval and only after comparing the quoted share amount to the redemption preview.',
    follow:'Recheck the collateral mix and available exit liquidity weekly. Reassess if the vault moves into markets outside your risk limit.',
    exit:'Use the vault preview to quote how much of your position is redeemable. Redeem a small amount first and reconcile shares burned against assets returned.'
  },
  'sentora-curator': {
    chain:'Ethereum', capital:25, label:'PRIME Main vault', source:'https://sentora.com/research/articles/sentora-launches-prime-vault-on-morpho',
    verify:'Locate Sentora’s PRIME Main vault in the documented Morpho deployment. Verify its underlying asset and caps, then inspect which lending markets hold the vault’s deposits.',
    trial:'Preview depositing at most US$25 in the accepted asset, already on Ethereum. Compare expected shares with the redemption preview and skip if fees exceed the budget.',
    follow:'Check whether new allocations concentrate in one borrower market or reduce immediately available withdrawal liquidity.',
    exit:'Preview a small share redemption and confirm that it returns the correct underlying asset. If liquidity falls, wait rather than adding principal.'
  },
  veda: {
    capital:25, label:'BoringVault', source:'https://docs.veda.tech/integrations/deposits-and-withdrawals-overview',
    verify:'Locate a public vault listed by a Veda integration. Match the vault and Teller contracts, accepted asset, permissions, supported network and whether exits are immediate or queued.',
    trial:'If the identified vault accepts your existing asset and account, preview a US$25 deposit through the documented Teller. Confirm shares received and the configured minimum on output.',
    follow:'Review the vault’s exchange rate and whether its withdrawal queue is backed up. Avoid adding principal until you have completed a round trip.',
    exit:'Use the exit route specified by that integration. For a queued withdrawal, save the request and earliest completion details before checking settlement.'
  },
  upshift: {
    capital:25, label:'Share vault', source:'https://docs.upshift.finance/contracts/vault-interface.md',
    verify:'Find an official Upshift vault and read its asset, deposit minimum and redemption queue terms. Match vault and asset addresses on a snapshot-listed network.',
    trial:'Only if the vault minimum fits US$25 and the asset is already on the selected chain, preview a deposit. Compare the exchange rate and shares shown against the accounting documentation.',
    follow:'Record the vault’s share-to-asset ratio and verify the next redemption epoch before considering any increase.',
    exit:'If the vault uses epochs, submit a small redemption request and return when the documentation says it can be claimed. Keep the request and claim receipts together.'
  },
  curvance: {
    chain:'Monad', capital:50, label:'Isolated lending market', source:'https://docs.curvance.com/app/protocol-overview/liquidity-markets',
    verify:'Use Curvance’s deployment registry to identify an isolated lending market on Monad. Match the market address and underlying asset and check its deposit cap and available withdrawal liquidity.',
    trial:'Preview supplying at most US$50 of an accepted asset to the verified market. Select the supply side and leave borrowing unused.',
    follow:'Check the market’s utilization, available liquidity and withdrawal preview weekly. A higher quoted rate can coincide with a more constrained exit.',
    exit:'Quote and redeem a small amount from the same market. Verify the settlement in the underlying asset before considering the rest.'
  },
  tydro: {
    chain:'Ink', capital:50, label:'Supply-only lending', source:'https://docs.tydro.com/v.-risk/risk-types-and-overview',
    verify:'Confirm the Ink deployment, reserve address and accepted asset from Tydro’s documentation. Check utilization, the supply cap and the available liquidity for redemption.',
    trial:'With an accepted asset already on Ink, preview supplying up to US$50. Keep the workflow supply-only and verify the deposited amount and fee quote.',
    follow:'Track utilization and exit liquidity weekly. Review the risk documentation when market conditions or reserve parameters change.',
    exit:'Only proceed if the reserve has sufficient liquidity for a test withdrawal. Request a small amount first and check the balance received.'
  }
};
const knownProducts = {
  usdd:{reason:'Existing stablecoin product', source:'https://docs.usdd.io/'},
  'bittensor-dtao':{reason:'Existing TAO and subnet alpha assets', source:'https://docs.learnbittensor.org/dynamic-tao/dtao-faq'},
};
function documentedProduct(protocol) {
  return Object.hasOwn(knownProducts, protocol.slug) ? knownProducts[protocol.slug] : null;
}
const workflows = [
  [/^Risk Curators$/, 'Curated vault', 0, 'Identify the underlying vault, curator role and contract in its documentation. Check asset concentration, curator permissions and available redemption liquidity.'],
  [/^(RWA|CeDeFi|Onchain Capital Allocator|Insurance|Chain|Payments|Governance Incentives|Staking Pool|Restaking|Collateral Markets|Basis Trading)$/, 'Research first', 0, 'Identify a documented public product and its access terms. Check custody, lockup and redemption, and record whether a small, reversible trial is possible.'],
  [/^CDP$/, 'Collateral research', 0, 'Read the collateral requirements, liquidation threshold, costs and repayment route. Use a preview to understand the position without opening debt.'],
  [/^Lending$/, 'Supply-only trial', 50, 'Find a verified public market that accepts an asset you already hold. Review deposit cap, utilization and redemption liquidity before previewing a supply-only position. Keep borrowing disabled.'],
  [/^(Dexs|Liquidity Manager)$/, 'Single swap trial', 10, 'Preview one swap for an asset you need on a documented liquid pair. Record the fee, price impact and minimum output. Skip the trial if price impact exceeds 0.5%.'],
  [/^(Yield|Yield Aggregator)$/, 'Vault trial', 25, 'Find a documented vault with a deposit minimum below the limit. Verify the underlying asset, share price, current capacity and lockup before previewing a deposit.'],
];
function makePlan(protocol, exclusion) {
  const candidate = Object.hasOwn(sourced, protocol.slug) ? sourced[protocol.slug] : null;
  const route = !exclusion && candidate && (!candidate.chain || protocol.chains.includes(candidate.chain)) ? candidate : null;
  const chain = route?.chain ?? protocol.chains[0] ?? 'Unreported';
  const activeChain = route?.chain ? 'on ' + chain : 'on a documented, snapshot-listed deployment';
  const workflow = workflows.find(([category]) => category.test(protocol.category || ''));
  const label = route?.label ?? (exclusion ? 'Coverage exception' : workflow?.[1] ?? 'Research first');
  const capital = exclusion ? 0 : route?.capital ?? workflow?.[2] ?? 0;
  const feeCap = chain === 'Ethereum' || chain === 'Bitcoin' ? 12 : 4;
  const note = route?.source ?? documentedProduct(protocol)?.source ?? null;
  const verify = route?.verify ?? (exclusion ?
    'Identify the underlying product and its token relationship in official documentation. This is a required watchlist record with the following screening flag: ' + exclusion + '.' :
    'Locate ' + protocol.name + ' in its official documentation. Match the application, chain and contract against the documented deployment, then check the token and participation terms.');
  const steps = [{title:'Verify deployment and access', text:verify, cost:'US$0', time:'10–20 min', capital:0}];
  if (capital) {
    steps.push({title:'Preview a limited trial', text:route?.trial ?? (workflow[3] + ' If fees and terms fit, cap principal at US$' + capital + ' ' + activeChain + '.'),
      cost:'Up to US$' + capital + ' principal + fees', time:'15–25 min', capital});
    steps.push({title:'Track the position weekly', text:(route?.follow ?? 'Track your actual input, output and receipts. Review fee, liquidity and participation terms weekly before any further use.') + ' Stop if quoted total transaction fees would exceed the fee budget.',
      cost:'US$0 to monitor', time:'10 min × 4 weeks', capital:0});
    steps.push({title:'Test the exit', text:route?.exit ?? 'Review the route back to the underlying asset and quote a small return swap or redemption. Reconcile the output with the receipt and remove any unneeded approval.',
      cost:'US$' + feeCap + ' combined fee budget for trial and exit', time:'10–15 min + any queue', capital:0});
  } else {
    const investigation = exclusion ? 'Verify the underlying token, who issues it and where it already trades. Keep the product out of a deposit trial.' :
      workflow?.[3] ?? 'Identify the product’s intended user and read the access and withdrawal terms. If product access or the exit path is unclear, leave capital at zero.';
    steps.push({title:'Qualify the workflow', text:investigation, cost:'US$0', time:'15–20 min', capital:0});
    steps.push({title:'Track changes in terms', text:'Check the official changelog and eligibility terms weekly. Record changes to public access, accepted assets or redemption and stop if restrictions apply.', cost:'US$0', time:'10 min × 4 weeks', capital:0});
    steps.push({title:'Document the go/no-go decision', text:'Record a verified product, an eligible account and a documented exit before moving from research into a separate trial. Unknown or gated access means skip.', cost:'US$0', time:'10–15 min', capital:0});
  }
  return {steps, label, note, verifiedRoute:Boolean(route), chain:route?.chain ?? (chain === 'Unreported' ? chain : chain + ' (snapshot)'),
    capital, feeCap:capital ? feeCap : 0, mode:capital ? 'Conditional trial' : 'Research only'};
}
root.RadarPlans = {makePlan, documentedProduct};
})(globalThis);
