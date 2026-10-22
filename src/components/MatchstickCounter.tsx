import React from 'react';

interface MatchstickCounterProps {
  score: number;
  targetScore: number;
  color?: string;
}

export const MatchstickCounter: React.FC<MatchstickCounterProps> = ({
  score,
  targetScore,
  color = '#D97706',
}) => {
  // Taraq (matchstick) bundles: 1 bundle = 5 points
  const bundles = Math.floor(score / 5);
  const singles = score % 5;
  const progressPercent = Math.min(100, Math.round((score / targetScore) * 100));

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center justify-between text-xs">
        <span className="text-stone-300 font-semibold flex items-center gap-1">
          <span>Dhibcaha:</span>
          <span className="font-mono text-base font-bold text-amber-400 tabular-nums">
            {score}
          </span>
          <span className="text-stone-500">/ {targetScore}</span>
        </span>
        <span className="text-stone-400 text-[11px] font-mono tabular-nums">
          {progressPercent}%
        </span>
      </div>

      {/* Progress meter */}
      <div className="h-1.5 w-full bg-stone-800 rounded-full overflow-hidden border border-stone-700/50">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${progressPercent}%`,
            backgroundColor: color,
          }}
        />
      </div>

      {/* Visual matchsticks (Taraq matches) display */}
      <div className="flex flex-wrap items-center gap-1.5 min-h-[1.25rem] mt-0.5">
        {Array.from({ length: Math.min(bundles, 8) }).map((_, i) => (
          <div
            key={`b-${i}`}
            title="5 dhibcood (1 Taraq bundle)"
            className="flex items-center gap-0.5 px-1 py-0.5 bg-stone-900/60 rounded border border-amber-900/40"
          >
            {/* 4 vertical matches + 1 diagonal slash */}
            <div className="relative flex items-center gap-0.5 h-3.5 w-4">
              <span className="w-0.5 h-3 bg-amber-600 rounded-full" />
              <span className="w-0.5 h-3 bg-amber-600 rounded-full" />
              <span className="w-0.5 h-3 bg-amber-600 rounded-full" />
              <span className="w-0.5 h-3 bg-amber-600 rounded-full" />
              <span className="absolute top-0.5 left-0 w-4 h-0.5 bg-red-600 rounded-full transform rotate-45 origin-left" />
            </div>
          </div>
        ))}

        {bundles > 8 && (
          <span className="text-[10px] text-amber-500 font-bold">
            +{bundles - 8}
          </span>
        )}

        {Array.from({ length: singles }).map((_, i) => (
          <span
            key={`s-${i}`}
            title="1 dhibic"
            className="w-1 h-3.5 bg-amber-400 rounded-full inline-block"
          />
        ))}
      </div>
    </div>
  );
};
