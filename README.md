# Fieldnote — Token Launch Radar

[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Celebez/makefun-fieldnote-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Celebez/makefun-fieldnote-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Offline protocol research dashboard for [make.fun](https://make.fun/bounty/token-radar-01). Reads the sealed snapshot, covers all watchlist protocols, and derives values from TVL, growth, tracking history and shrunk traded-token category comparables. The same model executes in Node and the browser.

Each candidate has a four-step conditional plan with capital, fee allowances, time and exit checks. Trading tokens and wrapper/product exclusions remain separate. Token absence, access and reward eligibility are not asserted as verified facts.

## Run

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
python3 -m http.server 8774 --directory out
```

Open `/dashboard/` to inspect the ranking. Search, category/chain/scope filters, sorting, pagination, protocol detail, CSV export and a model explanation are implemented without external dependencies or network requests.

`vendor/makefun-board.ts` is the supplied make.fun dossier builder. Screenshots show the actual dashboard running on the sealed snapshot. Source fits entirely in the dossier text budget.
