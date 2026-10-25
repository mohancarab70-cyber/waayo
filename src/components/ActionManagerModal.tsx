import React, { useState, useMemo, useEffect } from 'react';
import type { Player, PointAllocation } from '../types/game.js';
import { soundManager } from '../utils/audio.js';

interface ActionManagerModalProps {
  isOpen: boolean;
  availablePoints: number; // 5 or 10
  currentPlayer: Player;
  players: Player[];
  onSubmit: (allocation: PointAllocation) => void;
}

export const ActionManagerModal: React.FC<ActionManagerModalProps> = ({
  isOpen,
  availablePoints,
  currentPlayer,
  players,
  onSubmit,
}) => {
  // Max self points possible (cap is 30)
  const maxSelfPossible = Math.min(30 - currentPlayer.score, availablePoints);
  const [selfPoints, setSelfPoints] = useState<number>(0);

  // Deductions from free players with score > 0 (targetId -> amount)
  const [deductions, setDeductions] = useState<Record<string, number>>({});

  // Initial locks on 0-score players (targetId -> lockPoints 1..5)
  const [locks, setLocks] = useState<Record<string, number>>({});

  // Lock adjustments for ALREADY locked players (targetId -> delta)
  // delta > 0: add burden (+1, +2, up to 5 max)
  // delta < 0: reduce burden (-1, -2, down to 0 which frees them)
  const [lockAdjustments, setLockAdjustments] = useState<Record<string, number>>({});

  // Filter for opponents list
  const [searchQuery, setSearchQuery] = useState('');

  // Reset internal state cleanly whenever modal opens for a new roll
  useEffect(() => {
    if (isOpen) {
      setSelfPoints(0);
      setDeductions({});
      setLocks({});
      setLockAdjustments({});
      setSearchQuery('');
    }
  }, [isOpen, availablePoints]);

  const opponents = useMemo(() => {
    return players.filter((p) => p.id !== currentPlayer.id);
  }, [players, currentPlayer.id]);

  const filteredOpponents = useMemo(() => {
    if (!searchQuery.trim()) return opponents;
    return opponents.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
    );
  }, [opponents, searchQuery]);

  // Total calculations
  const totalDeductions = useMemo(() => {
    return Object.values(deductions).reduce((sum, v) => sum + (v || 0), 0);
  }, [deductions]);

  const totalLockPoints = useMemo(() => {
    return Object.values(locks).reduce((sum, v) => sum + (v || 0), 0);
  }, [locks]);

  const totalAdjustmentsCost = useMemo(() => {
    return Object.values(lockAdjustments).reduce((sum, v) => sum + Math.abs(v || 0), 0);
  }, [lockAdjustments]);

  const totalSpent = selfPoints + totalDeductions + totalLockPoints + totalAdjustmentsCost;
  const remainingPoints = availablePoints - totalSpent;

  if (!isOpen) return null;

  // --- Handlers ---

  // Self points adjustment
  const handleSetSelf = (val: number) => {
    const clamped = Math.max(0, Math.min(maxSelfPossible, val));
    const diff = clamped - selfPoints;
    if (diff > 0 && remainingPoints < diff) return;
    setSelfPoints(clamped);
    soundManager.playClick();
  };

  // Add all remaining points to self if possible
  const handleAutoFillSelf = () => {
    const canAdd = Math.min(remainingPoints, maxSelfPossible - selfPoints);
    if (canAdd > 0) {
      setSelfPoints(selfPoints + canAdd);
      soundManager.playPointsScored();
    }
  };

  // Preset: dump all points into self
  const handleQuickPresetSelf = () => {
    setDeductions({});
    setLocks({});
    setLockAdjustments({});
    setSelfPoints(Math.min(maxSelfPossible, availablePoints));
    soundManager.playClick();
  };

  const handleResetAll = () => {
    setSelfPoints(0);
    setDeductions({});
    setLocks({});
    setLockAdjustments({});
    soundManager.playClick();
  };

  // Deduct points from active opponent
  const handleSetDeduction = (targetId: string, amount: number) => {
    const target = opponents.find((p) => p.id === targetId);
    if (!target) return;

    const current = deductions[targetId] || 0;
    const clamped = Math.max(0, Math.min(target.score, amount));
    const diff = clamped - current;

    if (diff > 0 && remainingPoints < diff) return;

    setDeductions((prev) => {
      const copy = { ...prev };
      if (clamped <= 0) {
        delete copy[targetId];
      } else {
        copy[targetId] = clamped;
      }
      return copy;
    });

    // If opponent effective score is not 0, remove lock on them
    if (target.score - clamped > 0 && locks[targetId]) {
      setLocks((prev) => {
        const copy = { ...prev };
        delete copy[targetId];
        return copy;
      });
    }

    soundManager.playClick();
  };

  // Initial lock for 0-score players (1..5)
  const handleSetInitialLock = (targetId: string, lockPts: number) => {
    const currentLock = locks[targetId] || 0;
    if (lockPts === 0 || currentLock === lockPts) {
      setLocks((prev) => {
        const copy = { ...prev };
        delete copy[targetId];
        return copy;
      });
      soundManager.playClick();
      return;
    }

    const diff = lockPts - currentLock;
    if (diff > 0 && remainingPoints < diff) return;

    setLocks((prev) => ({
      ...prev,
      [targetId]: lockPts,
    }));
    soundManager.playLockSound();
  };

  // Adjust locked player (add burden or reduce burden)
  const handleSetLockAdjustment = (targetId: string, delta: number) => {
    const target = opponents.find((p) => p.id === targetId);
    if (!target || !target.isLocked) return;

    const currentDelta = lockAdjustments[targetId] || 0;
    if (delta === 0 || currentDelta === delta) {
      setLockAdjustments((prev) => {
        const copy = { ...prev };
        delete copy[targetId];
        return copy;
      });
      soundManager.playClick();
      return;
    }

    // Cost is |delta| - |currentDelta|
    const diff = Math.abs(delta) - Math.abs(currentDelta);
    if (diff > 0 && remainingPoints < diff) return;

    setLockAdjustments((prev) => ({
      ...prev,
      [targetId]: delta,
    }));

    if (delta > 0) {
      soundManager.playLockSound();
    } else {
      soundManager.playPointsScored();
    }
  };

  const handleConfirm = () => {
    if (remainingPoints !== 0) return;

    const deductionList = Object.entries(deductions)
      .filter(([_, amt]) => amt > 0)
      .map(([targetId, amount]) => ({ targetId, amount }));

    const lockList = Object.entries(locks)
      .filter(([_, pts]) => pts > 0)
      .map(([targetId, lockPoints]) => ({ targetId, lockPoints }));

    const adjustmentsList = Object.entries(lockAdjustments)
      .filter(([_, delta]) => delta !== 0)
      .map(([targetId, delta]) => ({ targetId, delta }));

    onSubmit({
      selfPoints,
      deductions: deductionList,
      locks: lockList,
      lockAdjustments: adjustmentsList,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-stone-900 border border-stone-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-stone-100">
        {/* HEADER: Point Summary and Quick Controls */}
        <div className="p-4 sm:p-5 bg-stone-950 border-b border-stone-800 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🎲</span>
                <h2 className="text-lg sm:text-xl font-bold font-serif text-amber-400">
                  Allocate Points
                </h2>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                You rolled <strong className="text-amber-300 font-bold text-sm">+{availablePoints}</strong> points. Assign to yourself or opponents.
              </p>
            </div>

            {/* Remaining Points Badge */}
            <div className="flex flex-col items-end shrink-0">
              <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                Remaining
              </span>
              <div
                className={`text-2xl sm:text-3xl font-extrabold font-mono tabular-nums leading-none px-3 py-1 rounded-xl border ${
                  remainingPoints === 0
                    ? 'text-emerald-400 bg-emerald-950/60 border-emerald-600/60'
                    : remainingPoints < 0
                    ? 'text-red-400 bg-red-950/60 border-red-600/60'
                    : 'text-amber-400 bg-amber-950/60 border-amber-600/60 animate-pulse'
                }`}
              >
                {remainingPoints}
              </div>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-800/80">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleQuickPresetSelf}
                className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-semibold transition-all flex items-center gap-1.5"
              >
                <span>⭐</span>
                <span>Claim All (+{Math.min(maxSelfPossible, availablePoints)})</span>
              </button>
              <button
                type="button"
                onClick={handleResetAll}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium transition-colors"
              >
                Reset
              </button>
            </div>

            {opponents.length > 3 && (
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search opponent..."
                className="text-xs bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1 text-stone-200 focus:outline-none focus:border-amber-500 w-32 sm:w-40"
              />
            )}
          </div>
        </div>

        {/* BODY: Scrollable cards list */}
        <div className="p-4 sm:p-5 flex flex-col gap-3.5 overflow-y-auto">
          {/* 1. SELF CARD */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-stone-950/90 border border-amber-500/30 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl shrink-0">
                {currentPlayer.avatar}
              </div>
              <div>
                <div className="font-bold text-sm text-stone-100 flex items-center gap-1.5">
                  <span>Your Score</span>
                  <span className="text-[10px] text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded font-mono border border-amber-800">
                    Max: 30
                  </span>
                </div>
                <div className="text-xs text-stone-400 mt-0.5">
                  Current: <strong className="text-stone-200 font-mono">{currentPlayer.score}/30</strong>
                  {selfPoints > 0 && (
                    <span className="text-emerald-400 font-bold ml-1.5 font-mono">
                      ➔ {currentPlayer.score + selfPoints}/30 (+{selfPoints})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Stepper + Quick buttons */}
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => handleSetSelf(selfPoints - 1)}
                disabled={selfPoints <= 0}
                className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-30 text-stone-200 font-bold text-base flex items-center justify-center transition-colors"
              >
                -
              </button>
              <div className="w-10 text-center font-mono font-bold text-amber-400 text-lg tabular-nums">
                +{selfPoints}
              </div>
              <button
                type="button"
                onClick={() => handleSetSelf(selfPoints + 1)}
                disabled={selfPoints >= maxSelfPossible || remainingPoints <= 0}
                className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-30 text-stone-200 font-bold text-base flex items-center justify-center transition-colors"
              >
                +
              </button>

              {remainingPoints > 0 && selfPoints < maxSelfPossible && (
                <button
                  type="button"
                  onClick={handleAutoFillSelf}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 font-semibold border border-amber-500/40 ml-1 transition-all"
                >
                  Add Remaining
                </button>
              )}
            </div>
          </div>

          {/* 2. OPPONENTS CARDS (Unified Per Player) */}
          <div className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center justify-between">
            <span>Opponents ({opponents.length})</span>
            <span className="text-[11px] font-normal text-stone-500">
              Deduct points, lock in jail, or adjust lock burden
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {filteredOpponents.map((opp) => {
              const deductAmt = deductions[opp.id] || 0;
              const effectiveScore = opp.score - deductAmt;
              const canBeLocked = effectiveScore === 0 && !opp.isLocked;
              const activeLock = locks[opp.id] || 0;
              const activeAdj = lockAdjustments[opp.id] || 0;

              return (
                <div
                  key={opp.id}
                  className={`p-3.5 sm:p-4 rounded-xl border flex flex-col gap-3 transition-all ${
                    opp.isLocked
                      ? 'bg-red-950/25 border-red-900/60 shadow-sm'
                      : activeLock > 0
                      ? 'bg-amber-950/30 border-amber-700 shadow-md'
                      : deductAmt > 0
                      ? 'bg-stone-950 border-amber-700/60'
                      : 'bg-stone-950/70 border-stone-800'
                  }`}
                >
                  {/* Player header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{opp.avatar}</span>
                      <div>
                        <div className="font-bold text-sm text-stone-200 flex items-center gap-1.5">
                          <span>{opp.name}</span>
                          {opp.isAi && <span className="text-[10px] text-stone-500 font-normal">🤖 Bot</span>}
                        </div>
                        <div className="text-xs text-stone-400 font-mono">
                          {opp.isLocked ? (
                            <span className="text-red-400 font-bold flex items-center gap-1">
                              <span>🔒 Locked in Jail:</span>
                              <span className="underline">{opp.lockPoints}/5 pts</span>
                            </span>
                          ) : (
                            <span>
                              Current: <strong className="text-amber-300">{opp.score}/30</strong>
                              {deductAmt > 0 && (
                                <span className="text-red-400 font-bold ml-1">
                                  (-{deductAmt} ➔ {effectiveScore} pts)
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div>
                      {opp.isLocked ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-950 border border-red-800 text-red-300 font-bold">
                          🔒 Locked
                        </span>
                      ) : effectiveScore === 0 ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/60 text-amber-300 font-bold animate-pulse">
                          0 Pts (Can Lock!)
                        </span>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-800 text-stone-400 font-medium">
                          Active
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ACTION TYPE 1: OPPONENT IS LOCKED (Add burden up to 5 OR lighten burden down to 0) */}
                  {opp.isLocked && (
                    <div className="bg-stone-900/90 p-3 rounded-xl border border-stone-800 flex flex-col gap-2.5">
                      <div className="text-xs text-stone-300 font-semibold flex items-center justify-between">
                        <span>Jail Lock Burden:</span>
                        {activeAdj !== 0 && (
                          <span
                            className={`font-mono font-bold text-xs ${
                              activeAdj > 0 ? 'text-red-400' : 'text-emerald-400'
                            }`}
                          >
                            {activeAdj > 0
                              ? `+${activeAdj} Added (Total: ${opp.lockPoints + activeAdj}/5 pts)`
                              : `${activeAdj} Reduced (${
                                  opp.lockPoints + activeAdj === 0
                                    ? '🗝️ Freed!'
                                    : `Remaining: ${opp.lockPoints + activeAdj}/5 pts`
                                })`}
                          </span>
                        )}
                      </div>

                      {/* Control Group A: Add Burden (+) up to 5 */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 bg-stone-950/70 p-2 rounded-lg border border-stone-800">
                        <div className="text-[11px] text-stone-400 flex items-center gap-1">
                          <span className="text-red-400 font-bold">➕ Add Burden</span>
                          <span>(up to 5 max):</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {opp.lockPoints >= 5 ? (
                            <span className="text-[11px] text-stone-500 italic">
                              Max burden reached (5 pts)
                            </span>
                          ) : (
                            Array.from({ length: 5 - opp.lockPoints }).map((_, idx) => {
                              const addAmt = idx + 1;
                              const isSelected = activeAdj === addAmt;
                              const currentCost = activeAdj > 0 ? activeAdj : 0;
                              const diff = addAmt - currentCost;
                              const canSelect = isSelected || remainingPoints >= diff;

                              return (
                                <button
                                  key={addAmt}
                                  type="button"
                                  onClick={() => handleSetLockAdjustment(opp.id, addAmt)}
                                  disabled={!canSelect}
                                  className={`px-2.5 py-1 text-xs rounded-lg font-bold font-mono transition-all ${
                                    isSelected
                                      ? 'bg-red-600 text-white shadow-md ring-2 ring-red-400'
                                      : canSelect
                                      ? 'bg-stone-800 hover:bg-red-950/50 text-red-300 border border-red-900/50'
                                      : 'bg-stone-900 text-stone-600 border border-stone-800 cursor-not-allowed'
                                  }`}
                                >
                                  +{addAmt} pt
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Control Group B: Reduce Burden (-) / Free */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 bg-stone-950/70 p-2 rounded-lg border border-stone-800">
                        <div className="text-[11px] text-stone-400 flex items-center gap-1">
                          <span className="text-emerald-400 font-bold">➖ Reduce Burden</span>
                          <span>(spend points to free):</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {Array.from({ length: opp.lockPoints }).map((_, idx) => {
                            const reduceAmt = idx + 1;
                            const isSelected = activeAdj === -reduceAmt;
                            const currentCost = activeAdj < 0 ? Math.abs(activeAdj) : 0;
                            const diff = reduceAmt - currentCost;
                            const canSelect = isSelected || remainingPoints >= diff;
                            const isFullRelease = reduceAmt === opp.lockPoints;

                            return (
                              <button
                                key={reduceAmt}
                                type="button"
                                onClick={() => handleSetLockAdjustment(opp.id, -reduceAmt)}
                                disabled={!canSelect}
                                className={`px-2.5 py-1 text-xs rounded-lg font-bold font-mono transition-all ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400'
                                    : canSelect
                                    ? 'bg-stone-800 hover:bg-emerald-950/50 text-emerald-300 border border-emerald-900/50'
                                    : 'bg-stone-900 text-stone-600 border border-stone-800 cursor-not-allowed'
                                }`}
                              >
                                {isFullRelease ? `🗝️ Free (-${reduceAmt})` : `-${reduceAmt} pt`}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ACTION TYPE 2: OPPONENT IS FREE - DEDUCTIONS */}
                  {!opp.isLocked && opp.score > 0 && (
                    <div className="bg-stone-900/80 p-2.5 rounded-xl border border-stone-800 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-stone-400 font-semibold flex items-center gap-1">
                          <span>⚔️</span>
                          <span>Deduct Points:</span>
                        </span>
                        {deductAmt > 0 && (
                          <span className="font-mono text-red-400 font-bold">
                            -{deductAmt} pts deducted
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSetDeduction(opp.id, 0)}
                          className={`px-2.5 py-1 text-xs rounded-lg font-mono font-bold transition-colors ${
                            deductAmt === 0
                              ? 'bg-stone-700 text-white'
                              : 'bg-stone-800 text-stone-400 hover:text-white'
                          }`}
                        >
                          0
                        </button>

                        {Array.from({ length: opp.score }).map((_, idx) => {
                          const amt = idx + 1;
                          const isSelected = deductAmt === amt;
                          const diff = amt - deductAmt;
                          const canSelect = isSelected || remainingPoints >= diff;

                          return (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => handleSetDeduction(opp.id, amt)}
                              disabled={!canSelect}
                              className={`px-2.5 py-1 text-xs rounded-lg font-mono font-bold transition-all ${
                                isSelected
                                  ? 'bg-red-600 text-white shadow-md'
                                  : canSelect
                                  ? 'bg-stone-800 hover:bg-red-950/40 text-stone-300 border border-stone-700'
                                  : 'bg-stone-900 text-stone-600 border border-stone-800 cursor-not-allowed'
                              }`}
                            >
                              -{amt}
                            </button>
                          );
                        })}

                        {opp.score > 1 && (
                          <button
                            type="button"
                            onClick={() => handleSetDeduction(opp.id, opp.score)}
                            disabled={
                              deductAmt === opp.score || remainingPoints < opp.score - deductAmt
                            }
                            className="ml-auto text-xs px-2.5 py-1 rounded-lg bg-red-950/80 hover:bg-red-900 text-red-300 font-semibold border border-red-800 transition-colors"
                          >
                            Deduct All ➔ 0
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ACTION TYPE 3: LOCK PLAYER IN JAIL (Only when score reaches 0) */}
                  {!opp.isLocked && (
                    <div
                      className={`p-2.5 rounded-xl border flex flex-col gap-1.5 transition-all ${
                        canBeLocked
                          ? 'bg-amber-950/30 border-amber-600/70 shadow-sm'
                          : 'bg-stone-900/40 border-stone-800/40 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold flex items-center gap-1.5">
                          <span>🔒</span>
                          <span className={canBeLocked ? 'text-amber-300' : 'text-stone-400'}>
                            Lock in Jail (1 to 5 points):
                          </span>
                        </span>
                        {activeLock > 0 && (
                          <span className="text-amber-400 font-mono font-bold">
                            Locking with {activeLock} pts!
                          </span>
                        )}
                      </div>

                      {!canBeLocked ? (
                        <p className="text-[11px] text-stone-500 italic">
                          💡 Target has {effectiveScore} pts. Reduce to 0 to lock them.
                        </p>
                      ) : (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {[1, 2, 3, 4, 5].map((pts) => {
                            const isSelected = activeLock === pts;
                            const diff = pts - activeLock;
                            const canSelect = isSelected || remainingPoints >= diff;

                            return (
                              <button
                                key={pts}
                                type="button"
                                onClick={() => handleSetInitialLock(opp.id, pts)}
                                disabled={!canSelect}
                                className={`flex-1 py-1.5 text-xs font-bold font-mono rounded-lg transition-all ${
                                  isSelected
                                    ? 'bg-red-600 text-white shadow-md ring-2 ring-red-400'
                                    : canSelect
                                    ? 'bg-stone-800 hover:bg-red-950/60 text-stone-200 border border-stone-700'
                                    : 'bg-stone-900 text-stone-600 border border-stone-800 cursor-not-allowed'
                                }`}
                              >
                                {pts} {pts === 1 ? 'pt' : 'pts'}
                              </button>
                            );
                          })}

                          {activeLock > 0 && (
                            <button
                              type="button"
                              onClick={() => handleSetInitialLock(opp.id, 0)}
                              className="text-xs px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* FOOTER: Math Status & Final Confirm Button */}
        <div className="p-4 sm:p-5 bg-stone-950 border-t border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs">
            {remainingPoints > 0 ? (
              <div className="flex items-center gap-2 text-amber-400">
                <span>⚠️</span>
                <span>
                  <strong>{remainingPoints}</strong> points unassigned. Allocate all to confirm.
                </span>
              </div>
            ) : remainingPoints < 0 ? (
              <div className="flex items-center gap-2 text-red-400 font-bold">
                <span>❌</span>
                <span>Points allocated exceed roll!</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <span>✅</span>
                <span>All {availablePoints} points allocated.</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={remainingPoints !== 0}
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg transition-all text-sm"
          >
            Confirm & End Turn
          </button>
        </div>
      </div>
    </div>
  );
};
