import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';

export function ResultsPage() {
  const navigate = useNavigate();
  const [isExiting, setIsExiting] = useState(false);
  const [draggedGuess, setDraggedGuess] = useState<string | null>(null);
  const [dragOverPlayerId, setDragOverPlayerId] = useState<number | string | null>(null);

  const {
    selectedTeam,
    selectedSeason,
    currentRoster,
    guessedPlayers,
    incorrectGuesses,
    score,
    timerDuration,
    timeRemaining,
    hideResultsDuringGame,
    overrideGuess,
    resetGame,
  } = useGameStore();

  // Redirect if no game data
  useEffect(() => {
    if (!selectedTeam || !selectedSeason) navigate('/');
  }, [selectedTeam, selectedSeason, navigate]);

  if (!selectedTeam || !selectedSeason) return null;

  // --- CALCULATIONS ---
  const totalAttempts = guessedPlayers.length + incorrectGuesses.length;
  const accuracy = totalAttempts > 0 
    ? Math.round((guessedPlayers.length / totalAttempts) * 100) 
    : 0;
  const timeTaken = timerDuration - timeRemaining;
  const guessedIds = new Set(guessedPlayers.map((p) => p.id));

  // --- TRANSITION HANDLER ---
  const handleExit = () => {
    setIsExiting(true);
    setTimeout(() => {
      resetGame();
      navigate('/');
    }, 900); // Navigation triggers mid-sweep
  };

  return (
    <div className="h-screen bg-[#0d2a0b] text-white flex flex-col relative overflow-hidden font-sans p-6">
      
      {/* 1. DEALER SWEEP OVERLAY (High Performance) */}
      <AnimatePresence>
        {isExiting && (
          <div className="fixed inset-0 z-[100] pointer-events-none flex">
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                initial={{ x: '-110%', skewX: '-12deg' }}
                animate={{ x: '130%' }}
                transition={{ duration: 0.8, delay: i * 0.08, ease: [0.645, 0.045, 0.355, 1] }}
                className="absolute inset-y-0 w-full shadow-[30px_0_60px_rgba(0,0,0,0.6)] border-r border-white/10"
                style={{
                  background: i % 2 === 0 
                    ? `linear-gradient(90deg, ${selectedTeam.colors.primary}, ${selectedTeam.colors.secondary})`
                    : '#111',
                  left: `${i * 8}%`,
                  zIndex: 100 - i
                }}
              >
                <div className="absolute inset-0 opacity-10 flex items-center justify-center">
                   <span className="retro-title text-[20vh] rotate-90 select-none whitespace-nowrap uppercase">
                     {selectedTeam.abbreviation} • {selectedSeason}
                   </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* 2. BACKGROUND FELT */}
      <div 
        className="absolute inset-0 opacity-40 pointer-events-none" 
        style={{ 
          backgroundImage: `url("https://www.transparenttextures.com/patterns/felt.png")`,
          background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)` 
        }} 
      />

      {/* 3. MAIN UI INTERFACE */}
      <motion.div 
        animate={isExiting ? { opacity: 0, x: 80, filter: 'blur(10px)' } : { opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex flex-col h-full"
      >
        {/* HEADER */}
        <header className="flex justify-between items-end mb-6 border-b-2 border-white/10 pb-4">
          <div>
            <div className="sports-font text-[10px] tracking-[0.6em] text-white/30 uppercase">Vault Record // Settlement</div>
            <h1 className="retro-title text-6xl text-white uppercase leading-none">The Final Tab</h1>
          </div>
          <div className="flex flex-col items-end">
             <div className="bg-[#111] border border-white/20 px-4 py-1 mb-1 shadow-[4px_4px_0px_rgba(0,0,0,0.5)]">
               <span className="retro-title text-sm tracking-widest text-white/80">
                 {selectedTeam.abbreviation} • {selectedSeason}
               </span>
             </div>
             <div className="sports-font text-[9px] text-white/20 uppercase tracking-widest">Floor Manager Verified</div>
          </div>
        </header>

        {/* PIT DASHBOARD */}
        <main className="flex-1 grid grid-cols-12 gap-6 overflow-hidden min-h-0">
          
          {/* LEFT COLUMN: TOTALS & ACTION (3/12) */}
          <div className="col-span-3 flex flex-col gap-6 overflow-hidden">
            
            {/* STATS GRID */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'BANKED', value: score },
                { label: 'ACCURACY', value: `${accuracy}%` },
                { label: 'COLLECTED', value: `${guessedPlayers.length}/${currentRoster.length}` },
                { label: 'CLOCK', value: `${Math.floor(timeTaken / 60)}:${String(timeTaken % 60).padStart(2, '0')}` }
              ].map((stat) => (
                <div key={stat.label} className="bg-[#111] border border-white/5 p-4 rounded-sm shadow-xl relative overflow-hidden group">
                  <div className="absolute inset-0 opacity-5 pointer-events-none bg-[repeating-linear-gradient(90deg,transparent,transparent_2px,white_2px,white_3px)]" />
                  <div className="sports-font text-[8px] text-white/30 tracking-widest uppercase mb-1">{stat.label}</div>
                  <div className="retro-title text-2xl text-white">{stat.value}</div>
                </div>
              ))}
            </div>

            {/* MAIN ACTION BUTTON */}
            <button
              onClick={handleExit}
              disabled={isExiting}
              className="group relative bg-[#eee] py-10 rounded-sm overflow-hidden transition-all hover:bg-white active:translate-y-1 shadow-[0_8px_0_#999] active:shadow-none"
            >
              <div className="absolute inset-1 border border-black/10" />
              <span className="relative z-10 retro-title text-3xl text-black tracking-[0.2em] uppercase">Play Again</span>
              <div className="relative z-10 sports-font text-[9px] text-black/40 tracking-[0.4em] uppercase -mt-1">New Hand // Fresh Deck</div>
            </button>

            {/* DISCARD PILE */}
            <div className="flex-1 bg-black/50 border border-white/5 rounded-sm p-4 flex flex-col overflow-hidden relative">
              <h2 className="retro-title text-[10px] text-white/40 mb-4 tracking-widest uppercase flex justify-between">
                Dead Bets <span>// {incorrectGuesses.length}</span>
              </h2>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-wrap content-start gap-2">
                {incorrectGuesses.map((guess, index) => (
                  <motion.span
                    key={index}
                    draggable={hideResultsDuringGame}
                    onDragStart={() => setDraggedGuess(guess)}
                    onDragEnd={() => setDraggedGuess(null)}
                    className="px-2 py-1 bg-[#f0f0f0] text-black sports-font text-[10px] font-bold uppercase border-b-2 border-gray-400 shadow-md cursor-grab active:cursor-grabbing"
                  >
                    {guess}
                  </motion.span>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: PAYOUT TABLE (9/12) */}
          <div className="col-span-9 bg-black/70 border border-white/10 rounded-sm flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
              <span className="sports-font text-[9px] tracking-[0.5em] text-white/40 uppercase">Roster Ledger</span>
              <div className="flex gap-4">
                <span className="retro-title text-[10px] text-white/20 uppercase tracking-widest">Odds: 1:1</span>
                <span className="retro-title text-[10px] text-white/20 uppercase tracking-widest">Limit: No Limit</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="grid grid-cols-3 gap-3">
                {currentRoster.map((player) => {
                  const wasGuessed = guessedIds.has(player.id);
                  const isDragOver = dragOverPlayerId === player.id;
                  
                  const teamGradient = wasGuessed 
                    ? { background: `linear-gradient(135deg, ${selectedTeam.colors.primary}33 0%, ${selectedTeam.colors.secondary}33 100%)` }
                    : { background: 'transparent' };

                  return (
                    <div
                      key={player.id}
                      className={`relative p-4 border transition-all ${
                        wasGuessed ? 'border-white/20' : 'border-white/5 opacity-30 grayscale-[0.3]'
                      } ${isDragOver ? 'border-white bg-white/10 scale-[1.02] z-20 shadow-2xl' : ''}`}
                      style={teamGradient}
                      onDragOver={(e) => { e.preventDefault(); setDragOverPlayerId(player.id); }}
                      onDragLeave={() => setDragOverPlayerId(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedGuess && !wasGuessed) {
                          overrideGuess(draggedGuess, player.id as number);
                          setDraggedGuess(null);
                          setDragOverPlayerId(null);
                        }
                      }}
                    >
                      <div className="flex justify-between items-center relative z-10">
                        <div className="overflow-hidden">
                          <div className={`sports-font text-[8px] truncate ${wasGuessed ? 'text-white/50' : 'text-white/20'}`}>
                            #{player.number || '??'} // {player.position}
                          </div>
                          <div className={`retro-title text-base truncate ${wasGuessed ? 'text-white' : 'text-white/40'}`}>
                            {player.name}
                          </div>
                        </div>
                        {wasGuessed && (
                          <div className="bg-white text-black text-[7px] px-1 py-0.5 sports-font font-bold shadow-[2px_2px_0px_rgba(0,0,0,1)] flex-shrink-0">
                            FOUND
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      </motion.div>
    </div>
  );
}