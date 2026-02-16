/**
 * TeamSelector.tsx — Dropdown picker for NBA/NFL teams grouped by conference.
 *
 * Renders a styled select button that expands to show teams organized by
 * conference (Eastern/Western for NBA, AFC/NFC for NFL).
 */

import { useState } from 'react';
import { teams } from '../../data/teams';
import { nflTeams } from '../../data/nfl-teams';
import type { Sport } from '../../types';

// Generic team type that works with both NBA and NFL
interface GenericTeam {
  id: number;
  abbreviation: string;
  name: string;
  colors: { primary: string; secondary: string };
  conference?: string;
}

interface TeamSelectorProps {
  selectedTeam: GenericTeam | null;
  onSelect: (team: GenericTeam) => void;
  sport?: Sport;
}

export function TeamSelector({ selectedTeam, onSelect, sport = 'nba' }: TeamSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Get teams based on sport
  const teamList = sport === 'nba' ? teams : nflTeams;

  // Group teams by conference
  const getConferences = (): Record<string, GenericTeam[]> => {
    if (sport === 'nba') {
      return {
        Eastern: teamList.filter((t) => t.conference === 'Eastern') as GenericTeam[],
        Western: teamList.filter((t) => t.conference === 'Western') as GenericTeam[],
      };
    } else {
      return {
        AFC: teamList.filter((t) => t.conference === 'AFC') as GenericTeam[],
        NFC: teamList.filter((t) => t.conference === 'NFC') as GenericTeam[],
      };
    }
  };

  const conferences = getConferences();

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
          {Object.entries(conferences).map(([conferenceName, conferenceTeams]) => (
            <div key={conferenceName}>
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-900/50 sticky top-0">
                {conferenceName} {sport === 'nba' ? 'Conference' : ''}
              </div>
              {conferenceTeams.map((team) => (
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
