/**
 * YearSelector.tsx — Dropdown picker for selecting a season year.
 *
 * Lists years from maxYear down to minYear. Formats the display as
 * "YYYY-YY" for NBA (e.g. "2023-24") or just "YYYY" for NFL.
 */

import { useState } from 'react';
import type { Sport } from '../../types';

interface YearSelectorProps {
  selectedYear: number | null;
  onSelect: (year: number) => void;
  minYear: number;
  maxYear: number;
  sport?: Sport;
}

export function YearSelector({ selectedYear, onSelect, minYear, maxYear, sport = 'nba' }: YearSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);

  const formatSeason = (year: number) =>
    sport === 'nba' ? `${year}-${String(year + 1).slice(-2)}` : `${year}`;

  return (
    <div className="relative">
      <label className="block sports-font text-[9px] text-[#888] mb-2 tracking-widest uppercase">Select Season</label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2.5 bg-[#1a1a1a]/60 rounded-lg text-left flex items-center justify-between border border-[#2a2a2a] hover:border-[#444] transition-colors"
      >
        {selectedYear ? (
          <span className="text-sm text-[var(--vintage-cream)]">{formatSeason(selectedYear)}</span>
        ) : (
          <span className="text-[#666] text-sm">Choose a season...</span>
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
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#141414] rounded-lg border border-[#2a2a2a] shadow-xl z-50 max-h-60 overflow-y-auto">
          {years.map((year) => (
            <button
              key={year}
              onClick={() => {
                onSelect(year);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                selectedYear === year
                  ? 'bg-[#d4af37]/15 text-[#f2d88a]'
                  : 'text-[var(--vintage-cream)] hover:bg-[#1f1f1f]'
              }`}
            >
              {formatSeason(year)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
