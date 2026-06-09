import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  feedback: { msg: string; type: 'correct' | 'wrong' | '' };
}

export function FeedbackMessage({ feedback }: Props) {
  return (
    <div className="h-5 flex items-center justify-center">
      <AnimatePresence mode="wait">
        {feedback.type && (
          <motion.p
            key={feedback.msg}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`capcrunch-kicker text-xs tracking-wider ${feedback.type === 'correct' ? 'text-[#70BE5B]' : 'text-[#E2008A]'}`}
          >
            {feedback.msg}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
