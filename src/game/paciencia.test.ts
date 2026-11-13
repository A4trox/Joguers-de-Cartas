import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canMoveToFoundation,
  canMoveToTableau,
  createPacienciaGame,
  drawFromStock,
  moveCardToFoundation,
} from './paciencia';

test('createPacienciaGame deals 7 tableau columns (1..7) and 24 stock cards', () => {
  const game = createPacienciaGame(() => 0.4);
  assert.equal(game.tableau.length, 7);
  for (let i = 0; i < 7; i++) {
    assert.equal(game.tableau[i].length, i + 1);
    assert.equal(game.tableau[i][i].faceUp, true);
  }
  assert.equal(game.stock.length, 24);
  assert.equal(game.waste.length, 0);
});

test('drawFromStock moves card to waste and recycles when empty', () => {
  let game = createPacienciaGame(() => 0.2);
  for (let i = 0; i < 24; i++) {
    game = drawFromStock(game);
  }
  assert.equal(game.stock.length, 0);
  assert.equal(game.waste.length, 24);
  assert.equal(game.waste[23].faceUp, true);

  game = drawFromStock(game);
  assert.equal(game.stock.length, 24);
  assert.equal(game.waste.length, 0);
});

test('foundation and tableau move rules validate suit, color, and rank', () => {
  const aceHearts = { id: 'A-hearts', rank: 'A' as const, suit: 'hearts' as const, faceUp: true };
  const twoHearts = { id: '2-hearts', rank: '2' as const, suit: 'hearts' as const, faceUp: true };
  const kingSpades = { id: 'K-spades', rank: 'K' as const, suit: 'spades' as const, faceUp: true };
  const queenHearts = { id: 'Q-hearts', rank: 'Q' as const, suit: 'hearts' as const, faceUp: true };

  assert.equal(canMoveToFoundation(aceHearts, []), true);
  assert.equal(canMoveToFoundation(twoHearts, []), false);
  assert.equal(canMoveToFoundation(twoHearts, [aceHearts]), true);

  assert.equal(canMoveToTableau(kingSpades, []), true);
  assert.equal(canMoveToTableau(queenHearts, []), false);
  assert.equal(canMoveToTableau(queenHearts, [kingSpades]), true);

  const game = createPacienciaGame(() => 0.1);
  game.waste = [aceHearts];
  const moved = moveCardToFoundation(game, { zone: 'waste' }, 0);
  assert.ok(moved !== null);
  assert.equal(moved!.foundations[0].length, 1);
});
