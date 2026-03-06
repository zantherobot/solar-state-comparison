#!/usr/bin/env python3
"""
Fetch annual solar production per state from NREL PVWatts API v8.

Source: NREL PVWatts API v8
Requires: Free API key from https://developer.nrel.gov/signup/
Set: export NREL_API_KEY=your_key_here

Parameters: 8 kW system, fixed roof mount, 20° tilt, south-facing, 14% losses
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error

NREL_API_KEY = os.environ.get("NREL_API_KEY", "DEMO_KEY")
PVWATTS_URL = "https://developer.nrel.gov/api/pvwatts/v8.json"

# System parameters per spec
SYSTEM_CAPACITY = 8  # kW
MODULE_TYPE = 0       # standard
LOSSES = 14           # percent
ARRAY_TYPE = 1        # fixed roof mount
TILT = 20             # degrees
AZIMUTH = 180         # south-facing

# Representative city (lat, lon) for each state — state capitals or largest cities
STATE_LOCATIONS = {
    "AL": (32.377, -86.300, "Montgomery"),
    "AK": (61.218, -149.900, "Anchorage"),
    "AZ": (33.449, -112.074, "Phoenix"),
    "AR": (34.747, -92.290, "Little Rock"),
    "CA": (34.052, -118.244, "Los Angeles"),
    "CO": (39.739, -104.990, "Denver"),
    "CT": (41.764, -72.685, "Hartford"),
    "DE": (39.745, -75.547, "Wilmington"),
    "FL": (28.538, -81.379, "Orlando"),
    "GA": (33.749, -84.388, "Atlanta"),
    "HI": (21.307, -157.858, "Honolulu"),
    "ID": (43.615, -116.202, "Boise"),
    "IL": (41.878, -87.630, "Chicago"),
    "IN": (39.768, -86.158, "Indianapolis"),
    "IA": (41.586, -93.625, "Des Moines"),
    "KS": (39.048, -95.678, "Topeka"),
    "KY": (38.253, -85.759, "Louisville"),
    "LA": (30.458, -91.140, "Baton Rouge"),
    "ME": (43.661, -70.256, "Portland"),
    "MD": (39.290, -76.612, "Baltimore"),
    "MA": (42.360, -71.059, "Boston"),
    "MI": (42.331, -83.046, "Detroit"),
    "MN": (44.978, -93.265, "Minneapolis"),
    "MS": (32.299, -90.185, "Jackson"),
    "MO": (38.627, -90.199, "St. Louis"),
    "MT": (46.872, -113.994, "Missoula"),
    "NE": (41.256, -95.934, "Omaha"),
    "NV": (36.175, -115.137, "Las Vegas"),
    "NH": (43.207, -71.538, "Concord"),
    "NJ": (40.058, -74.406, "Trenton"),
    "NM": (35.084, -106.651, "Albuquerque"),
    "NY": (40.713, -74.006, "New York City"),
    "NC": (35.780, -78.639, "Raleigh"),
    "ND": (46.877, -96.789, "Fargo"),
    "OH": (39.961, -82.999, "Columbus"),
    "OK": (35.468, -97.516, "Oklahoma City"),
    "OR": (45.515, -122.679, "Portland"),
    "PA": (39.953, -75.164, "Philadelphia"),
    "RI": (41.824, -71.413, "Providence"),
    "SC": (34.000, -81.035, "Columbia"),
    "SD": (43.550, -96.701, "Sioux Falls"),
    "TN": (36.163, -86.782, "Nashville"),
    "TX": (30.267, -97.743, "Austin"),
    "UT": (40.761, -111.891, "Salt Lake City"),
    "VT": (44.260, -72.576, "Montpelier"),
    "VA": (37.541, -77.436, "Richmond"),
    "WA": (47.606, -122.332, "Seattle"),
    "WV": (38.350, -81.633, "Charleston"),
    "WI": (43.075, -89.384, "Madison"),
    "WY": (41.140, -104.820, "Cheyenne"),
}

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "pvwatts_production.json")


def fetch_pvwatts_for_state(state, lat, lon, city):
    """Call PVWatts API for a single state location."""
    params = {
        "api_key": NREL_API_KEY,
        "system_capacity": SYSTEM_CAPACITY,
        "module_type": MODULE_TYPE,
        "losses": LOSSES,
        "array_type": ARRAY_TYPE,
        "tilt": TILT,
        "azimuth": AZIMUTH,
        "lat": lat,
        "lon": lon,
    }

    query = "&".join(f"{k}={v}" for k, v in params.items())
    url = f"{PVWATTS_URL}?{query}"

    try:
        req = urllib.request.Request(url)
        req.add_header("User-Agent", "SolarCarbonCost/1.0")
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())

        if "errors" in data and data["errors"]:
            print(f"  {state} ({city}): API error: {data['errors']}")
            return None

        outputs = data.get("outputs", {})
        ac_annual = outputs.get("ac_annual")
        solrad = outputs.get("solrad_annual")
        capacity_factor = outputs.get("capacity_factor")

        if ac_annual is not None:
            # Compute capacity factor: ac_annual / (system_capacity * 8760)
            cf = ac_annual / (SYSTEM_CAPACITY * 8760)
            print(f"  {state} ({city}): {ac_annual:.0f} kWh/yr, CF={cf:.3f}, solrad={solrad:.2f}")
            return {
                "ac_annual_kwh": round(ac_annual),
                "capacity_factor": round(cf, 4),
                "solrad_annual": round(solrad, 2) if solrad else None,
                "city": city,
                "lat": lat,
                "lon": lon,
            }
        else:
            print(f"  {state} ({city}): No ac_annual in response")
            return None

    except urllib.error.HTTPError as e:
        print(f"  {state} ({city}): HTTP {e.code}: {e.reason}")
        return None
    except Exception as e:
        print(f"  {state} ({city}): Error: {e}")
        return None


def get_fallback_production():
    """
    Fallback capacity factors derived from NREL PVWatts / ATB data.
    These match the prototype values and are reasonable estimates for an 8kW system.
    """
    return {
        "AL": 0.165, "AK": 0.115, "AZ": 0.205, "AR": 0.165, "CA": 0.195,
        "CO": 0.190, "CT": 0.155, "DE": 0.155, "FL": 0.180, "GA": 0.170,
        "HI": 0.190, "ID": 0.170, "IL": 0.155, "IN": 0.150, "IA": 0.155,
        "KS": 0.170, "KY": 0.150, "LA": 0.170, "ME": 0.150, "MD": 0.160,
        "MA": 0.155, "MI": 0.145, "MN": 0.155, "MS": 0.165, "MO": 0.160,
        "MT": 0.165, "NE": 0.165, "NV": 0.200, "NH": 0.150, "NJ": 0.155,
        "NM": 0.200, "NY": 0.150, "NC": 0.165, "ND": 0.155, "OH": 0.145,
        "OK": 0.175, "OR": 0.160, "PA": 0.150, "RI": 0.150, "SC": 0.170,
        "SD": 0.165, "TN": 0.155, "TX": 0.180, "UT": 0.190, "VT": 0.145,
        "VA": 0.160, "WA": 0.145, "WV": 0.145, "WI": 0.150, "WY": 0.175,
    }


def main():
    print(f"Fetching PVWatts data for {len(STATE_LOCATIONS)} states...")
    print(f"System: {SYSTEM_CAPACITY}kW, tilt={TILT}°, azimuth={AZIMUTH}°, losses={LOSSES}%")

    if NREL_API_KEY == "DEMO_KEY":
        print("\nWARNING: Using DEMO_KEY — rate limited to 30 req/hr.")
        print("Get a free key at https://developer.nrel.gov/signup/")
        print("Then: export NREL_API_KEY=your_key_here\n")

    results = {}
    fallback_cfs = get_fallback_production()
    api_failures = 0

    for state, (lat, lon, city) in sorted(STATE_LOCATIONS.items()):
        result = fetch_pvwatts_for_state(state, lat, lon, city)
        if result:
            results[state] = result
        else:
            api_failures += 1
            cf = fallback_cfs.get(state, 0.160)
            ac_annual = round(cf * SYSTEM_CAPACITY * 8760)
            results[state] = {
                "ac_annual_kwh": ac_annual,
                "capacity_factor": cf,
                "solrad_annual": None,
                "city": city,
                "lat": lat,
                "lon": lon,
                "fallback": True,
            }
            print(f"  {state} ({city}): FALLBACK CF={cf:.3f}, {ac_annual} kWh/yr")

        # Rate limit: be polite to the API
        time.sleep(0.5)

    output = {
        "source": "NREL PVWatts API v8",
        "description": "Annual solar production for 8kW residential system by state",
        "parameters": {
            "system_capacity_kw": SYSTEM_CAPACITY,
            "module_type": MODULE_TYPE,
            "losses_pct": LOSSES,
            "array_type": ARRAY_TYPE,
            "tilt_deg": TILT,
            "azimuth_deg": AZIMUTH,
        },
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "api_failures": api_failures,
        "production": results,
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2)

    cfs = [r["capacity_factor"] for r in results.values()]
    print(f"\nSaved {len(results)} states to {OUTPUT_FILE}")
    print(f"CF range: {min(cfs):.3f} – {max(cfs):.3f}")
    print(f"API failures (using fallback): {api_failures}")


if __name__ == "__main__":
    main()
