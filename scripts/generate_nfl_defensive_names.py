#!/usr/bin/env python3
"""
generate_nfl_defensive_names.py — Build a name-only list of notable NFL defensive players.

Run this once to populate the scramble pool with defensive players:
    python scripts/generate_nfl_defensive_names.py

Output: public/data/nfl_defensive_names.json
        (array of player name strings — names only, no stats)

Eligibility: 5+ seasons on an NFL roster AND position-specific production (PFR 2018-present):
    Pass rushers (DE/OLB):    career sacks >= 30
    Interior    (DT/NT/DL):   career sacks >= 15
    Linebackers (LB/MLB/ILB): career combined tackles >= 500
    Corners     (CB):         career interceptions >= 10
    Safeties    (S/SS/FS):    career interceptions >= 8 OR career tackles >= 400
"""

import json
import os
import sys

try:
    import nfl_data_py as nfl
    import pandas as pd
except ImportError:
    print("ERROR: nfl_data_py not installed. Run: pip install nfl-data-py pandas")
    sys.exit(1)

# ─── Config ───────────────────────────────────────────────────────────────────

ROSTER_YEARS       = list(range(2002, 2025))
DEFENSIVE_POSITIONS = {"DB", "DL", "LB"}   # broad position groups in roster data
MIN_SEASONS         = 5

# PFR position normalisation
PASS_RUSHER_POS = {"DE", "RDE", "LDE", "LOLB", "ROLB", "OLB"}
INTERIOR_POS    = {"DT", "RDT", "LDT", "NT", "DL", "NB"}
LINEBACKER_POS  = {"LB", "MLB", "ILB", "LILB", "RILB", "LLB", "RLB"}
CORNER_POS      = {"CB", "RCB", "LCB", "DB"}
SAFETY_POS      = {"S", "SS", "FS"}

OUT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "public", "data", "nfl_defensive_names.json"
)

# ─── Helpers ──────────────────────────────────────────────────────────────────

def safe_str(val, default=""):
    if val is None:
        return default
    s = str(val)
    return default if s in ("nan", "None", "") else s


def normalize_pfr_pos(pos_str):
    if not pos_str or pos_str in ("nan", "None"):
        return None
    p = pos_str.upper().split("/")[0].split("-")[0].strip()
    if p in PASS_RUSHER_POS:
        return "PASS_RUSHER"
    if p in INTERIOR_POS:
        return "INTERIOR"
    if p in LINEBACKER_POS:
        return "LB"
    if p in CORNER_POS:
        return "CB"
    if p in SAFETY_POS:
        return "SAFETY"
    return None


def is_pfr_notable(row) -> bool:
    pg = row["pos_group"]
    if not pg:
        return False
    if pg == "PASS_RUSHER" and row["career_sk"] >= 30:
        return True
    if pg == "INTERIOR"    and row["career_sk"] >= 15:
        return True
    if pg == "LB"          and row["career_comb"] >= 500:
        return True
    if pg == "CB"          and row["career_int"] >= 10:
        return True
    if pg == "SAFETY"      and (row["career_int"] >= 8 or row["career_comb"] >= 400):
        return True
    return False


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

    # ── Roster: 5+ seasons + defensive position ───────────────────────────────
    print(f"Loading roster data ({ROSTER_YEARS[0]}–{ROSTER_YEARS[-1]})...")
    roster_df = nfl.import_seasonal_rosters(ROSTER_YEARS)
    if roster_df is None or roster_df.empty:
        print("ERROR: Failed to load roster data")
        sys.exit(1)

    roster_df = roster_df.drop_duplicates(subset=["player_id", "season"], keep="first")
    def_df    = roster_df[roster_df["position"].isin(DEFENSIVE_POSITIONS)].copy()

    seasons_cnt = def_df.groupby("player_id")["season"].nunique()
    eligible_pids = set(seasons_cnt[seasons_cnt >= MIN_SEASONS].index)
    print(f"  Defensive players with {MIN_SEASONS}+ seasons: {len(eligible_pids)}")

    # Latest row per eligible player (for name + pfr_id lookup)
    latest = (
        def_df[def_df["player_id"].isin(eligible_pids)]
        .sort_values("season")
        .groupby("player_id")
        .last()
        .reset_index()
    )
    # Build lookup: pfr_id → player_name
    pfr_to_name: dict[str, str] = {}
    for _, row in latest.iterrows():
        pid = safe_str(row.get("pfr_id"))
        name = safe_str(row.get("player_name"))
        if pid and name:
            pfr_to_name[pid] = name

    print(f"  Players with pfr_id: {len(pfr_to_name)}")

    # ── PFR: aggregate career defensive stats ─────────────────────────────────
    print("\nLoading PFR defensive seasonal stats...")
    try:
        pfr_df = nfl.import_seasonal_pfr("def")
    except Exception as e:
        print(f"ERROR: Could not load PFR data: {e}")
        sys.exit(1)

    if pfr_df is None or pfr_df.empty:
        print("ERROR: PFR data empty")
        sys.exit(1)

    print(f"  PFR rows: {len(pfr_df)}, years: {pfr_df['season'].min()}–{pfr_df['season'].max()}")

    pfr_df["_pos_group"] = pfr_df["pos"].apply(normalize_pfr_pos)
    pfr_df["sk"]   = pd.to_numeric(pfr_df["sk"],   errors="coerce").fillna(0)
    pfr_df["int"]  = pd.to_numeric(pfr_df["int"],  errors="coerce").fillna(0)
    pfr_df["comb"] = pd.to_numeric(pfr_df["comb"], errors="coerce").fillna(0)

    career = (
        pfr_df.groupby("pfr_id")
        .agg(
            player    =("player", "last"),
            pos_group =("_pos_group", lambda x: x.dropna().mode().iloc[0] if not x.dropna().empty else None),
            career_sk =("sk",   "sum"),
            career_int=("int",  "sum"),
            career_comb=("comb","sum"),
        )
        .reset_index()
    )

    # Keep only players who are in our eligible roster set (5+ seasons)
    career = career[career["pfr_id"].isin(pfr_to_name)]
    print(f"  Eligible players found in PFR data: {len(career)}")

    # Apply position-based production filter
    notable = career[career.apply(is_pfr_notable, axis=1)]
    print(f"  Passed production filter: {len(notable)}")

    # ── Build name list ───────────────────────────────────────────────────────
    names: set[str] = set()
    for _, row in notable.iterrows():
        name = pfr_to_name.get(safe_str(row["pfr_id"]), "")
        if not name:
            name = safe_str(row.get("player"))
        if name and len(name.strip().split()) >= 2:
            names.add(name)

    names_list = sorted(names)
    print(f"\nFinal pool: {len(names_list)} notable defensive players")

    with open(OUT_PATH, "w") as f:
        json.dump(names_list, f, separators=(",", ":"))

    size_kb = os.path.getsize(OUT_PATH) / 1024
    print(f"Written: {OUT_PATH}  ({size_kb:.1f} KB)")

    # ── Breakdown by position group ───────────────────────────────────────────
    print("\nBreakdown:")
    for pg in ["PASS_RUSHER", "INTERIOR", "LB", "CB", "SAFETY"]:
        count = notable[notable["pos_group"] == pg].shape[0]
        print(f"  {pg:12s}: {count}")

    print("\nSample names:")
    for n in names_list[:20]:
        print(f"  {n}")


if __name__ == "__main__":
    main()
