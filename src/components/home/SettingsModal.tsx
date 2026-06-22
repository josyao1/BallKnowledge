/**
 * SettingsModal.tsx — Modal for configuring game preferences.
 *
 * Allows users to adjust timer duration, year range for random mode,
 * toggle hidden results (deferred answer reveal), and toggle season
 * hints (team record display). Changes auto-persist via settingsStore.
 */

import { useSettingsStore } from '../../stores/settingsStore';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const {
    timerDuration,
    yearRange,
    hideResultsDuringGame,
    showSeasonHints,
    setTimerDuration,
    setYearRange,
    setHideResultsDuringGame,
    setShowSeasonHints,
  } = useSettingsStore();

  const timerOptions = [
    { label: '1:00', value: 60 },
    { label: '1:30', value: 90 },
    { label: '2:00', value: 120 },
    { label: '3:00', value: 180 },
    { label: '5:00', value: 300 },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
      <div className="capcrunch-panel max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="capcrunch-title text-xl text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 text-white/40 hover:text-white/70 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Timer duration */}
        <div className="mb-6">
          <label className="block capcrunch-kicker text-[10px] text-white/40 tracking-widest uppercase mb-2">
            Timer Duration
          </label>
          <div className="flex flex-wrap gap-2">
            {timerOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setTimerDuration(option.value)}
                className={`px-4 py-2 capcrunch-kicker text-sm transition-colors ${
                  timerDuration === option.value
                    ? 'bg-[#d4af37] text-black'
                    : 'bg-black/40 border border-white/10 text-white/60 hover:border-white/20'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Year range */}
        <div className="mb-6">
          <label className="block capcrunch-kicker text-[10px] text-white/40 tracking-widest uppercase mb-2">
            Year Range for Random Mode
          </label>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block capcrunch-kicker text-[9px] text-white/30 mb-1">
                Min Year
              </label>
              <input
                type="number"
                value={yearRange.min}
                onChange={(e) => setYearRange(parseInt(e.target.value) || 1985, yearRange.max)}
                min={1985}
                max={yearRange.max - 1}
                className="w-full p-2 bg-black/40 border border-white/10 text-white focus:border-[#d4af37] focus:outline-none capcrunch-kicker"
              />
            </div>
            <span className="text-white/30 pt-5 capcrunch-kicker text-sm">to</span>
            <div className="flex-1">
              <label className="block capcrunch-kicker text-[9px] text-white/30 mb-1">
                Max Year
              </label>
              <input
                type="number"
                value={yearRange.max}
                onChange={(e) => setYearRange(yearRange.min, parseInt(e.target.value) || 2025)}
                min={yearRange.min + 1}
                max={2025}
                className="w-full p-2 bg-black/40 border border-white/10 text-white focus:border-[#d4af37] focus:outline-none capcrunch-kicker"
              />
            </div>
          </div>
        </div>

        {/* Hide results during game */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <label className="block capcrunch-kicker text-sm text-white/70">
                Hide Answers During Game
              </label>
              <p className="capcrunch-kicker text-[10px] text-white/30 mt-1">
                Don't reveal correct/incorrect until time runs out
              </p>
            </div>
            <button
              onClick={() => setHideResultsDuringGame(!hideResultsDuringGame)}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                hideResultsDuringGame ? 'bg-[#d4af37]' : 'bg-white/10'
              }`}
            >
              <div
                className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                  hideResultsDuringGame ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Show season hints */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <label className="block capcrunch-kicker text-sm text-white/70">
                Show Season Hints
              </label>
              <p className="capcrunch-kicker text-[10px] text-white/30 mt-1">
                Display team's record for the season
              </p>
            </div>
            <button
              onClick={() => setShowSeasonHints(!showSeasonHints)}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                showSeasonHints ? 'bg-[#d4af37]' : 'bg-white/10'
              }`}
            >
              <div
                className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                  showSeasonHints ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <p className="capcrunch-kicker text-[10px] text-white/20 tracking-widest text-center">
          Settings are automatically saved.
        </p>
      </div>
    </div>
  );
}
