import React, { useState, useMemo } from 'react';
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
  // Points to give to self (max player score is 10)
  const maxSelfPossible = Math.min(10 - currentPlayer.score, availablePoints);
  const [selfPoints, setSelfPoints] = useState<number>(0);

  // Deductions: map targetId -> amount
  const [deductions, setDeductions] = useState<Record<string, number>>({});

  // Locks: map targetId -> lockPoints (1..5)
  const [locks, setLocks] = useState<Record<string, number>>({});

  // Unlocks: list of targetIds to free
  const [unlocks, setUnlocks] = useState<string[]>([]);

  // Search and filter for opponents
  const [searchFilter, setSearchFilter] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'zero' | 'locked'>('all');

  const opponents = useMemo(() => {
    return players.filter((p) => p.id !== currentPlayer.id);
  }, [players, currentPlayer.id]);

  const filteredOpponents = useMemo(() => {
    return opponents.filter((opp) => {
      if (searchFilter.trim() && !opp.name.toLowerCase().includes(searchFilter.toLowerCase())) {
        return false;
      }
      if (filterType === 'zero') {
        const deductAmt = deductions[opp.id] || 0;
        return opp.score - deductAmt === 0 && !opp.isLocked;
      }
      if (filterType === 'locked') {
        return opp.isLocked;
      }
      return true;
    });
  }, [opponents, searchFilter, filterType, deductions]);

  // Compute total spent
  const totalDeductions = useMemo(() => {
    return Object.values(deductions).reduce((sum, v) => sum + (v || 0), 0);
  }, [deductions]);

  const totalLockPoints = useMemo(() => {
    return Object.values(locks).reduce((sum, v) => sum + (v || 0), 0);
  }, [locks]);

  const totalUnlockCost = useMemo(() => {
    return unlocks.reduce((sum, id) => {
      const target = opponents.find((p) => p.id === id);
      return sum + (target ? target.lockPoints : 0);
    }, 0);
  }, [unlocks, opponents]);

  const totalSpent = selfPoints + totalDeductions + totalLockPoints + totalUnlockCost;
  const remainingPoints = availablePoints - totalSpent;

  if (!isOpen) return null;

  // Handle self points
  const handleSelfChange = (newVal: number) => {
    const clamped = Math.max(0, Math.min(maxSelfPossible, newVal));
    setSelfPoints(clamped);
    soundManager.playClick();
  };

  // Set explicit deduction amount on opponent
  const handleSetDeduction = (targetId: string, amount: number) => {
    const target = opponents.find((p) => p.id === targetId);
    if (!target) return;

    const current = deductions[targetId] || 0;
    const clamped = Math.max(0, Math.min(target.score, amount));
    const diff = clamped - current;

    if (diff > 0 && remainingPoints < diff) return;

    setDeductions((prev) => ({
      ...prev,
      [targetId]: clamped,
    }));

    // If opponent effective score is > 0, remove any lock on them
    if (target.score - clamped > 0 && locks[targetId]) {
      setLocks((prev) => {
        const copy = { ...prev };
        delete copy[targetId];
        return copy;
      });
    }

    soundManager.playClick();
  };

  // Adjust lock points (1 to 5)
  const handleSetLock = (targetId: string, lockPts: number) => {
    const currentLock = locks[targetId] || 0;
    if (lockPts === 0 || currentLock === lockPts) {
      const updated = { ...locks };
      delete updated[targetId];
      setLocks(updated);
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

  // Toggle unlock
  const handleToggleUnlock = (targetId: string) => {
    const target = opponents.find((p) => p.id === targetId);
    if (!target || !target.isLocked) return;

    if (unlocks.includes(targetId)) {
      setUnlocks((prev) => prev.filter((id) => id !== targetId));
      soundManager.playClick();
    } else {
      if (remainingPoints < target.lockPoints) return;
      setUnlocks((prev) => [...prev, targetId]);
      soundManager.playPointsScored();
    }
  };

  // Preset: give maximum possible to self
  const handlePresetSelf = () => {
    setDeductions({});
    setLocks({});
    setUnlocks([]);
    setSelfPoints(Math.min(maxSelfPossible, availablePoints));
    soundManager.playClick();
  };

  const handleReset = () => {
    setSelfPoints(0);
    setDeductions({});
    setLocks({});
    setUnlocks([]);
    soundManager.playClick();
  };

  const handleConfirm = () => {
    if (totalSpent > availablePoints || remainingPoints !== 0) return;

    const deductionList = Object.entries(deductions)
      .filter(([_, amt]) => amt > 0)
      .map(([targetId, amount]) => ({ targetId, amount }));

    const lockList = Object.entries(locks)
      .filter(([_, pts]) => pts > 0)
      .map(([targetId, lockPoints]) => ({ targetId, lockPoints }));

    onSubmit({
      selfPoints,
      deductions: deductionList,
      locks: lockList,
      unlocks,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-stone-900 border border-stone-700 w-full max-w-2xl rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 text-stone-100 max-h-[92vh] overflow-y-auto">
        {/* Header with Mathematical Dashboard */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-800 pb-3 gap-3">
          <div>
            <h2 className="text-xl font-bold font-serif text-amber-400 flex items-center gap-2">
              <span>🧮</span>
              <span>Xisaabta & Maamulka Dhibcaha (Point Manager)</span>
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Waxaad keentay <strong className="text-amber-300 font-mono text-sm">{availablePoints}</strong> dhibcood.
              Ma adeegsan kartid wax ka badan {availablePoints} dhibcood!
            </p>
          </div>

          {/* Real-time Math Budget Counter */}
          <div className="flex items-center gap-2 bg-stone-950 px-3.5 py-2 rounded-xl border border-stone-800 self-start sm:self-auto">
            <div className="text-center">
              <div className="text-[10px] text-stone-400 font-medium uppercase">Keensatay</div>
              <div className="text-base font-bold font-mono text-stone-200 tabular-nums">
                {availablePoints}
              </div>
            </div>
            <div className="text-stone-600 font-bold">-</div>
            <div className="text-center">
              <div className="text-[10px] text-stone-400 font-medium uppercase">Maamushay</div>
              <div className="text-base font-bold font-mono text-amber-400 tabular-nums">
                {totalSpent}
              </div>
            </div>
            <div className="text-stone-600 font-bold">=</div>
            <div className="text-center">
              <div className="text-[10px] text-stone-400 font-medium uppercase">Kuu Haray</div>
              <div
                className={`text-base font-bold font-mono tabular-nums ${
                  remainingPoints === 0
                    ? 'text-emerald-400'
                    : remainingPoints < 0
                    ? 'text-red-400'
                    : 'text-amber-400'
                }`}
              >
                {remainingPoints}
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Self Points */}
        <div className="bg-stone-950/70 p-3.5 rounded-xl border border-stone-800 flex items-center justify-between">
          <div>
            <span className="font-semibold text-sm text-stone-200 flex items-center gap-1.5">
              <span>⭐</span>
              <span>1. Naftaada dhibco ku dar (Add to Self)</span>
            </span>
            <div className="text-[11px] text-stone-400 mt-0.5">
              Dhibcahaaga hadda: <strong className="text-amber-400 font-mono">{currentPlayer.score}/10</strong> ·
              Haddii aad ku darto {selfPoints}:{' '}
              <span className="text-emerald-400 font-bold font-mono">
                {currentPlayer.score + selfPoints}/10
              </span>{' '}
              (Ugu badnaan 10)
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSelfChange(selfPoints - 1)}
              disabled={selfPoints <= 0}
              className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-30 text-stone-200 font-bold flex items-center justify-center transition-colors text-sm"
            >
              -
            </button>
            <span className="w-8 text-center font-mono font-bold text-amber-400 text-base tabular-nums">
              +{selfPoints}
            </span>
            <button
              type="button"
              onClick={() => handleSelfChange(selfPoints + 1)}
              disabled={selfPoints >= maxSelfPossible || remainingPoints <= 0}
              className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-30 text-stone-200 font-bold flex items-center justify-center transition-colors text-sm"
            >
              +
            </button>
          </div>
        </div>

        {/* Section 2: Jailed Players Rescue / Release */}
        {opponents.some((p) => p.isLocked) && (
          <div className="p-3.5 rounded-xl bg-amber-950/25 border border-amber-800/70 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-amber-300">
              <span className="flex items-center gap-1.5">
                <span className="text-base">🗝️</span>
                <span>2. Soo Fasax Asxaabta Xabsiga ku Jirta (Release from Jail):</span>
              </span>
              <span className="text-[11px] text-stone-400 font-normal">
                Bixi dhibcihii lagu xiray
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {opponents
                .filter((p) => p.isLocked)
                .map((jailed) => {
                  const isMarked = unlocks.includes(jailed.id);
                  const canAfford = isMarked || remainingPoints >= jailed.lockPoints;

                  return (
                    <div
                      key={jailed.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-stone-950 border border-stone-800"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-xl shrink-0">{jailed.avatar}</span>
                        <div className="overflow-hidden">
                          <div className="text-xs font-bold text-stone-200 truncate">{jailed.name}</div>
                          <div className="text-[11px] text-stone-400">
                            Xabsiga: <strong className="text-red-400 font-mono font-bold">{jailed.lockPoints} pts</strong>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleUnlock(jailed.id)}
                        disabled={!canAfford}
                        className={`text-xs px-2.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 shrink-0 ${
                          isMarked
                            ? 'bg-emerald-600 text-white shadow-md'
                            : canAfford
                            ? 'bg-stone-800 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-700/60'
                            : 'bg-stone-900 text-stone-600 border border-stone-800 cursor-not-allowed'
                        }`}
                      >
                        <span>🗝️</span>
                        <span>{isMarked ? `Waa la furayaa (-${jailed.lockPoints})` : `Soo bixi (${jailed.lockPoints} pts)`}</span>
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Section 3: Opponents Attack & Locking Section */}
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-xs text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>⚔️</span>
              <span>3. Ka Jar Dhibco ama Dili / Xir Asxaabta ({opponents.length})</span>
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePresetSelf}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold"
              >
                ⭐ Naftaada sii (+{Math.min(maxSelfPossible, availablePoints)})
              </button>
              <span className="text-stone-700">·</span>
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] text-stone-400 hover:text-stone-200"
              >
                Dib u celi (Reset)
              </button>
            </div>
          </div>

          {/* Search & Filter for up to 20 players */}
          {opponents.length > 4 && (
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Raadi saaxiib (Search opponent)..."
                className="w-full sm:flex-1 bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              />
              <div className="flex items-center gap-1 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${
                    filterType === 'all'
                      ? 'bg-amber-600 text-white'
                      : 'bg-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Dhammaan
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('zero')}
                  className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${
                    filterType === 'zero'
                      ? 'bg-red-600 text-white'
                      : 'bg-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Eber (La xiri karo)
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('locked')}
                  className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${
                    filterType === 'locked'
                      ? 'bg-amber-600 text-white'
                      : 'bg-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Xiran (Xabsiga)
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 max-h-[44vh] overflow-y-auto pr-1">
            {filteredOpponents.map((opp) => {
              const deductAmt = deductions[opp.id] || 0;
              const effectiveScore = opp.score - deductAmt;
              const isEligibleToLock = effectiveScore === 0 && !opp.isLocked;
              const activeLock = locks[opp.id] || 0;

              return (
                <div
                  key={opp.id}
                  className={`p-3.5 rounded-xl border flex flex-col gap-2.5 transition-all ${
                    activeLock > 0
                      ? 'bg-red-950/40 border-red-800 shadow-md'
                      : opp.isLocked
                      ? 'bg-stone-950/80 border-amber-900/60'
                      : 'bg-stone-950/70 border-stone-800'
                  }`}
                >
                  {/* Opponent Info & Mathematical Formula */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{opp.avatar}</span>
                      <div>
                        <div className="font-bold text-sm text-stone-200 flex items-center gap-2">
                          <span>{opp.name}</span>
                          {opp.isLocked && (
                            <span className="text-[10px] text-red-400 bg-red-950 px-2 py-0.5 rounded border border-red-800 font-bold">
                              🔒 Xiran ({opp.lockPoints} dhibcood)
                            </span>
                          )}
                        </div>
                        {/* Live calculation formula: Initial - Deducted = Remaining */}
                        <div className="text-xs text-stone-300 mt-0.5 flex items-center gap-1.5 font-mono">
                          <span>Dhibcihiisa:</span>
                          <span className="text-stone-400">{opp.score}</span>
                          {deductAmt > 0 && (
                            <>
                              <span className="text-red-400">- {deductAmt}</span>
                              <span className="text-stone-500">=</span>
                              <span
                                className={`font-bold ${
                                  effectiveScore === 0 ? 'text-red-400 underline' : 'text-amber-400'
                                }`}
                              >
                                {effectiveScore} dhibco haray
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="text-right">
                      {opp.isLocked ? (
                        <span className="text-[11px] text-red-400 font-medium">Xabsiga ku jira</span>
                      ) : effectiveScore === 0 ? (
                        <span className="text-[11px] text-red-400 font-bold bg-red-950/60 px-2 py-0.5 rounded border border-red-800 animate-pulse">
                          0 Eber (Hadda waa la dili karaa / xiri karaa!)
                        </span>
                      ) : (
                        <span className="text-[11px] text-stone-400">
                          Lama xiri karo ilaa dhibcihiisu 0 noqdaan
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Deduction Buttons: Click amount directly (0 to opp.score) */}
                  {!opp.isLocked && opp.score > 0 && (
                    <div className="bg-stone-900/90 p-2.5 rounded-lg border border-stone-800 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-stone-400 font-medium">Ka jar dhibco (Deduct Points):</span>
                        <span className="font-mono text-red-400 font-bold">
                          {deductAmt > 0 ? `-${deductAmt} dhibcood ayaa laga jarayaa` : '0 laga jaray'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSetDeduction(opp.id, 0)}
                          className={`px-2 py-1 text-xs rounded font-mono font-bold transition-colors ${
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
                              className={`px-2.5 py-1 text-xs rounded font-mono font-bold transition-all ${
                                isSelected
                                  ? 'bg-red-600 text-white shadow'
                                  : canSelect
                                  ? 'bg-stone-800 hover:bg-red-900/40 text-stone-300 border border-stone-700'
                                  : 'bg-stone-900 text-stone-600 cursor-not-allowed'
                              }`}
                            >
                              -{amt}
                            </button>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => handleSetDeduction(opp.id, opp.score)}
                          disabled={
                            deductAmt === opp.score || remainingPoints < opp.score - deductAmt
                          }
                          className="ml-auto text-[11px] px-2 py-1 rounded bg-red-950/80 hover:bg-red-900 text-red-300 font-semibold border border-red-800 transition-colors"
                        >
                          Ka wada jar ({opp.score} pts ➔ 0)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Locking Section: Only available when opponent effective score is 0 */}
                  {!opp.isLocked && (
                    <div
                      className={`p-2.5 rounded-lg border transition-all flex flex-col gap-1.5 ${
                        isEligibleToLock
                          ? 'bg-red-950/30 border-red-800'
                          : 'bg-stone-900/50 border-stone-800/60 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold flex items-center gap-1.5">
                          <span>🔒</span>
                          <span className={isEligibleToLock ? 'text-red-300' : 'text-stone-400'}>
                            Ku xir xabsiga / Dili (1 ilaa 5 dhibcood):
                          </span>
                        </span>
                        {activeLock > 0 && (
                          <span className="text-xs text-red-400 font-bold font-mono">
                            Waxaa lagu xirayaa {activeLock} dhibcood!
                          </span>
                        )}
                      </div>

                      {!isEligibleToLock ? (
                        <p className="text-[11px] text-amber-500/90 italic">
                          💡 Qofkani wuxuu leeyahay {effectiveScore} dhibco. Marka hore dhibcihiisa ka wada jar si uu 0 u noqdo, ka dibna dhibcaha kuu soo hara ku xir!
                        </p>
                      ) : (
                        <div className="flex items-center gap-1.5 mt-1">
                          {[1, 2, 3, 4, 5].map((pts) => {
                            const isSelected = activeLock === pts;
                            const diff = pts - activeLock;
                            const canSelect = isSelected || remainingPoints >= diff;

                            return (
                              <button
                                key={pts}
                                type="button"
                                onClick={() => handleSetLock(opp.id, pts)}
                                disabled={!canSelect}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                  isSelected
                                    ? 'bg-red-600 text-white shadow-md scale-105'
                                    : canSelect
                                    ? 'bg-stone-800 hover:bg-red-900/60 text-stone-200 border border-stone-700'
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
                              onClick={() => handleSetLock(opp.id, 0)}
                              className="text-xs px-2 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white"
                            >
                              Ka noqo
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

        {/* Footer Actions with Strict Math Verification */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-stone-800 pt-3 gap-3">
          <div className="text-xs">
            {remainingPoints > 0 ? (
              <span className="text-amber-400 font-medium">
                Waxaa kuu dhiman <strong>{remainingPoints}</strong> dhibcood oo aad keentay (Qoondee dhammaan si aad u xaqiijiso).
              </span>
            ) : remainingPoints < 0 ? (
              <span className="text-red-400 font-bold flex items-center gap-1">
                <span>⚠️</span>
                <span>Ma adeegsan kartid wax ka badan {availablePoints} dhibcood oo aad keentay!</span>
              </span>
            ) : (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <span>✓</span>
                <span>Xisaabtu waa sax: Dhammaan {availablePoints} dhibcood ayaa la maamulay!</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={totalSpent > availablePoints || remainingPoints !== 0}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg transition-all text-xs sm:text-sm self-end sm:self-auto"
          >
            Xaqiiji Maamulka (Confirm Actions)
          </button>
        </div>
      </div>
    </div>
  );
};
