import type { Player } from '../types';

// Sample roster data - this will be replaced by extracted data from nba_api
// Format: { [teamAbbreviation]: { [season]: Player[] } }
export const rosters: Record<string, Record<string, Player[]>> = {
  LAL: {
    '2023-24': [
      { id: 2544, name: 'LeBron James', position: 'F', number: '23', ppg: 25.7, isLowScorer: false },
      { id: 203076, name: 'Anthony Davis', position: 'F-C', number: '3', ppg: 24.7, isLowScorer: false },
      { id: 203471, name: "D'Angelo Russell", position: 'G', number: '1', ppg: 18.0, isLowScorer: false },
      { id: 1629216, name: 'Rui Hachimura', position: 'F', number: '28', ppg: 13.6, isLowScorer: false },
      { id: 1628366, name: 'Austin Reaves', position: 'G', number: '15', ppg: 15.9, isLowScorer: false },
      { id: 1630559, name: 'Jaxson Hayes', position: 'C', number: '10', ppg: 4.3, isLowScorer: true },
      { id: 1629655, name: 'Taurean Prince', position: 'F', number: '12', ppg: 7.5, isLowScorer: true },
      { id: 203915, name: 'Gabe Vincent', position: 'G', number: '7', ppg: 3.6, isLowScorer: true },
      { id: 1629004, name: 'Jarred Vanderbilt', position: 'F', number: '2', ppg: 5.1, isLowScorer: true },
      { id: 1630541, name: 'Cam Reddish', position: 'G-F', number: '5', ppg: 3.0, isLowScorer: true },
      { id: 1630596, name: 'Max Christie', position: 'G', number: '22', ppg: 3.1, isLowScorer: true },
      { id: 1630644, name: 'Christian Wood', position: 'F-C', number: '35', ppg: 6.9, isLowScorer: true },
      { id: 1631171, name: 'Jalen Hood-Schifino', position: 'G', number: '0', ppg: 3.8, isLowScorer: true },
      { id: 1631227, name: 'Maxwell Lewis', position: 'F', number: '21', ppg: 2.1, isLowScorer: true },
      { id: 1630260, name: 'Spencer Dinwiddie', position: 'G', number: '26', ppg: 6.8, isLowScorer: true },
    ],
    '2019-20': [
      { id: 2544, name: 'LeBron James', position: 'F', number: '23', ppg: 25.3, isLowScorer: false },
      { id: 203076, name: 'Anthony Davis', position: 'F-C', number: '3', ppg: 26.1, isLowScorer: false },
      { id: 201566, name: 'Kyle Kuzma', position: 'F', number: '0', ppg: 12.8, isLowScorer: false },
      { id: 1627936, name: 'Danny Green', position: 'G-F', number: '14', ppg: 8.0, isLowScorer: true },
      { id: 201580, name: 'JaVale McGee', position: 'C', number: '7', ppg: 6.6, isLowScorer: true },
      { id: 2594, name: 'Dwight Howard', position: 'C', number: '39', ppg: 7.5, isLowScorer: true },
      { id: 201599, name: 'Kentavious Caldwell-Pope', position: 'G', number: '1', ppg: 9.3, isLowScorer: true },
      { id: 203484, name: 'Avery Bradley', position: 'G', number: '11', ppg: 8.6, isLowScorer: true },
      { id: 101150, name: 'Rajon Rondo', position: 'G', number: '9', ppg: 7.1, isLowScorer: true },
      { id: 1627814, name: 'Alex Caruso', position: 'G', number: '4', ppg: 5.5, isLowScorer: true },
      { id: 202711, name: 'Quinn Cook', position: 'G', number: '2', ppg: 5.1, isLowScorer: true },
      { id: 203901, name: 'Markieff Morris', position: 'F', number: '88', ppg: 4.4, isLowScorer: true },
      { id: 201571, name: 'Jared Dudley', position: 'F', number: '10', ppg: 1.2, isLowScorer: true },
      { id: 1629060, name: 'Troy Daniels', position: 'G', number: '30', ppg: 3.3, isLowScorer: true },
      { id: 1629667, name: 'Talen Horton-Tucker', position: 'G', number: '5', ppg: 5.7, isLowScorer: true },
    ],
  },
  GSW: {
    '2021-22': [
      { id: 201939, name: 'Stephen Curry', position: 'G', number: '30', ppg: 25.5, isLowScorer: false },
      { id: 203110, name: 'Klay Thompson', position: 'G', number: '11', ppg: 20.4, isLowScorer: false },
      { id: 203084, name: 'Draymond Green', position: 'F', number: '23', ppg: 7.5, isLowScorer: true },
      { id: 203952, name: 'Andrew Wiggins', position: 'F', number: '22', ppg: 17.2, isLowScorer: false },
      { id: 1629684, name: 'Jordan Poole', position: 'G', number: '3', ppg: 18.5, isLowScorer: false },
      { id: 1626172, name: 'Kevon Looney', position: 'C', number: '5', ppg: 6.0, isLowScorer: true },
      { id: 1630228, name: 'Jonathan Kuminga', position: 'F', number: '00', ppg: 9.3, isLowScorer: true },
      { id: 1630532, name: 'Moses Moody', position: 'G', number: '4', ppg: 4.4, isLowScorer: true },
      { id: 1628380, name: 'Gary Payton II', position: 'G', number: '0', ppg: 7.1, isLowScorer: true },
      { id: 201600, name: 'Otto Porter Jr.', position: 'F', number: '32', ppg: 8.2, isLowScorer: true },
      { id: 2585, name: 'Andre Iguodala', position: 'F', number: '9', ppg: 4.0, isLowScorer: true },
      { id: 1628415, name: 'Juan Toscano-Anderson', position: 'F', number: '95', ppg: 4.1, isLowScorer: true },
      { id: 1629718, name: 'Damion Lee', position: 'G', number: '1', ppg: 7.4, isLowScorer: true },
      { id: 203546, name: 'Nemanja Bjelica', position: 'F', number: '8', ppg: 6.1, isLowScorer: true },
      { id: 1630267, name: 'Chris Chiozza', position: 'G', number: '2', ppg: 2.0, isLowScorer: true },
    ],
  },
  CHI: {
    '1995-96': [
      { id: 893, name: 'Michael Jordan', position: 'G', number: '23', ppg: 30.4, isLowScorer: false },
      { id: 1717, name: 'Scottie Pippen', position: 'F', number: '33', ppg: 19.4, isLowScorer: false },
      { id: 1697, name: 'Dennis Rodman', position: 'F', number: '91', ppg: 5.5, isLowScorer: true },
      { id: 947, name: 'Toni Kukoc', position: 'F', number: '7', ppg: 13.1, isLowScorer: false },
      { id: 1106, name: 'Luc Longley', position: 'C', number: '13', ppg: 9.1, isLowScorer: true },
      { id: 910, name: 'Steve Kerr', position: 'G', number: '25', ppg: 8.4, isLowScorer: true },
      { id: 786, name: 'Ron Harper', position: 'G', number: '9', ppg: 7.4, isLowScorer: true },
      { id: 1103, name: 'Bill Wennington', position: 'C', number: '34', ppg: 5.3, isLowScorer: true },
      { id: 353, name: 'Jud Buechler', position: 'F', number: '30', ppg: 2.7, isLowScorer: true },
      { id: 1780, name: 'Dickey Simpkins', position: 'F', number: '8', ppg: 2.6, isLowScorer: true },
      { id: 1780, name: 'Randy Brown', position: 'G', number: '1', ppg: 2.4, isLowScorer: true },
      { id: 1395, name: 'James Edwards', position: 'C', number: '53', ppg: 3.5, isLowScorer: true },
      { id: 1780, name: 'Jason Caffey', position: 'F', number: '44', ppg: 3.2, isLowScorer: true },
      { id: 1780, name: 'John Salley', position: 'F-C', number: '22', ppg: 1.6, isLowScorer: true },
      { id: 1780, name: 'Jack Haley', position: 'C', number: '54', ppg: 0.6, isLowScorer: true },
    ],
  },
  BOS: {
    '2023-24': [
      { id: 1628369, name: 'Jayson Tatum', position: 'F', number: '0', ppg: 26.9, isLowScorer: false },
      { id: 203935, name: 'Jaylen Brown', position: 'G-F', number: '7', ppg: 23.0, isLowScorer: false },
      { id: 1629750, name: 'Kristaps Porzingis', position: 'C-F', number: '8', ppg: 20.1, isLowScorer: false },
      { id: 1628400, name: 'Derrick White', position: 'G', number: '9', ppg: 15.2, isLowScorer: false },
      { id: 1630202, name: 'Jrue Holiday', position: 'G', number: '4', ppg: 12.5, isLowScorer: false },
      { id: 1629057, name: 'Al Horford', position: 'C', number: '42', ppg: 8.6, isLowScorer: true },
      { id: 1631194, name: 'Payton Pritchard', position: 'G', number: '11', ppg: 9.6, isLowScorer: true },
      { id: 1630174, name: 'Sam Hauser', position: 'F', number: '30', ppg: 9.0, isLowScorer: true },
      { id: 1630539, name: 'Luke Kornet', position: 'C', number: '40', ppg: 5.4, isLowScorer: true },
      { id: 1630559, name: 'Oshae Brissett', position: 'F', number: '12', ppg: 3.0, isLowScorer: true },
      { id: 1629714, name: 'Neemias Queta', position: 'C', number: '88', ppg: 3.4, isLowScorer: true },
      { id: 1631257, name: 'Jordan Walsh', position: 'F', number: '27', ppg: 1.6, isLowScorer: true },
      { id: 1631206, name: 'Lamar Stevens', position: 'F', number: '20', ppg: 3.5, isLowScorer: true },
      { id: 1631298, name: 'JD Davison', position: 'G', number: '45', ppg: 1.5, isLowScorer: true },
      { id: 1630224, name: 'Xavier Tillman', position: 'F-C', number: '26', ppg: 4.2, isLowScorer: true },
    ],
  },
  MIA: {
    '2012-13': [
      { id: 2544, name: 'LeBron James', position: 'F', number: '6', ppg: 26.8, isLowScorer: false },
      { id: 201142, name: 'Dwyane Wade', position: 'G', number: '3', ppg: 21.2, isLowScorer: false },
      { id: 201566, name: 'Chris Bosh', position: 'F-C', number: '1', ppg: 16.6, isLowScorer: false },
      { id: 2037, name: 'Ray Allen', position: 'G', number: '34', ppg: 10.9, isLowScorer: false },
      { id: 201609, name: 'Mario Chalmers', position: 'G', number: '15', ppg: 8.6, isLowScorer: true },
      { id: 2617, name: 'Shane Battier', position: 'F', number: '31', ppg: 5.4, isLowScorer: true },
      { id: 201600, name: 'Udonis Haslem', position: 'F-C', number: '40', ppg: 3.9, isLowScorer: true },
      { id: 201228, name: 'Chris Andersen', position: 'C', number: '11', ppg: 5.1, isLowScorer: true },
      { id: 200829, name: 'Mike Miller', position: 'G-F', number: '13', ppg: 5.8, isLowScorer: true },
      { id: 101141, name: 'James Jones', position: 'F', number: '22', ppg: 4.1, isLowScorer: true },
      { id: 200813, name: 'Rashard Lewis', position: 'F', number: '9', ppg: 4.5, isLowScorer: true },
      { id: 1630559, name: 'Norris Cole', position: 'G', number: '30', ppg: 4.0, isLowScorer: true },
      { id: 1630559, name: 'Joel Anthony', position: 'C', number: '50', ppg: 1.3, isLowScorer: true },
      { id: 1630559, name: 'Juwan Howard', position: 'F', number: '5', ppg: 1.1, isLowScorer: true },
      { id: 1630559, name: 'Jarvis Varnado', position: 'F', number: '24', ppg: 0.6, isLowScorer: true },
    ],
  },
};

// Get all unique player names for autocomplete
export function getAllPlayers(): { id: number; name: string }[] {
  const playerMap = new Map<string, { id: number; name: string }>();

  Object.values(rosters).forEach((seasons) => {
    Object.values(seasons).forEach((players) => {
      players.forEach((player) => {
        if (!playerMap.has(player.name)) {
          playerMap.set(player.name, { id: player.id, name: player.name });
        }
      });
    });
  });

  return Array.from(playerMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}
