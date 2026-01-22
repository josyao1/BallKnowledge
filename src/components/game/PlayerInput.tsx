import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import Fuse from 'fuse.js';
import { useGameStore } from '../../stores/gameStore';
import { getAllPlayersForAutocomplete } from '../../services/roster';

export function PlayerInput() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<List>(null);

  const makeGuess = useGameStore((state) => state.makeGuess);
  const guessedPlayers = useGameStore((state) => state.guessedPlayers);
  const incorrectGuesses = useGameStore((state) => state.incorrectGuesses);

  // Get all players for autocomplete
  const allPlayers = useMemo(() => getAllPlayersForAutocomplete(), []);

  // Set of already guessed names (normalized)
  const guessedNames = useMemo(() => {
    const names = new Set<string>();
    guessedPlayers.forEach((p) => names.add(p.name.toLowerCase()));
    incorrectGuesses.forEach((g) => names.add(g.toLowerCase()));
    return names;
  }, [guessedPlayers, incorrectGuesses]);

  // Initialize Fuse.js for fuzzy search
  const fuse = useMemo(
    () =>
      new Fuse(allPlayers, {
        keys: ['name'],
        threshold: 0.3,
        ignoreLocation: true,
      }),
    [allPlayers]
  );

  // Filter results
  const filteredPlayers = useMemo(() => {
    if (!query || query.length < 2) return [];

    return fuse
      .search(query)
      .slice(0, 50)
      .map((result) => result.item)
      .filter((player) => !guessedNames.has(player.name.toLowerCase()));
  }, [query, fuse, guessedNames]);

  // Reset selected index when filtered players change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredPlayers]);

  // Handle selection
  const handleSelect = useCallback(
    (playerName: string) => {
      makeGuess(playerName);
      setQuery('');
      setIsOpen(false);
      inputRef.current?.focus();
    },
    [makeGuess]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || filteredPlayers.length === 0) {
        if (e.key === 'Enter' && query.trim()) {
          handleSelect(query.trim());
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredPlayers.length - 1 ? prev + 1 : prev
          );
          listRef.current?.scrollToItem(selectedIndex + 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          listRef.current?.scrollToItem(selectedIndex - 1);
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredPlayers[selectedIndex]) {
            handleSelect(filteredPlayers[selectedIndex].name);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          break;
      }
    },
    [isOpen, filteredPlayers, selectedIndex, query, handleSelect]
  );

  // Row renderer for virtualized list
  const Row = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const player = filteredPlayers[index];
      const isSelected = index === selectedIndex;

      return (
        <div
          style={style}
          className={`px-4 py-2 cursor-pointer transition-colors ${
            isSelected ? 'bg-[var(--nba-orange)] text-white' : 'hover:bg-[#2a2a2a] text-[var(--vintage-cream)]'
          }`}
          onClick={() => handleSelect(player.name)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          {player.name}
        </div>
      );
    },
    [filteredPlayers, selectedIndex, handleSelect]
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
        placeholder="Type a player name..."
        autoComplete="off"
        className="retro-input w-full p-4 text-lg"
      />

      {/* Dropdown */}
      {isOpen && filteredPlayers.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 vintage-card overflow-hidden z-50">
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
      <div className="mt-2 text-xs text-[#666] text-center sports-font tracking-wider">
        Press Enter to submit or use arrow keys to navigate
      </div>
    </div>
  );
}
