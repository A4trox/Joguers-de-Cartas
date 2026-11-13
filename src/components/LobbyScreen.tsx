import React, { useState } from 'react';
import { ArrowRight, Bot, Layers, Plus, Spade, Users } from 'lucide-react';
import { GameKind } from '../game/types';
import { PlayingCard } from './PlayingCard';

interface LobbyScreenProps {
  initialName: string;
  initialRoomCode: string;
  isConnecting: boolean;
  error: string | null;
  onPlaySolo: (gameKind: GameKind, playerName: string) => void;
  onCreateRoom: (
    gameKind: 'truco' | 'vinteum',
    playerName: string,
    maxPlayers: 2 | 4 | 6
  ) => void;
  onJoinRoom: (playerName: string, roomCode: string) => void;
}

const GAME_OPTIONS: {
  id: GameKind;
  title: string;
  subtitle: string;
  details: string;
}[] = [
  {
    id: 'truco',
    title: 'Truco Paulista',
    subtitle: 'Sozinho, em dois ou dupla/trio',
    details: 'Baralho limpo · Manilha aleatória · Até 6 jogadores',
  },
  {
    id: 'vinteum',
    title: 'Modo 21',
    subtitle: 'Sozinho, dupla ou grupo',
    details: 'Sem 8, 9 e 10 · Figuras valem 10 · Até 4 jogadores',
  },
  {
    id: 'paciencia',
    title: 'Paciência',
    subtitle: 'Apenas modo sozinho',
    details: 'Baralho completo · Monte e fundações',
  },
];

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  initialName,
  initialRoomCode,
  isConnecting,
  error,
  onPlaySolo,
  onCreateRoom,
  onJoinRoom,
}) => {
  const [selectedGame, setSelectedGame] = useState<GameKind>('truco');
  const [name, setName] = useState(initialName);
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [trucoCapacity, setTrucoCapacity] = useState<2 | 4 | 6>(2);
  const [v21Capacity, setV21Capacity] = useState<2 | 4>(2);
  const [localError, setLocalError] = useState<string | null>(null);

  const activeError = localError || error;
  const isPaciencia = selectedGame === 'paciencia';

  const requireName = (): string | null => {
    const trimmed = name.trim();
    if (!trimmed) {
      setLocalError('Digite seu nome ou apelido para continuar.');
      return null;
    }
    setLocalError(null);
    return trimmed;
  };

  const handleSolo = () => {
    const validName = requireName();
    if (!validName) return;
    onPlaySolo(selectedGame, validName);
  };

  const handleCreate = () => {
    if (isPaciencia) return;
    const validName = requireName();
    if (!validName) return;
    const maxP = selectedGame === 'truco' ? trucoCapacity : v21Capacity;
    onCreateRoom(selectedGame, validName, maxP);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPaciencia) return;
    const validName = requireName();
    if (!validName) return;
    const trimmedCode = roomCode.trim().toUpperCase();
    if (trimmedCode.length < 4) {
      setLocalError('Digite o código da sala (6 caracteres).');
      return;
    }
    setLocalError(null);
    onJoinRoom(validName, trimmedCode);
  };

  return (
    <main className="min-h-screen felt-table-bg flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-5xl space-y-8">
        {/* Header / Title */}
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center -space-x-4 mb-5" aria-hidden="true">
            <div className="-rotate-12 transform">
              <PlayingCard
                card={{ id: '7-diamonds', rank: '7', suit: 'diamonds' }}
                size="sm"
              />
            </div>
            <div className="z-10 -translate-y-1.5">
              <PlayingCard
                card={{ id: '4-clubs', rank: '4', suit: 'clubs' }}
                manilhaRank="4"
                size="sm"
              />
            </div>
            <div className="rotate-12 transform">
              <PlayingCard
                card={{ id: 'A-hearts', rank: 'A', suit: 'hearts' }}
                size="sm"
              />
            </div>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-white">
            Joguers de Cartas
          </h1>
          <p className="mt-2 text-sm sm:text-base text-emerald-100/80 max-w-xl">
            Escolha o jogo, digite seu apelido e jogue sozinho, em dupla ou com a galera em tempo real.
          </p>
        </div>

        {/* Step 1: Game Mode Selector */}
        <section aria-label="Escolha o modo de jogo">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {GAME_OPTIONS.map((opt) => {
              const active = selectedGame === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setSelectedGame(opt.id);
                    setLocalError(null);
                  }}
                  aria-pressed={active}
                  className={`text-left p-5 rounded-2xl border transition-all duration-150 ${
                    active
                      ? 'bg-[#0D3828] border-amber-400 shadow-xl'
                      : 'bg-[#092219]/85 border-emerald-800/70 hover:border-emerald-600/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-display text-xl font-bold text-white">
                      {opt.title}
                    </span>
                    {opt.id === 'truco' && <Spade className="w-5 h-5 text-amber-300" aria-hidden="true" />}
                    {opt.id === 'vinteum' && <Layers className="w-5 h-5 text-amber-300" aria-hidden="true" />}
                    {opt.id === 'paciencia' && <Bot className="w-5 h-5 text-amber-300" aria-hidden="true" />}
                  </div>
                  <p className="text-sm font-medium text-emerald-100/90">
                    {opt.subtitle}
                  </p>
                  <p className="text-xs text-emerald-200/60 mt-1.5">
                    {opt.details}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Step 2 & 3: Nickname + Play Options */}
        <section className="bg-[#092219]/95 border border-emerald-700/60 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-6">
          <div className="max-w-md mx-auto">
            <label
              htmlFor="player-name"
              className="block text-sm font-semibold text-emerald-100 mb-2"
            >
              Seu nome ou apelido
            </label>
            <input
              id="player-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (localError) setLocalError(null);
              }}
              placeholder="Ex: Carlos ou Ana"
              maxLength={24}
              className="w-full bg-emerald-950/90 border border-emerald-700/70 rounded-xl px-4 py-3 text-white placeholder:text-emerald-300/45 focus:outline-none focus:border-amber-400 transition-colors"
            />
          </div>

          {activeError && (
            <div
              role="alert"
              className="max-w-md mx-auto bg-rose-950/80 border border-rose-500/60 text-rose-100 text-sm rounded-xl px-4 py-3 text-center"
            >
              {activeError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
            {/* Option A: Jogar Sozinho */}
            <div className="bg-emerald-950/50 border border-emerald-800/70 rounded-xl p-4 flex flex-col justify-between gap-4">
              <div>
                <h2 className="font-semibold text-white text-base">Jogar Sozinho</h2>
                <p className="text-xs text-emerald-200/70 mt-1">
                  {selectedGame === 'truco'
                    ? 'Enfrente o Guers Bot em uma partida 1×1.'
                    : selectedGame === 'vinteum'
                    ? 'Jogue contra o Guers Bot com baralho limpo.'
                    : 'Modo solo clássico de Paciência.'}
                </p>
              </div>
              <button
                type="button"
                data-start="true"
                onClick={handleSolo}
                disabled={isConnecting}
                className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm py-3 px-4 rounded-xl transition-colors disabled:opacity-60"
              >
                <Bot className="w-4 h-4" aria-hidden="true" />
                <span>
                  {isPaciencia ? 'Iniciar Paciência' : 'Jogar Contra Guers Bot'}
                </span>
              </button>
            </div>

            {/* Option B: Criar Sala */}
            <div
              className={`border rounded-xl p-4 flex flex-col justify-between gap-4 ${
                isPaciencia
                  ? 'bg-emerald-950/20 border-emerald-900/50 opacity-55'
                  : 'bg-emerald-950/50 border-emerald-800/70'
              }`}
            >
              <div className="space-y-2.5">
                <h2 className="font-semibold text-white text-base">Criar Sala</h2>
                {isPaciencia ? (
                  <p className="text-xs text-emerald-200/70">
                    Indisponível no modo Paciência (apenas solo).
                  </p>
                ) : selectedGame === 'truco' ? (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tamanho da sala de Truco">
                    {([
                      { cap: 2, label: 'Em 2 (1×1)' },
                      { cap: 4, label: 'Duplas (4)' },
                      { cap: 6, label: 'Trios (6)' },
                    ] as const).map((item) => (
                      <button
                        key={item.cap}
                        type="button"
                        onClick={() => setTrucoCapacity(item.cap)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          trucoCapacity === item.cap
                            ? 'bg-amber-400 text-slate-950 border-amber-300'
                            : 'bg-emerald-950 text-emerald-100 border-emerald-700/70 hover:border-emerald-500'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tamanho da sala de 21">
                    {([
                      { cap: 2, label: 'Em Dupla (2)' },
                      { cap: 4, label: 'Grupo (até 4)' },
                    ] as const).map((item) => (
                      <button
                        key={item.cap}
                        type="button"
                        onClick={() => setV21Capacity(item.cap)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          v21Capacity === item.cap
                            ? 'bg-amber-400 text-slate-950 border-amber-300'
                            : 'bg-emerald-950 text-emerald-100 border-emerald-700/70 hover:border-emerald-500'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleCreate}
                disabled={isConnecting || isPaciencia}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-3 px-4 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Criar Sala</span>
              </button>
            </div>

            {/* Option C: Entrar com Código */}
            <form
              onSubmit={handleJoin}
              className={`border rounded-xl p-4 flex flex-col justify-between gap-4 ${
                isPaciencia
                  ? 'bg-emerald-950/20 border-emerald-900/50 opacity-55'
                  : 'bg-emerald-950/50 border-emerald-800/70'
              }`}
            >
              <div className="space-y-2">
                <label
                  htmlFor="room-code"
                  className="block font-semibold text-white text-base"
                >
                  Entrar com Código
                </label>
                {isPaciencia ? (
                  <p className="text-xs text-emerald-200/70">
                    Indisponível no modo Paciência (apenas solo).
                  </p>
                ) : (
                  <input
                    id="room-code"
                    type="text"
                    value={roomCode}
                    onChange={(e) => {
                      setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                      if (localError) setLocalError(null);
                    }}
                    placeholder="EX: TRU482"
                    maxLength={6}
                    className="w-full bg-emerald-950 border border-emerald-700/70 rounded-xl px-3.5 py-2.5 text-white font-mono-num uppercase tracking-widest placeholder:text-emerald-300/40 focus:outline-none focus:border-amber-400"
                  />
                )}
              </div>

              <button
                type="submit"
                disabled={isConnecting || isPaciencia}
                aria-label="Entrar na Sala"
                className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-sm py-3 px-4 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Users className="w-4 h-4" aria-hidden="true" />
                <span>Entrar na Sala</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
};
