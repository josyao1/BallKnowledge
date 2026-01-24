import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

export function RouletteOverlay({ winningTeam, winningYear, onComplete, sport }: any) {
  const [phase, setPhase] = useState<'shuffling' | 'settling' | 'dealing-1' | 'dealing-2' | 'countdown'>('shuffling');
  const [count, setCount] = useState(5);
  const [isMobile, setIsMobile] = useState(false);

  // Check for mobile screen size to adjust card slide distance
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const cardBackImage = sport === 'nba' ? '/images/Group 29.svg' : '/images/g29.svg';

  useEffect(() => {
    const shuffleTimer = setTimeout(() => setPhase('settling'), 4000);
    const settleTimer = setTimeout(() => setPhase('dealing-1'), 5500);
    const secondCardTimer = setTimeout(() => setPhase('dealing-2'), 6700);
    const countdownTimer = setTimeout(() => {
      setPhase('countdown');
    }, 10500); 

    return () => {
      [shuffleTimer, settleTimer, secondCardTimer, countdownTimer].forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (phase === 'countdown' && count > 0) {
      const timer = setTimeout(() => setCount(count - 1), 1000);
      return () => clearTimeout(timer);
    } else if (phase === 'countdown' && count === 0) {
      onComplete();
    }
  }, [phase, count, onComplete]);

  return (
    <div className="flex flex-col items-center justify-start min-h-screen w-full relative overflow-hidden bg-[#0d2a0b] pt-10 md:pt-20">
      <div 
        className="absolute inset-0 opacity-40 pointer-events-none" 
        style={{ 
          backgroundImage: `url("https://www.transparenttextures.com/patterns/felt.png")`,
          background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)` 
        }} 
      />

      <AnimatePresence mode="wait">
        {phase !== 'countdown' ? (
          <motion.div 
            key="table" 
            exit={{ opacity: 0, scale: 0.9 }} 
            className="flex flex-col items-center w-full relative z-10 px-4"
          >
            <h2 className="retro-title text-lg md:text-2xl mb-8 md:mb-12 text-white uppercase tracking-[0.4em] text-center opacity-80">
              {phase === 'shuffling' ? 'Shuffling Deck' : phase === 'settling' ? 'Cutting Deck' : 'The Draw'}
            </h2>
            
            {/* Responsively sized deck container */}
            <div className="relative w-28 h-40 md:w-36 md:h-48 [perspective:1500px]">
               {Array.from({ length: 12 }).map((_, i) => (
                 <motion.div
                   key={i}
                   animate={phase === 'shuffling' ? { 
                     x: i % 2 === 0 ? [0, isMobile ? -30 : -60, 0] : [0, isMobile ? 30 : 60, 0],
                     rotateZ: i % 2 === 0 ? [0, -8, 0] : [0, 8, 0],
                   } : { 
                     x: 0, rotateZ: 0, y: -i * 0.4 
                   }}
                   transition={{ repeat: phase === 'shuffling' ? Infinity : 0, duration: 0.6, delay: i * 0.04 }}
                   className="absolute inset-0 rounded-lg shadow-xl border border-white/10"
                   style={{ backgroundImage: `url("${cardBackImage}")`, backgroundSize: 'cover', backgroundColor: '#111' }}
                 />
               ))}

               {(phase === 'dealing-1' || phase === 'dealing-2') && (
                 <>
                   <RevealCard 
                    value={winningYear} 
                    side="left" 
                    label="SEASON" 
                    cardBack={cardBackImage} 
                    isActive={true}
                    isMobile={isMobile}
                   />
                   <RevealCard 
                    value={winningTeam} 
                    side="right" 
                    label="TEAM" 
                    cardBack={cardBackImage} 
                    isActive={phase === 'dealing-2'} 
                    isMobile={isMobile}
                   />
                 </>
               )}
            </div>
          </motion.div>
        ) : (
          /* Responsive Countdown Ring */
          <motion.div 
            key="countdown" 
            initial={{ opacity: 0, scale: 0.8 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="flex flex-col items-center justify-center relative w-64 h-64 md:w-72 md:h-72 z-10 my-auto"
          >
            <svg className="absolute inset-0 w-full h-full rotate-[-90deg]" viewBox="0 0 288 288">
              <circle cx="144" cy="144" r="130" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
              <motion.circle 
                cx="144" cy="144" r="130" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"
                strokeDasharray="816"
                animate={{ strokeDashoffset: 816 - (816 * (count / 5)) }}
                transition={{ duration: 1, ease: "linear" }}
              />
            </svg>
            <div className="flex flex-col items-center justify-center relative z-20">
              <span className="sports-font text-[8px] md:text-[10px] text-white/40 tracking-[0.4em] uppercase mb-2">Game Starting In</span>
              <AnimatePresence mode="popLayout">
                <motion.span key={count} className="retro-title text-7xl md:text-9xl text-white select-none leading-none">
                  {count}
                </motion.span>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RevealCard({ value, side, label, cardBack, isActive, isMobile }: any) {
  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ x: 0, y: 0, opacity: 0, zIndex: 50 }}
          animate={{ 
            // Mobile: Side offset is much smaller to stay within 100vw
            x: side === 'left' ? (isMobile ? -80 : -200) : (isMobile ? 80 : 200), 
            y: isMobile ? 180 : 240, 
            opacity: 1 
          }}
          transition={{ type: 'spring', damping: 25, stiffness: 60 }}
          className="absolute inset-0"
        >
          <motion.div
            initial={{ rotateY: 180 }}
            animate={{ rotateY: 0 }}
            transition={{ duration: 0.7, delay: 0.8 }}
            className="w-full h-full [transform-style:preserve-3d] relative"
          >
            <CardFace side="back" image={cardBack} />
            <CardFace side="front" label={label} value={value} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CardFace({ side, image, label, value }: any) {
  const isBack = side === 'back';
  return (
    <div 
      className={`absolute inset-0 rounded-lg shadow-xl overflow-hidden bg-white ${isBack ? 'border-white/10' : ''}`}
      style={{ 
        backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
        transform: isBack ? 'rotateY(180deg)' : 'rotateY(0deg)',
        backgroundImage: isBack ? `url("${image}")` : 'none',
        backgroundSize: 'cover'
      }}
    >
      {!isBack && (
        <div className="w-full h-full p-[4px] bg-black">
          <div className="w-full h-full bg-white rounded-[4px] flex flex-col items-center justify-center p-2 md:p-3 overflow-hidden">
            <span className="sports-font text-[7px] md:text-[9px] text-black/30 mb-1 tracking-[0.2em] uppercase font-bold text-center">{label}</span>
            <span className="retro-title text-sm md:text-xl text-black leading-tight uppercase font-bold text-center break-words w-full px-1">{value}</span>
          </div>
        </div>
      )}
    </div>
  );
}