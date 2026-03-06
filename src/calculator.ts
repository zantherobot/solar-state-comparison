import type { StateInput, StateResult, SortKey } from "./types";

// System assumptions per spec
export const SYSTEM_SIZE_KW = 8;
export const PANEL_LIFETIME_YRS = 25;
export const DEGRADATION_RATE = 0.007;
export const LBS_PER_METRIC_TON = 2204.62;
export const HOURS_PER_YEAR = 8760;

/**
 * Effective production years accounting for 0.7%/yr degradation over 25 years.
 * Sum of (1 - 0.007)^n for n=0..24 ≈ 22.96
 */
export function computeEffectiveYears(
  lifetimeYrs: number = PANEL_LIFETIME_YRS,
  degradation: number = DEGRADATION_RATE
): number {
  let total = 0;
  for (let i = 0; i < lifetimeYrs; i++) {
    total += Math.pow(1 - degradation, i);
  }
  return total;
}

export const EFFECTIVE_YEARS = computeEffectiveYears();

/**
 * Calculate all derived values for a state.
 *
 * Formula (per spec):
 *   Net $/ton CO₂ = (Installed Cost − Lifetime Electricity Savings) / Lifetime CO₂ Avoided
 *
 * Where:
 *   Installed Cost = cpw × system_size_watts
 *   Lifetime Electricity Savings = annual_kwh × rate × effective_years
 *   Lifetime CO₂ Avoided = (annual_kwh / 1000) × marginal_emissions × effective_years / 2204.62
 */
export function calculate(d: StateInput): Omit<StateResult, "abbr" | keyof StateInput> {
  const installedCost = d.cpw * SYSTEM_SIZE_KW * 1000;
  const annualKwh = d.cf * SYSTEM_SIZE_KW * HOURS_PER_YEAR;
  const lifetimeKwh = annualKwh * EFFECTIVE_YEARS;
  const lifetimeSavings = lifetimeKwh * (d.rate / 100);
  const annualMWh = annualKwh / 1000;
  const annualLbsCO2 = annualMWh * d.me;
  const annualMetricTons = annualLbsCO2 / LBS_PER_METRIC_TON;
  const lifetimeTons = annualMetricTons * EFFECTIVE_YEARS;
  const netCost = installedCost - lifetimeSavings;
  const costPerTon = lifetimeTons > 0 ? netCost / lifetimeTons : Infinity;

  // Simple payback: installed cost / annual savings
  const annualSavings = annualKwh * (d.rate / 100);
  const paybackYears =
    annualSavings > 0 ? installedCost / annualSavings : Infinity;

  return {
    installedCost: Math.round(installedCost),
    annualKwh: Math.round(annualKwh),
    lifetimeKwh: Math.round(lifetimeKwh),
    lifetimeSavings: Math.round(lifetimeSavings),
    lifetimeTons: parseFloat(lifetimeTons.toFixed(1)),
    netCost: Math.round(netCost),
    costPerTon: parseFloat(costPerTon.toFixed(0)),
    paybackYears: parseFloat(paybackYears.toFixed(1)),
  };
}

/**
 * Process all states from the compiled dataset.
 * Returns an array of StateResult sorted by costPerTon (ascending).
 */
export function calculateAllStates(
  states: Record<string, StateInput>
): StateResult[] {
  return Object.entries(states)
    .map(([abbr, d]) => ({
      abbr,
      ...d,
      ...calculate(d),
    }))
    .sort((a, b) => a.costPerTon - b.costPerTon);
}

/**
 * Sort state results by the given key.
 */
export function sortStates(
  results: StateResult[],
  sortBy: SortKey
): StateResult[] {
  const arr = [...results];
  arr.sort((a, b) => {
    if (sortBy === "costPerTon") return a.costPerTon - b.costPerTon;
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "rate") return b.rate - a.rate;
    if (sortBy === "me") return b.me - a.me;
    if (sortBy === "lifetimeTons") return b.lifetimeTons - a.lifetimeTons;
    return 0;
  });
  return arr;
}

/**
 * Format a number as dollars with commas. Negative values show as -$X,XXX.
 */
export function formatDollars(n: number): string {
  if (n < 0) return "-$" + Math.abs(n).toLocaleString("en-US");
  return "$" + n.toLocaleString("en-US");
}
