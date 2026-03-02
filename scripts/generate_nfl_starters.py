"""
generate_nfl_starters.py — Build public/data/nfl/starters_2025.json

Uses nfl_data_py to pull 2025 depth charts and roster data for all 32 NFL teams.
Outputs: team → { offense: [exactly 11], defense: [exactly 11] }

Offense canonical 11:
  QB(1), LT(1), LG(1), C(1), RG(1), RT(1), WR(3), TE(1), RB(1), [FB optional]

Defense canonical 11:
  LDE(1), RDE(1), NT/LDT(1), RDT(1), WLB/LILB(1), MLB(1), SLB/RILB(1),
  LCB(1), RCB(1), SS(1), FS(1)

Picks most recent depth chart snapshot per slot.

Run:
  cd scripts && python generate_nfl_starters.py
"""

import json
import os
import sys
import pandas as pd
import nfl_data_py as nfl

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'nfl')
OUT_FILE = os.path.join(OUT_DIR, 'starters_2025.json')

COLLEGE_ESPN_ID: dict[str, int] = {
    'Alabama': 333, 'Arizona': 12, 'Arizona State': 9, 'Arkansas': 8, 'Auburn': 2,
    'Baylor': 239, 'Boston College': 103, 'BYU': 252, 'California': 25, 'Clemson': 228,
    'Colorado': 38, 'Duke': 150, 'Florida': 57, 'Florida State': 52, 'Georgia': 61,
    'Georgia Tech': 59, 'Illinois': 356, 'Indiana': 84, 'Iowa': 2294, 'Iowa State': 66,
    'Kansas': 2305, 'Kansas State': 2306, 'Kentucky': 96, 'LSU': 99, 'Louisville': 97,
    'Maryland': 120, 'Michigan': 130, 'Michigan State': 127, 'Minnesota': 135,
    'Mississippi': 145, 'Mississippi State': 344, 'Missouri': 142, 'Nebraska': 158,
    'North Carolina': 153, 'North Carolina State': 152, 'N.C. State': 152, 'NC State': 152,
    'Northwestern': 77, 'Notre Dame': 87, 'Ohio State': 194, 'Oklahoma': 201,
    'Oklahoma State': 197, 'Ole Miss': 145, 'Oregon': 2483, 'Oregon State': 204,
    'Penn State': 213, 'Pittsburgh': 221, 'Purdue': 2509, 'Rutgers': 164,
    'South Carolina': 2579, 'Stanford': 24, 'Syracuse': 183, 'TCU': 2628,
    'Tennessee': 2633, 'Texas': 251, 'Texas A&M': 245, 'Texas Tech': 2641,
    'UCLA': 26, 'USC': 30, 'Utah': 254, 'Vanderbilt': 238, 'Virginia': 258,
    'Virginia Tech': 259, 'Wake Forest': 154, 'Washington': 264, 'Washington State': 265,
    'West Virginia': 277, 'Wisconsin': 275,
    # Misc
    'Air Force': 2005, 'Akron': 2006, 'App State': 2026, 'Appalachian State': 2026,
    'Arkansas State': 2032, 'Army': 349, 'Ball State': 2050, 'Boise State': 68,
    'Bowling Green': 189, 'Buffalo': 2084, 'Central Michigan': 2117, 'Charlotte': 2429,
    'Cincinnati': 2132, 'Coastal Carolina': 324, 'Connecticut': 41, 'East Carolina': 151,
    'Eastern Michigan': 2199, 'FIU': 2229, 'FAU': 2226, 'Florida Atlantic': 2226,
    'Florida International': 2229, 'Fresno State': 278, 'Georgia Southern': 290,
    'Georgia State': 2247, 'Hawaii': 62, 'Houston': 248, 'Idaho': 70,
    'Kent State': 2309, 'Liberty': 2335, 'Louisiana': 309, 'Louisiana Tech': 2348,
    'Marshall': 276, 'Memphis': 235, 'Miami': 2390, 'Miami (FL)': 2390,
    'Miami (Ohio)': 193, 'Middle Tennessee': 2393, 'Navy': 2426, 'Nevada': 2440,
    'New Mexico': 167, 'New Mexico State': 166, 'North Texas': 249,
    'Northern Illinois': 2459, 'Ohio': 195, 'Old Dominion': 295, 'Rice': 242,
    'San Diego State': 21, 'San Jose State': 23, 'SMU': 2567, 'South Alabama': 6,
    'South Florida': 58, 'Southern Miss': 2572, 'Temple': 218, 'Texas State': 326,
    'Toledo': 2649, 'Troy': 2653, 'Tulane': 2655, 'Tulsa': 202, 'UAB': 2663,
    'UNLV': 2439, 'UTEP': 2638, 'UTSA': 2636, 'Western Kentucky': 98,
    'Western Michigan': 2711, 'Wyoming': 2751,
    # HBCUs / FCS
    'Grambling': 2755, 'Hampton': 2291, 'Howard': 47, 'Morgan State': 2413,
    'Prairie View': 2504, 'Prairie View A&M': 2504, 'Southern': 2582,
    'Tennessee State': 2616, 'Bethune-Cookman': 2060, 'Delaware': 48,
    'Eastern Washington': 331, 'Fordham': 56, 'Illinois State': 2210,
    'James Madison': 256, 'Montana': 149, 'Montana State': 147,
    'North Dakota State': 2449, 'Northern Iowa': 2534, 'Sacramento State': 16,
    'Sam Houston': 2534, 'South Dakota State': 2571, 'Stephen F. Austin': 2597,
    'Weber State': 2692, 'Youngstown State': 2752,
}

TEAM_ALIAS = {
    'JAC': 'JAX', 'LA': 'LAR', 'OAK': 'LV',
    'SD': 'LAC', 'STL': 'LAR', 'WSH': 'WAS',
}

# Filter by pos_abb to be formation-agnostic (pos_grp varies by team package)
OFFENSE_POS = {'QB', 'WR', 'TE', 'RB', 'LT', 'LG', 'C', 'RG', 'RT'}
DEFENSE_POS = {'LDE', 'RDE', 'NT', 'LDT', 'RDT', 'WLB', 'MLB', 'SLB', 'LILB', 'RILB', 'LCB', 'RCB', 'SS', 'FS', 'NB', 'SAF'}

# Canonical display order for offense and defense (no FB)
OFFENSE_DISPLAY_ORDER = ['LT', 'LG', 'C', 'RG', 'RT', 'TE', 'WR', 'QB', 'RB']
DEFENSE_DISPLAY_ORDER = ['LDE', 'LDT', 'NT', 'RDT', 'RDE', 'WLB', 'LILB', 'MLB', 'RILB', 'SLB', 'LCB', 'RCB', 'SS', 'FS']


def pick_latest(group: pd.DataFrame) -> pd.Series:
    """Return the row with the most recent dt from a group."""
    return group.sort_values('dt', ascending=False).iloc[0]


def build_side(starters: pd.DataFrame, side: str) -> list[dict]:
    """
    Build exactly 11 canonical starters for offense or defense.
    starters: already filtered to pos_rank==1 for one team + one side (pos_grp).
    Returns list of player dicts.
    """
    # Latest entry per (gsis_id, pos_abb)
    best = (
        starters.groupby(['gsis_id', 'pos_abb'], group_keys=False)
        .apply(pick_latest)
        .reset_index(drop=True)
    )

    def take_one(pos_list: list[str]):
        """Pick the most recent starter from any of the given positions."""
        candidates = best[best['pos_abb'].isin(pos_list)]
        if candidates.empty:
            return None
        return candidates.sort_values('dt', ascending=False).iloc[0]

    def take_n(pos_list: list[str], n: int) -> list[pd.Series]:
        """Pick up to n most recent unique starters from given positions."""
        candidates = best[best['pos_abb'].isin(pos_list)].copy()
        if candidates.empty:
            return []
        # Sort latest per player
        candidates = candidates.sort_values('dt', ascending=False)
        # Deduplicate by gsis_id
        seen: set[str] = set()
        rows = []
        for _, row in candidates.iterrows():
            if row['gsis_id'] not in seen:
                seen.add(row['gsis_id'])
                rows.append(row)
                if len(rows) == n:
                    break
        return rows

    players: list[pd.Series] = []

    if side == 'offense':
        # Exact slots
        for pos in ['LT', 'LG', 'C', 'RG', 'RT']:
            r = take_one([pos])
            if r is not None:
                players.append(r)
        # TE
        r = take_one(['TE'])
        if r is not None:
            players.append(r)
        # 3 WRs (unique players)
        players.extend(take_n(['WR'], 3))
        # QB
        r = take_one(['QB'])
        if r is not None:
            players.append(r)
        # RB
        r = take_one(['RB'])
        if r is not None:
            players.append(r)
        # No FB — always use WRs only

    else:  # defense
        # DEs
        r = take_one(['LDE'])
        if r is not None:
            players.append(r)
        r = take_one(['RDE'])
        if r is not None:
            players.append(r)
        # Interior DL — pick 2 from NT, LDT, RDT (covering 3-4 and 4-3)
        interior = take_n(['NT', 'LDT', 'RDT'], 2)
        # Prefer LDT+RDT if both present; otherwise NT+one
        ldt = [p for p in interior if p['pos_abb'] == 'LDT']
        rdt = [p for p in interior if p['pos_abb'] == 'RDT']
        nt = [p for p in interior if p['pos_abb'] == 'NT']
        if ldt and rdt:
            players.extend(ldt[:1])
            players.extend(rdt[:1])
        elif nt and (ldt or rdt):
            players.extend(nt[:1])
            players.extend((ldt + rdt)[:1])
        else:
            players.extend(interior[:2])
        # LBs — prefer WLB, MLB, SLB; fall back to LILB/RILB
        lb_rows = take_n(['WLB', 'MLB', 'SLB', 'LILB', 'RILB'], 3)
        # Canonical mapping: prefer exactly one WLB/LILB, one MLB, one SLB/RILB
        wlb = [p for p in lb_rows if p['pos_abb'] in ('WLB', 'LILB')]
        mlb = [p for p in lb_rows if p['pos_abb'] == 'MLB']
        slb = [p for p in lb_rows if p['pos_abb'] in ('SLB', 'RILB')]
        for group in [wlb[:1], mlb[:1], slb[:1]]:
            players.extend(group)
        # CBs
        r = take_one(['LCB'])
        if r is not None:
            players.append(r)
        r = take_one(['RCB'])
        if r is not None:
            players.append(r)
        # Safeties
        r = take_one(['SS'])
        if r is not None:
            players.append(r)
        r = take_one(['FS'])
        if r is not None:
            players.append(r)

    # Deduplicate by gsis_id, keep first occurrence
    seen: set[str] = set()
    unique = []
    for row in players:
        if row['gsis_id'] not in seen:
            seen.add(row['gsis_id'])
            unique.append(row)

    # Sort by canonical display order
    order = OFFENSE_DISPLAY_ORDER if side == 'offense' else DEFENSE_DISPLAY_ORDER
    def sort_key(row: pd.Series) -> int:
        try:
            return order.index(row['pos_abb'])
        except ValueError:
            return len(order)
    unique.sort(key=sort_key)

    return unique


def main() -> None:
    print("Loading 2025 depth charts...")
    try:
        dc_raw = nfl.import_depth_charts([2025])
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"  rows={len(dc_raw)}, cols={list(dc_raw.columns)}")

    # Starters only (pos_rank == 1) for all positions
    dc = dc_raw[dc_raw['pos_rank'] == 1].copy()
    # Drop special teams
    dc = dc[dc['pos_grp'] != 'Special Teams'].copy()

    # WR depth pool (pos_rank <= 3) — used to top up teams with fewer than 3 WR starters
    dc_wr_depth = dc_raw[
        (dc_raw['pos_abb'] == 'WR') &
        (dc_raw['pos_rank'] <= 3) &
        (dc_raw['pos_grp'] != 'Special Teams')
    ].copy()

    print("Loading 2025 rosters for jersey / college / draft data...")
    try:
        roster_raw = nfl.import_seasonal_rosters([2025])
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"  roster rows={len(roster_raw)}")

    # Build roster lookup: player_id → {number, college, college_espn_id, draft_pick}
    roster_lookup: dict[str, dict] = {}
    for _, row in roster_raw.drop_duplicates('player_id').iterrows():
        pid = str(row.get('player_id', ''))
        if not pid or pid == 'nan':
            continue
        jersey_val = row.get('jersey_number', None)
        jersey = str(int(jersey_val)) if pd.notna(jersey_val) else None
        college_raw = str(row.get('college', '')) if pd.notna(row.get('college')) else None
        # nfl_data_py sometimes returns "School1; School2" — take the first only
        college = college_raw.split(';')[0].strip() if college_raw else None
        draft_n = row.get('draft_number', None)
        draft_pick = int(draft_n) if pd.notna(draft_n) and draft_n else None
        college_espn_id = COLLEGE_ESPN_ID.get(college) if college else None
        roster_lookup[pid] = {
            'number': jersey,
            'college': college,
            'college_espn_id': college_espn_id,
            'draft_pick': draft_pick,
        }

    # Build per-team output
    result: dict[str, dict] = {}
    teams_in_dc = dc['team'].unique()

    for team_raw in sorted(teams_in_dc):
        team = TEAM_ALIAS.get(str(team_raw), str(team_raw))
        team_dc = dc[dc['team'] == team_raw]

        sides: dict[str, list] = {'offense': [], 'defense': []}

        for side in ('offense', 'defense'):
            pos_set = OFFENSE_POS if side == 'offense' else DEFENSE_POS
            side_dc = team_dc[team_dc['pos_abb'].isin(pos_set)]

            # Top up WRs to 3 using pos_rank <= 3 if starter depth chart is thin
            if side == 'offense':
                wr_supplement = dc_wr_depth[dc_wr_depth['team'] == team_raw]
                if not wr_supplement.empty:
                    side_dc = pd.concat([side_dc, wr_supplement])
                    # build_side deduplicates by gsis_id internally

            if side_dc.empty:
                continue

            rows = build_side(side_dc, side)

            players_out = []
            for row in rows:
                gsis_id = str(row['gsis_id'])
                roster_info = roster_lookup.get(gsis_id, {})
                players_out.append({
                    'id': gsis_id,
                    'name': str(row['player_name']),
                    'pos_abb': str(row['pos_abb']),
                    'number': roster_info.get('number'),
                    'college': roster_info.get('college'),
                    'college_espn_id': roster_info.get('college_espn_id'),
                    'draft_pick': roster_info.get('draft_pick'),
                })
            sides[side] = players_out

        result[team] = sides

    # Report
    print(f"\nTeams: {sorted(result.keys())} ({len(result)} total)")
    issues: list[str] = []
    for team in sorted(result.keys()):
        off = len(result[team]['offense'])
        df = len(result[team]['defense'])
        flag = ' ⚠' if off < 9 or df < 9 else ''
        print(f"  {team}: {off} offense, {df} defense{flag}")
        if off < 9 or df < 9:
            issues.append(team)

    if issues:
        print(f"\nWARN: low player count for {issues}")

    # Write
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT_FILE, 'w') as f:
        json.dump(result, f, indent=2)
    print(f"\nWrote {OUT_FILE}")
    print("Done.")


if __name__ == '__main__':
    main()
