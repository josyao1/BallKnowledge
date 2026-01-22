import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import { useSettingsStore } from '../stores/settingsStore';
import { TeamSelector } from '../components/home/TeamSelector';
import { YearSelector } from '../components/home/YearSelector';
import { SettingsModal } from '../components/home/SettingsModal';
import { teams } from '../data/teams';
import { getTeamRoster } from '../services/roster';
import type { Team, GameMode } from '../types';

export function HomePage() {
  const navigate = useNavigate();
  const setGameConfig = useGameStore((state) => state.setGameConfig);
  const { timerDuration, yearRange } = useSettingsStore();

  const [gameMode, setGameMode] = useState<GameMode>('random');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleStartGame = async () => {
    setIsLoading(true);

    let team: Team;
    let year: number;

    if (gameMode === 'random') {
      // Random selection
      const randomTeamIndex = Math.floor(Math.random() * teams.length);
      team = teams[randomTeamIndex];
      year = Math.floor(Math.random() * (yearRange.max - yearRange.min + 1)) + yearRange.min;
    } else {
      if (!selectedTeam || !selectedYear) {
        setIsLoading(false);
        return;
      }
      team = selectedTeam;
      year = selectedYear;
    }

    const season = `${year}-${String(year + 1).slice(-2)}`;
    const roster = getTeamRoster(team.abbreviation, season);

    if (roster.length === 0) {
      alert(`No roster data available for ${team.name} in ${season}`);
      setIsLoading(false);
      return;
    }

    setGameConfig(team, season, gameMode, timerDuration, roster);
    setIsLoading(false);
    navigate('/game');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="p-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold">Ball Knowledge</h1>
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
        <div className="text-center mb-8">
          <h2 className="text-5xl font-bold mb-4">NBA Roster Trivia</h2>
          <p className="text-gray-400 text-lg">How well do you know NBA rosters?</p>
        </div>

        {/* Game mode selection */}
        <div className="flex gap-4">
          <button
            onClick={() => setGameMode('random')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              gameMode === 'random'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Random
          </button>
          <button
            onClick={() => setGameMode('manual')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              gameMode === 'manual'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Choose Team
          </button>
        </div>

        {/* Manual selection */}
        {gameMode === 'manual' && (
          <div className="w-full max-w-md space-y-4">
            <TeamSelector
              selectedTeam={selectedTeam}
              onSelect={setSelectedTeam}
            />
            <YearSelector
              selectedYear={selectedYear}
              onSelect={setSelectedYear}
              minYear={yearRange.min}
              maxYear={yearRange.max}
            />
          </div>
        )}

        {/* Start button */}
        <button
          onClick={handleStartGame}
          disabled={isLoading || (gameMode === 'manual' && (!selectedTeam || !selectedYear))}
          className="px-12 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl text-xl font-bold transition-all transform hover:scale-105 disabled:hover:scale-100"
        >
          {isLoading ? 'Loading...' : 'Start Game'}
        </button>

        {/* Info */}
        <div className="text-center text-gray-500 text-sm max-w-md">
          <p>Name as many players as you can from the selected team's roster.</p>
          <p className="mt-2">Timer: {Math.floor(timerDuration / 60)}:{String(timerDuration % 60).padStart(2, '0')}</p>
        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
