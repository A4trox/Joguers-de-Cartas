import React, { useState } from 'react';
import { Minus, Plus, Volume2, VolumeX } from 'lucide-react';

interface VolumeControlProps {
  volume: number;
  onChangeVolume: (next: number) => void;
}

export const VolumeControl: React.FC<VolumeControlProps> = ({
  volume,
  onChangeVolume,
}) => {
  const [open, setOpen] = useState(false);

  const step = (delta: number) => {
    onChangeVolume(Math.max(0, Math.min(100, volume + delta)));
  };

  return (
    <div
      aria-label="Controle de volume"
      className="fixed right-4 sm:right-6 top-20 z-30 flex flex-col items-end gap-2"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Volume dos efeitos sonoros: ${volume}%`}
        aria-expanded={open}
        className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#092219]/95 hover:bg-emerald-900 border border-emerald-700/60 text-xs font-mono-num font-semibold text-emerald-100 shadow-lg transition-colors"
      >
        {volume === 0 ? (
          <VolumeX className="w-4 h-4 text-rose-300" aria-hidden="true" />
        ) : (
          <Volume2 className="w-4 h-4 text-amber-300" aria-hidden="true" />
        )}
        <span>{volume}%</span>
      </button>

      {open && (
        <div className="bg-[#092219]/95 border border-emerald-700/60 rounded-2xl p-3 shadow-2xl flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => step(-10)}
            aria-label="Diminuir volume"
            className="p-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-800 border border-emerald-700/60 text-emerald-100 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={volume}
            onChange={(e) => onChangeVolume(Number(e.target.value))}
            aria-label="Ajustar volume"
            className="w-24 accent-amber-400 cursor-pointer"
          />

          <button
            type="button"
            onClick={() => step(10)}
            aria-label="Aumentar volume"
            className="p-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-800 border border-emerald-700/60 text-emerald-100 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};
