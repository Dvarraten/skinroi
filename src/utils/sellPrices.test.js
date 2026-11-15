import { describePrice, sellPricesFor, sellPriceKey, SELL_PRICE_MAX_AGE_MS } from "./sellPrices";

const NOW = 1_800_000_000_000;

test("hides YouPin prices older than an hour", () => {
  const old = describePrice({ priceUsd: 10, at: NOW - SELL_PRICE_MAX_AGE_MS - 1 }, "youpin", NOW);
  expect(old.state).toBe("stale");
  expect(describePrice({ priceUsd: 10, at: NOW - 5 * 60000 }, "youpin", NOW).state).toBe("ok");
});

test("CSFloat prices stay shown for two days", () => {
  const H = 60 * 60 * 1000;
  const dayOld = describePrice({ priceUsd: 10, at: NOW - 30 * H }, "csfloat", NOW);
  expect(dayOld.state).toBe("ok");
  expect(dayOld.net).toBeCloseTo(9.8);
  const old = describePrice({ priceUsd: 10, at: NOW - 51 * H }, "csfloat", NOW);
  expect(old.state).toBe("stale");
  expect(old.note).toMatch(/older than 50 hours/);
});

test("nothing listed and never fetched are told apart", () => {
  expect(describePrice({ priceUsd: null, at: NOW }, "youpin", NOW).state).toBe("none");
  expect(describePrice(undefined, "youpin", NOW).state).toBe("stale");
  expect(describePrice({ error: "HTTP 500", checkedAt: NOW }, "csfloat", NOW).state).toBe("error");
});

test("best market is the one that pays more after fees", () => {
  const prices = {
    "AK-47 | Redline (Field-Tested)": {
      youpin: { priceUsd: 9.95, at: NOW }, // 0.5% fee → 9.90
      csfloat: { priceUsd: 10.12, at: NOW }, // 2% fee → 9.92
    },
  };
  const { best } = sellPricesFor(prices, { itemName: "AK-47 | Redline (Field-Tested)" }, NOW);
  expect(best).toBe("csfloat");
});

test("no best pick with only one fresh price", () => {
  const prices = { X: { youpin: { priceUsd: 5, at: NOW }, csfloat: { priceUsd: 9, at: 0 } } };
  expect(sellPricesFor(prices, { itemName: "X" }, NOW).best).toBe(null);
});

test("Doppler phase comes from the name or the paint index", () => {
  expect(sellPriceKey({ itemName: "★ Karambit | Doppler Phase 2 (Factory New)" }))
    .toBe("★ Karambit | Doppler (Factory New)|Phase 2");
  expect(sellPriceKey({ itemName: "★ Bayonet | Gamma Doppler Emerald (Minimal Wear)" }))
    .toBe("★ Bayonet | Gamma Doppler (Minimal Wear)|Emerald");
  expect(sellPriceKey({ itemName: "★ Karambit | Doppler (Factory New)", paintIndex: 415 }))
    .toBe("★ Karambit | Doppler (Factory New)|Ruby");
  expect(sellPriceKey({ itemName: "★ Karambit | Doppler (Factory New)" })).toBe("★ Karambit | Doppler (Factory New)");
  expect(sellPriceKey({ itemName: "AK-47 | Redline (Field-Tested)", paintIndex: 415 })).toBe("AK-47 | Redline (Field-Tested)");
});

test("no best pick when one price is per phase and the other any phase", () => {
  const key = "★ Karambit | Doppler (Factory New)|Phase 2";
  const prices = { [key]: { youpin: { priceUsd: 500, at: NOW, anyPhase: true }, csfloat: { priceUsd: 700, at: NOW } } };
  const { rows, best } = sellPricesFor(prices, { itemName: "★ Karambit | Doppler Phase 2 (Factory New)" }, NOW);
  expect(best).toBe(null);
  expect(rows[0].anyPhase).toBe(true);
});
