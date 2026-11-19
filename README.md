# Fieldnote — Token Launch Radar

[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Celebez/makefun-fieldnote-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Celebez/makefun-fieldnote-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Offline protocol research dashboard for [make.fun](https://make.fun/bounty/token-radar-01). It covers the sealed watchlist and additional candidates. The same model runs in Node and the browser, using TVL, seven-day change, tracking age and the market cap-to-TVL ratios of traded peers.

Each candidate has a four-step workflow with a principal limit, fee budget, time and exit checks. Selected workflows cite product documentation. Other workflows start from the snapshot category and require verifying the deployment before proceeding.

## Run

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
python3 -m http.server 8774 --directory out
```

Open `/dashboard/` to inspect the ranking. Pin up to three protocols to compare valuation ranges, cost limits and exit checks. The Scenario panel varies TVL and the peer case while preserving the snapshot ranks. Method & validation shows held-out errors on traded records, which measure the peer multiple rather than launch outcomes.

`vendor/makefun-board.ts` is the supplied make.fun dossier builder. Screenshots show the actual dashboard running on the sealed snapshot. Source fits entirely in the dossier text budget.
