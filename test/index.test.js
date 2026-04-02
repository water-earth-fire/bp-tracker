/**
 * Basic sanity tests — run with: node test/index.test.js
 */

const { getPrice, getMarketData, getOHLC, getHistory } = require("../src/index.js");

let passed = 0, failed = 0;

async function test(label, fn) {
  try {
    await fn();
    console.log(`  ✅  ${label}`);
    passed++;
  } catch (err) {
    console.log(`  ❌  ${label}: ${err.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || "Assertion failed");
}

(async () => {
  console.log("\n  bp-tracker — Test Suite\n");

  await test("getPrice() returns a numeric price", async () => {
    const d = await getPrice();
    assert(typeof d.price === "number" && d.price > 0, `price=${d.price}`);
    assert(d.currency === "USD");
  });

  await test("getPrice() with extras includes all fields", async () => {
    const d = await getPrice({ marketCap: true, volume24h: true, change24h: true, lastUpdated: true });
    assert(d.marketCap != null, "marketCap missing");
    assert(d.volume24h != null, "volume24h missing");
    assert(d.change24h != null, "change24h missing");
    assert(d.lastUpdated instanceof Date, "lastUpdated not a Date");
  });

  await test("getMarketData() returns full market snapshot", async () => {
    const d = await getMarketData();
    assert(d.symbol === "BP", `symbol=${d.symbol}`);
    assert(d.price > 0);
    assert(d.circulatingSupply > 0);
    assert(d.ath > 0);
  });

  await test("getOHLC() returns OHLC rows for 7 days", async () => {
    const rows = await getOHLC({ days: 7 });
    assert(Array.isArray(rows) && rows.length > 0, "empty OHLC");
    const r = rows[0];
    assert(r.timestamp instanceof Date);
    assert(typeof r.open === "number");
    assert(typeof r.high === "number");
    assert(typeof r.low  === "number");
    assert(typeof r.close === "number");
  });

  await test("getHistory() returns timestamped price points", async () => {
    const rows = await getHistory({ days: 7 });
    assert(Array.isArray(rows) && rows.length > 0, "empty history");
    const r = rows[0];
    assert(r.timestamp instanceof Date);
    assert(typeof r.price === "number" && r.price > 0);
  });

  await test("getPrice() with EUR currency", async () => {
    const d = await getPrice({ vsCurrency: "eur" });
    assert(d.currency === "EUR");
    assert(d.price > 0);
  });

  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
})();
