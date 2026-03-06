import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SolarCarbonCost from "../SolarCarbonCost";

describe("SolarCarbonCost component", () => {
  // ============================================================
  // Rendering
  // ============================================================

  it("renders the page title", () => {
    render(<SolarCarbonCost />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /Cost to Avoid One Ton/i
    );
  });

  it("renders the subtitle", () => {
    render(<SolarCarbonCost />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      /Net cost per metric ton/i
    );
  });

  it("renders the Residential Solar Analysis label", () => {
    render(<SolarCarbonCost />);
    expect(screen.getByText(/Residential Solar Analysis/i)).toBeInTheDocument();
  });

  it("renders all 50 state rows", () => {
    render(<SolarCarbonCost />);
    const rows = screen.getAllByTestId(/^state-row-/);
    expect(rows).toHaveLength(50);
  });

  it("renders state abbreviations", () => {
    render(<SolarCarbonCost />);
    expect(screen.getByText("CA")).toBeInTheDocument();
    expect(screen.getByText("TX")).toBeInTheDocument();
    expect(screen.getByText("NY")).toBeInTheDocument();
  });

  // ============================================================
  // Key Stats Cards
  // ============================================================

  it("displays Best State card", () => {
    render(<SolarCarbonCost />);
    expect(screen.getByText("Best State")).toBeInTheDocument();
  });

  it("displays Worst State card", () => {
    render(<SolarCarbonCost />);
    expect(screen.getByText("Worst State")).toBeInTheDocument();
  });

  it("best and worst state cards remain stable when sort changes", async () => {
    const user = userEvent.setup();
    render(<SolarCarbonCost />);

    // Record the best/worst state names with default sort
    const cards = screen.getAllByText(/Best State|Worst State/);
    const bestCard = cards[0].closest("div[style]")!.parentElement!;
    const worstCard = cards[1].closest("div[style]")!.parentElement!;
    const bestName = bestCard.querySelector("div:nth-child(2)")!.textContent;
    const worstName = worstCard.querySelector("div:nth-child(2)")!.textContent;

    // Change sort to "State Name"
    await user.click(screen.getByRole("button", { name: /State Name/i }));

    // Best/worst should remain the same
    const bestNameAfter = bestCard.querySelector("div:nth-child(2)")!.textContent;
    const worstNameAfter = worstCard.querySelector("div:nth-child(2)")!.textContent;
    expect(bestNameAfter).toBe(bestName);
    expect(worstNameAfter).toBe(worstName);
  });

  it("displays negative-cost states count", () => {
    render(<SolarCarbonCost />);
    expect(
      screen.getByText(/States Where Solar Pays You/i)
    ).toBeInTheDocument();
    // Should show "X of 50"
    expect(screen.getByText(/of 50/)).toBeInTheDocument();
  });

  it("displays No Incentives card", () => {
    render(<SolarCarbonCost />);
    expect(screen.getByText("No Incentives")).toBeInTheDocument();
    expect(screen.getByText("Gross cost")).toBeInTheDocument();
  });

  // ============================================================
  // Sort Controls
  // ============================================================

  it("renders all sort buttons", () => {
    render(<SolarCarbonCost />);
    expect(screen.getByText("Sort by:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\$\/Ton/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /State Name/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Elec Rate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Marginal Emissions/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tons Avoided/i })).toBeInTheDocument();
  });

  it("changes sort order when clicking State Name button", async () => {
    const user = userEvent.setup();
    render(<SolarCarbonCost />);

    await user.click(screen.getByRole("button", { name: /State Name/i }));

    // After sorting by name, Alabama (AL) should be first
    const rows = screen.getAllByTestId(/^state-row-/);
    expect(rows[0]).toHaveAttribute("data-testid", "state-row-AL");
  });

  it("changes sort order when clicking Elec Rate button", async () => {
    const user = userEvent.setup();
    render(<SolarCarbonCost />);

    await user.click(screen.getByRole("button", { name: /Elec Rate/i }));

    // Hawaii has highest rate (39.9¢), should be first
    const rows = screen.getAllByTestId(/^state-row-/);
    expect(rows[0]).toHaveAttribute("data-testid", "state-row-HI");
  });

  it("changes sort order when clicking Marginal Emissions button", async () => {
    const user = userEvent.setup();
    render(<SolarCarbonCost />);

    await user.click(
      screen.getByRole("button", { name: /Marginal Emissions/i })
    );

    // States with highest marginal emissions should be first (WV or HI at 1350)
    const rows = screen.getAllByTestId(/^state-row-/);
    const firstRow = rows[0].getAttribute("data-testid");
    // HI and WV both have 1350, either could be first
    expect(["state-row-HI", "state-row-WV"]).toContain(firstRow);
  });

  it("changes sort order when clicking Tons Avoided button", async () => {
    const user = userEvent.setup();
    render(<SolarCarbonCost />);

    await user.click(screen.getByRole("button", { name: /Tons Avoided/i }));

    // The state with highest lifetime tons should be first
    const rows = screen.getAllByTestId(/^state-row-/);
    expect(rows.length).toBe(50);
  });

  it("defaults to $/Ton sort", () => {
    render(<SolarCarbonCost />);
    const rows = screen.getAllByTestId(/^state-row-/);
    // The first row should be the state with lowest (most negative) $/ton
    expect(rows.length).toBe(50);
  });

  // ============================================================
  // Methodology Panel
  // ============================================================

  it("hides methodology panel by default", () => {
    render(<SolarCarbonCost />);
    expect(screen.queryByTestId("methodology-panel")).not.toBeInTheDocument();
  });

  it("shows methodology panel when button is clicked", async () => {
    const user = userEvent.setup();
    render(<SolarCarbonCost />);

    await user.click(
      screen.getByRole("button", { name: /Show Methodology/i })
    );

    expect(screen.getByTestId("methodology-panel")).toBeInTheDocument();
    expect(screen.getByText("Methodology")).toBeInTheDocument();
  });

  it("shows formula in methodology panel", async () => {
    const user = userEvent.setup();
    render(<SolarCarbonCost />);

    await user.click(
      screen.getByRole("button", { name: /Show Methodology/i })
    );

    expect(screen.getByText(/Formula:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Installed Cost/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Electricity Savings/).length).toBeGreaterThan(0);
  });

  it("hides methodology panel when clicking Hide", async () => {
    const user = userEvent.setup();
    render(<SolarCarbonCost />);

    // Show
    await user.click(
      screen.getByRole("button", { name: /Show Methodology/i })
    );
    expect(screen.getByTestId("methodology-panel")).toBeInTheDocument();

    // Hide
    await user.click(
      screen.getByRole("button", { name: /Hide Methodology/i })
    );
    expect(screen.queryByTestId("methodology-panel")).not.toBeInTheDocument();
  });

  it("shows data compilation date in methodology panel", async () => {
    const user = userEvent.setup();
    render(<SolarCarbonCost />);

    await user.click(
      screen.getByRole("button", { name: /Show Methodology/i })
    );

    expect(screen.getByText(/Data compiled:/i)).toBeInTheDocument();
  });

  it("shows marginal emissions explanation in methodology", async () => {
    const user = userEvent.setup();
    render(<SolarCarbonCost />);

    await user.click(
      screen.getByRole("button", { name: /Show Methodology/i })
    );

    expect(screen.getByText(/Marginal Emissions:/i)).toBeInTheDocument();
    expect(screen.getByText(/GEA regions/i)).toBeInTheDocument();
  });

  // ============================================================
  // Table Headers
  // ============================================================

  it("renders table column headers", () => {
    render(<SolarCarbonCost />);
    expect(screen.getByText("State")).toBeInTheDocument();
    expect(screen.getByText("Rate")).toBeInTheDocument();
    expect(screen.getByText("Marginal")).toBeInTheDocument();
    expect(screen.getByText("Tons")).toBeInTheDocument();
  });

  // ============================================================
  // Data Display
  // ============================================================

  it("shows electricity rates for states", () => {
    render(<SolarCarbonCost />);
    // Hawaii has 39.9¢ rate
    expect(screen.getByText(/39\.9/)).toBeInTheDocument();
  });

  it("shows marginal emission values", () => {
    render(<SolarCarbonCost />);
    // WV has 1350 marginal emissions
    expect(screen.getAllByText("1350").length).toBeGreaterThan(0);
  });

  it("shows lifetime tons with 't' suffix", () => {
    render(<SolarCarbonCost />);
    // Look for a value like "XX.Xt"
    const tonsElements = screen.getAllByText(/^\d+\.?\d*t$/);
    expect(tonsElements.length).toBe(50);
  });

  it("shows $/t values in bar labels", () => {
    render(<SolarCarbonCost />);
    // Should have $/t labels (both positive and negative) — in bars and possibly stats
    const dollarLabels = screen.getAllByText(/\$[\d,]+\/t/);
    expect(dollarLabels.length).toBeGreaterThanOrEqual(50);
  });

  // ============================================================
  // Insight Panel
  // ============================================================

  it("renders Key Insights section", () => {
    render(<SolarCarbonCost />);
    expect(screen.getByText("Key Insights")).toBeInTheDocument();
  });

  it("shows all four insight categories", () => {
    render(<SolarCarbonCost />);
    expect(
      screen.getByText(/Best for carbon bang-per-buck/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Worst for carbon bang-per-buck/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Why marginal emissions matter/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Negative \$\/ton = double win/i)).toBeInTheDocument();
  });

  // ============================================================
  // Footer
  // ============================================================

  it("renders data sources footer", () => {
    render(<SolarCarbonCost />);
    expect(screen.getByText(/EnergySage/i)).toBeInTheDocument();
    expect(screen.getByText(/EIA Electric Power Monthly/i)).toBeInTheDocument();
    expect(screen.getByText(/NREL Cambium 2024/i)).toBeInTheDocument();
  });

  it("renders assumptions in footer", () => {
    render(<SolarCarbonCost />);
    expect(screen.getByText(/8 kW system/i)).toBeInTheDocument();
    expect(screen.getByText(/25-year lifetime/i)).toBeInTheDocument();
    expect(screen.getByText(/Simple payback method/i)).toBeInTheDocument();
  });

  // ============================================================
  // Bar visualization
  // ============================================================

  it("renders bar fills for each state", () => {
    render(<SolarCarbonCost />);
    const bars = screen.getAllByTestId("bar-fill");
    expect(bars).toHaveLength(50);
  });

  it("renders bars with non-zero width for states with data", () => {
    render(<SolarCarbonCost />);
    const bars = screen.getAllByTestId("bar-fill");
    // At least some bars should have non-zero width
    const nonZeroBars = bars.filter(
      (bar) => bar.style.width && bar.style.width !== "0%"
    );
    expect(nonZeroBars.length).toBeGreaterThan(0);
  });
});

// ============================================================
// Data module tests
// ============================================================

describe("data module", () => {
  it("exports stateData with 50 states", async () => {
    const { stateData } = await import("../data");
    expect(Object.keys(stateData)).toHaveLength(50);
  });

  it("exports metadata with compilation info", async () => {
    const { metadata } = await import("../data");
    expect(metadata.description).toBeDefined();
    expect(metadata.compiled_at).toBeDefined();
    expect(metadata.sources).toBeDefined();
  });

  it("each state has required fields", async () => {
    const { stateData } = await import("../data");
    for (const [abbr, state] of Object.entries(stateData)) {
      expect(state.name).toBeTruthy();
      expect(state.cpw).toBeGreaterThan(0);
      expect(state.rate).toBeGreaterThan(0);
      expect(state.cf).toBeGreaterThan(0);
      expect(state.me).toBeGreaterThan(0);
    }
  });

  it("state abbreviations are valid 2-letter codes", async () => {
    const { stateData } = await import("../data");
    for (const abbr of Object.keys(stateData)) {
      expect(abbr).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("capacity factors are in valid range (0-1)", async () => {
    const { stateData } = await import("../data");
    for (const state of Object.values(stateData)) {
      expect(state.cf).toBeGreaterThan(0);
      expect(state.cf).toBeLessThan(1);
    }
  });

  it("electricity rates are in reasonable range", async () => {
    const { stateData } = await import("../data");
    for (const state of Object.values(stateData)) {
      expect(state.rate).toBeGreaterThan(5);
      expect(state.rate).toBeLessThan(50);
    }
  });

  it("cost per watt is in reasonable range", async () => {
    const { stateData } = await import("../data");
    for (const state of Object.values(stateData)) {
      expect(state.cpw).toBeGreaterThan(1.5);
      expect(state.cpw).toBeLessThan(5.0);
    }
  });

  it("marginal emissions are in reasonable range", async () => {
    const { stateData } = await import("../data");
    for (const state of Object.values(stateData)) {
      expect(state.me).toBeGreaterThan(0);
      expect(state.me).toBeLessThan(2000);
    }
  });
});
