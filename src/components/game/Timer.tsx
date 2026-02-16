/**
 * Timer.tsx — Circular countdown timer with SVG progress ring.
 *
 * Renders a ring that depletes as time runs out. The SVG is rotated -90deg
 * so the arc starts at 12 o'clock. strokeDashoffset is calculated as
 * circumference - (progress% * circumference) to animate the remaining arc.
 * Color shifts green → yellow (≤30s) → red (≤10s) with a pulse animation.
 */

import { motion } from 'framer-motion';

interface TimerProps {
  timeRemaining: number;
  totalTime: number;
}

export function Timer({ timeRemaining, totalTime }: TimerProps) {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const formattedTime = `${minutes}:${String(seconds).padStart(2, '0')}`;

  const progress = (timeRemaining / totalTime) * 100;
  const isLowTime = timeRemaining <= 30;
  const isCriticalTime = timeRemaining <= 10;

  const getColor = () => {
    if (isCriticalTime) return '#ef4444'; // red-500
    if (isLowTime) return '#eab308'; // yellow-500
    return '#22c55e'; // green-500
  };

  // Full circle perimeter at radius 40. strokeDashoffset subtracts the
  // "filled" portion so only the remaining arc is visible.
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <motion.div
      animate={isCriticalTime ? { scale: [1, 1.05, 1] } : {}}
      transition={{ repeat: Infinity, duration: 0.5 }}
      className="relative flex items-center justify-center"
    >
      <svg className="w-20 h-20 transform -rotate-90">
        {/* Background circle */}
        <circle
          cx="40"
          cy="40"
          r="40"
          fill="none"
          stroke="#374151"
          strokeWidth="6"
        />
        {/* Progress circle */}
        <circle
          cx="40"
          cy="40"
          r="40"
          fill="none"
          stroke={getColor()}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      <div
        className="absolute text-2xl font-mono font-bold"
        style={{ color: getColor() }}
      >
        {formattedTime}
      </div>
    </motion.div>
  );
}
