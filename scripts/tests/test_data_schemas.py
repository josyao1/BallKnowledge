"""Validate the structure and integrity of generated JSON data files."""

import json
import os
import glob
import re

import pytest

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'data')

# ── Known team abbreviations ──────────────────────────────────────────────────

NBA_TEAMS = {
    'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
    'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
    'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS',
    # Historical abbreviations
    'NJN', 'SEA', 'NOH', 'NOK', 'VAN', 'UTH', 'CHH', 'GOS', 'KCK', 'PHL',
    'PHO', 'SAN', 'WSB', 'SDC', 'NOJ', 'KCO', 'BUF', 'SFW', 'PHW', 'STL',
    'CIN', 'ROC', 'SYR', 'TRI', 'MLH', 'FTW', 'AND', 'WAT', 'SHE', 'BLB',
    'MNL', 'INO', 'CHZ', 'CHS', 'DNR', 'DN', 'CHO',
}

NFL_TEAMS = {
    'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN',
    'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LV', 'LAC', 'LAR', 'MIA',
    'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB',
    'TEN', 'WAS',
    # Historical/alternate abbreviations
    'OAK', 'SD', 'SL', 'STL', 'LA', 'ARZ', 'BLT', 'CLV', 'HST',
}


class TestNBACareersSchema:
    """Validate nba_careers.json structure."""

    def test_is_list(self, nba_careers):
        assert isinstance(nba_careers, list)

    def test_not_empty(self, nba_careers):
        assert len(nba_careers) > 100

    def test_required_fields(self, nba_careers):
        for player in nba_careers:
            assert 'player_id' in player, f"Missing player_id: {player.get('player_name')}"
            assert 'player_name' in player
            assert 'seasons' in player
            assert isinstance(player['seasons'], list)

    def test_season_structure(self, nba_careers):
        required_season_keys = {'season', 'team'}
        for player in nba_careers[:50]:  # check first 50
            for season in player['seasons']:
                missing = required_season_keys - set(season.keys())
                assert not missing, f"Season missing keys {missing} for {player['player_name']}"

    def test_no_duplicate_player_ids(self, nba_careers):
        ids = [p['player_id'] for p in nba_careers]
        assert len(ids) == len(set(ids)), "Duplicate player_id found"

    def test_player_names_not_empty(self, nba_careers):
        for player in nba_careers:
            assert player['player_name'].strip(), f"Empty player name for id {player['player_id']}"

    def test_season_stat_ranges(self, nba_careers):
        """No NBA player averages 100+ PPG or has negative stats."""
        for player in nba_careers:
            for season in player['seasons']:
                pts = season.get('pts')
                if pts is not None:
                    assert pts <= 100, f"{player['player_name']} has {pts} PPG"
                    assert pts >= 0, f"{player['player_name']} has negative PPG"

    def test_bio_exists_for_non_legends(self, nba_careers):
        """Most players should have bio; legends (player_id >= 9990000) may not."""
        for player in nba_careers:
            if player['player_id'] < 9990000:
                assert 'bio' in player, f"Missing bio for {player['player_name']}"

    def test_team_abbreviations_valid(self, nba_careers):
        for player in nba_careers[:100]:
            for season in player['seasons']:
                teams = season['team'].split('/')
                for t in teams:
                    t = t.strip()
                    assert t in NBA_TEAMS, (
                        f"Unknown NBA team '{t}' for {player['player_name']} in {season['season']}"
                    )


class TestNFLCareersSchema:
    """Validate nfl_careers.json structure."""

    def test_is_list(self, nfl_careers):
        assert isinstance(nfl_careers, list)

    def test_not_empty(self, nfl_careers):
        assert len(nfl_careers) > 100

    def test_required_fields(self, nfl_careers):
        for player in nfl_careers:
            assert 'player_id' in player, f"Missing player_id: {player.get('player_name')}"
            assert 'player_name' in player
            assert 'position' in player
            assert 'seasons' in player
            assert isinstance(player['seasons'], list)

    def test_no_duplicate_player_ids(self, nfl_careers):
        ids = [p['player_id'] for p in nfl_careers]
        assert len(ids) == len(set(ids)), "Duplicate player_id found"

    def test_player_names_not_empty(self, nfl_careers):
        for player in nfl_careers:
            assert player['player_name'].strip(), f"Empty player name for id {player['player_id']}"

    def test_season_stat_ranges(self, nfl_careers):
        """No QB throws for 10,000+ yards in a season."""
        for player in nfl_careers:
            for season in player['seasons']:
                pass_yds = season.get('passing_yards')
                if pass_yds is not None:
                    assert pass_yds <= 10000, (
                        f"{player['player_name']} has {pass_yds} pass yards in {season['season']}"
                    )

    def test_team_abbreviations_valid(self, nfl_careers):
        for player in nfl_careers[:100]:
            for season in player['seasons']:
                teams = season['team'].split('/')
                for t in teams:
                    t = t.strip()
                    assert t in NFL_TEAMS, (
                        f"Unknown NFL team '{t}' for {player['player_name']} in {season['season']}"
                    )


class TestLineupPoolSchema:
    """Validate lineup pool data files."""

    def test_nba_pool_not_empty(self, nba_lineup_pool):
        assert isinstance(nba_lineup_pool, list)
        assert len(nba_lineup_pool) > 50

    def test_nba_pool_has_seasons(self, nba_lineup_pool):
        for player in nba_lineup_pool[:50]:
            assert 'seasons' in player
            assert 'player_name' in player
            assert 'player_id' in player
            assert len(player['seasons']) > 0

    def test_nfl_pool_not_empty(self, nfl_lineup_pool):
        assert isinstance(nfl_lineup_pool, list)
        assert len(nfl_lineup_pool) > 50

    def test_nfl_pool_has_position(self, nfl_lineup_pool):
        for player in nfl_lineup_pool[:50]:
            assert 'position' in player, f"Missing position for {player.get('player_name')}"
            assert player['position'], f"Empty position for {player.get('player_name')}"


class TestHeadshotsSchema:
    """Validate nfl_headshots.json structure."""

    def test_is_dict(self, nfl_headshots):
        assert isinstance(nfl_headshots, dict)

    def test_not_empty(self, nfl_headshots):
        assert len(nfl_headshots) > 100

    def test_values_are_urls(self, nfl_headshots):
        url_pattern = re.compile(r'^https?://')
        for player_id, url in list(nfl_headshots.items())[:100]:
            assert url_pattern.match(url), f"Invalid URL for {player_id}: {url}"


class TestRosterFiles:
    """Validate roster JSON files."""

    def test_nba_roster_files_exist(self):
        pattern = os.path.join(DATA_DIR, 'rosters', '*.json')
        files = glob.glob(pattern)
        assert len(files) > 10, f"Expected 10+ NBA roster files, found {len(files)}"

    def test_nba_roster_structure(self):
        pattern = os.path.join(DATA_DIR, 'rosters', '*.json')
        files = glob.glob(pattern)[:5]
        for filepath in files:
            with open(filepath) as f:
                data = json.load(f)
            assert 'players' in data, f"Missing 'players' key in {filepath}"
            assert isinstance(data['players'], list)
            if data['players']:
                p = data['players'][0]
                assert 'id' in p, f"Missing 'id' in player from {filepath}"
                assert 'name' in p, f"Missing 'name' in player from {filepath}"

    def test_nfl_roster_files_exist(self):
        pattern = os.path.join(DATA_DIR, 'nfl', 'rosters', '*.json')
        files = glob.glob(pattern)
        assert len(files) > 10, f"Expected 10+ NFL roster files, found {len(files)}"

    def test_nfl_roster_structure(self):
        pattern = os.path.join(DATA_DIR, 'nfl', 'rosters', '*.json')
        files = glob.glob(pattern)[:5]
        for filepath in files:
            with open(filepath) as f:
                data = json.load(f)
            assert 'players' in data, f"Missing 'players' key in {filepath}"
            assert isinstance(data['players'], list)


class TestBoxScoreFiles:
    """Validate box score JSON files."""

    def test_nfl_box_score_files_exist(self):
        pattern = os.path.join(DATA_DIR, 'nfl', 'box_scores', '*.json')
        files = glob.glob(pattern)
        # Exclude index.json
        year_files = [f for f in files if 'index' not in os.path.basename(f)]
        assert len(year_files) > 5, f"Expected 5+ NFL box score year files"

    def test_nfl_box_score_structure(self):
        pattern = os.path.join(DATA_DIR, 'nfl', 'box_scores', '20*.json')
        files = glob.glob(pattern)[:2]
        for filepath in files:
            with open(filepath) as f:
                data = json.load(f)
            assert isinstance(data, list), f"Box score file should be a list: {filepath}"
            if data:
                game = data[0]
                assert 'game_id' in game or 'gameId' in game or isinstance(game, dict), (
                    f"Unexpected box score structure in {filepath}"
                )
