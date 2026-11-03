import { describePrice, sellPricesFor, SELL_PRICE_MAX_AGE_MS } from "./sellPrices";

const NOW = 1_800_000_000_000;

test("hides prices older than an hour", () => {
  const old = describePrice({ priceUsd: 10, at: NOW - SELL_PRICE_MAX_AGE_MS - 1 }, "csfloat", NOW);
  expect(old.state).toBe("stale");
  const fresh = describePrice({ priceUsd: 10, at: NOW - 5 * 60000 }, "csfloat", NOW);
  expect(fresh.state).toBe("ok");
  expect(fresh.net).toBeCloseTo(9.8);
});

test("nothing listed and never fetched are told apart", () => {
  expect(describePrice({ priceUsd: null, at: NOW }, "buff163", NOW).state).toBe("none");
  expect(describePrice(undefined, "buff163", NOW).state).toBe("stale");
  expect(describePrice({ error: "not found on Buff163", checkedAt: NOW }, "buff163", NOW).state).toBe("error");
});

test("best market is the one that pays more after fees", () => {
  const prices = {
    "AK-47 | Redline (Field-Tested)": {
      buff163: { priceUsd: 10.1, at: NOW }, // 1.5% fee → 9.95
      csfloat: { priceUsd: 10.12, at: NOW }, // 2% fee → 9.92
    },
  };
  const { best } = sellPricesFor(prices, "AK-47 | Redline (Field-Tested)", NOW);
  expect(best).toBe("buff163");
});

test("no best pick with only one fresh price", () => {
  const prices = { X: { buff163: { priceUsd: 5, at: NOW }, csfloat: { priceUsd: 9, at: 0 } } };
  expect(sellPricesFor(prices, "X", NOW).best).toBe(null);
});
