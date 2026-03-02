"""
generate_nba_starters.py — Build public/data/nba/starters_2025.json

Uses nba_api to pull 2024-25 starting 5 for all 30 NBA teams.
Starters determined by games started (GS) from LeagueDashPlayerStats.

Output: team → { starters: [exactly 5] }
  PG, SG, SF, PF, C — sorted into canonical court slots

Run:
  cd scripts && python generate_nba_starters.py
"""

import json
import os
import sys
import time
from pathlib import Path

from nba_api.stats.endpoints import (
    LeagueDashPlayerStats,
    CommonTeamRoster,
    DraftHistory,
)

SEASON = '2025-26'
REQUEST_DELAY = 0.6  # seconds between API calls

PROJECT_ROOT = Path(__file__).parent.parent
OUT_DIR  = PROJECT_ROOT / 'public' / 'data' / 'nba'
OUT_FILE = OUT_DIR / 'starters_2026.json'

NBA_TEAMS: dict[str, int] = {
    'ATL': 1610612737, 'BOS': 1610612738, 'BKN': 1610612751, 'CHA': 1610612766,
    'CHI': 1610612741, 'CLE': 1610612739, 'DAL': 1610612742, 'DEN': 1610612743,
    'DET': 1610612765, 'GSW': 1610612744, 'HOU': 1610612745, 'IND': 1610612754,
    'LAC': 1610612746, 'LAL': 1610612747, 'MEM': 1610612763, 'MIA': 1610612748,
    'MIL': 1610612749, 'MIN': 1610612750, 'NOP': 1610612740, 'NYK': 1610612752,
    'OKC': 1610612760, 'ORL': 1610612753, 'PHI': 1610612755, 'PHX': 1610612756,
    'POR': 1610612757, 'SAC': 1610612758, 'SAS': 1610612759, 'TOR': 1610612761,
    'UTA': 1610612762, 'WAS': 1610612764,
}

# College name → ESPN college logo ID
COLLEGE_ESPN_ID: dict[str, int] = {
    'Alabama': 333, 'Arizona': 12, 'Arizona State': 9, 'Arkansas': 8, 'Auburn': 2,
    'Baylor': 239, 'Boston College': 103, 'BYU': 252, 'California': 25, 'Clemson': 228,
    'Colorado': 38, 'Duke': 150, 'Florida': 57, 'Florida State': 52, 'Georgia': 61,
    'Georgia Tech': 59, 'Illinois': 356, 'Indiana': 84, 'Iowa': 2294, 'Iowa State': 66,
    'Kansas': 2305, 'Kansas State': 2306, 'Kentucky': 96, 'LSU': 99, 'Louisville': 97,
    'Maryland': 120, 'Michigan': 130, 'Michigan State': 127, 'Minnesota': 135,
    'Mississippi': 145, 'Mississippi State': 344, 'Missouri': 142, 'Nebraska': 158,
    'North Carolina': 153, 'North Carolina State': 152, 'NC State': 152,
    'Northwestern': 77, 'Notre Dame': 87, 'Ohio State': 194, 'Oklahoma': 201,
    'Oklahoma State': 197, 'Ole Miss': 145, 'Oregon': 2483, 'Oregon State': 204,
    'Penn State': 213, 'Pittsburgh': 221, 'Purdue': 2509, 'Rutgers': 164,
    'South Carolina': 2579, 'Stanford': 24, 'Syracuse': 183, 'TCU': 2628,
    'Tennessee': 2633, 'Texas': 251, 'Texas A&M': 245, 'Texas Tech': 2641,
    'UCLA': 26, 'USC': 30, 'Utah': 254, 'Vanderbilt': 238, 'Virginia': 258,
    'Virginia Tech': 259, 'Wake Forest': 154, 'Washington': 264, 'Washington State': 265,
    'West Virginia': 277, 'Wisconsin': 275,
    'Cincinnati': 2132, 'Connecticut': 41, 'UConn': 41, 'Houston': 248,
    'Memphis': 235, 'SMU': 2567, 'South Florida': 58, 'Temple': 218,
    'Tulane': 2655, 'Tulsa': 202, 'Gonzaga': 2250, 'Saint Mary\'s': 2550,
    'Creighton': 156, 'Marquette': 269, 'Providence': 2507, 'Seton Hall': 2550,
    'St. John\'s': 2599, 'Xavier': 2752, 'Butler': 2086, 'DePaul': 305,
    'Georgetown': 46, 'Villanova': 222, 'Miami': 2390, 'Miami (FL)': 2390,
    'Florida Atlantic': 2226, 'UTEP': 2638,
    # International / no college → None handled below
}

# Canonical position sort order for court layout (G/PG first, C last)
POS_ORDER = {'G': 0, 'G-F': 1, 'F-G': 1, 'F': 2, 'F-C': 3, 'C-F': 3, 'C': 4}

# Maps vague position to canonical 5-man slot labels
# Assigned after sorting players into slots 0-4
SLOT_LABELS = ['PG', 'SG', 'SF', 'PF', 'C']


def canonical_slot(players: list[dict]) -> list[dict]:
    """
    Sort 5 players into canonical PG→SG→SF→PF→C slots based on their
    raw NBA position string. Returns list in slot order with pos_abb set.
    """
    def pos_key(p: dict) -> int:
        return POS_ORDER.get(p.get('_raw_pos', 'G'), 0)

    sorted_p = sorted(players, key=pos_key)
    for i, p in enumerate(sorted_p[:5]):
        p['pos_abb'] = SLOT_LABELS[i]
        del p['_raw_pos']
    return sorted_p[:5]


def fetch_league_stats() -> list[dict]:
    """Fetch all player stats for the season, return list of dicts with GS."""
    print('Fetching LeagueDashPlayerStats...')
    time.sleep(REQUEST_DELAY)
    resp = LeagueDashPlayerStats(
        season=SEASON,
        per_mode_detailed='PerGame',
        season_type_all_star='Regular Season',
    )
    df = resp.get_data_frames()[0]
    cols = ['PLAYER_ID', 'PLAYER_NAME', 'TEAM_ABBREVIATION', 'GP', 'MIN', 'PTS']
    df = df[cols].copy()
    df['PLAYER_ID'] = df['PLAYER_ID'].astype(str)
    df['MIN'] = df['MIN'].astype(float)
    df['PTS'] = df['PTS'].astype(float)
    # Only include players with meaningful sample (10+ games)
    df = df[df['GP'] >= 10]
    print(f'  {len(df)} player-team rows')
    return df.to_dict('records')


def fetch_roster(abbr: str, team_id: int) -> dict[str, dict]:
    """Returns {player_id_str: {number, raw_pos}} for a team."""
    time.sleep(REQUEST_DELAY)
    try:
        resp = CommonTeamRoster(team_id=team_id, season=SEASON)
        df = resp.get_data_frames()[0]
        result = {}
        for _, row in df.iterrows():
            pid = str(row.get('PLAYER_ID', ''))
            if pid:
                result[pid] = {
                    'number': str(row.get('NUM', '')).strip() or None,
                    'raw_pos': str(row.get('POSITION', '')).strip() or 'G',
                }
        return result
    except Exception as e:
        print(f'  WARN: roster fetch failed for {abbr}: {e}')
        return {}


def load_bio_lookup() -> dict[str, dict]:
    """
    Build player_id → {college, draft_pick} from local nba_careers.json +
    nba_lineup_pool.json. Covers ~99% of current starters without any API calls.
    Falls back to None for any missing players.
    """
    lookup: dict[str, dict] = {}
    for filename in ('nba_careers.json', 'nba_lineup_pool.json'):
        path = PROJECT_ROOT / 'public' / 'data' / filename
        if not path.exists():
            print(f'  WARN: {filename} not found, skipping')
            continue
        with open(path) as f:
            players = json.load(f)
        for p in players:
            pid = str(p.get('player_id', ''))
            if not pid:
                continue
            bio = p.get('bio') or {}
            school = bio.get('school') or None
            if school and school.lower() in ('', 'none', 'nan'):
                school = None
            lookup[pid] = {'college': school, 'draft_pick': None}  # draft_pick filled later
    print(f'  Bio lookup: {len(lookup)} players from local files')
    return lookup


def fetch_draft_lookup() -> dict:
    """Single DraftHistory call → player_id → overall pick number."""
    print('Fetching DraftHistory (single call)...')
    time.sleep(REQUEST_DELAY)
    resp = DraftHistory(league_id='00')
    df = resp.get_data_frames()[0]
    result: dict[str, int | None] = {}
    for _, row in df.iterrows():
        pid = str(int(row['PERSON_ID']))
        try:
            pick = int(row['OVERALL_PICK'])
            result[pid] = pick
        except (ValueError, TypeError):
            result[pid] = None
    print(f'  {len(result)} draft picks loaded')
    return result


def main() -> None:
    # 1. League-wide stats → identify starters per team
    all_stats = fetch_league_stats()

    # Group by team, sort by GS desc, take top 5
    from collections import defaultdict
    team_players: dict[str, list[dict]] = defaultdict(list)
    for row in all_stats:
        abbr = row['TEAM_ABBREVIATION']
        if abbr in NBA_TEAMS:
            team_players[abbr].append(row)

    team_starters: dict[str, list[str]] = {}  # abbr → [player_id, ...]
    for abbr, players in team_players.items():
        sorted_p = sorted(players, key=lambda x: float(x.get('MIN', 0) or 0), reverse=True)
        top5 = sorted_p[:5]
        team_starters[abbr] = [p['PLAYER_ID'] for p in top5]
        names = [p['PLAYER_NAME'] for p in top5]
        print(f'  {abbr}: {", ".join(names)}')

    all_starter_ids = set(pid for pids in team_starters.values() for pid in pids)
    print(f'\nTotal unique starters: {len(all_starter_ids)}')

    # 2. Fetch roster data per team (jersey number + position)
    print('\nFetching rosters (jersey + position)...')
    roster_lookup: dict[str, dict] = {}  # player_id → {number, raw_pos}
    for abbr, team_id in sorted(NBA_TEAMS.items()):
        print(f'  {abbr}...', end=' ', flush=True)
        roster = fetch_roster(abbr, team_id)
        roster_lookup.update(roster)
        print(f'{len(roster)} players')

    # 3. College + draft from local files (no per-player API calls)
    print('\nLoading bio data from local files...')
    bio_lookup = load_bio_lookup()

    # 4. Draft picks from single DraftHistory call
    draft_lookup = fetch_draft_lookup()

    # Merge draft picks into bio_lookup; fall back for any player not in bio_lookup
    for pid in all_starter_ids:
        if pid not in bio_lookup:
            bio_lookup[pid] = {'college': None, 'draft_pick': None}
        bio_lookup[pid]['draft_pick'] = draft_lookup.get(pid)

    uncovered = [pid for pid in all_starter_ids if not bio_lookup.get(pid, {}).get('college')]
    if uncovered:
        print(f'  WARN: {len(uncovered)} starters have no college data: {uncovered}')

    # 5. Build output
    # Build name + ppg lookups from all_stats
    name_lookup = {row['PLAYER_ID']: row['PLAYER_NAME'] for row in all_stats}
    ppg_lookup  = {row['PLAYER_ID']: round(float(row['PTS']), 1) for row in all_stats}

    result: dict[str, dict] = {}
    for abbr in sorted(NBA_TEAMS.keys()):
        starter_ids = team_starters.get(abbr, [])
        if len(starter_ids) < 5:
            print(f'  WARN: {abbr} only has {len(starter_ids)} starters')

        players_raw = []
        for pid in starter_ids[:5]:
            roster_info = roster_lookup.get(pid, {})
            bio = bio_lookup.get(pid, {})
            college = bio.get('college')
            college_espn_id = COLLEGE_ESPN_ID.get(college) if college else None
            players_raw.append({
                'id': pid,
                'name': name_lookup.get(pid, pid),
                '_raw_pos': roster_info.get('raw_pos', 'G'),
                'number': roster_info.get('number'),
                'college': college,
                'college_espn_id': college_espn_id,
                'draft_pick': bio.get('draft_pick'),
                'ppg': ppg_lookup.get(pid),
            })

        starters = canonical_slot(players_raw)
        result[abbr] = {'starters': starters}

    # 5. Report
    print(f'\nTeams: {sorted(result.keys())} ({len(result)} total)')
    issues = []
    for abbr in sorted(result.keys()):
        n = len(result[abbr]['starters'])
        flag = ' ⚠' if n < 5 else ''
        print(f'  {abbr}: {n} starters{flag}')
        if n < 5:
            issues.append(abbr)
    if issues:
        print(f'\nWARN: low count for {issues}')

    # 6. Write
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUT_FILE, 'w') as f:
        json.dump(result, f, indent=2)
    print(f'\nWrote {OUT_FILE}')
    print('Done.')


if __name__ == '__main__':
    main()
