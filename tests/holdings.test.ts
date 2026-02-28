import { describe, expect, it } from "vitest";
import { parseHoldingsText } from "@/lib/holdings";

describe("parseHoldingsText", () => {
  it("parses comma and space separated rows", () => {
    const parsed = parseHoldingsText("AAPL,50\nMSFT 25");
    expect(parsed).toEqual([
      { ticker: "AAPL", value: 50 },
      { ticker: "MSFT", value: 25 },
    ]);
  });

  it("drops invalid rows and non-positive rows when required", () => {
    const parsed = parseHoldingsText("AAPL -1\n$BAD 12\nNVDA 40", true);
    expect(parsed).toEqual([{ ticker: "NVDA", value: 40 }]);
  });
});
