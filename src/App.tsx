/**
 * App.tsx — Top-level router configuration.
 *
 * Maps URL paths to page components for solo gameplay (/game, /results),
 * multiplayer lobby flow (/lobby/*), and the home page (/).
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { GamePage } from './pages/GamePage';
import { ResultsPage } from './pages/ResultsPage';
import { LobbyCreatePage } from './pages/LobbyCreatePage';
import { LobbyJoinPage } from './pages/LobbyJoinPage';
import { LobbyWaitingPage } from './pages/LobbyWaitingPage';
import { MultiplayerResultsPage } from './pages/MultiplayerResultsPage';
import { RollCallCreatePage } from './pages/RollCallCreatePage';
import { RollCallSessionPage } from './pages/RollCallSessionPage';
import { RollCallResultsPage } from './pages/RollCallResultsPage';
import { CareerGamePage } from './pages/CareerGamePage';
import { CareerResultsPage } from './pages/CareerResultsPage';
import { MultiplayerCareerPage } from './pages/MultiplayerCareerPage';
import { MultiplayerCareerResultsPage } from './pages/MultiplayerCareerResultsPage';
import { MultiplayerNameScramblePage } from './pages/MultiplayerNameScramblePage';
import { MultiplayerNameScrambleResultsPage } from './pages/MultiplayerNameScrambleResultsPage';
import { SoloScramblePage } from './pages/SoloScramblePage';
import { SoloLineupIsRightPage } from './pages/SoloLineupIsRightPage';
import { MultiplayerLineupIsRightPage } from './pages/MultiplayerLineupIsRightPage';
import { MultiplayerLineupIsRightResultsPage } from './pages/MultiplayerLineupIsRightResultsPage';

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
        <Route path="/lineup-is-right" element={<SoloLineupIsRightPage />} />
        {/* Name Scramble routes */}
        <Route path="/lobby/:code/scramble" element={<MultiplayerNameScramblePage />} />
        <Route path="/lobby/:code/scramble/results" element={<MultiplayerNameScrambleResultsPage />} />
        {/* Lineup Is Right routes */}
        <Route path="/lobby/:code/lineup-is-right" element={<MultiplayerLineupIsRightPage />} />
        <Route path="/lobby/:code/lineup-is-right/results" element={<MultiplayerLineupIsRightResultsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
