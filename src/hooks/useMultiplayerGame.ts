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
 * and load-on-mount (page refresh recovery).
 */
export function useMultiplayerGame({ code }: Options) {
  const navigate = useNavigate();
  const { lobby, players, isHost, currentPlayerId, setLobby, setPlayers } = useLobbyStore();

  useLobbySubscription(lobby?.id || null);

  useEffect(() => {
    if (!code) { navigate('/'); return; }
    if (lobby) return;
    findLobbyByCode(code).then(result => {
      if (!result.lobby) { navigate('/'); return; }
      setLobby(result.lobby);
      getLobbyPlayers(result.lobby.id).then(pr => {
        if (pr.players) setPlayers(pr.players);
      });
    });
  }, []);

  return { lobby, players, isHost, currentPlayerId, setLobby, setPlayers };
}
