/**
 * CareerBioPanel.tsx — Animated bio reveal panel for Career Arc.
 * Shared by CareerGamePage (solo) and MultiplayerCareerPage.
 */

import { motion, AnimatePresence } from 'framer-motion';

interface Bio {
  height?: string;
  weight?: number;
  school?: string;
  college?: string;
  draftYear?: number;
  draftClub?: string;
  draftNumber?: number;
}

interface Props {
  bio: Bio | null;
  revealed: boolean;
}

export function CareerBioPanel({ bio, revealed }: Props) {
  return (
    <AnimatePresence>
      {revealed && bio && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-4 bg-[#1a1a1a] border border-[#333] rounded-lg p-4"
        >
          <div className="sports-font text-[10px] text-[#888] tracking-widest mb-2 uppercase">Player Bio</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {bio.height && (
              <div>
                <div className="sports-font text-[8px] text-[#666] tracking-wider">HEIGHT</div>
                <div className="sports-font text-sm text-[var(--vintage-cream)]">{bio.height}</div>
              </div>
            )}
            {(bio.weight ?? 0) > 0 && (
              <div>
                <div className="sports-font text-[8px] text-[#666] tracking-wider">WEIGHT</div>
                <div className="sports-font text-sm text-[var(--vintage-cream)]">{bio.weight} lbs</div>
              </div>
            )}
            {(bio.school || bio.college) && (
              <div>
                <div className="sports-font text-[8px] text-[#666] tracking-wider">SCHOOL</div>
                <div className="sports-font text-sm text-[var(--vintage-cream)]">{bio.school || bio.college}</div>
              </div>
            )}
            {bio.draftYear ? (
              <div>
                <div className="sports-font text-[8px] text-[#666] tracking-wider">DRAFT</div>
                <div className="sports-font text-sm text-[var(--vintage-cream)]">{bio.draftYear}</div>
              </div>
            ) : bio.draftClub ? (
              <div>
                <div className="sports-font text-[8px] text-[#666] tracking-wider">DRAFT</div>
                <div className="sports-font text-sm text-[var(--vintage-cream)]">
                  {bio.draftClub} #{bio.draftNumber}
                </div>
              </div>
            ) : null}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
