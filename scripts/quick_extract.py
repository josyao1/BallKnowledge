#!/usr/bin/env python3
"""
Quick extraction script for testing - extracts a few popular teams/seasons.

*** ARCHIVED — SUPERSEDED BY generate_nba_rosters.py ***
Was used to test the old extract_rosters.py pipeline before a full run.
Both this and extract_rosters.py are replaced by generate_nba_rosters.py.
Safe to delete.

Original description:
Run this first to verify the pipeline works before running the full extraction.

Usage:
    python quick_extract.py
"""

import subprocess
import sys

# A curated set of popular/iconic team-seasons for testing
TEST_CASES = [
    # Recent championship teams
    ("BOS", 2023, 2024),   # 2024 Champions
    ("DEN", 2022, 2023),   # 2023 Champions
    ("GSW", 2021, 2022),   # 2022 Champions
    ("MIL", 2020, 2021),   # 2021 Champions
    ("LAL", 2019, 2020),   # 2020 Champions

    # Iconic teams
    ("CHI", 1995, 1996),   # 72-10 Bulls
    ("GSW", 2015, 2016),   # 73-9 Warriors
    ("MIA", 2012, 2013),   # Heatles
    ("LAL", 2009, 2010),   # Kobe's 5th ring

    # Current contenders (2023-24)
    ("LAL", 2023, 2024),
    ("PHX", 2023, 2024),
    ("OKC", 2023, 2024),
    ("MIN", 2023, 2024),
    ("NYK", 2023, 2024),
]


def main():
    # Get unique teams and year range
    teams = list(set(tc[0] for tc in TEST_CASES))
    min_year = min(tc[1] for tc in TEST_CASES)
    max_year = max(tc[2] for tc in TEST_CASES)

    print("Quick Extract - Testing Data Pipeline")
    print("=" * 50)
    print(f"Teams: {', '.join(teams)}")
    print(f"Years: {min_year} - {max_year}")
    print("=" * 50)

    # Run the main extraction script with limited scope
    cmd = [
        sys.executable,
        "extract_rosters.py",
        f"--teams={','.join(teams)}",
        f"--start-year={min_year}",
        f"--end-year={max_year}"
    ]

    subprocess.run(cmd, cwd=str(__file__).rsplit("/", 1)[0])


if __name__ == "__main__":
    main()
