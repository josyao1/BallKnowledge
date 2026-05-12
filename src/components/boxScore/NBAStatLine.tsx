import type { NBABoxScorePlayer } from '../../services/nbaBoxScoreData';

export interface StatLeaders {
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
}

export function computeLeaders(players: NBABoxScorePlayer[]): StatLeaders {
  return {
    pts: Math.max(...players.map(p => p.pts)),
    reb: Math.max(...players.map(p => p.reb)),
    ast: Math.max(...players.map(p => p.ast)),
    stl: Math.max(...players.map(p => p.stl)),
    blk: Math.max(...players.map(p => p.blk)),
  };
}

interface Props {
  player: NBABoxScorePlayer;
  leaders: StatLeaders;
}

export function NBAStatLine({ player: p, leaders }: Props) {
  return (
    <span className="sports-font text-[11px] tabular-nums">
      <span className="font-semibold" style={{ color: p.pts > 0 && p.pts === leaders.pts ? '#f59e0b' : '#ccc' }}>{p.pts}pts</span>
      {' '}<span style={{ color: p.reb > 0 && p.reb === leaders.reb ? '#f59e0b' : '#888' }}>{p.reb}reb</span>
      {' '}<span style={{ color: p.ast > 0 && p.ast === leaders.ast ? '#f59e0b' : '#888' }}>{p.ast}ast</span>
      {p.stl > 0 && <span style={{ color: p.stl === leaders.stl ? '#f59e0b' : '#666' }}> {p.stl}stl</span>}
      {p.blk > 0 && <span style={{ color: p.blk === leaders.blk ? '#f59e0b' : '#666' }}> {p.blk}blk</span>}
    </span>
  );
}
