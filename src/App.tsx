/**
 * App.tsx — Top-level router configuration.
 *
 * Maps URL paths to page components for solo gameplay (/game, /results),
 * multiplayer lobby flow (/lobby/*), and the home page (/).
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { GamePage }             from './pages/roster/GamePage';
import { ResultsPage }          from './pages/roster/ResultsPage';
import { MultiplayerResultsPage } from './pages/roster/MultiplayerResultsPage';
import { LobbyCreatePage }      from './pages/lobby/LobbyCreatePage';
import { LobbyJoinPage }        from './pages/lobby/LobbyJoinPage';
import { LobbyWaitingPage }     from './pages/lobby/LobbyWaitingPage';
import { RollCallCreatePage }   from './pages/rollcall/RollCallCreatePage';
import { RollCallSessionPage }  from './pages/rollcall/RollCallSessionPage';
import { RollCallResultsPage }  from './pages/rollcall/RollCallResultsPage';
import { CareerGamePage }                from './pages/career/CareerGamePage';
import { CareerResultsPage }             from './pages/career/CareerResultsPage';
import { MultiplayerCareerPage }         from './pages/career/MultiplayerCareerPage';
import { MultiplayerCareerResultsPage }  from './pages/career/MultiplayerCareerResultsPage';
import { SoloScramblePage }                    from './pages/scramble/SoloScramblePage';
import { MultiplayerNameScramblePage }         from './pages/scramble/MultiplayerNameScramblePage';
import { MultiplayerNameScrambleResultsPage }  from './pages/scramble/MultiplayerNameScrambleResultsPage';
import { SoloCapCrunchPage }               from './pages/capCrunch/SoloCapCrunchPage';
import { MultiplayerCapCrunchPage }        from './pages/capCrunch/MultiplayerCapCrunchPage';
import { MultiplayerCapCrunchResultsPage } from './pages/capCrunch/MultiplayerCapCrunchResultsPage';
import { BoxScoreGamePage }                from './pages/boxScore/BoxScoreGamePage';
import { BoxScoreResultsPage }             from './pages/boxScore/BoxScoreResultsPage';
import { MultiplayerBoxScorePage }         from './pages/boxScore/MultiplayerBoxScorePage';
import { MultiplayerBoxScoreResultsPage }  from './pages/boxScore/MultiplayerBoxScoreResultsPage';
import { SoloStartingLineupPage }                   from './pages/startingLineup/SoloStartingLineupPage';
import { MultiplayerStartingLineupPage }            from './pages/startingLineup/MultiplayerStartingLineupPage';
import { MultiplayerStartingLineupResultsPage }     from './pages/startingLineup/MultiplayerStartingLineupResultsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/results" element={<ResultsPage />} />
        {/* Multiplayer routes */}
        <Route path="/lobby/create" element={<LobbyCreatePage />} />
        <Route path="/lobby/join" element={<LobbyJoinPage />} />
        <Route path="/lobby/join/:code" element={<LobbyJoinPage />} />
        <Route path="/lobby/:code" element={<LobbyWaitingPage />} />
        <Route path="/lobby/:code/results" element={<MultiplayerResultsPage />} />
        {/* Roll Call routes */}
        <Route path="/roll-call/create" element={<RollCallCreatePage />} />
        <Route path="/roll-call/join" element={<LobbyJoinPage />} />
        <Route path="/roll-call/join/:code" element={<LobbyJoinPage />} />
        <Route path="/roll-call/:code" element={<RollCallSessionPage />} />
        <Route path="/roll-call/:code/results" element={<RollCallResultsPage />} />
        {/* Career Mode routes */}
        <Route path="/career" element={<CareerGamePage />} />
        <Route path="/career/results" element={<CareerResultsPage />} />
        {/* Multiplayer Career routes */}
        <Route path="/lobby/:code/career" element={<MultiplayerCareerPage />} />
        <Route path="/lobby/:code/career/results" element={<MultiplayerCareerResultsPage />} />
        {/* Solo Scramble */}
        <Route path="/scramble" element={<SoloScramblePage />} />
        {/* Solo Lineup Is Right */}
        <Route path="/lineup-is-right" element={<SoloCapCrunchPage />} />
        {/* Name Scramble routes */}
        <Route path="/lobby/:code/scramble" element={<MultiplayerNameScramblePage />} />
        <Route path="/lobby/:code/scramble/results" element={<MultiplayerNameScrambleResultsPage />} />
        {/* Cap Crunch routes */}
        <Route path="/lobby/:code/lineup-is-right" element={<MultiplayerCapCrunchPage />} />
        <Route path="/lobby/:code/lineup-is-right/results" element={<MultiplayerCapCrunchResultsPage />} />
        {/* Box Score routes */}
        <Route path="/box-score" element={<BoxScoreGamePage />} />
        <Route path="/box-score/results" element={<BoxScoreResultsPage />} />
        <Route path="/lobby/:code/box-score" element={<MultiplayerBoxScorePage />} />
        <Route path="/lobby/:code/box-score/results" element={<MultiplayerBoxScoreResultsPage />} />
        {/* Starting Lineup routes */}
        <Route path="/starting-lineup" element={<SoloStartingLineupPage />} />
        <Route path="/lobby/:code/starting-lineup" element={<MultiplayerStartingLineupPage />} />
        <Route path="/lobby/:code/starting-lineup/results" element={<MultiplayerStartingLineupResultsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
