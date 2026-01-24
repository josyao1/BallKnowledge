import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface ServerWarmupProps {
  sport: 'nba' | 'nfl';
  onReady: () => void;
  onSkip: () => void;
}

export function ServerWarmup({ sport, onReady, onSkip }: ServerWarmupProps) {
  const [status, setStatus] = useState<'checking' | 'warming' | 'ready' | 'offline'>('checking');
  const [attempts, setAttempts] = useState(0);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const API_URL = sport === 'nba'
    ? (import.meta.env.VITE_API_URL || 'http://localhost:8000')
    : (import.meta.env.VITE_NFL_API_URL || 'http://localhost:8001');

  const healthEndpoint = sport === 'nba' ? '/health' : '/nfl/health';

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval>;

    const checkServer = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${API_URL}${healthEndpoint}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok && !cancelled) {
          setStatus('ready');
          setTimeout(onReady, 500);
          return true;
        }
      } catch {
        // Server not ready yet
      }
      return false;
    };

    const warmupLoop = async () => {
      // First quick check
      const isReady = await checkServer();
      if (isReady || cancelled) return;

      // Server is cold - start warming
      setStatus('warming');

      // Start elapsed time counter
      timer = setInterval(() => {
        if (!cancelled) {
          setSecondsElapsed(s => s + 1);
        }
      }, 1000);

      // Retry every 5 seconds for up to 60 seconds
      for (let i = 0; i < 12; i++) {
        if (cancelled) break;

        await new Promise(resolve => setTimeout(resolve, 5000));
        setAttempts(i + 1);

        const ready = await checkServer();
        if (ready || cancelled) break;
      }

      if (!cancelled && status !== 'ready') {
        setStatus('offline');
      }
    };

    warmupLoop();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [API_URL, healthEndpoint, onReady]);

  if (status === 'checking') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      >
        <div className="text-center p-8">
          <div className="w-8 h-8 border-2 border-[var(--nba-orange)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--vintage-cream)] sports-font">Checking servers...</p>
        </div>
      </motion.div>
    );
  }

  if (status === 'ready') {
    return (
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      >
        <div className="text-center p-8">
          <div className="text-4xl mb-4">✓</div>
          <p className="text-[#22c55e] sports-font">Servers ready!</p>
        </div>
      </motion.div>
    );
  }

  if (status === 'offline') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      >
        <div className="bg-[#1a1a1a] rounded-xl p-8 max-w-md text-center border-2 border-[#333]">
          <div className="text-4xl mb-4">😴</div>
          <h2 className="text-xl font-bold text-[var(--vintage-cream)] mb-2">
            Servers Unavailable
          </h2>
          <p className="text-[#888] mb-6">
            The {sport.toUpperCase()} server couldn't be reached. You can play in offline mode with limited rosters, or try again later.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#333] text-[var(--vintage-cream)] rounded-lg hover:bg-[#444] transition-colors"
            >
              Retry
            </button>
            <button
              onClick={onSkip}
              className="px-4 py-2 bg-[var(--nba-orange)] text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Continue Offline
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Warming state
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
    >
      <div className="bg-[#1a1a1a] rounded-xl p-8 max-w-md text-center border-2 border-[#333]">
        <div className="text-4xl mb-4">☕</div>
        <h2 className="text-xl font-bold text-[var(--vintage-cream)] mb-2">
          Waking Up Servers
        </h2>
        <p className="text-[#888] mb-4">
          Free tier servers sleep when inactive. Give it a moment to warm up...
        </p>

        {/* Progress indicator */}
        <div className="mb-4">
          <div className="h-2 bg-[#333] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[var(--nba-orange)]"
              initial={{ width: '0%' }}
              animate={{ width: `${Math.min((secondsElapsed / 50) * 100, 95)}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className="text-xs text-[#666] mt-2">
            {secondsElapsed}s elapsed • Attempt {attempts + 1}/12
          </p>
        </div>

        <p className="text-xs text-[#555] mb-4">
          Usually takes 30-50 seconds on first visit
        </p>

        <button
          onClick={onSkip}
          className="text-sm text-[#666] hover:text-[#888] transition-colors"
        >
          Skip and play offline →
        </button>
      </div>
    </motion.div>
  );
}
