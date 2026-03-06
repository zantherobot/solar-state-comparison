#!/usr/bin/env python3
"""
Fetch residential electricity rates by state from EIA API.

Source: EIA Electric Power Monthly / Open Data API
Data: Average residential electricity price (cents/kWh) by state
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error

# EIA Open Data API v2
# Free API key from: https://www.eia.gov/opendata/register.php
# If no key, falls back to DEMO_KEY (rate-limited)
EIA_API_KEY = os.environ.get("EIA_API_KEY", "DEMO_KEY")

# EIA series: average retail price of electricity, residential sector, by state
# API v2 endpoint for state-level electricity prices
EIA_API_URL = "https://api.eia.gov/v2/electricity/retail-sales/data/"

STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "eia_rates.json")


def fetch_eia_rates():
    """Fetch residential electricity rates from EIA API v2."""
    params = {
        "api_key": EIA_API_KEY,
        "frequency": "annual",
        "data[0]": "price",
        "facets[sectorid][]": "RES",
        "facets[stateid][]": STATES,
        "sort[0][column]": "period",
        "sort[0][direction]": "desc",
        "length": 500,
    }

    query = "&".join(f"{k}={v}" if not isinstance(v, list) else
                     "&".join(f"{k}={item}" for item in v)
                     for k, v in params.items())
    url = f"{EIA_API_URL}?{query}"

    print(f"Fetching EIA residential electricity rates...")
    print(f"URL: {url[:120]}...")

    try:
        req = urllib.request.Request(url)
        req.add_header("User-Agent", "SolarCarbonCost/1.0")
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f"EIA API error: {e.code} {e.reason}")
        print("Falling back to hardcoded EIA data (Dec 2025 release)...")
        return get_fallback_rates()
    except Exception as e:
        print(f"Network error: {e}")
        print("Falling back to hardcoded EIA data (Dec 2025 release)...")
        return get_fallback_rates()

    if "response" not in data or "data" not in data["response"]:
        print("Unexpected API response format. Using fallback data.")
        return get_fallback_rates()

    # Extract most recent rate per state
    rates = {}
    for row in data["response"]["data"]:
        state = row.get("stateid", "")
        price = row.get("price")
        if state in STATES and state not in rates and price is not None:
            rates[state] = round(float(price), 1)

    # Fill missing states with fallback
    fallback = get_fallback_rates()
    for st in STATES:
        if st not in rates:
            rates[st] = fallback.get(st, 17.2)  # national avg fallback
            print(f"  {st}: using fallback rate {rates[st]}¢/kWh")

    return rates


def get_fallback_rates():
    """
    Hardcoded EIA residential rates (cents/kWh).
    Source: EIA Electric Power Monthly, Table 5.6.a, Dec 2025 data.
    National average: 17.24 ¢/kWh
    """
    return {
        "AL": 16.2, "AK": 28.5, "AZ": 15.2, "AR": 13.3, "CA": 33.8,
        "CO": 16.5, "CT": 30.3, "DE": 16.8, "FL": 15.4, "GA": 15.5,
        "HI": 39.9, "ID": 12.1, "IL": 18.1, "IN": 16.6, "IA": 15.6,
        "KS": 14.7, "KY": 14.0, "LA": 12.4, "ME": 29.6, "MD": 17.8,
        "MA": 31.5, "MI": 19.5, "MN": 15.8, "MS": 14.5, "MO": 14.1,
        "MT": 13.5, "NE": 13.5, "NV": 13.0, "NH": 26.5, "NJ": 20.5,
        "NM": 15.0, "NY": 24.5, "NC": 14.8, "ND": 11.0, "OH": 16.5,
        "OK": 13.0, "OR": 14.0, "PA": 18.5, "RI": 31.3, "SC": 15.5,
        "SD": 13.8, "TN": 13.5, "TX": 15.9, "UT": 13.0, "VT": 22.5,
        "VA": 15.5, "WA": 12.5, "WV": 14.5, "WI": 17.5, "WY": 12.5,
    }


def main():
    rates = fetch_eia_rates()

    output = {
        "source": "EIA Electric Power Monthly, Table 5.6.a",
        "description": "Average residential electricity rate by state (cents/kWh)",
        "period": "Dec 2025 (latest available as of Mar 2026)",
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "rates": rates,
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nSaved {len(rates)} state rates to {OUTPUT_FILE}")
    print(f"Range: {min(rates.values())}¢ – {max(rates.values())}¢/kWh")
    print(f"National avg: {sum(rates.values()) / len(rates):.1f}¢/kWh")


if __name__ == "__main__":
    main()
