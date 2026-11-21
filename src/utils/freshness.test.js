import { freshnessRows } from "./freshness";

const NOW = 1_800_000_000_000;
const ext = { connected: true, lastSeen: NOW - 2 * 60 * 1000 };
const prices = { "AK-47 | Redline (Field-Tested)": { youpin: { priceUsd: 10, at: NOW - 60e3 }, csfloat: { priceUsd: 9, at: NOW - 3600e3 } } };

it("is ok when everything is fresh", () => {
  const f = freshnessRows({ extension: ext, sellPrices: { prices, status: {} }, saveStatus: "saved", now: NOW });
  expect(f.state).toBe("ok");
  expect(f.summary).toBe("All data live");
});

it("warns when the extension has been quiet for 15+ min", () => {
  const f = freshnessRows({ extension: { connected: true, lastSeen: NOW - 40 * 60e3 }, sellPrices: { prices, status: {} }, now: NOW });
  expect(f.state).toBe("warn");
  expect(f.summary).toMatch(/^Extension: Last seen 40 min ago/);
});

it("puts failures first", () => {
  const f = freshnessRows({
    extension: { connected: true, lastSeen: NOW - 40 * 60e3 },
    sellPrices: { prices, status: { csfloat: { ok: false, error: "429 paused until 15:40", at: NOW - 60e3 } } },
    now: NOW,
  });
  expect(f.state).toBe("bad");
  expect(f.summary).toBe("CSFloat prices: 429 paused until 15:40");
});

it("flags a failed save and treats unchecked prices as unknown", () => {
  const f = freshnessRows({ extension: ext, sellPrices: null, saveStatus: "failed", now: NOW });
  expect(f.rows.find((r) => r.id === "youpin").state).toBe("unknown");
  expect(f.summary).toBe("Portfolio: Not saved · retrying");
});
