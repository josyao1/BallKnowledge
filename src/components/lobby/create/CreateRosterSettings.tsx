/**
 * CreateRosterSettings.tsx — Roster Challenge settings panel for lobby creation.
 *
 * Covers: deck mode (random vs manual), scope (team vs division),
 * year range for random mode, team + year pickers for manual mode,
 * and a round timer with presets + custom input.
 */

import { motion } from 'framer-motion';
import { TeamSelector } from '../../home/TeamSelector';
import { YearSelector } from '../../home/YearSelector';
import type { Sport, GameMode } from '../../../types';

type GenericTeam = {
  id: number;
  abbreviation: string;
  name: string;
  colors: { primary: string; secondary: string };
};

interface Props {
  sport: Sport;
  gameMode: GameMode;
  onGameModeChange: (m: GameMode) => void;
  selectionScope: 'team' | 'division';
  onSelectionScopeChange: (sc: 'team' | 'division') => void;
  selectedTeam: GenericTeam | null;
  onTeamSelect: (t: GenericTeam | null) => void;
  selectedYear: number | null;
  onYearSelect: (y: number | null) => void;
  randomMinYear: number;
  onRandomMinYearChange: (y: number) => void;
  randomMaxYear: number;
  onRandomMaxYearChange: (y: number) => void;
  timerDuration: number;
  customTimerInput: string;
  selectedPreset: number | null;
  onPresetSelect: (seconds: number) => void;
  onCustomTimerChange: (value: string) => void;
}

export function CreateRosterSettings({
  sport, gameMode, onGameModeChange,
  selectionScope, onSelectionScopeChange,
  selectedTeam, onTeamSelect, selectedYear, onYearSelect,
  randomMinYear, onRandomMinYearChange, randomMaxYear, onRandomMaxYearChange,
  timerDuration, customTimerInput, selectedPreset, onPresetSelect, onCustomTimerChange,
}: Props) {
  const yearOptions = Array.from({ length: 2025 - 2000 + 1 }, (_, i) => 2000 + i);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="space-y-4"
    >
      {/* Deck mode: Random vs Manual */}
      <div className="bg-black/50 border border-white/10 rounded-sm p-4">
        <div className="sports-font text-[10px] text-white/40 text-center mb-3 tracking-[0.3em] uppercase">
          Deck Selection
        </div>
        <div className="flex gap-2 justify-center">
          {(['random', 'manual'] as const).map((m) => (
            <button
              key={m}
              onClick={() => onGameModeChange(m)}
              className={`px-6 py-2 rounded-sm sports-font tracking-wider transition-all ${
                gameMode === m
                  ? 'bg-[#d4af37] text-black shadow-lg font-bold'
                  : 'bg-black/40 text-white/50 border border-white/20 hover:border-white/40'
              }`}
            >
              {m === 'random' ? 'Random' : 'Choose Team'}
            </button>
          ))}
        </div>
      </div>

      {/* Scope: team vs division (random mode only) */}
      {gameMode === 'random' && (
        <div className="bg-black/50 border border-white/10 rounded-sm p-4">
          <div className="sports-font text-[10px] text-white/40 text-center mb-3 tracking-[0.3em] uppercase">
            Scope
          </div>
          <div className="flex gap-2 justify-center">
            {(['team', 'division'] as const).map((sc) => (
              <button
                key={sc}
                onClick={() => onSelectionScopeChange(sc)}
                className={`px-6 py-2 rounded-sm sports-font tracking-wider transition-all ${
                  selectionScope === sc
                    ? 'bg-[#d4af37] text-black shadow-lg font-bold'
                    : 'bg-black/40 text-white/50 border border-white/20 hover:border-white/40'
                }`}
              >
                {sc.charAt(0).toUpperCase() + sc.slice(1)}
              </button>
            ))}
          </div>
          {selectionScope === 'division' && (
            <div className="text-center text-white/30 text-[10px] sports-font tracking-wider mt-2">
              Random division — name players from all 4 teams
            </div>
          )}
        </div>
      )}

      {/* Year range (random mode) */}
      {gameMode === 'random' && (
        <div className="bg-black/50 border border-white/10 rounded-sm p-4">
          <div className="sports-font text-[10px] text-white/40 text-center mb-3 tracking-[0.3em] uppercase">
            Year Range
          </div>
          <div className="flex items-center justify-center gap-3">
            <select
              value={randomMinYear}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                onRandomMinYearChange(v);
                if (v > randomMaxYear) onRandomMaxYearChange(v);
              }}
              className="bg-[#111] text-white px-3 py-2 rounded-sm border border-white/20 sports-font focus:outline-none focus:border-[#d4af37]"
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <span className="text-white/40 sports-font">to</span>
            <select
              value={randomMaxYear}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                onRandomMaxYearChange(v);
                if (v < randomMinYear) onRandomMinYearChange(v);
              }}
              className="bg-[#111] text-white px-3 py-2 rounded-sm border border-white/20 sports-font focus:outline-none focus:border-[#d4af37]"
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Manual team + year selection */}
      {gameMode === 'manual' && (
        <div className="space-y-4">
          <TeamSelector selectedTeam={selectedTeam} onSelect={onTeamSelect} sport={sport} />
          <YearSelector selectedYear={selectedYear} onSelect={onYearSelect} minYear={2000} maxYear={2025} sport={sport} />
        </div>
      )}

      {/* Round timer */}
      <div className="bg-black/50 border border-white/10 rounded-sm p-4">
        <div className="sports-font text-[10px] text-white/40 text-center mb-3 tracking-[0.3em] uppercase">
          Round Timer
        </div>
        <div className="flex flex-wrap justify-center gap-2 mb-3">
          {[60, 90, 120, 180, 300].map((seconds) => (
            <button
              key={seconds}
              onClick={() => onPresetSelect(seconds)}
              className={`px-3 py-1.5 rounded-sm sports-font text-sm transition-all ${
                selectedPreset === seconds && !customTimerInput
                  ? 'bg-[#d4af37] text-black font-bold'
                  : 'bg-black/40 text-white/40 border border-white/10 hover:border-white/30'
              }`}
            >
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2">
          <span className="text-white/40 text-[10px] sports-font tracking-wider">CUSTOM:</span>
          <input
            type="number"
            value={customTimerInput}
            onChange={(e) => onCustomTimerChange(e.target.value)}
            placeholder="sec"
            min={10}
            max={600}
            className="w-20 px-2 py-1.5 bg-[#111] rounded-sm border border-white/20 text-white text-center sports-font focus:outline-none focus:border-[#d4af37]"
          />
          {customTimerInput && (
            <span className="text-white/50 sports-font text-sm">
              = {Math.floor(timerDuration / 60)}:{String(timerDuration % 60).padStart(2, '0')}
            </span>
          )}
        </div>
        <div className="text-center mt-2 retro-title text-2xl text-white">
          {Math.floor(timerDuration / 60)}:{String(timerDuration % 60).padStart(2, '0')}
        </div>
      </div>
    </motion.div>
  );
}
