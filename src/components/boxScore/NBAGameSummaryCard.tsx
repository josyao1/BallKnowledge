import { getNBATeamColor, nbaSeasonStr, formatDate } from './boxScoreHelpers';
import { NBA_BOX_SCORE_GAME_TYPE_LABELS, type NBABoxScoreGame } from '../../services/nbaBoxScoreData';

interface Props {
  game: NBABoxScoreGame;
}

export function NBAGameSummaryCard({ game }: Props) {
  const homeColor = getNBATeamColor(game.home_team);
  const awayColor = getNBATeamColor(game.away_team);
  const gameLabel = NBA_BOX_SCORE_GAME_TYPE_LABELS[game.game_type] ?? game.game_type;

  return (
    <div className="capcrunch-panel overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex flex-col items-center gap-1">
          <div className="capcrunch-title text-2xl sm:text-3xl leading-none" style={{ color: awayColor }}>{game.away_team}</div>
          <div className="capcrunch-title text-4xl sm:text-5xl text-white leading-none tabular-nums">{game.away_score}</div>
          <div className="sports-font text-[9px] text-[#444] tracking-widest mt-0.5">AWAY</div>
        </div>
        <div className="flex flex-col items-center gap-1.5 px-3">
          {game.overtime && (
            <span className="px-2 py-0.5 bg-amber-900/30 border border-amber-700/40 rounded sports-font text-[9px] text-amber-500 tracking-wider">OT</span>
          )}
          <div className="sports-font text-[10px] text-[#333] tracking-[0.3em]">FINAL</div>
          <div className="sports-font text-[10px] text-[#444] text-center leading-snug">{gameLabel}</div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="capcrunch-title text-2xl sm:text-3xl leading-none" style={{ color: homeColor }}>{game.home_team}</div>
          <div className="capcrunch-title text-4xl sm:text-5xl text-white leading-none tabular-nums">{game.home_score}</div>
          <div className="sports-font text-[9px] text-[#444] tracking-widest mt-0.5">HOME</div>
        </div>
      </div>
      <div className="border-t border-white/8 px-4 py-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
        <span className="sports-font text-[10px] text-[#3a3a3a]">{nbaSeasonStr(game.season)}</span>
        <span className="sports-font text-[10px] text-[#2e2e2e]">· {formatDate(game.game_date)}</span>
      </div>
    </div>
  );
}
