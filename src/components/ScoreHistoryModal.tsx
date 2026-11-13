import React, { useEffect } from 'react';
import { History, Trophy, X } from 'lucide-react';
import { HandLogEntry, MatchHistoryEntry, PlayerInfo } from '../game/types';
import { getTeamLabel } from '../game/truco';

interface ScoreHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: PlayerInfo[];
  teamWins: [number, number];
  matchHistory: MatchHistoryEntry[];
  handLog: HandLogEntry[];
}

export const ScoreHistoryModal: React.FC<ScoreHistoryModalProps> = ({
  isOpen,
  onClose,
  players,
  teamWins,
  matchHistory,
  handLog,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const team0Name = getTeamLabel(players, 0);
  const team1Name = getTeamLabel(players, 1);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Histórico de Placar"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#0D2E22] border border-emerald-700/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-800/70 bg-[#092219]">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-amber-300" aria-hidden="true" />
            <h2 className="text-lg font-display font-bold text-white">
              Histórico de Placar
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar histórico"
            className="p-1.5 rounded-lg text-emerald-200/80 hover:text-white hover:bg-emerald-800/50 transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6">
          <section aria-label="Vitórias na sessão">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-200/70 mb-3">
              Vitórias na Sala
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#092219] border border-emerald-800/70 rounded-xl p-3.5 flex items-center justify-between">
                <span className="font-semibold text-white truncate pr-2">
                  {team0Name}
                </span>
                <div className="flex items-center gap-1.5 text-amber-300 font-mono-num font-bold text-lg shrink-0">
                  <Trophy className="w-4 h-4" aria-hidden="true" />
                  <span>{teamWins[0]}</span>
                </div>
              </div>
              <div className="bg-[#092219] border border-emerald-800/70 rounded-xl p-3.5 flex items-center justify-between">
                <span className="font-semibold text-white truncate pr-2">
                  {team1Name}
                </span>
                <div className="flex items-center gap-1.5 text-amber-300 font-mono-num font-bold text-lg shrink-0">
                  <Trophy className="w-4 h-4" aria-hidden="true" />
                  <span>{teamWins[1]}</span>
                </div>
              </div>
            </div>
          </section>

          <section aria-label="Partidas encerradas">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-200/70 mb-3">
              Partidas Encerradas ({matchHistory.length})
            </h3>
            {matchHistory.length === 0 ? (
              <p className="text-sm text-emerald-200/60 bg-[#092219]/60 rounded-xl p-4 text-center">
                Nenhuma partida concluída ainda. Quem fizer 12 pontos vence!
              </p>
            ) : (
              <ul className="space-y-2">
                {matchHistory.map((entry, idx) => {
                  const timeStr = new Date(entry.playedAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  return (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#092219] border border-emerald-800/60 text-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs font-mono-num text-emerald-200/50">
                          #{matchHistory.length - idx}
                        </span>
                        <span className="font-semibold text-amber-300 truncate">
                          {entry.winnerName}
                        </span>
                        <span className="text-emerald-200/70 text-xs truncate">
                          venceu {entry.loserName}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono-num font-bold text-white">
                          {entry.winnerScore} × {entry.loserScore}
                        </span>
                        <span className="text-xs text-emerald-200/50 font-mono-num">
                          {timeStr}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-label="Mãos desta partida">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-200/70 mb-3">
              Mãos desta Partida
            </h3>
            {handLog.length === 0 ? (
              <p className="text-sm text-emerald-200/60 text-center py-2">
                Nenhuma mão finalizada nesta partida ainda.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {handLog.map((h) => (
                  <li
                    key={h.handNumber}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#092219]/70 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono-num text-emerald-200/50">
                        Mão {h.handNumber}
                      </span>
                      <span className="font-semibold text-white">{h.winnerName}</span>
                      <span className="text-emerald-200/70">· {h.reason}</span>
                    </div>
                    <span className="font-mono-num font-bold text-amber-300">
                      +{h.pointsWon} {h.pointsWon === 1 ? 'pt' : 'pts'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
