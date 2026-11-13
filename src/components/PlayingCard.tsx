import React from 'react';
import { Card, FullCard, Rank } from '../game/types';
import { SUIT_LABEL_PT, SUIT_SYMBOL } from '../game/truco';

interface PlayingCardProps {
  card?: Card | FullCard;
  manilhaRank?: Rank | null;
  faceDown?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  playable?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  label?: string;
}

const SIZE_CLASSES: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'w-14 h-20 sm:w-16 sm:h-24 rounded-lg',
  sm: 'w-14 h-20 rounded-lg',
  md: 'w-20 h-28 sm:w-24 sm:h-34 rounded-xl',
  lg: 'w-24 h-36 sm:w-28 sm:h-40 rounded-xl',
};

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  manilhaRank,
  faceDown = false,
  size = 'lg',
  playable = false,
  selected = false,
  disabled = false,
  onClick,
  onDoubleClick,
  label,
}) => {
  const sizeClass = SIZE_CLASSES[size];

  if (faceDown || !card) {
    return (
      <div
        aria-label={label || 'Carta virada para baixo'}
        onClick={onClick}
        className={`${sizeClass} relative select-none bg-[#1B4332] border-2 border-[#D8F3DC]/30 playing-card-shadow flex items-center justify-center overflow-hidden ${
          onClick ? 'cursor-pointer hover:border-amber-300/70' : ''
        }`}
      >
        <div className="absolute inset-1 rounded-md border border-amber-300/35 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.04)_0px,rgba(255,255,255,0.04)_4px,transparent_4px,transparent_8px)] flex items-center justify-center">
          <div className="w-5 h-5 rounded-full border border-amber-300/40 flex items-center justify-center text-amber-200/60 text-[10px] font-bold">
            ♣
          </div>
        </div>
      </div>
    );
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const isManilha =
    manilhaRank !== undefined && manilhaRank !== null && card.rank === manilhaRank;
  const suitSymbol = SUIT_SYMBOL[card.suit];
  const suitName = SUIT_LABEL_PT[card.suit];
  const colorClass = isRed ? 'text-[#DC2626]' : 'text-[#18181B]';

  const cardClasses = `
    ${sizeClass}
    relative select-none bg-[#FFFFFF] text-left playing-card-shadow
    transition-transform duration-150 ease-out
    ${selected ? 'ring-3 ring-amber-400 -translate-y-1.5 border border-amber-500' : isManilha ? 'ring-2 ring-amber-400 border border-amber-500' : 'border border-slate-200'}
    ${playable && !disabled ? 'cursor-pointer hover:-translate-y-2 active:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300' : ''}
    ${disabled ? 'opacity-75 cursor-default' : ''}
  `;

  const isCompact = size === 'sm' || size === 'xs';

  const innerContent = (
    <>
      <div
        className={`absolute ${
          isCompact ? 'top-1 left-1.5' : 'top-1.5 left-2'
        } flex flex-col items-center leading-none ${colorClass}`}
      >
        <span
          className={
            isCompact
              ? 'text-xs sm:text-sm font-bold'
              : 'text-lg sm:text-xl font-bold tracking-tight'
          }
        >
          {card.rank}
        </span>
        <span className={isCompact ? 'text-[11px]' : 'text-sm sm:text-base'}>
          {suitSymbol}
        </span>
      </div>

      {isManilha && !isCompact && (
        <span className="absolute top-1.5 right-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
          Manilha
        </span>
      )}

      <div className={`w-full h-full flex items-center justify-center ${colorClass}`}>
        <span
          className={
            isCompact
              ? 'text-xl sm:text-2xl'
              : size === 'md'
              ? 'text-4xl sm:text-5xl'
              : 'text-5xl sm:text-6xl'
          }
          aria-hidden="true"
        >
          {suitSymbol}
        </span>
      </div>

      {!isCompact && (
        <div
          className={`absolute bottom-1.5 right-2 flex flex-col items-center leading-none rotate-180 ${colorClass}`}
        >
          <span className="text-lg sm:text-xl font-bold tracking-tight">
            {card.rank}
          </span>
          <span className="text-sm sm:text-base">{suitSymbol}</span>
        </div>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        disabled={disabled}
        aria-label={`${card.rank} de ${suitName}${isManilha ? ' (Manilha)' : ''}`}
        className={cardClasses}
      >
        {innerContent}
      </button>
    );
  }

  return (
    <div
      aria-label={`${card.rank} de ${suitName}${isManilha ? ' (Manilha)' : ''}`}
      className={cardClasses}
    >
      {innerContent}
    </div>
  );
};
