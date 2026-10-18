import { ConsolidatedDigest, StoreDigest } from "./daily-digest.builder";
import { formatConsolidatedDaily, formatStoreDaily } from "./message-formatter";

const store = (over: Partial<StoreDigest> = {}): StoreDigest => ({
  storeid: 1, location: "Main Store", sales: 10000, bills: 20, prevsales: 8000, returns: 0,
  topproducts: [], closedshifts: 2, openshifts: 0, ...over,
});

describe("daily digest formatter", () => {
  it("shows sales, bill count, average and day-over-day change", () => {
    const msg = formatStoreDaily(store(), "2026-10-04");
    expect(msg).toContain("Main Store");
    expect(msg).toContain("₹10,000");
    expect(msg).toContain("avg ₹500");
    expect(msg).toContain("▲ 25.0%");
  });

  it("handles a zero-sales day without dividing by zero", () => {
    const msg = formatStoreDaily(store({ sales: 0, bills: 0, prevsales: 0 }), "2026-10-04");
    expect(msg).toContain("Bills: 0");
    expect(msg).not.toContain("avg");
    expect(msg).not.toContain("NaN");
  });

  it("escapes HTML in store and product names", () => {
    const msg = formatStoreDaily(
      store({ location: "A&B <Store>", topproducts: [{ name: "Cream <5%>", qty: 3 }] }),
      "2026-10-04",
    );
    expect(msg).toContain("A&amp;B &lt;Store&gt;");
    expect(msg).toContain("Cream &lt;5%&gt;");
  });

  it("flags shifts that are still open", () => {
    expect(formatStoreDaily(store({ openshifts: 1 }), "2026-10-04")).toContain("Shifts still open: 1");
    expect(formatStoreDaily(store(), "2026-10-04")).not.toContain("still open");
  });

  it("never includes cash or margin figures", () => {
    const data: ConsolidatedDigest = {
      stores: [store(), store({ storeid: 2, location: "East", sales: 0, bills: 0, prevsales: 0 })],
      purchases: 5000, purchaseinvoices: 2, pendingapprovals: 1, overdueinvoices: 3,
    };
    const text = formatStoreDaily(store(), "2026-10-04") + formatConsolidatedDaily(data, "2026-10-04");
    expect(text).not.toMatch(/cash|margin|balance|deposit|expense|variance/i);
  });

  it("consolidated lists only selling stores and counts the rest", () => {
    const data: ConsolidatedDigest = {
      stores: [store(), store({ storeid: 2, location: "East", sales: 0, bills: 0, prevsales: 0 })],
      purchases: 0, purchaseinvoices: 0, pendingapprovals: 0, overdueinvoices: 0,
    };
    const msg = formatConsolidatedDaily(data, "2026-10-04");
    expect(msg).toContain("Main Store: ₹10,000");
    expect(msg).not.toContain("East:");
    expect(msg).toContain("1 store(s) with no sales");
  });
});
