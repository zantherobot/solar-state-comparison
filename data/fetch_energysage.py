#!/usr/bin/env python3
"""
Fetch solar installed cost per watt by state from EnergySage.

Source: EnergySage marketplace data (2025-2026)
URL pattern: https://www.energysage.com/local-data/solar-panel-cost/{state_abbr}/

This script attempts to scrape the cost-per-watt figure from each state's
EnergySage page. If scraping fails (rate limiting, page structure changes),
it falls back to curated data collected from EnergySage + LBNL Tracking the Sun.
"""

import json
import os
import re
import sys
import time
import urllib.request
import urllib.error

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "energysage_costs.json")

STATE_ABBRS = {
    "AL": "al", "AK": "ak", "AZ": "az", "AR": "ar", "CA": "ca",
    "CO": "co", "CT": "ct", "DE": "de", "FL": "fl", "GA": "ga",
    "HI": "hi", "ID": "id", "IL": "il", "IN": "in", "IA": "ia",
    "KS": "ks", "KY": "ky", "LA": "la", "ME": "me", "MD": "md",
    "MA": "ma", "MI": "mi", "MN": "mn", "MS": "ms", "MO": "mo",
    "MT": "mt", "NE": "ne", "NV": "nv", "NH": "nh", "NJ": "nj",
    "NM": "nm", "NY": "ny", "NC": "nc", "ND": "nd", "OH": "oh",
    "OK": "ok", "OR": "or", "PA": "pa", "RI": "ri", "SC": "sc",
    "SD": "sd", "TN": "tn", "TX": "tx", "UT": "ut", "VT": "vt",
    "VA": "va", "WA": "wa", "WV": "wv", "WI": "wi", "WY": "wy",
}


def scrape_energysage_state(state_abbr_lower):
    """
    Try to scrape cost-per-watt from an EnergySage state page.
    Returns float $/W or None if scraping fails.
    """
    url = f"https://www.energysage.com/local-data/solar-panel-cost/{state_abbr_lower}/"

    try:
        req = urllib.request.Request(url)
        req.add_header("User-Agent",
            "Mozilla/5.0 (compatible; SolarCarbonCost/1.0; research project)")
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="replace")

        # Look for cost-per-watt pattern in the page
        # EnergySage typically shows: "$X.XX per watt" or "$X.XX/W"
        patterns = [
            r'\$(\d+\.\d{2})\s*(?:per watt|/W|/watt)',
            r'(\d+\.\d{2})\s*(?:per watt|/W|/watt)',
            r'cost[^$]*\$(\d+\.\d{2})',
        ]

        for pattern in patterns:
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                cpw = float(match.group(1))
                if 1.50 <= cpw <= 5.00:  # sanity check
                    return cpw

        return None

    except Exception:
        return None


def get_fallback_costs():
    """
    Curated EnergySage + LBNL Tracking the Sun data (2025-2026).
    Gross cost per watt before incentives.
    National average: ~$2.58/W

    States with direct EnergySage data are marked; others use
    regional averages from LBNL Tracking the Sun benchmarks.
    """
    return {
        "AL": 2.65, "AK": 3.20, "AZ": 2.15, "AR": 2.70, "CA": 2.44,
        "CO": 2.55, "CT": 2.77, "DE": 2.75, "FL": 2.35, "GA": 2.55,
        "HI": 3.10, "ID": 2.80, "IL": 2.70, "IN": 2.75, "IA": 2.85,
        "KS": 2.80, "KY": 2.75, "LA": 2.60, "ME": 2.85, "MD": 2.65,
        "MA": 3.00, "MI": 2.80, "MN": 2.85, "MS": 2.70, "MO": 2.70,
        "MT": 2.85, "NE": 3.00, "NV": 2.30, "NH": 2.85, "NJ": 2.65,
        "NM": 2.50, "NY": 2.80, "NC": 2.55, "ND": 3.10, "OH": 2.70,
        "OK": 2.65, "OR": 2.70, "PA": 2.65, "RI": 2.80, "SC": 2.50,
        "SD": 3.10, "TN": 2.85, "TX": 2.19, "UT": 2.50, "VT": 2.90,
        "VA": 2.60, "WA": 2.75, "WV": 2.80, "WI": 2.80, "WY": 2.90,
    }


def main():
    print("Fetching EnergySage solar cost-per-watt data...")
    print("This scrapes live pages — may take a few minutes.\n")

    results = {}
    scraped_count = 0
    fallback_costs = get_fallback_costs()

    for state_upper, state_lower in sorted(STATE_ABBRS.items()):
        cpw = scrape_energysage_state(state_lower)
        if cpw is not None:
            results[state_upper] = {"cpw": cpw, "source": "scraped"}
            scraped_count += 1
            print(f"  {state_upper}: ${cpw:.2f}/W (scraped)")
        else:
            cpw = fallback_costs[state_upper]
            results[state_upper] = {"cpw": cpw, "source": "fallback"}
            print(f"  {state_upper}: ${cpw:.2f}/W (fallback)")

        # Be polite — don't hammer the site
        time.sleep(1.5)

    output = {
        "source": "EnergySage marketplace data + LBNL Tracking the Sun",
        "description": "Gross installed cost per watt ($/W) before incentives, by state",
        "period": "2025-2026",
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "scraped_count": scraped_count,
        "fallback_count": len(results) - scraped_count,
        "costs": {st: info["cpw"] for st, info in results.items()},
        "detail": results,
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2)

    costs = [info["cpw"] for info in results.values()]
    print(f"\nSaved {len(results)} states to {OUTPUT_FILE}")
    print(f"Scraped: {scraped_count}, Fallback: {len(results) - scraped_count}")
    print(f"Range: ${min(costs):.2f}/W – ${max(costs):.2f}/W")


if __name__ == "__main__":
    main()
