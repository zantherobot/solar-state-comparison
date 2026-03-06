import { useState, useMemo } from "react";
import { stateData, metadata } from "./data";
import { calculate, calculateAllStates, sortStates, formatDollars } from "./calculator";
import type { SortKey } from "./types";

function Bar({ value, maxAbs }: { value: number; maxAbs: number }) {
  const isNegative = value < 0;
  const pct = Math.min((Math.abs(value) / maxAbs) * 100, 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
      <div
        style={{
          width: "60%",
          height: 20,
          background: "#1a1a2e",
          borderRadius: 4,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          data-testid="bar-fill"
          style={{
            width: `${pct}%`,
            height: "100%",
            background: isNegative
              ? "linear-gradient(90deg, #10b981, #34d399)"
              : "linear-gradient(90deg, #f59e0b, #ef4444)",
            borderRadius: 4,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: isNegative ? "#10b981" : "#f5f5f5",
          minWidth: 70,
          textAlign: "right",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        }}
      >
        {formatDollars(value)}/t
      </span>
    </div>
  );
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "costPerTon", label: "$/Ton CO\u2082" },
  { key: "name", label: "State Name" },
  { key: "rate", label: "Elec Rate" },
  { key: "me", label: "Marginal Emissions" },
  { key: "lifetimeTons", label: "Tons Avoided" },
];

export default function SolarCarbonCost() {
  const [sortBy, setSortBy] = useState<SortKey>("costPerTon");
  const [showMethodology, setShowMethodology] = useState(false);

  const results = useMemo(() => calculateAllStates(stateData), []);

  const sorted = useMemo(() => sortStates(results, sortBy), [results, sortBy]);

  const maxAbs = useMemo(
    () => Math.max(...results.map((r) => Math.abs(r.costPerTon))),
    [results]
  );

  const negativeCount = results.filter((r) => r.costPerTon < 0).length;
  const bestState = sorted[0];
  const worstState = sorted[sorted.length - 1];

  return (
    <div
      style={{
        fontFamily: "'Inter', 'Segoe UI', -apple-system, sans-serif",
        background: "#0d0d1a",
        color: "#e5e5e5",
        minHeight: "100vh",
        padding: "24px 16px",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "#f59e0b",
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            Residential Solar Analysis
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              margin: 0,
              lineHeight: 1.2,
              color: "#fff",
            }}
          >
            Cost to Avoid One Ton of CO&#x2082;
          </h1>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 400,
              margin: "8px 0 0",
              color: "#999",
              lineHeight: 1.5,
            }}
          >
            Net cost per metric ton of carbon avoided via residential solar, by
            state. Negative values = solar pays for itself <em>and</em> reduces
            emissions.
          </h2>
        </div>

        {/* Key Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {[
            {
              label: "Best State",
              value: bestState.name,
              sub: `${formatDollars(bestState.costPerTon)}/ton`,
            },
            {
              label: "Worst State",
              value: worstState.name,
              sub: `${formatDollars(worstState.costPerTon)}/ton`,
            },
            {
              label: "States Where Solar Pays You",
              value: `${negativeCount} of ${results.length}`,
              sub: "Negative $/ton",
            },
            {
              label: "No Incentives",
              value: "Gross cost",
              sub: "Pre-ITC, pre-rebate",
            },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                background: "#141428",
                borderRadius: 8,
                padding: "14px 16px",
                border: "1px solid #222244",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: "#888",
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  marginBottom: 4,
                }}
              >
                {s.label}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
                {s.value}
              </div>
              <div style={{ fontSize: 12, color: "#f59e0b", marginTop: 2 }}>
                {s.sub}
              </div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 16,
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 12, color: "#888", marginRight: 4 }}>
            Sort by:
          </span>
          {SORT_OPTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSortBy(s.key)}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border:
                  sortBy === s.key
                    ? "1px solid #f59e0b"
                    : "1px solid #333",
                background: sortBy === s.key ? "#f59e0b22" : "transparent",
                color: sortBy === s.key ? "#f59e0b" : "#999",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: sortBy === s.key ? 600 : 400,
              }}
            >
              {s.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setShowMethodology(!showMethodology)}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: "1px solid #444",
              background: "transparent",
              color: "#aaa",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {showMethodology ? "Hide" : "Show"} Methodology
          </button>
        </div>

        {/* Methodology Panel */}
        {showMethodology && (
          <div
            data-testid="methodology-panel"
            style={{
              background: "#141428",
              border: "1px solid #222244",
              borderRadius: 8,
              padding: 20,
              marginBottom: 20,
              fontSize: 13,
              lineHeight: 1.7,
              color: "#bbb",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                color: "#fff",
                marginBottom: 8,
                fontSize: 14,
              }}
            >
              Methodology
            </div>
            <p style={{ margin: "0 0 10px" }}>
              <strong style={{ color: "#f59e0b" }}>Formula:</strong> (Installed
              Cost &#x2212; Lifetime Electricity Savings) &#xf7; Lifetime
              CO&#x2082; Avoided = Net $/ton
            </p>
            <p style={{ margin: "0 0 10px" }}>
              <strong style={{ color: "#ddd" }}>Installed Cost:</strong>{" "}
              EnergySage marketplace $/W &#xd7; 8,000W. Gross cost, no
              incentives.
            </p>
            <p style={{ margin: "0 0 10px" }}>
              <strong style={{ color: "#ddd" }}>Electricity Savings:</strong>{" "}
              Annual kWh &#xd7; state residential rate (EIA Dec 2025) &#xd7; 25
              years, with 0.7%/yr panel degradation.
            </p>
            <p style={{ margin: "0 0 10px" }}>
              <strong style={{ color: "#ddd" }}>CO&#x2082; Avoided:</strong>{" "}
              Annual kWh &#xf7; 1000 &#xd7; daytime marginal emission rate
              (NREL Cambium 2024, lbs CO&#x2082;/MWh) &#xf7; 2204.62 = metric
              tons/yr, summed over 25 years with degradation.
            </p>
            <p style={{ margin: "0 0 10px" }}>
              <strong style={{ color: "#ddd" }}>Marginal Emissions:</strong>{" "}
              Daytime (6am&#x2013;6pm) long-run marginal emission rates from
              NREL Cambium Mid-case scenario, mapped from 18 GEA regions to
              states.
            </p>
            <p style={{ margin: 0, color: "#888", fontSize: 12 }}>
              Sources: EnergySage (2025&#x2013;2026), EIA Electric Power Monthly
              (Dec 2025), NREL Cambium 2024 LRMER Workbooks, NREL PVWatts/ATB
              capacity factors.
              {metadata?.compiled_at && (
                <span>
                  {" "}
                  Data compiled:{" "}
                  {new Date(metadata.compiled_at).toLocaleDateString()}.
                </span>
              )}
            </p>
          </div>
        )}

        {/* Table */}
        <div
          style={{
            borderRadius: 8,
            overflow: "hidden",
            border: "1px solid #222244",
          }}
        >
          {/* Header Row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "120px 70px 70px 80px 1fr",
              padding: "10px 16px",
              background: "#141428",
              borderBottom: "1px solid #222244",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              color: "#888",
              fontWeight: 600,
            }}
          >
            <div>State</div>
            <div style={{ textAlign: "right" }}>Rate</div>
            <div style={{ textAlign: "right" }}>Marginal</div>
            <div style={{ textAlign: "right" }}>Tons</div>
            <div style={{ paddingLeft: 12 }}>Net Cost / Ton CO&#x2082;</div>
          </div>

          {/* Data Rows */}
          {sorted.map((r, i) => (
            <div
              key={r.abbr}
              data-testid={`state-row-${r.abbr}`}
              style={{
                display: "grid",
                gridTemplateColumns: "120px 70px 70px 80px 1fr",
                padding: "8px 16px",
                alignItems: "center",
                background: i % 2 === 0 ? "#0d0d1a" : "#111126",
                borderBottom: "1px solid #1a1a33",
                transition: "background 0.15s",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#f59e0b",
                    background: "#f59e0b15",
                    padding: "2px 6px",
                    borderRadius: 4,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {r.abbr}
                </span>
                <span style={{ fontSize: 13, color: "#ddd" }}>{r.name}</span>
              </div>
              <div
                style={{
                  textAlign: "right",
                  fontSize: 12,
                  color: r.rate > 25 ? "#f59e0b" : "#999",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {r.rate}&#xa2;
              </div>
              <div
                style={{
                  textAlign: "right",
                  fontSize: 12,
                  color:
                    r.me > 1000
                      ? "#ef4444"
                      : r.me < 500
                        ? "#10b981"
                        : "#999",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {r.me}
              </div>
              <div
                style={{
                  textAlign: "right",
                  fontSize: 12,
                  color: "#999",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {r.lifetimeTons}t
              </div>
              <div style={{ paddingLeft: 12 }}>
                <Bar value={r.costPerTon} maxAbs={maxAbs} />
              </div>
            </div>
          ))}
        </div>

        {/* Insight Panel */}
        <div
          style={{
            marginTop: 24,
            background: "#141428",
            border: "1px solid #222244",
            borderRadius: 8,
            padding: 20,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              color: "#fff",
              marginBottom: 12,
              fontSize: 14,
            }}
          >
            Key Insights
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              fontSize: 13,
              lineHeight: 1.7,
              color: "#bbb",
            }}
          >
            <div>
              <div
                style={{
                  color: "#10b981",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Best for carbon bang-per-buck
              </div>
              States with high electricity rates, good solar resource, AND dirty
              marginal generators dominate. High rates mean solar pays for itself
              faster, effectively giving you <em>free</em> carbon reduction
              &#x2014; or better.
            </div>
            <div>
              <div
                style={{
                  color: "#ef4444",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Worst for carbon bang-per-buck
              </div>
              States with low electricity rates, poor solar resource, or clean
              marginal generators (hydro/nuclear regions) have the highest cost
              per ton avoided.
            </div>
            <div>
              <div
                style={{
                  color: "#f59e0b",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Why marginal emissions matter
              </div>
              A state like West Virginia has very high marginal emissions (coal
              on the margin), meaning each kWh of solar displaces more
              CO&#x2082;. But low electricity rates there mean the financial
              payback is poor, pushing $/ton up.
            </div>
            <div>
              <div
                style={{
                  color: "#a78bfa",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Negative $/ton = double win
              </div>
              When $/ton is negative, solar more than pays for itself over 25
              years. You&#x2019;re effectively being <em>paid</em> to reduce
              carbon &#x2014; the electricity savings exceed the system cost.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 20,
            fontSize: 11,
            color: "#555",
            lineHeight: 1.6,
            textAlign: "center",
          }}
        >
          Data: EnergySage (2025&#x2013;2026) &#xb7; EIA Electric Power Monthly
          (Dec 2025) &#xb7; NREL Cambium 2024 &#xb7; NREL PVWatts/ATB
          <br />8 kW system &#xb7; 25-year lifetime &#xb7; 0.7%/yr degradation
          &#xb7; No incentives &#xb7; Simple payback method
        </div>
      </div>
    </div>
  );
}
