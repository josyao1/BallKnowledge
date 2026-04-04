import { useState, useEffect } from 'react';
import { SpinningNumber } from './SpinningNumber';

interface RevealingScoreProps {
  /** The real final score to land on */
  value: string;
  /** Milliseconds to wait before starting the count-up */
  delay: number;
  className: string;
  color: string;
}

/**
 * Shows "0" on mount, then after `delay` ms starts counting up to `value`
 * via SpinningNumber. Used in results screens for the dramatic score reveal.
 */
export function RevealingScore({ value, delay, className, color }: RevealingScoreProps) {
  const [displayed, setDisplayed] = useState('0');

  useEffect(() => {
    const id = setTimeout(() => setDisplayed(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return <SpinningNumber value={displayed} className={className} color={color} />;
}
