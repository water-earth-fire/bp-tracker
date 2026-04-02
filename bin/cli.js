#!/usr/bin/env node
/**
 * bp-tracker CLI
 * Usage:
 *   bp-tracker                  — print current price + market summary
 *   bp-tracker --watch          — live-refresh every 60s
 *   bp-tracker --ohlc [days]    — print OHLC table (default 7 days)
 *   bp-tracker --history [days] — print price history (default 30 days)
 *   bp-tracker --currency EUR   — use a different fiat currency
 *   bp-tracker --help           — show this help
 */

const { getPrice, getMarketData, getOHLC, getHistory, watchPrice } = require("../src/index.js");

// ── ANSI helpers ───────────────────────────────────────────────────────────────
const ESC = "\x1b";
const clr = {
  reset:    `${ESC}[0m`,
  bold:     `${ESC}[1m`,
  dim:      `${ESC}[2m`,
  cyan:     `${ESC}[36m`,
  green:    `${ESC}[32m`,
  red:      `${ESC}[31m`,
  yellow:   `${ESC}[33m`,
  magenta:  `${ESC}[35m`,
  white:    `${ESC}[97m`,
  bgBlack:  `${ESC}[40m`,
};
const c = (color, str) => `${clr[color]}${str}${clr.reset}`;
const bold = str => `${clr.bold}${str}${clr.reset}`;

// ── Formatters ─────────────────────────────────────────────────────────────────
function fmtNum(n, decimals = 4) {
  if (n == null) return c("dim", "—");
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtLarge(n) {
  if (n == null) return c("dim", "—");
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3)  return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}
function fmtPct(n) {
  if (n == null) return c("dim", "—");
  const sign = n >= 0 ? "+" : "";
  const col  = n >= 0 ? "green" : "red";
  return c(col, `${sign}${n.toFixed(2)}%`);
}
function fmtDate(d) {
  if (!d) return c("dim", "—");
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

// ── Banner ─────────────────────────────────────────────────────────────────────
function printBanner() {
  console.log(`
${c("cyan", bold("  ██████╗ ██████╗ "))} ${c("yellow", "Backpack (BP) Token Tracker")}
${c("cyan", bold("  ██╔══██╗██╔══██╗"))} ${c("dim", "Data: CoinGecko · Solana Ecosystem")}
${c("cyan", bold("  ██████╔╝██████╔╝"))} ${c("dim", "Contract: HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC")}
${c("cyan", bold("  ██╔══██╗██╔═══╝ "))}
${c("cyan", bold("  ██████╔╝██║     "))}
${c("cyan", bold("  ╚═════╝ ╚═╝     "))}
`);
}

// ── Market summary ─────────────────────────────────────────────────────────────
async function printSummary(currency) {
  process.stdout.write(c("dim", "  Fetching BP market data…\r"));
  const d = await getMarketData(currency);
  console.clear && console.clear();
  printBanner();

  const priceColor = (d.changePct24h ?? 0) >= 0 ? "green" : "red";

  console.log(`  ${bold("Price")}       ${c(priceColor, bold(`$${fmtNum(d.price, 6)}`))} ${c("dim", d.currency)}`);
  console.log(`  ${bold("24h Change")}  ${fmtPct(d.changePct24h)}  ${c("dim", `(${fmtNum(d.change24h, 6)} ${d.currency})`)}`);
  console.log(`  ${bold("24h High")}    $${fmtNum(d.high24h, 6)}`);
  console.log(`  ${bold("24h Low")}     $${fmtNum(d.low24h, 6)}`);
  console.log();
  console.log(`  ${bold("Market Cap")}  ${fmtLarge(d.marketCap)}    ${c("dim", `Rank #${d.marketCapRank ?? "—"}`)}`);
  console.log(`  ${bold("FDV")}         ${fmtLarge(d.fullyDilutedValue)}`);
  console.log(`  ${bold("Volume 24h")} ${fmtLarge(d.volume24h)}`);
  console.log();
  console.log(`  ${bold("Circ. Supply")} ${Number(d.circulatingSupply ?? 0).toLocaleString("en-US")} BP`);
  console.log(`  ${bold("Total Supply")} ${Number(d.totalSupply ?? 0).toLocaleString("en-US")} BP`);
  console.log(`  ${bold("Max Supply")}  ${Number(d.maxSupply ?? 0).toLocaleString("en-US")} BP`);
  console.log();
  if (d.ath) {
    console.log(`  ${bold("ATH")}         $${fmtNum(d.ath, 6)}  ${c("dim", `on ${fmtDate(d.athDate)}`)}`);
    console.log(`  ${bold("ATH Δ")}       ${fmtPct(d.athChangePct)}`);
  }
  console.log();
  console.log(`  ${c("dim", `Last updated: ${fmtDate(d.lastUpdated)}`)}`);
  console.log();
}

// ── OHLC table ─────────────────────────────────────────────────────────────────
async function printOHLC(days, currency) {
  process.stdout.write(c("dim", `  Fetching ${days}-day OHLC…\r`));
  const rows = await getOHLC({ vsCurrency: currency, days });
  printBanner();
  console.log(`  ${bold(`BP/USD OHLC — last ${days} day(s)`)}\n`);
  console.log(`  ${"Date".padEnd(22)} ${"Open".padStart(12)} ${"High".padStart(12)} ${"Low".padStart(12)} ${"Close".padStart(12)}`);
  console.log(`  ${"-".repeat(72)}`);
  rows.forEach(r => {
    const dir = r.close >= r.open ? "green" : "red";
    console.log(
      `  ${c("dim", r.timestamp.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }).padEnd(22))}` +
      ` ${fmtNum(r.open, 6).padStart(12)}` +
      ` ${c("green", fmtNum(r.high, 6).padStart(12))}` +
      ` ${c("red",   fmtNum(r.low,  6).padStart(12))}` +
      ` ${c(dir,     fmtNum(r.close,6).padStart(12))}`
    );
  });
  console.log();
}

// ── History sparkline ──────────────────────────────────────────────────────────
function sparkline(values) {
  const bars = ["▁","▂","▃","▄","▅","▆","▇","█"];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map(v => bars[Math.round(((v - min) / range) * (bars.length - 1))]).join("");
}

async function printHistory(days, currency) {
  process.stdout.write(c("dim", `  Fetching ${days}-day history…\r`));
  const rows = await getHistory({ vsCurrency: currency, days });
  printBanner();
  console.log(`  ${bold(`BP Price History — last ${days} day(s)`)}\n`);

  // Sparkline
  const prices = rows.map(r => r.price).filter(Boolean);
  if (prices.length) {
    const spark = sparkline(prices);
    const first = prices[0], last = prices[prices.length - 1];
    const col = last >= first ? "green" : "red";
    console.log(`  ${c("dim", "Trend ")}${c(col, spark)}\n`);
  }

  // Sample every Nth row for readability (max 40 lines)
  const step = Math.max(1, Math.floor(rows.length / 40));
  const sample = rows.filter((_, i) => i % step === 0);

  console.log(`  ${"Date".padEnd(22)} ${"Price".padStart(14)} ${"Market Cap".padStart(16)} ${"Volume".padStart(14)}`);
  console.log(`  ${"-".repeat(68)}`);
  sample.forEach(r => {
    console.log(
      `  ${c("dim", r.timestamp.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }).padEnd(22))}` +
      ` ${fmtNum(r.price, 6).padStart(14)}` +
      ` ${fmtLarge(r.marketCap).padStart(16)}` +
      ` ${fmtLarge(r.volume).padStart(14)}`
    );
  });
  console.log();
}

// ── Watch mode ─────────────────────────────────────────────────────────────────
function startWatch(currency, intervalMs = 60_000) {
  printBanner();
  console.log(c("yellow", `  Live mode — refreshing every ${intervalMs / 1000}s  ${c("dim", "(Ctrl+C to quit)")}\n`));

  const watcher = watchPrice((err, data) => {
    if (err) {
      console.error(c("red", `  Error: ${err.message}`));
      return;
    }
    const ts      = new Date().toLocaleTimeString("en-GB");
    const pctCol  = (data.changePct24h ?? 0) >= 0 ? "green" : "red";
    process.stdout.write(
      `\r  ${c("dim", ts)}  ${bold(c(pctCol, `$${fmtNum(data.price, 6)}`))}` +
      `  ${fmtPct(data.changePct24h)}  ` +
      c("dim", `Vol: ${fmtLarge(data.volume24h)}  MCap: ${fmtLarge(data.marketCap)}`) +
      "   "
    );
  }, { intervalMs, vsCurrency: currency });

  process.on("SIGINT", () => {
    watcher.stop();
    console.log("\n\n  " + c("dim", "Stopped. Goodbye!") + "\n");
    process.exit(0);
  });
}

// ── Argument parsing ───────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const hasFlag = f => args.includes(f);
const flagVal = (f, def) => {
  const i = args.indexOf(f);
  return (i !== -1 && args[i + 1] && !args[i + 1].startsWith("--")) ? args[i + 1] : def;
};

if (hasFlag("--help") || hasFlag("-h")) {
  printBanner();
  console.log(`  ${bold("Usage:")}`);
  console.log(`    bp-tracker                        Current price & full market summary`);
  console.log(`    bp-tracker --watch                Live price feed (refreshes every 60s)`);
  console.log(`    bp-tracker --ohlc [days]          OHLC candlestick table  (default: 7)`);
  console.log(`    bp-tracker --history [days]       Price history table     (default: 30)`);
  console.log(`    bp-tracker --currency <CODE>      Quote in another currency (e.g. EUR, GBP, BTC)`);
  console.log(`    bp-tracker --interval <ms>        Watch interval in ms    (default: 60000)`);
  console.log(`    bp-tracker --help                 Show this help\n`);
  console.log(`  ${bold("Examples:")}`);
  console.log(`    bp-tracker --ohlc 14 --currency GBP`);
  console.log(`    bp-tracker --watch --interval 30000\n`);
  process.exit(0);
}

const currency   = (flagVal("--currency", "usd")).toLowerCase();
const intervalMs = parseInt(flagVal("--interval", "60000"), 10);

(async () => {
  try {
    if (hasFlag("--watch")) {
      startWatch(currency, intervalMs);
    } else if (hasFlag("--ohlc")) {
      const days = parseInt(flagVal("--ohlc", "7"), 10);
      await printOHLC(days, currency);
    } else if (hasFlag("--history")) {
      const days = parseInt(flagVal("--history", "30"), 10);
      await printHistory(days, currency);
    } else {
      await printSummary(currency);
    }
  } catch (err) {
    console.error(c("red", `\n  Error: ${err.message}\n`));
    process.exit(1);
  }
})();
