/**
 * bp-tracker — Backpack (BP) Token Price Tracker
 * Data via CoinGecko public API (no API key required for basic usage)
 *
 * CoinGecko coin ID: "backpack"
 * Solana contract:   HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC
 */

const BASE_URL = "https://api.coingecko.com/api/v3";
const COIN_ID   = "backpack";

// Minimal fetch wrapper with retry + rate-limit handling
async function apiFetch(url, retries = 3) {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const { default: fetch } = await import("node-fetch");
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (res.status === 429) {
        const wait = 60_000; // CoinGecko free tier: back off 1 min
        process.stderr.write(`[bp-tracker] Rate limited — retrying in 60s…\n`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      lastError = err;
      if (attempt < retries - 1) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastError;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the current price (and optional extras) for BP.
 *
 * @param {object} [opts]
 * @param {string}   [opts.vsCurrency="usd"]     Fiat/crypto to quote against
 * @param {boolean}  [opts.marketCap=false]       Include market cap
 * @param {boolean}  [opts.volume24h=false]       Include 24h volume
 * @param {boolean}  [opts.change24h=false]       Include 24h % change
 * @param {boolean}  [opts.lastUpdated=false]     Include last updated timestamp
 * @returns {Promise<object>}
 */
async function getPrice(opts = {}) {
  const {
    vsCurrency = "usd",
    marketCap  = false,
    volume24h  = false,
    change24h  = false,
    lastUpdated = false,
  } = opts;

  const params = new URLSearchParams({
    ids: COIN_ID,
    vs_currencies: vsCurrency,
    ...(marketCap   && { include_market_cap:        "true" }),
    ...(volume24h   && { include_24hr_vol:           "true" }),
    ...(change24h   && { include_24hr_change:        "true" }),
    ...(lastUpdated && { include_last_updated_at:    "true" }),
  });

  const data = await apiFetch(`${BASE_URL}/simple/price?${params}`);
  const coin = data[COIN_ID];
  if (!coin) throw new Error("No data returned for BP — coin may not yet be listed on CoinGecko.");

  const vc = vsCurrency.toLowerCase();
  const out = { price: coin[vc], currency: vc.toUpperCase() };
  if (marketCap   && coin[`${vc}_market_cap`]   != null) out.marketCap   = coin[`${vc}_market_cap`];
  if (volume24h   && coin[`${vc}_24h_vol`]       != null) out.volume24h   = coin[`${vc}_24h_vol`];
  if (change24h   && coin[`${vc}_24h_change`]    != null) out.change24h   = coin[`${vc}_24h_change`];
  if (lastUpdated && coin.last_updated_at         != null) out.lastUpdated = new Date(coin.last_updated_at * 1000);
  return out;
}

/**
 * Returns full market data for BP (circulating supply, ATH, etc.)
 *
 * @param {string} [vsCurrency="usd"]
 * @returns {Promise<object>}
 */
async function getMarketData(vsCurrency = "usd") {
  const params = new URLSearchParams({
    vs_currency: vsCurrency,
    ids:         COIN_ID,
  });

  const data = await apiFetch(`${BASE_URL}/coins/markets?${params}`);
  if (!data || !data[0]) throw new Error("No market data returned for BP.");

  const d = data[0];
  return {
    name:                d.name,
    symbol:              d.symbol.toUpperCase(),
    currency:            vsCurrency.toUpperCase(),
    price:               d.current_price,
    marketCap:           d.market_cap,
    marketCapRank:       d.market_cap_rank,
    fullyDilutedValue:   d.fully_diluted_valuation,
    volume24h:           d.total_volume,
    high24h:             d.high_24h,
    low24h:              d.low_24h,
    change24h:           d.price_change_24h,
    changePct24h:        d.price_change_percentage_24h,
    circulatingSupply:   d.circulating_supply,
    totalSupply:         d.total_supply,
    maxSupply:           d.max_supply,
    ath:                 d.ath,
    athDate:             d.ath_date ? new Date(d.ath_date) : null,
    athChangePct:        d.ath_change_percentage,
    atl:                 d.atl,
    atlDate:             d.atl_date ? new Date(d.atl_date) : null,
    lastUpdated:         d.last_updated ? new Date(d.last_updated) : null,
  };
}

/**
 * Returns historical OHLC price data.
 *
 * @param {object} [opts]
 * @param {string}  [opts.vsCurrency="usd"]
 * @param {number}  [opts.days=7]   1 | 7 | 14 | 30 | 90 | 180 | 365 | "max"
 * @returns {Promise<Array<{timestamp:Date, open:number, high:number, low:number, close:number}>>}
 */
async function getOHLC(opts = {}) {
  const { vsCurrency = "usd", days = 7 } = opts;
  const params = new URLSearchParams({ vs_currency: vsCurrency, days: String(days) });
  const raw = await apiFetch(`${BASE_URL}/coins/${COIN_ID}/ohlc?${params}`);

  if (!Array.isArray(raw)) throw new Error("Unexpected OHLC response format.");
  return raw.map(([ts, o, h, l, c]) => ({
    timestamp: new Date(ts),
    open:  o,
    high:  h,
    low:   l,
    close: c,
  }));
}

/**
 * Returns historical price/market-cap/volume over time (hourly or daily).
 *
 * @param {object} [opts]
 * @param {string}  [opts.vsCurrency="usd"]
 * @param {number|string} [opts.days=30]  Number of days, or "max"
 * @returns {Promise<Array<{timestamp:Date, price:number, marketCap:number, volume:number}>>}
 */
async function getHistory(opts = {}) {
  const { vsCurrency = "usd", days = 30 } = opts;
  const params = new URLSearchParams({ vs_currency: vsCurrency, days: String(days) });
  const raw = await apiFetch(`${BASE_URL}/coins/${COIN_ID}/market_chart?${params}`);

  const prices    = raw.prices    || [];
  const marketCap = raw.market_caps || [];
  const volumes   = raw.total_volumes || [];

  return prices.map(([ts, price], i) => ({
    timestamp: new Date(ts),
    price,
    marketCap:  marketCap[i]?.[1] ?? null,
    volume:     volumes[i]?.[1]   ?? null,
  }));
}

/**
 * Polls the current price at a set interval, calling `callback` each tick.
 *
 * @param {function} callback  Called with `(err, data)` each interval
 * @param {object}   [opts]
 * @param {number}   [opts.intervalMs=60000]  Poll interval in ms (min 10s on free tier)
 * @param {string}   [opts.vsCurrency="usd"]
 * @returns {{ stop: function }}  Call `.stop()` to halt polling
 */
function watchPrice(callback, opts = {}) {
  const { intervalMs = 60_000, vsCurrency = "usd" } = opts;
  const safeInterval = Math.max(intervalMs, 10_000);

  let timer;
  const tick = async () => {
    try {
      const data = await getPrice({ vsCurrency, marketCap: true, volume24h: true, change24h: true, lastUpdated: true });
      callback(null, data);
    } catch (err) {
      callback(err, null);
    }
  };

  tick(); // fire immediately
  timer = setInterval(tick, safeInterval);
  return { stop: () => clearInterval(timer) };
}

module.exports = { getPrice, getMarketData, getOHLC, getHistory, watchPrice, COIN_ID };
