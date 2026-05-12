import { areSimilarNames } from '../../utils/fuzzyDedup';
import { cleanJersey } from './boxScoreHelpers';
import { NBAStatLine, computeLeaders } from './NBAStatLine';
import type { NBABoxScorePlayer } from '../../services/nbaBoxScoreData';

function ResultName({ name, guessed, correct }: { name: string; guessed: string; correct: boolean }) {
  return (
    <div className={`flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border sports-font text-sm font-semibold truncate ${
      correct
        ? 'bg-green-900/25 border-green-700/50 text-green-300'
        : 'bg-red-950/30 border-red-900/40 text-red-400/80'
    }`}>
      {name}
      {!correct && guessed && (
        <span className="ml-2 font-normal text-[#444] line-through text-[10px]">{guessed}</span>
      )}
    </div>
  );
}

interface Props {
  player: NBABoxScorePlayer;
  guessed: string;
  teamColor?: string;
  leaders?: ReturnType<typeof computeLeaders>;
  getters?: string[];
}

export function NBAPlayerResultRow({ player, guessed, teamColor = '#4a4a4a', leaders, getters }: Props) {
  const correct = !!guessed && areSimilarNames(guessed, player.name);
  const jersey = cleanJersey(player.number);
  return (
    <div className="flex items-start gap-2 py-1">
      <div
        className="shrink-0 w-9 h-7 flex items-center justify-center rounded-md sports-font text-[11px] font-bold tabular-nums mt-0.5"
        style={{ background: `${teamColor}30`, color: teamColor, border: `1px solid ${teamColor}50` }}
      >
        {jersey ? `#${jersey}` : '—'}
      </div>
      <div className="flex-1 min-w-0">
        <ResultName name={player.name} guessed={guessed} correct={correct} />
        {getters && getters.length > 0 && (
          <div className="pl-1 mt-0.5 sports-font text-[9px] text-green-600/70">{getters.join(' · ')}</div>
        )}
      </div>
      <div className="shrink-0 text-right mt-1" style={{ minWidth: 96 }}>
        {leaders
          ? <NBAStatLine player={player} leaders={leaders} />
          : (
            <span className="sports-font text-[11px] tabular-nums text-[#555]">
              {player.pts}pts · {player.reb}reb · {player.ast}ast
              {player.stl > 0 ? ` · ${player.stl}stl` : ''}
              {player.blk > 0 ? ` · ${player.blk}blk` : ''}
            </span>
          )
        }
      </div>
    </div>
  );
}
