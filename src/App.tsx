import { useCallback, useEffect, useRef, useState } from 'react';
import { ClientGameState, ClientVinteUmState, GameKind } from './game/types';
import { LobbyScreen } from './components/LobbyScreen';
import { GameTable } from './components/GameTable';
import { VinteUmTable } from './components/VinteUmTable';
import { PacienciaTable } from './components/PacienciaTable';
import { playTone } from './utils/sound';

type AnyRemoteState = ClientGameState | ClientVinteUmState;

function getOrCreatePlayerId(): string {
  const key = 'truco_player_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

export default function App() {
  const [playerId] = useState<string>(() => getOrCreatePlayerId());
  const [playerName, setPlayerName] = useState<string>(
    () => localStorage.getItem('truco_player_name') || ''
  );

  const initialParams = new URLSearchParams(window.location.search);
  const initialRoomCode = (initialParams.get('sala') || '').toUpperCase().slice(0, 6);

  const [remoteState, setRemoteState] = useState<AnyRemoteState | null>(null);
  const [pacienciaActive, setPacienciaActive] = useState(false);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [volume, setVolume] = useState<number>(40);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const activeRoomRef = useRef<{ roomCode: string; name: string } | null>(null);
  const pendingActionRef = useRef<Record<string, unknown> | null>(null);
  const prevStateRef = useRef<AnyRemoteState | null>(null);
  const isChatOpenRef = useRef(isChatOpen);
  const volumeRef = useRef(volume);

  isChatOpenRef.current = isChatOpen;
  volumeRef.current = volume;

  useEffect(() => {
    if (pacienciaActive) {
      document.body.dataset.state = 'playing';
    } else if (!remoteState) {
      document.body.dataset.state = 'title';
    } else if (remoteState.gameKind === 'truco' && remoteState.phase === 'MATCH_OVER') {
      document.body.dataset.state = 'gameover';
    } else {
      document.body.dataset.state = 'playing';
    }
  }, [remoteState, pacienciaActive]);

  const sendWs = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    let disposed = false;
    let reconnectTimer: number | null = null;
    let pingTimer: number | null = null;
    let attempt = 0;

    const connect = () => {
      if (disposed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) {
          ws.close();
          return;
        }
        attempt = 0;
        setIsConnected(true);
        setIsConnecting(false);

        if (pendingActionRef.current) {
          ws.send(JSON.stringify(pendingActionRef.current));
          pendingActionRef.current = null;
        } else if (activeRoomRef.current) {
          ws.send(
            JSON.stringify({
              type: 'room:join',
              playerId,
              playerName: activeRoomRef.current.name,
              roomCode: activeRoomRef.current.roomCode,
            })
          );
        }

        pingTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        let msg: { type: string; state?: AnyRemoteState; message?: string };
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === 'error') {
          setIsConnecting(false);
          setError(msg.message || 'Ocorreu um erro.');
          return;
        }

        if (msg.type === 'state:sync' && msg.state) {
          const next = msg.state;
          const prev = prevStateRef.current;

          activeRoomRef.current = {
            roomCode: next.roomCode,
            name: next.players.find((p) => p.id === next.myId)?.name || 'Jogador',
          };

          const url = new URL(window.location.href);
          if (url.searchParams.get('sala') !== next.roomCode) {
            url.searchParams.set('sala', next.roomCode);
            window.history.replaceState({}, '', url.toString());
          }

          if (prev) {
            if (next.gameKind === 'truco' && prev.gameKind === 'truco') {
              if (
                next.tableCards.length > prev.tableCards.length ||
                next.previousRoundCards.length > prev.previousRoundCards.length
              ) {
                playTone('card', volumeRef.current);
              }
              if (
                next.phase === 'TRUCO_CHALLENGE' &&
                (prev.phase !== 'TRUCO_CHALLENGE' ||
                  next.challenge?.proposedBet !== prev.challenge?.proposedBet)
              ) {
                playTone('truco', volumeRef.current);
              }
              if (next.phase === 'MATCH_OVER' && prev.phase !== 'MATCH_OVER') {
                playTone('win', volumeRef.current);
              }
            }

            if (next.chat.length > prev.chat.length) {
              const newMsgs = next.chat.slice(prev.chat.length);
              const incomingUserMsgs = newMsgs.filter(
                (m) => !m.isSystem && m.senderId !== next.myId
              );
              if (incomingUserMsgs.length > 0) {
                playTone('chat', volumeRef.current);
                if (!isChatOpenRef.current) {
                  setUnreadChatCount((c) => c + incomingUserMsgs.length);
                }
              }
            }
          }

          prevStateRef.current = next;
          setError(null);
          setIsConnecting(false);
          setRemoteState(next);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = null;
        }
        if (!disposed) {
          const delay = Math.min(3000, 500 * Math.pow(1.5, attempt));
          attempt += 1;
          reconnectTimer = window.setTimeout(connect, delay);
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      wsRef.current?.close();
    };
  }, [playerId]);

  const handlePlaySolo = useCallback(
    (gameKind: GameKind, name: string) => {
      localStorage.setItem('truco_player_name', name);
      setPlayerName(name);
      setError(null);

      if (gameKind === 'paciencia') {
        setPacienciaActive(true);
        return;
      }

      setIsConnecting(true);
      const payload = {
        type: 'room:create',
        playerId,
        playerName: name,
        gameKind,
        solo: true,
      };
      if (!sendWs(payload)) {
        pendingActionRef.current = payload;
      }
    },
    [playerId, sendWs]
  );

  const handleCreateRoom = useCallback(
    (gameKind: 'truco' | 'vinteum', name: string, maxPlayers: 2 | 4 | 6) => {
      localStorage.setItem('truco_player_name', name);
      setPlayerName(name);
      setError(null);
      setIsConnecting(true);
      const payload = {
        type: 'room:create',
        playerId,
        playerName: name,
        gameKind,
        maxPlayers,
        solo: false,
      };
      if (!sendWs(payload)) {
        pendingActionRef.current = payload;
      }
    },
    [playerId, sendWs]
  );

  const handleJoinRoom = useCallback(
    (name: string, roomCode: string) => {
      localStorage.setItem('truco_player_name', name);
      setPlayerName(name);
      setError(null);
      setIsConnecting(true);
      const payload = {
        type: 'room:join',
        playerId,
        playerName: name,
        roomCode: roomCode.toUpperCase(),
      };
      if (!sendWs(payload)) {
        pendingActionRef.current = payload;
      }
    },
    [playerId, sendWs]
  );

  const handleLeaveRoom = () => {
    sendWs({ type: 'room:leave' });
    activeRoomRef.current = null;
    prevStateRef.current = null;
    setRemoteState(null);
    setPacienciaActive(false);
    setUnreadChatCount(0);
    setIsChatOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('sala');
    window.history.replaceState({}, '', url.toString());
  };

  const handleToggleChat = () => {
    setIsChatOpen((prev) => {
      const next = !prev;
      if (next) setUnreadChatCount(0);
      return next;
    });
  };

  if (pacienciaActive) {
    return (
      <PacienciaTable
        playerName={playerName || 'Jogador'}
        onExit={handleLeaveRoom}
      />
    );
  }

  if (!remoteState) {
    return (
      <LobbyScreen
        initialName={playerName}
        initialRoomCode={initialRoomCode}
        isConnecting={isConnecting}
        error={error}
        onPlaySolo={handlePlaySolo}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
      />
    );
  }

  if (remoteState.gameKind === 'vinteum') {
    return (
      <VinteUmTable
        state={remoteState}
        isConnected={isConnected}
        volume={volume}
        isChatOpen={isChatOpen}
        unreadChatCount={unreadChatCount}
        onChangeVolume={setVolume}
        onToggleChat={handleToggleChat}
        onSendChat={(text) => sendWs({ type: 'chat:send', text })}
        onStartGroup={() => sendWs({ type: 'v21:start' })}
        onHit={() => sendWs({ type: 'v21:hit' })}
        onStand={() => sendWs({ type: 'v21:stand' })}
        onNextRound={() => sendWs({ type: 'v21:next_round' })}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  return (
    <GameTable
      state={remoteState}
      isConnected={isConnected}
      volume={volume}
      isChatOpen={isChatOpen}
      unreadChatCount={unreadChatCount}
      onChangeVolume={setVolume}
      onToggleChat={handleToggleChat}
      onSendChat={(text) => sendWs({ type: 'chat:send', text })}
      onStartTeamMatch={() => sendWs({ type: 'game:start_match' })}
      onPlayCard={(cardId, faceDown) =>
        sendWs({ type: 'game:play_card', cardId, faceDown })
      }
      onAskTruco={() => sendWs({ type: 'game:ask_truco' })}
      onRespondTruco={(action) => sendWs({ type: 'game:respond_truco', action })}
      onDecideMaoDe11={(accept) => sendWs({ type: 'game:mao_de_11', accept })}
      onNextHand={() => sendWs({ type: 'game:next_hand' })}
      onNewMatch={() => sendWs({ type: 'game:new_match' })}
      onLeaveRoom={handleLeaveRoom}
    />
  );
}
