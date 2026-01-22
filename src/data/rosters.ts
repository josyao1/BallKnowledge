import type { Player } from '../types';

/**
 * NBA Roster Data
 *
 * This file contains sample roster data for development and testing.
 * For full data, run the Python extraction script:
 *   cd scripts && pip install -r requirements.txt && python extract_rosters.py
 *
 * The extraction script will generate rosters.json and players.json files
 * which can be used to replace this sample data.
 */

// Sample roster data - includes several iconic team-seasons for development
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
    '2015-16': [
      { id: 201939, name: 'Stephen Curry', position: 'G', number: '30', ppg: 30.1, isLowScorer: false },
      { id: 203110, name: 'Klay Thompson', position: 'G', number: '11', ppg: 22.1, isLowScorer: false },
      { id: 203084, name: 'Draymond Green', position: 'F', number: '23', ppg: 14.0, isLowScorer: false },
      { id: 201575, name: 'Harrison Barnes', position: 'F', number: '40', ppg: 11.7, isLowScorer: false },
      { id: 201583, name: 'Andrew Bogut', position: 'C', number: '12', ppg: 5.4, isLowScorer: true },
      { id: 2585, name: 'Andre Iguodala', position: 'F', number: '9', ppg: 7.0, isLowScorer: true },
      { id: 2571, name: 'Shaun Livingston', position: 'G', number: '34', ppg: 6.3, isLowScorer: true },
      { id: 2733, name: 'Marreese Speights', position: 'F-C', number: '5', ppg: 7.1, isLowScorer: true },
      { id: 203105, name: 'Festus Ezeli', position: 'C', number: '31', ppg: 7.0, isLowScorer: true },
      { id: 203894, name: 'Leandro Barbosa', position: 'G', number: '19', ppg: 6.4, isLowScorer: true },
      { id: 2738, name: 'Brandon Rush', position: 'G-F', number: '4', ppg: 4.2, isLowScorer: true },
      { id: 203546, name: 'Ian Clark', position: 'G', number: '21', ppg: 3.6, isLowScorer: true },
      { id: 1627739, name: 'James Michael McAdoo', position: 'F', number: '20', ppg: 2.9, isLowScorer: true },
      { id: 203949, name: 'Kevon Looney', position: 'F', number: '5', ppg: 1.5, isLowScorer: true },
      { id: 203546, name: 'Jason Thompson', position: 'F-C', number: '1', ppg: 2.7, isLowScorer: true },
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
      { id: 289, name: 'Randy Brown', position: 'G', number: '1', ppg: 2.4, isLowScorer: true },
      { id: 1395, name: 'James Edwards', position: 'C', number: '53', ppg: 3.5, isLowScorer: true },
      { id: 376, name: 'Jason Caffey', position: 'F', number: '44', ppg: 3.2, isLowScorer: true },
      { id: 1727, name: 'John Salley', position: 'F-C', number: '22', ppg: 1.6, isLowScorer: true },
      { id: 773, name: 'Jack Haley', position: 'C', number: '54', ppg: 0.6, isLowScorer: true },
    ],
  },
  BOS: {
    '2023-24': [
      { id: 1628369, name: 'Jayson Tatum', position: 'F', number: '0', ppg: 26.9, isLowScorer: false },
      { id: 203935, name: 'Jaylen Brown', position: 'G-F', number: '7', ppg: 23.0, isLowScorer: false },
      { id: 1629750, name: 'Kristaps Porzingis', position: 'C-F', number: '8', ppg: 20.1, isLowScorer: false },
      { id: 1628400, name: 'Derrick White', position: 'G', number: '9', ppg: 15.2, isLowScorer: false },
      { id: 1630202, name: 'Jrue Holiday', position: 'G', number: '4', ppg: 12.5, isLowScorer: false },
      { id: 201143, name: 'Al Horford', position: 'C', number: '42', ppg: 8.6, isLowScorer: true },
      { id: 1630202, name: 'Payton Pritchard', position: 'G', number: '11', ppg: 9.6, isLowScorer: true },
      { id: 1630174, name: 'Sam Hauser', position: 'F', number: '30', ppg: 9.0, isLowScorer: true },
      { id: 1630539, name: 'Luke Kornet', position: 'C', number: '40', ppg: 5.4, isLowScorer: true },
      { id: 1629059, name: 'Oshae Brissett', position: 'F', number: '12', ppg: 3.0, isLowScorer: true },
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
      { id: 2617, name: 'Udonis Haslem', position: 'F-C', number: '40', ppg: 3.9, isLowScorer: true },
      { id: 201228, name: 'Chris Andersen', position: 'C', number: '11', ppg: 5.1, isLowScorer: true },
      { id: 200829, name: 'Mike Miller', position: 'G-F', number: '13', ppg: 5.8, isLowScorer: true },
      { id: 101141, name: 'James Jones', position: 'F', number: '22', ppg: 4.1, isLowScorer: true },
      { id: 200813, name: 'Rashard Lewis', position: 'F', number: '9', ppg: 4.5, isLowScorer: true },
      { id: 202708, name: 'Norris Cole', position: 'G', number: '30', ppg: 4.0, isLowScorer: true },
      { id: 2546, name: 'Joel Anthony', position: 'C', number: '50', ppg: 1.3, isLowScorer: true },
      { id: 1084, name: 'Juwan Howard', position: 'F', number: '5', ppg: 1.1, isLowScorer: true },
      { id: 202697, name: 'Jarvis Varnado', position: 'F', number: '24', ppg: 0.6, isLowScorer: true },
    ],
  },
  DEN: {
    '2022-23': [
      { id: 203999, name: 'Nikola Jokic', position: 'C', number: '15', ppg: 24.5, isLowScorer: false },
      { id: 203914, name: 'Jamal Murray', position: 'G', number: '27', ppg: 20.0, isLowScorer: false },
      { id: 1628381, name: 'Aaron Gordon', position: 'F', number: '50', ppg: 16.3, isLowScorer: false },
      { id: 1629008, name: 'Michael Porter Jr.', position: 'F', number: '1', ppg: 17.4, isLowScorer: false },
      { id: 1628407, name: 'Kentavious Caldwell-Pope', position: 'G', number: '5', ppg: 10.8, isLowScorer: false },
      { id: 201573, name: 'Jeff Green', position: 'F', number: '32', ppg: 7.6, isLowScorer: true },
      { id: 1629611, name: 'Bruce Brown', position: 'G-F', number: '11', ppg: 11.5, isLowScorer: false },
      { id: 1630277, name: 'Christian Braun', position: 'G', number: '0', ppg: 4.7, isLowScorer: true },
      { id: 1629651, name: 'Reggie Jackson', position: 'G', number: '7', ppg: 10.2, isLowScorer: false },
      { id: 1628466, name: 'Thomas Bryant', position: 'C', number: '31', ppg: 4.5, isLowScorer: true },
      { id: 1630539, name: 'Peyton Watson', position: 'F', number: '8', ppg: 2.9, isLowScorer: true },
      { id: 203486, name: 'DeAndre Jordan', position: 'C', number: '6', ppg: 3.8, isLowScorer: true },
      { id: 203918, name: 'Ish Smith', position: 'G', number: '14', ppg: 3.2, isLowScorer: true },
      { id: 1629723, name: 'Vlatko Cancar', position: 'F', number: '31', ppg: 3.1, isLowScorer: true },
      { id: 1629744, name: 'Zeke Nnaji', position: 'F-C', number: '22', ppg: 3.3, isLowScorer: true },
    ],
  },
  MIL: {
    '2020-21': [
      { id: 203507, name: 'Giannis Antetokounmpo', position: 'F', number: '34', ppg: 28.1, isLowScorer: false },
      { id: 203114, name: 'Khris Middleton', position: 'F', number: '22', ppg: 20.4, isLowScorer: false },
      { id: 1630202, name: 'Jrue Holiday', position: 'G', number: '21', ppg: 17.7, isLowScorer: false },
      { id: 201572, name: 'Brook Lopez', position: 'C', number: '11', ppg: 12.3, isLowScorer: false },
      { id: 202083, name: 'Bobby Portis', position: 'F-C', number: '9', ppg: 11.4, isLowScorer: false },
      { id: 1627853, name: 'Donte DiVincenzo', position: 'G', number: '0', ppg: 10.4, isLowScorer: false },
      { id: 201228, name: 'Pat Connaughton', position: 'G', number: '24', ppg: 5.7, isLowScorer: true },
      { id: 101139, name: 'P.J. Tucker', position: 'F', number: '17', ppg: 2.9, isLowScorer: true },
      { id: 1629731, name: 'Bryn Forbes', position: 'G', number: '7', ppg: 5.8, isLowScorer: true },
      { id: 203900, name: 'Jeff Teague', position: 'G', number: '5', ppg: 3.8, isLowScorer: true },
      { id: 1628035, name: 'Sam Merrill', position: 'G', number: '25', ppg: 2.0, isLowScorer: true },
      { id: 1629216, name: 'Thanasis Antetokounmpo', position: 'F', number: '43', ppg: 2.0, isLowScorer: true },
      { id: 203546, name: 'Axel Toupane', position: 'G-F', number: '66', ppg: 1.7, isLowScorer: true },
      { id: 1629660, name: 'Jordan Nwora', position: 'F', number: '13', ppg: 5.4, isLowScorer: true },
      { id: 203546, name: 'Mamadi Diakite', position: 'F-C', number: '25', ppg: 1.3, isLowScorer: true },
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

// Get available seasons across all teams
export function getAvailableSeasons(): string[] {
  const seasons = new Set<string>();

  Object.values(rosters).forEach((teamSeasons) => {
    Object.keys(teamSeasons).forEach((season) => seasons.add(season));
  });

  return Array.from(seasons).sort().reverse();
}

// Get teams that have data for a specific season
export function getTeamsWithSeason(season: string): string[] {
  return Object.entries(rosters)
    .filter(([_, seasons]) => season in seasons)
    .map(([abbr]) => abbr);
}
