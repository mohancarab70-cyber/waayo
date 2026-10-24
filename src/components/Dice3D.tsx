import React, { useState, useEffect, useRef } from 'react';
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
}) => {
  const [internalRolling, setInternalRolling] = useState(false);
  const [justLanded, setJustLanded] = useState(false);
  const [displayValue, setDisplayValue] = useState<DiceValue>(value || 5);

  const prevValueRef = useRef<DiceValue | null>(value);
  const shuffleTimerRef = useRef<any>(null);
  const timeoutRef = useRef<any>(null);

  // When value changes from outside (e.g. roll landed or bot rolled)
  useEffect(() => {
    if (value && value !== prevValueRef.current) {
      prevValueRef.current = value;
      startStandardRollAnimation(value);
    }
  }, [value]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (shuffleTimerRef.current) clearInterval(shuffleTimerRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const startStandardRollAnimation = (finalVal: DiceValue) => {
    // Clear previous timers
    if (shuffleTimerRef.current) clearInterval(shuffleTimerRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setInternalRolling(true);
    setJustLanded(false);
    soundManager.playDiceShake();

    // Rapid face cycling every 60ms like standard digital dice games
    let cycleCount = 0;
    const maxCycles = 10; // ~600ms total roll duration

    shuffleTimerRef.current = setInterval(() => {
      cycleCount++;
      const randomFace = (Math.floor(Math.random() * 6) + 1) as DiceValue;
      setDisplayValue(randomFace);

      if (cycleCount >= maxCycles) {
        clearInterval(shuffleTimerRef.current);
        shuffleTimerRef.current = null;

        // Settle on the final rolled value
        setDisplayValue(finalVal);
        setInternalRolling(false);
        setJustLanded(true);
        soundManager.playDiceLand(finalVal === 5 || finalVal === 6);

        // Remove pop animation class after 450ms
        timeoutRef.current = setTimeout(() => {
          setJustLanded(false);
        }, 450);
      }
    }, 60);
  };

  const handleRollClick = () => {
    if (!canRoll || isRolling || internalRolling) return;
    soundManager.playDiceShake();
    setInternalRolling(true);
    onRoll();
  };

  const activeRolling = isRolling || internalRolling;

  // Render authentic recessed pips for each face (1 to 6)
  const renderPips = (num: DiceValue) => {
    const isBigCenter = num === 1;

    const positions: Record<DiceValue, [number, number][]> = {
      1: [[50, 50]],
      2: [[26, 26], [74, 74]],
      3: [[25, 25], [50, 50], [75, 75]],
      4: [[26, 26], [74, 26], [26, 74], [74, 74]],
      5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
      6: [[30, 22], [30, 50], [30, 78], [70, 22], [70, 50], [70, 78]],
    };

    return (
      <div className="w-full h-full relative">
        {positions[num].map(([x, y], idx) => {
          let pipColorClass = 'bg-stone-900 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]';
          let pipSize = '19%';

          if (isBigCenter) {
            // Traditional Somali / Casino bold crimson center dot on Face 1
            pipColorClass = 'bg-gradient-to-br from-red-500 to-red-700 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4),0_0_8px_rgba(239,68,68,0.5)] ring-2 ring-red-400';
            pipSize = '30%';
          } else if (num === 5) {
            // Golden amber dots for 5
            pipColorClass = 'bg-gradient-to-br from-amber-500 to-amber-700 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4),0_0_6px_rgba(245,158,11,0.6)] ring-1 ring-amber-300';
            pipSize = '18%';
          } else if (num === 6) {
            // Golden emerald dots for 6 (10 points max roll!)
            pipColorClass = 'bg-gradient-to-br from-amber-400 via-emerald-600 to-emerald-800 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4),0_0_8px_rgba(16,185,129,0.7)] ring-1 ring-emerald-300';
            pipSize = '17%';
          }

          return (
            <div
              key={idx}
              className={`absolute rounded-full transform -translate-x-1/2 -translate-y-1/2 ${pipColorClass}`}
              style={{
                width: pipSize,
                height: pipSize,
                left: `${x}%`,
                top: `${y}%`,
              }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center p-3 select-none">
      {/* Dice Stage */}
      <div className="relative flex flex-col items-center justify-center py-2">
        {/* Crisp Dice Shadow */}
        <div
          className={`w-24 h-4 rounded-full bg-black/60 filter blur-sm transition-all duration-300 ${
            activeRolling ? 'scale-125 opacity-30 translate-y-3' : 'scale-100 opacity-70 translate-y-2'
          }`}
        />

        {/* The Standard High-Quality Dice Face */}
        <div
          onClick={canRoll ? handleRollClick : undefined}
          title={canRoll ? 'Guji halkan si aad u tuurto laadhuuda!' : undefined}
          className={`w-28 h-28 sm:w-32 sm:h-32 rounded-3xl p-3.5 relative flex items-center justify-center transition-all ${
            canRoll && !activeRolling
              ? 'cursor-pointer hover:scale-105 active:scale-95'
              : 'cursor-default'
          } ${
            activeRolling
              ? 'animate-dice-shake'
              : justLanded
              ? 'animate-dice-pop'
              : ''
          } ${
            displayValue === 5
              ? 'bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200 border-2 border-amber-400 shadow-[0_12px_30px_rgba(245,158,11,0.45)] ring-2 ring-amber-400/50'
              : displayValue === 6
              ? 'bg-gradient-to-br from-amber-50 via-emerald-50 to-emerald-100 border-2 border-emerald-400 shadow-[0_12px_30px_rgba(16,185,129,0.45)] ring-2 ring-emerald-400/50'
              : 'bg-gradient-to-br from-stone-50 via-amber-50/60 to-stone-200 border-2 border-stone-300 shadow-[0_10px_25px_rgba(0,0,0,0.35)]'
          }`}
        >
          {/* Inner Bevel highlight */}
          <div className="absolute inset-1.5 rounded-2xl border border-white/70 pointer-events-none" />

          {/* Render Current Face Pips (1 to 6) */}
          {renderPips(displayValue)}
        </div>
      </div>

      {/* Outcome Announcement & Points Display */}
      <div className="mt-3 text-center min-h-[3.8rem] flex flex-col items-center justify-center">
        {activeRolling ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-900/90 border border-amber-500/30 text-amber-300 text-xs font-semibold animate-pulse">
            <span className="text-base animate-spin">🎲</span>
            <span>Laadhuuda waa la tuurayaa (Rolling)...</span>
          </div>
        ) : displayValue ? (
          <div className="animate-fade-in flex flex-col items-center gap-1">
            {displayValue === 5 && (
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-amber-500/20 to-amber-600/30 border border-amber-500/60 rounded-xl text-amber-300 text-sm font-bold shadow-lg shadow-amber-950/40">
                <span className="text-base">⭐</span>
                <span>Lambar 5: +5 Dhibcood! (Qoondee)</span>
              </div>
            )}
            {displayValue === 6 && (
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-emerald-500/20 to-emerald-600/30 border border-emerald-500/60 rounded-xl text-emerald-300 text-sm font-bold shadow-lg shadow-emerald-950/40">
                <span className="text-base">🎯</span>
                <span>Lambar 6: +10 Dhibcood Buuxa! (Qoondee)</span>
              </div>
            )}
            {displayValue < 5 && (
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-stone-900/90 text-stone-300 border border-stone-700/80 rounded-xl text-xs font-medium">
                <span className="text-stone-400">❌</span>
                <span>
                  Lambar <strong className="text-white font-mono">{displayValue}</strong> (0 dhibco) · Wareeggu wuu dhaafayaa
                </span>
              </div>
            )}
            <span className="text-[10px] text-stone-400 font-mono">
              (Dhammaan 1 ilaa 6 way soo bixi karaan · 5 iyo 6 kaliya ayaa dhibco leh)
            </span>
          </div>
        ) : null}
      </div>

      {/* Primary Roll Action Button */}
      {canRoll && (
        <button
          type="button"
          onClick={handleRollClick}
          disabled={activeRolling}
          className="mt-2 px-8 py-3 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold rounded-2xl shadow-xl shadow-amber-900/40 transition-all flex items-center gap-2.5 text-sm sm:text-base border border-amber-400/40"
        >
          <span className="text-xl">🎲</span>
          <span>Tuur Laadhuuda (Roll Dice)</span>
        </button>
      )}
    </div>
  );
};
