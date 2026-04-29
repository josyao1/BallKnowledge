/**
 * useGameAbandonment — shared Send-to-Lobby behaviour for multiplayer game pages.
 *
 * Encapsulates two responsibilities:
 *   1. Non-host clients watch career_state.abandoned via realtime and hard-reload
 *      to the lobby waiting room when the host clicks "Send to Lobby".
 *   2. handleEndGame (called by the host's HomeButton) merges abandoned: true into
 *      career_state, sets lobby status back to 'waiting', then hard-reloads.
 *
 * Hard reload is intentional — it fully clears stale Zustand state and any
 * in-flight realtime subscriptions so the waiting room always mounts fresh.
 *
 * Usage:
 *   const { handleEndGame } = useGameAbandonment({ code, lobbyId: lobby?.id, careerState, isHost });
 *   // Pass handleEndGame to <HomeButton onEndGame={handleEndGame} />
 */

import { useEffect } from 'react';
import { updateCareerState, updateLobbyStatus } from '../services/lobby';

interface Options {
  code: string | undefined;
  lobbyId: string | null | undefined;
  /**
   * The current career_state object. Merged (not replaced) when writing
   * abandoned: true so that game settings are preserved for the waiting room.
   */
  careerState: Record<string, unknown> | null | undefined;
  isHost: boolean;
}

export function useGameAbandonment({ code, lobbyId, careerState, isHost }: Options) {
  // Non-host: detect abandoned flag from realtime and hard-reload to lobby.
  // Host skips — it navigates explicitly inside handleEndGame after the DB
  // writes complete, preventing a double-navigate race.
  useEffect(() => {
    if (isHost) return;
    if ((careerState as { abandoned?: boolean } | null | undefined)?.abandoned) {
      window.location.href = `/lobby/${code}`;
    }
  }, [(careerState as { abandoned?: boolean } | null | undefined)?.abandoned, isHost, code]);

  async function handleEndGame() {
    if (!lobbyId || !code) return;
    // Spread into existing state — never replace with bare { abandoned: true }
    // so game settings (sport, timer, win_target, etc.) survive for the waiting room.
    const updatedState = { ...(careerState ?? {}), abandoned: true };
    await updateCareerState(lobbyId, updatedState);
    await updateLobbyStatus(lobbyId, 'waiting');
    window.location.href = `/lobby/${code}`;
  }

  return { handleEndGame };
}
