import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { ChatMessage } from '../game/types';

interface ChatDrawerProps {
  messages: ChatMessage[];
  myId: string;
  isOpen: boolean;
  unreadCount: number;
  onToggle: () => void;
  onSendMessage: (text: string) => void;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  messages,
  myId,
  isOpen,
  unreadCount,
  onToggle,
  onSendMessage,
}) => {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setDraft('');
  };

  return (
    <div className="fixed bottom-4 left-4 z-40 flex flex-col items-start gap-3">
      {isOpen && (
        <section
          aria-label="Chat da partida"
          className="w-80 sm:w-96 h-96 bg-[#0D2E22]/95 border border-emerald-700/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-150"
        >
          {/* Chat Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-800/70 bg-[#092219]">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-amber-300" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-white">Chat da Mesa</h2>
            </div>
            <button
              type="button"
              onClick={onToggle}
              aria-label="Esconder chat"
              className="p-1.5 rounded-lg text-emerald-200/80 hover:text-white hover:bg-emerald-800/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5 text-sm"
          >
            {messages.length === 0 ? (
              <p className="text-center text-emerald-200/60 text-xs mt-12">
                Nenhuma mensagem ainda. Mande um oi para começar!
              </p>
            ) : (
              messages.map((msg) => {
                if (msg.isSystem) {
                  return (
                    <div
                      key={msg.id}
                      className="text-center text-xs text-amber-200/80 py-0.5"
                    >
                      {msg.text}
                    </div>
                  );
                }

                const isMine = msg.senderId === myId;
                const timeStr = new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-baseline gap-1.5 mb-0.5 px-1">
                      <span className="text-[11px] font-medium text-emerald-200/75">
                        {isMine ? 'Você' : msg.senderName}
                      </span>
                      <span className="text-[10px] text-emerald-200/50 font-mono-num">
                        {timeStr}
                      </span>
                    </div>
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-snug break-words ${
                        isMine
                          ? 'bg-amber-400 text-slate-950 font-medium rounded-br-sm'
                          : 'bg-emerald-900/90 text-slate-100 border border-emerald-700/50 rounded-bl-sm'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="p-2.5 border-t border-emerald-800/70 bg-[#092219] flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escreva uma mensagem..."
              aria-label="Mensagem do chat"
              maxLength={300}
              className="flex-1 bg-emerald-950/80 border border-emerald-700/60 rounded-xl px-3 py-2 text-sm text-white placeholder:text-emerald-300/50 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label="Enviar mensagem"
              className="p-2.5 rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
            </button>
          </form>
        </section>
      )}

      {/* Speech Bubble Toggle Button */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={isOpen ? 'Esconder chat' : 'Abrir chat'}
        aria-expanded={isOpen}
        className="relative flex items-center gap-2 px-4 py-3 rounded-full bg-[#092219] hover:bg-emerald-900 border border-emerald-600/60 text-white shadow-xl transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
      >
        <MessageCircle className="w-5 h-5 text-amber-300" aria-hidden="true" />
        <span className="text-sm font-semibold whitespace-nowrap">
          {isOpen ? 'Esconder chat' : 'Chat'}
        </span>
        {!isOpen && unreadCount > 0 && (
          <span
            aria-label={`${unreadCount} mensagens não lidas`}
            className="min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-xs font-bold font-mono-num flex items-center justify-center"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};
