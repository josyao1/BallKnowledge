import { NBATeamLogo } from './NBATeamLogo';
import { getNBATeamColor, nbaSeasonStr, formatDate } from './boxScoreHelpers';
import {
  NBA_BOX_SCORE_GAME_TYPE_LABELS,
  type NBABoxScoreGame,
} from '../../services/nbaBoxScoreData';

interface Props {
  game: NBABoxScoreGame;
  compact?: boolean;
}

export function NBAScoreboard({ game, compact = false }: Props) {
  const homeColor = getNBATeamColor(game.home_team);
  const awayColor = getNBATeamColor(game.away_team);
  const gameLabel = NBA_BOX_SCORE_GAME_TYPE_LABELS[game.game_type] ?? game.game_type;

  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${awayColor}28 0%, #111 40%, #111 60%, ${homeColor}28 100%)`,
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div
        className={`absolute top-1/2 -translate-y-1/2 rounded-full blur-3xl pointer-events-none ${compact ? '-left-16 w-40 h-40' : '-left-20 w-52 h-52'}`}
        style={{ background: awayColor, opacity: 0.18 }}
      />
      <div
        className={`absolute top-1/2 -translate-y-1/2 rounded-full blur-3xl pointer-events-none ${compact ? '-right-16 w-40 h-40' : '-right-20 w-52 h-52'}`}
        style={{ background: homeColor, opacity: 0.18 }}
      />

      <div
        className={`relative flex items-center justify-between ${compact ? 'px-4 sm:px-8 py-5' : 'px-6 sm:px-12 py-7'}`}
      >
        {/* Away */}
        <div className={`flex flex-col items-center flex-1 ${compact ? 'gap-1.5' : 'gap-2'}`}>
          <NBATeamLogo
            abbr={game.away_team}
            className={
              compact
                ? 'w-14 h-14 sm:w-20 sm:h-20 object-contain'
                : 'w-16 h-16 sm:w-24 sm:h-24 object-contain'
            }
            imgStyle={compact ? undefined : { filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.5))' }}
          />
          <span
            className={`capcrunch-title leading-none ${compact ? 'text-xl sm:text-3xl' : 'text-2xl sm:text-4xl'}`}
            style={{
              color: awayColor,
              ...(compact ? {} : { textShadow: `0 0 30px ${awayColor}80` }),
            }}
          >
            {game.away_team}
          </span>
          <span
            className={`capcrunch-title text-white leading-none tabular-nums ${compact ? 'text-5xl sm:text-6xl' : 'text-6xl sm:text-7xl'}`}
            style={compact ? {} : { textShadow: '0 2px 20px rgba(0,0,0,0.8)' }}
          >
            {game.away_score}
          </span>
          <span
            className={`capcrunch-kicker text-[#666] uppercase ${compact ? 'text-[9px] tracking-widest' : 'text-[10px] tracking-[0.3em]'}`}
          >
            Away
          </span>
        </div>

        {/* Center */}
        <div
          className={`flex flex-col items-center ${compact ? 'gap-1.5 px-2' : 'gap-3 px-2 sm:px-6'}`}
        >
          {game.overtime && (
            <span
              className={`rounded-full capcrunch-kicker ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[10px] tracking-wider'}`}
              style={{
                background: 'rgba(253,241,0,0.15)',
                border: '1px solid rgba(253,241,0,0.4)',
                color: '#FDF100',
              }}
            >
              OT
            </span>
          )}
          <div
            className={`capcrunch-kicker text-[#444] tracking-[0.4em] ${compact ? 'text-[11px]' : 'text-[12px]'}`}
          >
            FINAL
          </div>
          {compact ? (
            <>
              <div className="capcrunch-kicker text-[9px] text-[#444]">
                {nbaSeasonStr(game.season)}
              </div>
              <div className="capcrunch-kicker text-[9px] text-[#555] text-center leading-tight">
                {gameLabel}
              </div>
            </>
          ) : (
            <>
              <div className="w-px h-10 bg-white/10" />
              <div className="capcrunch-kicker text-[11px] text-[#666] text-center">
                {gameLabel}
              </div>
            </>
          )}
        </div>

        {/* Home */}
        <div className={`flex flex-col items-center flex-1 ${compact ? 'gap-1.5' : 'gap-2'}`}>
          <NBATeamLogo
            abbr={game.home_team}
            className={
              compact
                ? 'w-14 h-14 sm:w-20 sm:h-20 object-contain'
                : 'w-16 h-16 sm:w-24 sm:h-24 object-contain'
            }
            imgStyle={compact ? undefined : { filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.5))' }}
          />
          <span
            className={`capcrunch-title leading-none ${compact ? 'text-xl sm:text-3xl' : 'text-2xl sm:text-4xl'}`}
            style={{
              color: homeColor,
              ...(compact ? {} : { textShadow: `0 0 30px ${homeColor}80` }),
            }}
          >
            {game.home_team}
          </span>
          <span
            className={`capcrunch-title text-white leading-none tabular-nums ${compact ? 'text-5xl sm:text-6xl' : 'text-6xl sm:text-7xl'}`}
            style={compact ? {} : { textShadow: '0 2px 20px rgba(0,0,0,0.8)' }}
          >
            {game.home_score}
          </span>
          <span
            className={`capcrunch-kicker text-[#666] uppercase ${compact ? 'text-[9px] tracking-widest' : 'text-[10px] tracking-[0.3em]'}`}
          >
            Home
          </span>
        </div>
      </div>

      {/* Game info chips — solo (non-compact) only */}
      {!compact && (
        <div className="relative border-t border-white/6 px-4 py-3 flex flex-wrap justify-center gap-2">
          <div className="flex flex-col items-center justify-center bg-white/4 py-1.5 px-3 min-w-[72px]">
            <span className="capcrunch-kicker text-[8px] text-[#555] tracking-widest uppercase">
              Season
            </span>
            <span className="capcrunch-title text-base text-white leading-tight">
              {nbaSeasonStr(game.season)}
            </span>
            <span className="capcrunch-kicker text-[9px] text-[#666]">
              {formatDate(game.game_date)}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center bg-white/4 py-1.5 px-3 min-w-[72px]">
            <span className="capcrunch-kicker text-[8px] text-[#555] tracking-widest uppercase">
              Type
            </span>
            <span className="capcrunch-kicker text-[11px] text-[#ccc] leading-tight text-center mt-0.5">
              {gameLabel}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
