import React, { useState, useEffect } from 'react';
import type { DiceValue } from '../types/game.js';
import { soundManager } from '../utils/audio.js';

interface Dice3DProps {
  value: DiceValue | null;
  isRolling: boolean;
  canRoll: boolean;
  onRoll: () => void;
  pendingPoints?: number;
}

export const Dice3D: React.FC<Dice3DProps> = ({
  value,
  isRolling,
  canRoll,
  onRoll,
  pendingPoints,
}) => {
  const [internalRolling, setInternalRolling] = useState(false);
  const [displayValue, setDisplayValue] = useState<DiceValue>(value || 5);

  useEffect(() => {
    if (value) {
      setDisplayValue(value);
    }
  }, [value]);

  const handleRollClick = () => {
    if (!canRoll || isRolling || internalRolling) return;
    soundManager.playDiceShake();
    setInternalRolling(true);

    // Roll rotation animation
    setTimeout(() => {
      onRoll();
      setInternalRolling(false);
    }, 600);
  };

  const activeRolling = isRolling || internalRolling;

  // Render pips for face
  const renderPips = (num: DiceValue) => {
    const pips: React.ReactNode[] = [];
    const positions: Record<number, number[][]> = {
      1: [[50, 50]],
      2: [[25, 25], [75, 75]],
      3: [[25, 25], [50, 50], [75, 75]],
      4: [[25, 25], [25, 75], [75, 25], [75, 75]],
      5: [[25, 25], [25, 75], [50, 50], [75, 25], [75, 75]],
      6: [[25, 20], [25, 50], [25, 80], [75, 20], [75, 50], [75, 80]],
    };

    const isHighlight = num === 5 || num === 6;

    positions[num].forEach(([x, y], idx) => {
      pips.push(
        <div
          key={idx}
          className={`absolute rounded-full transition-transform ${
            isHighlight ? 'bg-amber-600 shadow-sm' : 'bg-slate-800'
          }`}
          style={{
            width: '18%',
            height: '18%',
            left: `${x}%`,
            top: `${y}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      );
    });

    return pips;
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      {/* 3D Dice Container */}
      <div
        onClick={canRoll ? handleRollClick : undefined}
        className={`relative w-28 h-28 sm:w-32 sm:h-32 select-none perspective-800 ${
          canRoll ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
        } transition-transform duration-200`}
      >
        <div
          className={`w-full h-full rounded-2xl bg-gradient-to-br from-amber-50 to-orange-100 border-2 ${
            displayValue === 5 || displayValue === 6
              ? 'border-amber-400 shadow-[0_10px_25px_rgba(245,158,11,0.35)]'
              : 'border-amber-200/70 shadow-[0_10px_25px_rgba(0,0,0,0.3)]'
          } flex items-center justify-center relative transform transition-all duration-300 ${
            activeRolling ? 'animate-bounce rotate-12 scale-110' : ''
          }`}
        >
          {/* Subtle ivory dice texture and bevel highlight */}
          <div className="absolute inset-1 rounded-xl border border-white/60 pointer-events-none" />
          <div className="w-full h-full relative">
            {renderPips(displayValue)}
          </div>
        </div>
      </div>

      {/* Outcome announcement */}
      <div className="mt-4 text-center min-h-[3.5rem] flex flex-col items-center justify-center">
        {displayValue && !activeRolling && (
          <div className="animate-fade-in">
            {displayValue === 5 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg text-sm font-bold">
                <span>⭐ Lambar 5: +5 Dhibcood!</span>
              </div>
            )}
            {displayValue === 6 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-bold">
                <span>🔥 Lambar 6: +10 Dhibcood!</span>
              </div>
            )}
            {displayValue < 5 && (
              <div className="text-xs text-stone-400 font-medium">
                Lambar {displayValue} (0 dhibco) · Wareeggu wuu dhaafayaa
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Button */}
      {canRoll && (
        <button
          onClick={handleRollClick}
          disabled={activeRolling}
          className="mt-2 px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 active:scale-98 text-white font-bold rounded-xl shadow-lg shadow-amber-900/30 transition-all flex items-center gap-2"
        >
          <span>🎲</span>
          <span>Tuur Laadhuuda (Roll)</span>
        </button>
      )}
    </div>
  );
};
