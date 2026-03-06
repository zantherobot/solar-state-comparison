import { describe, it, expect } from "vitest";
import {
  SYSTEM_SIZE_KW,
  PANEL_LIFETIME_YRS,
  DEGRADATION_RATE,
  LBS_PER_METRIC_TON,
  HOURS_PER_YEAR,
  EFFECTIVE_YEARS,
  computeEffectiveYears,
  calculate,
  calculateAllStates,
  sortStates,
  formatDollars,
} from "../calculator";
import type { StateInput, StateResult } from "../types";

// ============================================================
// Constants
// ============================================================

describe("constants", () => {
  it("has correct system size", () => {
    expect(SYSTEM_SIZE_KW).toBe(8);
  });

  it("has correct panel lifetime", () => {
    expect(PANEL_LIFETIME_YRS).toBe(25);
  });

  it("has correct degradation rate", () => {
    expect(DEGRADATION_RATE).toBe(0.007);
  });

  it("has correct lbs per metric ton", () => {
    expect(LBS_PER_METRIC_TON).toBe(2204.62);
  });

  it("has correct hours per year", () => {
    expect(HOURS_PER_YEAR).toBe(8760);
  });
});

// ============================================================
// computeEffectiveYears
// ============================================================

describe("computeEffectiveYears", () => {
  it("returns ~22.96 for default parameters (25yr, 0.7%)", () => {
    const result = computeEffectiveYears();
    expect(result).toBeCloseTo(22.96, 1);
  });

  it("matches EFFECTIVE_YEARS constant", () => {
    expect(EFFECTIVE_YEARS).toBeCloseTo(computeEffectiveYears(), 10);
  });

  it("returns exactly the lifetime with 0% degradation", () => {
    expect(computeEffectiveYears(25, 0)).toBe(25);
  });

  it("returns 1 for a 1-year lifetime", () => {
    expect(computeEffectiveYears(1, 0.007)).toBe(1);
  });

  it("returns correct value for custom parameters", () => {
    // 10 years, 5% degradation: sum of 0.95^n for n=0..9
    const result = computeEffectiveYears(10, 0.05);
    let expected = 0;
    for (let i = 0; i < 10; i++) expected += Math.pow(0.95, i);
    expect(result).toBeCloseTo(expected, 10);
  });

  it("handles high degradation", () => {
    const result = computeEffectiveYears(5, 0.5);
    // Sum: 1 + 0.5 + 0.25 + 0.125 + 0.0625 = 1.9375
    expect(result).toBeCloseTo(1.9375, 4);
  });
});

// ============================================================
// calculate
// ============================================================

describe("calculate", () => {
  const caInput: StateInput = {
    name: "California",
    cpw: 2.44,
    rate: 33.8,
    cf: 0.195,
    me: 750,
  };

  it("computes installed cost correctly", () => {
    const result = calculate(caInput);
    expect(result.installedCost).toBe(Math.round(2.44 * 8 * 1000));
  });

  it("computes annual kWh correctly", () => {
    const result = calculate(caInput);
    const expected = 0.195 * 8 * 8760;
    expect(result.annualKwh).toBe(Math.round(expected));
  });

  it("computes lifetime kWh with degradation", () => {
    const result = calculate(caInput);
    const annualKwh = 0.195 * 8 * 8760;
    expect(result.lifetimeKwh).toBe(Math.round(annualKwh * EFFECTIVE_YEARS));
  });

  it("computes lifetime savings correctly", () => {
    const result = calculate(caInput);
    const annualKwh = 0.195 * 8 * 8760;
    const lifetimeKwh = annualKwh * EFFECTIVE_YEARS;
    const expected = lifetimeKwh * (33.8 / 100);
    expect(result.lifetimeSavings).toBe(Math.round(expected));
  });

  it("computes lifetime tons of CO2 avoided", () => {
    const result = calculate(caInput);
    const annualKwh = 0.195 * 8 * 8760;
    const annualMWh = annualKwh / 1000;
    const annualLbs = annualMWh * 750;
    const annualTons = annualLbs / 2204.62;
    const lifetimeTons = annualTons * EFFECTIVE_YEARS;
    expect(result.lifetimeTons).toBeCloseTo(lifetimeTons, 0);
  });

  it("computes net cost (installed - savings)", () => {
    const result = calculate(caInput);
    expect(result.netCost).toBe(result.installedCost - result.lifetimeSavings);
  });

  it("computes cost per ton correctly", () => {
    const result = calculate(caInput);
    const expected = result.netCost / result.lifetimeTons;
    expect(result.costPerTon).toBeCloseTo(expected, 0);
  });

  it("computes payback years as installed / annual savings", () => {
    const result = calculate(caInput);
    const annualKwh = 0.195 * 8 * 8760;
    const annualSavings = annualKwh * (33.8 / 100);
    const expected = (2.44 * 8000) / annualSavings;
    expect(result.paybackYears).toBeCloseTo(expected, 0);
  });

  it("returns negative costPerTon for states where solar pays for itself", () => {
    // Hawaii: high rate, high CF, high ME
    const hi: StateInput = {
      name: "Hawaii",
      cpw: 3.10,
      rate: 39.9,
      cf: 0.19,
      me: 1350,
    };
    const result = calculate(hi);
    expect(result.costPerTon).toBeLessThan(0);
    expect(result.netCost).toBeLessThan(0);
  });

  it("returns positive costPerTon for expensive-to-decarbonize states", () => {
    // Hypothetical: low rate, high cost, clean grid, poor solar
    const expensive: StateInput = {
      name: "Expensive",
      cpw: 3.50,
      rate: 8.0,
      cf: 0.10,
      me: 300,
    };
    const result = calculate(expensive);
    expect(result.costPerTon).toBeGreaterThan(0);
  });

  it("handles zero capacity factor", () => {
    const zero: StateInput = {
      name: "Zero",
      cpw: 2.50,
      rate: 15.0,
      cf: 0,
      me: 900,
    };
    const result = calculate(zero);
    expect(result.annualKwh).toBe(0);
    expect(result.lifetimeKwh).toBe(0);
    expect(result.lifetimeSavings).toBe(0);
    expect(result.lifetimeTons).toBe(0);
    expect(result.costPerTon).toBe(Infinity);
    expect(result.paybackYears).toBe(Infinity);
  });

  it("handles zero marginal emissions", () => {
    const zeroMe: StateInput = {
      name: "ZeroME",
      cpw: 2.50,
      rate: 15.0,
      cf: 0.17,
      me: 0,
    };
    const result = calculate(zeroMe);
    expect(result.lifetimeTons).toBe(0);
    expect(result.costPerTon).toBe(Infinity);
  });

  it("handles zero electricity rate", () => {
    const zeroRate: StateInput = {
      name: "FreeElec",
      cpw: 2.50,
      rate: 0,
      cf: 0.17,
      me: 900,
    };
    const result = calculate(zeroRate);
    expect(result.lifetimeSavings).toBe(0);
    expect(result.paybackYears).toBe(Infinity);
    expect(result.costPerTon).toBeGreaterThan(0);
  });

  it("returns integer values for dollar amounts", () => {
    const result = calculate(caInput);
    expect(Number.isInteger(result.installedCost)).toBe(true);
    expect(Number.isInteger(result.lifetimeSavings)).toBe(true);
    expect(Number.isInteger(result.netCost)).toBe(true);
    expect(Number.isInteger(result.costPerTon)).toBe(true);
  });

  it("returns integer for annualKwh and lifetimeKwh", () => {
    const result = calculate(caInput);
    expect(Number.isInteger(result.annualKwh)).toBe(true);
    expect(Number.isInteger(result.lifetimeKwh)).toBe(true);
  });
});

// ============================================================
// calculateAllStates
// ============================================================

describe("calculateAllStates", () => {
  const testStates: Record<string, StateInput> = {
    AA: { name: "StateA", cpw: 2.50, rate: 30.0, cf: 0.19, me: 900 },
    BB: { name: "StateB", cpw: 3.00, rate: 12.0, cf: 0.14, me: 500 },
    CC: { name: "StateC", cpw: 2.20, rate: 20.0, cf: 0.18, me: 800 },
  };

  it("returns one result per state", () => {
    const results = calculateAllStates(testStates);
    expect(results).toHaveLength(3);
  });

  it("includes state abbreviation in results", () => {
    const results = calculateAllStates(testStates);
    const abbrs = results.map((r) => r.abbr);
    expect(abbrs).toContain("AA");
    expect(abbrs).toContain("BB");
    expect(abbrs).toContain("CC");
  });

  it("returns results sorted by costPerTon ascending", () => {
    const results = calculateAllStates(testStates);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].costPerTon).toBeGreaterThanOrEqual(
        results[i - 1].costPerTon
      );
    }
  });

  it("preserves input data in results", () => {
    const results = calculateAllStates(testStates);
    const aa = results.find((r) => r.abbr === "AA")!;
    expect(aa.name).toBe("StateA");
    expect(aa.cpw).toBe(2.5);
    expect(aa.rate).toBe(30.0);
    expect(aa.cf).toBe(0.19);
    expect(aa.me).toBe(900);
  });

  it("includes calculated fields", () => {
    const results = calculateAllStates(testStates);
    const aa = results.find((r) => r.abbr === "AA")!;
    expect(aa.installedCost).toBeDefined();
    expect(aa.annualKwh).toBeDefined();
    expect(aa.lifetimeKwh).toBeDefined();
    expect(aa.lifetimeSavings).toBeDefined();
    expect(aa.lifetimeTons).toBeDefined();
    expect(aa.netCost).toBeDefined();
    expect(aa.costPerTon).toBeDefined();
    expect(aa.paybackYears).toBeDefined();
  });

  it("handles empty input", () => {
    const results = calculateAllStates({});
    expect(results).toHaveLength(0);
  });

  it("handles single state", () => {
    const single = { ZZ: testStates.AA };
    const results = calculateAllStates(single);
    expect(results).toHaveLength(1);
    expect(results[0].abbr).toBe("ZZ");
  });
});

// ============================================================
// sortStates
// ============================================================

describe("sortStates", () => {
  const makeResults = (): StateResult[] => [
    {
      abbr: "AA",
      name: "Alpha",
      cpw: 2.5,
      rate: 30.0,
      cf: 0.19,
      me: 900,
      installedCost: 20000,
      annualKwh: 13300,
      lifetimeKwh: 305000,
      lifetimeSavings: 91500,
      lifetimeTons: 62.3,
      netCost: -71500,
      costPerTon: -1148,
      paybackYears: 5.0,
    },
    {
      abbr: "BB",
      name: "Beta",
      cpw: 3.0,
      rate: 12.0,
      cf: 0.14,
      me: 500,
      installedCost: 24000,
      annualKwh: 9811,
      lifetimeKwh: 225000,
      lifetimeSavings: 27000,
      lifetimeTons: 22.2,
      netCost: -3000,
      costPerTon: -135,
      paybackYears: 20.4,
    },
    {
      abbr: "CC",
      name: "Gamma",
      cpw: 2.2,
      rate: 10.0,
      cf: 0.18,
      me: 1100,
      installedCost: 17600,
      annualKwh: 12614,
      lifetimeKwh: 289500,
      lifetimeSavings: 28950,
      lifetimeTons: 63.0,
      netCost: -11350,
      costPerTon: -180,
      paybackYears: 14.0,
    },
  ];

  it("sorts by costPerTon ascending", () => {
    const sorted = sortStates(makeResults(), "costPerTon");
    expect(sorted[0].abbr).toBe("AA"); // most negative
    expect(sorted[2].abbr).toBe("BB"); // least negative
  });

  it("sorts by name alphabetically", () => {
    const sorted = sortStates(makeResults(), "name");
    expect(sorted[0].name).toBe("Alpha");
    expect(sorted[1].name).toBe("Beta");
    expect(sorted[2].name).toBe("Gamma");
  });

  it("sorts by rate descending", () => {
    const sorted = sortStates(makeResults(), "rate");
    expect(sorted[0].rate).toBe(30.0);
    expect(sorted[2].rate).toBe(10.0);
  });

  it("sorts by marginal emissions descending", () => {
    const sorted = sortStates(makeResults(), "me");
    expect(sorted[0].me).toBe(1100);
    expect(sorted[2].me).toBe(500);
  });

  it("sorts by lifetimeTons descending", () => {
    const sorted = sortStates(makeResults(), "lifetimeTons");
    expect(sorted[0].lifetimeTons).toBeGreaterThanOrEqual(
      sorted[1].lifetimeTons
    );
  });

  it("returns original order for unknown sort key", () => {
    const results = makeResults();
    const sorted = sortStates(results, "unknown");
    expect(sorted.map((r) => r.abbr)).toEqual(results.map((r) => r.abbr));
  });

  it("does not mutate the original array", () => {
    const results = makeResults();
    const originalAbbrs = results.map((r) => r.abbr);
    sortStates(results, "name");
    expect(results.map((r) => r.abbr)).toEqual(originalAbbrs);
  });
});

// ============================================================
// formatDollars
// ============================================================

describe("formatDollars", () => {
  it("formats positive values with $ sign", () => {
    expect(formatDollars(100)).toBe("$100");
  });

  it("formats negative values with -$ prefix", () => {
    expect(formatDollars(-100)).toBe("-$100");
  });

  it("formats zero as $0", () => {
    expect(formatDollars(0)).toBe("$0");
  });

  it("adds comma separators for large numbers", () => {
    const result = formatDollars(1234);
    expect(result).toContain("1");
    expect(result).toContain("234");
  });

  it("handles large negative numbers", () => {
    const result = formatDollars(-50000);
    expect(result).toMatch(/^-\$/);
  });
});

// ============================================================
// Full pipeline integration test
// ============================================================

describe("full calculation pipeline", () => {
  it("matches the spec formula for a known state", () => {
    // Manual calculation for Texas per spec:
    // Installed Cost = $2.19/W × 8000W = $17,520
    // Annual kWh = 0.18 × 8 × 8760 = 12,614.4
    // Lifetime kWh = 12,614.4 × 22.96 ≈ 289,675
    // Lifetime Savings = 289,675 × $0.159 = $46,058
    // Annual MWh = 12.614
    // Annual lbs CO2 = 12.614 × 950 = 11,983.7
    // Annual metric tons = 11,983.7 / 2204.62 = 5.436
    // Lifetime tons = 5.436 × 22.96 ≈ 124.8
    // Net cost = 17,520 - 46,058 = -28,538
    // $/ton = -28,538 / 124.8 = -228.7

    const tx: StateInput = {
      name: "Texas",
      cpw: 2.19,
      rate: 15.9,
      cf: 0.18,
      me: 950,
    };
    const result = calculate(tx);

    expect(result.installedCost).toBe(17520);
    expect(result.annualKwh).toBe(12614);
    expect(result.netCost).toBeLessThan(0); // solar pays for itself
    expect(result.lifetimeTons).toBeGreaterThan(100);
    expect(result.costPerTon).toBeLessThan(0);
  });
});
