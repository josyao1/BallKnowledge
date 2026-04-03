/**
 * PlayerBlob.tsx — A single player circle on the Starting Lineup field.
 *
 * Displays one of three encodings:
 *   college — ESPN college logo image (falls back to 3-letter abbreviation)
 *   number  — jersey number in Bebas Neue
 *   draft   — draft pick number with a badge icon
 *
 * States:
 *   hidden       — shows the encoded clue
 *   revealed     — shows player name + position
 *   bonus-guess  — shows "?" → click to open inline name input
 */

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import type { StarterPlayer, StarterEncoding } from '../../services/startingLineupData';

type BlobState = 'hidden' | 'revealed' | 'bonus-guess';

type Props = {
  player: StarterPlayer;
  encoding: StarterEncoding;
  state: BlobState;
  onBonusGuess?: (name: string) => void;
  bonusCorrect?: boolean;
  showHint?: boolean;
};

function collegeAbbr(college: string | null): string {
  if (!college) return '?';
  const words = college.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map(w => w[0]).join('').toUpperCase().slice(0, 3);
}

const NAME_SUFFIXES = new Set(['jr.', 'sr.', 'ii', 'iii', 'iv', 'jr', 'sr']);

function displayLastName(name: string): string {
  if (!name) return '?';
  const parts = name.split(' ');
  let i = parts.length - 1;
  while (i > 0 && NAME_SUFFIXES.has(parts[i].toLowerCase())) i--;
  return parts[i] || '?';
}

export function PlayerBlob({ player, encoding, state, onBonusGuess, bonusCorrect, showHint }: Props) {
  const [guessInput, setGuessInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function openInput() {
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function submitGuess() {
    if (guessInput.trim() && onBonusGuess) {
      onBonusGuess(guessInput.trim());
      setGuessInput('');
      setIsOpen(false);
    }
  }

  // ── Revealed state ────────────────────────────────────────────────────────
  if (state === 'revealed') {
    return (
      <motion.div
        className="flex flex-col items-center gap-0.5"
        initial={{ rotateY: -90, opacity: 0, scale: 0.85 }}
        animate={{ rotateY: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        style={{ perspective: 600 }}
      >
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-green-800 border-2 border-green-400 flex items-center justify-center shadow-lg overflow-hidden">
          {player.college_espn_id ? (
            <img
              src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${player.college_espn_id}.png`}
              alt={player.college || ''}
              className="w-8 h-8 md:w-10 md:h-10 object-contain"
            />
          ) : (
            <span className="text-[9px] md:text-[10px] font-bold text-white/80 text-center leading-tight px-0.5">
              {collegeAbbr(player.college)}
            </span>
          )}
        </div>
        <div className="text-center max-w-[60px] md:max-w-[72px]">
          <div className="text-[8px] md:text-[9px] text-white/90 font-semibold leading-tight truncate">
            {displayLastName(player.name)}
          </div>
          <div className="text-[7px] md:text-[8px] text-green-400 sports-font">{player.pos_abb}</div>
        </div>
      </motion.div>
    );
  }

  // ── Bonus-guess state ─────────────────────────────────────────────────────
  if (state === 'bonus-guess') {
    if (bonusCorrect) {
      return (
        <motion.div
          className="flex flex-col items-center gap-0.5"
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 18 }}
        >
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-green-700 border-2 border-green-400 flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="text-[8px] text-green-400 sports-font text-center max-w-[60px] leading-tight truncate">
            {displayLastName(player.name)}
          </div>
        </motion.div>
      );
    }

    if (isOpen) {
      return (
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-28 md:w-32">
            <input
              ref={inputRef}
              type="text"
              value={guessInput}
              onChange={e => setGuessInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') submitGuess();
                if (e.key === 'Escape') { setIsOpen(false); setGuessInput(''); }
              }}
              onBlur={() => { if (!guessInput.trim()) setIsOpen(false); }}
              placeholder="Name..."
              className="w-full bg-[#1a2a1a] border border-green-600 rounded px-2 py-1 text-[10px] text-white placeholder-white/30 focus:outline-none focus:border-green-400"
            />
          </div>
        </div>
      );
    }

    return (
      <motion.button
        onClick={openInput}
        className="flex flex-col items-center gap-0.5 group"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 20 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.93 }}
      >
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#1c2e1c] border-2 border-dashed border-green-600/60 flex items-center justify-center group-hover:border-green-400 group-hover:bg-[#1a3a1a] transition-all shadow">
          <span className="retro-title text-lg text-green-500/60 group-hover:text-green-400">?</span>
        </div>
        <div className="text-[7px] text-green-600/50 sports-font">{player.pos_abb}</div>
      </motion.button>
    );
  }

  // ── Hidden state — show clue ───────────────────────────────────────────────
  const content = (() => {
    switch (encoding) {
      case 'college': {
        if (player.college_espn_id) {
          return (
            <img
              src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${player.college_espn_id}.png`}
              alt={player.college || ''}
              className="w-7 h-7 md:w-9 md:h-9 object-contain"
              onError={e => {
                // Fallback to text abbreviation if logo fails to load
                const target = e.currentTarget;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  const span = document.createElement('span');
                  span.className = 'text-[9px] font-bold text-white/80 text-center leading-tight';
                  span.textContent = collegeAbbr(player.college);
                  parent.appendChild(span);
                }
              }}
            />
          );
        }
        return (
          <span className="text-[9px] md:text-[10px] font-bold text-white/90 text-center leading-tight px-0.5">
            {collegeAbbr(player.college)}
          </span>
        );
      }
      case 'number': {
        return (
          <span className="retro-title text-base md:text-lg text-[#fdb927] leading-none">
            {player.number ? `#${player.number}` : '?'}
          </span>
        );
      }
      case 'draft': {
        if (!player.draft_pick) {
          return (
            <span className="text-[8px] text-white/40 sports-font">UDFA</span>
          );
        }
        return (
          <div className="flex flex-col items-center leading-none">
            <span className="text-[7px] text-white/40 sports-font tracking-wider">#</span>
            <span className="retro-title text-sm md:text-base text-[#a78bfa] leading-none">
              {player.draft_pick}
            </span>
          </div>
        );
      }
    }
  })();

  const showCollegeTooltip = encoding === 'college' && !!player.college;

  return (
    <div className="flex flex-col items-center gap-0.5 group/blob">
      <div className="relative">
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#0d1f0d] border-2 border-[#1a3a1a] flex items-center justify-center shadow-lg">
          {content}
        </div>
        {showCollegeTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-black/90 border border-white/10 rounded text-[9px] text-white/80 sports-font whitespace-nowrap pointer-events-none opacity-0 group-hover/blob:opacity-100 transition-opacity z-50">
            {player.college}
          </div>
        )}
      </div>
      <div className="text-[7px] md:text-[8px] text-white/30 sports-font">{player.pos_abb}</div>
      {showHint && player.ppg != null && (
        <div className="text-[7px] text-[#fdb927]/70 sports-font leading-none">
          {player.ppg.toFixed(1)} PPG
        </div>
      )}
      {showHint && player.ppg == null && (
        <div className="text-[7px] text-[#fdb927]/70 sports-font leading-none tracking-wider">
          {player.name.split(' ').map(w => w[0]?.toUpperCase() ?? '').join('.')}
        </div>
      )}
    </div>
  );
}
