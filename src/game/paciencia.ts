import { FullCard, FullRank, Suit } from './types';
import { cryptoSecureRandom, SUIT_ORDER } from './truco';

export const FULL_RANKS: FullRank[] = [
  'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K',
];

export function isRedSuit(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

export function getRankNumber(rank: FullRank): number {
  return FULL_RANKS.indexOf(rank) + 1; // A=1 ... K=13
}

export function createFullDeck(): FullCard[] {
  const deck: FullCard[] = [];
  for (const suit of SUIT_ORDER) {
    for (const rank of FULL_RANKS) {
      deck.push({
        id: `${rank}-${suit}`,
        rank,
        suit,
        faceUp: false,
      });
    }
  }
  return deck;
}

export function shuffleFullDeck(
  deck: FullCard[],
  rng: () => number = cryptoSecureRandom
): FullCard[] {
  const copy = [...deck];
  for (let pass = 0; pass < 2; pass++) {
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
  }
  return copy;
}

export interface PacienciaState {
  stock: FullCard[];
  waste: FullCard[];
  foundations: [FullCard[], FullCard[], FullCard[], FullCard[]];
  tableau: FullCard[][];
  moves: number;
  won: boolean;
}

export function createPacienciaGame(
  rng: () => number = cryptoSecureRandom
): PacienciaState {
  const deck = shuffleFullDeck(createFullDeck(), rng);
  const tableau: FullCard[][] = [[], [], [], [], [], [], []];
  let idx = 0;

  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = { ...deck[idx++], faceUp: row === col };
      tableau[col].push(card);
    }
  }

  const stock = deck.slice(idx).map((c) => ({ ...c, faceUp: false }));

  return {
    stock,
    waste: [],
    foundations: [[], [], [], []],
    tableau,
    moves: 0,
    won: false,
  };
}

export function drawFromStock(state: PacienciaState): PacienciaState {
  if (state.stock.length === 0) {
    if (state.waste.length === 0) return state;
    // Recycle waste back to stock
    const recycled = [...state.waste]
      .reverse()
      .map((c) => ({ ...c, faceUp: false }));
    return {
      ...state,
      stock: recycled,
      waste: [],
      moves: state.moves + 1,
    };
  }

  const top = { ...state.stock[state.stock.length - 1], faceUp: true };
  return {
    ...state,
    stock: state.stock.slice(0, -1),
    waste: [...state.waste, top],
    moves: state.moves + 1,
  };
}

export function canMoveToFoundation(card: FullCard, pile: FullCard[]): boolean {
  if (pile.length === 0) {
    return card.rank === 'A';
  }
  const top = pile[pile.length - 1];
  return (
    card.suit === top.suit &&
    getRankNumber(card.rank) === getRankNumber(top.rank) + 1
  );
}

export function canMoveToTableau(card: FullCard, column: FullCard[]): boolean {
  if (column.length === 0) {
    return card.rank === 'K';
  }
  const top = column[column.length - 1];
  if (!top.faceUp) return false;
  return (
    isRedSuit(card.suit) !== isRedSuit(top.suit) &&
    getRankNumber(card.rank) === getRankNumber(top.rank) - 1
  );
}

export function checkPacienciaWin(foundations: PacienciaState['foundations']): boolean {
  return foundations.every((pile) => pile.length === 13);
}

export function moveCardToFoundation(
  state: PacienciaState,
  source: { zone: 'waste' } | { zone: 'tableau'; col: number },
  foundationIdx: number
): PacienciaState | null {
  const targetPile = state.foundations[foundationIdx];
  let movingCard: FullCard | undefined;

  if (source.zone === 'waste') {
    movingCard = state.waste[state.waste.length - 1];
  } else {
    const col = state.tableau[source.col];
    movingCard = col[col.length - 1];
  }

  if (!movingCard || !movingCard.faceUp) return null;
  if (!canMoveToFoundation(movingCard, targetPile)) return null;

  const nextFoundations = state.foundations.map((p, i) =>
    i === foundationIdx ? [...p, movingCard!] : p
  ) as PacienciaState['foundations'];

  let nextWaste = state.waste;
  let nextTableau = state.tableau;

  if (source.zone === 'waste') {
    nextWaste = state.waste.slice(0, -1);
  } else {
    nextTableau = state.tableau.map((col, idx) => {
      if (idx !== source.col) return col;
      const trimmed = col.slice(0, -1);
      if (trimmed.length > 0 && !trimmed[trimmed.length - 1].faceUp) {
        trimmed[trimmed.length - 1] = {
          ...trimmed[trimmed.length - 1],
          faceUp: true,
        };
      }
      return trimmed;
    });
  }

  return {
    ...state,
    waste: nextWaste,
    tableau: nextTableau,
    foundations: nextFoundations,
    moves: state.moves + 1,
    won: checkPacienciaWin(nextFoundations),
  };
}

export function moveCardsToTableau(
  state: PacienciaState,
  source:
    | { zone: 'waste' }
    | { zone: 'tableau'; col: number; cardIndex: number }
    | { zone: 'foundation'; foundationIdx: number },
  targetCol: number
): PacienciaState | null {
  const destColumn = state.tableau[targetCol];
  let movingStack: FullCard[] = [];

  if (source.zone === 'waste') {
    const top = state.waste[state.waste.length - 1];
    if (!top) return null;
    movingStack = [top];
  } else if (source.zone === 'foundation') {
    const pile = state.foundations[source.foundationIdx];
    const top = pile[pile.length - 1];
    if (!top) return null;
    movingStack = [top];
  } else {
    if (source.col === targetCol) return null;
    const srcCol = state.tableau[source.col];
    movingStack = srcCol.slice(source.cardIndex);
    if (movingStack.length === 0 || !movingStack[0].faceUp) return null;
  }

  if (!canMoveToTableau(movingStack[0], destColumn)) return null;

  let nextWaste = state.waste;
  let nextFoundations = state.foundations;
  const nextTableau = state.tableau.map((col) => [...col]);

  if (source.zone === 'waste') {
    nextWaste = state.waste.slice(0, -1);
  } else if (source.zone === 'foundation') {
    nextFoundations = state.foundations.map((p, i) =>
      i === source.foundationIdx ? p.slice(0, -1) : p
    ) as PacienciaState['foundations'];
  } else {
    const remaining = nextTableau[source.col].slice(0, source.cardIndex);
    if (remaining.length > 0 && !remaining[remaining.length - 1].faceUp) {
      remaining[remaining.length - 1] = {
        ...remaining[remaining.length - 1],
        faceUp: true,
      };
    }
    nextTableau[source.col] = remaining;
  }

  nextTableau[targetCol] = [...nextTableau[targetCol], ...movingStack];

  return {
    ...state,
    waste: nextWaste,
    foundations: nextFoundations,
    tableau: nextTableau,
    moves: state.moves + 1,
  };
}
