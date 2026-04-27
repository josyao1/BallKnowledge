/**
 * GameFanArc.tsx — The fanned-out game card display shown after the deck is dealt.
 *
 * Each card pops forward on hover/tap and reveals game info + action buttons.
 * Cards with `popular: true` show a "Most Popular" label when not active.
 *
 * Desktop: hover activates a card (with debounce). Touch: tap toggles it.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { GAMES } from '../../data/homeGames';
import type { GameCard } from '../../data/homeGames';

interface ScaledPosition {
  x: number;
  y: number;
  rotate: number;
}

interface Props {
  sport: 'nba' | 'nfl';
  cardW: number;
  cardH: number;
  containerH: number;
  popDist: number;
  fanToJoinGap: number;
  fanScale: number;
  scaledPositions: ScaledPosition[];
  deckYOffset: number;
  isTouchDevice: boolean;
  hoveredCard: string | null;
  tappedCard: string | null;
  setHoveredCardDebounced: (id: string | null) => void;
  setTappedCard: React.Dispatch<React.SetStateAction<string | null>>;
  // Called when the user chooses to open a setup panel for roster/career/scramble
  onCardSelect: (id: string) => void;
}

export function GameFanArc({
  sport, cardW, cardH, containerH, popDist, fanToJoinGap, fanScale,
  scaledPositions, deckYOffset, isTouchDevice,
  hoveredCard, tappedCard, setHoveredCardDebounced, setTappedCard, onCardSelect,
}: Props) {
  const navigate = useNavigate();

  return (
    <motion.div
      key="fan"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col items-center z-10 w-full"
      style={{ transform: `translateY(-${deckYOffset}px)`, rowGap: fanToJoinGap }}
    >
      {/* Fan container — cards are absolutely positioned relative to this */}
      <div
        className="relative flex justify-center items-end w-full"
        style={{ height: containerH, overflow: 'visible' }}
        onClick={() => setTappedCard(null)}
      >
        {GAMES.map((game: GameCard, i: number) => {
          const fp = scaledPositions[i];

          // On touch: only tappedCard drives active state (hover is unreliable on touch)
          // On desktop: either hover or tap can activate the card
          const isActive = isTouchDevice
            ? tappedCard === game.id
            : hoveredCard === game.id || tappedCard === game.id;

          // Desktop-only hover props — omitted entirely on touch to prevent
          // stuck cards, oscillation, and pointer-event misfires
          const hoverProps = isTouchDevice ? {} : {
            whileHover: { y: fp.y - popDist, rotate: 0, scale: 1.08, transition: { type: 'spring' as const, stiffness: 380, damping: 28 } },
            onHoverStart: () => setHoveredCardDebounced(game.id),
            onHoverEnd:   () => setHoveredCardDebounced(null),
          };

          return (
            <motion.div
              key={game.id}
              initial={{ x: fp.x, y: -(containerH + 20), rotate: (i - 2) * 14, opacity: 0 }}
              animate={{ x: fp.x, y: isActive ? fp.y - popDist : fp.y, rotate: isActive ? 0 : fp.rotate, scale: isActive ? 1.08 : 1, opacity: 1 }}
              transition={{ delay: i * 0.09, type: 'spring', stiffness: 220, damping: 26 }}
              {...hoverProps}
              onClick={e => {
                e.stopPropagation();
                setTappedCard(prev => prev === game.id ? null : game.id);
              }}
              className="absolute bottom-0 cursor-pointer"
              style={{ width: cardW, height: cardH, zIndex: isActive ? 20 : i + 1 }}
            >
              {/* Card face — sport art full bleed with game color border */}
              <div
                className="w-full h-full rounded-xl border-2 overflow-hidden relative shadow-xl bg-[#0e0e0e]"
                style={{ borderColor: game.color }}
              >
                <img
                  src={game.imageBySport?.[sport] ?? game.image}
                  alt=""
                  className="absolute inset-0 w-full h-full"
                  style={{ objectFit: 'cover', objectPosition: 'center', opacity: 0.8 }}
                />
                {/* Subtle dark overlay so corners are readable */}
                <div className="absolute inset-0 bg-black/20" />

                {/* Top-left abbreviation */}
                <div
                  className="absolute top-1.5 left-2 sports-font font-bold leading-none z-10"
                  style={{ color: game.color, textShadow: '0 1px 4px rgba(0,0,0,0.9)', fontSize: Math.max(7, Math.round(10 * fanScale)) }}
                >
                  {game.abbr}
                </div>

                {/* "Most Popular" label — hidden when card is active (info panel covers it) */}
                {game.popular && !isActive && (
                  <div
                    className="absolute bottom-1.5 left-2 sports-font font-bold leading-none z-10 tracking-wide uppercase"
                    style={{ color: game.color, textShadow: '0 1px 4px rgba(0,0,0,0.9)', fontSize: Math.max(5, Math.round(7 * fanScale)) }}
                  >
                    Most Popular
                  </div>
                )}

                {/* Bottom-right flipped abbreviation */}
                <div
                  className="absolute bottom-1.5 right-2 rotate-180 sports-font font-bold leading-none z-10"
                  style={{ color: `${game.color}80`, textShadow: '0 1px 4px rgba(0,0,0,0.9)', fontSize: Math.max(7, Math.round(11 * fanScale)) }}
                >
                  {game.abbr}
                </div>

                {/* Hover / tap info panel — slides up from bottom */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '100%' }}
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute inset-0 flex flex-col justify-end"
                      style={{
                        background: 'linear-gradient(to top, rgba(14,14,14,0.97) 60%, rgba(14,14,14,0.7) 100%)',
                        padding: Math.max(6, Math.round(10 * fanScale)),
                      }}
                    >
                      <h3
                        className="retro-title leading-tight"
                        style={{ color: game.color, fontSize: Math.max(10, Math.round(16 * fanScale)) }}
                      >
                        {game.name}
                      </h3>
                      <p
                        className="sports-font text-[#888] mt-1 leading-snug"
                        style={{ fontSize: Math.max(6, Math.round(9 * fanScale)) }}
                      >
                        {game.taglineBySport?.[sport] ?? game.tagline}
                      </p>

                      <div className="flex gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
                        {game.hasSolo && (
                          <button
                            onClick={() => {
                              if (game.id === 'roster' || game.id === 'guess-player') {
                                // These games have a setup panel — open it
                                onCardSelect(game.id);
                                setTappedCard(null);
                              } else if (game.soloPath) {
                                navigate(game.soloPath);
                              }
                            }}
                            className="flex-1 py-1.5 rounded sports-font text-[9px] tracking-wider uppercase border hover:opacity-70 transition-opacity"
                            style={{ borderColor: game.color, color: game.color }}
                          >
                            Solo
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (game.id === 'guess-player') {
                              // Lobby selection happens inside the setup panel
                              onCardSelect(game.id);
                              setTappedCard(null);
                            } else if (game.multiPath) {
                              navigate(game.multiPath);
                            } else {
                              const modeMap: Record<string, string> = {
                                roster: 'roster',
                                lineup: 'lineup-is-right',
                                'starting-lineup': 'starting-lineup',
                              };
                              navigate('/lobby/create', { state: { gameType: modeMap[game.id] ?? 'roster' } });
                            }
                          }}
                          className="flex-1 py-1.5 rounded sports-font text-[9px] tracking-wider uppercase border border-[#444] text-[#999] hover:border-[#666] hover:text-[#ccc] transition-colors"
                        >
                          {game.hasSolo ? 'Lobby' : 'Play'}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>

      <button
        onClick={() => navigate('/lobby/join')}
        className="z-10 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sports-font text-[10px] sm:text-xs tracking-[0.2em] uppercase transition-all bg-[#1a1a1a] border border-[#d4af37]/50 text-[var(--vintage-cream)] hover:border-[#d4af37] hover:bg-[#202020] shadow-[0_0_0_1px_rgba(212,175,55,0.2)]"
      >
        Join Existing Lobby →
      </button>
    </motion.div>
  );
}
