import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateVinteUmScore,
  createInitialVinteUmRoom,
  getVinteUmCardValue,
  hitVinteUm,
  standVinteUm,
  startVinteUmRound,
  stepDealerVinteUm,
  toClientVinteUmState,
} from './vinteum';
import { createDeck } from './truco';

test('Modo 21 deck has no 8, 9, or 10 and face cards equal 10', () => {
  const deck = createDeck();
  assert.equal(deck.length, 40);
  assert.equal(deck.some((c) => ['8', '9', '10'].includes(c.rank as string)), false);
  assert.equal(getVinteUmCardValue({ id: 'Q-hearts', rank: 'Q', suit: 'hearts' }), 10);
  assert.equal(getVinteUmCardValue({ id: 'J-spades', rank: 'J', suit: 'spades' }), 10);
  assert.equal(getVinteUmCardValue({ id: 'K-clubs', rank: 'K', suit: 'clubs' }), 10);
});

test('calculateVinteUmScore adjusts Aces from 11 to 1 when over 21', () => {
  assert.equal(
    calculateVinteUmScore([
      { id: 'A-spades', rank: 'A', suit: 'spades' },
      { id: 'K-hearts', rank: 'K', suit: 'hearts' },
    ]),
    21
  );
  assert.equal(
    calculateVinteUmScore([
      { id: 'A-spades', rank: 'A', suit: 'spades' },
      { id: 'A-hearts', rank: 'A', suit: 'hearts' },
      { id: 'Q-clubs', rank: 'Q', suit: 'clubs' },
    ]),
    12
  );
});

test('Modo 21 hides all dealer and opponent cards until ROUND_OVER and steps dealer one card at a time', () => {
  let room = createInitialVinteUmRoom('V21DUO', { id: 'p1', name: 'Carlos' }, 2);
  room = {
    ...room,
    players: [
      ...room.players,
      {
        id: 'p2',
        name: 'Ana',
        connected: true,
        hand: [],
        status: 'playing',
        score: 0,
        wins: 0,
        lastOutcome: null,
      },
    ],
  };
  room = startVinteUmRound(room, () => 0.3);
  assert.equal(room.roundNumber, 1);

  const clientP1 = toClientVinteUmState(room, 'p1');
  assert.equal(clientP1.dealerCardsHidden, true);
  assert.equal(clientP1.dealerHand.length, 0);
  assert.equal(clientP1.dealerCardCount, 2);
  assert.equal(clientP1.dealerScore, null);
  assert.equal(clientP1.players[0].hand.length, 2);
  assert.equal(clientP1.players[1].hand.length, 0);
  assert.equal(clientP1.players[1].cardCount, 2);
  assert.equal(clientP1.players[1].score, null);

  if (room.phase === 'PLAYER_TURNS' && room.turnPlayerId === 'p1') {
    const hitRes = hitVinteUm(room, 'p1');
    assert.equal(hitRes.error, undefined);
    room = hitRes.room;
    const clientP2 = toClientVinteUmState(room, 'p2');
    assert.equal(clientP2.players[0].hand.length, 0);
    assert.equal(clientP2.players[0].cardCount, 3);
  }

  if (room.phase === 'PLAYER_TURNS' && room.turnPlayerId === 'p1') {
    room = standVinteUm(room, 'p1').room;
  }
  if (room.phase === 'PLAYER_TURNS' && room.turnPlayerId === 'p2') {
    room = standVinteUm(room, 'p2').room;
  }

  assert.equal(room.phase, 'DEALER_TURN');
  let guard = 0;
  let done = false;
  while (!done && guard < 15) {
    const prevCount = room.dealerHand.length;
    const step = stepDealerVinteUm(room);
    room = step.room;
    done = step.done;
    if (!done) {
      assert.equal(room.dealerHand.length, prevCount + 1);
    }
    guard += 1;
  }

  assert.equal(room.phase, 'ROUND_OVER');
  assert.equal(room.history.length, 1);
  const revealed = toClientVinteUmState(room, 'p1');
  assert.equal(revealed.dealerCardsHidden, false);
  assert.equal(revealed.dealerHand.length, revealed.dealerCardCount);
  assert.ok(revealed.dealerScore !== null);
  assert.equal(revealed.players[1].hand.length, revealed.players[1].cardCount);
});

test('Modo 21 lets busted player click Parar, dealer still plays, and double bust awards no points', () => {
  let room = createInitialVinteUmRoom('V21BUST', { id: 'p1', name: 'Carlos' }, 1);
  room = {
    ...room,
    phase: 'PLAYER_TURNS',
    roundNumber: 1,
    turnPlayerId: 'p1',
    players: [
      {
        id: 'p1',
        name: 'Carlos',
        connected: true,
        hand: [
          { id: 'K-spades', rank: 'K', suit: 'spades' },
          { id: 'Q-hearts', rank: 'Q', suit: 'hearts' },
        ],
        status: 'playing',
        score: 20,
        wins: 0,
        lastOutcome: null,
      },
    ],
    dealerHand: [
      { id: '6-clubs', rank: '6', suit: 'clubs' },
      { id: '7-diamonds', rank: '7', suit: 'diamonds' },
    ],
    deck: [
      { id: '5-spades', rank: '5', suit: 'spades' }, // p1 hits -> 25 (busted)
      { id: 'J-clubs', rank: 'J', suit: 'clubs' },   // dealer hits -> 23 (busted)
    ],
  };

  // Player hits and busts -> still their turn until they click Parar
  const hitRes = hitVinteUm(room, 'p1');
  assert.equal(hitRes.error, undefined);
  room = hitRes.room;
  assert.equal(room.players[0].status, 'busted');
  assert.equal(room.phase, 'PLAYER_TURNS');
  assert.equal(room.turnPlayerId, 'p1');

  // Player clicks Parar -> advances to DEALER_TURN
  const standRes = standVinteUm(room, 'p1');
  assert.equal(standRes.error, undefined);
  room = standRes.room;
  assert.equal(room.phase, 'DEALER_TURN');
  assert.equal(room.players[0].status, 'busted');

  // Dealer steps and busts too
  const step1 = stepDealerVinteUm(room, () => 0.9);
  assert.equal(step1.done, false);
  const step2 = stepDealerVinteUm(step1.room, () => 0.9);
  assert.equal(step2.done, true);
  room = step2.room;

  assert.equal(room.phase, 'ROUND_OVER');
  assert.equal(room.players[0].wins, 0);
  assert.equal(room.players[0].lastOutcome, 'push');
  assert.match(room.history[0].summary, /Ninguém pontuou/i);
});
