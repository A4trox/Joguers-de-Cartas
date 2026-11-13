import React, { useEffect, useState } from 'react';
import { LogOut, RotateCcw, Trophy, Undo2 } from 'lucide-react';
import {
  createPacienciaGame,
  drawFromStock,
  moveCardsToTableau,
  moveCardToFoundation,
  PacienciaState,
} from '../game/paciencia';
import { SUIT_SYMBOL } from '../game/truco';
import { PlayingCard } from './PlayingCard';

interface PacienciaTableProps {
  playerName: string;
  onExit: () => void;
}

type Selection =
  | { zone: 'waste' }
  | { zone: 'tableau'; col: number; cardIndex: number }
  | { zone: 'foundation'; foundationIdx: number }
  | null;

export const PacienciaTable: React.FC<PacienciaTableProps> = ({
  playerName,
  onExit,
}) => {
  const [game, setGame] = useState<PacienciaState>(() => createPacienciaGame());
  const [history, setHistory] = useState<PacienciaState[]>([]);
  const [selected, setSelected] = useState<Selection>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (game.won) return;
    const id = window.setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [game.won]);

  const applyMove = (next: PacienciaState | null) => {
    if (!next) return false;
    setHistory((prev) => [...prev.slice(-29), game]);
    setGame(next);
    setSelected(null);
    return true;
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setGame(prev);
    setSelected(null);
  };

  const handleRestart = () => {
    setGame(createPacienciaGame());
    setHistory([]);
    setSelected(null);
    setSeconds(0);
  };

  const handleAutoSendToFoundation = (
    source: { zone: 'waste' } | { zone: 'tableau'; col: number }
  ) => {
    for (let f = 0; f < 4; f++) {
      const next = moveCardToFoundation(game, source, f);
      if (next) {
        applyMove(next);
        return true;
      }
    }
    return false;
  };

  const handleFoundationClick = (foundationIdx: number) => {
    if (!selected) {
      if (game.foundations[foundationIdx].length > 0) {
        setSelected({ zone: 'foundation', foundationIdx });
      }
      return;
    }

    if (selected.zone === 'waste') {
      if (!applyMove(moveCardToFoundation(game, { zone: 'waste' }, foundationIdx))) {
        setSelected(null);
      }
      return;
    }

    if (selected.zone === 'tableau') {
      const col = game.tableau[selected.col];
      if (selected.cardIndex === col.length - 1) {
        if (
          !applyMove(
            moveCardToFoundation(game, { zone: 'tableau', col: selected.col }, foundationIdx)
          )
        ) {
          setSelected(null);
        }
      } else {
        setSelected(null);
      }
      return;
    }

    setSelected(null);
  };

  const handleTableauClick = (colIdx: number, cardIndex?: number) => {
    const col = game.tableau[colIdx];

    if (!selected) {
      if (cardIndex !== undefined && col[cardIndex]?.faceUp) {
        setSelected({ zone: 'tableau', col: colIdx, cardIndex });
      }
      return;
    }

    // Clicking same card again -> try auto-sending to foundation
    if (
      selected.zone === 'tableau' &&
      selected.col === colIdx &&
      selected.cardIndex === cardIndex &&
      cardIndex === col.length - 1
    ) {
      handleAutoSendToFoundation({ zone: 'tableau', col: colIdx });
      return;
    }

    if (applyMove(moveCardsToTableau(game, selected, colIdx))) {
      return;
    }

    // Otherwise switch selection if clicked a valid face-up card
    if (cardIndex !== undefined && col[cardIndex]?.faceUp) {
      setSelected({ zone: 'tableau', col: colIdx, cardIndex });
    } else {
      setSelected(null);
    }
  };

  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');

  return (
    <div className="min-h-screen felt-table-bg flex flex-col select-none">
      {/* Top Bar */}
      <header className="w-full px-4 sm:px-6 py-3 bg-[#071D15]/90 border-b border-emerald-800/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-display font-bold text-white text-base sm:text-lg">
            Joguers de Cartas · Paciência
          </span>
          <span className="text-xs text-emerald-200/70 hidden sm:inline">
            {playerName}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs sm:text-sm font-mono-num text-emerald-100">
          <span>Movimentos: <strong className="text-amber-300">{game.moves}</strong></span>
          <span>Tempo: <strong className="text-white">{mins}:{secs}</strong></span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={history.length === 0}
            aria-label="Desfazer jogada"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-xs sm:text-sm font-medium text-emerald-100 disabled:opacity-40 transition-colors"
          >
            <Undo2 className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Desfazer</span>
          </button>

          <button
            type="button"
            onClick={handleRestart}
            aria-label="Novo jogo"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-xs sm:text-sm font-medium text-emerald-100 transition-colors"
          >
            <RotateCcw className="w-4 h-4 text-amber-300" aria-hidden="true" />
            <span className="hidden sm:inline">Novo Jogo</span>
          </button>

          <button
            type="button"
            onClick={onExit}
            aria-label="Voltar ao início"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-950/80 hover:bg-rose-950/90 border border-emerald-700/60 hover:border-rose-700/60 text-xs sm:text-sm font-medium text-emerald-100 hover:text-rose-100 transition-colors"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      {/* Solitaire Board */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-6 py-5 space-y-6">
        {/* Top Row: Stock + Waste & 4 Foundations */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {/* Stock */}
            <button
              type="button"
              onClick={() => {
                setHistory((h) => [...h.slice(-29), game]);
                setGame(drawFromStock(game));
                setSelected(null);
              }}
              aria-label={
                game.stock.length > 0
                  ? `Comprar carta do monte (${game.stock.length} restantes)`
                  : 'Reciclar descarte para o monte'
              }
              className="relative"
            >
              {game.stock.length > 0 ? (
                <PlayingCard faceDown size="xs" />
              ) : (
                <div className="w-14 h-20 sm:w-16 sm:h-24 rounded-lg border-2 border-dashed border-emerald-600/70 bg-emerald-950/40 flex items-center justify-center text-emerald-300">
                  <RotateCcw className="w-5 h-5" aria-hidden="true" />
                </div>
              )}
              <span className="absolute -bottom-5 left-0 right-0 text-center text-[10px] font-mono-num text-emerald-200/70">
                {game.stock.length}
              </span>
            </button>

            {/* Waste */}
            <div>
              {game.waste.length > 0 ? (
                <PlayingCard
                  card={game.waste[game.waste.length - 1]}
                  size="xs"
                  playable
                  selected={selected?.zone === 'waste'}
                  onClick={() => {
                    if (selected?.zone === 'waste') {
                      if (!handleAutoSendToFoundation({ zone: 'waste' })) {
                        setSelected(null);
                      }
                    } else {
                      setSelected({ zone: 'waste' });
                    }
                  }}
                />
              ) : (
                <div className="w-14 h-20 sm:w-16 sm:h-24 rounded-lg border-2 border-dashed border-emerald-800/60 bg-emerald-950/20" />
              )}
            </div>
          </div>

          {/* 4 Foundations */}
          <div className="flex items-center gap-2 sm:gap-3" aria-label="Fundações">
            {game.foundations.map((pile, idx) => {
              const top = pile[pile.length - 1];
              const isSelected =
                selected?.zone === 'foundation' && selected.foundationIdx === idx;
              return top ? (
                <PlayingCard
                  key={idx}
                  card={top}
                  size="xs"
                  playable
                  selected={isSelected}
                  onClick={() => handleFoundationClick(idx)}
                />
              ) : (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleFoundationClick(idx)}
                  aria-label={`Fundação ${idx + 1} (vazia, comece com Ás)`}
                  className="w-14 h-20 sm:w-16 sm:h-24 rounded-lg border-2 border-dashed border-emerald-700/60 bg-emerald-950/35 hover:border-amber-400/60 flex items-center justify-center text-emerald-200/40 font-bold text-lg transition-colors"
                >
                  A{SUIT_SYMBOL[(['diamonds', 'spades', 'hearts', 'clubs'] as const)[idx]]}
                </button>
              );
            })}
          </div>
        </div>

        {/* 7 Tableau Columns */}
        <div
          aria-label="Colunas do tabuleiro"
          className="grid grid-cols-7 gap-1.5 sm:gap-3 pt-2"
        >
          {game.tableau.map((col, colIdx) => (
            <div key={colIdx} className="flex flex-col items-center min-h-[260px]">
              {col.length === 0 ? (
                <button
                  type="button"
                  onClick={() => handleTableauClick(colIdx)}
                  aria-label={`Coluna ${colIdx + 1} vazia (aceita Rei)`}
                  className="w-14 h-20 sm:w-16 sm:h-24 rounded-lg border-2 border-dashed border-emerald-800/60 bg-emerald-950/20 hover:border-amber-400/50 flex items-center justify-center text-xs text-emerald-200/40 font-bold"
                >
                  K
                </button>
              ) : (
                col.map((card, cardIdx) => {
                  const isSelected =
                    selected?.zone === 'tableau' &&
                    selected.col === colIdx &&
                    cardIdx >= selected.cardIndex;

                  return (
                    <div
                      key={card.id}
                      style={{ marginTop: cardIdx === 0 ? 0 : card.faceUp ? '-3.4rem' : '-4.1rem' }}
                      className="relative"
                    >
                      <PlayingCard
                        card={card}
                        faceDown={!card.faceUp}
                        size="xs"
                        playable={card.faceUp}
                        selected={isSelected}
                        onClick={
                          card.faceUp
                            ? () => handleTableauClick(colIdx, cardIdx)
                            : undefined
                        }
                      />
                    </div>
                  );
                })
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-emerald-200/60">
          Dica: clique em uma carta para selecionar e clique no destino. Clique duas vezes na mesma carta para enviá-la direto à fundação.
        </p>
      </main>

      {/* Victory Modal */}
      {game.won && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Vitória na Paciência"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <div className="w-full max-w-sm bg-[#0D2E22] border border-amber-400/60 rounded-2xl p-6 text-center shadow-2xl space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-400/15 border border-amber-400/50 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-amber-300" aria-hidden="true" />
            </div>
            <h2 className="font-display text-2xl font-bold text-white">
              Parabéns, {playerName}!
            </h2>
            <p className="text-sm text-emerald-100/80 font-mono-num">
              Você completou a Paciência em {game.moves} movimentos ({mins}:{secs}).
            </p>
            <button
              type="button"
              onClick={handleRestart}
              className="w-full py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm transition-colors"
            >
              Jogar Novamente
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
