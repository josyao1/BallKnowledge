import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  size?: 'sm' | 'lg';
}

export function WildcardRoundCard({ size = 'sm' }: Props) {
  const [showPanel, setShowPanel] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, rotateY: -90 }}
      animate={{ opacity: 1, rotateY: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      style={{ perspective: 600 }}
      className={`relative rounded border-2 bg-black border-transparent ${
        size === 'lg' ? 'px-8 md:px-12 py-2 md:py-3' : 'px-5 py-2'
      }`}
    >
      {/* Rainbow border via gradient outline */}
      <div
        className="absolute inset-0 rounded"
        style={{
          background: 'linear-gradient(135deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7, #ef4444)',
          zIndex: -1,
          margin: '-2px',
          borderRadius: 'inherit',
        }}
      />
      <div className="absolute inset-[2px] bg-black rounded" style={{ zIndex: -1 }} />

      <p
        className={`sports-font tracking-widest uppercase leading-none mb-0.5 opacity-60 ${size === 'lg' ? 'text-[8px] md:text-[10px]' : 'text-[8px]'}`}
        style={{
          background: 'linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Free Pick
      </p>
      <p
        className={`retro-title font-bold leading-none ${size === 'lg' ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'}`}
        style={{
          background: 'linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        WILDCARD
      </p>

      <button
        onClick={e => { e.stopPropagation(); setShowPanel(v => !v); }}
        className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full border border-white/30 text-white/40 text-[8px] flex items-center justify-center hover:border-white/60 hover:text-white/70 transition-colors"
      >
        ?
      </button>

      {createPortal(
        <AnimatePresence>
          {showPanel && (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-40 bg-black/50"
                onClick={() => setShowPanel(false)}
              />
              <motion.div
                key="panel"
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(400px,90vw)] bg-[#0d0d0d] rounded-lg shadow-[0_0_40px_rgba(168,85,247,0.2)] p-5"
                style={{ border: '2px solid transparent', backgroundClip: 'padding-box' }}
              >
                <div
                  className="absolute inset-0 rounded-lg"
                  style={{
                    background: 'linear-gradient(135deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7)',
                    zIndex: -1,
                    margin: '-2px',
                    borderRadius: 'inherit',
                  }}
                />
                <div className="absolute inset-[2px] bg-[#0d0d0d] rounded-lg" style={{ zIndex: -1 }} />
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="sports-font text-[8px] text-white/40 tracking-widest uppercase leading-none mb-0.5">Free Pick</p>
                    <p
                      className="retro-title text-sm"
                      style={{
                        background: 'linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      WILDCARD
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPanel(false)}
                    className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none"
                  >
                    ✕
                  </button>
                </div>
                <p className="sports-font text-[10px] text-white/60 leading-relaxed">
                  Pick anything! No team, conference, or name constraints — any player, any season counts.
                </p>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </motion.div>
  );
}
