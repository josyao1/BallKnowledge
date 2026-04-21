"""
generate_nfl_headshots.py

Fetches the nflverse players dataset and produces a compact GSIS ID → headshot URL
mapping for only the players that exist in our nfl_lineups_pool.json and nfl_careers.json.

Output: public/data/nfl_headshots.json  { "00-0036410": "https://...", ... }

Run once and commit the output:
    pip install requests
    python scripts/generate_nfl_headshots.py
"""

import json
import csv
import io
import requests
from pathlib import Path

ROOT = Path(__file__).parent.parent
PUBLIC_DATA = ROOT / "public" / "data"

NFLVERSE_PLAYERS_URL = "https://github.com/nflverse/nflverse-data/releases/download/players/players.csv"


def collect_gsis_ids() -> set[str]:
    """Collect every player_id from our existing NFL data files."""
    ids: set[str] = set()

    lineup_path = PUBLIC_DATA / "nfl_lineups_pool.json"
    careers_path = PUBLIC_DATA / "nfl_careers.json"

    for path in (lineup_path, careers_path):
        if not path.exists():
            print(f"  WARNING: {path.name} not found, skipping")
            continue
        with open(path) as f:
            players = json.load(f)
        for p in players:
            pid = p.get("player_id")
            if pid:
                ids.add(str(pid))
        print(f"  {path.name}: {len(players)} players loaded")

    print(f"  Total unique GSIS IDs in our data: {len(ids)}")
    return ids


def fetch_headshot_map(our_ids: set[str]) -> dict[str, str]:
    """Download nflverse players.csv and return {gsis_id: headshot_url} for our players."""
    print(f"\nFetching nflverse players.csv from GitHub...")
    resp = requests.get(NFLVERSE_PLAYERS_URL, timeout=60)
    resp.raise_for_status()
    print(f"  Downloaded {len(resp.content) / 1024:.0f} KB")

    reader = csv.DictReader(io.StringIO(resp.text))
    mapping: dict[str, str] = {}
    total_rows = 0

    for row in reader:
        total_rows += 1
        gsis_id = row.get("gsis_id", "").strip()
        headshot_url = row.get("headshot_url", "").strip()
        if gsis_id and headshot_url and gsis_id in our_ids:
            mapping[gsis_id] = headshot_url

    print(f"  nflverse total rows: {total_rows}")
    print(f"  Matched {len(mapping)} of our {len(our_ids)} players")
    missed = len(our_ids) - len(mapping)
    if missed:
        print(f"  {missed} players have no headshot in nflverse (old/obscure players)")
    return mapping


def main():
    print("=== NFL Headshot Generator ===\n")
    print("Step 1: Collecting GSIS IDs from our data...")
    our_ids = collect_gsis_ids()

    print("\nStep 2: Fetching nflverse headshot map...")
    mapping = fetch_headshot_map(our_ids)

    out_path = PUBLIC_DATA / "nfl_headshots.json"
    with open(out_path, "w") as f:
        json.dump(mapping, f, separators=(",", ":"))

    size_kb = out_path.stat().st_size / 1024
    print(f"\nWrote {len(mapping)} entries to {out_path.relative_to(ROOT)} ({size_kb:.0f} KB)")


if __name__ == "__main__":
    main()
