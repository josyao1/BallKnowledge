/**
 * CareerControls.tsx — Guess input + hint buttons for Career Arc.
 * Shared by CareerGamePage (solo) and MultiplayerCareerPage.
 */

import type { RefObject } from 'react';
// React 19 useRef returns RefObject<T | null>; accept both forms
type InputRef = RefObject<HTMLInputElement> | RefObject<HTMLInputElement | null>;

interface Props {
  guessInput: string;
  onGuessChange: (v: string) => void;
  onGuess: () => void;
  feedbackMessage: string;
  /** Controls feedback text color: 'correct' → green, 'wrong' → red, '' → hidden */
  feedbackType: 'correct' | 'wrong' | '';
  /** Sport-specific accent color (hex) used for the Guess button background */
  accentColor: string;
  /** Hint buttons become disabled once revealed (each hint costs points) */
  yearsRevealed: boolean;
  bioRevealed: boolean;
  initialsRevealed: boolean;
  onRevealYears: () => void;
  onRevealBio: () => void;
  onRevealInitials: () => void;
  onGiveUp: () => void;
  /** Optional ref forwarded to the text input — used by the parent to manage focus */
  inputRef?: InputRef;
}

export function CareerControls({
  guessInput, onGuessChange, onGuess,
  feedbackMessage, feedbackType, accentColor,
  yearsRevealed, bioRevealed, initialsRevealed,
  onRevealYears, onRevealBio, onRevealInitials, onGiveUp,
  inputRef,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={guessInput}
          onChange={(e) => onGuessChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onGuess()}
          placeholder="Type player name..."
          className="flex-1 bg-[#1a1a1a] border-2 border-[#3d3d3d] rounded-lg px-4 py-3 sports-font text-sm text-[var(--vintage-cream)] placeholder-[#555] focus:outline-none focus:border-[#555]"
          autoFocus
        />
        <button
          onClick={onGuess}
          disabled={!guessInput.trim()}
          className="px-6 py-3 rounded-lg sports-font text-sm text-white disabled:opacity-50 transition-all"
          style={{ backgroundColor: accentColor }}
        >
          Guess
        </button>
      </div>

      {feedbackMessage && (
        <div className={`text-center sports-font text-sm ${feedbackType === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
          {feedbackMessage}
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-center">
        <button
          onClick={onRevealYears}
          disabled={yearsRevealed}
          className="px-4 py-2 rounded-lg sports-font text-xs bg-[#1a1a1a] border-2 border-[#3d3d3d] text-[var(--vintage-cream)] hover:border-[#555] disabled:opacity-30 transition-all"
        >
          {yearsRevealed ? 'Years Shown' : 'Show Years (-3)'}
        </button>
        <button
          onClick={onRevealBio}
          disabled={bioRevealed}
          className="px-4 py-2 rounded-lg sports-font text-xs bg-[#1a1a1a] border-2 border-[#3d3d3d] text-[var(--vintage-cream)] hover:border-[#555] disabled:opacity-30 transition-all"
        >
          {bioRevealed ? 'Bio Shown' : 'Show Bio (-3)'}
        </button>
        <button
          onClick={onRevealInitials}
          disabled={initialsRevealed}
          className="px-4 py-2 rounded-lg sports-font text-xs bg-[#1a1a1a] border-2 border-[#3d3d3d] text-[var(--vintage-cream)] hover:border-[#555] disabled:opacity-30 transition-all"
        >
          {initialsRevealed ? 'Initials Shown' : 'Show Initials (-10)'}
        </button>
        <button
          onClick={onGiveUp}
          className="px-4 py-2 rounded-lg sports-font text-xs bg-[#1a1a1a] border-2 border-red-900/50 text-red-400 hover:border-red-700 transition-all"
        >
          Give Up
        </button>
      </div>
    </div>
  );
}
