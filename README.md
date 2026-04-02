# bp-tracker

> Real-time price tracker for the **Backpack ($BP)** token — a Solana-native exchange token with equity-conversion mechanics.

Pulls live data from [CoinGecko](https://www.coingecko.com/en/coins/backpack) (free, no API key required for basic use).

---

## Installation

```bash
# Use directly via npx (no install needed)
npx bp-tracker

# Or install globally
npm install -g bp-tracker

# Or clone and run locally
git clone https://github.com/YOUR_USERNAME/bp-tracker
cd bp-tracker
npm install
node bin/cli.js
```

---

## CLI Usage

```
bp-tracker                        Current price & full market summary
bp-tracker --watch                Live price feed (refreshes every 60s)
bp-tracker --ohlc [days]          OHLC candlestick table  (default: 7)
bp-tracker --history [days]       Price history table     (default: 30)
bp-tracker --currency <CODE>      Quote in another currency (e.g. EUR, GBP, BTC)
bp-tracker --interval <ms>        Watch interval in ms    (default: 60000)
bp-tracker --help                 Show help
```

### Examples

```bash
# Live GBP price, refreshing every 30s
bp-tracker --watch --currency gbp --interval 30000

# 14-day OHLC in EUR
bp-tracker --ohlc 14 --currency eur

# 90-day price history
bp-tracker --history 90
```

---

## Programmatic API

```js
const bp = require("bp-tracker");

// Current price
const { price, currency } = await bp.getPrice();
console.log(`BP = $${price}`);

// Price with all extras
const data = await bp.getPrice({
  vsCurrency: "usd",
  marketCap:  true,
  volume24h:  true,
  change24h:  true,
  lastUpdated: true,
});

// Full market snapshot
const market = await bp.getMarketData("usd");
console.log(market);
/*
{
  name: 'Backpack',
  symbol: 'BP',
  price: 0.159,
  marketCap: 39825483,
  marketCapRank: 511,
  fullyDilutedValue: 159301930,
  volume24h: 5391666,
  high24h: 0.174,
  low24h: 0.153,
  changePct24h: -2.9,
  circulatingSupply: 250000000,
  totalSupply: 1000000000,
  maxSupply: 1000000000,
  ath: 0.3771,
  athDate: 2026-03-17T...,
  ...
}
*/

// Historical OHLC (7 days by default)
const ohlc = await bp.getOHLC({ vsCurrency: "usd", days: 14 });
// => [{ timestamp, open, high, low, close }, ...]

// Historical price/volume/mcap
const history = await bp.getHistory({ vsCurrency: "usd", days: 30 });
// => [{ timestamp, price, marketCap, volume }, ...]

// Live polling — calls callback every 60s
const watcher = bp.watchPrice((err, data) => {
  if (err) return console.error(err);
  console.log(`BP = $${data.price}  (${data.changePct24h?.toFixed(2)}%)`);
}, { intervalMs: 60_000, vsCurrency: "usd" });

// Stop polling when done
setTimeout(() => watcher.stop(), 5 * 60_000);
```

---

## Token Background

| Item | Detail |
|------|--------|
| **Ticker** | $BP |
| **Chain** | Solana |
| **Contract** | `HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC` |
| **Total Supply** | 1,000,000,000 BP |
| **Circulating** | 250,000,000 BP (25%) |
| **Equity Conversion** | 1-year lock → Backpack corporate equity (up to 20% of equity pool) |
| **TGE** | March 23, 2026 |

---

## Rate Limits

CoinGecko's free **Demo** tier allows **30 calls/min** and **10,000 calls/month**. `watchPrice` enforces a minimum 10-second interval and backs off automatically on 429 responses.

For heavier use, set a `CG_API_KEY` environment variable and pass it in via the `x_cg_demo_api_key` query param (see `src/index.js`).

---

## Running Tests

```bash
npm test
```

Tests make live API calls — requires internet access.

---

## License

MIT
