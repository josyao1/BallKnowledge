import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import { Leaderboard } from '../components/leaderboard';
import { submitScore } from '../services/leaderboard';
import { isSupabaseEnabled } from '../lib/supabase';

export function ResultsPage() {
  const navigate = useNavigate();
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    selectedTeam,
    selectedSeason,
    currentRoster,
    guessedPlayers,
    incorrectGuesses,
    score,
    timerDuration,
    timeRemaining,
    resetGame,
  } = useGameStore();

  const percentage = currentRoster.length > 0
    ? Math.round((guessedPlayers.length / currentRoster.length) * 100)
    : 0;
  const timeTaken = timerDuration - timeRemaining;

  // Redirect if no game data
  useEffect(() => {
    if (!selectedTeam || !selectedSeason) {
      navigate('/');
    }
  }, [selectedTeam, selectedSeason, navigate]);

  // Auto-submit score when results page loads
  useEffect(() => {
    async function autoSubmitScore() {
      if (!isSupabaseEnabled || scoreSubmitted || !selectedTeam || !selectedSeason) {
        return;
      }

      setSubmitting(true);
      const result = await submitScore({
        team_abbreviation: selectedTeam.abbreviation,
        season: selectedSeason,
        score,
        percentage,
        guessed_players: guessedPlayers.map(p => p.name),
        incorrect_guesses: incorrectGuesses,
        time_remaining: timeRemaining,
      });

      if (result.success) {
        setScoreSubmitted(true);
      }
      setSubmitting(false);
    }

    autoSubmitScore();
  }, [selectedTeam, selectedSeason, score, percentage, guessedPlayers, incorrectGuesses, timeRemaining, scoreSubmitted]);

  if (!selectedTeam || !selectedSeason) {
    return null;
  }

  // Create a set of guessed player IDs for quick lookup
  const guessedIds = new Set(guessedPlayers.map((p) => p.id));

  const handlePlayAgain = () => {
    resetGame();
    navigate('/');
  };

  // Team color CSS variables
  const teamColorStyles = {
    '--team-primary': selectedTeam.colors.primary,
    '--team-secondary': selectedTeam.colors.secondary,
  } as React.CSSProperties;

  return (
    <div className="min-h-screen" style={teamColorStyles}>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1
            className="retro-title text-5xl md:text-6xl mb-2"
            style={{ color: selectedTeam.colors.primary }}
          >
            Final Score
          </h1>
          <div
            className="team-badge inline-flex"
            style={{
              background: `linear-gradient(135deg, ${selectedTeam.colors.primary} 0%, ${selectedTeam.colors.secondary} 100%)`,
            }}
          >
            {selectedTeam.abbreviation} {selectedSeason}
          </div>
        </motion.div>

        {/* Score summary - Scoreboard style */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="scoreboard-panel p-6 mb-8"
          style={{ borderColor: `${selectedTeam.colors.primary}50` }}
        >
          <div className="grid grid-cols-3 gap-4">
            <div className="stat-display">
              <div className="stat-value" style={{ color: selectedTeam.colors.secondary }}>{score}</div>
              <div className="stat-label">Points</div>
            </div>
            <div className="stat-display">
              <div className="stat-value" style={{ color: selectedTeam.colors.primary }}>{percentage}%</div>
              <div className="stat-label">Completed</div>
            </div>
            <div className="stat-display">
              <div className="stat-value">
                {guessedPlayers.length}/{currentRoster.length}
              </div>
              <div className="stat-label">Found</div>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <div
              className="scoreboard-number text-2xl px-4 py-2 rounded-lg"
              style={{ backgroundColor: `${selectedTeam.colors.primary}20` }}
            >
              Time: {Math.floor(timeTaken / 60)}:{String(timeTaken % 60).padStart(2, '0')}
            </div>
          </div>
        </motion.div>

        {/* Incorrect guesses */}
        {incorrectGuesses.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="vintage-card p-4 mb-8"
          >
            <h2 className="sports-font text-lg text-[var(--nba-red)] mb-3 tracking-wider">
              Incorrect Guesses
            </h2>
            <div className="flex flex-wrap gap-2">
              {incorrectGuesses.map((guess, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-[var(--nba-red)]/20 text-[var(--nba-red)] border border-[var(--nba-red)]/30 rounded-full text-sm"
                >
                  {guess}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Full roster reveal */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="vintage-card p-4 mb-8"
          style={{ borderColor: `${selectedTeam.colors.primary}30` }}
        >
          <h2 className="sports-font text-lg mb-4 tracking-wider" style={{ color: selectedTeam.colors.secondary }}>
            Full Roster
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {currentRoster.map((player, index) => {
              const wasGuessed = guessedIds.has(player.id);
              return (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + index * 0.03 }}
                  className="player-card p-3"
                  style={{
                    borderColor: wasGuessed ? selectedTeam.colors.primary : undefined,
                    backgroundColor: wasGuessed ? `${selectedTeam.colors.primary}15` : undefined,
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div
                        className="font-medium"
                        style={{ color: wasGuessed ? selectedTeam.colors.secondary : '#aaa' }}
                      >
                        {player.name}
                      </div>
                      <div className="text-sm text-[#666]">
                        {player.position} {player.number && `#${player.number}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-[#888]">{player.ppg.toFixed(1)} PPG</div>
                    </div>
                  </div>
                  {wasGuessed && (
                    <div className="mt-1">
                      <span
                        className="text-xs sports-font tracking-wider"
                        style={{ color: selectedTeam.colors.primary }}
                      >
                        Found!
                      </span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Leaderboard */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mb-8"
        >
          <Leaderboard
            teamAbbreviation={selectedTeam.abbreviation}
            season={selectedSeason}
            title="High Scores"
          />
          {submitting && (
            <p className="text-center text-[#666] text-sm mt-2 sports-font">
              Submitting your score...
            </p>
          )}
          {scoreSubmitted && (
            <p className="text-center text-[#22c55e] text-sm mt-2 sports-font">
              Score submitted to leaderboard!
            </p>
          )}
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="flex justify-center gap-4"
        >
          <button
            onClick={handlePlayAgain}
            className="px-12 py-4 text-lg rounded-lg font-bold sports-font tracking-wider transition-all hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${selectedTeam.colors.primary}, ${selectedTeam.colors.secondary})`,
              color: '#fff',
              boxShadow: `0 4px 15px ${selectedTeam.colors.primary}50`,
            }}
          >
            Play Again
          </button>
        </motion.div>
      </div>
    </div>
  );
}
