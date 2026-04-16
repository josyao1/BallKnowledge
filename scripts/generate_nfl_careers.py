#!/usr/bin/env python3
"""
generate_nfl_careers.py — Build the static NFL career data pool.

Run this once per season (or whenever you want fresh data):
    python scripts/generate_nfl_careers.py

Output: scripts/data/nfl_careers.json

Each entry is the exact shape returned by GET /nfl/career/{player_id}
plus player_name and position so the random endpoint can serve from it too.
"""

import json
import os
import sys

try:
    import nfl_data_py as nfl
except ImportError:
    print("ERROR: nfl_data_py not installed. Run: pip install nfl-data-py")
    sys.exit(1)

try:
    import pandas as pd
except ImportError:
    print("ERROR: pandas not installed. Run: pip install pandas pyarrow")
    sys.exit(1)

# ─── Config ──────────────────────────────────────────────────────────────────

YEARS = list(range(1999, 2025))
CAREER_POSITIONS = {"QB", "RB", "WR", "TE"}

# Minimum career production thresholds (same as the old dynamic server)
MIN_RUSH_YDS  = 1000
MIN_REC_YDS   = 1000
MIN_PASS_YDS  = 3000
MIN_SEASONS   = 5

OUT_PATH = os.path.join(os.path.dirname(__file__), "data", "nfl_careers.json")

# ─── Known abbreviations (mirrors NFL_FRANCHISE_ALIASES + NFL_TEAMS in capCrunch.ts) ──
# Any abbreviation found in the output that is NOT in this set will be flagged.
KNOWN_NFL_ABBRS = {
    # Current teams (NFL_TEAMS)
    "KC", "LV", "LAC", "DEN", "BUF", "MIA", "NE", "NYJ",
    "BAL", "PIT", "CLE", "CIN",
    "PHI", "DAL", "NYG", "WAS",
    "GB", "MIN", "DET", "CHI",
    "ARI", "LAR", "SF", "SEA",
    "NO", "CAR", "TB", "ATL",
    "TEN", "IND", "HOU", "JAX",
    # Historical / relocated / ESPN-variant aliases (NFL_FRANCHISE_ALIASES)
    "OAK",        # Raiders pre-2020
    "SD",         # Chargers pre-2017
    "STL", "SL",  # Rams pre-2016 (STL = standard, SL = ESPN)
    "LA",         # Rams post-2016 in ESPN data
    "ARZ",        # Cardinals ESPN variant
    "BLT",        # Ravens ESPN variant
    "CLV",        # Browns ESPN variant
    "HST",        # Texans ESPN variant
}


def validate_abbreviations(careers: list, label: str = "") -> None:
    """Scan all season team fields and report any abbreviation not in KNOWN_NFL_ABBRS."""
    unknown: dict[str, list[str]] = {}  # abbr → list of player names
    for player in careers:
        for s in player.get("seasons", []):
            team = s.get("team", "")
            # Skip placeholder and traded-player slash notation (handled by frontend split)
            if not team or team == "???" or "/" in team:
                continue
            if team not in KNOWN_NFL_ABBRS:
                unknown.setdefault(team, []).append(player["player_name"])

    tag = f" [{label}]" if label else ""
    if not unknown:
        print(f"\n✓ Abbreviation check{tag}: all team codes are known.")
        return

    print(f"\n⚠ Abbreviation check{tag}: {len(unknown)} UNKNOWN team code(s) found.")
    print("  These are not covered by NFL_FRANCHISE_ALIASES in src/services/capCrunch.ts.")
    print("  Per-season stat lookups for these players may return 0 on the wrong team.")
    print("  Add them to NFL_FRANCHISE_ALIASES if they represent a known franchise:\n")
    for abbr, names in sorted(unknown.items()):
        sample = ", ".join(names[:3]) + ("…" if len(names) > 3 else "")
        print(f"    \"{abbr}\"  ({len(names)} player-seasons)  e.g. {sample}")

# ─── Helpers ─────────────────────────────────────────────────────────────────

def safe_int(val, default=0):
    try:
        if val is None:
            return default
        f = float(val)
        return default if f != f else int(f)  # NaN check
    except (ValueError, TypeError):
        return default


def safe_str(val, default=""):
    if val is None:
        return default
    s = str(val)
    return default if s in ("nan", "None", "") else s


def col_sum(df, col):
    if col not in df.columns:
        return 0
    total = df[col].fillna(0).sum()
    return int(total) if total == total else 0


# ─── Stats loader (handles 2025 via nflverse-data direct parquet) ─────────────

NFLVERSE_STATS_URL = (
    "https://github.com/nflverse/nflverse-data/releases/download/"
    "stats_player/stats_player_reg_{year}.parquet"
)

def load_seasonal_stats(years):
    """Load seasonal stats for all years.
    - Years ≤ 2024: via nfl_data_py (works reliably)
    - Years ≥ 2025: direct parquet fetch from nflverse-data releases
    Normalises column names so both sources share 'interceptions' for QB ints.
    """
    legacy_years = [y for y in years if y <= 2024]
    new_years    = [y for y in years if y >= 2025]

    frames = []

    if legacy_years:
        df = nfl.import_seasonal_data(legacy_years)
        if df is not None and not df.empty:
            frames.append(df)

    for year in new_years:
        url = NFLVERSE_STATS_URL.format(year=year)
        print(f"  Fetching {year} stats from nflverse-data ({url})...")
        try:
            df = pd.read_parquet(url)
            # Normalise column: new format uses 'passing_interceptions', old used 'interceptions'
            if "passing_interceptions" in df.columns and "interceptions" not in df.columns:
                df = df.rename(columns={"passing_interceptions": "interceptions"})
            # 'games' is the GP column in both formats — no rename needed
            frames.append(df)
            print(f"    → {len(df)} rows loaded for {year}")
        except Exception as e:
            print(f"  WARNING: Could not fetch {year} stats: {e}")

    if not frames:
        return None

    combined = pd.concat(frames, ignore_index=True)
    return combined


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

    # ── Load data ──────────────────────────────────────────────────────────────
    print(f"Loading roster data ({YEARS[0]}–{YEARS[-1]})...")
    roster_df = nfl.import_seasonal_rosters(YEARS)
    if roster_df is None or roster_df.empty:
        print("ERROR: Failed to load roster data")
        sys.exit(1)
    roster_df = roster_df.drop_duplicates(subset=["player_id", "season"], keep="first")
    print(f"  Roster rows: {len(roster_df)}")

    print(f"Loading seasonal stats ({YEARS[0]}–{YEARS[-1]})...")
    stats_df = load_seasonal_stats(YEARS)
    if stats_df is None or stats_df.empty:
        print("ERROR: Failed to load stats data")
        sys.exit(1)
    print(f"  Stats rows: {len(stats_df)}")

    # ── Build careers ──────────────────────────────────────────────────────────
    careers = []
    skipped_seasons = 0
    skipped_position = 0
    skipped_production = 0
    skipped_name = 0

    all_pids = roster_df["player_id"].unique()
    print(f"\nScanning {len(all_pids)} unique player IDs...")

    for pid in all_pids:
        roster_group = roster_df[roster_df["player_id"] == pid].sort_values("season")

        # Need 5+ seasons in roster
        if len(roster_group) < MIN_SEASONS:
            skipped_seasons += 1
            continue

        # Determine position (first match in priority order)
        positions = roster_group["position"].dropna().unique()
        player_pos = None
        for p in positions:
            if p in CAREER_POSITIONS:
                player_pos = p
                break
        if not player_pos:
            skipped_position += 1
            continue

        # Production filter — requires real stats
        player_stats = stats_df[stats_df["player_id"] == pid].sort_values("season")
        if player_stats.empty:
            skipped_production += 1
            continue

        rush_yds = col_sum(player_stats, "rushing_yards")
        rec_yds  = col_sum(player_stats, "receiving_yards")
        pass_yds = col_sum(player_stats, "passing_yards")
        if rush_yds < MIN_RUSH_YDS and rec_yds < MIN_REC_YDS and pass_yds < MIN_PASS_YDS:
            skipped_production += 1
            continue

        # Player name from most recent roster row
        latest_roster = roster_group.iloc[-1]
        name = safe_str(latest_roster.get("player_name"))
        if not name:
            skipped_name += 1
            continue

        # Build season-by-season lookup from roster
        roster_by_season = {}
        for _, rrow in roster_group.iterrows():
            s = rrow.get("season")
            try:
                roster_by_season[int(float(s))] = rrow
            except (ValueError, TypeError):
                pass

        # Build seasons array
        seasons = []
        for _, row in player_stats.iterrows():
            season_year = safe_int(row.get("season"))
            rrow = roster_by_season.get(season_year)
            if rrow is not None:
                team = safe_str(rrow.get("team"), "???")
            else:
                team = safe_str(row.get("recent_team"), "???")

            base = {
                "season": str(season_year),
                "team": team,
                "gp": safe_int(row.get("games")),
            }

            if player_pos == "QB":
                base.update({
                    "completions":     safe_int(row.get("completions")),
                    "attempts":        safe_int(row.get("attempts")),
                    "passing_yards":   safe_int(row.get("passing_yards")),
                    "passing_tds":     safe_int(row.get("passing_tds")),
                    "interceptions":   safe_int(row.get("interceptions")),
                    "rushing_yards":   safe_int(row.get("rushing_yards")),
                    "receptions":      safe_int(row.get("receptions")),
                    "receiving_yards": safe_int(row.get("receiving_yards")),
                    "receiving_tds":   safe_int(row.get("receiving_tds")),
                })
            elif player_pos == "RB":
                base.update({
                    "carries":         safe_int(row.get("carries")),
                    "rushing_yards":   safe_int(row.get("rushing_yards")),
                    "rushing_tds":     safe_int(row.get("rushing_tds")),
                    "receptions":      safe_int(row.get("receptions")),
                    "receiving_yards": safe_int(row.get("receiving_yards")),
                    "receiving_tds":   safe_int(row.get("receiving_tds")),
                    "passing_yards":   safe_int(row.get("passing_yards")),
                    "passing_tds":     safe_int(row.get("passing_tds")),
                })
            else:  # WR / TE
                base.update({
                    "targets":         safe_int(row.get("targets")),
                    "receptions":      safe_int(row.get("receptions")),
                    "receiving_yards": safe_int(row.get("receiving_yards")),
                    "receiving_tds":   safe_int(row.get("receiving_tds")),
                    "rushing_yards":   safe_int(row.get("rushing_yards")),
                    "rushing_tds":     safe_int(row.get("rushing_tds")),
                    "passing_yards":   safe_int(row.get("passing_yards")),
                    "passing_tds":     safe_int(row.get("passing_tds")),
                })

            seasons.append(base)

        # Bio from most recent roster row
        height_str = ""
        height_val = latest_roster.get("height")
        if height_val and safe_str(height_val):
            try:
                inches = int(float(height_val))
                height_str = f"{inches // 12}-{inches % 12}"
            except (ValueError, TypeError):
                height_str = safe_str(height_val)

        bio = {
            "height":      height_str,
            "weight":      safe_int(latest_roster.get("weight")),
            "college":     safe_str(latest_roster.get("college")),
            "years_exp":   safe_int(latest_roster.get("years_exp")),
            "draft_club":  safe_str(latest_roster.get("draft_club")),
            "draft_number": safe_int(latest_roster.get("draft_number")),
        }

        careers.append({
            "player_id":   str(pid),
            "player_name": name,
            "position":    player_pos,
            "seasons":     seasons,
            "bio":         bio,
        })

    # ── Summary ────────────────────────────────────────────────────────────────
    print(f"\nResults:")
    print(f"  Eligible players:    {len(careers)}")
    print(f"  Skipped (<{MIN_SEASONS} seasons): {skipped_seasons}")
    print(f"  Skipped (position):  {skipped_position}")
    print(f"  Skipped (production):{skipped_production}")
    print(f"  Skipped (no name):   {skipped_name}")

    # ── Abbreviation validation ────────────────────────────────────────────────
    validate_abbreviations(careers, "nfl_careers")

    # ── Write output ───────────────────────────────────────────────────────────
    with open(OUT_PATH, "w") as f:
        json.dump(careers, f, separators=(",", ":"))  # compact — no indentation

    size_kb = os.path.getsize(OUT_PATH) / 1024
    print(f"\nWritten: {OUT_PATH}  ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
