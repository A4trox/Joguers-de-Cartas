import {
  Card,
  ChatMessage,
  ClientVinteUmState,
  VinteUmHistoryEntry,
  VinteUmPhase,
  VinteUmPlayer,
} from './types';
import { createDeck, cryptoSecureRandom, shuffleDeck } from './truco';

export function getVinteUmCardValue(card: Card): number {
  if (card.rank === 'Q' || card.rank === 'J' || card.rank === 'K') return 10;
  if (card.rank === 'A') return 11;
  return Number(card.rank); // '2','3','4','5','6','7'
}

export function calculateVinteUmScore(hand: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.rank === 'A') {
      aces += 1;
      total += 11;
    } else {
      total += getVinteUmCardValue(card);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

export interface VinteUmRoomState {
  roomCode: string;
  hostId: string;
  maxPlayers: 1 | 2 | 4;
  phase: VinteUmPhase;
  roundNumber: number;
  turnPlayerId: string | null;
  players: VinteUmPlayer[];
  deck: Card[];
  dealerHand: Card[];
  history: VinteUmHistoryEntry[];
  chat: ChatMessage[];
}

export function createInitialVinteUmRoom(
  roomCode: string,
  host: { id: string; name: string },
  maxPlayers: 1 | 2 | 4
): VinteUmRoomState {
  return {
    roomCode,
    hostId: host.id,
    maxPlayers,
    phase: maxPlayers === 1 ? 'PLAYER_TURNS' : 'WAITING_PLAYERS',
    roundNumber: 0,
    turnPlayerId: null,
    players: [
      {
        id: host.id,
        name: host.name,
        connected: true,
        hand: [],
        status: 'playing',
        score: 0,
        wins: 0,
        lastOutcome: null,
      },
    ],
    deck: [],
    dealerHand: [],
    history: [],
    chat: [],
  };
}

export function startVinteUmRound(
  room: VinteUmRoomState,
  rng: () => number = cryptoSecureRandom
): VinteUmRoomState {
  const deck = shuffleDeck(createDeck(), rng);
  let cursor = 0;

  const updatedPlayers: VinteUmPlayer[] = room.players.map((p) => {
    const hand = [deck[cursor++], deck[cursor++]];
    const score = calculateVinteUmScore(hand);
    const isBlackjack = score === 21;
    return {
      ...p,
      hand,
      score,
      status: isBlackjack ? 'blackjack' : 'playing',
      lastOutcome: null,
    };
  });

  const dealerHand = [deck[cursor++], deck[cursor++]];
  const remainingDeck = deck.slice(cursor);

  const firstPlaying = updatedPlayers.find((p) => p.status === 'playing');

  let nextRoom: VinteUmRoomState = {
    ...room,
    phase: firstPlaying ? 'PLAYER_TURNS' : 'DEALER_TURN',
    roundNumber: room.roundNumber + 1,
    turnPlayerId: firstPlaying ? firstPlaying.id : null,
    players: updatedPlayers,
    deck: remainingDeck,
    dealerHand,
  };

  return nextRoom;
}

export function hitVinteUm(
  room: VinteUmRoomState,
  playerId: string
): { room: VinteUmRoomState; error?: string } {
  if (room.phase !== 'PLAYER_TURNS' || room.turnPlayerId !== playerId) {
    return { room, error: 'Não é a sua vez.' };
  }
  if (room.deck.length === 0) {
    return { room, error: 'Baralho vazio.' };
  }

  const [drawn, ...restDeck] = room.deck;

  const updatedPlayers = room.players.map((p) => {
    if (p.id !== playerId) return p;
    const newHand = [...p.hand, drawn];
    const score = calculateVinteUmScore(newHand);
    const status: VinteUmPlayer['status'] =
      score > 21 ? 'busted' : score === 21 ? 'stood' : 'playing';
    return {
      ...p,
      hand: newHand,
      score,
      status,
    };
  });

  let nextRoom: VinteUmRoomState = {
    ...room,
    deck: restDeck,
    players: updatedPlayers,
  };

  const current = updatedPlayers.find((p) => p.id === playerId)!;
  if (current.status === 'stood' || current.status === 'blackjack') {
    nextRoom = advanceVinteUmTurn(nextRoom, playerId);
  }

  return { room: nextRoom };
}

export function standVinteUm(
  room: VinteUmRoomState,
  playerId: string
): { room: VinteUmRoomState; error?: string } {
  if (room.phase !== 'PLAYER_TURNS' || room.turnPlayerId !== playerId) {
    return { room, error: 'Não é a sua vez.' };
  }

  const updatedPlayers = room.players.map((p) => {
    if (p.id !== playerId) return p;
    return {
      ...p,
      status: p.status === 'busted' ? ('busted' as const) : ('stood' as const),
    };
  });

  const nextRoom = advanceVinteUmTurn(
    { ...room, players: updatedPlayers },
    playerId
  );

  return { room: nextRoom };
}

function advanceVinteUmTurn(
  room: VinteUmRoomState,
  currentPlayerId: string
): VinteUmRoomState {
  const curIdx = room.players.findIndex((p) => p.id === currentPlayerId);
  const nextPlayer = room.players
    .slice(curIdx + 1)
    .find((p) => p.status === 'playing');

  if (nextPlayer) {
    return {
      ...room,
      turnPlayerId: nextPlayer.id,
    };
  }

  return {
    ...room,
    phase: 'DEALER_TURN',
    turnPlayerId: null,
  };
}

export function stepDealerVinteUm(
  room: VinteUmRoomState,
  rng: () => number = cryptoSecureRandom
): { room: VinteUmRoomState; done: boolean } {
  if (room.phase !== 'DEALER_TURN') {
    return { room, done: true };
  }

  const dealerScore = calculateVinteUmScore(room.dealerHand);
  const shouldHit =
    dealerScore < 17 ||
    (dealerScore === 17 && rng() < 0.3) ||
    (dealerScore === 18 && rng() < 0.12);

  if (shouldHit && dealerScore <= 21 && room.deck.length > 0) {
    const [drawn, ...restDeck] = room.deck;
    return {
      room: {
        ...room,
        dealerHand: [...room.dealerHand, drawn],
        deck: restDeck,
      },
      done: false,
    };
  }

  return {
    room: finalizeVinteUmRound(room),
    done: true,
  };
}

function finalizeVinteUmRound(room: VinteUmRoomState): VinteUmRoomState {
  const dealerHand = [...room.dealerHand];
  const dealerScore = calculateVinteUmScore(dealerHand);
  const dealerBusted = dealerScore > 21;

  const winners: string[] = [];
  let hasTie = false;
  const updatedPlayers = room.players.map((p) => {
    const pScore = p.score ?? calculateVinteUmScore(p.hand);
    let outcome: 'win' | 'lose' | 'push' = 'lose';
    if (p.status === 'busted' && dealerBusted) {
      outcome = 'push';
      hasTie = true;
    } else if (p.status === 'busted') {
      outcome = 'lose';
    } else if (dealerBusted || pScore > dealerScore) {
      outcome = 'win';
      winners.push(`${p.name} (${pScore})`);
    } else if (pScore === dealerScore) {
      outcome = 'push';
      hasTie = true;
    } else {
      outcome = 'lose';
    }

    return {
      ...p,
      wins: outcome === 'win' ? p.wins + 1 : p.wins,
      lastOutcome: outcome,
    };
  });

  const summary =
    winners.length > 0
      ? `Vencedores: ${winners.join(', ')} · Banca: ${dealerScore}${dealerBusted ? ' (Estourou)' : ''}`
      : dealerBusted
      ? `Ninguém pontuou! Banca também estourou (${dealerScore}).`
      : hasTie
      ? `Empate com a Banca (${dealerScore})! Ninguém pontuou.`
      : `Banca venceu com ${dealerScore}`;

  const entry: VinteUmHistoryEntry = {
    id: `21-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    roundNumber: room.roundNumber,
    dealerScore,
    summary,
    playedAt: Date.now(),
  };

  return {
    ...room,
    phase: 'ROUND_OVER',
    turnPlayerId: null,
    dealerHand,
    players: updatedPlayers,
    history: [entry, ...room.history.slice(0, 29)],
  };
}

export function toClientVinteUmState(
  room: VinteUmRoomState,
  playerId: string
): ClientVinteUmState {
  const dealerCardsHidden = room.phase !== 'ROUND_OVER';
  const sanitizedPlayers: VinteUmPlayer[] = room.players.map((p) => {
    const canSee = room.phase === 'ROUND_OVER' || p.id === playerId;
    return {
      ...p,
      hand: canSee ? p.hand : [],
      cardCount: p.hand.length,
      score: canSee ? p.score : null,
    };
  });

  return {
    gameKind: 'vinteum',
    roomCode: room.roomCode,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    phase: room.phase,
    myId: playerId,
    roundNumber: room.roundNumber,
    turnPlayerId: room.turnPlayerId,
    players: sanitizedPlayers,
    dealerHand: dealerCardsHidden ? [] : room.dealerHand,
    dealerCardCount: room.dealerHand.length,
    dealerCardsHidden,
    dealerScore: dealerCardsHidden ? null : calculateVinteUmScore(room.dealerHand),
    history: room.history,
    chat: room.chat,
  };
}
