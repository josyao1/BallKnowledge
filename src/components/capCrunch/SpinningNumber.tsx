import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function computeStep(diff: number): number {
  if (diff <= 1) return 1;
  const raw = diff / 4;
  // Prevent decimal steps for small integer diffs (raw < 1 → log10 goes negative)
  if (raw < 1) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const normalized = raw / magnitude;
  let nice: number;
  if (normalized < 1.5) nice = magnitude;
  else if (normalized < 3.5) nice = 2 * magnitude;
  else if (normalized < 7.5) nice = 5 * magnitude;
  else nice = 10 * magnitude;
  return Math.max(1, nice);
}

function fmtNum(val: number): string {
  const r = parseFloat(val.toFixed(1));
  return r % 1 === 0 ? r.toFixed(0) : r.toFixed(1);
}

interface SpinningNumberProps {
  value: string;
  /** Non-color Tailwind classes (font, size, etc.) */
  className: string;
  /** Current text color as a hex string */
  color: string;
  /** Increment this to trigger a red flash (bust / zero pick) */
  flashKey?: number;
}

/**
 * Rolls through intermediate values like an odometer when the number changes.
 * Flashes red when flashKey increments (bust or zero-stat pick).
 */
export function SpinningNumber({ value, className, color, flashKey }: SpinningNumberProps) {
  const targetNum = parseFloat(value);
  const [displayed, setDisplayed] = useState(value);
  const prevNumRef = useRef(targetNum);
  const increasingRef = useRef(true);

  // Count through intermediate values
  useEffect(() => {
    const from = prevNumRef.current;
    const to = targetNum;
    prevNumRef.current = to;

    if (from === to || isNaN(from) || isNaN(to)) {
      setDisplayed(value);
      return;
    }

    const diff = Math.abs(to - from);
    const step = computeStep(diff);
    const direction = to > from ? 1 : -1;
    increasingRef.current = direction > 0;

    const sequence: number[] = [];
    let cur = from + direction * step;
    while (direction > 0 ? cur < to : cur > to) {
      sequence.push(cur);
      cur += direction * step;
    }
    sequence.push(to);

    let i = 0;
    const id = setInterval(() => {
      setDisplayed(fmtNum(sequence[i]));
      i++;
      if (i >= sequence.length) clearInterval(id);
    }, 110);

    return () => clearInterval(id);
  }, [targetNum]);

  // Flash red on bust / zero pick
  const [activeColor, setActiveColor] = useState(color);
  const prevFlashKey = useRef<number | undefined>(undefined);
  // Ref so the timeout always reads the latest base color, avoiding stale closures
  const colorRef = useRef(color);
  const flashingRef = useRef(false);

  useEffect(() => { colorRef.current = color; });

  useEffect(() => {
    if (flashKey === undefined || flashKey === prevFlashKey.current) return;
    prevFlashKey.current = flashKey;
    flashingRef.current = true;
    setActiveColor('#ef4444');
    const id = setTimeout(() => {
      flashingRef.current = false;
      setActiveColor(colorRef.current);
    }, 550);
    return () => clearTimeout(id);
  }, [flashKey]);

  // Keep color in sync when the base color changes (e.g. approaching cap)
  useEffect(() => {
    if (flashingRef.current) return;
    setActiveColor(color);
  }, [color]);

  const enterY = increasingRef.current ? '70%' : '-70%';
  const exitY = increasingRef.current ? '-70%' : '70%';

  return (
    <motion.div
      className={`relative overflow-hidden leading-none ${className}`}
      animate={{ color: activeColor }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={{ display: 'inline-block' }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={displayed}
          initial={{ y: enterY, opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: exitY, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          style={{ display: 'block' }}
        >
          {displayed}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
}

// Hex color values (used for animated color transitions)
export function getTotalColor(total: number, cap: number): string {
  if (total <= 0) return '#ffffff';
  const ratio = total / cap;
  if (ratio >= 1) return '#f87171';    // red-400
  if (ratio >= 0.95) return '#34d399'; // emerald-400
  if (ratio >= 0.85) return '#fb923c'; // orange-400
  if (ratio >= 0.7) return '#facc15';  // yellow-400
  return '#ffffff';
}

export function getRemainingColor(total: number, cap: number): string {
  const ratio = total / cap;
  if (ratio >= 1) return '#f87171';
  if (ratio >= 0.95) return '#34d399';
  if (ratio >= 0.85) return '#fb923c';
  if (ratio >= 0.7) return '#facc15';
  return '#d4af37';
}
