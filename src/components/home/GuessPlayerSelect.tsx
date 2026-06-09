import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLobbyStore } from '../../stores/lobbyStore';
import { getStoredPlayerName, updateCareerState } from '../../services/lobby';

type GameId = 'career' | 'scramble' | 'face-reveal';

interface Props {
  sport: 'nba' | 'nfl';
  mode: 'solo' | 'lobby';
  onBack: () => void;
  onSelectGame: (id: GameId) => void;
}

const MODES: { id: GameId; label: string; abbr: string; desc: string; color: string }[] = [
  { id: 'career',      label: 'Career Arc',    abbr: 'CA', desc: "Trace a player's career year by year",    color: '#22c55e' },
  { id: 'scramble',    label: 'Name Scramble', abbr: 'NS', desc: 'Unscramble athlete names vs the clock',   color: '#3b82f6' },
  { id: 'face-reveal', label: 'Face Reveal',   abbr: 'FR', desc: 'Identify a player from their headshot',   color: '#06b6d4' },
];

export function GuessPlayerSelect({ sport, mode, onBack, onSelectGame }: Props) {
  const navigate = useNavigate();
  const { createLobby } = useLobbyStore();
  const [isCreating, setIsCreating] = useState(false);

  async function handleLobbyMode(id: GameId) {
    const hostName = getStoredPlayerName();
    if (!hostName) {
      navigate('/lobby/create', { state: { gameType: id } });
      return;
    }
    setIsCreating(true);
    try {
      const dummyAbbr   = sport === 'nba' ? 'LAL' : 'NE';
      const dummySeason = sport === 'nba' ? '2023-24' : '2023';
      if (id === 'career') {
        const lobby = await createLobby(hostName, sport, dummyAbbr, dummySeason, 90, 'random', 2000, 2025, 'career', 'team', null, null);
        if (lobby) { await updateCareerState(lobby.id, { win_target: 10, round: 0 }); navigate(`/lobby/${lobby.join_code}`); }
      } else if (id === 'scramble') {
        const lobby = await createLobby(hostName, sport, dummyAbbr, dummySeason, 90, 'random', 2000, 2025, 'scramble', 'team', null, null);
        if (lobby) { await updateCareerState(lobby.id, { win_target: 20, round: 0, career_to: 0 }); navigate(`/lobby/${lobby.join_code}`); }
      } else {
        const lobby = await createLobby(hostName, sport, dummyAbbr, dummySeason, 90, 'random', 2000, 2025, 'face-reveal', 'team', null, null);
        if (lobby) { await updateCareerState(lobby.id, { win_target: 20, career_to: 0, timer: 60, min_yards: 0, defense_mode: 'known', round: 0 }); navigate(`/lobby/${lobby.join_code}`); }
      }
    } finally {
      setIsCreating(false);
    }
  }

  function handleClick(id: GameId) {
    if (mode === 'lobby') handleLobbyMode(id);
    else onSelectGame(id);
  }

  return (
    <div className="capcrunch-panel w-full max-w-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 flex items-center">
        <button onClick={onBack} className="capcrunch-kicker text-[10px] text-white/40 hover:text-white/70 transition-colors">
          ← Back
        </button>
        <div className="flex-1 text-center">
          <div className="capcrunch-kicker text-[9px] text-[#E2008A]/60 mb-0.5">GP</div>
          <h2 className="capcrunch-title text-2xl text-white leading-tight">Guess the Player</h2>
          <p className="capcrunch-kicker text-[9px] text-white/40">{sport === 'nba' ? 'NBA' : 'NFL'} Edition</p>
        </div>
        <div className="w-16" />
      </div>

      <div className="border-t border-white/10" />

      {/* Game selector cards */}
      <div className="p-4 flex flex-col gap-2">
        <p className="capcrunch-kicker text-[9px] text-white/30 text-center mb-1">
          {mode === 'lobby' ? 'Open a lobby for...' : 'Choose a mode'}
        </p>
        {MODES.map(m => (
          <button
            key={m.id}
            onClick={() => handleClick(m.id)}
            disabled={isCreating}
            className="flex items-center gap-3 px-4 py-3 border border-white/10 bg-black/30 hover:bg-white/5 transition-all group disabled:opacity-50"
            style={{ borderLeftWidth: '3px', borderLeftColor: m.color }}
          >
            <span className="capcrunch-title text-sm w-7 shrink-0" style={{ color: m.color }}>
              {m.abbr}
            </span>
            <div className="text-left flex-1 min-w-0">
              <div className="capcrunch-title text-sm leading-tight" style={{ color: m.color }}>{m.label}</div>
              <div className="capcrunch-kicker text-[9px] text-white/35 mt-0.5">{m.desc}</div>
            </div>
            <span className="capcrunch-kicker text-white/25 group-hover:text-white/60 transition-colors text-sm">
              {isCreating ? '…' : '→'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
