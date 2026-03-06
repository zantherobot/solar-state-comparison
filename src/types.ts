/** Raw per-state input data from compiled_data.json */
export interface StateInput {
  name: string;
  /** Cost per watt in $/W (gross, before incentives) */
  cpw: number;
  /** Residential electricity rate in cents/kWh */
  rate: number;
  /** Capacity factor (fraction of 8760 hours) */
  cf: number;
  /** Daytime marginal emission rate in lbs CO2/MWh */
  me: number;
}

/** Calculated results for a state */
export interface StateResult extends StateInput {
  abbr: string;
  /** Total installed system cost in dollars */
  installedCost: number;
  /** Annual AC output in kWh */
  annualKwh: number;
  /** Lifetime kWh accounting for degradation */
  lifetimeKwh: number;
  /** Lifetime electricity cost savings in dollars */
  lifetimeSavings: number;
  /** Lifetime metric tons of CO2 avoided */
  lifetimeTons: number;
  /** Net cost: installedCost - lifetimeSavings */
  netCost: number;
  /** Net cost per metric ton of CO2 avoided ($/ton) */
  costPerTon: number;
  /** Simple payback period in years */
  paybackYears: number;
}

/** Sort options for the state ranking table */
export type SortKey =
  | "costPerTon"
  | "name"
  | "rate"
  | "me"
  | "lifetimeTons";

/** Compiled dataset structure from compiled_data.json */
export interface CompiledDataset {
  metadata: {
    description: string;
    compiled_at: string;
    sources: Record<string, string>;
    sources_from_api: Record<string, boolean>;
    units: Record<string, string>;
  };
  states: Record<string, StateInput>;
}
