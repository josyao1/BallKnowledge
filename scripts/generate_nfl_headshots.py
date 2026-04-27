"""
generate_nfl_headshots.py

Fetches the nflverse players dataset and produces a compact GSIS ID → headshot URL
mapping for only the players that exist in our nfl_lineups_pool.json and nfl_careers.json.

URL preference order (most reliable for retired players first):
  1. ESPN CDN  https://a.espncdn.com/i/headshots/nfl/players/full/{espn_id}.png
     — deterministic, stable for historical players, never purged
  2. nflverse  headshot column (static.www.nfl.com Cloudinary URL)
     — can go dead for retired/obscure players

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

    lineup_path = PUBLIC_DATA / "nfl_lineup_pool.json"
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
    """Download nflverse players.csv and return {gsis_id: headshot_url} for our players.

    Prefers ESPN CDN URL when espn_id is available — more stable for retired players.
    Falls back to the nflverse Cloudinary URL when no espn_id exists.
    """
    print(f"\nFetching nflverse players.csv from GitHub...")
    resp = requests.get(NFLVERSE_PLAYERS_URL, timeout=60)
    resp.raise_for_status()
    print(f"  Downloaded {len(resp.content) / 1024:.0f} KB")

    reader = csv.DictReader(io.StringIO(resp.text))
    mapping: dict[str, str] = {}
    total_rows = 0
    espn_count = 0
    nflverse_count = 0

    for row in reader:
        total_rows += 1
        gsis_id = row.get("gsis_id", "").strip()
        if not gsis_id or gsis_id not in our_ids:
            continue

        espn_id = row.get("espn_id", "").strip()
        nflverse_url = row.get("headshot", "").strip()

        if espn_id:
            # ESPN CDN is stable for both active and retired players
            mapping[gsis_id] = f"https://a.espncdn.com/i/headshots/nfl/players/full/{espn_id}.png"
            espn_count += 1
        elif nflverse_url:
            # Fallback: nflverse Cloudinary URL (may go dead for retired players)
            mapping[gsis_id] = nflverse_url
            nflverse_count += 1

    print(f"  nflverse total rows: {total_rows}")
    print(f"  Matched {len(mapping)} of our {len(our_ids)} players")
    print(f"    ESPN CDN URLs: {espn_count}")
    print(f"    nflverse fallback URLs: {nflverse_count}")
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
