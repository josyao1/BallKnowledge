#!/usr/bin/env python3
"""
generate_nba_box_scores.py — Build static NBA box score data for the Box Score game mode.

Selects up to MAX_PER_SEASON notable games per season (2014–2025), prioritised by:
  Tier 0: Playoff games
  Tier 1: Play-In Tournament games
  Tier 2: Close regular season (margin ≤ 3, both teams ≥ 100)
  Tier 3: Close regular season (margin ≤ 6, both teams ≥ 100)
  Tier 4: Close regular season (margin ≤ 10, both teams ≥ 100)
Within each tier: tighter margin first, then higher combined score first.

Output:
  scripts/data/nba_box_scores/{year}.json   per-season array (year = season start)
  scripts/data/nba_box_scores/index.json    {"2014": 118, ..., "2025": 94}

Run:
    cd scripts && python generate_nba_box_scores.py
    cd scripts && python generate_nba_box_scores.py --year 2024  # single season
    cp -r data/nba_box_scores ../public/data/nba/box_scores
"""

import argparse
import json
import os
import sys
import time

try:
    from nba_api.stats.endpoints import (
        leaguegamelog,
        boxscoretraditionalv2,
        commonteamroster,
    )
    from nba_api.stats.static import teams as nba_teams_static
except ImportError:
    print("ERROR: nba_api not installed. Run: pip install nba_api")
    sys.exit(1)

try:
    import pandas as pd
except ImportError:
    print("ERROR: pandas not installed. Run: pip install pandas")
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────────

SEASONS        = list(range(2014, 2026))  # 2014 = 2014-15 season
MAX_PER_SEASON = 120
MIN_SCORE      = 100   # both teams must reach this for close-game qualification
CLOSE_MARGIN   = 10    # final margin threshold
SLEEP          = 0.65  # seconds between API calls

OUT_DIR = os.path.join(os.path.dirname(__file__), "data", "nba_box_scores")

# nba_api occasionally uses non-current abbreviations
NBA_ABBREV_MAP = {
    "NOH": "NOP", "NOK": "NOP",
    "NJN": "BKN",
    "SEA": "OKC",
    "UTH": "UTA",
    "GOS": "GSW",
    "PHO": "PHX",
    "SA":  "SAS",
    "NY":  "NYK",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def normalize_team(t) -> str:
    if not t:
        return ""
    s = str(t).strip().upper()
    return NBA_ABBREV_MAP.get(s, s) if s not in ("NAN", "NONE", "") else ""


def season_str(year: int) -> str:
    """2014 → '2014-15'"""
    return f"{year}-{str(year + 1)[-2:]}"


def game_type_from_id(game_id: str) -> str:
    """NBA game_id prefix: 002=REG, 004=PO, 005=PI (Play-In)"""
    prefix = str(game_id)[:3]
    if prefix == "004":
        return "PO"
    if prefix == "005":
        return "PI"
    return "REG"


def safe_int(val, default: int = 0) -> int:
    try:
        if val is None:
            return default
        f = float(val)
        return default if f != f else int(f)
    except (ValueError, TypeError):
        return default


def safe_str(val, default: str = "") -> str:
    if val is None:
        return default
    s = str(val).strip()
    return default if s.lower() in ("nan", "none", "") else s


def parse_min(val) -> int:
    """'36:21' or 36.0 → 36; returns 0 for DNP"""
    s = safe_str(val)
    if not s:
        return 0
    try:
        return int(float(s.split(":")[0]))
    except (ValueError, IndexError):
        return 0


def api_call(fn, *args, retries: int = 3, **kwargs):
    """Call an nba_api endpoint with rate-limit sleep and auto-retry."""
    for attempt in range(retries):
        try:
            time.sleep(SLEEP)
            return fn(*args, **kwargs)
        except Exception as e:
            if attempt == retries - 1:
                raise
            wait = SLEEP * (3 + attempt * 2)
            print(f"    Retry {attempt + 1}/{retries} (wait {wait:.0f}s): {e}")
            time.sleep(wait)


MAX_PO_PER_SERIES = 2   # max games to keep from any single playoff series


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--year", type=int, default=None,
        help="Only generate data for this season start year (e.g. 2024 = 2024-25). "
             "Merges into existing index.",
    )
    args = parser.parse_args()

    years = [args.year] if args.year else SEASONS
    os.makedirs(OUT_DIR, exist_ok=True)

    index_path = os.path.join(OUT_DIR, "index.json")
    if args.year and os.path.exists(index_path):
        with open(index_path) as f:
            index: dict = json.load(f)
    else:
        index = {}

    all_nba_teams = nba_teams_static.get_teams()

    for year in years:
        season = season_str(year)
        print(f"\n{'='*60}")
        print(f"Season {season}  (key: {year})")
        print("=" * 60)

        # ── 1. Fetch game logs ─────────────────────────────────────────────
        raw_frames = []
        for season_type in ("Regular Season", "Playoffs"):
            print(f"  Fetching {season_type} game log...")
            try:
                result = api_call(
                    leaguegamelog.LeagueGameLog,
                    season=season,
                    season_type_all_star=season_type,
                    player_or_team_abbreviation="T",
                    league_id="00",
                    timeout=30,
                )
                df = result.get_data_frames()[0]
                raw_frames.append(df)
                print(f"    {len(df)} team-game rows")
            except Exception as e:
                print(f"    WARNING: {season_type} log failed: {e}")

        if not raw_frames:
            print(f"  No data for {season} — skipping")
            continue

        log_df = pd.concat(raw_frames, ignore_index=True)

        # ── 2. Build game metadata ─────────────────────────────────────────
        # Each game appears twice (one row per team). MATCHUP tells us home vs away.
        # "X vs. Y" = X is home; "X @ Y" = X is away, Y is home.
        games: dict[str, dict] = {}
        for _, row in log_df.iterrows():
            gid     = safe_str(row.get("GAME_ID"))
            team    = normalize_team(safe_str(row.get("TEAM_ABBREVIATION")))
            pts     = safe_int(row.get("PTS"))
            matchup = safe_str(row.get("MATCHUP"))
            date    = safe_str(row.get("GAME_DATE"))

            if not gid:
                continue
            if gid not in games:
                games[gid] = {
                    "game_id":    gid,
                    "game_date":  date,
                    "game_type":  game_type_from_id(gid),
                    "home_team":  "",
                    "away_team":  "",
                    "home_score": 0,
                    "away_score": 0,
                }
            g = games[gid]
            if " vs. " in matchup:
                g["home_team"]  = team
                g["home_score"] = pts
            elif " @ " in matchup:
                g["away_team"]  = team
                g["away_score"] = pts

        # Drop any incomplete game records (missing home or away)
        games = {
            gid: g for gid, g in games.items()
            if g["home_team"] and g["away_team"] and g["home_score"] > 0 and g["away_score"] > 0
        }
        print(f"  Unique complete games: {len(games)}")

        # ── 3. Select games ────────────────────────────────────────────────
        # Playoff / Play-In: cap at MAX_PO_PER_SERIES per series.
        # NBA game_id: last digit is game number within series,
        # so game_id[:9] is a stable series identifier.
        po_by_series: dict[str, list] = {}
        for g in games.values():
            if g["game_type"] in ("PO", "PI"):
                key = g["game_id"][:9]
                po_by_series.setdefault(key, []).append(g)

        selected_po: list[dict] = []
        for series_games in po_by_series.values():
            series_games.sort(key=lambda g: abs(g["home_score"] - g["away_score"]))
            selected_po.extend(series_games[:MAX_PO_PER_SERIES])

        # Regular season: both teams >= MIN_SCORE, margin <= CLOSE_MARGIN
        reg_qualifying = [
            g for g in games.values()
            if g["game_type"] == "REG"
            and min(g["home_score"], g["away_score"]) >= MIN_SCORE
            and abs(g["home_score"] - g["away_score"]) <= CLOSE_MARGIN
        ]
        reg_qualifying.sort(key=lambda g: (
            abs(g["home_score"] - g["away_score"]),
            -(g["home_score"] + g["away_score"]),
        ))

        remaining = max(0, MAX_PER_SEASON - len(selected_po))
        selected  = selected_po + reg_qualifying[:remaining]

        po  = sum(1 for g in selected if g["game_type"] == "PO")
        pi  = sum(1 for g in selected if g["game_type"] == "PI")
        reg = sum(1 for g in selected if g["game_type"] == "REG")
        print(f"  Playoff series: {len(po_by_series)}  ->  {po} PO games kept")
        print(f"  Regular qualifying: {len(reg_qualifying)}  ->  {reg} kept")
        print(f"  Total selected: {len(selected)}  (PO:{po} PI:{pi} REG:{reg})")

        # ── 4. Jersey numbers (one roster call per team per season) ────────
        print(f"  Building jersey map ({len(all_nba_teams)} teams)...")
        jersey_map: dict[str, str] = {}  # player_id (str) → jersey number

        for team_info in all_nba_teams:
            tid = str(team_info["id"])
            try:
                roster = api_call(
                    commonteamroster.CommonTeamRoster,
                    team_id=tid,
                    season=season,
                    timeout=30,
                )
                df_r = roster.get_data_frames()[0]
                for _, r in df_r.iterrows():
                    pid = safe_str(r.get("PLAYER_ID"))
                    num = safe_str(r.get("NUM"))
                    if pid and num:
                        jersey_map[pid] = num
            except Exception as e:
                print(f"    WARNING: roster fetch failed for {team_info['abbreviation']}: {e}")

        print(f"  Jersey entries: {len(jersey_map)}")

        # ── 5. Fetch box scores ────────────────────────────────────────────
        print(f"  Fetching {len(selected)} box scores...")
        output_games = []

        for i, game_meta in enumerate(selected):
            gid = game_meta["game_id"]
            if (i + 1) % 20 == 0:
                print(f"    {i + 1}/{len(selected)}...")

            try:
                bx = api_call(
                    boxscoretraditionalv2.BoxScoreTraditionalV2,
                    game_id=gid,
                    timeout=30,
                )
                player_df = bx.get_data_frames()[0]
            except Exception as e:
                print(f"    WARNING: box score failed for {gid}: {e}")
                continue

            home_team = game_meta["home_team"]
            away_team = game_meta["away_team"]
            box       = {"home": [], "away": []}
            had_ot    = False

            for _, row in player_df.iterrows():
                pid  = safe_str(row.get("PLAYER_ID"))
                name = safe_str(row.get("PLAYER_NAME"))
                team = normalize_team(safe_str(row.get("TEAM_ABBREVIATION")))
                if not pid or not name:
                    continue

                min_played = parse_min(row.get("MIN"))
                if min_played == 0:
                    continue  # DNP

                if min_played > 48:
                    had_ot = True

                if   team == home_team: side = "home"
                elif team == away_team: side = "away"
                else: continue  # traded/released player with stale team

                box[side].append({
                    "id":     pid,
                    "name":   name,
                    "number": jersey_map.get(pid, ""),
                    "min":    min_played,
                    "pts":    safe_int(row.get("PTS")),
                    "reb":    safe_int(row.get("REB")),
                    "ast":    safe_int(row.get("AST")),
                    "stl":    safe_int(row.get("STL")),
                    "blk":    safe_int(row.get("BLK")),
                    "to":     safe_int(row.get("TO")),
                })

            # Sort each side by pts descending (top scorers first)
            for side in ("home", "away"):
                box[side].sort(key=lambda p: p["pts"], reverse=True)

            total_players = len(box["home"]) + len(box["away"])
            if total_players < 10:
                continue  # data gap — skip

            output_games.append({
                "game_id":    gid,
                "season":     year,
                "game_date":  game_meta["game_date"],
                "game_type":  game_meta["game_type"],
                "home_team":  home_team,
                "away_team":  away_team,
                "home_score": game_meta["home_score"],
                "away_score": game_meta["away_score"],
                "overtime":   had_ot,
                "box_score":  box,
            })

        output_games.sort(key=lambda g: g["game_date"])

        out_path = os.path.join(OUT_DIR, f"{year}.json")
        with open(out_path, "w") as f:
            json.dump(output_games, f, separators=(",", ":"))

        size_kb = os.path.getsize(out_path) / 1024
        print(f"\n  {year}: {len(output_games)} games → {size_kb:.0f} KB")
        index[str(year)] = len(output_games)

    # ── Index ─────────────────────────────────────────────────────────────────
    with open(index_path, "w") as f:
        json.dump(index, f, separators=(",", ":"))

    total = sum(index.values())
    print(f"\nIndex → {index_path}")
    print(f"Seasons: {len(index)}  |  Total games: {total}")
    print(f"\nCopy to public/:\n  cp -r data/nba_box_scores ../public/data/nba/box_scores")


if __name__ == "__main__":
    main()
