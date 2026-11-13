import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  History,
  LogOut,
  Play,
  RotateCcw,
  Share2,
  Trophy,
  X,
} from 'lucide-react';
import { ClientVinteUmState } from '../game/types';
import { PlayingCard } from './PlayingCard';
import { ChatDrawer } from './ChatDrawer';
import { VolumeControl } from './VolumeControl';
import { playTone } from '../utils/sound';

interface VinteUmTableProps {
  state: ClientVinteUmState;
  isConnected: boolean;
  volume: number;
  isChatOpen: boolean;
  unreadChatCount: number;
  onChangeVolume: (next: number) => void;
  onToggleChat: () => void;
  onSendChat: (text: string) => void;
  onStartGroup: () => void;
  onHit: () => void;
  onStand: () => void;
  onNextRound: () => void;
  onLeaveRoom: () => void;
}

export const VinteUmTable: React.FC<VinteUmTableProps> = ({
  state,
  isConnected,
  volume,
  isChatOpen,
  unreadChatCount,
  onChangeVolume,
  onToggleChat,
  onSendChat,
  onStartGroup,
  onHit,
  onStand,
  onNextRound,
  onLeaveRoom,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const isSolo = state.maxPlayers === 1;
  const isMyTurn = state.phase === 'PLAYER_TURNS' && state.turnPlayerId === state.myId;
  const myPlayer = state.players.find((p) => p.id === state.myId);
  const isMyTurnBusted = isMyTurn && myPlayer?.status === 'busted';
  const isHost = state.hostId === state.myId;
  const currentTurnPlayer = state.players.find((p) => p.id === state.turnPlayerId);

  const prevCountsRef = useRef<{ dealer: number; players: Record<string, number> } | null>(null);
  useEffect(() => {
    const playerCounts: Record<string, number> = {};
    for (const p of state.players) {
      playerCounts[p.id] = p.cardCount ?? p.hand.length;
    }

    if (prevCountsRef.current) {
      const dealerGrew = state.dealerCardCount > prevCountsRef.current.dealer;
      const anyPlayerGrew = state.players.some(
        (p) => (p.cardCount ?? p.hand.length) > (prevCountsRef.current!.players[p.id] ?? 0)
      );
      if (dealerGrew || anyPlayerGrew) {
        playTone('card', volume);
      }
    }
    prevCountsRef.current = { dealer: state.dealerCardCount, players: playerCounts };
  }, [state.dealerCardCount, state.players, volume]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(state.roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?sala=${state.roomCode}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div className="h-dvh felt-table-bg flex flex-col justify-between overflow-hidden select-none">
      {/* Top Bar */}
      <header className="shrink-0 w-full px-4 sm:px-6 py-3 bg-[#071D15]/90 border-b border-emerald-800/60 flex flex-wrap items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-3">
          <span className="font-display font-bold text-white text-base sm:text-lg">
            Joguers de Cartas · 21
          </span>
          {!isSolo && (
            <button
              type="button"
              onClick={handleCopyCode}
              aria-label={`Copiar código da sala ${state.roomCode}`}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/90 border border-emerald-700/60 hover:border-amber-400/60 transition-colors text-xs sm:text-sm"
            >
              <span className="text-emerald-200/70">Sala</span>
              <span className="font-mono-num font-bold tracking-wider text-amber-300">
                {state.roomCode}
              </span>
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-emerald-200/70" aria-hidden="true" />
              )}
            </button>
          )}
          {!isConnected && (
            <span className="text-xs text-rose-300 font-medium">Reconectando...</span>
          )}
        </div>

        <div className="text-xs sm:text-sm text-emerald-100/80 font-mono-num">
          Rodada #{state.roundNumber || 1} · Baralho limpo (figuras = 10)
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            aria-label="Abrir histórico de placar"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-xs sm:text-sm font-medium text-emerald-100 transition-colors whitespace-nowrap"
          >
            <History className="w-4 h-4 text-amber-300" aria-hidden="true" />
            <span className="hidden sm:inline">Histórico</span>
          </button>

          <button
            type="button"
            onClick={onLeaveRoom}
            aria-label="Sair da sala"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-950/80 hover:bg-rose-950/90 border border-emerald-700/60 hover:border-rose-700/60 text-xs sm:text-sm font-medium text-emerald-100 hover:text-rose-100 transition-colors whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      {state.phase === 'WAITING_PLAYERS' ? (
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#092219]/95 border border-emerald-700/60 rounded-2xl p-6 sm:p-8 text-center shadow-2xl space-y-5">
            <h2 className="font-display text-2xl font-bold text-white">
              Sala de 21 ({state.players.length}/{state.maxPlayers})
            </h2>
            <p className="text-sm text-emerald-100/80">
              Compartilhe o código abaixo para os outros jogadores entrarem:
            </p>

            <div className="bg-emerald-950 border border-emerald-700/70 rounded-xl py-4 px-5 flex items-center justify-between">
              <span className="font-mono-num text-3xl font-bold tracking-[0.2em] text-amber-300">
                {state.roomCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-xs font-semibold text-white transition-colors"
              >
                {copiedCode ? 'Copiado!' : 'Copiar'}
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors"
            >
              <Share2 className="w-4 h-4" aria-hidden="true" />
              <span>{copiedLink ? 'Link copiado!' : 'Copiar Link de Convite'}</span>
            </button>

            <div className="text-left space-y-1.5 pt-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-200/70">
                Jogadores na sala
              </span>
              <ul className="space-y-1.5">
                {state.players.map((p) => (
                  <li
                    key={p.id}
                    className="px-3 py-2 rounded-lg bg-emerald-950/70 text-sm text-white flex items-center justify-between"
                  >
                    <span>{p.name}</span>
                    <span className="text-xs text-emerald-300">Pronto</span>
                  </li>
                ))}
              </ul>
            </div>

            {isHost && state.players.length >= 2 && (
              <button
                type="button"
                onClick={onStartGroup}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm transition-colors"
              >
                <Play className="w-4 h-4" aria-hidden="true" />
                <span>Iniciar Rodada Agora</span>
              </button>
            )}
          </div>
        </main>
      ) : (
        <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col justify-between items-center px-4 py-5 max-w-6xl w-full mx-auto">
          {/* Dealer (Banca) Zone */}
          <section aria-label="Cartas da Banca" className="flex flex-col items-center gap-2.5">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-semibold text-emerald-100">Banca (Guers Bot)</span>
              <span className="font-mono-num font-bold text-amber-300">
                {state.dealerCardsHidden || state.dealerScore === null
                  ? '?? pts'
                  : `${state.dealerScore} pts${state.dealerScore > 21 ? ' · Estourou!' : ''}`}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {state.dealerCardsHidden
                ? Array.from({ length: state.dealerCardCount }).map((_, idx) => (
                    <PlayingCard key={`dealer-hidden-${idx}`} faceDown size="md" />
                  ))
                : state.dealerHand.map((card) => (
                    <PlayingCard key={card.id} card={card} size="md" />
                  ))}
            </div>
          </section>

          {/* Status Banner */}
          <div
            role="status"
            aria-live="polite"
            className="px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold border bg-[#092219]/90 text-amber-200 border-emerald-700/60 my-2"
          >
            {state.phase === 'ROUND_OVER'
              ? state.history[0]?.summary || 'Rodada encerrada'
              : state.phase === 'DEALER_TURN'
              ? 'Vez da Banca (Guers Bot)...'
              : isMyTurnBusted
              ? 'Você estourou (>21)! Clique em Parar para passar a vez.'
              : isMyTurn
              ? 'Sua vez! Peça uma carta ou pare.'
              : `Vez de ${currentTurnPlayer?.name || 'outro jogador'}...`}
          </div>

          {/* Players Grid */}
          <section
            aria-label="Jogadores"
            className={`w-full grid gap-4 pb-16 sm:pb-4 ${
              state.players.length === 1
                ? 'grid-cols-1 max-w-md mx-auto'
                : state.players.length === 2
                ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            }`}
          >
            {state.players.map((p) => {
              const isMe = p.id === state.myId;
              const isTurn = state.phase === 'PLAYER_TURNS' && state.turnPlayerId === p.id;
              let outcomeLabel = '';
              let outcomeColor = 'text-emerald-200/70';
              if (p.lastOutcome === 'win') {
                outcomeLabel = 'Venceu!';
                outcomeColor = 'text-emerald-300';
              } else if (p.lastOutcome === 'push') {
                outcomeLabel = p.status === 'busted' ? 'Sem pontos' : 'Empate';
                outcomeColor = 'text-amber-300';
              } else if (p.lastOutcome === 'lose') {
                outcomeLabel = 'Perdeu';
                outcomeColor = 'text-rose-300';
              } else if (p.status === 'busted') {
                outcomeLabel = 'Estourou (>21)';
                outcomeColor = 'text-rose-300';
              } else if (p.status === 'blackjack') {
                outcomeLabel = '21!';
                outcomeColor = 'text-amber-300';
              } else if (p.status === 'stood') {
                outcomeLabel = 'Parou';
                outcomeColor = 'text-emerald-200';
              }

              return (
                <div
                  key={p.id}
                  className={`rounded-2xl p-4 border transition-colors ${
                    isTurn
                      ? 'bg-[#0D3828] border-amber-400/70 shadow-xl'
                      : 'bg-[#092219]/85 border-emerald-800/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white truncate">
                          {p.name} {isMe ? '(Você)' : ''}
                        </span>
                      </div>
                      <span className="text-xs text-emerald-200/60 font-mono-num">
                        {p.wins} {p.wins === 1 ? 'vitória' : 'vitórias'}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono-num text-xl font-bold text-amber-300">
                        {p.score === null ? '??' : p.score}
                      </div>
                      {outcomeLabel && (
                        <div className={`text-xs font-semibold ${outcomeColor}`}>
                          {outcomeLabel}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {isMe || state.phase === 'ROUND_OVER'
                      ? p.hand.map((card) => (
                          <PlayingCard key={card.id} card={card} size="sm" />
                        ))
                      : Array.from({ length: p.cardCount ?? p.hand.length }).map((_, idx) => (
                          <PlayingCard key={`opp-${p.id}-${idx}`} faceDown size="sm" />
                        ))}
                  </div>
                </div>
              );
            })}
          </section>
        </main>
      )}

      {/* Bottom-Right Action Controls */}
      {state.phase !== 'WAITING_PLAYERS' && (
        <div
          aria-label="Ações do 21"
          className="fixed bottom-4 right-4 sm:right-6 z-30 flex items-center gap-2.5"
        >
          {isMyTurn && (
            <>
              {!isMyTurnBusted && (
                <button
                  type="button"
                  onClick={onHit}
                  className="px-5 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-base shadow-2xl transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97] whitespace-nowrap"
                >
                  Pedir Carta
                </button>
              )}
              <button
                type="button"
                onClick={onStand}
                className="px-5 py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-base shadow-2xl border border-emerald-500/60 transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97] whitespace-nowrap"
              >
                {isMyTurnBusted ? 'Parar (Estourou)' : 'Parar'}
              </button>
            </>
          )}

          {state.phase === 'ROUND_OVER' && (
            <button
              type="button"
              onClick={onNextRound}
              className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-base shadow-2xl whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Nova Rodada</span>
            </button>
          )}
        </div>
      )}

      {/* Lateral Volume Control */}
      <VolumeControl volume={volume} onChangeVolume={onChangeVolume} />

      {/* Chat Drawer (only in multiplayer rooms) */}
      {!isSolo && (
        <ChatDrawer
          messages={state.chat}
          myId={state.myId}
          isOpen={isChatOpen}
          unreadCount={unreadChatCount}
          onToggle={onToggleChat}
          onSendMessage={onSendChat}
        />
      )}

      {/* History Modal */}
      {historyOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Histórico do 21"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setHistoryOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-[#0D2E22] border border-emerald-700/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-800/70 bg-[#092219]">
              <div className="flex items-center gap-2.5">
                <Trophy className="w-5 h-5 text-amber-300" aria-hidden="true" />
                <h2 className="text-lg font-display font-bold text-white">
                  Histórico — Modo 21
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                aria-label="Fechar histórico"
                className="p-1.5 rounded-lg text-emerald-200/80 hover:text-white hover:bg-emerald-800/50"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {state.players.map((p) => (
                  <div
                    key={p.id}
                    className="bg-[#092219] border border-emerald-800/70 rounded-xl p-3 flex items-center justify-between"
                  >
                    <span className="font-semibold text-white truncate pr-2">{p.name}</span>
                    <span className="font-mono-num font-bold text-amber-300">{p.wins} vitórias</span>
                  </div>
                ))}
              </div>

              {state.history.length === 0 ? (
                <p className="text-sm text-emerald-200/60 text-center py-4">
                  Nenhuma rodada finalizada ainda.
                </p>
              ) : (
                <ul className="space-y-2">
                  {state.history.map((h) => (
                    <li
                      key={h.id}
                      className="px-3.5 py-2.5 rounded-xl bg-[#092219] border border-emerald-800/60 text-sm flex items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-mono-num text-xs text-emerald-200/50 mr-2">
                          #{h.roundNumber}
                        </span>
                        <span className="text-white">{h.summary}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
