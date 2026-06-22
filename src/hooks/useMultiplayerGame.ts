import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLobbyStore } from '../stores/lobbyStore';
import { useLobbySubscription } from './useLobbySubscription';
import { findLobbyByCode, getLobbyPlayers } from '../services/lobby';

interface Options {
  code: string | undefined;
}

/**
 * Shared setup for multiplayer game pages.
 *
 * Handles: lobby store destructuring, real-time subscription,
 * and load-on-mount (page refresh recovery). If the lobby is in
 * a non-playing state (waiting, finished) the user is redirected
 * to the lobby waiting room which then handles status-based routing.
 */
export function useMultiplayerGame({ code }: Options) {
  const navigate = useNavigate();
  const { lobby, players, isHost, currentPlayerId, setLobby, setPlayers } = useLobbyStore();

  useLobbySubscription(lobby?.id || null);

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
      // If the game is over or not started, let the lobby waiting page handle routing.
      if (result.lobby.status !== 'playing') {
        navigate(`/lobby/${code}`);
        return;
      }
      setLobby(result.lobby);
      getLobbyPlayers(result.lobby.id).then((pr) => {
        if (pr.players) setPlayers(pr.players);
      });
    });
  }, []);

  return { lobby, players, isHost, currentPlayerId, setLobby, setPlayers };
}
