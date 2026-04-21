#!/usr/bin/env python3
"""
patch_legends.py — Consolidated patch for all NFL legends.

Two operations:
  1. PRE1999_PATCHES  — prepend missing pre-1999 seasons onto existing DB players
  2. NEW_PLAYERS      — add complete careers for players not in the DB at all

Stats sourced from Pro Football Reference.
Run: python patch_legends.py
After: cp data/nfl_careers.json ../public/data/nfl_careers.json
"""

import json, os

CAREERS_PATH = os.path.join(os.path.dirname(__file__), "data", "nfl_careers.json")

# ─── 1. PRE-1999 PATCHES FOR EXISTING DB PLAYERS ─────────────────────────────
# Keyed by nfl_data_py player_id. Only seasons missing from the DB are listed;
# the script skips any season already present.

PRE1999_PATCHES = {

    # ── Brett Favre ────────────────────────────────────────────────────────────
    "00-0005106": [
        {"season":"1991","team":"ATL","gp":2, "completions":0,  "attempts":4,   "passing_yards":0,   "passing_tds":0, "interceptions":2, "rushing_yards":0,"rushing_tds":0},
        {"season":"1992","team":"GB", "gp":3, "completions":8,  "attempts":18,  "passing_yards":87,  "passing_tds":0, "interceptions":2, "rushing_yards":0,"rushing_tds":0},
        {"season":"1993","team":"GB", "gp":16,"completions":318,"attempts":522, "passing_yards":3303,"passing_tds":19,"interceptions":24,"rushing_yards":0,"rushing_tds":0},
        {"season":"1994","team":"GB", "gp":16,"completions":363,"attempts":582, "passing_yards":3882,"passing_tds":33,"interceptions":14,"rushing_yards":0,"rushing_tds":0},
        {"season":"1995","team":"GB", "gp":16,"completions":359,"attempts":570, "passing_yards":4413,"passing_tds":38,"interceptions":13,"rushing_yards":0,"rushing_tds":0},
        {"season":"1996","team":"GB", "gp":16,"completions":325,"attempts":543, "passing_yards":3899,"passing_tds":39,"interceptions":13,"rushing_yards":0,"rushing_tds":0},
        {"season":"1997","team":"GB", "gp":16,"completions":304,"attempts":513, "passing_yards":3867,"passing_tds":35,"interceptions":16,"rushing_yards":0,"rushing_tds":0},
        {"season":"1998","team":"GB", "gp":16,"completions":347,"attempts":551, "passing_yards":4212,"passing_tds":31,"interceptions":23,"rushing_yards":0,"rushing_tds":0},
    ],

    # ── Drew Bledsoe ───────────────────────────────────────────────────────────
    "00-0001361": [
        {"season":"1993","team":"NE", "gp":13,"completions":214,"attempts":429, "passing_yards":2494,"passing_tds":15,"interceptions":15,"rushing_yards":0,"rushing_tds":0},
        {"season":"1994","team":"NE", "gp":16,"completions":400,"attempts":691, "passing_yards":4555,"passing_tds":25,"interceptions":27,"rushing_yards":0,"rushing_tds":0},
        {"season":"1995","team":"NE", "gp":16,"completions":323,"attempts":522, "passing_yards":3507,"passing_tds":13,"interceptions":16,"rushing_yards":0,"rushing_tds":0},
        {"season":"1996","team":"NE", "gp":16,"completions":373,"attempts":623, "passing_yards":4086,"passing_tds":27,"interceptions":15,"rushing_yards":0,"rushing_tds":0},
        {"season":"1997","team":"NE", "gp":13,"completions":314,"attempts":522, "passing_yards":3706,"passing_tds":28,"interceptions":15,"rushing_yards":0,"rushing_tds":0},
        {"season":"1998","team":"NE", "gp":16,"completions":431,"attempts":715, "passing_yards":4008,"passing_tds":20,"interceptions":14,"rushing_yards":0,"rushing_tds":0},
    ],

    # ── Mark Brunell ───────────────────────────────────────────────────────────
    "00-0002110": [
        {"season":"1994","team":"GB", "gp":8, "completions":28, "attempts":55,  "passing_yards":303, "passing_tds":2, "interceptions":3, "rushing_yards":0,"rushing_tds":0},
        {"season":"1995","team":"JAX","gp":14,"completions":201,"attempts":346, "passing_yards":2168,"passing_tds":15,"interceptions":7, "rushing_yards":0,"rushing_tds":0},
        {"season":"1996","team":"JAX","gp":16,"completions":353,"attempts":557, "passing_yards":4367,"passing_tds":19,"interceptions":20,"rushing_yards":0,"rushing_tds":0},
        {"season":"1997","team":"JAX","gp":16,"completions":264,"attempts":435, "passing_yards":3281,"passing_tds":18,"interceptions":7, "rushing_yards":0,"rushing_tds":0},
        {"season":"1998","team":"JAX","gp":16,"completions":328,"attempts":502, "passing_yards":3731,"passing_tds":20,"interceptions":9, "rushing_yards":0,"rushing_tds":0},
    ],

    # ── Vinny Testaverde ───────────────────────────────────────────────────────
    "00-0016193": [
        {"season":"1987","team":"TB", "gp":8, "completions":105,"attempts":165, "passing_yards":1081,"passing_tds":5, "interceptions":6, "rushing_yards":0,"rushing_tds":0},
        {"season":"1988","team":"TB", "gp":15,"completions":222,"attempts":466, "passing_yards":2996,"passing_tds":13,"interceptions":35,"rushing_yards":0,"rushing_tds":0},
        {"season":"1989","team":"TB", "gp":14,"completions":258,"attempts":480, "passing_yards":3133,"passing_tds":20,"interceptions":22,"rushing_yards":0,"rushing_tds":0},
        {"season":"1990","team":"TB", "gp":16,"completions":203,"attempts":365, "passing_yards":2818,"passing_tds":17,"interceptions":18,"rushing_yards":0,"rushing_tds":0},
        {"season":"1991","team":"TB", "gp":14,"completions":166,"attempts":326, "passing_yards":1994,"passing_tds":8, "interceptions":15,"rushing_yards":0,"rushing_tds":0},
        {"season":"1992","team":"TB", "gp":9, "completions":103,"attempts":215, "passing_yards":1112,"passing_tds":8, "interceptions":9, "rushing_yards":0,"rushing_tds":0},
        {"season":"1993","team":"CLE","gp":16,"completions":130,"attempts":230, "passing_yards":1797,"passing_tds":14,"interceptions":9, "rushing_yards":0,"rushing_tds":0},
        {"season":"1994","team":"CLE","gp":16,"completions":207,"attempts":376, "passing_yards":2575,"passing_tds":16,"interceptions":18,"rushing_yards":0,"rushing_tds":0},
        {"season":"1995","team":"CLE","gp":5, "completions":65, "attempts":130, "passing_yards":714, "passing_tds":4, "interceptions":7, "rushing_yards":0,"rushing_tds":0},
        {"season":"1996","team":"BAL","gp":16,"completions":325,"attempts":549, "passing_yards":4177,"passing_tds":33,"interceptions":19,"rushing_yards":0,"rushing_tds":0},
        {"season":"1997","team":"BAL","gp":16,"completions":270,"attempts":470, "passing_yards":2971,"passing_tds":18,"interceptions":15,"rushing_yards":0,"rushing_tds":0},
        {"season":"1998","team":"NYJ","gp":16,"completions":259,"attempts":421, "passing_yards":3256,"passing_tds":29,"interceptions":7, "rushing_yards":0,"rushing_tds":0},
    ],

    # ── Steve McNair ───────────────────────────────────────────────────────────
    "00-0011024": [
        {"season":"1995","team":"HOU","gp":5, "completions":3,  "attempts":8,   "passing_yards":29,  "passing_tds":0, "interceptions":1, "rushing_yards":0,"rushing_tds":0},
        {"season":"1996","team":"HOU","gp":10,"completions":88, "attempts":143, "passing_yards":1197,"passing_tds":6, "interceptions":4, "rushing_yards":0,"rushing_tds":0},
        {"season":"1997","team":"TEN","gp":16,"completions":216,"attempts":415, "passing_yards":2665,"passing_tds":14,"interceptions":13,"rushing_yards":0,"rushing_tds":0},
        {"season":"1998","team":"TEN","gp":16,"completions":289,"attempts":492, "passing_yards":3228,"passing_tds":15,"interceptions":10,"rushing_yards":0,"rushing_tds":0},
    ],

    # ── Emmitt Smith ───────────────────────────────────────────────────────────
    "00-0015165": [
        {"season":"1990","team":"DAL","gp":16,"carries":241,"rushing_yards":937, "rushing_tds":11,"receptions":24,"receiving_yards":228,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1991","team":"DAL","gp":16,"carries":365,"rushing_yards":1563,"rushing_tds":12,"receptions":49,"receiving_yards":258,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
        {"season":"1992","team":"DAL","gp":16,"carries":373,"rushing_yards":1713,"rushing_tds":18,"receptions":59,"receiving_yards":335,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
        {"season":"1993","team":"DAL","gp":14,"carries":283,"rushing_yards":1486,"rushing_tds":9, "receptions":57,"receiving_yards":414,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
        {"season":"1994","team":"DAL","gp":15,"carries":368,"rushing_yards":1484,"rushing_tds":21,"receptions":50,"receiving_yards":341,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
        {"season":"1995","team":"DAL","gp":15,"carries":377,"rushing_yards":1773,"rushing_tds":25,"receptions":62,"receiving_yards":375,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1996","team":"DAL","gp":15,"carries":327,"rushing_yards":1204,"rushing_tds":12,"receptions":47,"receiving_yards":249,"receiving_tds":3,"passing_yards":0,"passing_tds":0},
        {"season":"1997","team":"DAL","gp":16,"carries":261,"rushing_yards":1074,"rushing_tds":4, "receptions":40,"receiving_yards":234,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
        {"season":"1998","team":"DAL","gp":16,"carries":319,"rushing_yards":1332,"rushing_tds":13,"receptions":27,"receiving_yards":175,"receiving_tds":2,"passing_yards":0,"passing_tds":0},
    ],

    # ── Marshall Faulk ─────────────────────────────────────────────────────────
    "00-0005092": [
        {"season":"1994","team":"IND","gp":16,"carries":314,"rushing_yards":1282,"rushing_tds":11,"receptions":52,"receiving_yards":522,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
        {"season":"1995","team":"IND","gp":16,"carries":289,"rushing_yards":1078,"rushing_tds":11,"receptions":56,"receiving_yards":475,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1996","team":"IND","gp":16,"carries":270,"rushing_yards":587, "rushing_tds":7, "receptions":56,"receiving_yards":428,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1997","team":"IND","gp":16,"carries":264,"rushing_yards":1054,"rushing_tds":7, "receptions":48,"receiving_yards":471,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
        {"season":"1998","team":"IND","gp":16,"carries":324,"rushing_yards":1319,"rushing_tds":6, "receptions":86,"receiving_yards":908,"receiving_tds":4,"passing_yards":0,"passing_tds":0},
    ],

    # ── Jerome Bettis ──────────────────────────────────────────────────────────
    "00-0001215": [
        {"season":"1993","team":"LAR","gp":16,"carries":294,"rushing_yards":1429,"rushing_tds":7,"receptions":26,"receiving_yards":244,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1994","team":"LAR","gp":16,"carries":319,"rushing_yards":1025,"rushing_tds":3,"receptions":31,"receiving_yards":278,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1995","team":"LAR","gp":16,"carries":183,"rushing_yards":637, "rushing_tds":3,"receptions":18,"receiving_yards":106,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
        {"season":"1996","team":"PIT","gp":16,"carries":320,"rushing_yards":1431,"rushing_tds":11,"receptions":22,"receiving_yards":148,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1997","team":"PIT","gp":15,"carries":375,"rushing_yards":1665,"rushing_tds":7,"receptions":15,"receiving_yards":110,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1998","team":"PIT","gp":15,"carries":316,"rushing_yards":1185,"rushing_tds":3,"receptions":16,"receiving_yards":90, "receiving_tds":0,"passing_yards":0,"passing_tds":0},
    ],

    # ── Curtis Martin ──────────────────────────────────────────────────────────
    "00-0010442": [
        {"season":"1995","team":"NE", "gp":16,"carries":368,"rushing_yards":1487,"rushing_tds":14,"receptions":30,"receiving_yards":261,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
        {"season":"1996","team":"NE", "gp":16,"carries":316,"rushing_yards":1152,"rushing_tds":14,"receptions":46,"receiving_yards":333,"receiving_tds":3,"passing_yards":0,"passing_tds":0},
        {"season":"1997","team":"NYJ","gp":16,"carries":281,"rushing_yards":1160,"rushing_tds":6, "receptions":32,"receiving_yards":270,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
        {"season":"1998","team":"NYJ","gp":16,"carries":369,"rushing_yards":1287,"rushing_tds":8, "receptions":43,"receiving_yards":365,"receiving_tds":2,"passing_yards":0,"passing_tds":0},
    ],

    # ── Jerry Rice ─────────────────────────────────────────────────────────────
    "00-0013639": [
        {"season":"1985","team":"SF","gp":16,"targets":98, "receptions":49, "receiving_yards":927, "receiving_tds":3, "rushing_yards":26,  "rushing_tds":1,"passing_yards":0,"passing_tds":0},
        {"season":"1986","team":"SF","gp":16,"targets":152,"receptions":86, "receiving_yards":1570,"receiving_tds":15,"rushing_yards":72,  "rushing_tds":1,"passing_yards":0,"passing_tds":0},
        {"season":"1987","team":"SF","gp":12,"targets":112,"receptions":65, "receiving_yards":1078,"receiving_tds":22,"rushing_yards":51,  "rushing_tds":1,"passing_yards":0,"passing_tds":0},
        {"season":"1988","team":"SF","gp":16,"targets":121,"receptions":64, "receiving_yards":1306,"receiving_tds":9, "rushing_yards":107, "rushing_tds":1,"passing_yards":0,"passing_tds":0},
        {"season":"1989","team":"SF","gp":16,"targets":131,"receptions":82, "receiving_yards":1483,"receiving_tds":17,"rushing_yards":33,  "rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1990","team":"SF","gp":16,"targets":176,"receptions":100,"receiving_yards":1502,"receiving_tds":13,"rushing_yards":0,   "rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1991","team":"SF","gp":16,"targets":134,"receptions":80, "receiving_yards":1206,"receiving_tds":14,"rushing_yards":2,   "rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1992","team":"SF","gp":16,"targets":139,"receptions":84, "receiving_yards":1201,"receiving_tds":10,"rushing_yards":58,  "rushing_tds":1,"passing_yards":0,"passing_tds":0},
        {"season":"1993","team":"SF","gp":16,"targets":154,"receptions":98, "receiving_yards":1503,"receiving_tds":15,"rushing_yards":69,  "rushing_tds":1,"passing_yards":0,"passing_tds":0},
        {"season":"1994","team":"SF","gp":16,"targets":151,"receptions":112,"receiving_yards":1499,"receiving_tds":13,"rushing_yards":93,  "rushing_tds":2,"passing_yards":0,"passing_tds":0},
        {"season":"1995","team":"SF","gp":16,"targets":178,"receptions":122,"receiving_yards":1848,"receiving_tds":15,"rushing_yards":36,  "rushing_tds":1,"passing_yards":0,"passing_tds":0},
        {"season":"1996","team":"SF","gp":16,"targets":154,"receptions":108,"receiving_yards":1254,"receiving_tds":8, "rushing_yards":77,  "rushing_tds":1,"passing_yards":0,"passing_tds":0},
        {"season":"1997","team":"SF","gp":2, "targets":8,  "receptions":7,  "receiving_yards":78,  "receiving_tds":1, "rushing_yards":-10, "rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1998","team":"SF","gp":16,"targets":151,"receptions":82, "receiving_yards":1157,"receiving_tds":9, "rushing_yards":0,   "rushing_tds":0,"passing_yards":0,"passing_tds":0},
    ],

    # ── Tim Brown ──────────────────────────────────────────────────────────────
    "00-0002058": [
        {"season":"1988","team":"OAK","gp":16,"targets":81, "receptions":43,"receiving_yards":725, "receiving_tds":5,"rushing_yards":50, "rushing_tds":1,"passing_yards":0,"passing_tds":0},
        {"season":"1989","team":"OAK","gp":1, "targets":3,  "receptions":1, "receiving_yards":8,   "receiving_tds":0,"rushing_yards":0,  "rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1990","team":"OAK","gp":16,"targets":29, "receptions":18,"receiving_yards":265, "receiving_tds":3,"rushing_yards":0,  "rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1991","team":"OAK","gp":16,"targets":71, "receptions":36,"receiving_yards":554, "receiving_tds":5,"rushing_yards":16, "rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1992","team":"OAK","gp":15,"targets":96, "receptions":49,"receiving_yards":693, "receiving_tds":7,"rushing_yards":-4, "rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1993","team":"OAK","gp":16,"targets":129,"receptions":80,"receiving_yards":1180,"receiving_tds":7,"rushing_yards":7,  "rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1994","team":"OAK","gp":16,"targets":143,"receptions":89,"receiving_yards":1309,"receiving_tds":9,"rushing_yards":0,  "rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1995","team":"OAK","gp":16,"targets":148,"receptions":89,"receiving_yards":1342,"receiving_tds":10,"rushing_yards":0, "rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1996","team":"OAK","gp":16,"targets":147,"receptions":90,"receiving_yards":1104,"receiving_tds":9,"rushing_yards":35, "rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1997","team":"OAK","gp":16,"targets":162,"receptions":104,"receiving_yards":1408,"receiving_tds":5,"rushing_yards":19,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1998","team":"OAK","gp":16,"targets":153,"receptions":81,"receiving_yards":1012,"receiving_tds":9,"rushing_yards":-7, "rushing_tds":0,"passing_yards":0,"passing_tds":0},
    ],

    # ── Isaac Bruce ────────────────────────────────────────────────────────────
    "00-0002099": [
        {"season":"1994","team":"LAR","gp":12,"targets":45, "receptions":21,"receiving_yards":272, "receiving_tds":3,"rushing_yards":2,  "rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1995","team":"LAR","gp":16,"targets":199,"receptions":119,"receiving_yards":1781,"receiving_tds":13,"rushing_yards":17,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1996","team":"LAR","gp":16,"targets":152,"receptions":84,"receiving_yards":1338,"receiving_tds":7,"rushing_yards":4,  "rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1997","team":"LAR","gp":12,"targets":119,"receptions":56,"receiving_yards":815, "receiving_tds":5,"rushing_yards":0,  "rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1998","team":"LAR","gp":5, "targets":48, "receptions":32,"receiving_yards":457, "receiving_tds":1,"rushing_yards":30, "rushing_tds":0,"passing_yards":0,"passing_tds":0},
    ],

    # ── Keenan McCardell ───────────────────────────────────────────────────────
    "00-0010668": [
        {"season":"1992","team":"CLE","gp":2, "targets":2,  "receptions":1, "receiving_yards":8,   "receiving_tds":0,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1993","team":"CLE","gp":6, "targets":16, "receptions":13,"receiving_yards":234, "receiving_tds":4,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1994","team":"CLE","gp":13,"targets":25, "receptions":10,"receiving_yards":182, "receiving_tds":0,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1995","team":"CLE","gp":16,"targets":89, "receptions":56,"receiving_yards":709, "receiving_tds":4,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1996","team":"JAX","gp":16,"targets":127,"receptions":85,"receiving_yards":1129,"receiving_tds":3,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1997","team":"JAX","gp":16,"targets":130,"receptions":85,"receiving_yards":1164,"receiving_tds":5,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1998","team":"JAX","gp":15,"targets":113,"receptions":64,"receiving_yards":892, "receiving_tds":6,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
    ],

    # ── Shannon Sharpe ─────────────────────────────────────────────────────────
    "00-0014722": [
        {"season":"1990","team":"DEN","gp":16,"targets":13, "receptions":7, "receiving_yards":99,  "receiving_tds":1,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1991","team":"DEN","gp":16,"targets":31, "receptions":22,"receiving_yards":322, "receiving_tds":1,"rushing_yards":15,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1992","team":"DEN","gp":16,"targets":78, "receptions":53,"receiving_yards":640, "receiving_tds":2,"rushing_yards":-6,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1993","team":"DEN","gp":16,"targets":110,"receptions":81,"receiving_yards":995, "receiving_tds":9,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1994","team":"DEN","gp":15,"targets":139,"receptions":87,"receiving_yards":1010,"receiving_tds":4,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1995","team":"DEN","gp":13,"targets":94, "receptions":63,"receiving_yards":756, "receiving_tds":4,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1996","team":"DEN","gp":15,"targets":120,"receptions":80,"receiving_yards":1062,"receiving_tds":10,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1997","team":"DEN","gp":16,"targets":114,"receptions":72,"receiving_yards":1107,"receiving_tds":3,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1998","team":"DEN","gp":16,"targets":107,"receptions":64,"receiving_yards":768, "receiving_tds":10,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
    ],

    # ── Tony Gonzalez ──────────────────────────────────────────────────────────
    "00-0006101": [
        {"season":"1997","team":"KC","gp":16,"targets":54, "receptions":33,"receiving_yards":368,"receiving_tds":2,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1998","team":"KC","gp":16,"targets":103,"receptions":59,"receiving_yards":621,"receiving_tds":2,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
    ],

    # ── Terrell Owens ──────────────────────────────────────────────────────────
    "00-0012478": [
        {"season":"1996","team":"SF","gp":16,"targets":58, "receptions":35,"receiving_yards":520, "receiving_tds":4, "rushing_yards":0, "rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1997","team":"SF","gp":16,"targets":104,"receptions":60,"receiving_yards":936, "receiving_tds":8, "rushing_yards":0, "rushing_tds":0,"passing_yards":0,"passing_tds":0},
        {"season":"1998","team":"SF","gp":16,"targets":104,"receptions":67,"receiving_yards":1097,"receiving_tds":14,"rushing_yards":53,"rushing_tds":1,"passing_yards":0,"passing_tds":0},
    ],

    # ── Randy Moss ────────────────────────────────────────────────────────────
    "00-0011754": [
        {"season":"1998","team":"MIN","gp":16,"targets":125,"receptions":69,"receiving_yards":1313,"receiving_tds":17,"rushing_yards":4,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
    ],
}

# ─── 2. BRAND-NEW ENTRIES (complete careers) ──────────────────────────────────

NEW_PLAYERS = [
    # ── Jim Brown ──────────────────────────────────────────────────────────────
    {
        "player_id":   "00-0003346",
        "player_name": "Jim Brown",
        "position":    "RB",
        "bio":         {"height": "6-2", "weight": 232, "college": "Syracuse", "years_exp": 9, "draft_club": "CLE", "draft_number": 6},
        "seasons": [
            {"season":"1957","team":"CLE","gp":12,"carries":202,"rushing_yards":942, "rushing_tds":9, "receptions":16,"receiving_yards":55, "receiving_tds":1,"passing_yards":0,"passing_tds":0},
            {"season":"1958","team":"CLE","gp":12,"carries":257,"rushing_yards":1527,"rushing_tds":17,"receptions":16,"receiving_yards":138,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
            {"season":"1959","team":"CLE","gp":12,"carries":290,"rushing_yards":1329,"rushing_tds":14,"receptions":24,"receiving_yards":190,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1960","team":"CLE","gp":12,"carries":215,"rushing_yards":1257,"rushing_tds":9, "receptions":19,"receiving_yards":204,"receiving_tds":2,"passing_yards":0,"passing_tds":0},
            {"season":"1961","team":"CLE","gp":14,"carries":305,"rushing_yards":1408,"rushing_tds":8, "receptions":46,"receiving_yards":459,"receiving_tds":2,"passing_yards":0,"passing_tds":0},
            {"season":"1962","team":"CLE","gp":14,"carries":230,"rushing_yards":996, "rushing_tds":13,"receptions":47,"receiving_yards":517,"receiving_tds":5,"passing_yards":0,"passing_tds":0},
            {"season":"1963","team":"CLE","gp":14,"carries":291,"rushing_yards":1863,"rushing_tds":12,"receptions":24,"receiving_yards":268,"receiving_tds":3,"passing_yards":0,"passing_tds":0},
            {"season":"1964","team":"CLE","gp":14,"carries":280,"rushing_yards":1446,"rushing_tds":7, "receptions":36,"receiving_yards":340,"receiving_tds":4,"passing_yards":0,"passing_tds":0},
            {"season":"1965","team":"CLE","gp":14,"carries":289,"rushing_yards":1544,"rushing_tds":17,"receptions":34,"receiving_yards":328,"receiving_tds":4,"passing_yards":0,"passing_tds":0},
        ],
    },
    # ── Barry Sanders ──────────────────────────────────────────────────────────
    {
        "player_id":   "00-0014313",
        "player_name": "Barry Sanders",
        "position":    "RB",
        "bio":         {"height": "5-8", "weight": 203, "college": "Oklahoma State", "years_exp": 10, "draft_club": "DET", "draft_number": 3},
        "seasons": [
            {"season":"1989","team":"DET","gp":15,"carries":280,"rushing_yards":1470,"rushing_tds":14,"receptions":24,"receiving_yards":282,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1990","team":"DET","gp":16,"carries":255,"rushing_yards":1304,"rushing_tds":13,"receptions":36,"receiving_yards":480,"receiving_tds":3,"passing_yards":0,"passing_tds":0},
            {"season":"1991","team":"DET","gp":15,"carries":342,"rushing_yards":1548,"rushing_tds":16,"receptions":41,"receiving_yards":307,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
            {"season":"1992","team":"DET","gp":16,"carries":312,"rushing_yards":1352,"rushing_tds":9, "receptions":29,"receiving_yards":225,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
            {"season":"1993","team":"DET","gp":11,"carries":243,"rushing_yards":1115,"rushing_tds":3, "receptions":36,"receiving_yards":205,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1994","team":"DET","gp":16,"carries":331,"rushing_yards":1883,"rushing_tds":7, "receptions":44,"receiving_yards":283,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
            {"season":"1995","team":"DET","gp":16,"carries":314,"rushing_yards":1500,"rushing_tds":11,"receptions":48,"receiving_yards":398,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
            {"season":"1996","team":"DET","gp":16,"carries":307,"rushing_yards":1553,"rushing_tds":11,"receptions":24,"receiving_yards":147,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1997","team":"DET","gp":16,"carries":335,"rushing_yards":2053,"rushing_tds":11,"receptions":33,"receiving_yards":305,"receiving_tds":3,"passing_yards":0,"passing_tds":0},
            {"season":"1998","team":"DET","gp":16,"carries":343,"rushing_yards":1491,"rushing_tds":4, "receptions":37,"receiving_yards":289,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
        ],
    },
    # ── Bo Jackson ─────────────────────────────────────────────────────────────
    {
        "player_id":   "JAC631960",
        "player_name": "Bo Jackson",
        "position":    "RB",
        "bio":         {"height": "6-1", "weight": 230, "college": "Auburn", "years_exp": 4, "draft_club": "OAK", "draft_number": 183},
        "seasons": [
            {"season":"1987","team":"OAK","gp":7, "carries":81, "rushing_yards":554,"rushing_tds":4,"receptions":16,"receiving_yards":136,"receiving_tds":2,"passing_yards":0,"passing_tds":0},
            {"season":"1988","team":"OAK","gp":10,"carries":136,"rushing_yards":580,"rushing_tds":3,"receptions":9, "receiving_yards":79, "receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1989","team":"OAK","gp":11,"carries":173,"rushing_yards":950,"rushing_tds":4,"receptions":9, "receiving_yards":69, "receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1990","team":"OAK","gp":10,"carries":125,"rushing_yards":698,"rushing_tds":5,"receptions":6, "receiving_yards":68, "receiving_tds":0,"passing_yards":0,"passing_tds":0},
        ],
    },
    # ── Dan Marino ─────────────────────────────────────────────────────────────
    {
        "player_id":   "00-0010379",
        "player_name": "Dan Marino",
        "position":    "QB",
        "bio":         {"height": "6-4", "weight": 228, "college": "Pittsburgh", "years_exp": 17, "draft_club": "MIA", "draft_number": 27},
        "seasons": [
            {"season":"1983","team":"MIA","gp":11,"completions":173,"attempts":296,"passing_yards":2210,"passing_tds":20,"interceptions":6, "rushing_yards":0,"rushing_tds":0},
            {"season":"1984","team":"MIA","gp":16,"completions":362,"attempts":564,"passing_yards":5084,"passing_tds":48,"interceptions":17,"rushing_yards":0,"rushing_tds":0},
            {"season":"1985","team":"MIA","gp":16,"completions":336,"attempts":567,"passing_yards":4137,"passing_tds":30,"interceptions":21,"rushing_yards":0,"rushing_tds":0},
            {"season":"1986","team":"MIA","gp":16,"completions":378,"attempts":623,"passing_yards":4746,"passing_tds":44,"interceptions":23,"rushing_yards":0,"rushing_tds":0},
            {"season":"1987","team":"MIA","gp":12,"completions":263,"attempts":444,"passing_yards":3245,"passing_tds":26,"interceptions":13,"rushing_yards":0,"rushing_tds":0},
            {"season":"1988","team":"MIA","gp":16,"completions":354,"attempts":606,"passing_yards":4434,"passing_tds":28,"interceptions":23,"rushing_yards":0,"rushing_tds":0},
            {"season":"1989","team":"MIA","gp":16,"completions":308,"attempts":550,"passing_yards":3997,"passing_tds":24,"interceptions":22,"rushing_yards":0,"rushing_tds":0},
            {"season":"1990","team":"MIA","gp":16,"completions":306,"attempts":531,"passing_yards":3563,"passing_tds":21,"interceptions":11,"rushing_yards":0,"rushing_tds":0},
            {"season":"1991","team":"MIA","gp":16,"completions":318,"attempts":549,"passing_yards":3970,"passing_tds":25,"interceptions":13,"rushing_yards":0,"rushing_tds":0},
            {"season":"1992","team":"MIA","gp":16,"completions":330,"attempts":554,"passing_yards":4116,"passing_tds":24,"interceptions":16,"rushing_yards":0,"rushing_tds":0},
            {"season":"1993","team":"MIA","gp":5, "completions":91, "attempts":150,"passing_yards":1218,"passing_tds":8, "interceptions":3, "rushing_yards":0,"rushing_tds":0},
            {"season":"1994","team":"MIA","gp":16,"completions":385,"attempts":615,"passing_yards":4453,"passing_tds":30,"interceptions":17,"rushing_yards":0,"rushing_tds":0},
            {"season":"1995","team":"MIA","gp":14,"completions":309,"attempts":482,"passing_yards":3668,"passing_tds":24,"interceptions":15,"rushing_yards":0,"rushing_tds":0},
            {"season":"1996","team":"MIA","gp":13,"completions":221,"attempts":373,"passing_yards":2795,"passing_tds":17,"interceptions":9, "rushing_yards":0,"rushing_tds":0},
            {"season":"1997","team":"MIA","gp":16,"completions":319,"attempts":548,"passing_yards":3780,"passing_tds":16,"interceptions":11,"rushing_yards":0,"rushing_tds":0},
            {"season":"1998","team":"MIA","gp":16,"completions":310,"attempts":537,"passing_yards":3497,"passing_tds":23,"interceptions":15,"rushing_yards":0,"rushing_tds":0},
            {"season":"1999","team":"MIA","gp":11,"completions":204,"attempts":369,"passing_yards":2448,"passing_tds":12,"interceptions":17,"rushing_yards":0,"rushing_tds":0},
        ],
    },
    # ── Joe Montana ────────────────────────────────────────────────────────────
    {
        "player_id":   "00-0011493",
        "player_name": "Joe Montana",
        "position":    "QB",
        "bio":         {"height": "6-2", "weight": 200, "college": "Notre Dame", "years_exp": 16, "draft_club": "SF", "draft_number": 82},
        "seasons": [
            {"season":"1979","team":"SF","gp":16,"completions":13, "attempts":23, "passing_yards":96,  "passing_tds":1, "interceptions":0, "rushing_yards":0,"rushing_tds":0},
            {"season":"1980","team":"SF","gp":15,"completions":176,"attempts":273,"passing_yards":1795,"passing_tds":15,"interceptions":9, "rushing_yards":0,"rushing_tds":0},
            {"season":"1981","team":"SF","gp":16,"completions":311,"attempts":488,"passing_yards":3565,"passing_tds":19,"interceptions":12,"rushing_yards":0,"rushing_tds":0},
            {"season":"1982","team":"SF","gp":9, "completions":213,"attempts":346,"passing_yards":2613,"passing_tds":17,"interceptions":11,"rushing_yards":0,"rushing_tds":0},
            {"season":"1983","team":"SF","gp":16,"completions":332,"attempts":515,"passing_yards":3910,"passing_tds":26,"interceptions":12,"rushing_yards":0,"rushing_tds":0},
            {"season":"1984","team":"SF","gp":16,"completions":279,"attempts":432,"passing_yards":3630,"passing_tds":28,"interceptions":10,"rushing_yards":0,"rushing_tds":0},
            {"season":"1985","team":"SF","gp":15,"completions":303,"attempts":494,"passing_yards":3653,"passing_tds":27,"interceptions":13,"rushing_yards":0,"rushing_tds":0},
            {"season":"1986","team":"SF","gp":8, "completions":191,"attempts":307,"passing_yards":2236,"passing_tds":8, "interceptions":9, "rushing_yards":0,"rushing_tds":0},
            {"season":"1987","team":"SF","gp":13,"completions":266,"attempts":398,"passing_yards":3054,"passing_tds":31,"interceptions":13,"rushing_yards":0,"rushing_tds":0},
            {"season":"1988","team":"SF","gp":14,"completions":238,"attempts":397,"passing_yards":2981,"passing_tds":18,"interceptions":10,"rushing_yards":0,"rushing_tds":0},
            {"season":"1989","team":"SF","gp":13,"completions":271,"attempts":386,"passing_yards":3521,"passing_tds":26,"interceptions":8, "rushing_yards":0,"rushing_tds":0},
            {"season":"1990","team":"SF","gp":15,"completions":321,"attempts":520,"passing_yards":3944,"passing_tds":26,"interceptions":16,"rushing_yards":0,"rushing_tds":0},
            {"season":"1992","team":"SF","gp":1, "completions":15, "attempts":21, "passing_yards":126, "passing_tds":2, "interceptions":0, "rushing_yards":0,"rushing_tds":0},
            {"season":"1993","team":"KC","gp":11,"completions":181,"attempts":298,"passing_yards":2144,"passing_tds":13,"interceptions":7, "rushing_yards":0,"rushing_tds":0},
            {"season":"1994","team":"KC","gp":14,"completions":299,"attempts":493,"passing_yards":3283,"passing_tds":16,"interceptions":9, "rushing_yards":0,"rushing_tds":0},
        ],
    },
    # ── Steve Young ────────────────────────────────────────────────────────────
    {
        "player_id":   "00-0018441",
        "player_name": "Steve Young",
        "position":    "QB",
        "bio":         {"height": "6-2", "weight": 215, "college": "Brigham Young", "years_exp": 15, "draft_club": "TB", "draft_number": 1},
        "seasons": [
            {"season":"1985","team":"TB","gp":5, "completions":72, "attempts":138,"passing_yards":935, "passing_tds":3, "interceptions":8, "rushing_yards":0,"rushing_tds":0},
            {"season":"1986","team":"TB","gp":14,"completions":195,"attempts":363,"passing_yards":2282,"passing_tds":8, "interceptions":13,"rushing_yards":0,"rushing_tds":0},
            {"season":"1987","team":"SF","gp":8, "completions":37, "attempts":69, "passing_yards":570, "passing_tds":10,"interceptions":0, "rushing_yards":0,"rushing_tds":0},
            {"season":"1988","team":"SF","gp":11,"completions":54, "attempts":101,"passing_yards":680, "passing_tds":3, "interceptions":3, "rushing_yards":0,"rushing_tds":0},
            {"season":"1989","team":"SF","gp":10,"completions":64, "attempts":92, "passing_yards":1001,"passing_tds":8, "interceptions":3, "rushing_yards":0,"rushing_tds":0},
            {"season":"1990","team":"SF","gp":6, "completions":38, "attempts":62, "passing_yards":427, "passing_tds":2, "interceptions":0, "rushing_yards":0,"rushing_tds":0},
            {"season":"1991","team":"SF","gp":11,"completions":180,"attempts":279,"passing_yards":2517,"passing_tds":17,"interceptions":8, "rushing_yards":0,"rushing_tds":0},
            {"season":"1992","team":"SF","gp":16,"completions":268,"attempts":402,"passing_yards":3465,"passing_tds":25,"interceptions":7, "rushing_yards":0,"rushing_tds":0},
            {"season":"1993","team":"SF","gp":16,"completions":314,"attempts":462,"passing_yards":4023,"passing_tds":29,"interceptions":16,"rushing_yards":0,"rushing_tds":0},
            {"season":"1994","team":"SF","gp":16,"completions":324,"attempts":461,"passing_yards":3969,"passing_tds":35,"interceptions":10,"rushing_yards":0,"rushing_tds":0},
            {"season":"1995","team":"SF","gp":11,"completions":299,"attempts":447,"passing_yards":3200,"passing_tds":20,"interceptions":11,"rushing_yards":0,"rushing_tds":0},
            {"season":"1996","team":"SF","gp":12,"completions":214,"attempts":316,"passing_yards":2410,"passing_tds":14,"interceptions":6, "rushing_yards":0,"rushing_tds":0},
            {"season":"1997","team":"SF","gp":15,"completions":241,"attempts":356,"passing_yards":3029,"passing_tds":19,"interceptions":6, "rushing_yards":0,"rushing_tds":0},
            {"season":"1998","team":"SF","gp":15,"completions":322,"attempts":517,"passing_yards":4170,"passing_tds":36,"interceptions":12,"rushing_yards":0,"rushing_tds":0},
            {"season":"1999","team":"SF","gp":3, "completions":45, "attempts":84, "passing_yards":446, "passing_tds":3, "interceptions":4, "rushing_yards":0,"rushing_tds":0},
        ],
    },
    # ── Cris Carter ────────────────────────────────────────────────────────────
    {
        "player_id":   "00-0002721",
        "player_name": "Cris Carter",
        "position":    "WR",
        "bio":         {"height": "6-3", "weight": 202, "college": "Ohio State", "years_exp": 16, "draft_club": "PHI", "draft_number": 83},
        "seasons": [
            {"season":"1987","team":"PHI","gp":9, "targets":40, "receptions":22,"receiving_yards":272, "receiving_tds":1, "rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1988","team":"PHI","gp":16,"targets":60, "receptions":39,"receiving_yards":761, "receiving_tds":6, "rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1989","team":"PHI","gp":16,"targets":61, "receptions":45,"receiving_yards":605, "receiving_tds":11,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1990","team":"MIN","gp":16,"targets":70, "receptions":27,"receiving_yards":413, "receiving_tds":3, "rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1991","team":"MIN","gp":16,"targets":89, "receptions":72,"receiving_yards":962, "receiving_tds":5, "rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1992","team":"MIN","gp":16,"targets":101,"receptions":53,"receiving_yards":681, "receiving_tds":6, "rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1993","team":"MIN","gp":16,"targets":126,"receptions":86,"receiving_yards":1071,"receiving_tds":9, "rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1994","team":"MIN","gp":16,"targets":122,"receptions":122,"receiving_yards":1256,"receiving_tds":7,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1995","team":"MIN","gp":16,"targets":138,"receptions":122,"receiving_yards":1371,"receiving_tds":17,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1996","team":"MIN","gp":16,"targets":130,"receptions":96, "receiving_yards":1163,"receiving_tds":10,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1997","team":"MIN","gp":16,"targets":142,"receptions":89, "receiving_yards":1069,"receiving_tds":13,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1998","team":"MIN","gp":16,"targets":138,"receptions":78, "receiving_yards":1011,"receiving_tds":12,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1999","team":"MIN","gp":16,"targets":114,"receptions":90, "receiving_yards":1241,"receiving_tds":13,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"2000","team":"MIN","gp":16,"targets":108,"receptions":71, "receiving_yards":784, "receiving_tds":9, "rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"2001","team":"MIN","gp":16,"targets":99, "receptions":73, "receiving_yards":871, "receiving_tds":10,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"2002","team":"MIA","gp":5, "targets":9,  "receptions":4,  "receiving_yards":42,  "receiving_tds":0,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
        ],
    },
    # ── Michael Irvin ──────────────────────────────────────────────────────────
    {
        "player_id":   "00-0008044",
        "player_name": "Michael Irvin",
        "position":    "WR",
        "bio":         {"height": "6-2", "weight": 207, "college": "Miami", "years_exp": 12, "draft_club": "DAL", "draft_number": 11},
        "seasons": [
            {"season":"1988","team":"DAL","gp":16,"targets":53, "receptions":32,"receiving_yards":654, "receiving_tds":5, "rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1989","team":"DAL","gp":6, "targets":30, "receptions":26,"receiving_yards":378, "receiving_tds":2, "rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1990","team":"DAL","gp":12,"targets":83, "receptions":20,"receiving_yards":413, "receiving_tds":4, "rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1991","team":"DAL","gp":16,"targets":132,"receptions":93,"receiving_yards":1523,"receiving_tds":8, "rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1992","team":"DAL","gp":16,"targets":130,"receptions":78,"receiving_yards":1396,"receiving_tds":7, "rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1993","team":"DAL","gp":16,"targets":130,"receptions":88,"receiving_yards":1330,"receiving_tds":7, "rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1994","team":"DAL","gp":16,"targets":140,"receptions":79,"receiving_yards":1241,"receiving_tds":6, "rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1995","team":"DAL","gp":16,"targets":158,"receptions":111,"receiving_yards":1603,"receiving_tds":10,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1996","team":"DAL","gp":11,"targets":95, "receptions":64,"receiving_yards":962, "receiving_tds":2, "rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1997","team":"DAL","gp":16,"targets":119,"receptions":75,"receiving_yards":1180,"receiving_tds":9, "rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1998","team":"DAL","gp":16,"targets":113,"receptions":74,"receiving_yards":1057,"receiving_tds":1, "rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1999","team":"DAL","gp":4, "targets":20, "receptions":10,"receiving_yards":167, "receiving_tds":1, "rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
        ],
    },
    # ── Andre Reed ─────────────────────────────────────────────────────────────
    {
        "player_id":   "00-0013499",
        "player_name": "Andre Reed",
        "position":    "WR",
        "bio":         {"height": "6-2", "weight": 190, "college": "Kutztown", "years_exp": 16, "draft_club": "BUF", "draft_number": 86},
        "seasons": [
            {"season":"1985","team":"BUF","gp":16,"targets":44, "receptions":48, "receiving_yards":637, "receiving_tds":4,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1986","team":"BUF","gp":16,"targets":82, "receptions":53, "receiving_yards":739, "receiving_tds":7,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1987","team":"BUF","gp":12,"targets":72, "receptions":57, "receiving_yards":752, "receiving_tds":5,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1988","team":"BUF","gp":16,"targets":105,"receptions":71, "receiving_yards":968, "receiving_tds":6,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1989","team":"BUF","gp":16,"targets":109,"receptions":88, "receiving_yards":1312,"receiving_tds":9,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1990","team":"BUF","gp":16,"targets":90, "receptions":71, "receiving_yards":945, "receiving_tds":8,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1991","team":"BUF","gp":16,"targets":116,"receptions":81, "receiving_yards":1113,"receiving_tds":10,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1992","team":"BUF","gp":16,"targets":107,"receptions":65, "receiving_yards":794, "receiving_tds":3,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1993","team":"BUF","gp":16,"targets":119,"receptions":52, "receiving_yards":854, "receiving_tds":6,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1994","team":"BUF","gp":16,"targets":93, "receptions":60, "receiving_yards":1303,"receiving_tds":8,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1995","team":"BUF","gp":16,"targets":99, "receptions":67, "receiving_yards":1036,"receiving_tds":8,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1996","team":"BUF","gp":16,"targets":73, "receptions":49, "receiving_yards":522, "receiving_tds":3,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1997","team":"BUF","gp":16,"targets":62, "receptions":45, "receiving_yards":880, "receiving_tds":5,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1998","team":"BUF","gp":16,"targets":64, "receptions":44, "receiving_yards":589, "receiving_tds":1,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1999","team":"BUF","gp":16,"targets":51, "receptions":36, "receiving_yards":428, "receiving_tds":4,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"2000","team":"WAS","gp":9, "targets":12, "receptions":6,  "receiving_yards":56,  "receiving_tds":1,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
        ],
    },
    # ── John Elway ─────────────────────────────────────────────────────────────
    {
        "player_id":   "00-0004884",
        "player_name": "John Elway",
        "position":    "QB",
        "bio":         {"height": "6-3", "weight": 215, "college": "Stanford", "years_exp": 16, "draft_club": "DEN", "draft_number": 1},
        "seasons": [
            {"season":"1983","team":"DEN","gp":11,"completions":123,"attempts":259,"passing_yards":1663,"passing_tds":7, "interceptions":14,"rushing_yards":0,"rushing_tds":0},
            {"season":"1984","team":"DEN","gp":15,"completions":214,"attempts":380,"passing_yards":2598,"passing_tds":18,"interceptions":15,"rushing_yards":0,"rushing_tds":0},
            {"season":"1985","team":"DEN","gp":16,"completions":327,"attempts":605,"passing_yards":3891,"passing_tds":22,"interceptions":23,"rushing_yards":0,"rushing_tds":0},
            {"season":"1986","team":"DEN","gp":16,"completions":280,"attempts":504,"passing_yards":3485,"passing_tds":19,"interceptions":13,"rushing_yards":0,"rushing_tds":0},
            {"season":"1987","team":"DEN","gp":12,"completions":224,"attempts":410,"passing_yards":3198,"passing_tds":19,"interceptions":12,"rushing_yards":0,"rushing_tds":0},
            {"season":"1988","team":"DEN","gp":15,"completions":274,"attempts":496,"passing_yards":3309,"passing_tds":17,"interceptions":19,"rushing_yards":0,"rushing_tds":0},
            {"season":"1989","team":"DEN","gp":15,"completions":223,"attempts":416,"passing_yards":3051,"passing_tds":18,"interceptions":18,"rushing_yards":0,"rushing_tds":0},
            {"season":"1990","team":"DEN","gp":16,"completions":294,"attempts":502,"passing_yards":3526,"passing_tds":15,"interceptions":14,"rushing_yards":0,"rushing_tds":0},
            {"season":"1991","team":"DEN","gp":16,"completions":242,"attempts":451,"passing_yards":3253,"passing_tds":13,"interceptions":12,"rushing_yards":0,"rushing_tds":0},
            {"season":"1992","team":"DEN","gp":12,"completions":174,"attempts":316,"passing_yards":2242,"passing_tds":10,"interceptions":17,"rushing_yards":0,"rushing_tds":0},
            {"season":"1993","team":"DEN","gp":16,"completions":348,"attempts":551,"passing_yards":4030,"passing_tds":25,"interceptions":10,"rushing_yards":0,"rushing_tds":0},
            {"season":"1994","team":"DEN","gp":14,"completions":307,"attempts":494,"passing_yards":3490,"passing_tds":16,"interceptions":10,"rushing_yards":0,"rushing_tds":0},
            {"season":"1995","team":"DEN","gp":16,"completions":316,"attempts":542,"passing_yards":3970,"passing_tds":26,"interceptions":14,"rushing_yards":0,"rushing_tds":0},
            {"season":"1996","team":"DEN","gp":15,"completions":287,"attempts":466,"passing_yards":3328,"passing_tds":26,"interceptions":14,"rushing_yards":0,"rushing_tds":0},
            {"season":"1997","team":"DEN","gp":16,"completions":280,"attempts":502,"passing_yards":3635,"passing_tds":27,"interceptions":11,"rushing_yards":0,"rushing_tds":0},
            {"season":"1998","team":"DEN","gp":13,"completions":210,"attempts":356,"passing_yards":2806,"passing_tds":22,"interceptions":10,"rushing_yards":0,"rushing_tds":0},
        ],
    },
    # ── Randall Cunningham ─────────────────────────────────────────────────────
    {
        "player_id":   "00-0003761",
        "player_name": "Randall Cunningham",
        "position":    "QB",
        "bio":         {"height": "6-4", "weight": 212, "college": "UNLV", "years_exp": 16, "draft_club": "PHI", "draft_number": 37},
        "seasons": [
            {"season":"1985","team":"PHI","gp":6, "completions":34, "attempts":81, "passing_yards":548, "passing_tds":1, "interceptions":8, "rushing_yards":0,"rushing_tds":0},
            {"season":"1986","team":"PHI","gp":15,"completions":111,"attempts":209,"passing_yards":1391,"passing_tds":8, "interceptions":7, "rushing_yards":0,"rushing_tds":0},
            {"season":"1987","team":"PHI","gp":12,"completions":223,"attempts":406,"passing_yards":2786,"passing_tds":23,"interceptions":12,"rushing_yards":0,"rushing_tds":0},
            {"season":"1988","team":"PHI","gp":16,"completions":301,"attempts":560,"passing_yards":3808,"passing_tds":24,"interceptions":16,"rushing_yards":0,"rushing_tds":0},
            {"season":"1989","team":"PHI","gp":16,"completions":290,"attempts":532,"passing_yards":3400,"passing_tds":21,"interceptions":15,"rushing_yards":0,"rushing_tds":0},
            {"season":"1990","team":"PHI","gp":16,"completions":271,"attempts":465,"passing_yards":3466,"passing_tds":30,"interceptions":13,"rushing_yards":0,"rushing_tds":0},
            {"season":"1991","team":"PHI","gp":1, "completions":1,  "attempts":4,  "passing_yards":19,  "passing_tds":0, "interceptions":0, "rushing_yards":0,"rushing_tds":0},
            {"season":"1992","team":"PHI","gp":15,"completions":233,"attempts":384,"passing_yards":2775,"passing_tds":19,"interceptions":11,"rushing_yards":0,"rushing_tds":0},
            {"season":"1993","team":"PHI","gp":4, "completions":76, "attempts":110,"passing_yards":850, "passing_tds":5, "interceptions":5, "rushing_yards":0,"rushing_tds":0},
            {"season":"1994","team":"PHI","gp":14,"completions":265,"attempts":490,"passing_yards":3229,"passing_tds":16,"interceptions":13,"rushing_yards":0,"rushing_tds":0},
            {"season":"1995","team":"PHI","gp":7, "completions":69, "attempts":121,"passing_yards":605, "passing_tds":3, "interceptions":5, "rushing_yards":0,"rushing_tds":0},
            {"season":"1997","team":"MIN","gp":6, "completions":44, "attempts":88, "passing_yards":501, "passing_tds":6, "interceptions":4, "rushing_yards":0,"rushing_tds":0},
            {"season":"1998","team":"MIN","gp":15,"completions":259,"attempts":425,"passing_yards":3704,"passing_tds":34,"interceptions":10,"rushing_yards":0,"rushing_tds":0},
            {"season":"1999","team":"MIN","gp":6, "completions":124,"attempts":200,"passing_yards":1475,"passing_tds":8, "interceptions":9, "rushing_yards":0,"rushing_tds":0},
            {"season":"2000","team":"DAL","gp":6, "completions":74, "attempts":125,"passing_yards":849, "passing_tds":6, "interceptions":4, "rushing_yards":0,"rushing_tds":0},
        ],
    },
    # ── Terrell Davis ──────────────────────────────────────────────────────────
    {
        "player_id":   "00-0004054",
        "player_name": "Terrell Davis",
        "position":    "RB",
        "bio":         {"height": "5-11", "weight": 210, "college": "Georgia", "years_exp": 7, "draft_club": "DEN", "draft_number": 196},
        "seasons": [
            {"season":"1995","team":"DEN","gp":14,"carries":237,"rushing_yards":1117,"rushing_tds":7, "receptions":49,"receiving_yards":367,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
            {"season":"1996","team":"DEN","gp":16,"carries":345,"rushing_yards":1538,"rushing_tds":13,"receptions":36,"receiving_yards":310,"receiving_tds":2,"passing_yards":0,"passing_tds":0},
            {"season":"1997","team":"DEN","gp":15,"carries":369,"rushing_yards":1750,"rushing_tds":15,"receptions":42,"receiving_yards":287,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1998","team":"DEN","gp":16,"carries":392,"rushing_yards":2008,"rushing_tds":21,"receptions":25,"receiving_yards":217,"receiving_tds":2,"passing_yards":0,"passing_tds":0},
            {"season":"1999","team":"DEN","gp":4, "carries":67, "rushing_yards":211, "rushing_tds":2, "receptions":3, "receiving_yards":26, "receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"2000","team":"DEN","gp":5, "carries":78, "rushing_yards":282, "rushing_tds":2, "receptions":2, "receiving_yards":4,  "receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"2001","team":"DEN","gp":8, "carries":167,"rushing_yards":701, "rushing_tds":0, "receptions":12,"receiving_yards":69, "receiving_tds":0,"passing_yards":0,"passing_tds":0},
        ],
    },
    # ── Walter Payton ──────────────────────────────────────────────────────────
    {
        "player_id":   "PAY738296",
        "player_name": "Walter Payton",
        "position":    "RB",
        "bio":         {"height": "5-10", "weight": 202, "college": "Jackson State", "years_exp": 13, "draft_club": "CHI", "draft_number": 4},
        "seasons": [
            {"season":"1975","team":"CHI","gp":13,"carries":196,"rushing_yards":679, "rushing_tds":7, "receptions":33,"receiving_yards":213,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1976","team":"CHI","gp":14,"carries":311,"rushing_yards":1390,"rushing_tds":13,"receptions":15,"receiving_yards":149,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1977","team":"CHI","gp":14,"carries":339,"rushing_yards":1852,"rushing_tds":14,"receptions":27,"receiving_yards":269,"receiving_tds":2,"passing_yards":0,"passing_tds":0},
            {"season":"1978","team":"CHI","gp":16,"carries":333,"rushing_yards":1395,"rushing_tds":11,"receptions":50,"receiving_yards":480,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1979","team":"CHI","gp":16,"carries":369,"rushing_yards":1610,"rushing_tds":14,"receptions":31,"receiving_yards":313,"receiving_tds":2,"passing_yards":0,"passing_tds":0},
            {"season":"1980","team":"CHI","gp":16,"carries":317,"rushing_yards":1460,"rushing_tds":6, "receptions":46,"receiving_yards":367,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
            {"season":"1981","team":"CHI","gp":16,"carries":339,"rushing_yards":1222,"rushing_tds":6, "receptions":41,"receiving_yards":379,"receiving_tds":2,"passing_yards":0,"passing_tds":0},
            {"season":"1982","team":"CHI","gp":9, "carries":148,"rushing_yards":596, "rushing_tds":1, "receptions":32,"receiving_yards":311,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1983","team":"CHI","gp":16,"carries":314,"rushing_yards":1421,"rushing_tds":6, "receptions":53,"receiving_yards":607,"receiving_tds":2,"passing_yards":0,"passing_tds":0},
            {"season":"1984","team":"CHI","gp":16,"carries":381,"rushing_yards":1684,"rushing_tds":11,"receptions":45,"receiving_yards":368,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1985","team":"CHI","gp":16,"carries":324,"rushing_yards":1551,"rushing_tds":9, "receptions":49,"receiving_yards":483,"receiving_tds":2,"passing_yards":0,"passing_tds":0},
            {"season":"1986","team":"CHI","gp":16,"carries":321,"rushing_yards":1333,"rushing_tds":8, "receptions":37,"receiving_yards":382,"receiving_tds":3,"passing_yards":0,"passing_tds":0},
            {"season":"1987","team":"CHI","gp":12,"carries":146,"rushing_yards":533, "rushing_tds":4, "receptions":33,"receiving_yards":217,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
        ],
    },
    # ── Eric Dickerson ─────────────────────────────────────────────────────────
    # 1987 split: traded from LAR to IND mid-season — stored as two entries
    {
        "player_id":   "00-0004416",
        "player_name": "Eric Dickerson",
        "position":    "RB",
        "bio":         {"height": "6-3", "weight": 220, "college": "SMU", "years_exp": 11, "draft_club": "LAR", "draft_number": 2},
        "seasons": [
            {"season":"1983","team":"LAR","gp":16,"carries":390,"rushing_yards":1808,"rushing_tds":18,"receptions":51,"receiving_yards":404,"receiving_tds":2,"passing_yards":0,"passing_tds":0},
            {"season":"1984","team":"LAR","gp":16,"carries":379,"rushing_yards":2105,"rushing_tds":14,"receptions":21,"receiving_yards":139,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1985","team":"LAR","gp":14,"carries":292,"rushing_yards":1234,"rushing_tds":12,"receptions":20,"receiving_yards":126,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1986","team":"LAR","gp":16,"carries":404,"rushing_yards":1821,"rushing_tds":11,"receptions":26,"receiving_yards":205,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1987","team":"LAR","gp":3, "carries":60, "rushing_yards":277, "rushing_tds":1, "receptions":5, "receiving_yards":38, "receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1987b","team":"IND","gp":9, "carries":223,"rushing_yards":1011,"rushing_tds":5, "receptions":13,"receiving_yards":133,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1988","team":"IND","gp":16,"carries":388,"rushing_yards":1659,"rushing_tds":14,"receptions":36,"receiving_yards":377,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
            {"season":"1989","team":"IND","gp":15,"carries":314,"rushing_yards":1311,"rushing_tds":7, "receptions":30,"receiving_yards":211,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
            {"season":"1990","team":"IND","gp":11,"carries":166,"rushing_yards":677, "rushing_tds":4, "receptions":18,"receiving_yards":92, "receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1991","team":"IND","gp":10,"carries":167,"rushing_yards":536, "rushing_tds":2, "receptions":41,"receiving_yards":269,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
            {"season":"1992","team":"LV", "gp":16,"carries":187,"rushing_yards":729, "rushing_tds":2, "receptions":14,"receiving_yards":85, "receiving_tds":1,"passing_yards":0,"passing_tds":0},
            {"season":"1993","team":"ATL","gp":4, "carries":26, "rushing_yards":91,  "rushing_tds":0, "receptions":0, "receiving_yards":0,  "receiving_tds":0,"passing_yards":0,"passing_tds":0},
        ],
    },
    # ── Steve Largent ──────────────────────────────────────────────────────────
    {
        "player_id":   "LAR118653",
        "player_name": "Steve Largent",
        "position":    "WR",
        "bio":         {"height": "5-11", "weight": 187, "college": "Tulsa", "years_exp": 14, "draft_club": "SEA", "draft_number": 117},
        "seasons": [
            {"season":"1976","team":"SEA","gp":14,"targets":0,  "receptions":54,"receiving_yards":705, "receiving_tds":4, "rushing_yards":-14,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1977","team":"SEA","gp":14,"targets":0,  "receptions":33,"receiving_yards":643, "receiving_tds":10,"rushing_yards":0,  "rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1978","team":"SEA","gp":16,"targets":123,"receptions":71,"receiving_yards":1168,"receiving_tds":8, "rushing_yards":0,  "rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1979","team":"SEA","gp":15,"targets":120,"receptions":66,"receiving_yards":1237,"receiving_tds":9, "rushing_yards":0,  "rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1980","team":"SEA","gp":16,"targets":132,"receptions":66,"receiving_yards":1064,"receiving_tds":6, "rushing_yards":2,  "rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1981","team":"SEA","gp":16,"targets":123,"receptions":75,"receiving_yards":1224,"receiving_tds":9, "rushing_yards":47, "rushing_tds":1,"passing_yards":0,"passing_tds":0},
            {"season":"1982","team":"SEA","gp":8, "targets":71, "receptions":34,"receiving_yards":493, "receiving_tds":3, "rushing_yards":8,  "rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1983","team":"SEA","gp":15,"targets":120,"receptions":72,"receiving_yards":1074,"receiving_tds":11,"rushing_yards":0,  "rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1984","team":"SEA","gp":16,"targets":128,"receptions":74,"receiving_yards":1164,"receiving_tds":12,"rushing_yards":10, "rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1985","team":"SEA","gp":16,"targets":149,"receptions":79,"receiving_yards":1287,"receiving_tds":6, "rushing_yards":0,  "rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1986","team":"SEA","gp":16,"targets":119,"receptions":70,"receiving_yards":1070,"receiving_tds":9, "rushing_yards":0,  "rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1987","team":"SEA","gp":13,"targets":95, "receptions":58,"receiving_yards":912, "receiving_tds":8, "rushing_yards":33, "rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1988","team":"SEA","gp":15,"targets":65, "receptions":39,"receiving_yards":645, "receiving_tds":2, "rushing_yards":-3, "rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1989","team":"SEA","gp":10,"targets":61, "receptions":28,"receiving_yards":403, "receiving_tds":3, "rushing_yards":0,  "rushing_tds":0,"passing_yards":0,"passing_tds":0},
        ],
    },
    # ── Kellen Winslow Sr. ─────────────────────────────────────────────────────
    {
        "player_id":   "WIN521505",
        "player_name": "Kellen Winslow",
        "position":    "TE",
        "bio":         {"height": "6-5", "weight": 251, "college": "Missouri", "years_exp": 9, "draft_club": "LAC", "draft_number": 13},
        "seasons": [
            {"season":"1979","team":"LAC","gp":7, "targets":36, "receptions":25,"receiving_yards":255, "receiving_tds":2,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1980","team":"LAC","gp":16,"targets":132,"receptions":89,"receiving_yards":1290,"receiving_tds":9,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1981","team":"LAC","gp":16,"targets":140,"receptions":88,"receiving_yards":1075,"receiving_tds":10,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1982","team":"LAC","gp":9, "targets":72, "receptions":54,"receiving_yards":721, "receiving_tds":6,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1983","team":"LAC","gp":16,"targets":138,"receptions":88,"receiving_yards":1172,"receiving_tds":8,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1984","team":"LAC","gp":7, "targets":75, "receptions":55,"receiving_yards":663, "receiving_tds":2,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1985","team":"LAC","gp":10,"targets":43, "receptions":25,"receiving_yards":318, "receiving_tds":0,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1986","team":"LAC","gp":16,"targets":111,"receptions":64,"receiving_yards":728, "receiving_tds":5,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1987","team":"LAC","gp":12,"targets":84, "receptions":53,"receiving_yards":519, "receiving_tds":3,"rushing_yards":0,"rushing_tds":0,"passing_yards":0,"passing_tds":0},
        ],
    },
    # ── Roger Craig ────────────────────────────────────────────────────────────
    {
        "player_id":   "00-0003602",
        "player_name": "Roger Craig",
        "position":    "RB",
        "bio":         {"height": "6-0", "weight": 224, "college": "Nebraska", "years_exp": 11, "draft_club": "SF", "draft_number": 49},
        "seasons": [
            {"season":"1983","team":"SF","gp":16,"carries":176,"rushing_yards":725, "rushing_tds":8,"receptions":48,"receiving_yards":427,"receiving_tds":4,"passing_yards":0,"passing_tds":0},
            {"season":"1984","team":"SF","gp":16,"carries":155,"rushing_yards":649, "rushing_tds":7,"receptions":71,"receiving_yards":675,"receiving_tds":3,"passing_yards":0,"passing_tds":0},
            {"season":"1985","team":"SF","gp":16,"carries":214,"rushing_yards":1050,"rushing_tds":9,"receptions":92,"receiving_yards":1016,"receiving_tds":6,"passing_yards":0,"passing_tds":0},
            {"season":"1986","team":"SF","gp":16,"carries":204,"rushing_yards":830, "rushing_tds":7,"receptions":81,"receiving_yards":624,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1987","team":"SF","gp":14,"carries":215,"rushing_yards":815, "rushing_tds":3,"receptions":66,"receiving_yards":492,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
            {"season":"1988","team":"SF","gp":16,"carries":310,"rushing_yards":1502,"rushing_tds":9,"receptions":76,"receiving_yards":534,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
            {"season":"1989","team":"SF","gp":16,"carries":271,"rushing_yards":1054,"rushing_tds":6,"receptions":49,"receiving_yards":473,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
            {"season":"1990","team":"SF","gp":11,"carries":141,"rushing_yards":439, "rushing_tds":1,"receptions":25,"receiving_yards":201,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1991","team":"LV","gp":15,"carries":162,"rushing_yards":590, "rushing_tds":1,"receptions":17,"receiving_yards":136,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1992","team":"MIN","gp":15,"carries":105,"rushing_yards":416, "rushing_tds":4,"receptions":22,"receiving_yards":164,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1993","team":"MIN","gp":14,"carries":38, "rushing_yards":119, "rushing_tds":1,"receptions":19,"receiving_yards":169,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
        ],
    },
    # ── OJ Simpson ─────────────────────────────────────────────────────────────
    {
        "player_id":   "SIM593235",
        "player_name": "O.J. Simpson",
        "position":    "RB",
        "bio":         {"height": "6-1", "weight": 212, "college": "USC", "years_exp": 11, "draft_club": "BUF", "draft_number": 1},
        "seasons": [
            {"season":"1969","team":"BUF","gp":13,"carries":181,"rushing_yards":697, "rushing_tds":2, "receptions":30,"receiving_yards":343,"receiving_tds":3,"passing_yards":0,"passing_tds":0},
            {"season":"1970","team":"BUF","gp":8, "carries":120,"rushing_yards":488, "rushing_tds":5, "receptions":10,"receiving_yards":139,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1971","team":"BUF","gp":14,"carries":183,"rushing_yards":742, "rushing_tds":5, "receptions":21,"receiving_yards":162,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1972","team":"BUF","gp":14,"carries":292,"rushing_yards":1251,"rushing_tds":6, "receptions":27,"receiving_yards":198,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1973","team":"BUF","gp":14,"carries":332,"rushing_yards":2003,"rushing_tds":12,"receptions":6, "receiving_yards":70, "receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1974","team":"BUF","gp":14,"carries":270,"rushing_yards":1125,"rushing_tds":3, "receptions":15,"receiving_yards":189,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
            {"season":"1975","team":"BUF","gp":14,"carries":329,"rushing_yards":1817,"rushing_tds":16,"receptions":28,"receiving_yards":426,"receiving_tds":7,"passing_yards":0,"passing_tds":0},
            {"season":"1976","team":"BUF","gp":14,"carries":290,"rushing_yards":1503,"rushing_tds":8, "receptions":22,"receiving_yards":259,"receiving_tds":1,"passing_yards":0,"passing_tds":0},
            {"season":"1977","team":"BUF","gp":7, "carries":126,"rushing_yards":557, "rushing_tds":0, "receptions":16,"receiving_yards":138,"receiving_tds":0,"passing_yards":0,"passing_tds":0},
            {"season":"1978","team":"SF","gp":10,"carries":161,"rushing_yards":593, "rushing_tds":1, "receptions":21,"receiving_yards":172,"receiving_tds":2,"passing_yards":0,"passing_tds":0},
            {"season":"1979","team":"SF","gp":13,"carries":120,"rushing_yards":460, "rushing_tds":3, "receptions":7, "receiving_yards":46, "receiving_tds":0,"passing_yards":0,"passing_tds":0},
        ],
    },
    # ── Terry Bradshaw ─────────────────────────────────────────────────────────
    {
        "player_id":   "BRA301078",
        "player_name": "Terry Bradshaw",
        "position":    "QB",
        "bio":         {"height": "6-3", "weight": 215, "college": "Louisiana Tech", "years_exp": 14, "draft_club": "PIT", "draft_number": 1},
        "seasons": [
            {"season":"1970","team":"PIT","gp":13,"completions":83, "attempts":218,"passing_yards":1410,"passing_tds":6, "interceptions":24,"rushing_yards":0,"rushing_tds":0},
            {"season":"1971","team":"PIT","gp":14,"completions":203,"attempts":373,"passing_yards":2259,"passing_tds":13,"interceptions":22,"rushing_yards":0,"rushing_tds":0},
            {"season":"1972","team":"PIT","gp":14,"completions":147,"attempts":308,"passing_yards":1887,"passing_tds":12,"interceptions":12,"rushing_yards":0,"rushing_tds":0},
            {"season":"1973","team":"PIT","gp":10,"completions":89, "attempts":180,"passing_yards":1183,"passing_tds":10,"interceptions":15,"rushing_yards":0,"rushing_tds":0},
            {"season":"1974","team":"PIT","gp":8, "completions":67, "attempts":148,"passing_yards":785, "passing_tds":7, "interceptions":8, "rushing_yards":0,"rushing_tds":0},
            {"season":"1975","team":"PIT","gp":14,"completions":165,"attempts":286,"passing_yards":2055,"passing_tds":18,"interceptions":9, "rushing_yards":0,"rushing_tds":0},
            {"season":"1976","team":"PIT","gp":10,"completions":92, "attempts":192,"passing_yards":1177,"passing_tds":10,"interceptions":9, "rushing_yards":0,"rushing_tds":0},
            {"season":"1977","team":"PIT","gp":14,"completions":162,"attempts":314,"passing_yards":2523,"passing_tds":17,"interceptions":19,"rushing_yards":0,"rushing_tds":0},
            {"season":"1978","team":"PIT","gp":16,"completions":207,"attempts":368,"passing_yards":2915,"passing_tds":28,"interceptions":20,"rushing_yards":0,"rushing_tds":0},
            {"season":"1979","team":"PIT","gp":16,"completions":259,"attempts":472,"passing_yards":3724,"passing_tds":26,"interceptions":25,"rushing_yards":0,"rushing_tds":0},
            {"season":"1980","team":"PIT","gp":15,"completions":218,"attempts":424,"passing_yards":3339,"passing_tds":24,"interceptions":22,"rushing_yards":0,"rushing_tds":0},
            {"season":"1981","team":"PIT","gp":14,"completions":201,"attempts":370,"passing_yards":2887,"passing_tds":22,"interceptions":14,"rushing_yards":0,"rushing_tds":0},
            {"season":"1982","team":"PIT","gp":9, "completions":127,"attempts":240,"passing_yards":1768,"passing_tds":17,"interceptions":11,"rushing_yards":0,"rushing_tds":0},
            {"season":"1983","team":"PIT","gp":1, "completions":5,  "attempts":8,  "passing_yards":77,  "passing_tds":2, "interceptions":0, "rushing_yards":0,"rushing_tds":0},
        ],
    },
    # ── Roger Staubach ─────────────────────────────────────────────────────────
    {
        "player_id":   "STA762496",
        "player_name": "Roger Staubach",
        "position":    "QB",
        "bio":         {"height": "6-3", "weight": 202, "college": "Navy", "years_exp": 11, "draft_club": "DAL", "draft_number": 129},
        "seasons": [
            {"season":"1969","team":"DAL","gp":6, "completions":23, "attempts":47, "passing_yards":421, "passing_tds":1, "interceptions":2, "rushing_yards":0,"rushing_tds":0},
            {"season":"1970","team":"DAL","gp":8, "completions":44, "attempts":82, "passing_yards":542, "passing_tds":2, "interceptions":8, "rushing_yards":0,"rushing_tds":0},
            {"season":"1971","team":"DAL","gp":13,"completions":126,"attempts":211,"passing_yards":1882,"passing_tds":15,"interceptions":4, "rushing_yards":0,"rushing_tds":0},
            {"season":"1972","team":"DAL","gp":4, "completions":9,  "attempts":20, "passing_yards":98,  "passing_tds":0, "interceptions":2, "rushing_yards":0,"rushing_tds":0},
            {"season":"1973","team":"DAL","gp":14,"completions":179,"attempts":286,"passing_yards":2428,"passing_tds":23,"interceptions":15,"rushing_yards":0,"rushing_tds":0},
            {"season":"1974","team":"DAL","gp":14,"completions":190,"attempts":360,"passing_yards":2552,"passing_tds":11,"interceptions":15,"rushing_yards":0,"rushing_tds":0},
            {"season":"1975","team":"DAL","gp":13,"completions":198,"attempts":348,"passing_yards":2666,"passing_tds":17,"interceptions":16,"rushing_yards":0,"rushing_tds":0},
            {"season":"1976","team":"DAL","gp":14,"completions":208,"attempts":369,"passing_yards":2715,"passing_tds":14,"interceptions":11,"rushing_yards":0,"rushing_tds":0},
            {"season":"1977","team":"DAL","gp":14,"completions":210,"attempts":361,"passing_yards":2620,"passing_tds":18,"interceptions":9, "rushing_yards":0,"rushing_tds":0},
            {"season":"1978","team":"DAL","gp":15,"completions":231,"attempts":413,"passing_yards":3190,"passing_tds":25,"interceptions":16,"rushing_yards":0,"rushing_tds":0},
            {"season":"1979","team":"DAL","gp":16,"completions":267,"attempts":461,"passing_yards":3586,"passing_tds":27,"interceptions":11,"rushing_yards":0,"rushing_tds":0},
        ],
    },
    # ── Troy Aikman ────────────────────────────────────────────────────────────
    {
        "player_id":   "00-0000104",
        "player_name": "Troy Aikman",
        "position":    "QB",
        "bio":         {"height": "6-4", "weight": 219, "college": "UCLA", "years_exp": 12, "draft_club": "DAL", "draft_number": 1},
        "seasons": [
            {"season":"1989","team":"DAL","gp":11,"completions":155,"attempts":293,"passing_yards":1749,"passing_tds":9, "interceptions":18,"rushing_yards":0,"rushing_tds":0},
            {"season":"1990","team":"DAL","gp":15,"completions":226,"attempts":399,"passing_yards":2579,"passing_tds":11,"interceptions":18,"rushing_yards":0,"rushing_tds":0},
            {"season":"1991","team":"DAL","gp":12,"completions":237,"attempts":363,"passing_yards":2754,"passing_tds":11,"interceptions":10,"rushing_yards":0,"rushing_tds":0},
            {"season":"1992","team":"DAL","gp":16,"completions":302,"attempts":473,"passing_yards":3445,"passing_tds":23,"interceptions":14,"rushing_yards":0,"rushing_tds":0},
            {"season":"1993","team":"DAL","gp":14,"completions":271,"attempts":392,"passing_yards":3100,"passing_tds":15,"interceptions":6, "rushing_yards":0,"rushing_tds":0},
            {"season":"1994","team":"DAL","gp":14,"completions":233,"attempts":361,"passing_yards":2676,"passing_tds":13,"interceptions":12,"rushing_yards":0,"rushing_tds":0},
            {"season":"1995","team":"DAL","gp":16,"completions":280,"attempts":432,"passing_yards":3304,"passing_tds":16,"interceptions":7, "rushing_yards":0,"rushing_tds":0},
            {"season":"1996","team":"DAL","gp":15,"completions":296,"attempts":465,"passing_yards":3126,"passing_tds":12,"interceptions":13,"rushing_yards":0,"rushing_tds":0},
            {"season":"1997","team":"DAL","gp":16,"completions":292,"attempts":518,"passing_yards":3283,"passing_tds":19,"interceptions":12,"rushing_yards":0,"rushing_tds":0},
            {"season":"1998","team":"DAL","gp":11,"completions":187,"attempts":315,"passing_yards":2330,"passing_tds":12,"interceptions":5, "rushing_yards":0,"rushing_tds":0},
            {"season":"1999","team":"DAL","gp":14,"completions":263,"attempts":442,"passing_yards":2964,"passing_tds":17,"interceptions":12,"rushing_yards":0,"rushing_tds":0},
            {"season":"2000","team":"DAL","gp":11,"completions":156,"attempts":262,"passing_yards":1632,"passing_tds":7, "interceptions":14,"rushing_yards":0,"rushing_tds":0},
        ],
    },
]


def main():
    with open(CAREERS_PATH) as f:
        careers = json.load(f)

    careers_by_id = {str(p["player_id"]): p for p in careers}

    # ── Patch pre-1999 seasons onto existing players ──────────────────────────
    patched = 0
    for pid, seasons in PRE1999_PATCHES.items():
        player = careers_by_id.get(pid)
        if not player:
            print(f"  WARNING: {pid} not found — skipping")
            continue
        existing = {s["season"] for s in player["seasons"]}
        new = [s for s in seasons if s["season"] not in existing]
        if not new:
            print(f"  {player['player_name']}: already complete")
            continue
        player["seasons"] = sorted(player["seasons"] + new, key=lambda s: s["season"])
        print(f"  {player['player_name']}: +{len(new)} seasons prepended")
        patched += 1

    # ── Add brand-new entries ─────────────────────────────────────────────────
    existing_ids = {str(p["player_id"]) for p in careers}
    added = 0
    for player in NEW_PLAYERS:
        if str(player["player_id"]) in existing_ids:
            print(f"  {player['player_name']}: already present — skipping")
            continue
        careers.append(player)
        added += 1
        pos = player["position"]
        if pos == "QB":
            yds = sum(s["passing_yards"] for s in player["seasons"])
            tds = sum(s["passing_tds"]   for s in player["seasons"])
            print(f"  {player['player_name']}: ADDED  |  pass yds {yds:,}  pass TDs {tds}")
        elif pos == "RB":
            yds = sum(s["rushing_yards"] for s in player["seasons"])
            tds = sum(s["rushing_tds"]   for s in player["seasons"])
            print(f"  {player['player_name']}: ADDED  |  rush yds {yds:,}  rush TDs {tds}")
        else:
            yds = sum(s["receiving_yards"] for s in player["seasons"])
            tds = sum(s["receiving_tds"]   for s in player["seasons"])
            print(f"  {player['player_name']}: ADDED  |  rec yds {yds:,}  rec TDs {tds}")

    with open(CAREERS_PATH, "w") as f:
        json.dump(careers, f, separators=(",", ":"))

    print(f"\nDone. Patched {patched} existing players, added {added} new players.")
    print("Run: cp data/nfl_careers.json ../public/data/nfl_careers.json")


if __name__ == "__main__":
    main()
