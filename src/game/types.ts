export type GameKind = 'truco' | 'vinteum' | 'paciencia';

export type Suit = 'diamonds' | 'spades' | 'hearts' | 'clubs';

export type Rank = '4' | '5' | '6' | '7' | 'Q' | 'J' | 'K' | 'A' | '2' | '3';

export type FullRank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
}

export interface FullCard {
  id: string;
  rank: FullRank;
  suit: Suit;
  faceUp: boolean;
}

export interface PlayedCard {
  playerId: string;
  team: 0 | 1;
  card: Card;
  faceDown?: boolean;
}

export type RoundOutcome = 0 | 1 | 'tie' | null; // team 0, team 1, 'tie', or null

export interface TrucoChallenge {
  fromPlayerId: string;
  fromTeam: 0 | 1;
  toTeam: 0 | 1;
  currentBet: number;
  proposedBet: number; // 3, 6, 9, or 12
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface MatchHistoryEntry {
  id: string;
  winnerName: string;
  loserName: string;
  winnerScore: number;
  loserScore: number;
  playedAt: number;
}

export interface HandLogEntry {
  handNumber: number;
  winnerName: string;
  pointsWon: number;
  reason: string;
}

export interface PlayerInfo {
  id: string;
  name: string;
  team: 0 | 1;
  connected: boolean;
  isBot?: boolean;
  wins: number;
}

export type GamePhase =
  | 'WAITING_OPPONENT'
  | 'MAO_DE_11_DECISION'
  | 'PLAYING'
  | 'TRUCO_CHALLENGE'
  | 'HAND_OVER'
  | 'MATCH_OVER';

/**
 * Sanitized Truco game state sent to a specific player (hides other players' unplayed cards).
 */
export interface ClientGameState {
  gameKind: 'truco';
  roomCode: string;
  hostId: string;
  maxPlayers: 2 | 4 | 6;
  minPlayers: 2 | 4;
  phase: GamePhase;
  myId: string;
  myTeam: 0 | 1;
  players: PlayerInfo[];
  teamScores: [number, number];
  teamWins: [number, number];
  handNumber: number;
  dealerIndex: number;
  turnPlayerId: string | null;
  vira: Card | null;
  manilhaRank: Rank | null;
  myHand: Card[];
  cardCounts: Record<string, number>;
  currentRound: number; // 0, 1, 2
  tableCards: PlayedCard[];
  previousRoundCards: PlayedCard[][];
  roundOutcomes: RoundOutcome[]; // length 3
  currentBet: number; // 1, 3, 6, 9, 12
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

/* ==================== MODO 21 (VINTE E UM) ==================== */

export type VinteUmPhase =
  | 'WAITING_PLAYERS'
  | 'PLAYER_TURNS'
  | 'DEALER_TURN'
  | 'ROUND_OVER';

export interface VinteUmPlayer {
  id: string;
  name: string;
  connected: boolean;
  isBot?: boolean;
  hand: Card[];
  cardCount?: number;
  status: 'playing' | 'stood' | 'busted' | 'blackjack';
  score: number | null; // null when hidden from other players
  wins: number;
  lastOutcome?: 'win' | 'lose' | 'push' | null;
}

export interface VinteUmHistoryEntry {
  id: string;
  roundNumber: number;
  dealerScore: number;
  summary: string;
  playedAt: number;
}

export interface ClientVinteUmState {
  gameKind: 'vinteum';
  roomCode: string;
  hostId: string;
  maxPlayers: 1 | 2 | 4;
  phase: VinteUmPhase;
  myId: string;
  roundNumber: number;
  turnPlayerId: string | null;
  players: VinteUmPlayer[];
  dealerHand: Card[]; // empty until ROUND_OVER
  dealerCardCount: number;
  dealerCardsHidden: boolean;
  dealerScore: number | null;
  history: VinteUmHistoryEntry[];
  chat: ChatMessage[];
}
