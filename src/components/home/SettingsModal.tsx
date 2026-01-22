import { useSettingsStore } from '../../stores/settingsStore';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { timerDuration, yearRange, hideResultsDuringGame, setTimerDuration, setYearRange, setHideResultsDuringGame } = useSettingsStore();

  const timerOptions = [
    { label: '1:00', value: 60 },
    { label: '1:30', value: 90 },
    { label: '2:00', value: 120 },
    { label: '3:00', value: 180 },
    { label: '5:00', value: 300 },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Timer duration */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">Timer Duration</label>
          <div className="flex flex-wrap gap-2">
            {timerOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setTimerDuration(option.value)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  timerDuration === option.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Year range */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">Year Range for Random Mode</label>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Min Year</label>
              <input
                type="number"
                value={yearRange.min}
                onChange={(e) => setYearRange(parseInt(e.target.value) || 1985, yearRange.max)}
                min={1985}
                max={yearRange.max - 1}
                className="w-full p-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <span className="text-gray-500 pt-5">to</span>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Max Year</label>
              <input
                type="number"
                value={yearRange.max}
                onChange={(e) => setYearRange(yearRange.min, parseInt(e.target.value) || 2025)}
                min={yearRange.min + 1}
                max={2025}
                className="w-full p-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Hide results during game */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm text-gray-300">Hide Answers During Game</label>
              <p className="text-xs text-gray-500 mt-1">
                Don't reveal correct/incorrect until time runs out
              </p>
            </div>
            <button
              onClick={() => setHideResultsDuringGame(!hideResultsDuringGame)}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                hideResultsDuringGame ? 'bg-indigo-600' : 'bg-gray-600'
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

        {/* Note */}
        <p className="text-xs text-gray-500 text-center">
          Settings are automatically saved.
        </p>
      </div>
    </div>
  );
}
