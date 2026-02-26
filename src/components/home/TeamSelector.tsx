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
import { TeamLogo } from '../TeamLogo';

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
      <label className="block sports-font text-[9px] text-[#888] mb-2 tracking-widest uppercase">Select Team</label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2.5 bg-[#1a1a1a]/60 rounded-lg text-left flex items-center justify-between border border-[#2a2a2a] hover:border-[#444] transition-colors"
      >
        {selectedTeam ? (
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-[#111] border border-[#2f2f2f] flex items-center justify-center overflow-hidden">
              <TeamLogo sport={sport} abbr={selectedTeam.abbreviation} size={24} />
            </div>
            <span className="text-sm text-[var(--vintage-cream)]">{selectedTeam.name}</span>
          </div>
        ) : (
          <span className="text-[#666] text-sm">Choose a team...</span>
        )}
        <svg
          className={`w-4 h-4 text-[#777] transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#141414] rounded-lg border border-[#2a2a2a] shadow-xl z-50 max-h-80 overflow-y-auto">
          {Object.entries(conferences).map(([conferenceName, conferenceTeams]) => (
            <div key={conferenceName}>
              <div className="px-3 py-1.5 text-[9px] sports-font tracking-widest uppercase text-[#777] bg-[#111]/95 sticky top-0 border-b border-[#202020]">
                {conferenceName} {sport === 'nba' ? 'Conference' : ''}
              </div>
              {conferenceTeams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => {
                    onSelect(team);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 flex items-center gap-3 transition-colors ${
                    selectedTeam?.id === team.id
                      ? 'bg-[#d4af37]/15 text-[#f2d88a]'
                      : 'text-[var(--vintage-cream)] hover:bg-[#1f1f1f]'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-[#111] border border-[#2f2f2f] flex items-center justify-center overflow-hidden">
                    <TeamLogo sport={sport} abbr={team.abbreviation} size={20} />
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
