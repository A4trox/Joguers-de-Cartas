import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  askTruco,
  chooseBotTrucoAction,
  createInitialRoomState,
  decideMaoDe11,
  getBetLabel,
  playCard,
  respondTruco,
  RoomState,
  startNewHand,
  startNewMatch,
  toClientState,
} from './src/game/truco';
import {
  createInitialVinteUmRoom,
  hitVinteUm,
  standVinteUm,
  startVinteUmRound,
  stepDealerVinteUm,
  toClientVinteUmState,
  VinteUmRoomState,
} from './src/game/vinteum';
import { ChatMessage, PlayerInfo } from './src/game/types';

const PORT = Number(process.env.PORT) || 3000;

interface ClientConnection {
  ws: WebSocket;
  playerId: string;
  roomCode: string | null;
}

const trucoRooms = new Map<string, RoomState>();
const vinteUmRooms = new Map<string, VinteUmRoomState>();
const roomConnections = new Map<string, Set<ClientConnection>>();
const handTimers = new Map<string, NodeJS.Timeout>();
const botTimers = new Map<string, NodeJS.Timeout>();
const vinteUmTimers = new Map<string, NodeJS.Timeout>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return trucoRooms.has(code) || vinteUmRooms.has(code) ? generateRoomCode() : code;
}

function sendJson(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function appendSystemChat(chat: ChatMessage[], text: string): ChatMessage[] {
  const msg: ChatMessage = {
    id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    senderId: 'system',
    senderName: 'Mesa',
    text,
    timestamp: Date.now(),
    isSystem: true,
  };
  return [...chat.slice(-99), msg];
}

function broadcastRoomState(roomCode: string) {
  const conns = roomConnections.get(roomCode);
  if (!conns) return;

  const truco = trucoRooms.get(roomCode);
  if (truco) {
    for (const conn of conns) {
      sendJson(conn.ws, {
        type: 'state:sync',
        state: toClientState(truco, conn.playerId),
      });
    }
    return;
  }

  const v21 = vinteUmRooms.get(roomCode);
  if (v21) {
    for (const conn of conns) {
      sendJson(conn.ws, {
        type: 'state:sync',
        state: toClientVinteUmState(v21, conn.playerId),
      });
    }
  }
}

function scheduleNextHandIfNeeded(roomCode: string) {
  const existing = handTimers.get(roomCode);
  if (existing) {
    clearTimeout(existing);
    handTimers.delete(roomCode);
  }

  const room = trucoRooms.get(roomCode);
  if (!room || room.phase !== 'HAND_OVER') return;

  const timer = setTimeout(() => {
    handTimers.delete(roomCode);
    const current = trucoRooms.get(roomCode);
    if (!current || current.phase !== 'HAND_OVER' || current.players.length < 2) return;
    const next = startNewHand(current);
    trucoRooms.set(roomCode, next);
    broadcastRoomState(roomCode);
    scheduleBotTurnIfNeeded(roomCode);
  }, 3400);

  handTimers.set(roomCode, timer);
}

function scheduleVinteUmDealerStepIfNeeded(roomCode: string) {
  const existing = vinteUmTimers.get(roomCode);
  if (existing) {
    clearTimeout(existing);
    vinteUmTimers.delete(roomCode);
  }

  const room = vinteUmRooms.get(roomCode);
  if (!room || room.phase !== 'DEALER_TURN') return;

  const timer = setTimeout(() => {
    vinteUmTimers.delete(roomCode);
    const current = vinteUmRooms.get(roomCode);
    if (!current || current.phase !== 'DEALER_TURN') return;

    const { room: nextRoom, done } = stepDealerVinteUm(current);
    vinteUmRooms.set(roomCode, nextRoom);
    broadcastRoomState(roomCode);

    if (!done) {
      scheduleVinteUmDealerStepIfNeeded(roomCode);
    }
  }, 1100);

  vinteUmTimers.set(roomCode, timer);
}

function scheduleBotTurnIfNeeded(roomCode: string) {
  const existing = botTimers.get(roomCode);
  if (existing) {
    clearTimeout(existing);
    botTimers.delete(roomCode);
  }

  const room = trucoRooms.get(roomCode);
  if (!room) return;

  const bot = room.players.find((p) => p.isBot);
  if (!bot) return;

  const botNeedsToAct =
    (room.phase === 'PLAYING' && room.turnPlayerId === bot.id) ||
    (room.phase === 'TRUCO_CHALLENGE' && room.challenge?.toTeam === bot.team) ||
    (room.phase === 'MAO_DE_11_DECISION' && room.maoDe11Team === bot.team);

  if (!botNeedsToAct) return;

  const timer = setTimeout(() => {
    botTimers.delete(roomCode);
    const current = trucoRooms.get(roomCode);
    if (!current) return;

    const action = chooseBotTrucoAction(current, bot.id);
    if (!action) return;

    if (action.type === 'play') {
      const res = playCard(current, bot.id, action.cardId, false);
      if (!res.error) {
        trucoRooms.set(roomCode, res.room);
        broadcastRoomState(roomCode);
        if (res.room.phase === 'HAND_OVER') {
          scheduleNextHandIfNeeded(roomCode);
        } else {
          scheduleBotTurnIfNeeded(roomCode);
        }
      }
    } else if (action.type === 'ask_truco') {
      const res = askTruco(current, bot.id);
      if (!res.error) {
        const label = getBetLabel(res.room.challenge!.proposedBet);
        const updated = {
          ...res.room,
          chat: appendSystemChat(res.room.chat, `${bot.name} pediu ${label}!`),
        };
        trucoRooms.set(roomCode, updated);
        broadcastRoomState(roomCode);
      }
    } else if (action.type === 'respond_truco') {
      const res = respondTruco(current, bot.id, action.action);
      if (!res.error) {
        let chatText = '';
        if (action.action === 'accept') chatText = `${bot.name} aceitou!`;
        else if (action.action === 'run') chatText = `${bot.name} correu!`;
        else chatText = `${bot.name} pediu ${getBetLabel(res.room.challenge!.proposedBet)}!`;

        const updated = {
          ...res.room,
          chat: appendSystemChat(res.room.chat, chatText),
        };
        trucoRooms.set(roomCode, updated);
        broadcastRoomState(roomCode);
        if (updated.phase === 'HAND_OVER') {
          scheduleNextHandIfNeeded(roomCode);
        } else {
          scheduleBotTurnIfNeeded(roomCode);
        }
      }
    } else if (action.type === 'mao_de_11') {
      const res = decideMaoDe11(current, bot.id, action.accept);
      if (!res.error) {
        const updated = {
          ...res.room,
          chat: appendSystemChat(
            res.room.chat,
            action.accept
              ? `${bot.name} aceitou jogar a Mão de 11!`
              : `${bot.name} correu da Mão de 11.`
          ),
        };
        trucoRooms.set(roomCode, updated);
        broadcastRoomState(roomCode);
        if (updated.phase === 'HAND_OVER') {
          scheduleNextHandIfNeeded(roomCode);
        } else {
          scheduleBotTurnIfNeeded(roomCode);
        }
      }
    }
  }, 1200);

  botTimers.set(roomCode, timer);
}

function attachConnectionToRoom(conn: ClientConnection, roomCode: string) {
  if (conn.roomCode && conn.roomCode !== roomCode) {
    detachConnectionFromRoom(conn);
  }
  conn.roomCode = roomCode;
  let set = roomConnections.get(roomCode);
  if (!set) {
    set = new Set();
    roomConnections.set(roomCode, set);
  }
  set.add(conn);
}

function detachConnectionFromRoom(conn: ClientConnection) {
  if (!conn.roomCode) return;
  const code = conn.roomCode;
  const set = roomConnections.get(code);
  if (set) {
    set.delete(conn);
  }
  const stillConnected = Array.from(set ?? []).some((c) => c.playerId === conn.playerId);
  if (!stillConnected) {
    const truco = trucoRooms.get(code);
    if (truco) {
      const updatedPlayers = truco.players.map((p) =>
        p.id === conn.playerId ? { ...p, connected: false } : p
      );
      trucoRooms.set(code, { ...truco, players: updatedPlayers });
      broadcastRoomState(code);
    }
    const v21 = vinteUmRooms.get(code);
    if (v21) {
      const updatedPlayers = v21.players.map((p) =>
        p.id === conn.playerId ? { ...p, connected: false } : p
      );
      vinteUmRooms.set(code, { ...v21, players: updatedPlayers });
      broadcastRoomState(code);
    }
  }
  conn.roomCode = null;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, trucoRooms: trucoRooms.size, vinteUmRooms: vinteUmRooms.size });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const conn: ClientConnection = {
      ws,
      playerId: '',
      roomCode: null,
    };

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      const type = String(msg.type || '');

      if (type === 'ping') {
        sendJson(ws, { type: 'pong' });
        return;
      }

      if (type === 'room:create') {
        const playerId = String(msg.playerId || '').trim() || `p-${Math.random().toString(36).slice(2, 10)}`;
        const playerName = String(msg.playerName || '').trim().slice(0, 24) || 'Jogador 1';
        const gameKind = msg.gameKind === 'vinteum' ? 'vinteum' : 'truco';
        const solo = Boolean(msg.solo);
        conn.playerId = playerId;

        const code = generateRoomCode();

        if (gameKind === 'vinteum') {
          const maxPlayers = solo ? 1 : msg.maxPlayers === 4 ? 4 : 2;
          let room = createInitialVinteUmRoom(
            code,
            { id: playerId, name: playerName },
            maxPlayers
          );
          room = {
            ...room,
            chat: appendSystemChat(
              room.chat,
              solo
                ? `${playerName} iniciou 21 contra a Banca.`
                : `${playerName} criou a sala de 21 (${code}).`
            ),
          };
          if (solo) {
            room = startVinteUmRound(room);
          }
          vinteUmRooms.set(code, room);
          attachConnectionToRoom(conn, code);
          broadcastRoomState(code);
          return;
        }

        // Truco room
        const maxPlayers: 2 | 4 | 6 =
          msg.maxPlayers === 6 ? 6 : msg.maxPlayers === 4 ? 4 : 2;

        const host: PlayerInfo = {
          id: playerId,
          name: playerName,
          team: 0,
          connected: true,
          wins: 0,
        };

        let room = createInitialRoomState(code, host, maxPlayers);
        if (solo) {
          const bot: PlayerInfo = {
            id: `bot-${code}`,
            name: 'Guers Bot',
            team: 1,
            connected: true,
            isBot: true,
            wins: 0,
          };
          room.players.push(bot);
          room.chat = appendSystemChat(
            room.chat,
            `${playerName} iniciou Truco contra Guers Bot.`
          );
          room = startNewHand(room);
        } else {
          room.chat = appendSystemChat(
            room.chat,
            `${playerName} criou a sala ${code}.`
          );
        }

        trucoRooms.set(code, room);
        attachConnectionToRoom(conn, code);
        broadcastRoomState(code);
        if (solo) {
          scheduleBotTurnIfNeeded(code);
        }
        return;
      }

      if (type === 'room:join') {
        const playerId = String(msg.playerId || '').trim() || `p-${Math.random().toString(36).slice(2, 10)}`;
        const playerName = String(msg.playerName || '').trim().slice(0, 24) || 'Jogador';
        const code = String(msg.roomCode || '').trim().toUpperCase();
        conn.playerId = playerId;

        const truco = trucoRooms.get(code);
        if (truco) {
          const existing = truco.players.find((p) => p.id === playerId);
          if (existing) {
            const updatedPlayers = truco.players.map((p) =>
              p.id === playerId ? { ...p, connected: true, name: playerName || p.name } : p
            );
            trucoRooms.set(code, { ...truco, players: updatedPlayers });
            attachConnectionToRoom(conn, code);
            broadcastRoomState(code);
            return;
          }

          if (truco.players.length >= truco.maxPlayers) {
            sendJson(ws, { type: 'error', message: `Esta sala já está lotada (${truco.maxPlayers} jogadores).` });
            return;
          }

          // Alternate teams around table: 0, 1, 0, 1...
          const team: 0 | 1 = truco.players.length % 2 === 0 ? 0 : 1;
          const guest: PlayerInfo = {
            id: playerId,
            name: playerName,
            team,
            connected: true,
            wins: 0,
          };

          let updatedRoom: RoomState = {
            ...truco,
            players: [...truco.players, guest],
            chat: appendSystemChat(truco.chat, `${playerName} entrou na sala!`),
          };

          if (updatedRoom.players.length === updatedRoom.maxPlayers && updatedRoom.phase === 'WAITING_OPPONENT') {
            updatedRoom = startNewHand(updatedRoom);
          }

          trucoRooms.set(code, updatedRoom);
          attachConnectionToRoom(conn, code);
          broadcastRoomState(code);
          return;
        }

        const v21 = vinteUmRooms.get(code);
        if (v21) {
          const existing = v21.players.find((p) => p.id === playerId);
          if (existing) {
            const updatedPlayers = v21.players.map((p) =>
              p.id === playerId ? { ...p, connected: true, name: playerName || p.name } : p
            );
            vinteUmRooms.set(code, { ...v21, players: updatedPlayers });
            attachConnectionToRoom(conn, code);
            broadcastRoomState(code);
            return;
          }

          if (v21.players.length >= v21.maxPlayers) {
            sendJson(ws, { type: 'error', message: `Esta sala de 21 já está lotada (${v21.maxPlayers} jogadores).` });
            return;
          }

          let updatedV21: VinteUmRoomState = {
            ...v21,
            players: [
              ...v21.players,
              {
                id: playerId,
                name: playerName,
                connected: true,
                hand: [],
                status: 'playing',
                score: 0,
                wins: 0,
                lastOutcome: null,
              },
            ],
            chat: appendSystemChat(v21.chat, `${playerName} entrou na sala!`),
          };

          if (updatedV21.players.length === updatedV21.maxPlayers && updatedV21.phase === 'WAITING_PLAYERS') {
            updatedV21 = startVinteUmRound(updatedV21);
          }

          vinteUmRooms.set(code, updatedV21);
          attachConnectionToRoom(conn, code);
          broadcastRoomState(code);
          return;
        }

        sendJson(ws, { type: 'error', message: `Sala "${code}" não encontrada.` });
        return;
      }

      if (type === 'room:leave') {
        detachConnectionFromRoom(conn);
        return;
      }

      if (!conn.roomCode || !conn.playerId) return;
      const code = conn.roomCode;

      /* ---------- TRUCO ACTIONS ---------- */
      const truco = trucoRooms.get(code);
      if (truco) {
        if (type === 'game:start_match') {
          if (truco.hostId !== conn.playerId) return;
          if (truco.players.length < truco.minPlayers || truco.players.length % 2 !== 0) {
            sendJson(ws, {
              type: 'error',
              message: `São necessários pelo menos ${truco.minPlayers} jogadores (em número par) para iniciar.`,
            });
            return;
          }
          const started = startNewHand(truco);
          trucoRooms.set(code, started);
          broadcastRoomState(code);
          return;
        }

        if (type === 'game:play_card') {
          const cardId = String(msg.cardId || '');
          const faceDown = Boolean(msg.faceDown);
          const res = playCard(truco, conn.playerId, cardId, faceDown);
          if (res.error) {
            sendJson(ws, { type: 'error', message: res.error });
            return;
          }
          trucoRooms.set(code, res.room);
          broadcastRoomState(code);
          if (res.room.phase === 'HAND_OVER') {
            scheduleNextHandIfNeeded(code);
          } else {
            scheduleBotTurnIfNeeded(code);
          }
          return;
        }

        if (type === 'game:ask_truco') {
          const res = askTruco(truco, conn.playerId);
          if (res.error) {
            sendJson(ws, { type: 'error', message: res.error });
            return;
          }
          const player = truco.players.find((p) => p.id === conn.playerId);
          const label = getBetLabel(res.room.challenge!.proposedBet);
          const updated = {
            ...res.room,
            chat: appendSystemChat(res.room.chat, `${player?.name || 'Jogador'} pediu ${label}!`),
          };
          trucoRooms.set(code, updated);
          broadcastRoomState(code);
          scheduleBotTurnIfNeeded(code);
          return;
        }

        if (type === 'game:respond_truco') {
          const action = msg.action as 'accept' | 'run' | 'raise';
          if (action !== 'accept' && action !== 'run' && action !== 'raise') return;
          const res = respondTruco(truco, conn.playerId, action);
          if (res.error) {
            sendJson(ws, { type: 'error', message: res.error });
            return;
          }
          const player = truco.players.find((p) => p.id === conn.playerId);
          let chatText = '';
          if (action === 'accept') chatText = `${player?.name} aceitou!`;
          else if (action === 'run') chatText = `${player?.name} correu!`;
          else chatText = `${player?.name} pediu ${getBetLabel(res.room.challenge!.proposedBet)}!`;

          const updated = {
            ...res.room,
            chat: appendSystemChat(res.room.chat, chatText),
          };
          trucoRooms.set(code, updated);
          broadcastRoomState(code);
          if (updated.phase === 'HAND_OVER') {
            scheduleNextHandIfNeeded(code);
          } else {
            scheduleBotTurnIfNeeded(code);
          }
          return;
        }

        if (type === 'game:mao_de_11') {
          const accept = Boolean(msg.accept);
          const res = decideMaoDe11(truco, conn.playerId, accept);
          if (res.error) {
            sendJson(ws, { type: 'error', message: res.error });
            return;
          }
          const player = truco.players.find((p) => p.id === conn.playerId);
          const updated = {
            ...res.room,
            chat: appendSystemChat(
              res.room.chat,
              accept
                ? `${player?.name} aceitou jogar a Mão de 11!`
                : `${player?.name} correu da Mão de 11.`
            ),
          };
          trucoRooms.set(code, updated);
          broadcastRoomState(code);
          if (updated.phase === 'HAND_OVER') {
            scheduleNextHandIfNeeded(code);
          } else {
            scheduleBotTurnIfNeeded(code);
          }
          return;
        }

        if (type === 'game:next_hand') {
          if (truco.phase !== 'HAND_OVER') return;
          const existing = handTimers.get(code);
          if (existing) {
            clearTimeout(existing);
            handTimers.delete(code);
          }
          const next = startNewHand(truco);
          trucoRooms.set(code, next);
          broadcastRoomState(code);
          scheduleBotTurnIfNeeded(code);
          return;
        }

        if (type === 'game:new_match') {
          if (truco.phase !== 'MATCH_OVER') return;
          const next = startNewMatch(truco);
          const updated = {
            ...next,
            chat: appendSystemChat(next.chat, 'Nova partida iniciada!'),
          };
          trucoRooms.set(code, updated);
          broadcastRoomState(code);
          scheduleBotTurnIfNeeded(code);
          return;
        }

        if (type === 'chat:send') {
          const text = String(msg.text || '').trim().slice(0, 300);
          if (!text) return;
          const player = truco.players.find((p) => p.id === conn.playerId);
          const chatMsg: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            senderId: conn.playerId,
            senderName: player?.name || 'Jogador',
            text,
            timestamp: Date.now(),
          };
          trucoRooms.set(code, { ...truco, chat: [...truco.chat.slice(-99), chatMsg] });
          broadcastRoomState(code);
          return;
        }
      }

      /* ---------- MODO 21 ACTIONS ---------- */
      const v21 = vinteUmRooms.get(code);
      if (v21) {
        if (type === 'v21:start') {
          if (v21.hostId !== conn.playerId || v21.players.length < 2) return;
          vinteUmRooms.set(code, startVinteUmRound(v21));
          broadcastRoomState(code);
          scheduleVinteUmDealerStepIfNeeded(code);
          return;
        }

        if (type === 'v21:hit') {
          const res = hitVinteUm(v21, conn.playerId);
          if (res.error) {
            sendJson(ws, { type: 'error', message: res.error });
            return;
          }
          vinteUmRooms.set(code, res.room);
          broadcastRoomState(code);
          scheduleVinteUmDealerStepIfNeeded(code);
          return;
        }

        if (type === 'v21:stand') {
          const res = standVinteUm(v21, conn.playerId);
          if (res.error) {
            sendJson(ws, { type: 'error', message: res.error });
            return;
          }
          vinteUmRooms.set(code, res.room);
          broadcastRoomState(code);
          scheduleVinteUmDealerStepIfNeeded(code);
          return;
        }

        if (type === 'v21:next_round') {
          if (v21.phase !== 'ROUND_OVER') return;
          vinteUmRooms.set(code, startVinteUmRound(v21));
          broadcastRoomState(code);
          scheduleVinteUmDealerStepIfNeeded(code);
          return;
        }

        if (type === 'chat:send') {
          const text = String(msg.text || '').trim().slice(0, 300);
          if (!text) return;
          const player = v21.players.find((p) => p.id === conn.playerId);
          const chatMsg: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            senderId: conn.playerId,
            senderName: player?.name || 'Jogador',
            text,
            timestamp: Date.now(),
          };
          vinteUmRooms.set(code, { ...v21, chat: [...v21.chat.slice(-99), chatMsg] });
          broadcastRoomState(code);
          return;
        }
      }
    });

    ws.on('close', () => {
      detachConnectionFromRoom(conn);
    });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Joguers de Cartas server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
