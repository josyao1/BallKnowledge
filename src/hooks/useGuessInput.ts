import { useState, useRef, useCallback } from 'react';

export type FeedbackType = 'correct' | 'wrong' | '';

/**
 * Shared state for guess-input UIs across Career, Scramble, and Face Reveal.
 * Provides the controlled input value, feedback message/type, and an inputRef
 * for direct focus control. Utilities clear state on round transitions.
 */
export function useGuessInput() {
  const [guessInput, setGuessInput] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const clearFeedback = useCallback(() => {
    setFeedbackMsg('');
    setFeedbackType('');
  }, []);

  const clearInput = useCallback(() => {
    setGuessInput('');
    setFeedbackMsg('');
    setFeedbackType('');
  }, []);

  const focus = useCallback((delayMs = 50) => {
    setTimeout(() => inputRef.current?.focus(), delayMs);
  }, []);

  return {
    guessInput, setGuessInput,
    feedbackMsg, setFeedbackMsg,
    feedbackType, setFeedbackType,
    inputRef,
    clearFeedback,
    clearInput,
    focus,
  };
}
