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

// Target rotations in degrees to bring each face squarely to the front
const FACE_ROTATIONS: Record<DiceValue, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  6: { x: 0, y: 180 },
  2: { x: -90, y: 0 },
  5: { x: 90, y: 0 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
};

const DICE_SIZE = 104; // Cube width/height in px
const HALF_SIZE = DICE_SIZE / 2; // 52px for translateZ

export const Dice3D: React.FC<Dice3DProps> = ({
  value,
  isRolling,
  canRoll,
  onRoll,
}) => {
  const [internalRolling, setInternalRolling] = useState(false);
  const [displayValue, setDisplayValue] = useState<DiceValue>(value || 5);
  const [rotation, setRotation] = useState<{ x: number; y: number; z: number }>({
    x: FACE_ROTATIONS[value || 5].x,
    y: FACE_ROTATIONS[value || 5].y,
    z: 0,
  });

  const cumulativeSpins = useRef({ x: 0, y: 0 });
  const prevValueRef = useRef<DiceValue | null>(value);

  // Trigger 3D tumble when value changes or when isRolling triggers
  useEffect(() => {
    if (value && value !== prevValueRef.current) {
      prevValueRef.current = value;
      triggerTumbleAnimation(value);
    }
  }, [value]);

  useEffect(() => {
    if (isRolling && !internalRolling) {
      soundManager.playDiceShake();
      setInternalRolling(true);
    }
  }, [isRolling]);

  const triggerTumbleAnimation = (targetVal: DiceValue) => {
    setInternalRolling(true);
    soundManager.playDiceShake();

    // Add 2-3 full 360-degree rotations on both axes for realistic tumbling
    const extraTurnsX = 720 + (Math.floor(Math.random() * 2) * 360);
    const extraTurnsY = 720 + (Math.floor(Math.random() * 2) * 360);
    const tiltZ = (Math.random() - 0.5) * 20;

    cumulativeSpins.current.x += extraTurnsX;
    cumulativeSpins.current.y += extraTurnsY;

    const base = FACE_ROTATIONS[targetVal];
    const targetX = cumulativeSpins.current.x + base.x;
    const targetY = cumulativeSpins.current.y + base.y;

    setRotation({
      x: targetX,
      y: targetY,
      z: tiltZ,
    });

    // Sound effect on landing and finish rolling state
    const timer = setTimeout(() => {
      setDisplayValue(targetVal);
      setInternalRolling(false);
      soundManager.playDiceLand(targetVal === 5 || targetVal === 6);
    }, 1100);

    return () => clearTimeout(timer);
  };

  const handleRollClick = () => {
    if (!canRoll || isRolling || internalRolling) return;
    soundManager.playDiceShake();
    setInternalRolling(true);
    onRoll();
  };

  const activeRolling = isRolling || internalRolling;

  // Render authentic recessed pips for each face
  const renderFacePips = (faceNum: DiceValue) => {
    const isBigCenter = faceNum === 1;
    const isFiveOrSix = faceNum === 5 || faceNum === 6;

    const positions: Record<DiceValue, [number, number][]> = {
      1: [[50, 50]],
      2: [[28, 28], [72, 72]],
      3: [[26, 26], [50, 50], [74, 74]],
      4: [[28, 28], [72, 28], [28, 72], [72, 72]],
      5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
      6: [[30, 22], [30, 50], [30, 78], [70, 22], [70, 50], [70, 78]],
    };

    return (
      <div className="w-full h-full relative">
        {positions[faceNum].map(([x, y], idx) => {
          let pipColorClass = 'bg-stone-900 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]';
          let pipSize = '18%';

          if (isBigCenter) {
            // Traditional Somali / Casino bold crimson center dot on Face 1
            pipColorClass = 'bg-gradient-to-br from-red-500 to-red-700 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4),0_0_8px_rgba(239,68,68,0.5)] ring-1 ring-red-400';
            pipSize = '28%';
          } else if (faceNum === 5) {
            // Radiant gold/amber dots for 5
            pipColorClass = 'bg-gradient-to-br from-amber-500 to-amber-700 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4),0_0_6px_rgba(245,158,11,0.6)] ring-1 ring-amber-300';
            pipSize = '17%';
          } else if (faceNum === 6) {
            // Radiant golden-emerald dots for 6 (the ultimate 10 points roll!)
            pipColorClass = 'bg-gradient-to-br from-amber-400 via-emerald-600 to-emerald-800 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4),0_0_8px_rgba(16,185,129,0.7)] ring-1 ring-emerald-300';
            pipSize = '16%';
          }

          return (
            <div
              key={idx}
              className={`absolute rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-all ${pipColorClass}`}
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

  // Helper to construct face style
  const getFaceTransform = (faceNum: DiceValue): React.CSSProperties => {
    let transformStr = '';
    switch (faceNum) {
      case 1:
        transformStr = `rotateY(0deg) translateZ(${HALF_SIZE}px)`;
        break;
      case 6:
        transformStr = `rotateY(180deg) translateZ(${HALF_SIZE}px)`;
        break;
      case 2:
        transformStr = `rotateX(90deg) translateZ(${HALF_SIZE}px)`;
        break;
      case 5:
        transformStr = `rotateX(-90deg) translateZ(${HALF_SIZE}px)`;
        break;
      case 3:
        transformStr = `rotateY(90deg) translateZ(${HALF_SIZE}px)`;
        break;
      case 4:
        transformStr = `rotateY(-90deg) translateZ(${HALF_SIZE}px)`;
        break;
    }

    return {
      position: 'absolute',
      width: `${DICE_SIZE}px`,
      height: `${DICE_SIZE}px`,
      transform: transformStr,
      backfaceVisibility: 'hidden',
      WebkitBackfaceVisibility: 'hidden',
    };
  };

  return (
    <div className="flex flex-col items-center justify-center p-3 select-none">
      {/* 3D Scene Wrapper */}
      <div
        className="relative flex items-center justify-center"
        style={{
          width: '180px',
          height: '160px',
          perspective: '1000px',
        }}
      >
        {/* Dynamic Under-Dice Table Shadow */}
        <div
          className={`absolute bottom-3 rounded-full bg-black/70 filter blur-md transition-all duration-300 pointer-events-none ${
            activeRolling ? 'w-24 h-6 opacity-30 scale-125' : 'w-20 h-5 opacity-70 scale-95'
          }`}
        />

        {/* 3D Rotatable Cube Container */}
        <div
          onClick={canRoll ? handleRollClick : undefined}
          title={canRoll ? 'Guji halkan si aad u tuurto laadhuuda!' : undefined}
          className={`relative ${canRoll && !activeRolling ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'} transition-transform duration-200`}
          style={{
            width: `${DICE_SIZE}px`,
            height: `${DICE_SIZE}px`,
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(${rotation.z}deg) ${
              activeRolling ? 'translateY(-24px)' : 'translateY(0px)'
            }`,
            transition: activeRolling
              ? 'transform 1.1s cubic-bezier(0.18, 0.89, 0.32, 1.1)'
              : 'transform 0.4s ease-out',
          }}
        >
          {/* All 6 Faces of the True 3D Cube */}
          {([1, 2, 3, 4, 5, 6] as DiceValue[]).map((faceNum) => (
            <div
              key={faceNum}
              style={getFaceTransform(faceNum)}
              className="rounded-2xl bg-gradient-to-br from-amber-50 via-stone-100 to-amber-100/90 border border-stone-300 shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),inset_0_-2px_4px_rgba(0,0,0,0.15),0_4px_10px_rgba(0,0,0,0.2)] p-2.5 flex items-center justify-center"
            >
              {/* Inner bevel outline */}
              <div className="absolute inset-1.5 rounded-xl border border-white/60 pointer-events-none" />
              {renderFacePips(faceNum)}
            </div>
          ))}
        </div>
      </div>

      {/* Outcome Announcement & Points Display */}
      <div className="mt-2 text-center min-h-[3.8rem] flex flex-col items-center justify-center">
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
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-stone-900/80 text-stone-300 border border-stone-700/80 rounded-xl text-xs font-medium">
                <span className="text-stone-400">❌</span>
                <span>
                  Lambar <strong className="text-white font-mono">{displayValue}</strong> (0 dhibco) · Wareeggu wuu dhaafayaa
                </span>
              </div>
            )}
            <span className="text-[10px] text-stone-400 font-mono">
              (Dhammaan 1 ilaa 6 waa soo bixi karaan · 5 iyo 6 kaliya ayaa dhibco leh)
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
          className="mt-2 px-7 py-3 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold rounded-2xl shadow-xl shadow-amber-900/40 transition-all flex items-center gap-2.5 text-sm sm:text-base border border-amber-400/40"
        >
          <span className="text-xl">🎲</span>
          <span>Tuur Laadhuuda (Roll Dice)</span>
        </button>
      )}
    </div>
  );
};
