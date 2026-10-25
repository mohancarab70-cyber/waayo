import React from 'react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-stone-900 border border-stone-700 w-full max-w-xl rounded-2xl p-6 shadow-2xl flex flex-col gap-4 text-stone-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📖</span>
            <h2 className="text-xl font-bold font-serif text-amber-400">
              Rules of Taraq
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition-colors text-sm font-bold"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3.5 text-sm text-stone-300 leading-relaxed">
          {/* Section 1: Points & Max Cap */}
          <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-800">
            <h3 className="font-bold text-amber-400 text-sm mb-1 flex items-center gap-2">
              <span>⭐</span>
              <span>1. Dice & Scoring (30 Points Max)</span>
            </h3>
            <ul className="list-disc list-inside space-y-1 text-xs text-stone-300">
              <li>
                <strong>Score Cap:</strong> Each player can hold a maximum of <strong>30 points</strong>.
              </li>
              <li>
                <strong className="text-amber-300">Roll 5:</strong> Earns <strong>+5 points</strong> to allocate.
              </li>
              <li>
                <strong className="text-emerald-300">Roll 6:</strong> Earns <strong>+10 points</strong> to allocate.
              </li>
              <li>
                <strong className="text-stone-400">Rolls 1, 2, 3, 4:</strong> 0 points (Turn passes).
              </li>
            </ul>
          </div>

          {/* Section 2: Jail & Lock Mechanics */}
          <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-800">
            <h3 className="font-bold text-red-400 text-sm mb-1 flex items-center gap-2">
              <span>🔒</span>
              <span>2. Jail & Lock Burden (1 to 5 Points)</span>
            </h3>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-stone-300">
              <li>
                <strong>Opponent must be at 0:</strong> Deduct an opponent&apos;s points to 0 before they can be locked.
              </li>
              <li>
                <strong>Lock (1–5 pts):</strong> Once at 0, lock them with 1 to 5 lock points. Locked players miss their turns.
              </li>
              <li>
                <strong>Add Burden (+):</strong> Increase an existing prisoner&apos;s lock burden up to a max of <strong>5 points</strong>.
              </li>
              <li>
                <strong>Reduce Burden / Free (-):</strong> Pay points to decrease an opponent&apos;s lock. Reducing it to <strong>0 frees them</strong>.
              </li>
              <li>
                <strong>Strict Allocation:</strong> You must allocate exactly the points rolled (5 or 10) before confirming your turn.
              </li>
            </ul>
          </div>

          {/* Section 3: Victory Condition */}
          <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-800">
            <h3 className="font-bold text-emerald-400 text-sm mb-1 flex items-center gap-2">
              <span>👑</span>
              <span>3. Victory Condition</span>
            </h3>
            <p className="text-xs text-stone-300 leading-normal">
              When opponents are locked up, the last player remaining free who locks the others wins the game!
            </p>
          </div>
        </div>

        <div className="flex justify-end border-t border-stone-800 pt-3">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl text-xs transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
