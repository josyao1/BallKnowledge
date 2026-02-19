#!/usr/bin/env python3
"""
NBA Roster Preload Script

Generates static JSON files for all NBA team rosters (2000-present) for use
as Vercel static assets, eliminating backend API calls in roster guessing mode.

Strategy (fast):
  1. Check existing api_server .cache/ files first — instant reads, already enriched.
  2. For cache misses: CommonTeamRoster only (no PPG fetch needed — just name/position).

Output:
  public/data/rosters/{HIST_ABBR}_{SEASON}.json   per team-season roster
  public/data/players/{SEASON}.json               all players per season (autocomplete)

File names use historical abbreviations (NJN_2004-05, SEA_2006-07) so the
frontend's existing getApiAbbreviation() logic works without change.

Usage:
    python generate_nba_rosters.py                  full run 2000-2024
    python generate_nba_rosters.py --teams LAL,GSW  test two teams
    python generate_nba_rosters.py --force           overwrite existing output files
"""

import json
import time
import argparse
from pathlib import Path

from nba_api.stats.endpoints import CommonTeamRoster
from tqdm import tqdm

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

REQUEST_DELAY = 0.3   # seconds between API calls (only for cache misses)

PROJECT_ROOT = Path(__file__).parent.parent
CACHE_DIR    = Path(__file__).parent / ".cache"        # api_server's existing cache
ROSTERS_DIR  = PROJECT_ROOT / "public" / "data" / "rosters"
PLAYERS_DIR  = PROJECT_ROOT / "public" / "data" / "players"

# All 30 current NBA teams (current abbreviation → team_id)
NBA_TEAMS: dict[str, int] = {
    "ATL": 1610612737, "BOS": 1610612738, "BKN": 1610612751, "CHA": 1610612766,
    "CHI": 1610612741, "CLE": 1610612739, "DAL": 1610612742, "DEN": 1610612743,
    "DET": 1610612765, "GSW": 1610612744, "HOU": 1610612745, "IND": 1610612754,
    "LAC": 1610612746, "LAL": 1610612747, "MEM": 1610612763, "MIA": 1610612748,
    "MIL": 1610612749, "MIN": 1610612750, "NOP": 1610612740, "NYK": 1610612752,
    "OKC": 1610612760, "ORL": 1610612753, "PHI": 1610612755, "PHX": 1610612756,
    "POR": 1610612757, "SAC": 1610612758, "SAS": 1610612759, "TOR": 1610612761,
    "UTA": 1610612762, "WAS": 1610612764,
}

# Mirrors getApiAbbreviation() in src/utils/teamHistory.ts
# current abbr → [(historical_abbr, first_season_year), ...] sorted descending
HISTORICAL_ABBR: dict[str, list[tuple[str, int]]] = {
    "BKN": [("BKN", 2012), ("NJN", 0)],
    "OKC": [("OKC", 2008), ("SEA", 0)],
    "NOP": [("NOP", 2013), ("NOH", 0)],
    "MEM": [("MEM", 2001), ("VAN", 0)],
}


def hist_abbr(current: str, season_year: int) -> str:
    for abbr, from_year in HISTORICAL_ABBR.get(current, []):
        if season_year >= from_year:
            return abbr
    return current


def format_season(year: int) -> str:
    return f"{year}-{str(year + 1)[-2:]}"


# ---------------------------------------------------------------------------
# Cache helpers (reads api_server's existing .cache/ files)
# ---------------------------------------------------------------------------

def read_api_cache(hist: str, current: str, season: str):
    """Try to read players from api_server's existing file cache.
    Checks historical abbr first, then current abbr (covers relocated teams)."""
    for abbr in [hist, current]:
        path = CACHE_DIR / f"{abbr}_{season}.json"
        if path.exists():
            try:
                data = json.loads(path.read_text())
                players = data.get("players", [])
                if players:
                    return players
            except Exception:
                pass
    return None


# ---------------------------------------------------------------------------
# API fallback (roster only, no PPG)
# ---------------------------------------------------------------------------

def fetch_roster_api(team_id: int, season: str) -> list[dict]:
    """Fetch roster from NBA API. Returns only name/position/number — no PPG call."""
    try:
        roster = CommonTeamRoster(team_id=team_id, season=season)
        time.sleep(REQUEST_DELAY)
        df = roster.get_data_frames()[0]
        return [
            {
                "id":       int(row["PLAYER_ID"]),
                "name":     str(row["PLAYER"]),
                "position": str(row.get("POSITION", "") or ""),
                "number":   str(row.get("NUM", "") or ""),
                "ppg":      0.0,
                "isLowScorer": False,
            }
            for _, row in df.iterrows()
        ]
    except Exception as e:
        print(f"\n  [WARN] API call failed for team {team_id} {season}: {e}")
        return []


# ---------------------------------------------------------------------------
# I/O
# ---------------------------------------------------------------------------

def save_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start-year", type=int, default=2000)
    parser.add_argument("--end-year",   type=int, default=2024)
    parser.add_argument("--teams",      type=str, default=None)
    parser.add_argument("--force",      action="store_true")
    args = parser.parse_args()

    if args.teams:
        teams = {k: v for k, v in NBA_TEAMS.items() if k in args.teams.upper().split(",")}
    else:
        teams = NBA_TEAMS

    seasons = [format_season(y) for y in range(args.start_year, args.end_year + 1)]

    print("=" * 60)
    print("NBA Roster Preload Script")
    print("=" * 60)
    print(f"  Seasons : {seasons[0]} → {seasons[-1]}  ({len(seasons)} seasons)")
    print(f"  Teams   : {len(teams)}")
    print(f"  Output  : {PROJECT_ROOT / 'public' / 'data'}")
    print(f"  Mode    : {'overwrite' if args.force else 'resume (skip existing output)'}")
    print("=" * 60)

    written = skipped = from_cache = from_api = 0
    # Track all players per season for autocomplete files
    season_players: dict[str, dict[int, str]] = {}  # season -> {id: name}

    for season in seasons:
        season_year = int(season[:4])
        print(f"\n{season}", end="  ", flush=True)

        with tqdm(total=len(teams), desc="rosters", leave=False, unit="team") as pbar:
            for current, team_id in teams.items():
                hist = hist_abbr(current, season_year)
                out_path = ROSTERS_DIR / f"{hist}_{season}.json"
                pbar.set_description(f"{hist} {season}")

                if not args.force and out_path.exists():
                    # Still collect players for autocomplete
                    try:
                        existing = json.loads(out_path.read_text())
                        for p in existing.get("players", []):
                            season_players.setdefault(season, {})[p["id"]] = p["name"]
                    except Exception:
                        pass
                    skipped += 1
                    pbar.update(1)
                    continue

                # 1. Try existing api_server cache (fast, no API call)
                players = read_api_cache(hist, current, season)
                if players:
                    from_cache += 1
                else:
                    # 2. Fall back to live API call (roster only, no PPG)
                    players = fetch_roster_api(team_id, season)
                    if players:
                        from_api += 1

                if not players:
                    pbar.update(1)
                    continue

                # Sort stars first (ppg desc; cached files have real ppg, api fallback has 0)
                players.sort(key=lambda p: p.get("ppg", 0.0), reverse=True)

                save_json(out_path, {"team": hist, "season": season, "players": players})
                written += 1

                for p in players:
                    season_players.setdefault(season, {})[p["id"]] = p["name"]

                pbar.update(1)

        print(f"✓", flush=True)

    # Write per-season player lists for autocomplete
    print("\nWriting season player files...")
    players_written = 0
    for season, player_map in season_players.items():
        out_path = PLAYERS_DIR / f"{season}.json"
        if args.force or not out_path.exists():
            player_list = sorted(
                [{"id": pid, "name": name} for pid, name in player_map.items()],
                key=lambda p: p["name"],
            )
            save_json(out_path, player_list)
            players_written += 1

    print("\n" + "=" * 60)
    print("Done!")
    print(f"  Roster files written : {written}  ({from_cache} from cache, {from_api} from API)")
    print(f"  Roster files skipped : {skipped}")
    print(f"  Season player files  : {players_written}")
    print("=" * 60)


if __name__ == "__main__":
    main()
