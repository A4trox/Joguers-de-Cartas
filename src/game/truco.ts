import {
  Card,
  ChatMessage,
  ClientGameState,
  GamePhase,
  HandLogEntry,
  MatchHistoryEntry,
  PlayedCard,
  PlayerInfo,
  Rank,
  RoundOutcome,
  Suit,
  TrucoChallenge,
} from './types';

export const RANK_ORDER: Rank[] = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
export const SUIT_ORDER: Suit[] = ['diamonds', 'spades', 'hearts', 'clubs'];

export const SUIT_SYMBOL: Record<Suit, string> = {
  diamonds: '♦',
  spades: '♠',
  hearts: '♥',
  clubs: '♣',
};

export const SUIT_LABEL_PT: Record<Suit, string> = {
  diamonds: 'Ouros',
  spades: 'Espadas',
  hearts: 'Copas',
  clubs: 'Paus',
};

export function cryptoSecureRandom(): number {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    globalThis.crypto.getRandomValues(arr);
    return arr[0] / 4294967296;
  }
  return Math.random();
}

export function getManilhaRank(vira: Card): Rank {
  const idx = RANK_ORDER.indexOf(vira.rank);
  return RANK_ORDER[(idx + 1) % RANK_ORDER.length];
}

export function getCardPower(card: Card, manilhaRank: Rank): number {
  if (card.rank === manilhaRank) {
    return 100 + SUIT_ORDER.indexOf(card.suit);
  }
  return RANK_ORDER.indexOf(card.rank);
}

export function getPlayedCardPower(played: PlayedCard, manilhaRank: Rank): number {
  return played.faceDown ? -1 : getCardPower(played.card, manilhaRank);
}

export function compareCards(
  a: PlayedCard,
  b: PlayedCard,
  manilhaRank: Rank
): number {
  const powerA = getPlayedCardPower(a, manilhaRank);
  const powerB = getPlayedCardPower(b, manilhaRank);
  if (powerA > powerB) return 1;
  if (powerA < powerB) return -1;
  return 0;
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUIT_ORDER) {
    for (const rank of RANK_ORDER) {
      deck.push({
        id: `${rank}-${suit}`,
        rank,
        suit,
      });
    }
  }
  return deck;
}

export function shuffleDeck(
  deck: Card[],
  rng: () => number = cryptoSecureRandom
): Card[] {
  const copy = [...deck];
  // Double-pass Fisher-Yates for thorough mixing
  for (let pass = 0; pass < 2; pass++) {
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
  }
  return copy;
}

export function determineHandWinner(outcomes: RoundOutcome[]): {
  finished: boolean;
  winnerTeam: 0 | 1 | 'tie' | null;
} {
  const [r1, r2, r3] = outcomes;

  if (r1 === null) return { finished: false, winnerTeam: null };

  if (r1 === 'tie') {
    if (r2 === null) return { finished: false, winnerTeam: null };
    if (r2 !== 'tie') return { finished: true, winnerTeam: r2 };
    if (r3 === null) return { finished: false, winnerTeam: null };
    return { finished: true, winnerTeam: r3 };
  }

  if (r2 === null) return { finished: false, winnerTeam: null };
  if (r2 === r1) return { finished: true, winnerTeam: r1 };
  if (r2 === 'tie') return { finished: true, winnerTeam: r1 };

  if (r3 === null) return { finished: false, winnerTeam: null };
  if (r3 === 'tie') return { finished: true, winnerTeam: r1 };

  return { finished: true, winnerTeam: r3 };
}

export function getNextBetValue(currentBet: number): number | null {
  if (currentBet === 1) return 3;
  if (currentBet === 3) return 6;
  if (currentBet === 6) return 9;
  if (currentBet === 9) return 12;
  return null;
}

export function getBetLabel(bet: number): string {
  switch (bet) {
    case 3:
      return 'Truco';
    case 6:
      return 'Seis';
    case 9:
      return 'Nove';
    case 12:
      return 'Doze';
    default:
      return `${bet}`;
  }
}

export interface RoomState {
  roomCode: string;
  hostId: string;
  maxPlayers: 2 | 4 | 6;
  minPlayers: 2 | 4;
  phase: GamePhase;
  players: PlayerInfo[];
  teamScores: [number, number];
  teamWins: [number, number];
  hands: Record<string, Card[]>;
  handNumber: number;
  dealerIndex: number;
  turnPlayerId: string | null;
  roundLeaderId: string | null;
  vira: Card | null;
  manilhaRank: Rank | null;
  currentRound: number;
  tableCards: PlayedCard[];
  previousRoundCards: PlayedCard[][];
  roundOutcomes: RoundOutcome[];
  currentBet: number;
  lastRaiseByTeam: 0 | 1 | null;
  challenge: TrucoChallenge | null;
  maoDe11Team: 0 | 1 | null;
  handWinnerTeam: 0 | 1 | null;
  handResultReason: string | null;
  matchWinnerTeam: 0 | 1 | null;
  matchHistory: MatchHistoryEntry[];
  handLog: HandLogEntry[];
  chat: ChatMessage[];
}

export function createInitialRoomState(
  roomCode: string,
  host: PlayerInfo,
  maxPlayers: 2 | 4 | 6 = 2
): RoomState {
  return {
    roomCode,
    hostId: host.id,
    maxPlayers,
    minPlayers: maxPlayers === 2 ? 2 : 4,
    phase: 'WAITING_OPPONENT',
    players: [host],
    teamScores: [0, 0],
    teamWins: [0, 0],
    hands: {},
    handNumber: 0,
    dealerIndex: 0,
    turnPlayerId: null,
    roundLeaderId: null,
    vira: null,
    manilhaRank: null,
    currentRound: 0,
    tableCards: [],
    previousRoundCards: [],
    roundOutcomes: [null, null, null],
    currentBet: 1,
    lastRaiseByTeam: null,
    challenge: null,
    maoDe11Team: null,
    handWinnerTeam: null,
    handResultReason: null,
    matchWinnerTeam: null,
    matchHistory: [],
    handLog: [],
    chat: [],
  };
}

export function getTeamLabel(players: PlayerInfo[], team: 0 | 1): string {
  const members = players.filter((p) => p.team === team);
  if (members.length === 0) return team === 0 ? 'Nós' : 'Eles';
  return members.map((m) => m.name).join(' & ');
}

export function startNewHand(
  room: RoomState,
  rng: () => number = cryptoSecureRandom
): RoomState {
  if (room.players.length < 2) return room;

  const deck = shuffleDeck(createDeck(), rng);
  const hands: Record<string, Card[]> = {};
  let offset = 0;

  for (const player of room.players) {
    hands[player.id] = deck.slice(offset, offset + 3);
    offset += 3;
  }

  const vira = deck[offset];
  const manilhaRank = getManilhaRank(vira);

  const nextHandNumber = room.handNumber + 1;
  const nextDealerIndex =
    nextHandNumber === 1 ? 0 : (room.dealerIndex + 1) % room.players.length;
  const firstPlayerIndex = (nextDealerIndex + 1) % room.players.length;
  const firstPlayerId = room.players[firstPlayerIndex].id;

  const t0At11 = room.teamScores[0] === 11;
  const t1At11 = room.teamScores[1] === 11;

  let phase: GamePhase = 'PLAYING';
  let currentBet = 1;
  let maoDe11Team: 0 | 1 | null = null;

  if (t0At11 && t1At11) {
    phase = 'PLAYING';
    currentBet = 1;
  } else if (t0At11 || t1At11) {
    phase = 'MAO_DE_11_DECISION';
    currentBet = 3;
    maoDe11Team = t0At11 ? 0 : 1;
  }

  return {
    ...room,
    phase,
    hands,
    handNumber: nextHandNumber,
    dealerIndex: nextDealerIndex,
    turnPlayerId: firstPlayerId,
    roundLeaderId: firstPlayerId,
    vira,
    manilhaRank,
    currentRound: 0,
    tableCards: [],
    previousRoundCards: [],
    roundOutcomes: [null, null, null],
    currentBet,
    lastRaiseByTeam: null,
    challenge: null,
    maoDe11Team,
    handWinnerTeam: null,
    handResultReason: null,
  };
}

export function decideMaoDe11(
  room: RoomState,
  playerId: string,
  accept: boolean
): { room: RoomState; error?: string } {
  const player = room.players.find((p) => p.id === playerId);
  if (
    room.phase !== 'MAO_DE_11_DECISION' ||
    !player ||
    room.maoDe11Team !== player.team
  ) {
    return { room, error: 'Não é o momento de decidir Mão de 11.' };
  }

  if (accept) {
    return {
      room: {
        ...room,
        phase: 'PLAYING',
      },
    };
  }

  const otherTeam: 0 | 1 = player.team === 0 ? 1 : 0;
  return awardHandPoints(room, otherTeam, 1, 'Correu na Mão de 11');
}

export function playCard(
  room: RoomState,
  playerId: string,
  cardId: string,
  faceDown = false
): { room: RoomState; error?: string; roundResolved?: boolean } {
  if (room.phase !== 'PLAYING') {
    return { room, error: 'A partida não está em andamento.' };
  }
  if (room.turnPlayerId !== playerId) {
    return { room, error: 'Não é a sua vez de jogar.' };
  }

  const player = room.players.find((p) => p.id === playerId);
  if (!player) return { room, error: 'Jogador não encontrado.' };

  const playerHand = room.hands[playerId] || [];
  const cardIdx = playerHand.findIndex((c) => c.id === cardId);
  if (cardIdx === -1) {
    return { room, error: 'Carta inválida.' };
  }

  const effectiveFaceDown = faceDown && room.currentRound > 0;
  const card = playerHand[cardIdx];
  const updatedHand = playerHand.filter((_, i) => i !== cardIdx);
  const updatedTable: PlayedCard[] = [
    ...room.tableCards,
    { playerId, team: player.team, card, faceDown: effectiveFaceDown },
  ];

  let nextRoom: RoomState = {
    ...room,
    hands: {
      ...room.hands,
      [playerId]: updatedHand,
    },
    tableCards: updatedTable,
  };

  // If not all players have played in this round, advance to next seat
  if (updatedTable.length < room.players.length) {
    const curIdx = room.players.findIndex((p) => p.id === playerId);
    const nextIdx = (curIdx + 1) % room.players.length;
    nextRoom.turnPlayerId = room.players[nextIdx].id;
    return { room: nextRoom, roundResolved: false };
  }

  // All players played -> find best power per team
  const manilha = room.manilhaRank!;
  let bestTeam0: { power: number; playerId: string } = { power: -2, playerId: '' };
  let bestTeam1: { power: number; playerId: string } = { power: -2, playerId: '' };

  for (const play of updatedTable) {
    const pwr = getPlayedCardPower(play, manilha);
    if (play.team === 0 && pwr > bestTeam0.power) {
      bestTeam0 = { power: pwr, playerId: play.playerId };
    } else if (play.team === 1 && pwr > bestTeam1.power) {
      bestTeam1 = { power: pwr, playerId: play.playerId };
    }
  }

  let roundWinnerTeam: RoundOutcome = 'tie';
  let nextLeader = room.roundLeaderId!;

  if (bestTeam0.power > bestTeam1.power) {
    roundWinnerTeam = 0;
    nextLeader = bestTeam0.playerId;
  } else if (bestTeam1.power > bestTeam0.power) {
    roundWinnerTeam = 1;
    nextLeader = bestTeam1.playerId;
  }

  const updatedOutcomes = [...room.roundOutcomes];
  updatedOutcomes[room.currentRound] = roundWinnerTeam;

  const updatedPrevRounds = [...room.previousRoundCards, updatedTable];

  nextRoom = {
    ...nextRoom,
    roundOutcomes: updatedOutcomes,
    previousRoundCards: updatedPrevRounds,
    tableCards: [],
  };

  const handEval = determineHandWinner(updatedOutcomes);
  if (handEval.finished) {
    if (handEval.winnerTeam === 'tie' || handEval.winnerTeam === null) {
      nextRoom.phase = 'HAND_OVER';
      nextRoom.handWinnerTeam = null;
      nextRoom.handResultReason = 'Empate nas 3 rodadas';
      nextRoom.turnPlayerId = null;
      nextRoom.handLog = [
        {
          handNumber: nextRoom.handNumber,
          winnerName: 'Empate',
          pointsWon: 0,
          reason: 'Empate nas 3 rodadas',
        },
        ...nextRoom.handLog,
      ];
      return { room: nextRoom, roundResolved: true };
    }

    const reason =
      nextRoom.currentBet > 1
        ? `Venceu no ${getBetLabel(nextRoom.currentBet)}`
        : 'Venceu a mão';
    const awarded = awardHandPoints(
      nextRoom,
      handEval.winnerTeam,
      nextRoom.currentBet,
      reason
    );
    return { room: awarded.room, roundResolved: true };
  }

  nextRoom.currentRound = room.currentRound + 1;
  nextRoom.roundLeaderId = nextLeader;
  nextRoom.turnPlayerId = nextLeader;

  return { room: nextRoom, roundResolved: true };
}

export function askTruco(
  room: RoomState,
  playerId: string
): { room: RoomState; error?: string } {
  if (room.phase !== 'PLAYING') {
    return { room, error: 'Só é possível pedir truco durante a jogada.' };
  }
  if (room.turnPlayerId !== playerId) {
    return { room, error: 'Só é possível pedir truco na sua vez.' };
  }
  if (room.teamScores[0] === 11 || room.teamScores[1] === 11) {
    return { room, error: 'Não é permitido pedir truco na Mão de 11 ou Mão de Ferro.' };
  }

  const player = room.players.find((p) => p.id === playerId);
  if (!player) return { room, error: 'Jogador não encontrado.' };

  if (room.lastRaiseByTeam === player.team) {
    return { room, error: 'Sua equipe já aumentou a aposta por último.' };
  }

  const nextBet = getNextBetValue(room.currentBet);
  if (!nextBet) {
    return { room, error: 'Aposta máxima já atingida (12).' };
  }

  const toTeam: 0 | 1 = player.team === 0 ? 1 : 0;

  return {
    room: {
      ...room,
      phase: 'TRUCO_CHALLENGE',
      challenge: {
        fromPlayerId: playerId,
        fromTeam: player.team,
        toTeam,
        currentBet: room.currentBet,
        proposedBet: nextBet,
      },
    },
  };
}

export function respondTruco(
  room: RoomState,
  playerId: string,
  action: 'accept' | 'run' | 'raise'
): { room: RoomState; error?: string } {
  if (room.phase !== 'TRUCO_CHALLENGE' || !room.challenge) {
    return { room, error: 'Nenhum pedido de truco pendente.' };
  }

  const player = room.players.find((p) => p.id === playerId);
  if (!player || room.challenge.toTeam !== player.team) {
    return { room, error: 'Não é sua equipe quem deve responder ao pedido.' };
  }

  const { fromTeam, currentBet, proposedBet } = room.challenge;

  if (action === 'accept') {
    return {
      room: {
        ...room,
        phase: 'PLAYING',
        currentBet: proposedBet,
        lastRaiseByTeam: fromTeam,
        challenge: null,
      },
    };
  }

  if (action === 'run') {
    const reason = `Oponente correu do ${getBetLabel(proposedBet)}`;
    return awardHandPoints(room, fromTeam, currentBet, reason);
  }

  const nextProposed = getNextBetValue(proposedBet);
  if (!nextProposed) {
    return { room, error: 'Não é possível aumentar além de 12.' };
  }

  return {
    room: {
      ...room,
      phase: 'TRUCO_CHALLENGE',
      currentBet: proposedBet,
      lastRaiseByTeam: player.team,
      challenge: {
        fromPlayerId: playerId,
        fromTeam: player.team,
        toTeam: fromTeam,
        currentBet: proposedBet,
        proposedBet: nextProposed,
      },
    },
  };
}

function awardHandPoints(
  room: RoomState,
  winnerTeam: 0 | 1,
  points: number,
  reason: string
): { room: RoomState } {
  const newScores: [number, number] = [...room.teamScores] as [number, number];
  newScores[winnerTeam] = Math.min(12, newScores[winnerTeam] + points);

  const loserTeam: 0 | 1 = winnerTeam === 0 ? 1 : 0;
  const winnerLabel = getTeamLabel(room.players, winnerTeam);
  const loserLabel = getTeamLabel(room.players, loserTeam);

  const updatedHandLog: HandLogEntry[] = [
    {
      handNumber: room.handNumber,
      winnerName: winnerLabel,
      pointsWon: points,
      reason,
    },
    ...room.handLog,
  ];

  if (newScores[winnerTeam] >= 12) {
    const newWins: [number, number] = [...room.teamWins] as [number, number];
    newWins[winnerTeam] += 1;

    const updatedPlayers = room.players.map((p) =>
      p.team === winnerTeam ? { ...p, wins: p.wins + 1 } : p
    );

    const historyEntry: MatchHistoryEntry = {
      id: `match-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      winnerName: winnerLabel,
      loserName: loserLabel,
      winnerScore: newScores[winnerTeam],
      loserScore: newScores[loserTeam],
      playedAt: Date.now(),
    };

    return {
      room: {
        ...room,
        players: updatedPlayers,
        teamScores: newScores,
        teamWins: newWins,
        phase: 'MATCH_OVER',
        challenge: null,
        turnPlayerId: null,
        handWinnerTeam: winnerTeam,
        handResultReason: reason,
        matchWinnerTeam: winnerTeam,
        handLog: updatedHandLog,
        matchHistory: [historyEntry, ...room.matchHistory],
      },
    };
  }

  return {
    room: {
      ...room,
      teamScores: newScores,
      phase: 'HAND_OVER',
      challenge: null,
      turnPlayerId: null,
      handWinnerTeam: winnerTeam,
      handResultReason: reason,
      handLog: updatedHandLog,
    },
  };
}

export function startNewMatch(
  room: RoomState,
  rng: () => number = cryptoSecureRandom
): RoomState {
  const resetRoom: RoomState = {
    ...room,
    teamScores: [0, 0],
    handNumber: 0,
    matchWinnerTeam: null,
    handWinnerTeam: null,
    handResultReason: null,
    handLog: [],
  };

  return startNewHand(resetRoom, rng);
}

export function toClientState(room: RoomState, playerId: string): ClientGameState {
  const me = room.players.find((p) => p.id === playerId);
  const cardCounts: Record<string, number> = {};
  for (const p of room.players) {
    cardCounts[p.id] = room.hands[p.id]?.length ?? 0;
  }

  return {
    gameKind: 'truco',
    roomCode: room.roomCode,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    minPlayers: room.minPlayers,
    phase: room.phase,
    myId: playerId,
    myTeam: me?.team ?? 0,
    players: room.players,
    teamScores: room.teamScores,
    teamWins: room.teamWins,
    handNumber: room.handNumber,
    dealerIndex: room.dealerIndex,
    turnPlayerId: room.turnPlayerId,
    vira: room.vira,
    manilhaRank: room.manilhaRank,
    myHand: room.hands[playerId] ?? [],
    cardCounts,
    currentRound: room.currentRound,
    tableCards: room.tableCards,
    previousRoundCards: room.previousRoundCards,
    roundOutcomes: room.roundOutcomes,
    currentBet: room.currentBet,
    lastRaiseByTeam: room.lastRaiseByTeam,
    challenge: room.challenge,
    maoDe11Team: room.maoDe11Team,
    handWinnerTeam: room.handWinnerTeam,
    handResultReason: room.handResultReason,
    matchWinnerTeam: room.matchWinnerTeam,
    matchHistory: room.matchHistory,
    handLog: room.handLog,
    chat: room.chat,
  };
}

/**
 * Smart Truco Bot AI for Solo mode (1v1 against machine).
 */
export function chooseBotTrucoAction(
  room: RoomState,
  botId: string,
  rng: () => number = cryptoSecureRandom
):
  | { type: 'play'; cardId: string }
  | { type: 'ask_truco' }
  | { type: 'respond_truco'; action: 'accept' | 'run' | 'raise' }
  | { type: 'mao_de_11'; accept: boolean }
  | null {
  const bot = room.players.find((p) => p.id === botId);
  if (!bot || !room.manilhaRank) return null;

  const hand = room.hands[botId] || [];
  const sortedByPower = [...hand].sort(
    (a, b) => getCardPower(a, room.manilhaRank!) - getCardPower(b, room.manilhaRank!)
  );
  const maxPower = sortedByPower.length > 0
    ? getCardPower(sortedByPower[sortedByPower.length - 1], room.manilhaRank)
    : 0;
  const hasManilha = maxPower >= 100;

  if (room.phase === 'MAO_DE_11_DECISION' && room.maoDe11Team === bot.team) {
    // Accept Mão de 11 if holding a manilha or at least a 2/3
    return { type: 'mao_de_11', accept: maxPower >= 8 };
  }

  if (room.phase === 'TRUCO_CHALLENGE' && room.challenge?.toTeam === bot.team) {
    const botWonAnyRound = room.roundOutcomes.includes(bot.team);
    if (hasManilha && room.challenge.proposedBet < 6) {
      return { type: 'respond_truco', action: 'raise' };
    }
    if (hasManilha || maxPower >= 6 || botWonAnyRound) {
      return { type: 'respond_truco', action: 'accept' };
    }
    if (room.challenge.proposedBet <= 3) {
      if (maxPower >= 3 && rng() < 0.65) {
        return { type: 'respond_truco', action: 'accept' };
      }
      if (rng() < 0.25) {
        return { type: 'respond_truco', action: 'accept' };
      }
    } else if (maxPower >= 4 && rng() < 0.4) {
      return { type: 'respond_truco', action: 'accept' };
    }
    return { type: 'respond_truco', action: 'run' };
  }

  if (room.phase === 'PLAYING' && room.turnPlayerId === botId && sortedByPower.length > 0) {
    // Occasionally ask Truco if holding a strong hand
    const canAsk =
      room.lastRaiseByTeam !== bot.team &&
      room.teamScores[0] !== 11 &&
      room.teamScores[1] !== 11 &&
      getNextBetValue(room.currentBet) !== null;

    if (canAsk && hasManilha && room.currentBet === 1 && rng() < 0.45) {
      return { type: 'ask_truco' };
    }

    // If opponent already played a card, try to beat it with the weakest winning card
    if (room.tableCards.length === 1) {
      const oppPower = getPlayedCardPower(room.tableCards[0], room.manilhaRank);
      const winning = sortedByPower.find(
        (c) => getCardPower(c, room.manilhaRank!) > oppPower
      );
      if (winning) return { type: 'play', cardId: winning.id };
      // Otherwise play weakest card
      return { type: 'play', cardId: sortedByPower[0].id };
    }

    // Leading: play middle/strongest card
    const pick = sortedByPower[sortedByPower.length - 1];
    return { type: 'play', cardId: pick.id };
  }

  return null;
}
