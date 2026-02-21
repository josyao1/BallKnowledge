## Lineup Is Right - Implementation Summary

### Overview
"Lineup Is Right" is a new multiplayer game mode where players build lineups by strategically selecting player-seasons to accumulate a stat total as close as possible to a randomly generated target cap without exceeding it.

### Game Flow

1. **Match Start**: Host selects sport (NBA or NFL)
2. **Game Setup**: System randomly selects a stat category and generates a target cap
3. **Lineup Building**: Players take turns selecting players from randomly assigned teams
4. **Turn Order**: Each player fills lineup slots with player-seasons from their assigned team
5. **Win Condition**: Highest total at or below the cap wins; exceeding the cap = bust

### Implemented Files

#### Type Definitions
- **`src/types/lineupIsRight.ts`**
  - `LineupPosition`: NBA (PG, SG, SF, PF, C) and NFL (QB, RB, WR, TE, DEF) positions
  - `PlayerSeason`: Individual player-season with stats
  - `LineupSlot`: Position with selected player
  - `PlayerLineup`: Per-player lineup with slots and totals
  - `LineupIsRightGameState`: Full game state with all players
  - `StatCategory`: Supported stats (pts, ast, reb, min for NBA; passing/rushing/receiving for NFL)
  - `TurnRecord`: History of completed turns

#### Services
- **`src/services/lineupIsRight.ts`**
  - `selectRandomStatCategory()`: Picks random stat based on sport
  - `generateTargetCap()`: Creates reasonable target based on sport and stat
  - `getEligiblePlayersForTeamAndPosition()`: Loads player-seasons from a team
  - `assignRandomTeam()`: Picks random team for turn
  - `updateLineupSlot()`: Adds player to lineup
  - `calculateLineupStat()`: Sums stat and checks for bust
  - `advanceToNextTurn()`: Rotates to next active player
  - `positionMatches()`: NFL position validation

#### State Management
- **`src/stores/lineupIsRightStore.ts`**
  - Zustand store managing game state
  - Actions: `initializeGame`, `selectPlayer`, `passTurn`, `bust`, `skipPosition`
  - Getters: `getCurrentSlot`, `getActivePlayer`, `getLineupProgress`, `getStandingsSnapshot`

#### Pages
- **`src/pages/MultiplayerLineupIsRightPage.tsx`**
  - Main gameplay interface
  - Shows current player's turn and available selections
  - Displays standings and lineup progress
  - Modal for round results
  - Features local player selection  UI
  
- **`src/pages/MultiplayerLineupIsRightResultsPage.tsx`**
  - Match results and final standings
  - Shows champion and ranking
  - Game metadata

#### Routing
- **`src/App.tsx`** (updated)
  - Added routes:
    - `/lobby/:code/lineup-is-right` - Main game page
    - `/lobby/:code/lineup-is-right/results` - Results page

#### Lobby Integration
- **`src/pages/LobbyWaitingPage.tsx`** (updated)
  - Added "Lineup" game type option (4th option with pink button color)
  - Settings panel for Lineup Is Right:
    - Sport selection (NBA/NFL)
    - Win target (2-7 wins)
  - Game info displays Lineup Is Right mode
  - Start button that initializes game with selected settings
  - Navigation routing for mode

### Game Mechanics

#### Stat Categories

**NBA**
- Points (pts)
- Assists (ast)  
- Rebounds (reb)
- Minutes (min)

**NFL**
- Passing Yards, Passing TDs
- Rushing Yards, Rushing TDs
- Receiving Yards, Receiving TDs

#### Position Templates

**NBA**: 5 slots (PG, SG, SF, PF, C)
**NFL**: 6 slots (QB, RB, RB, WR, WR, TE)

#### Target Caps (Approximate Full-Lineup Totals)

**NBA**
- Points: 480 (96 PPG × 5)
- Assists: 120 (24 APG × 5)
- Rebounds: 100 (20 RPG × 5)
- Minutes: 1200 (240 per player × 5)

**NFL**
- Passing Yards: 1200
- Passing TDs: 9
- Rushing Yards: 300
- Rushing TDs: 3
- Receiving Yards: 320
- Receiving TDs: 4

#### Turn Flow

1. System assigns random team to active player
2. Player selects from eligible players of assigned team for current slot
3. Selection added to lineup, total updated
4. If busted (> cap) or all slots filled, player finishes
5. Move to next player
6. Repeat until all players finished or busted
7. Non-busted players ranked by total (highest wins)

### Features

✅ Turn-based gameplay
✅ Random team assignment
✅ Smart player filtering (position-based for NFL, all for NBA)
✅ Live standings display
✅ Bust detection
✅ Round results overlay
✅ Final standings with champion highlight
✅ Sport selection (NBA/NFL)
✅ Configurable win target
✅ Player-season specificity (e.g., "2013-14 Kevin Durant")

### Integration Points

1. **Lobby System**: Uses existing lobby infrastructure for multiplayer management
2. **Career State**: Stores game config in existing `career_state` JSON column
3. **Routing**: Integrated with existing router hierarchy
4. **UI Theme**: Follows existing retro sports styling

### Future Enhancements

- Round-based play (multiple rounds to first win target)
- Ban list (prevent same player-season in consecutive slots)
- Player feedback notifications
- Undo functionality for recent picks
- Season year filters
- Leaderboard integration
