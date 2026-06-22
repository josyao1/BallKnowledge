import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLobbyStore } from '../stores/lobbyStore';
import { useLobbySubscription } from './useLobbySubscription';
import { findLobbyByCode, getLobbyPlayers, resetMatchForPlayAgain } from '../services/lobby';

interface Options {
  code: string | undefined;
  defaultWinTarget?: number;
  // Career mode passes career_from; all other modes pass 0.
  includeCareerFrom?: boolean;
  // Extra career_state fields to preserve through the Play Again reset.
  // Receives the current cs object so values can be read at click time.
  extraPlayAgainState?: (cs: any) => Record<string, unknown>;
}

/**
 * Shared setup for all multiplayer results pages.
 *
 * Handles: lobby subscription, page-refresh reload, non-host follow-to-lobby
 * effect, Play Again, and Leave. Returns everything the results page needs to
 * render standings and drive the action buttons.
 */
export function useMultiplayerResults({
  code,
  defaultWinTarget = 3,
  includeCareerFrom = false,
  extraPlayAgainState,
}: Options) {
  const navigate = useNavigate();
  const { lobby, players, isHost, currentPlayerId, setLobby, setPlayers, leaveLobby } =
    useLobbyStore();
  const [isLeaving, setIsLeaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useLobbySubscription(lobby?.id || null);

  // Load lobby if not in store (page refresh).
  useEffect(() => {
    if (!code) {
      navigate('/');
      return;
    }
    if (lobby) return;
    findLobbyByCode(code).then((result) => {
      if (!result.lobby) {
        navigate('/');
        return;
      }
      setLobby(result.lobby);
      getLobbyPlayers(result.lobby.id).then((pr) => {
        if (pr.players) setPlayers(pr.players);
      });
    });
  }, []);

  // Non-host: follow when host triggers Play Again (status → 'waiting').
  useEffect(() => {
    if (!lobby || isHost) return;
    if (lobby.status === 'waiting') navigate(`/lobby/${code}`);
  }, [lobby?.status]);

  const sortedPlayers = [...players].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  const matchWinner = sortedPlayers[0];
  const isWinner = matchWinner?.player_id === currentPlayerId;

  const handlePlayAgain = async () => {
    if (!lobby || !isHost) return;
    setIsResetting(true);
    const cs = (lobby.career_state as any) || {};
    await resetMatchForPlayAgain(
      lobby.id,
      cs.win_target || defaultWinTarget,
      includeCareerFrom ? cs.career_from || 0 : 0,
      cs.career_to || 0,
      extraPlayAgainState ? extraPlayAgainState(cs) : undefined,
    );
    setLobby({ ...lobby, status: 'waiting' });
    navigate(`/lobby/${code}`);
  };

  const handleLeave = async () => {
    setIsLeaving(true);
    await leaveLobby();
    navigate('/');
  };

  return {
    lobby,
    players,
    isHost,
    currentPlayerId,
    sortedPlayers,
    matchWinner,
    isWinner,
    isLeaving,
    isResetting,
    handlePlayAgain,
    handleLeave,
  };
}
