import { Row, Chips, Chip } from './SettingsHelpers';

interface Props {
  startingSport: 'nba' | 'nfl';
  onStartingSportChange: (s: 'nba' | 'nfl') => void;
  winTarget: number;
  onWinTargetChange: (n: number) => void;
}

export function StartingLineupSettings({ startingSport, onStartingSportChange, winTarget, onWinTargetChange }: Props) {
  return (
    <div className="space-y-2.5">
      <Row label="Sport">
        <Chips>
          <Chip active={startingSport === 'nba'} activeBg="#f15a29" activeText="#fff"
            onClick={() => onStartingSportChange('nba')}>NBA</Chip>
          <Chip active={startingSport === 'nfl'} activeBg="#013369" activeText="#fff"
            onClick={() => onStartingSportChange('nfl')}>NFL</Chip>
        </Chips>
      </Row>

      <Row label="First To">
        <Chips>
          {[10, 20, 30].map(n => (
            <Chip key={n} active={winTarget === n} activeBg="#16a34a" activeText="#fff"
              onClick={() => onWinTargetChange(n)}>
              {n}
            </Chip>
          ))}
        </Chips>
      </Row>
    </div>
  );
}
