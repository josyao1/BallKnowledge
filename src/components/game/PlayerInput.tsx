import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import Fuse from 'fuse.js';
import { useGameStore } from '../../stores/gameStore';
import { getAllPlayersForAutocomplete } from '../../services/roster';

// Normalize name for searching - removes periods, apostrophes, etc.
function normalizeForSearch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.']/g, '') // Remove periods and apostrophes (T.J. -> TJ, O'Neal -> ONeal)
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

interface PlayerInputProps {
  teammateGuessedNames?: string[];
}

export function PlayerInput({ teammateGuessedNames = [] }: PlayerInputProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1); // -1 means no selection
  const [hasNavigated, setHasNavigated] = useState(false); // Track if user used arrow keys
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<List>(null);

  const makeGuess = useGameStore((state) => state.makeGuess);
  const guessedPlayers = useGameStore((state) => state.guessedPlayers);
  const incorrectGuesses = useGameStore((state) => state.incorrectGuesses);
  const leaguePlayers = useGameStore((state) => state.leaguePlayers);
  const currentRoster = useGameStore((state) => state.currentRoster);

  // Get all players for autocomplete
  // Priority: league-wide players > static data, but ALWAYS include current roster
  const allPlayers = useMemo(() => {
    const playerMap = new Map<string, { id: number | string; name: string; searchName: string }>();

    // Always add current roster players FIRST (ensures they're always in autocomplete)
    if (currentRoster.length > 0) {
      console.log('Adding roster players to autocomplete:', currentRoster.map(p => p.name));
      currentRoster.forEach(p => {
        playerMap.set(p.name.toLowerCase(), {
          id: p.id,
          name: p.name,
          searchName: normalizeForSearch(p.name) // "T.J. Watt" -> "tj watt"
        });
      });
    } else {
      console.warn('currentRoster is empty!');
    }

    // Then add league players if available, otherwise add static data
    const additionalPlayers = leaguePlayers.length > 0
      ? leaguePlayers
      : getAllPlayersForAutocomplete();

    additionalPlayers.forEach(p => {
      if (!playerMap.has(p.name.toLowerCase())) {
        playerMap.set(p.name.toLowerCase(), {
          id: p.id,
          name: p.name,
          searchName: normalizeForSearch(p.name)
        });
      }
    });

    console.log(`Autocomplete pool: ${playerMap.size} players (${currentRoster.length} from roster, ${leaguePlayers.length} from API)`);

    return Array.from(playerMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [leaguePlayers, currentRoster]);

  // Set of already guessed names (normalized) - includes teammate guesses
  const guessedNames = useMemo(() => {
    const names = new Set<string>();
    guessedPlayers.forEach((p) => names.add(p.name.toLowerCase()));
    incorrectGuesses.forEach((g) => names.add(g.toLowerCase()));
    teammateGuessedNames.forEach((name) => names.add(name.toLowerCase()));
    return names;
  }, [guessedPlayers, incorrectGuesses, teammateGuessedNames]);

  // Initialize Fuse.js for fuzzy search
  // Threshold 0.4 allows for typos while still being reasonably strict
  // Search on both 'name' (original) and 'searchName' (normalized without periods)
  const fuse = useMemo(
    () =>
      new Fuse(allPlayers, {
        keys: ['name', 'searchName'],
        threshold: 0.4,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    [allPlayers]
  );

  // Filter results - require at least 3 characters to avoid giving away answers
  const filteredPlayers = useMemo(() => {
    if (!query || query.length < 3) return [];

    // Normalize the query to match against searchName (e.g., "TJ" matches "tj" from "T.J.")
    const normalizedQuery = normalizeForSearch(query);

    // Search with both original and normalized query for best results
    const results = fuse.search(normalizedQuery);

    return results
      .slice(0, 50)
      .map((result) => result.item)
      .filter((player) => !guessedNames.has(player.name.toLowerCase()));
  }, [query, fuse, guessedNames]);

  // Reset selection state when filtered players change
  useEffect(() => {
    setSelectedIndex(-1);
    setHasNavigated(false);
  }, [filteredPlayers]);

  // Handle selection
  const handleSelect = useCallback(
    (playerName: string) => {
      makeGuess(playerName, teammateGuessedNames.length > 0 ? teammateGuessedNames : undefined);
      setQuery('');
      setIsOpen(false);
      inputRef.current?.focus();
    },
    [makeGuess, teammateGuessedNames]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // If no autocomplete options, just submit the query
      if (!isOpen || filteredPlayers.length === 0) {
        if (e.key === 'Enter' && query.trim()) {
          e.preventDefault();
          handleSelect(query.trim());
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHasNavigated(true);
          setSelectedIndex((prev) => {
            const next = prev < filteredPlayers.length - 1 ? prev + 1 : prev;
            listRef.current?.scrollToItem(next);
            return next;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHasNavigated(true);
          setSelectedIndex((prev) => {
            const next = prev > 0 ? prev - 1 : 0;
            listRef.current?.scrollToItem(next);
            return next;
          });
          break;
        case 'Enter':
          e.preventDefault();
          // Only use autocomplete selection if user navigated with arrow keys
          if (hasNavigated && selectedIndex >= 0 && filteredPlayers[selectedIndex]) {
            handleSelect(filteredPlayers[selectedIndex].name);
          } else {
            // Submit what the user typed
            handleSelect(query.trim());
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setHasNavigated(false);
          setSelectedIndex(-1);
          break;
      }
    },
    [isOpen, filteredPlayers, selectedIndex, query, handleSelect, hasNavigated]
  );

  // Row renderer for virtualized list
  const Row = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const player = filteredPlayers[index];
      const isSelected = hasNavigated && index === selectedIndex;

      return (
        <div
          style={style}
          className={`px-4 py-2 cursor-pointer transition-colors sports-font text-sm ${
            isSelected ? 'bg-gradient-to-r from-[#d4af37] to-[#c4a030] text-black font-bold' : 'hover:bg-white/10 text-white/80'
          }`}
          onClick={() => handleSelect(player.name)}
          onMouseEnter={() => {
            setSelectedIndex(index);
            setHasNavigated(true);
          }}
        >
          {player.name}
        </div>
      );
    },
    [filteredPlayers, selectedIndex, handleSelect, hasNavigated]
  );

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          // Delay closing to allow click on dropdown
          setTimeout(() => setIsOpen(false), 200);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Enter player name..."
        autoComplete="off"
        className="w-full p-4 text-lg bg-[#111] border-2 border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-[#d4af37] transition-colors rounded-sm sports-font"
      />

      {/* Dropdown */}
      {isOpen && filteredPlayers.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#111] border border-white/20 overflow-hidden z-50 shadow-xl">
          <List
            ref={listRef}
            height={Math.min(filteredPlayers.length * 40, 200)}
            itemCount={filteredPlayers.length}
            itemSize={40}
            width="100%"
          >
            {Row}
          </List>
        </div>
      )}

      {/* Hint */}
      <div className="mt-2 text-[10px] text-white/30 text-center sports-font tracking-[0.3em] uppercase">
        Enter to submit • Arrows to navigate
      </div>
    </div>
  );
}
