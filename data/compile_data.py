#!/usr/bin/env python3
"""
Compile all data sources into a single compiled_data.json for the React frontend.

Reads from:
  - eia_rates.json (electricity rates)
  - pvwatts_production.json (solar production / capacity factors)
  - energysage_costs.json (installed cost per watt)
  - cambium_emissions.json (daytime marginal emissions)

If any source file is missing, uses built-in fallback data.
Output: compiled_data.json — ready for import by the React frontend.

Usage:
  python compile_data.py           # Merge available source files
  python compile_data.py --fresh   # Ignore cached files, use all fallbacks
"""

import json
import os
import sys
import time

DATA_DIR = os.path.dirname(os.path.abspath(__file__))

STATE_NAMES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
    "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota",
    "MS": "Mississippi", "MO": "Missouri", "MT": "Montana", "NE": "Nebraska",
    "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
    "NM": "New Mexico", "NY": "New York", "NC": "North Carolina",
    "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma", "OR": "Oregon",
    "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington",
    "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
}

STATES = sorted(STATE_NAMES.keys())


def load_json(filename):
    """Load a JSON file from the data directory, or return None."""
    path = os.path.join(DATA_DIR, filename)
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return None


def get_rates(use_fresh=False):
    """Load electricity rates. Returns dict of state -> cents/kWh."""
    if not use_fresh:
        data = load_json("eia_rates.json")
        if data and "rates" in data:
            print(f"  EIA rates: loaded from eia_rates.json ({len(data['rates'])} states)")
            return data["rates"]

    # Import fallback from fetch script
    print("  EIA rates: using built-in fallback data")
    from fetch_eia_rates import get_fallback_rates
    return get_fallback_rates()


def get_production(use_fresh=False):
    """Load solar production. Returns dict of state -> capacity_factor."""
    if not use_fresh:
        data = load_json("pvwatts_production.json")
        if data and "production" in data:
            cfs = {}
            for st, info in data["production"].items():
                cfs[st] = info["capacity_factor"]
            print(f"  PVWatts: loaded from pvwatts_production.json ({len(cfs)} states)")
            return cfs

    print("  PVWatts: using built-in fallback data")
    from fetch_pvwatts import get_fallback_production
    return get_fallback_production()


def get_costs(use_fresh=False):
    """Load installed costs. Returns dict of state -> $/W."""
    if not use_fresh:
        data = load_json("energysage_costs.json")
        if data and "costs" in data:
            print(f"  EnergySage costs: loaded from energysage_costs.json ({len(data['costs'])} states)")
            return data["costs"]

    print("  EnergySage costs: using built-in fallback data")
    from fetch_energysage import get_fallback_costs
    return get_fallback_costs()


def get_emissions(use_fresh=False):
    """Load marginal emissions. Returns dict of state -> lbs CO2/MWh."""
    if not use_fresh:
        data = load_json("cambium_emissions.json")
        if data and "emissions" in data:
            print(f"  Cambium emissions: loaded from cambium_emissions.json ({len(data['emissions'])} states)")
            return data["emissions"]

    print("  Cambium emissions: using built-in fallback data")
    from process_cambium import get_fallback_emissions
    return get_fallback_emissions()


def compile_dataset(use_fresh=False):
    """Merge all sources into a single dataset."""
    print("Loading data sources...")
    rates = get_rates(use_fresh)
    production = get_production(use_fresh)
    costs = get_costs(use_fresh)
    emissions = get_emissions(use_fresh)

    print(f"\nCompiling dataset for {len(STATES)} states...")

    states = {}
    for st in STATES:
        states[st] = {
            "name": STATE_NAMES[st],
            "cpw": costs.get(st, 2.58),       # $/W
            "rate": rates.get(st, 17.2),       # cents/kWh
            "cf": production.get(st, 0.160),   # capacity factor
            "me": emissions.get(st, 900),      # lbs CO2/MWh
        }

    return states


def main():
    use_fresh = "--fresh" in sys.argv

    if use_fresh:
        print("Running in --fresh mode (ignoring cached source files)\n")

    states = compile_dataset(use_fresh)

    # Track which sources were from files vs fallback
    sources_used = {
        "eia_rates": os.path.exists(os.path.join(DATA_DIR, "eia_rates.json")) and not use_fresh,
        "pvwatts": os.path.exists(os.path.join(DATA_DIR, "pvwatts_production.json")) and not use_fresh,
        "energysage": os.path.exists(os.path.join(DATA_DIR, "energysage_costs.json")) and not use_fresh,
        "cambium": os.path.exists(os.path.join(DATA_DIR, "cambium_emissions.json")) and not use_fresh,
    }

    output = {
        "metadata": {
            "description": "Compiled solar carbon cost data for all 50 US states",
            "compiled_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "sources": {
                "cost_per_watt": "EnergySage marketplace data (2025-2026)",
                "electricity_rate": "EIA Electric Power Monthly, Dec 2025",
                "capacity_factor": "NREL PVWatts API v8 (8kW, 20° tilt, south-facing)",
                "marginal_emissions": "NREL Cambium 2024 LRMER, Mid-case, 2026, daytime avg",
            },
            "sources_from_api": sources_used,
            "units": {
                "cpw": "$/W (gross, before incentives)",
                "rate": "cents/kWh (residential average)",
                "cf": "capacity factor (fraction of 8760 hours)",
                "me": "lbs CO2/MWh (daytime marginal)",
            },
        },
        "states": states,
    }

    output_path = os.path.join(DATA_DIR, "compiled_data.json")
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nSaved compiled dataset to {output_path}")
    print(f"States: {len(states)}")

    # Quick summary stats
    cpws = [s["cpw"] for s in states.values()]
    rates_list = [s["rate"] for s in states.values()]
    cfs = [s["cf"] for s in states.values()]
    mes = [s["me"] for s in states.values()]

    print(f"\nSummary:")
    print(f"  Cost/W:    ${min(cpws):.2f} – ${max(cpws):.2f}")
    print(f"  Elec rate: {min(rates_list):.1f}¢ – {max(rates_list):.1f}¢/kWh")
    print(f"  Cap factor: {min(cfs):.3f} – {max(cfs):.3f}")
    print(f"  Marginal:  {min(mes)} – {max(mes)} lbs CO2/MWh")


if __name__ == "__main__":
    main()
