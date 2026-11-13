import test from 'node:test';
import assert from 'node:assert/strict';
import {
  askTruco,
  chooseBotTrucoAction,
  compareCards,
  createInitialRoomState,
  decideMaoDe11,
  determineHandWinner,
  getManilhaRank,
  playCard,
  respondTruco,
  startNewHand,
  startNewMatch,
} from './truco';
import { Card } from './types';

test('getManilhaRank wraps from 3 to 4 and follows Paulista order', () => {
  assert.equal(getManilhaRank({ id: '4-clubs', rank: '4', suit: 'clubs' }), '5');
  assert.equal(getManilhaRank({ id: '7-hearts', rank: '7', suit: 'hearts' }), 'Q');
  assert.equal(getManilhaRank({ id: 'K-spades', rank: 'K', suit: 'spades' }), 'A');
  assert.equal(getManilhaRank({ id: '3-diamonds', rank: '3', suit: 'diamonds' }), '4');
});

test('compareCards respects manilha suit order and regular rank order', () => {
  const zap: Card = { id: '5-clubs', rank: '5', suit: 'clubs' };
  const copas: Card = { id: '5-hearts', rank: '5', suit: 'hearts' };
  const espadilha: Card = { id: '5-spades', rank: '5', suit: 'spades' };
  const ouros: Card = { id: '5-diamonds', rank: '5', suit: 'diamonds' };
  const three: Card = { id: '3-clubs', rank: '3', suit: 'clubs' };
  const four: Card = { id: '4-hearts', rank: '4', suit: 'hearts' };

  assert.equal(compareCards({ playerId: 'a', team: 0, card: zap }, { playerId: 'b', team: 1, card: copas }, '5'), 1);
  assert.equal(compareCards({ playerId: 'a', team: 0, card: espadilha }, { playerId: 'b', team: 1, card: ouros }, '5'), 1);
  assert.equal(compareCards({ playerId: 'a', team: 0, card: ouros }, { playerId: 'b', team: 1, card: three }, '5'), 1);
  assert.equal(compareCards({ playerId: 'a', team: 0, card: three }, { playerId: 'b', team: 1, card: four }, '5'), 1);
  assert.equal(
    compareCards(
      { playerId: 'a', team: 0, card: { id: 'A-hearts', rank: 'A', suit: 'hearts' } },
      { playerId: 'b', team: 1, card: { id: 'A-spades', rank: 'A', suit: 'spades' } },
      '5'
    ),
    0
  );
  assert.equal(
    compareCards({ playerId: 'a', team: 0, card: zap, faceDown: true }, { playerId: 'b', team: 1, card: four }, '5'),
    -1
  );
});

test('determineHandWinner handles standard wins and tie-breakers', () => {
  assert.deepEqual(determineHandWinner([0, 0, null]), { finished: true, winnerTeam: 0 });
  assert.deepEqual(determineHandWinner([0, 'tie', null]), { finished: true, winnerTeam: 0 });
  assert.deepEqual(determineHandWinner(['tie', 1, null]), { finished: true, winnerTeam: 1 });
  assert.deepEqual(determineHandWinner([0, 1, 'tie']), { finished: true, winnerTeam: 0 });
  assert.deepEqual(determineHandWinner(['tie', 'tie', 'tie']), { finished: true, winnerTeam: 'tie' });
  assert.deepEqual(determineHandWinner([0, 1, null]), { finished: false, winnerTeam: null });
});

test('truco -> seis -> accept -> win hand awards 6 points', () => {
  let room = createInitialRoomState('ABC123', {
    id: 'p1',
    name: 'Carlos',
    team: 0,
    connected: true,
    wins: 0,
  });
  room.players.push({
    id: 'p2',
    name: 'Ana',
    team: 1,
    connected: true,
    wins: 0,
  });

  room = startNewHand(room, () => 0.5);
  const firstTurn = room.turnPlayerId!;
  const secondTurn = firstTurn === 'p1' ? 'p2' : 'p1';
  const firstTeam = room.players.find((p) => p.id === firstTurn)!.team;

  room = askTruco(room, firstTurn).room;
  assert.equal(room.phase, 'TRUCO_CHALLENGE');
  assert.equal(room.challenge?.proposedBet, 3);

  room = respondTruco(room, secondTurn, 'raise').room;
  assert.equal(room.phase, 'TRUCO_CHALLENGE');
  assert.equal(room.challenge?.proposedBet, 6);

  room = respondTruco(room, firstTurn, 'accept').room;
  assert.equal(room.phase, 'PLAYING');
  assert.equal(room.currentBet, 6);

  const card1 = room.hands[firstTurn][0];
  room = playCard(room, firstTurn, card1.id).room;
  assert.ok(askTruco(room, secondTurn).error);

  const card2 = room.hands[secondTurn][0];
  room = playCard(room, secondTurn, card2.id).room;
  room.turnPlayerId = firstTurn;
  room = askTruco(room, firstTurn).room;
  assert.equal(room.challenge?.proposedBet, 9);

  room = respondTruco(room, secondTurn, 'run').room;
  assert.equal(room.phase, 'HAND_OVER');
  assert.equal(room.teamScores[firstTeam], 6);
});

test('4-player duplas mode resolves round by highest team card and records 12-point match victory', () => {
  let room = createInitialRoomState(
    'DUP444',
    { id: 'p1', name: 'Carlos', team: 0, connected: true, wins: 0 },
    4
  );
  room.players.push(
    { id: 'p2', name: 'Ana', team: 1, connected: true, wins: 0 },
    { id: 'p3', name: 'Beto', team: 0, connected: true, wins: 0 },
    { id: 'p4', name: 'Lua', team: 1, connected: true, wins: 0 }
  );
  room.teamScores = [11, 9];

  room = startNewHand(room, () => 0.2);
  assert.equal(room.phase, 'MAO_DE_11_DECISION');
  assert.equal(room.maoDe11Team, 0);

  room = decideMaoDe11(room, 'p3', true).room;
  assert.equal(room.phase, 'PLAYING');
  assert.equal(room.currentBet, 3);

  room.manilhaRank = '5';
  room.hands = {
    p1: [{ id: '5-clubs', rank: '5', suit: 'clubs' }, { id: '3-clubs', rank: '3', suit: 'clubs' }, { id: '4-clubs', rank: '4', suit: 'clubs' }],
    p2: [{ id: '4-diamonds', rank: '4', suit: 'diamonds' }, { id: '5-diamonds', rank: '5', suit: 'diamonds' }, { id: '6-diamonds', rank: '6', suit: 'diamonds' }],
    p3: [{ id: '5-hearts', rank: '5', suit: 'hearts' }, { id: '3-hearts', rank: '3', suit: 'hearts' }, { id: '4-hearts', rank: '4', suit: 'hearts' }],
    p4: [{ id: '4-spades', rank: '4', suit: 'spades' }, { id: '6-spades', rank: '6', suit: 'spades' }, { id: '7-spades', rank: '7', suit: 'spades' }],
  };
  room.turnPlayerId = 'p1';
  room.roundLeaderId = 'p1';

  // Round 1: p1 plays Zap, Team 0 wins R1
  room = playCard(room, 'p1', '5-clubs').room;
  room = playCard(room, 'p2', '4-diamonds').room;
  room = playCard(room, 'p3', '5-hearts').room;
  room = playCard(room, 'p4', '4-spades').room;
  assert.equal(room.roundOutcomes[0], 0);

  // Round 2: p1 leads 3-clubs, beats 5-diamonds? No, 5-diamonds is manilha! Wait: p3 has 3-hearts, p2 has 5-diamonds (manilha), so Team 1 wins R2
  // Let's play R2 and R3
  room = playCard(room, 'p1', '3-clubs').room;
  room = playCard(room, 'p2', '5-diamonds').room;
  room = playCard(room, 'p3', '3-hearts').room;
  room = playCard(room, 'p4', '6-spades').room;
  assert.equal(room.roundOutcomes[1], 1);

  // Round 3: p2 leads 6-diamonds, p3 plays 4-hearts, p4 plays 7-spades -> Team 1 wins
  room = playCard(room, 'p2', '6-diamonds').room;
  room = playCard(room, 'p3', '4-hearts').room;
  room = playCard(room, 'p4', '7-spades').room;
  room = playCard(room, 'p1', '4-clubs').room;

  assert.equal(room.phase, 'MATCH_OVER');
  assert.equal(room.matchWinnerTeam, 1);
  assert.equal(room.teamScores[1], 12);
  assert.equal(room.matchHistory.length, 1);

  room = startNewMatch(room, () => 0.3);
  assert.deepEqual(room.teamScores, [0, 0]);
  assert.equal(room.teamWins[1], 1);
  assert.equal(room.matchHistory.length, 1);
});

test('Guers Bot accepts Truco with K/A, won round, or medium cards instead of running', () => {
  let room = createInitialRoomState('BOTTEST', { id: 'p1', name: 'Carlos', team: 0, connected: true, wins: 0 }, 2);
  room = {
    ...room,
    players: [
      ...room.players,
      { id: 'bot', name: 'Guers Bot', team: 1, connected: true, isBot: true, wins: 0 },
    ],
  };
  room = startNewHand(room, () => 0.2);
  room.manilhaRank = '5';
  room.phase = 'TRUCO_CHALLENGE';
  room.challenge = {
    fromPlayerId: 'p1',
    fromTeam: 0,
    toTeam: 1,
    currentBet: 1,
    proposedBet: 3,
  };

  // With K (power 6), bot accepts
  room.hands.bot = [{ id: 'K-hearts', rank: 'K', suit: 'hearts' }];
  assert.deepEqual(chooseBotTrucoAction(room, 'bot', () => 0.9), {
    type: 'respond_truco',
    action: 'accept',
  });

  // Even with weak 4, if bot already won Round 1, bot accepts
  room.hands.bot = [{ id: '4-hearts', rank: '4', suit: 'hearts' }];
  room.roundOutcomes = [1, null, null];
  assert.deepEqual(chooseBotTrucoAction(room, 'bot', () => 0.9), {
    type: 'respond_truco',
    action: 'accept',
  });
});
