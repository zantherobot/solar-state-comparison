# Solar State Comparison — Development Guide

## Project Overview

Interactive tool ranking all 50 US states by the net cost to avoid one metric ton of CO₂ via residential rooftop solar. Built with Vite + React + TypeScript. Data is static (committed to repo); Python utility scripts exist for refreshing data from source APIs.

## Stack

- **Frontend:** React 19 + TypeScript, built with Vite
- **Server:** Express (serves static Vite build in production)
- **Testing:** Vitest + React Testing Library
- **Data:** Static JSON (`data/compiled_data.json`) — no runtime API calls
- **Deployment:** Railway (Nixpacks)

## Commands

```bash
npm run dev          # Start Vite dev server (port 5173)
npm run build        # Production build to dist/
npm run start        # Production server (port 3000)
npm test             # Run all tests once
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run lint         # TypeScript type-check (tsc --noEmit)
```

## Project Structure

```
src/
├── calculator.ts          # Core calculation logic (pure functions, no React)
├── types.ts               # TypeScript interfaces
├── data.ts                # Loads compiled_data.json
├── SolarCarbonCost.tsx    # Main React component (UI + visualization)
├── App.tsx                # App wrapper
├── main.tsx               # Entry point
└── test/
    ├── setup.ts           # Test setup (jest-dom matchers)
    ├── calculator.test.ts # Calculator unit tests
    └── SolarCarbonCost.test.tsx  # Component tests

data/
├── compiled_data.json     # Canonical dataset (committed, static)
├── compile_data.py        # Utility: merges source JSONs into compiled_data.json
├── fetch_eia_rates.py     # Utility: fetches EIA electricity rates
├── fetch_pvwatts.py       # Utility: fetches NREL PVWatts production data
├── fetch_energysage.py    # Utility: scrapes EnergySage cost data
└── process_cambium.py     # Utility: processes NREL Cambium workbooks
```

## Development Workflow

### Branch Strategy

- **`staging`** — default development branch. Push here triggers Railway auto-deploy to staging environment.
- **`main`** — production branch. Protected; changes only via PR from `staging`. Never push directly.
- Promote staging to production: `gh pr create --base main --head staging`

### Before Committing

1. All tests must pass: `npm test`
2. Type-check must pass: `npm run lint`
3. Build must succeed: `npm run build`

### Data Pipeline

The data in `data/compiled_data.json` is **static and canonical**. The Python scripts in `data/` are utilities for refreshing data from source APIs — they are NOT part of the runtime application.

To refresh data (requires API keys):
```bash
export NREL_API_KEY=your_key    # Free from developer.nrel.gov/signup
python data/fetch_eia_rates.py
python data/fetch_pvwatts.py
python data/fetch_energysage.py
python data/process_cambium.py  # Requires Cambium Excel workbooks
python data/compile_data.py     # Merges sources into compiled_data.json
```

### Key Design Decisions

1. **Marginal emissions, not average** — solar displaces the marginal generator
2. **Daytime hours only** — solar only produces during 6am–6pm
3. **No incentives** — gross cost shows raw economics without policy distortion
4. **Simple payback** — no NPV or LCOE; relative state ranking is stable either way
5. **Static data** — compiled_data.json is committed for consistency; no runtime API calls
6. **8 kW system, 25-year lifetime, 0.7%/yr degradation** — NREL standard assumptions

### Testing Requirements

- Minimum 95% code coverage (statements, functions, lines)
- Minimum 90% branch coverage
- Tests required for: calculation logic, data transformations, React component rendering and interactions
- Spec (`spec.md`) must stay in sync with implementation
