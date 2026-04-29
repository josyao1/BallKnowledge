#!/usr/bin/env python3
"""
patch_nba_legends.py — Inject missing NBA legends into nba_careers.json and nba_lineup_pool.json.

Stats sourced from Basketball Reference (per-game season totals).
Players here are missing from the DB because they retired before the automated
careers scraper's qualifying window.

Run:
    cd scripts
    python patch_nba_legends.py
After:
    cp data/nba_careers.json ../public/data/nba_careers.json
    cp data/nba_lineup_pool.json ../public/data/nba_lineup_pool.json
"""

import json, os

SCRIPT_DIR   = os.path.dirname(__file__)
CAREERS_PATH = os.path.join(SCRIPT_DIR, "data", "nba_careers.json")
LINEUP_PATH  = os.path.join(SCRIPT_DIR, "data", "nba_lineup_pool.json")

# Fall back to public/data if scripts/data copies don't exist
if not os.path.exists(CAREERS_PATH):
    CAREERS_PATH = os.path.join(SCRIPT_DIR, "..", "public", "data", "nba_careers.json")
if not os.path.exists(LINEUP_PATH):
    LINEUP_PATH = os.path.join(SCRIPT_DIR, "..", "public", "data", "nba_lineup_pool.json")

# ─── Legend definitions ────────────────────────────────────────────────────────
# Each entry needs:
#   player_id   — use a unique negative int (negative avoids collision with real NBA API IDs)
#   player_name — full name as it should appear in autocomplete
#   seasons     — list of per-game season dicts matching the careers.json schema:
#                 season, team, gp, min, pts, reb, ast, stl, blk, fg_pct, fg3_pct
#                 fg3m, ftm, pf are optional but included where available
#
# Stats from Basketball Reference. 3P stats not tracked pre-1979-80.
# stl/blk not tracked pre-1973-74 — use 0.0 as placeholder for those seasons.

NBA_LEGENDS = [

    # ── Kareem Abdul-Jabbar ────────────────────────────────────────────────────
    # Source: Basketball Reference
    {
        "player_id": -1,
        "player_name": "Kareem Abdul-Jabbar",
        "seasons": [
            {"season":"1969-70","team":"MIL","gp":82,"min":43.1,"pts":28.8,"reb":14.5,"ast":4.1,"stl":0.0,"blk":0.0,"fg_pct":0.518,"fg3_pct":0.0,"ftm":5.9,"pf":3.5},
            {"season":"1970-71","team":"MIL","gp":82,"min":40.1,"pts":31.7,"reb":16.0,"ast":3.3,"stl":0.0,"blk":0.0,"fg_pct":0.577,"fg3_pct":0.0,"ftm":5.7,"pf":3.2},
            {"season":"1971-72","team":"MIL","gp":81,"min":44.2,"pts":34.8,"reb":16.6,"ast":4.6,"stl":0.0,"blk":0.0,"fg_pct":0.574,"fg3_pct":0.0,"ftm":6.2,"pf":2.9},
            {"season":"1972-73","team":"MIL","gp":76,"min":42.8,"pts":30.2,"reb":16.1,"ast":5.0,"stl":0.0,"blk":0.0,"fg_pct":0.554,"fg3_pct":0.0,"ftm":4.3,"pf":2.7},
            {"season":"1973-74","team":"MIL","gp":81,"min":43.8,"pts":27.0,"reb":14.5,"ast":4.8,"stl":1.4,"blk":3.5,"fg_pct":0.539,"fg3_pct":0.0,"ftm":3.6,"pf":2.9},
            {"season":"1974-75","team":"MIL","gp":65,"min":42.3,"pts":30.0,"reb":14.0,"ast":4.1,"stl":1.0,"blk":3.3,"fg_pct":0.513,"fg3_pct":0.0,"ftm":5.0,"pf":3.2},
            {"season":"1975-76","team":"LAL","gp":82,"min":41.2,"pts":27.7,"reb":16.9,"ast":5.0,"stl":1.5,"blk":4.1,"fg_pct":0.529,"fg3_pct":0.0,"ftm":5.5,"pf":3.6},
            {"season":"1976-77","team":"LAL","gp":82,"min":36.8,"pts":26.2,"reb":13.3,"ast":3.9,"stl":1.2,"blk":3.2,"fg_pct":0.579,"fg3_pct":0.0,"ftm":4.6,"pf":3.2},
            {"season":"1977-78","team":"LAL","gp":62,"min":36.5,"pts":25.8,"reb":12.9,"ast":4.3,"stl":1.7,"blk":3.0,"fg_pct":0.550,"fg3_pct":0.0,"ftm":4.4,"pf":2.9},
            {"season":"1978-79","team":"LAL","gp":80,"min":39.5,"pts":23.8,"reb":12.8,"ast":5.4,"stl":1.0,"blk":4.0,"fg_pct":0.577,"fg3_pct":0.0,"ftm":4.4,"pf":2.9},
            {"season":"1979-80","team":"LAL","gp":82,"min":38.3,"pts":24.8,"reb":10.8,"ast":4.5,"stl":1.0,"blk":3.4,"fg_pct":0.604,"fg3_pct":0.0,"ftm":4.4,"pf":2.6},
            {"season":"1980-81","team":"LAL","gp":80,"min":37.2,"pts":26.2,"reb":10.3,"ast":3.4,"stl":0.7,"blk":2.9,"fg_pct":0.574,"fg3_pct":0.0,"ftm":5.3,"pf":3.1},
            {"season":"1981-82","team":"LAL","gp":76,"min":35.2,"pts":23.9,"reb":8.7, "ast":3.0,"stl":0.8,"blk":2.7,"fg_pct":0.579,"fg3_pct":0.0,"ftm":4.1,"pf":2.9},
            {"season":"1982-83","team":"LAL","gp":79,"min":32.3,"pts":21.8,"reb":7.5, "ast":2.5,"stl":0.8,"blk":2.2,"fg_pct":0.588,"fg3_pct":0.0,"ftm":3.5,"pf":2.8},
            {"season":"1983-84","team":"LAL","gp":80,"min":32.8,"pts":21.5,"reb":7.3, "ast":2.6,"stl":0.7,"blk":1.8,"fg_pct":0.578,"fg3_pct":0.0,"ftm":3.6,"pf":2.6},
            {"season":"1984-85","team":"LAL","gp":79,"min":33.3,"pts":22.0,"reb":7.9, "ast":3.2,"stl":0.8,"blk":2.1,"fg_pct":0.599,"fg3_pct":0.0,"ftm":3.7,"pf":3.0},
            {"season":"1985-86","team":"LAL","gp":79,"min":33.3,"pts":23.4,"reb":6.1, "ast":3.5,"stl":0.8,"blk":1.6,"fg_pct":0.564,"fg3_pct":0.0,"ftm":4.3,"pf":3.1},
            {"season":"1986-87","team":"LAL","gp":78,"min":31.3,"pts":17.5,"reb":6.7, "ast":2.6,"stl":0.6,"blk":1.2,"fg_pct":0.564,"fg3_pct":0.333,"ftm":3.1,"pf":3.1},
            {"season":"1987-88","team":"LAL","gp":80,"min":28.9,"pts":14.6,"reb":6.0, "ast":1.7,"stl":0.6,"blk":1.2,"fg_pct":0.532,"fg3_pct":0.0,"ftm":2.6,"pf":2.7},
            {"season":"1988-89","team":"LAL","gp":74,"min":22.9,"pts":10.1,"reb":4.5, "ast":1.0,"stl":0.5,"blk":1.1,"fg_pct":0.475,"fg3_pct":0.0,"ftm":1.6,"pf":2.6},
        ],
    },

    # ── Magic Johnson ──────────────────────────────────────────────────────────
    {
        "player_id": -2,
        "player_name": "Magic Johnson",
        "seasons": [
            {"season":"1979-80","team":"LAL","gp":77,"min":36.3,"pts":18.0,"reb":7.7,"ast":7.3,"stl":2.4,"blk":0.5,"fg_pct":0.530,"fg3_pct":0.226,"ftm":4.9,"pf":2.8},
            {"season":"1980-81","team":"LAL","gp":37,"min":37.1,"pts":21.6,"reb":8.6,"ast":8.6,"stl":3.4,"blk":0.7,"fg_pct":0.532,"fg3_pct":0.176,"ftm":4.6,"pf":2.7},
            {"season":"1981-82","team":"LAL","gp":78,"min":38.3,"pts":18.6,"reb":9.6,"ast":9.5,"stl":2.7,"blk":0.4,"fg_pct":0.537,"fg3_pct":0.207,"ftm":4.2,"pf":2.9},
            {"season":"1982-83","team":"LAL","gp":79,"min":36.8,"pts":16.8,"reb":8.6,"ast":10.5,"stl":2.2,"blk":0.6,"fg_pct":0.548,"fg3_pct":0.000,"ftm":3.8,"pf":2.5},
            {"season":"1983-84","team":"LAL","gp":67,"min":38.3,"pts":17.6,"reb":7.3,"ast":13.1,"stl":2.2,"blk":0.7,"fg_pct":0.565,"fg3_pct":0.207,"ftm":4.3,"pf":2.5},
            {"season":"1984-85","team":"LAL","gp":77,"min":36.1,"pts":18.3,"reb":6.2,"ast":12.6,"stl":1.5,"blk":0.3,"fg_pct":0.561,"fg3_pct":0.189,"ftm":5.1,"pf":2.0},
            {"season":"1985-86","team":"LAL","gp":72,"min":35.8,"pts":18.8,"reb":5.9,"ast":12.6,"stl":1.6,"blk":0.2,"fg_pct":0.526,"fg3_pct":0.233,"ftm":5.3,"pf":1.8},
            {"season":"1986-87","team":"LAL","gp":80,"min":36.3,"pts":23.9,"reb":6.3,"ast":12.2,"stl":1.7,"blk":0.5,"fg_pct":0.522,"fg3_pct":0.205,"ftm":6.7,"pf":2.1},
            {"season":"1987-88","team":"LAL","gp":72,"min":36.6,"pts":19.6,"reb":6.2,"ast":11.9,"stl":1.6,"blk":0.2,"fg_pct":0.492,"fg3_pct":0.196,"ftm":5.8,"pf":2.0},
            {"season":"1988-89","team":"LAL","gp":77,"min":37.5,"pts":22.5,"reb":7.9,"ast":12.8,"stl":1.8,"blk":0.3,"fg_pct":0.509,"fg3_pct":0.314,"ftm":6.7,"pf":2.2},
            {"season":"1989-90","team":"LAL","gp":79,"min":37.2,"pts":22.3,"reb":6.6,"ast":11.5,"stl":1.7,"blk":0.4,"fg_pct":0.480,"fg3_pct":0.384,"ftm":7.2,"pf":2.1},
            {"season":"1990-91","team":"LAL","gp":79,"min":37.1,"pts":19.4,"reb":7.0,"ast":12.5,"stl":1.3,"blk":0.2,"fg_pct":0.477,"fg3_pct":0.320,"ftm":6.6,"pf":1.9},
            {"season":"1995-96","team":"LAL","gp":32,"min":29.9,"pts":14.6,"reb":5.7,"ast":6.9,"stl":0.8,"blk":0.4,"fg_pct":0.466,"fg3_pct":0.379,"ftm":5.4,"pf":1.5},
        ],
    },

    # ── Wilt Chamberlain ───────────────────────────────────────────────────────
    # stl/blk not tracked pre-1973-74; fg3m not applicable (pre-3pt era)
    {
        "player_id": -3,
        "player_name": "Wilt Chamberlain",
        "seasons": [
            {"season":"1959-60","team":"PHW","gp":72,"min":46.4,"pts":37.6,"reb":27.0,"ast":2.3,"stl":0.0,"blk":0.0,"fg_pct":0.461,"fg3_pct":0.0,"ftm":8.0,"pf":2.1},
            {"season":"1960-61","team":"PHW","gp":79,"min":47.8,"pts":38.4,"reb":27.2,"ast":1.9,"stl":0.0,"blk":0.0,"fg_pct":0.509,"fg3_pct":0.0,"ftm":6.7,"pf":1.6},
            {"season":"1961-62","team":"PHW","gp":80,"min":48.5,"pts":50.4,"reb":25.7,"ast":2.4,"stl":0.0,"blk":0.0,"fg_pct":0.506,"fg3_pct":0.0,"ftm":10.4,"pf":1.5},
            {"season":"1962-63","team":"SFW","gp":80,"min":47.6,"pts":44.8,"reb":24.3,"ast":3.4,"stl":0.0,"blk":0.0,"fg_pct":0.528,"fg3_pct":0.0,"ftm":8.3,"pf":1.7},
            {"season":"1963-64","team":"SFW","gp":80,"min":46.1,"pts":36.9,"reb":22.3,"ast":5.0,"stl":0.0,"blk":0.0,"fg_pct":0.524,"fg3_pct":0.0,"ftm":6.8,"pf":2.3},
            {"season":"1964-65","team":"PHI","gp":73,"min":45.2,"pts":34.7,"reb":22.9,"ast":3.4,"stl":0.0,"blk":0.0,"fg_pct":0.510,"fg3_pct":0.0,"ftm":5.6,"pf":2.0},
            {"season":"1965-66","team":"PHI","gp":79,"min":47.3,"pts":33.5,"reb":24.6,"ast":5.2,"stl":0.0,"blk":0.0,"fg_pct":0.540,"fg3_pct":0.0,"ftm":6.3,"pf":2.2},
            {"season":"1966-67","team":"PHI","gp":81,"min":45.5,"pts":24.1,"reb":24.2,"ast":7.8,"stl":0.0,"blk":0.0,"fg_pct":0.683,"fg3_pct":0.0,"ftm":4.8,"pf":1.8},
            {"season":"1967-68","team":"PHI","gp":82,"min":46.8,"pts":24.3,"reb":23.8,"ast":8.6,"stl":0.0,"blk":0.0,"fg_pct":0.595,"fg3_pct":0.0,"ftm":4.3,"pf":2.0},
            {"season":"1968-69","team":"LAL","gp":81,"min":45.3,"pts":20.5,"reb":21.1,"ast":4.5,"stl":0.0,"blk":0.0,"fg_pct":0.583,"fg3_pct":0.0,"ftm":4.7,"pf":1.8},
            {"season":"1969-70","team":"LAL","gp":12,"min":42.1,"pts":27.3,"reb":18.4,"ast":4.1,"stl":0.0,"blk":0.0,"fg_pct":0.568,"fg3_pct":0.0,"ftm":5.8,"pf":2.6},
            {"season":"1970-71","team":"LAL","gp":82,"min":44.3,"pts":20.7,"reb":18.2,"ast":4.3,"stl":0.0,"blk":0.0,"fg_pct":0.545,"fg3_pct":0.0,"ftm":4.4,"pf":2.1},
            {"season":"1971-72","team":"LAL","gp":82,"min":42.3,"pts":14.8,"reb":19.2,"ast":4.0,"stl":0.0,"blk":0.0,"fg_pct":0.649,"fg3_pct":0.0,"ftm":2.7,"pf":2.4},
            {"season":"1972-73","team":"LAL","gp":82,"min":43.2,"pts":13.2,"reb":18.6,"ast":4.5,"stl":0.0,"blk":5.4,"fg_pct":0.727,"fg3_pct":0.0,"ftm":2.8,"pf":2.3},
        ],
    },

    # ── Larry Bird ─────────────────────────────────────────────────────────────
    {
        "player_id": -4,
        "player_name": "Larry Bird",
        "seasons": [
            {"season":"1979-80","team":"BOS","gp":82,"min":36.0,"pts":21.3,"reb":10.4,"ast":4.5,"stl":1.7,"blk":0.6,"fg_pct":0.474,"fg3_pct":0.406,"ftm":3.7,"pf":3.4},
            {"season":"1980-81","team":"BOS","gp":82,"min":39.5,"pts":21.2,"reb":10.9,"ast":5.5,"stl":2.0,"blk":0.8,"fg_pct":0.478,"fg3_pct":0.270,"ftm":3.5,"pf":2.9},
            {"season":"1981-82","team":"BOS","gp":77,"min":38.0,"pts":22.9,"reb":10.9,"ast":5.8,"stl":1.9,"blk":0.9,"fg_pct":0.503,"fg3_pct":0.212,"ftm":4.3,"pf":3.2},
            {"season":"1982-83","team":"BOS","gp":79,"min":37.7,"pts":23.6,"reb":11.0,"ast":5.8,"stl":1.9,"blk":0.9,"fg_pct":0.504,"fg3_pct":0.286,"ftm":4.4,"pf":2.5},
            {"season":"1983-84","team":"BOS","gp":79,"min":38.3,"pts":24.2,"reb":10.1,"ast":6.6,"stl":1.8,"blk":0.9,"fg_pct":0.492,"fg3_pct":0.247,"ftm":4.7,"pf":2.5},
            {"season":"1984-85","team":"BOS","gp":80,"min":39.5,"pts":28.7,"reb":10.5,"ast":6.6,"stl":1.6,"blk":1.2,"fg_pct":0.522,"fg3_pct":0.427,"ftm":5.0,"pf":2.6},
            {"season":"1985-86","team":"BOS","gp":82,"min":38.0,"pts":25.8,"reb":9.8, "ast":6.8,"stl":2.0,"blk":0.6,"fg_pct":0.496,"fg3_pct":0.423,"ftm":5.4,"pf":2.2},
            {"season":"1986-87","team":"BOS","gp":74,"min":40.6,"pts":28.1,"reb":9.2, "ast":7.6,"stl":1.8,"blk":0.9,"fg_pct":0.525,"fg3_pct":0.400,"ftm":5.6,"pf":2.5},
            {"season":"1987-88","team":"BOS","gp":76,"min":39.0,"pts":29.9,"reb":9.3, "ast":6.1,"stl":1.6,"blk":0.8,"fg_pct":0.527,"fg3_pct":0.414,"ftm":5.5,"pf":2.1},
            {"season":"1988-89","team":"BOS","gp":6, "min":31.5,"pts":19.3,"reb":6.2, "ast":4.8,"stl":1.0,"blk":0.8,"fg_pct":0.471,"fg3_pct":0.000,"ftm":3.0,"pf":3.0},
            {"season":"1989-90","team":"BOS","gp":75,"min":39.3,"pts":24.3,"reb":9.5, "ast":7.5,"stl":1.4,"blk":0.8,"fg_pct":0.473,"fg3_pct":0.333,"ftm":4.3,"pf":2.3},
            {"season":"1990-91","team":"BOS","gp":60,"min":38.0,"pts":19.4,"reb":8.5, "ast":7.2,"stl":1.8,"blk":1.0,"fg_pct":0.454,"fg3_pct":0.389,"ftm":2.7,"pf":2.0},
            {"season":"1991-92","team":"BOS","gp":45,"min":36.9,"pts":20.2,"reb":9.6, "ast":6.8,"stl":0.9,"blk":0.7,"fg_pct":0.466,"fg3_pct":0.406,"ftm":3.3,"pf":1.8},
        ],
    },

    # ── Julius Erving ──────────────────────────────────────────────────────────
    # ABA seasons (VIR=Virginia Squires, NYA=New York Nets ABA) + NBA (PHI)
    {
        "player_id": -5,
        "player_name": "Julius Erving",
        "seasons": [
            {"season":"1971-72","team":"VIR","gp":84,"min":41.8,"pts":27.3,"reb":15.7,"ast":4.0,"stl":0.0,"blk":0.0,"fg_pct":0.498,"fg3_pct":0.188,"ftm":5.6,"pf":3.1},
            {"season":"1972-73","team":"VIR","gp":71,"min":42.2,"pts":31.9,"reb":12.2,"ast":4.2,"stl":2.5,"blk":1.8,"fg_pct":0.496,"fg3_pct":0.208,"ftm":6.7,"pf":2.8},
            {"season":"1973-74","team":"NYA","gp":84,"min":40.5,"pts":27.4,"reb":10.7,"ast":5.2,"stl":2.3,"blk":2.4,"fg_pct":0.512,"fg3_pct":0.395,"ftm":5.4,"pf":3.2},
            {"season":"1974-75","team":"NYA","gp":84,"min":40.5,"pts":27.9,"reb":10.9,"ast":5.5,"stl":2.2,"blk":1.9,"fg_pct":0.506,"fg3_pct":0.333,"ftm":5.8,"pf":3.0},
            {"season":"1975-76","team":"NYA","gp":84,"min":38.6,"pts":29.3,"reb":11.0,"ast":5.0,"stl":2.5,"blk":1.9,"fg_pct":0.507,"fg3_pct":0.330,"ftm":6.3,"pf":2.6},
            {"season":"1976-77","team":"PHI","gp":82,"min":35.9,"pts":21.6,"reb":8.5,"ast":3.7,"stl":1.9,"blk":1.4,"fg_pct":0.499,"fg3_pct":0.0,"ftm":4.9,"pf":3.1},
            {"season":"1977-78","team":"PHI","gp":74,"min":32.8,"pts":20.6,"reb":6.5,"ast":3.8,"stl":1.8,"blk":1.3,"fg_pct":0.502,"fg3_pct":0.0,"ftm":4.1,"pf":2.8},
            {"season":"1978-79","team":"PHI","gp":78,"min":35.9,"pts":23.1,"reb":7.2,"ast":4.6,"stl":1.7,"blk":1.3,"fg_pct":0.491,"fg3_pct":0.0,"ftm":4.8,"pf":2.7},
            {"season":"1979-80","team":"PHI","gp":78,"min":36.1,"pts":26.9,"reb":7.4,"ast":4.6,"stl":2.2,"blk":1.8,"fg_pct":0.519,"fg3_pct":0.200,"ftm":5.4,"pf":2.7},
            {"season":"1980-81","team":"PHI","gp":82,"min":35.0,"pts":24.6,"reb":8.0,"ast":4.4,"stl":2.1,"blk":1.8,"fg_pct":0.521,"fg3_pct":0.222,"ftm":5.1,"pf":2.8},
            {"season":"1981-82","team":"PHI","gp":81,"min":34.4,"pts":24.4,"reb":6.9,"ast":3.9,"stl":2.0,"blk":1.7,"fg_pct":0.546,"fg3_pct":0.273,"ftm":5.1,"pf":2.8},
            {"season":"1982-83","team":"PHI","gp":72,"min":33.6,"pts":21.4,"reb":6.8,"ast":3.7,"stl":1.6,"blk":1.8,"fg_pct":0.517,"fg3_pct":0.286,"ftm":4.6,"pf":2.8},
            {"season":"1983-84","team":"PHI","gp":77,"min":34.8,"pts":22.4,"reb":6.9,"ast":4.0,"stl":1.8,"blk":1.8,"fg_pct":0.512,"fg3_pct":0.333,"ftm":4.7,"pf":2.8},
            {"season":"1984-85","team":"PHI","gp":78,"min":32.5,"pts":20.0,"reb":5.3,"ast":3.0,"stl":1.7,"blk":1.4,"fg_pct":0.494,"fg3_pct":0.214,"ftm":4.3,"pf":2.6},
            {"season":"1985-86","team":"PHI","gp":74,"min":33.4,"pts":18.1,"reb":5.0,"ast":3.4,"stl":1.5,"blk":1.1,"fg_pct":0.480,"fg3_pct":0.281,"ftm":3.9,"pf":2.6},
            {"season":"1986-87","team":"PHI","gp":60,"min":32.0,"pts":16.8,"reb":4.4,"ast":3.2,"stl":1.3,"blk":1.6,"fg_pct":0.471,"fg3_pct":0.264,"ftm":3.2,"pf":2.3},
        ],
    },

    # ── Moses Malone ───────────────────────────────────────────────────────────
    # ABA (UTS=Utah Stars, SSL=Spirits of St. Louis) + NBA
    {
        "player_id": -6,
        "player_name": "Moses Malone",
        "seasons": [
            {"season":"1974-75","team":"UTS","gp":83,"min":38.6,"pts":18.8,"reb":14.6,"ast":1.0,"stl":1.0,"blk":1.5,"fg_pct":0.571,"fg3_pct":0.0,"ftm":4.5,"pf":3.5},
            {"season":"1975-76","team":"SSL","gp":43,"min":27.2,"pts":14.3,"reb":9.6, "ast":1.3,"stl":0.6,"blk":0.7,"fg_pct":0.512,"fg3_pct":0.0,"ftm":2.6,"pf":2.6},
            {"season":"1976-77","team":"HOU","gp":80,"min":31.3,"pts":13.5,"reb":13.4,"ast":1.1,"stl":0.8,"blk":2.3,"fg_pct":0.480,"fg3_pct":0.0,"ftm":3.8,"pf":3.4},
            {"season":"1977-78","team":"HOU","gp":59,"min":35.7,"pts":19.4,"reb":15.0,"ast":0.5,"stl":0.8,"blk":1.3,"fg_pct":0.499,"fg3_pct":0.0,"ftm":5.4,"pf":3.0},
            {"season":"1978-79","team":"HOU","gp":82,"min":41.3,"pts":24.8,"reb":17.6,"ast":1.8,"stl":1.0,"blk":1.5,"fg_pct":0.540,"fg3_pct":0.0,"ftm":7.3,"pf":2.7},
            {"season":"1979-80","team":"HOU","gp":82,"min":38.3,"pts":25.8,"reb":14.5,"ast":1.8,"stl":1.0,"blk":1.3,"fg_pct":0.502,"fg3_pct":0.0,"ftm":6.9,"pf":2.6},
            {"season":"1980-81","team":"HOU","gp":80,"min":40.6,"pts":27.8,"reb":14.8,"ast":1.8,"stl":1.0,"blk":1.9,"fg_pct":0.522,"fg3_pct":0.0,"ftm":7.6,"pf":2.8},
            {"season":"1981-82","team":"HOU","gp":81,"min":42.0,"pts":31.1,"reb":14.7,"ast":1.8,"stl":0.9,"blk":1.5,"fg_pct":0.519,"fg3_pct":0.0,"ftm":7.8,"pf":2.6},
            {"season":"1982-83","team":"PHI","gp":78,"min":37.5,"pts":24.5,"reb":15.3,"ast":1.3,"stl":1.1,"blk":2.0,"fg_pct":0.501,"fg3_pct":0.0,"ftm":7.7,"pf":2.6},
            {"season":"1983-84","team":"PHI","gp":71,"min":36.8,"pts":22.7,"reb":13.4,"ast":1.4,"stl":1.0,"blk":1.5,"fg_pct":0.483,"fg3_pct":0.0,"ftm":7.7,"pf":2.6},
            {"season":"1984-85","team":"PHI","gp":79,"min":37.4,"pts":24.6,"reb":13.1,"ast":1.6,"stl":0.8,"blk":1.6,"fg_pct":0.469,"fg3_pct":0.0,"ftm":9.3,"pf":2.7},
            {"season":"1985-86","team":"PHI","gp":74,"min":36.6,"pts":23.8,"reb":11.8,"ast":1.2,"stl":0.9,"blk":1.0,"fg_pct":0.458,"fg3_pct":0.0,"ftm":8.3,"pf":2.6},
            {"season":"1986-87","team":"WSB","gp":73,"min":34.1,"pts":24.1,"reb":11.3,"ast":1.6,"stl":0.8,"blk":1.3,"fg_pct":0.454,"fg3_pct":0.0,"ftm":7.8,"pf":1.9},
            {"season":"1987-88","team":"WSB","gp":79,"min":34.1,"pts":20.3,"reb":11.2,"ast":1.4,"stl":0.7,"blk":0.9,"fg_pct":0.487,"fg3_pct":0.0,"ftm":6.9,"pf":2.0},
            {"season":"1988-89","team":"ATL","gp":81,"min":35.5,"pts":20.2,"reb":11.8,"ast":1.4,"stl":1.0,"blk":1.2,"fg_pct":0.491,"fg3_pct":0.0,"ftm":6.9,"pf":1.9},
            {"season":"1989-90","team":"ATL","gp":81,"min":33.8,"pts":18.9,"reb":10.0,"ast":1.6,"stl":0.6,"blk":1.0,"fg_pct":0.480,"fg3_pct":0.0,"ftm":6.1,"pf":2.0},
            {"season":"1990-91","team":"ATL","gp":82,"min":23.3,"pts":10.6,"reb":8.1, "ast":0.8,"stl":0.4,"blk":0.9,"fg_pct":0.468,"fg3_pct":0.0,"ftm":3.8,"pf":1.6},
            {"season":"1991-92","team":"MIL","gp":82,"min":30.6,"pts":15.6,"reb":9.1, "ast":1.1,"stl":0.9,"blk":0.8,"fg_pct":0.474,"fg3_pct":0.0,"ftm":4.8,"pf":1.7},
            {"season":"1992-93","team":"MIL","gp":11,"min":9.5, "pts":4.5, "reb":4.2, "ast":0.6,"stl":0.1,"blk":0.7,"fg_pct":0.310,"fg3_pct":0.0,"ftm":2.2,"pf":0.5},
            {"season":"1993-94","team":"PHI","gp":55,"min":11.2,"pts":5.3, "reb":4.1, "ast":0.6,"stl":0.2,"blk":0.3,"fg_pct":0.440,"fg3_pct":0.0,"ftm":1.6,"pf":0.9},
            {"season":"1994-95","team":"SAS","gp":17,"min":8.8, "pts":2.9, "reb":2.7, "ast":0.4,"stl":0.1,"blk":0.2,"fg_pct":0.371,"fg3_pct":0.0,"ftm":1.3,"pf":0.9},
        ],
    },

    # ── Dominique Wilkins ──────────────────────────────────────────────────────
    {
        "player_id": -7,
        "player_name": "Dominique Wilkins",
        "seasons": [
            {"season":"1982-83","team":"ATL","gp":82,"min":32.9,"pts":17.5,"reb":5.8,"ast":1.6,"stl":1.0,"blk":0.8,"fg_pct":0.493,"fg3_pct":0.182,"ftm":2.8,"pf":2.6},
            {"season":"1983-84","team":"ATL","gp":81,"min":36.6,"pts":21.6,"reb":7.2,"ast":1.6,"stl":1.4,"blk":1.1,"fg_pct":0.479,"fg3_pct":0.0,  "ftm":4.7,"pf":2.4},
            {"season":"1984-85","team":"ATL","gp":81,"min":37.3,"pts":27.4,"reb":6.9,"ast":2.5,"stl":1.7,"blk":0.7,"fg_pct":0.451,"fg3_pct":0.309,"ftm":6.0,"pf":2.1},
            {"season":"1985-86","team":"ATL","gp":78,"min":39.1,"pts":30.3,"reb":7.9,"ast":2.6,"stl":1.8,"blk":0.6,"fg_pct":0.468,"fg3_pct":0.186,"ftm":7.4,"pf":2.2},
            {"season":"1986-87","team":"ATL","gp":79,"min":37.6,"pts":29.0,"reb":6.3,"ast":3.3,"stl":1.5,"blk":0.6,"fg_pct":0.463,"fg3_pct":0.292,"ftm":7.7,"pf":1.9},
            {"season":"1987-88","team":"ATL","gp":78,"min":37.8,"pts":30.7,"reb":6.4,"ast":2.9,"stl":1.3,"blk":0.6,"fg_pct":0.464,"fg3_pct":0.295,"ftm":6.9,"pf":2.1},
            {"season":"1988-89","team":"ATL","gp":80,"min":37.5,"pts":26.2,"reb":6.9,"ast":2.6,"stl":1.5,"blk":0.7,"fg_pct":0.464,"fg3_pct":0.276,"ftm":5.5,"pf":1.7},
            {"season":"1989-90","team":"ATL","gp":80,"min":36.1,"pts":26.7,"reb":6.5,"ast":2.5,"stl":1.6,"blk":0.6,"fg_pct":0.484,"fg3_pct":0.322,"ftm":5.7,"pf":1.8},
            {"season":"1990-91","team":"ATL","gp":81,"min":38.0,"pts":25.9,"reb":9.0,"ast":3.3,"stl":1.5,"blk":0.8,"fg_pct":0.470,"fg3_pct":0.341,"ftm":5.9,"pf":1.9},
            {"season":"1991-92","team":"ATL","gp":42,"min":38.1,"pts":28.1,"reb":7.0,"ast":3.8,"stl":1.2,"blk":0.6,"fg_pct":0.464,"fg3_pct":0.289,"ftm":7.0,"pf":1.8},
            {"season":"1992-93","team":"ATL","gp":71,"min":37.3,"pts":29.9,"reb":6.8,"ast":3.2,"stl":1.0,"blk":0.4,"fg_pct":0.468,"fg3_pct":0.380,"ftm":7.3,"pf":1.6},
            {"season":"1993-94","team":"ATL","gp":74,"min":35.6,"pts":26.0,"reb":6.5,"ast":2.3,"stl":1.2,"blk":0.4,"fg_pct":0.440,"fg3_pct":0.288,"ftm":6.0,"pf":1.7},
            {"season":"1994-95","team":"BOS","gp":77,"min":31.5,"pts":17.8,"reb":5.2,"ast":2.2,"stl":0.8,"blk":0.2,"fg_pct":0.424,"fg3_pct":0.388,"ftm":3.5,"pf":1.7},
            {"season":"1996-97","team":"SAS","gp":63,"min":30.9,"pts":18.2,"reb":6.4,"ast":1.9,"stl":0.6,"blk":0.5,"fg_pct":0.417,"fg3_pct":0.293,"ftm":4.5,"pf":1.6},
            {"season":"1998-99","team":"ORL","gp":27,"min":9.3, "pts":5.0, "reb":2.6,"ast":0.6,"stl":0.1,"blk":0.0,"fg_pct":0.379,"fg3_pct":0.263,"ftm":1.1,"pf":0.7},
        ],
    },

    # ── Elgin Baylor ───────────────────────────────────────────────────────────
    # Pre-tracking: stl/blk=0.0; pre-3pt era; MNL=Minneapolis Lakers→LAL franchise
    {
        "player_id": -8,
        "player_name": "Elgin Baylor",
        "seasons": [
            {"season":"1958-59","team":"MNL","gp":70,"min":40.8,"pts":24.9,"reb":15.0,"ast":4.1,"stl":0.0,"blk":0.0,"fg_pct":0.408,"fg3_pct":0.0,"ftm":7.6,"pf":3.9},
            {"season":"1959-60","team":"MNL","gp":70,"min":41.0,"pts":29.6,"reb":16.4,"ast":3.5,"stl":0.0,"blk":0.0,"fg_pct":0.424,"fg3_pct":0.0,"ftm":8.1,"pf":3.3},
            {"season":"1960-61","team":"LAL","gp":73,"min":42.9,"pts":34.8,"reb":19.8,"ast":5.1,"stl":0.0,"blk":0.0,"fg_pct":0.430,"fg3_pct":0.0,"ftm":9.3,"pf":3.8},
            {"season":"1961-62","team":"LAL","gp":48,"min":44.4,"pts":38.3,"reb":18.6,"ast":4.6,"stl":0.0,"blk":0.0,"fg_pct":0.428,"fg3_pct":0.0,"ftm":9.9,"pf":3.2},
            {"season":"1962-63","team":"LAL","gp":80,"min":42.1,"pts":34.0,"reb":14.3,"ast":4.8,"stl":0.0,"blk":0.0,"fg_pct":0.453,"fg3_pct":0.0,"ftm":8.3,"pf":2.8},
            {"season":"1963-64","team":"LAL","gp":78,"min":40.6,"pts":25.4,"reb":12.0,"ast":4.4,"stl":0.0,"blk":0.0,"fg_pct":0.425,"fg3_pct":0.0,"ftm":6.0,"pf":3.0},
            {"season":"1964-65","team":"LAL","gp":74,"min":41.3,"pts":27.1,"reb":12.8,"ast":3.8,"stl":0.0,"blk":0.0,"fg_pct":0.401,"fg3_pct":0.0,"ftm":6.5,"pf":3.2},
            {"season":"1965-66","team":"LAL","gp":65,"min":30.4,"pts":16.6,"reb":9.6, "ast":3.4,"stl":0.0,"blk":0.0,"fg_pct":0.401,"fg3_pct":0.0,"ftm":3.8,"pf":2.4},
            {"season":"1966-67","team":"LAL","gp":70,"min":38.7,"pts":26.6,"reb":12.8,"ast":3.1,"stl":0.0,"blk":0.0,"fg_pct":0.429,"fg3_pct":0.0,"ftm":6.3,"pf":3.0},
            {"season":"1967-68","team":"LAL","gp":77,"min":39.3,"pts":26.0,"reb":12.2,"ast":4.6,"stl":0.0,"blk":0.0,"fg_pct":0.443,"fg3_pct":0.0,"ftm":6.3,"pf":3.0},
            {"season":"1968-69","team":"LAL","gp":76,"min":40.3,"pts":24.8,"reb":10.6,"ast":5.4,"stl":0.0,"blk":0.0,"fg_pct":0.447,"fg3_pct":0.0,"ftm":5.5,"pf":2.7},
            {"season":"1969-70","team":"LAL","gp":54,"min":41.0,"pts":24.0,"reb":10.4,"ast":5.4,"stl":0.0,"blk":0.0,"fg_pct":0.486,"fg3_pct":0.0,"ftm":5.1,"pf":2.4},
            {"season":"1970-71","team":"LAL","gp":2, "min":28.5,"pts":10.0,"reb":5.5, "ast":1.0,"stl":0.0,"blk":0.0,"fg_pct":0.421,"fg3_pct":0.0,"ftm":2.0,"pf":3.0},
            {"season":"1971-72","team":"LAL","gp":9, "min":26.6,"pts":11.8,"reb":6.3, "ast":2.0,"stl":0.0,"blk":0.0,"fg_pct":0.433,"fg3_pct":0.0,"ftm":2.4,"pf":2.2},
        ],
    },

    # ── Jerry West ─────────────────────────────────────────────────────────────
    # stl/blk tracked from 1973-74 only
    {
        "player_id": -9,
        "player_name": "Jerry West",
        "seasons": [
            {"season":"1960-61","team":"LAL","gp":79,"min":35.4,"pts":17.6,"reb":7.7,"ast":4.2,"stl":0.0,"blk":0.0,"fg_pct":0.419,"fg3_pct":0.0,"ftm":4.2,"pf":2.7},
            {"season":"1961-62","team":"LAL","gp":75,"min":41.2,"pts":30.8,"reb":7.9,"ast":5.4,"stl":0.0,"blk":0.0,"fg_pct":0.445,"fg3_pct":0.0,"ftm":9.5,"pf":2.3},
            {"season":"1962-63","team":"LAL","gp":55,"min":39.3,"pts":27.1,"reb":7.0,"ast":5.6,"stl":0.0,"blk":0.0,"fg_pct":0.461,"fg3_pct":0.0,"ftm":6.7,"pf":2.7},
            {"season":"1963-64","team":"LAL","gp":72,"min":40.4,"pts":28.7,"reb":6.0,"ast":5.6,"stl":0.0,"blk":0.0,"fg_pct":0.484,"fg3_pct":0.0,"ftm":8.1,"pf":2.8},
            {"season":"1964-65","team":"LAL","gp":74,"min":41.4,"pts":31.0,"reb":6.0,"ast":4.9,"stl":0.0,"blk":0.0,"fg_pct":0.497,"fg3_pct":0.0,"ftm":8.8,"pf":3.0},
            {"season":"1965-66","team":"LAL","gp":79,"min":40.7,"pts":31.3,"reb":7.1,"ast":6.1,"stl":0.0,"blk":0.0,"fg_pct":0.473,"fg3_pct":0.0,"ftm":10.6,"pf":3.1},
            {"season":"1966-67","team":"LAL","gp":66,"min":40.5,"pts":28.7,"reb":5.9,"ast":6.8,"stl":0.0,"blk":0.0,"fg_pct":0.464,"fg3_pct":0.0,"ftm":9.1,"pf":2.4},
            {"season":"1967-68","team":"LAL","gp":51,"min":37.6,"pts":26.3,"reb":5.8,"ast":6.1,"stl":0.0,"blk":0.0,"fg_pct":0.514,"fg3_pct":0.0,"ftm":7.7,"pf":3.0},
            {"season":"1968-69","team":"LAL","gp":61,"min":39.2,"pts":25.9,"reb":4.3,"ast":6.9,"stl":0.0,"blk":0.0,"fg_pct":0.471,"fg3_pct":0.0,"ftm":8.0,"pf":2.6},
            {"season":"1969-70","team":"LAL","gp":74,"min":42.0,"pts":31.2,"reb":4.6,"ast":7.5,"stl":0.0,"blk":0.0,"fg_pct":0.497,"fg3_pct":0.0,"ftm":8.7,"pf":2.2},
            {"season":"1970-71","team":"LAL","gp":69,"min":41.2,"pts":26.9,"reb":4.6,"ast":9.5,"stl":0.0,"blk":0.0,"fg_pct":0.494,"fg3_pct":0.0,"ftm":7.6,"pf":2.6},
            {"season":"1971-72","team":"LAL","gp":77,"min":38.6,"pts":25.8,"reb":4.2,"ast":9.7,"stl":0.0,"blk":0.0,"fg_pct":0.477,"fg3_pct":0.0,"ftm":6.7,"pf":2.7},
            {"season":"1972-73","team":"LAL","gp":69,"min":35.7,"pts":22.8,"reb":4.2,"ast":8.8,"stl":0.0,"blk":0.0,"fg_pct":0.479,"fg3_pct":0.0,"ftm":4.9,"pf":2.0},
            {"season":"1973-74","team":"LAL","gp":31,"min":31.2,"pts":20.3,"reb":3.7,"ast":6.6,"stl":2.6,"blk":0.7,"fg_pct":0.447,"fg3_pct":0.0,"ftm":5.3,"pf":2.6},
        ],
    },

    # ── Bob Cousy ──────────────────────────────────────────────────────────────
    # Very early era: no stl/blk/fg3_pct
    {
        "player_id": -10,
        "player_name": "Bob Cousy",
        "seasons": [
            {"season":"1950-51","team":"BOS","gp":69,"min":0.0, "pts":15.6,"reb":6.9,"ast":4.9,"stl":0.0,"blk":0.0,"fg_pct":0.352,"fg3_pct":0.0,"ftm":4.0,"pf":2.7},
            {"season":"1951-52","team":"BOS","gp":66,"min":40.6,"pts":21.7,"reb":6.4,"ast":6.7,"stl":0.0,"blk":0.0,"fg_pct":0.369,"fg3_pct":0.0,"ftm":6.2,"pf":2.9},
            {"season":"1952-53","team":"BOS","gp":71,"min":41.5,"pts":19.8,"reb":6.3,"ast":7.7,"stl":0.0,"blk":0.0,"fg_pct":0.352,"fg3_pct":0.0,"ftm":6.7,"pf":3.2},
            {"season":"1953-54","team":"BOS","gp":72,"min":39.7,"pts":19.2,"reb":5.5,"ast":7.2,"stl":0.0,"blk":0.0,"fg_pct":0.385,"fg3_pct":0.0,"ftm":5.7,"pf":2.8},
            {"season":"1954-55","team":"BOS","gp":71,"min":38.7,"pts":21.2,"reb":6.0,"ast":7.8,"stl":0.0,"blk":0.0,"fg_pct":0.397,"fg3_pct":0.0,"ftm":6.5,"pf":2.3},
            {"season":"1955-56","team":"BOS","gp":72,"min":38.4,"pts":18.8,"reb":6.8,"ast":8.9,"stl":0.0,"blk":0.0,"fg_pct":0.360,"fg3_pct":0.0,"ftm":6.6,"pf":2.9},
            {"season":"1956-57","team":"BOS","gp":64,"min":36.9,"pts":20.6,"reb":4.8,"ast":7.5,"stl":0.0,"blk":0.0,"fg_pct":0.378,"fg3_pct":0.0,"ftm":5.7,"pf":2.1},
            {"season":"1957-58","team":"BOS","gp":65,"min":34.2,"pts":18.0,"reb":5.0,"ast":7.1,"stl":0.0,"blk":0.0,"fg_pct":0.353,"fg3_pct":0.0,"ftm":4.3,"pf":2.1},
            {"season":"1958-59","team":"BOS","gp":65,"min":37.0,"pts":20.0,"reb":5.5,"ast":8.6,"stl":0.0,"blk":0.0,"fg_pct":0.384,"fg3_pct":0.0,"ftm":5.1,"pf":2.1},
            {"season":"1959-60","team":"BOS","gp":75,"min":34.5,"pts":19.4,"reb":4.7,"ast":9.5,"stl":0.0,"blk":0.0,"fg_pct":0.384,"fg3_pct":0.0,"ftm":4.3,"pf":1.9},
            {"season":"1960-61","team":"BOS","gp":76,"min":32.5,"pts":18.1,"reb":4.4,"ast":7.7,"stl":0.0,"blk":0.0,"fg_pct":0.371,"fg3_pct":0.0,"ftm":4.6,"pf":2.6},
            {"season":"1961-62","team":"BOS","gp":75,"min":28.2,"pts":15.7,"reb":3.5,"ast":7.8,"stl":0.0,"blk":0.0,"fg_pct":0.391,"fg3_pct":0.0,"ftm":3.3,"pf":1.8},
            {"season":"1962-63","team":"BOS","gp":76,"min":26.0,"pts":13.2,"reb":2.5,"ast":6.8,"stl":0.0,"blk":0.0,"fg_pct":0.397,"fg3_pct":0.0,"ftm":2.9,"pf":2.3},
        ],
    },

    # ── Oscar Robertson ────────────────────────────────────────────────────────
    # CIN=Cincinnati Royals (→SAC Kings franchise); stl/blk from 1973-74 only
    {
        "player_id": -11,
        "player_name": "Oscar Robertson",
        "seasons": [
            {"season":"1960-61","team":"CIN","gp":71,"min":42.7,"pts":30.5,"reb":10.1,"ast":9.7,"stl":0.0,"blk":0.0,"fg_pct":0.473,"fg3_pct":0.0,"ftm":9.2,"pf":3.1},
            {"season":"1961-62","team":"CIN","gp":79,"min":44.3,"pts":30.8,"reb":12.5,"ast":11.4,"stl":0.0,"blk":0.0,"fg_pct":0.478,"fg3_pct":0.0,"ftm":8.9,"pf":3.3},
            {"season":"1962-63","team":"CIN","gp":80,"min":44.0,"pts":28.3,"reb":10.4,"ast":9.5,"stl":0.0,"blk":0.0,"fg_pct":0.518,"fg3_pct":0.0,"ftm":7.7,"pf":3.7},
            {"season":"1963-64","team":"CIN","gp":79,"min":45.1,"pts":31.4,"reb":9.9,"ast":11.0,"stl":0.0,"blk":0.0,"fg_pct":0.483,"fg3_pct":0.0,"ftm":10.1,"pf":3.5},
            {"season":"1964-65","team":"CIN","gp":75,"min":45.6,"pts":30.4,"reb":9.0,"ast":11.5,"stl":0.0,"blk":0.0,"fg_pct":0.480,"fg3_pct":0.0,"ftm":8.9,"pf":2.7},
            {"season":"1965-66","team":"CIN","gp":76,"min":46.0,"pts":31.3,"reb":7.7,"ast":11.1,"stl":0.0,"blk":0.0,"fg_pct":0.475,"fg3_pct":0.0,"ftm":9.8,"pf":3.0},
            {"season":"1966-67","team":"CIN","gp":79,"min":43.9,"pts":30.5,"reb":6.2,"ast":10.7,"stl":0.0,"blk":0.0,"fg_pct":0.493,"fg3_pct":0.0,"ftm":9.3,"pf":2.9},
            {"season":"1967-68","team":"CIN","gp":65,"min":42.5,"pts":29.2,"reb":6.0,"ast":9.7,"stl":0.0,"blk":0.0,"fg_pct":0.500,"fg3_pct":0.0,"ftm":8.9,"pf":3.1},
            {"season":"1968-69","team":"CIN","gp":79,"min":43.8,"pts":24.7,"reb":6.4,"ast":9.8,"stl":0.0,"blk":0.0,"fg_pct":0.486,"fg3_pct":0.0,"ftm":8.1,"pf":2.9},
            {"season":"1969-70","team":"CIN","gp":69,"min":41.5,"pts":25.3,"reb":6.1,"ast":8.1,"stl":0.0,"blk":0.0,"fg_pct":0.511,"fg3_pct":0.0,"ftm":6.6,"pf":2.5},
            {"season":"1970-71","team":"MIL","gp":81,"min":39.4,"pts":19.4,"reb":5.7,"ast":8.2,"stl":0.0,"blk":0.0,"fg_pct":0.496,"fg3_pct":0.0,"ftm":4.8,"pf":2.5},
            {"season":"1971-72","team":"MIL","gp":64,"min":37.3,"pts":17.4,"reb":5.0,"ast":7.7,"stl":0.0,"blk":0.0,"fg_pct":0.472,"fg3_pct":0.0,"ftm":4.3,"pf":1.8},
            {"season":"1972-73","team":"MIL","gp":73,"min":37.5,"pts":15.5,"reb":4.9,"ast":7.5,"stl":0.0,"blk":0.0,"fg_pct":0.454,"fg3_pct":0.0,"ftm":3.3,"pf":2.3},
            {"season":"1973-74","team":"MIL","gp":70,"min":35.4,"pts":12.7,"reb":4.0,"ast":6.4,"stl":1.1,"blk":0.1,"fg_pct":0.438,"fg3_pct":0.0,"ftm":3.0,"pf":1.9},
        ],
    },

]

# ─── Inject into file ──────────────────────────────────────────────────────────

def inject(path: str, label: str) -> None:
    if not os.path.exists(path):
        print(f"File not found, skipping: {path}")
        return

    with open(path) as f:
        players = json.load(f)

    existing_ids = {p["player_id"] for p in players}
    existing_names = {p["player_name"].lower() for p in players}

    added = 0
    skipped = 0
    for legend in NBA_LEGENDS:
        if legend["player_id"] in existing_ids or legend["player_name"].lower() in existing_names:
            print(f"  SKIP {legend['player_name']} (already in {label})")
            skipped += 1
            continue
        players.append(legend)
        print(f"  ADD  {legend['player_name']} ({len(legend['seasons'])} seasons) → {label}")
        added += 1

    with open(path, "w") as f:
        json.dump(players, f, separators=(",", ":"))

    size_kb = os.path.getsize(path) / 1024
    print(f"  Saved {path} ({size_kb:.1f} KB) — added {added}, skipped {skipped}\n")


def main():
    print("Injecting NBA legends into careers + lineup pool...\n")
    inject(CAREERS_PATH, "nba_careers.json")
    inject(LINEUP_PATH,  "nba_lineup_pool.json")
    print("Done. Next steps:")
    print("  cp scripts/data/nba_careers.json public/data/nba_careers.json")
    print("  cp scripts/data/nba_lineup_pool.json public/data/nba_lineup_pool.json")


if __name__ == "__main__":
    main()
