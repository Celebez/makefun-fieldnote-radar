# Fieldnote — Token Launch Radar

[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Celebez/makefun-fieldnote-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Celebez/makefun-fieldnote-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Offline protocol research dashboard for [make.fun](https://make.fun/bounty/token-radar-01). It covers the sealed watchlist and additional candidates. Node and the browser share the same ridge log-size valuation, age/category launch-odds model, residual bands and farming-economics functions. Growth and category valuation extensions are evaluated but not used when they fail the dual median-error comparison.

Each candidate has a four-step workflow with a principal limit, fee budget, time and exit checks. Selected workflows cite product documentation. Other workflows start from the snapshot category and require verifying the deployment before proceeding.

## Run

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
python3 -m http.server 8774 --directory out
```

Open `/dashboard/` to inspect the ranking. Pin up to three protocols to compare valuation ranges, cost limits and exit checks. The Scenario panel varies TVL and residual bands while preserving the snapshot ranks. Method & validation reports leave-one-out and strictly-earlier listing-cohort value errors, plus held-out launch-label accuracy and Brier scores. Model selection is exploratory on this sealed snapshot: cohort transfer of current caps is not a historical return backtest or launch forecast. Open `/dashboard/#method=1` to link directly to the audit.

`vendor/makefun-board.ts` is the supplied make.fun dossier builder. Screenshots show the actual dashboard running on the sealed snapshot. Source fits entirely in the dossier text budget.
