/**
 * CareerBioPanel.tsx — Animated bio reveal panel for Career Arc.
 * Shared by CareerGamePage (solo) and MultiplayerCareerPage.
 */

import { motion, AnimatePresence } from 'framer-motion';

interface Bio {
  height?: string;
  weight?: number;
  school?: string;   // NBA field
  college?: string;  // NFL field — same concept as school, different key
  draftYear?: number;              // NBA: year drafted
  draftClub?: string;              // NFL: drafting team
  draftNumber?: number;            // NFL: overall pick number
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
          className="mb-4 bg-black/40 border border-white/10 p-4"
        >
          <div className="capcrunch-kicker text-[10px] text-[#888] tracking-widest mb-2 uppercase">Player Bio</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {bio.height && (
              <div>
                <div className="capcrunch-kicker text-[8px] text-[#666] tracking-wider">HEIGHT</div>
                <div className="capcrunch-kicker text-sm text-white/80">{bio.height}</div>
              </div>
            )}
            {(bio.weight ?? 0) > 0 && (
              <div>
                <div className="capcrunch-kicker text-[8px] text-[#666] tracking-wider">WEIGHT</div>
                <div className="capcrunch-kicker text-sm text-white/80">{bio.weight} lbs</div>
              </div>
            )}
            {(bio.school || bio.college) && (
              <div>
                <div className="capcrunch-kicker text-[8px] text-[#666] tracking-wider">SCHOOL</div>
                <div className="capcrunch-kicker text-sm text-white/80">{bio.school || bio.college}</div>
              </div>
            )}
            {bio.draftYear ? (
              <div>
                <div className="capcrunch-kicker text-[8px] text-[#666] tracking-wider">DRAFT</div>
                <div className="capcrunch-kicker text-sm text-white/80">{bio.draftYear}</div>
              </div>
            ) : bio.draftClub ? (
              <div>
                <div className="capcrunch-kicker text-[8px] text-[#666] tracking-wider">DRAFT</div>
                <div className="capcrunch-kicker text-sm text-white/80">
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
