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
      <label className="block text-sm text-gray-400 mb-1">Select Season</label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 bg-gray-800 rounded-lg text-left flex items-center justify-between border border-gray-700 hover:border-gray-600 transition-colors"
      >
        {selectedYear ? (
          <span>{formatSeason(selectedYear)}</span>
        ) : (
          <span className="text-gray-500">Choose a season...</span>
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
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg border border-gray-700 shadow-xl z-50 max-h-60 overflow-y-auto">
          {years.map((year) => (
            <button
              key={year}
              onClick={() => {
                onSelect(year);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left hover:bg-gray-700 transition-colors ${
                selectedYear === year ? 'bg-indigo-600/20 text-indigo-400' : ''
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
