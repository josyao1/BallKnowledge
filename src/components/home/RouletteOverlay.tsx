import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

export function RouletteOverlay({ winningTeam, winningYear, onComplete, sport }: any) {
  const [phase, setPhase] = useState<'shuffling' | 'settling' | 'dealing-1' | 'dealing-2' | 'countdown'>('shuffling');
  const [count, setCount] = useState(5);

  const cardBackImage = sport === 'nba' 
    ? '/images/Group 29.svg' 
    : '/images/g29.svg';

  useEffect(() => {
    const shuffleTimer = setTimeout(() => setPhase('settling'), 4000);
    const settleTimer = setTimeout(() => setPhase('dealing-1'), 5500);
    const secondCardTimer = setTimeout(() => setPhase('dealing-2'), 6700);
    const countdownTimer = setTimeout(() => {
      setPhase('countdown');
      playSlideSound();
    }, 10500); 

    return () => {
      clearTimeout(shuffleTimer);
      clearTimeout(settleTimer);
      clearTimeout(secondCardTimer);
      clearTimeout(countdownTimer);
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

  const playSlideSound = () => {
    const audio = new Audio('/sounds/card-slide.mp3');
    audio.volume = 0.4;
    audio.play().catch(() => {});
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen w-full relative overflow-hidden bg-[#0d2a0b] pt-20">
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
            exit={{ opacity: 0, y: -20 }} 
            className="flex flex-col items-center w-full relative z-10"
          >
            <h2 className="retro-title text-2xl mb-12 text-[var(--vintage-cream)] uppercase tracking-[0.4em] text-center opacity-80">
              {phase === 'shuffling' ? 'Shuffling Deck' : phase === 'settling' ? 'Cutting Deck' : 'The Draw'}
            </h2>
            
            <div className="relative w-36 h-48 [perspective:1500px]">
               {/* THE MAIN DECK */}
               {Array.from({ length: 15 }).map((_, i) => (
                 <motion.div
                   key={i}
                   animate={phase === 'shuffling' ? { 
                     x: i % 2 === 0 ? [0, -60, 0] : [0, 60, 0],
                     rotateZ: i % 2 === 0 ? [0, -12, 0] : [0, 12, 0],
                     zIndex: [i, 20, i],
                     y: [0, -4, 0]
                   } : { 
                     x: 0, rotateZ: 0, y: -i * 0.4 
                   }}
                   transition={phase === 'shuffling' ? { 
                     repeat: Infinity, duration: 0.6, delay: i * 0.04, ease: "easeInOut" 
                   } : { 
                     duration: 0.5, ease: "easeOut" 
                   }}
                   className="absolute inset-0 rounded-lg shadow-xl border border-white/10"
                   style={{ 
                     backgroundImage: `url("${cardBackImage}")`,
                     backgroundSize: 'cover',
                     backgroundPosition: 'center',
                     backgroundColor: '#111'
                   }}
                 />
               ))}

               {(phase === 'dealing-1' || phase === 'dealing-2') && (
                 <>
                   <RevealCard 
                    value={winningYear} 
                    side="left" 
                    color="#d4af37" 
                    label="SEASON" 
                    cardBack={cardBackImage} 
                    isActive={true} 
                   />
                   
                   <RevealCard 
                    value={winningTeam} 
                    side="right" 
                    color={sport === 'nba' ? '#f58426' : '#013369'} 
                    label="TEAM" 
                    cardBack={cardBackImage} 
                    isActive={phase === 'dealing-2'} 
                   />
                 </>
               )}
            </div>
          </motion.div>
        ) : (
          <motion.div 
  key="countdown" 
  initial={{ opacity: 0, scale: 0.8 }} 
  animate={{ opacity: 1, scale: 1 }} 
  className="flex flex-col items-center justify-center relative w-72 h-72 z-10 my-auto"
>
  {/* Circular Progress Timer */}
  <svg className="absolute inset-0 w-full h-full rotate-[-90deg]">
    <circle cx="144" cy="144" r="130" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
    <motion.circle 
      cx="144" cy="144" r="130" fill="none" 
      stroke="white" strokeWidth="3" strokeLinecap="round"
      strokeDasharray="816"
      animate={{ strokeDashoffset: 816 - (816 * (count / 5)) }}
      transition={{ duration: 1, ease: "linear" }}
    />
  </svg>

  <div className="flex flex-col items-center justify-center relative z-20">
    {/* NEW STATUS TEXT */}
    <motion.span 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="sports-font text-[10px] text-white/40 tracking-[0.4em] uppercase mb-2"
    >
      Game Starting In
    </motion.span>

    <AnimatePresence mode="popLayout">
      <motion.span
        key={count}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.5 }}
        className="retro-title text-9xl text-white select-none leading-none"
      >
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

function RevealCard({ value, side, color, label, cardBack, isActive }: any) {
  return (
    <AnimatePresence>
      {isActive && (
        // THE CONTAINER: Handles only X and Y (Slide)
        <motion.div
          initial={{ x: 0, y: 0, opacity: 0, zIndex: 50 }}
          animate={{ 
            x: side === 'left' ? -200 : 200, 
            y: 240, 
            opacity: 1 
          }}
          transition={{ 
            type: 'spring', 
            damping: 25, 
            stiffness: 60 
          }}
          className="absolute inset-0"
        >
          {/* THE INNER CARD: Handles only the Flip */}
          <motion.div
            initial={{ rotateY: 180 }}
            animate={{ rotateY: 0 }}
            transition={{ 
              duration: 0.7, 
              delay: 0.9, // Start flip only after spring slide is mostly done
              ease: "easeOut" 
            }}
            className="w-full h-full [transform-style:preserve-3d] relative"
          >
            <CardFace side="back" image={cardBack} />
            <CardFace side="front" color={color} label={label} value={value} />
          </motion.div>

          {/* REFLECTION: Nested inside the same slide logic */}
          <motion.div
            initial={{ rotateY: 180, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 0.15 }}
            transition={{ duration: 0.7, delay: 0.9, ease: "easeOut" }}
            className="absolute inset-0 [transform-style:preserve-3d] pointer-events-none"
            style={{ 
              filter: 'blur(3px)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 100%)',
              maskImage: 'linear-gradient(to bottom, transparent 0%, black 100%)',
              transform: 'scaleY(-1) translateY(-110%)' 
            }}
          >
            <CardFace side="back" image={cardBack} />
            <CardFace side="front" color={color} label={label} value={value} />
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
      className={`absolute inset-0 rounded-lg shadow-xl overflow-hidden ${isBack ? 'border-[1px] border-white/10' : ''}`}
      style={{ 
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: isBack ? 'rotateY(180deg)' : 'rotateY(0deg)',
        backgroundImage: isBack ? `url("${image}")` : 'none',
        backgroundSize: 'cover',
        backgroundColor: 'white'
      }}
    >
      {!isBack && (
        /* 1. THE GRADIENT WRAPPER: This acts as the border */
        <div 
          className="w-full h-full p-[4px]" // Change this number to make the border thicker/thinner
        >

          <div className="w-full h-full bg-white rounded-[4px] flex flex-col items-center justify-center p-3">
            <span className="sports-font text-[9px] text-black/30 mb-1 tracking-[0.2em] font-bold uppercase">
              {label}
            </span>
            <span className="retro-title text-xl text-black leading-tight uppercase px-1 font-bold text-center">
              {value}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}