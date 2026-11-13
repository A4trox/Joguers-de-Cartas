import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  EyeOff,
  History,
  LogOut,
  Play,
  RotateCcw,
  Share2,
  Trophy,
  X,
} from 'lucide-react';
import { ClientGameState, PlayedCard } from '../game/types';
import { getBetLabel, getNextBetValue, getTeamLabel } from '../game/truco';
import { PlayingCard } from './PlayingCard';
import { ChatDrawer } from './ChatDrawer';
import { ScoreHistoryModal } from './ScoreHistoryModal';
import { VolumeControl } from './VolumeControl';

interface GameTableProps {
  state: ClientGameState;
  isConnected: boolean;
  volume: number;
  isChatOpen: boolean;
  unreadChatCount: number;
  onChangeVolume: (next: number) => void;
  onToggleChat: () => void;
  onSendChat: (text: string) => void;
  onStartTeamMatch: () => void;
  onPlayCard: (cardId: string, faceDown: boolean) => void;
  onAskTruco: () => void;
  onRespondTruco: (action: 'accept' | 'run' | 'raise') => void;
  onDecideMaoDe11: (accept: boolean) => void;
  onNextHand: () => void;
  onNewMatch: () => void;
  onLeaveRoom: () => void;
}

function getCasualCardTransform(cardId: string, roundIdx: number, playIdx: number) {
  let hash = 0;
  for (let i = 0; i < cardId.length; i++) {
    hash = (hash * 31 + cardId.charCodeAt(i)) | 0;
  }
  const angle = ((Math.abs(hash) % 13) - 6) + (playIdx % 2 === 0 ? -1.5 : 1.5);
  const offsetX = ((Math.abs(hash >> 3) % 11) - 5) + roundIdx * 4;
  const offsetY = ((Math.abs(hash >> 5) % 9) - 4) + (playIdx % 2 === 0 ? -2 : 2);
  return { angle, offsetX, offsetY };
}

export const GameTable: React.FC<GameTableProps> = ({
  state,
  isConnected,
  volume,
  isChatOpen,
  unreadChatCount,
  onChangeVolume,
  onToggleChat,
  onSendChat,
  onStartTeamMatch,
  onPlayCard,
  onAskTruco,
  onRespondTruco,
  onDecideMaoDe11,
  onNextHand,
  onNewMatch,
  onLeaveRoom,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [playFaceDown, setPlayFaceDown] = useState(false);
  const [victoryModalDismissed, setVictoryModalDismissed] = useState(false);

  useEffect(() => {
    if (state.phase !== 'MATCH_OVER') {
      setVictoryModalDismissed(false);
    }
  }, [state.phase]);

  const isSoloBot = state.players.some((p) => p.isBot);
  const isHost = state.hostId === state.myId;
  const myTeam = state.myTeam;
  const oppTeam: 0 | 1 = myTeam === 0 ? 1 : 0;

  const myTeamLabel = getTeamLabel(state.players, myTeam);
  const oppTeamLabel = getTeamLabel(state.players, oppTeam);
  const otherPlayers = state.players.filter((p) => p.id !== state.myId);
  const currentTurnPlayer = state.players.find((p) => p.id === state.turnPlayerId);

  const isMyTurn = state.phase === 'PLAYING' && state.turnPlayerId === state.myId;
  const someoneAt11 = state.teamScores[0] === 11 || state.teamScores[1] === 11;
  const nextBet = getNextBetValue(state.currentBet);
  const canAskTruco =
    isMyTurn &&
    !someoneAt11 &&
    nextBet !== null &&
    state.lastRaiseByTeam !== myTeam;

  const isChallengeForMyTeam =
    state.phase === 'TRUCO_CHALLENGE' &&
    state.challenge?.toTeam === myTeam;

  const isChallengeFromMyTeam =
    state.phase === 'TRUCO_CHALLENGE' &&
    state.challenge?.fromTeam === myTeam;

  const isMyMaoDe11 =
    state.phase === 'MAO_DE_11_DECISION' &&
    state.maoDe11Team === myTeam;

  const canPlayFaceDown = isMyTurn && state.currentRound > 0;

  // Combine all rounds played in this hand so Round 1 cards remain casually visible on the felt
  const allRoundsOnTable: { roundIdx: number; plays: PlayedCard[]; isCurrent: boolean }[] = [
    ...state.previousRoundCards.map((plays, idx) => ({
      roundIdx: idx,
      plays,
      isCurrent: false,
    })),
    ...(state.tableCards.length > 0
      ? [{ roundIdx: state.currentRound, plays: state.tableCards, isCurrent: true }]
      : []),
  ];

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(state.roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleCopyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?sala=${state.roomCode}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleCardClick = (cardId: string) => {
    if (!isMyTurn) return;
    onPlayCard(cardId, canPlayFaceDown && playFaceDown);
    setPlayFaceDown(false);
  };

  let statusBanner = '';
  if (state.phase === 'WAITING_OPPONENT') {
    statusBanner = 'Aguardando jogadores entrarem na sala...';
  } else if (state.phase === 'MAO_DE_11_DECISION') {
    statusBanner = isMyMaoDe11
      ? 'Mão de 11! Veja suas cartas e decida se jogam valendo 3 pontos.'
      : `${oppTeamLabel} está decidindo a Mão de 11...`;
  } else if (state.phase === 'TRUCO_CHALLENGE' && state.challenge) {
    const label = getBetLabel(state.challenge.proposedBet).toUpperCase();
    const asker = state.players.find((p) => p.id === state.challenge?.fromPlayerId);
    statusBanner = isChallengeForMyTeam
      ? `${asker?.name || 'Oponente'} pediu ${label}!`
      : `Sua equipe pediu ${label}! Aguardando resposta...`;
  } else if (state.phase === 'HAND_OVER') {
    statusBanner =
      state.handWinnerTeam !== null
        ? `${state.handWinnerTeam === myTeam ? 'Sua equipe' : oppTeamLabel} venceu a mão! (${state.handResultReason})`
        : state.handResultReason || 'Mão empatada!';
  } else if (state.phase === 'MATCH_OVER') {
    statusBanner =
      state.matchWinnerTeam === myTeam
        ? `Fim de partida! ${myTeamLabel} venceu por ${state.teamScores[myTeam]} × ${state.teamScores[oppTeam]}.`
        : `Fim de partida! ${oppTeamLabel} venceu por ${state.teamScores[oppTeam]} × ${state.teamScores[myTeam]}.`;
  } else if (state.phase === 'PLAYING') {
    statusBanner = isMyTurn
      ? 'Sua vez de jogar'
      : `Vez de ${currentTurnPlayer?.name || 'oponente'}...`;
  }

  const canHostStartTeam =
    isHost &&
    state.players.length >= state.minPlayers &&
    state.players.length % 2 === 0;

  return (
    <div className="h-dvh felt-table-bg flex flex-col justify-between overflow-hidden select-none">
      {/* Top HUD Bar */}
      <header className="shrink-0 w-full px-4 sm:px-6 py-3 bg-[#071D15]/90 border-b border-emerald-800/60 flex flex-wrap items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-3">
          <span className="font-display font-bold text-white text-base hidden md:inline">
            Joguers de Cartas
          </span>
          {!isSoloBot && (
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

        {/* Center Scoreboard */}
        <div
          aria-label="Placar da partida"
          className="flex items-center gap-4 sm:gap-6 bg-[#0B291E] border border-emerald-700/50 rounded-xl px-4 py-1.5"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-semibold text-emerald-100 truncate max-w-[90px] sm:max-w-[160px]">
              {myTeamLabel}
            </span>
            <span className="font-mono-num text-xl sm:text-2xl font-bold text-amber-300">
              {state.teamScores[myTeam]}
            </span>
          </div>

          <div className="flex flex-col items-center leading-none">
            <span className="text-[10px] uppercase tracking-wider text-emerald-200/60">
              {state.currentBet > 1 ? getBetLabel(state.currentBet) : 'Vale'}
            </span>
            <span className="font-mono-num text-xs font-bold text-white mt-0.5">
              {state.currentBet} {state.currentBet === 1 ? 'pt' : 'pts'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono-num text-xl sm:text-2xl font-bold text-white">
              {state.teamScores[oppTeam]}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-emerald-200/80 truncate max-w-[90px] sm:max-w-[160px]">
              {oppTeamLabel}
            </span>
          </div>
        </div>

        {/* Right Controls */}
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

      {/* Waiting Room or Active Table */}
      {state.phase === 'WAITING_OPPONENT' ? (
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#092219]/95 border border-emerald-700/60 rounded-2xl p-6 sm:p-8 text-center shadow-2xl space-y-5">
            <h2 className="font-display text-2xl font-bold text-white">
              Convide para a Mesa ({state.players.length}/{state.maxPlayers})
            </h2>
            <p className="text-sm text-emerald-100/80">
              {state.maxPlayers === 2
                ? 'Envie este código ou link para a outra pessoa entrar:'
                : `Mínimo ${state.minPlayers} e máximo ${state.maxPlayers} jogadores (em duplas ou trios):`}
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
              onClick={handleCopyInviteLink}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors"
            >
              <Share2 className="w-4 h-4" aria-hidden="true" />
              <span>{copiedLink ? 'Link copiado!' : 'Copiar Link de Convite'}</span>
            </button>

            {state.maxPlayers > 2 && (
              <div className="text-left space-y-2 pt-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-200/70">
                  Jogadores conectados
                </span>
                <ul className="space-y-1.5">
                  {state.players.map((p) => (
                    <li
                      key={p.id}
                      className="px-3 py-2 rounded-lg bg-emerald-950/70 text-sm text-white flex items-center justify-between"
                    >
                      <span>{p.name}</span>
                      <span className="text-xs font-semibold text-amber-300">
                        {p.team === 0 ? 'Time A' : 'Time B'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {canHostStartTeam && (
              <button
                type="button"
                onClick={onStartTeamMatch}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm transition-colors"
              >
                <Play className="w-4 h-4" aria-hidden="true" />
                <span>Iniciar Partida ({state.players.length} jogadores)</span>
              </button>
            )}
          </div>
        </main>
      ) : (
        <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col justify-between items-center px-4 py-3 sm:py-5 relative max-w-6xl w-full mx-auto">
          {/* Other Players Row */}
          <section
            aria-label="Outros jogadores"
            className="flex flex-wrap items-center justify-center gap-4 sm:gap-8"
          >
            {otherPlayers.map((p) => {
              const count = state.cardCounts[p.id] ?? 0;
              const isTurn = state.phase === 'PLAYING' && state.turnPlayerId === p.id;
              return (
                <div
                  key={p.id}
                  className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl border ${
                    isTurn
                      ? 'bg-emerald-900/60 border-amber-400/60'
                      : 'border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs text-emerald-100/90">
                    <span className="font-semibold">{p.name}</span>
                    {state.players.length > 2 && (
                      <span className="text-[11px] text-amber-300/90">
                        ({p.team === myTeam ? 'Parceiro' : 'Adversário'})
                      </span>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className={p.connected ? 'text-emerald-300' : 'text-rose-300'}>
                      {p.isBot ? 'Guers Bot' : p.connected ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: count }).map((_, idx) => (
                      <PlayingCard key={idx} faceDown size="xs" />
                    ))}
                  </div>
                </div>
              );
            })}
          </section>

          {/* Center Battle Zone + Vira */}
          <section
            aria-label="Mesa central"
            className="w-full flex flex-col items-center justify-center gap-3 my-2"
          >
            <div
              role="status"
              aria-live="polite"
              className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold border ${
                isChallengeForMyTeam
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg'
                  : isMyTurn
                  ? 'bg-emerald-800/90 text-amber-200 border-amber-400/50'
                  : 'bg-[#092219]/90 text-emerald-100/90 border-emerald-700/60'
              }`}
            >
              {statusBanner}
            </div>

            <div className="w-full flex flex-wrap items-center justify-center gap-6 sm:gap-10">
              {state.vira && (
                <div className="flex flex-col items-center gap-1.5 bg-[#092219]/75 border border-emerald-800/70 rounded-2xl p-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200/75">
                    Vira
                  </span>
                  <PlayingCard card={state.vira} size="sm" />
                  <div className="text-center mt-0.5">
                    <span className="text-xs font-bold text-amber-300">
                      Manilha: {state.manilhaRank}
                    </span>
                    <div className="text-[10px] text-emerald-200/65 mt-0.5">
                      ♣ &gt; ♥ &gt; ♠ &gt; ♦
                    </div>
                  </div>
                </div>
              )}

              {/* Casual / Angled Played Cards Across Rounds */}
              <div className="flex flex-col items-center gap-3">
                <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 min-h-[145px] sm:min-h-[170px] px-2">
                  {allRoundsOnTable.length === 0 ? (
                    <div className="px-8 py-10 rounded-xl border-2 border-dashed border-emerald-700/50 bg-emerald-950/30 text-xs text-emerald-200/50">
                      Aguardando cartas na mesa
                    </div>
                  ) : (
                    allRoundsOnTable.map((roundGroup) => (
                      <div
                        key={roundGroup.roundIdx}
                        className={`flex flex-col items-center gap-1.5 transition-opacity duration-300 ${
                          roundGroup.isCurrent || allRoundsOnTable.length === 1
                            ? 'opacity-100'
                            : 'opacity-80 scale-90'
                        }`}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200/65">
                          {roundGroup.roundIdx + 1}ª rodada
                        </span>
                        <div className="flex items-center -space-x-3 sm:-space-x-2">
                          {roundGroup.plays.map((play, playIdx) => {
                            const p = state.players.find((pl) => pl.id === play.playerId);
                            const isMine = play.playerId === state.myId;
                            const { angle, offsetX, offsetY } = getCasualCardTransform(
                              play.card.id,
                              roundGroup.roundIdx,
                              playIdx
                            );

                            return (
                              <div
                                key={`${roundGroup.roundIdx}-${play.playerId}`}
                                style={
                                  {
                                    '--start-y': isMine ? '72px' : '-72px',
                                    '--end-x': `${offsetX}px`,
                                    '--end-y': `${offsetY}px`,
                                    '--end-rot': `${angle}deg`,
                                  } as React.CSSProperties
                                }
                                className="animate-card-play flex flex-col items-center gap-1"
                              >
                                <span className="text-[10px] text-emerald-100/85 font-medium bg-[#071D15]/80 px-1.5 py-0.5 rounded">
                                  {isMine ? 'Você' : p?.name}
                                </span>
                                <PlayingCard
                                  card={play.card}
                                  manilhaRank={state.manilhaRank}
                                  faceDown={play.faceDown}
                                  size="md"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* 3 Round Indicators */}
                <div className="flex items-center gap-2" aria-label="Resultado das rodadas">
                  {state.roundOutcomes.map((outcome, idx) => {
                    let label = `${idx + 1}ª`;
                    let style = 'bg-emerald-950/80 border-emerald-800/70 text-emerald-200/60';
                    if (outcome === myTeam) {
                      label = `${idx + 1}ª · Nós`;
                      style = 'bg-emerald-600/90 border-emerald-400 text-white';
                    } else if (outcome === 'tie') {
                      label = `${idx + 1}ª · Empate`;
                      style = 'bg-amber-500/80 border-amber-300 text-slate-950';
                    } else if (outcome !== null) {
                      label = `${idx + 1}ª · Eles`;
                      style = 'bg-rose-700/80 border-rose-500 text-white';
                    } else if (idx === state.currentRound && state.phase === 'PLAYING') {
                      style = 'bg-emerald-900 border-amber-400/70 text-amber-200';
                    }

                    return (
                      <span
                        key={idx}
                        className={`px-2.5 py-1 rounded-md border text-[11px] font-semibold ${style}`}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Player Hand */}
          <section
            aria-label="Suas cartas"
            className="flex flex-col items-center gap-2 pb-14 sm:pb-2"
          >
            {canPlayFaceDown && (
              <button
                type="button"
                onClick={() => setPlayFaceDown((v) => !v)}
                aria-pressed={playFaceDown}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  playFaceDown
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-[#092219]/90 text-emerald-100 border-emerald-700/60 hover:border-emerald-500'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{playFaceDown ? 'Jogando coberta (clique na carta)' : 'Jogar carta coberta'}</span>
              </button>
            )}

            <div className="flex items-center justify-center gap-2.5 sm:gap-4">
              {state.myHand.map((card) => (
                <PlayingCard
                  key={card.id}
                  card={card}
                  manilhaRank={state.manilhaRank}
                  size="lg"
                  playable={isMyTurn}
                  disabled={!isMyTurn}
                  onClick={() => handleCardClick(card.id)}
                />
              ))}
            </div>
          </section>
        </main>
      )}

      {/* Bottom-Right Corner Action Controls */}
      {state.phase !== 'WAITING_OPPONENT' && (
        <div
          aria-label="Ações da aposta"
          className="fixed bottom-4 right-4 sm:right-6 z-30 flex flex-col items-end gap-2"
        >
          {canAskTruco && nextBet && (
            <button
              type="button"
              onClick={onAskTruco}
              className="px-5 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-base sm:text-lg shadow-2xl border-2 border-amber-200 transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97] whitespace-nowrap"
            >
              Pedir {getBetLabel(nextBet)}!
            </button>
          )}

          {isChallengeForMyTeam && state.challenge && (
            <div className="bg-[#092219]/95 border border-amber-400/70 rounded-2xl p-3 shadow-2xl flex flex-col gap-2 min-w-[210px]">
              <span className="text-xs font-semibold text-amber-200 text-center">
                Responder {getBetLabel(state.challenge.proposedBet)} ({state.challenge.proposedBet} pts)
              </span>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => onRespondTruco('accept')}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors whitespace-nowrap"
                >
                  Aceitar ({state.challenge.proposedBet})
                </button>

                {getNextBetValue(state.challenge.proposedBet) && (
                  <button
                    type="button"
                    onClick={() => onRespondTruco('raise')}
                    className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm transition-colors whitespace-nowrap"
                  >
                    {getBetLabel(getNextBetValue(state.challenge.proposedBet)!)}!
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onRespondTruco('run')}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm transition-colors whitespace-nowrap"
                >
                  Correr
                </button>
              </div>
            </div>
          )}

          {isChallengeFromMyTeam && state.challenge && (
            <div className="px-4 py-3 rounded-xl bg-[#092219]/95 border border-amber-400/50 text-xs sm:text-sm font-medium text-amber-200 shadow-xl">
              Aguardando resposta ao {getBetLabel(state.challenge.proposedBet)}...
            </div>
          )}

          {isMyMaoDe11 && (
            <div className="bg-[#092219]/95 border border-amber-400/70 rounded-2xl p-3 shadow-2xl flex flex-col gap-2">
              <span className="text-xs font-semibold text-amber-200 text-center">
                Mão de 11 (vale 3 pontos)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onDecideMaoDe11(true)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors whitespace-nowrap"
                >
                  Aceitar e Jogar
                </button>
                <button
                  type="button"
                  onClick={() => onDecideMaoDe11(false)}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm transition-colors whitespace-nowrap"
                >
                  Correr
                </button>
              </div>
            </div>
          )}

          {state.phase === 'HAND_OVER' && (
            <button
              type="button"
              onClick={onNextHand}
              className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-xl transition-colors whitespace-nowrap"
            >
              Próxima Mão
            </button>
          )}

          {state.phase === 'MATCH_OVER' && victoryModalDismissed && (
            <button
              type="button"
              onClick={() => setVictoryModalDismissed(false)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm shadow-xl transition-colors whitespace-nowrap"
            >
              <Trophy className="w-4 h-4" aria-hidden="true" />
              <span>Ver Resultado</span>
            </button>
          )}
        </div>
      )}

      {/* Lateral Volume Control */}
      <VolumeControl volume={volume} onChangeVolume={onChangeVolume} />

      {/* Chat Drawer (in multiplayer rooms) */}
      {!isSoloBot && (
        <ChatDrawer
          messages={state.chat}
          myId={state.myId}
          isOpen={isChatOpen}
          unreadCount={unreadChatCount}
          onToggle={onToggleChat}
          onSendMessage={onSendChat}
        />
      )}

      {/* Score History Modal */}
      <ScoreHistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        players={state.players}
        teamWins={state.teamWins}
        matchHistory={state.matchHistory}
        handLog={state.handLog}
      />

      {/* Match Victory Modal */}
      {state.phase === 'MATCH_OVER' && !victoryModalDismissed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Fim de partida"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <div className="relative w-full max-w-md bg-[#0D2E22] border border-amber-400/60 rounded-2xl p-6 sm:p-8 text-center shadow-2xl space-y-5">
            <button
              type="button"
              onClick={() => setVictoryModalDismissed(true)}
              aria-label="Fechar resumo da vitória"
              className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-emerald-200/80 hover:text-white hover:bg-emerald-800/60 transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>

            <div className="w-14 h-14 mx-auto rounded-full bg-amber-400/15 border border-amber-400/50 flex items-center justify-center">
              <Trophy className="w-7 h-7 text-amber-300" aria-hidden="true" />
            </div>

            <div>
              <h2 className="font-display text-3xl font-bold text-white">
                {state.matchWinnerTeam === myTeam
                  ? 'Vocês venceram!'
                  : `${oppTeamLabel} venceu!`}
              </h2>
              <p className="text-sm text-emerald-100/80 mt-1">
                {state.handResultReason}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#092219] border border-emerald-800/70 rounded-xl p-3">
                <div className="text-xs text-emerald-200/70 truncate">{myTeamLabel}</div>
                <div className="font-mono-num text-2xl font-bold text-amber-300 mt-0.5">
                  {state.teamScores[myTeam]} pts
                </div>
                <div className="text-[11px] text-emerald-200/60 font-mono-num mt-0.5">
                  {state.teamWins[myTeam]} {state.teamWins[myTeam] === 1 ? 'vitória' : 'vitórias'}
                </div>
              </div>
              <div className="bg-[#092219] border border-emerald-800/70 rounded-xl p-3">
                <div className="text-xs text-emerald-200/70 truncate">{oppTeamLabel}</div>
                <div className="font-mono-num text-2xl font-bold text-white mt-0.5">
                  {state.teamScores[oppTeam]} pts
                </div>
                <div className="text-[11px] text-emerald-200/60 font-mono-num mt-0.5">
                  {state.teamWins[oppTeam]} {state.teamWins[oppTeam] === 1 ? 'vitória' : 'vitórias'}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={onNewMatch}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm transition-colors"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  <span>Jogar Novamente</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                  className="py-3 px-4 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white font-semibold text-sm transition-colors"
                >
                  Ver Histórico
                </button>
              </div>
              <button
                type="button"
                onClick={onLeaveRoom}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-950/70 hover:bg-rose-900/80 border border-rose-700/50 text-rose-100 font-semibold text-sm transition-colors"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span>Sair da Sala</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
