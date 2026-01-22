import { useState } from 'react';
import { teams } from '../../data/teams';
import type { Team } from '../../types';

interface TeamSelectorProps {
  selectedTeam: Team | null;
  onSelect: (team: Team) => void;
}

export function TeamSelector({ selectedTeam, onSelect }: TeamSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const conferences = {
    Eastern: teams.filter((t) => t.conference === 'Eastern'),
    Western: teams.filter((t) => t.conference === 'Western'),
  };

  return (
    <div className="relative">
      <label className="block text-sm text-gray-400 mb-1">Select Team</label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 bg-gray-800 rounded-lg text-left flex items-center justify-between border border-gray-700 hover:border-gray-600 transition-colors"
      >
        {selectedTeam ? (
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold"
              style={{
                backgroundColor: selectedTeam.colors.primary,
                color: selectedTeam.colors.secondary,
              }}
            >
              {selectedTeam.abbreviation}
            </div>
            <span>{selectedTeam.name}</span>
          </div>
        ) : (
          <span className="text-gray-500">Choose a team...</span>
        )}
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg border border-gray-700 shadow-xl z-50 max-h-80 overflow-y-auto">
          {(['Eastern', 'Western'] as const).map((conference) => (
            <div key={conference}>
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-900/50 sticky top-0">
                {conference} Conference
              </div>
              {conferences[conference].map((team) => (
                <button
                  key={team.id}
                  onClick={() => {
                    onSelect(team);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-700 transition-colors ${
                    selectedTeam?.id === team.id ? 'bg-indigo-600/20' : ''
                  }`}
                >
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
                    style={{
                      backgroundColor: team.colors.primary,
                      color: team.colors.secondary,
                    }}
                  >
                    {team.abbreviation.slice(0, 2)}
                  </div>
                  <span className="text-sm">{team.name}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
