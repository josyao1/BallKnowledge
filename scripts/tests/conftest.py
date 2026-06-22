"""Shared fixtures for data validation tests."""

import json
import os
import pytest

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'data')


@pytest.fixture(scope="session")
def nba_careers():
    path = os.path.join(DATA_DIR, 'nba_careers.json')
    with open(path) as f:
        return json.load(f)


@pytest.fixture(scope="session")
def nfl_careers():
    path = os.path.join(DATA_DIR, 'nfl_careers.json')
    with open(path) as f:
        return json.load(f)


@pytest.fixture(scope="session")
def nba_lineup_pool():
    path = os.path.join(DATA_DIR, 'nba_lineup_pool.json')
    with open(path) as f:
        return json.load(f)


@pytest.fixture(scope="session")
def nfl_lineup_pool():
    path = os.path.join(DATA_DIR, 'nfl_lineup_pool.json')
    with open(path) as f:
        return json.load(f)


@pytest.fixture(scope="session")
def nfl_headshots():
    path = os.path.join(DATA_DIR, 'nfl_headshots.json')
    with open(path) as f:
        return json.load(f)
