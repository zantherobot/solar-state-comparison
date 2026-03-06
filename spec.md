# Solar Carbon Cost Calculator — Project Spec

## Goal

Build an interactive tool that ranks all 50 US states by the **net cost to avoid one metric ton of CO₂** via residential rooftop solar. This is a portfolio piece targeting clean energy employers.

## Formula

For each state:

```
Net $/ton CO₂ = (Installed Cost − Lifetime Electricity Savings) / Lifetime CO₂ Avoided
```

Where:

- **Installed Cost** = EnergySage gross $/W × system size (watts). No incentives (no ITC, no state rebates).
- **Lifetime Electricity Savings** = Annual kWh production × state residential electricity rate × effective years (accounting for degradation)
- **Lifetime CO₂ Avoided** = Annual kWh / 1000 × daytime marginal emission rate (lbs CO₂/MWh) / 2204.62 × effective years

**Negative values mean solar more than pays for itself** — the homeowner is effectively paid to decarbonize.

## Assumptions

| Parameter | Value | Source |
|---|---|---|
| System size | 8 kW DC | Standard residential |
| Panel lifetime | 25 years | Industry standard warranty |
| Degradation | 0.7%/yr | NREL standard |
| Effective years | ~22.96 | Sum of (1-0.007)^n for n=0..24 |
| Incentives | None | Gross cost only |
| Payback method | Simple (undiscounted) | No NPV, no LCOE |

## Data Sources (4 inputs per state)

### 1. Installed Cost ($/W) — EnergySage

- **What:** Gross installed cost per watt before any incentives, by state
- **Source:** EnergySage state pages at `https://www.energysage.com/local-data/solar-panel-cost/{state_abbr}/`
  - Example: `/ca/`, `/tx/`, `/ny/`
- **Current national average:** $2.58/W (2026)
- **Key values found:** CA $2.44/W, TX $2.19/W, CT $2.77/W
- **Approach:** Scrape or manually collect from each state's EnergySage page. Look for the "average cost per watt" figure. Not all 50 states may have data — for missing states, use regional averages or LBNL Tracking the Sun as fallback.

### 2. Electricity Rate (¢/kWh) — EIA

- **What:** Average residential electricity rate by state
- **Source:** EIA Electric Power Monthly, Table 5.6.a
  - URL: `https://www.eia.gov/electricity/monthly/epm_table_grapher.php?t=epmt_5_6_a`
  - Also: `https://www.eia.gov/electricity/sales_revenue_price/`
- **Latest data:** December 2025 (released Feb 24, 2026)
- **National average:** 17.24 ¢/kWh (residential)
- **Key values:** HI 39.9¢, CA 33.8¢, MA 31.5¢, ND 11.0¢, LA 12.4¢
- **Approach:** Download EIA table directly. All 50 states + DC are covered.

### 3. Solar Production (kWh/yr) — NREL PVWatts

- **What:** Annual kWh output for an 8 kW system in each state
- **Source:** NREL PVWatts API v8
  - API docs: `https://developer.nrel.gov/docs/solar/pvwatts/v8/`
  - Requires free API key from `https://developer.nrel.gov/signup/`
- **Parameters:**
  - `system_capacity`: 8 (kW)
  - `module_type`: 0 (standard)
  - `losses`: 14 (default %)
  - `array_type`: 1 (fixed roof mount)
  - `tilt`: 20
  - `azimuth`: 180 (south-facing)
  - Use each state's capital or largest city as representative location
- **Alternative:** Use NREL ATB capacity factors by resource class, but PVWatts per-city is more precise.
- **Output needed:** `ac_annual` (annual AC kWh) from the API response.

### 4. Daytime Marginal Emissions (lbs CO₂/MWh) — NREL Cambium

- **What:** Long-run marginal emission rate during solar production hours (roughly 6am–6pm)
- **Source:** NREL Cambium 2024 LRMER Workbooks
  - Download: `https://data.nrel.gov/submissions/289` (Cambium 2024)
  - Also: `https://scenarioviewer.nrel.gov/` (interactive viewer)
  - Documentation: `https://docs.nrel.gov/docs/fy25osti/93005.pdf`
- **Scenario:** Mid-case (reference)
- **Year:** 2026 (nearest available projection year)
- **Geography:** 18 GEA regions → must map to states using the ZIP/county lookup tab in the workbook
- **Key detail:** Use daytime hours only (hours when solar produces). The workbooks contain hourly data — filter to ~6am–6pm local time and average.
- **Units:** lbs CO₂ per MWh (marginal, not average grid intensity)
- **Why marginal:** Solar displaces whatever generator is on the margin during production hours. A hydro-heavy state (WA) may have gas on the margin during peak solar. A coal state (WV) may have coal on the margin. This is more accurate than average grid intensity for estimating solar's actual carbon impact.

## Architecture

```
project/
├── src/
│   ├── calculator.ts          # Core calculation logic (pure functions)
│   ├── types.ts               # TypeScript interfaces
│   ├── data.ts                # Loads compiled_data.json
│   ├── SolarCarbonCost.tsx    # Main React component (UI + visualization)
│   ├── App.tsx                # App wrapper
│   ├── main.tsx               # Entry point
│   └── test/
│       ├── setup.ts           # Test setup
│       ├── calculator.test.ts # Calculator unit tests
│       └── SolarCarbonCost.test.tsx  # Component tests
├── data/
│   ├── compiled_data.json     # Canonical dataset (committed, static)
│   ├── compile_data.py        # Utility: merge sources into compiled_data.json
│   ├── fetch_energysage.py    # Utility: scrape EnergySage $/W
│   ├── fetch_eia_rates.py     # Utility: download EIA rates
│   ├── fetch_pvwatts.py       # Utility: hit PVWatts API per state
│   └── process_cambium.py     # Utility: parse Cambium workbooks
├── server.ts                  # Express production server
├── index.html                 # Vite entry HTML
├── vite.config.ts             # Vite configuration
├── vitest.config.ts           # Vitest test configuration
├── railway.json               # Railway deployment config
├── CLAUDE.md                  # Development guide
├── spec.md                    # This file
├── package.json               # Dependencies and scripts
└── LICENSE
```

## Frontend Requirements

- Rank all 50 states by net $/ton CO₂ avoided
- Horizontal bar chart: green bars for negative (solar pays you), amber→red for positive
- Sortable by: $/ton, state name, electricity rate, marginal emissions, total tons avoided
- Show methodology panel (toggle)
- Display key stats: best state, worst state, count of negative-cost states
- For each state row: abbreviation, name, electricity rate, marginal emission rate, lifetime tons avoided, bar + $/ton value

## Key Design Decisions Already Made

1. **Marginal emissions, not average** — more accurate for solar displacement
2. **Daytime hours only** — solar only produces during the day, marginal mix differs by time of day
3. **EnergySage for costs** — marketplace data reflects real quotes, not modeled costs
4. **No incentives** — shows raw economics without policy distortion
5. **EIA for rates** — official government data, updated monthly
6. **Simple payback** — easiest to explain; relative state ranking unlikely to change much vs NPV
7. **25-year lifetime, 0.7%/yr degradation** — NREL standard
8. **Static data** — `compiled_data.json` is committed for consistency; Python scripts are utilities for data refresh only

## Stretch Goals

- Toggle: with/without 30% ITC (note: expired Dec 31, 2025 per OBBBA)
- Toggle: NPV vs simple payback (add discount rate slider)
- Show sensitivity: what if electricity rates rise 3%/yr?
- Map visualization (choropleth)
- Export data as CSV
- Compare to social cost of carbon (~$51/ton EPA, ~$190/ton updated)
