import React, { useState } from 'react';
import type { RoomState, Player, PointAllocation } from '../types/game.js';
import { Dice3D } from './Dice3D.js';
import { MatchstickCounter } from './MatchstickCounter.js';
import { ActionManagerModal } from './ActionManagerModal.js';

interface GameBoardProps {
  room: RoomState;
  currentPlayerId: string;
  onRollDice: () => void;
  onSubmitActions: (allocation: PointAllocation) => void;
  onRestartGame: () => void;
  onSendChat: (msg: string) => void;
}

const QUICK_REACTIONS = [
  { text: 'Hambalyo! 🎉', label: 'Hambalyo' },
  { text: 'Waan ku xiray xabsiga! 🔒', label: 'Waan ku xiray' },
  { text: 'Xabsiga iga saara! 🗝️', label: 'Iga saara' },
  { text: 'Ha iga jarin dhibcaha! 😅', label: 'Ha iga jarin' },
  { text: 'Guushu waa dhowdahay! 👑', label: 'Guul' },
];

export const GameBoard: React.FC<GameBoardProps> = ({
  room,
  currentPlayerId,
  onRollDice,
  onSubmitActions,
  onRestartGame,
  onSendChat,
}) => {
  const [showLogs, setShowLogs] = useState(false);

  const currentPlayer = room.players[room.currentTurnIndex] || room.players[0];
  const isMyTurn = currentPlayer && currentPlayer.id === currentPlayerId;
  const you = room.players.find((p) => p.id === currentPlayerId) || room.players[0];

  const opponents = room.players.filter((p) => p.id !== currentPlayerId);
  const winner = room.winnerId ? room.players.find((p) => p.id === room.winnerId) : null;
  const activePlayersCount = room.players.filter((p) => !p.isLocked).length;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-4 animate-fade-in relative">
      {/* Top HUD */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-900/90 border border-stone-800 p-3.5 rounded-2xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-lg">
            🎲
          </div>
          <div>
            <div className="text-[11px] text-stone-400 font-medium">
              Qolka: <span className="font-mono text-stone-200 font-bold">{room.roomCode}</span>
            </div>
            <div className="text-sm font-bold text-amber-400 flex items-center gap-2">
              <span>Kan ugu dambeeya ee wax xira ayaa guuleysanaya</span>
              <span className="text-xs text-stone-400 font-normal">
                ({activePlayersCount}/{room.players.length} ciyaartooy ayaa furan)
              </span>
            </div>
          </div>
        </div>

        {/* Turn Status Banner */}
        <div className="flex items-center gap-2">
          {room.phase === 'TURN_SKIPPED' ? (
            <div className="px-3 py-1.5 bg-red-950/80 border border-red-700 text-red-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 animate-pulse shadow-md">
              <span className="text-base">🔒</span>
              <span>
                {currentPlayer?.name} wuu xiran yahay (Waxaa lagu xiray{' '}
                <strong className="text-amber-300 font-mono font-bold">
                  {currentPlayer?.lockPoints || 0} pts
                </strong>
                ) · Waa la mootiyay!
              </span>
            </div>
          ) : (
            <div
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
                isMyTurn
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-md shadow-amber-900/20'
                  : 'bg-stone-950/80 border-stone-800 text-stone-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentPlayer?.color }} />
              <span>
                {isMyTurn ? 'Wareeggaaga (Your Turn)!' : `Wareegga: ${currentPlayer?.name}`}
              </span>
            </div>
          )}

          <button
            onClick={() => setShowLogs(!showLogs)}
            className="text-xs px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium border border-stone-700 transition-colors"
          >
            📜 Diiwaanka ({room.logs.length})
          </button>
        </div>
      </div>

      {/* Main Table Arena */}
      <div className="relative w-full rounded-3xl overflow-hidden border-4 border-amber-950/80 shadow-[0_20px_50px_rgba(0,0,0,0.6)] min-h-[500px] flex flex-col justify-between bg-stone-950">
        {/* Table Felt Background image with dark overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-25"
          style={{
            backgroundImage: `url('/assets/aistudio/Gemini_Generated_Image_at8xcdat8xcdat8x_c8c14675.jpg')`,
            backgroundColor: '#0F2B1D',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-stone-950/70 via-emerald-950/30 to-stone-950/80 pointer-events-none" />

        {/* Top/Side Opponents Bar (Supports up to 20 players) */}
        <div className="relative z-10 p-3 sm:p-4 bg-stone-950/70 border-b border-stone-800/80">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="text-xs font-semibold text-stone-300 flex items-center gap-2">
              <span>👥 Asxaabta ({opponents.length})</span>
              <span className="text-[10px] text-stone-400">
                · {room.players.filter((p) => !p.isLocked).length} furan · {room.players.filter((p) => p.isLocked).length} xiran
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-[210px] overflow-y-auto pr-1">
            {opponents.map((opp) => {
              const isTurn = opp.id === currentPlayer?.id;
              return (
                <div
                  key={opp.id}
                  className={`flex flex-col gap-1 p-2 rounded-xl border transition-all ${
                    opp.isLocked
                      ? 'bg-red-950/40 border-red-900/80'
                      : isTurn
                      ? 'bg-stone-900 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)] ring-1 ring-amber-500'
                      : 'bg-stone-900/80 border-stone-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className="text-base shrink-0">{opp.avatar}</span>
                      <div className="overflow-hidden">
                        <div className="font-bold text-[11px] text-stone-200 truncate flex items-center gap-1">
                          <span className="truncate">{opp.name}</span>
                          {opp.isAi && <span className="text-[8px] text-stone-500 shrink-0">🤖</span>}
                        </div>
                      </div>
                    </div>

                    {opp.isLocked ? (
                      <span
                        title={`Xabsiga ku jira (${opp.lockPoints} dhibco)`}
                        className="text-[9px] px-1 py-0.5 bg-red-950 border border-red-800 text-red-300 rounded font-bold shrink-0 animate-pulse"
                      >
                        🔒 {opp.lockPoints}p
                      </span>
                    ) : isTurn ? (
                      <span className="text-[9px] text-amber-400 font-bold shrink-0 animate-pulse">
                        Wareegga
                      </span>
                    ) : null}
                  </div>

                  {/* Compact score and matchstick representation */}
                  <div className="flex items-center justify-between text-[10px] pt-0.5 border-t border-stone-800/60">
                    <span className="text-stone-400">Dhibco:</span>
                    <span className="font-mono font-bold text-amber-400 tabular-nums">
                      {opp.score}/10
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Table: 3D Dice */}
        <div className="relative z-10 flex flex-col items-center justify-center my-6">
          <Dice3D
            value={room.lastRoll}
            isRolling={room.phase === 'ROLLING' && currentPlayer?.isAi}
            canRoll={isMyTurn && room.phase === 'ROLLING'}
            onRoll={onRollDice}
            pendingPoints={room.pendingPoints}
          />

          <div className="text-center mt-1">
            {isMyTurn && room.phase === 'ROLLING' && (
              <p className="text-xs text-amber-300/90 font-medium animate-pulse">
                Taabo laadhuuda ama badhanka si aad u tuurto!
              </p>
            )}
            {!isMyTurn && room.phase === 'ROLLING' && (
              <p className="text-xs text-stone-400">
                Waxaa la sugayaa <strong className="text-stone-300">{currentPlayer?.name}</strong> inuu tuuro laadhuuda...
              </p>
            )}
            {room.phase === 'MANAGING' && (
              <p className="text-xs text-amber-400 font-semibold">
                {isMyTurn
                  ? 'Fadlan maamul dhibcahaaga hoose!'
                  : `${currentPlayer?.name} ayaa hadda maamulaya dhibcihiisa...`}
              </p>
            )}
            {room.phase === 'TURN_SKIPPED' && (
              <p className="text-xs text-stone-300 font-medium bg-stone-900/80 px-3 py-1 rounded-lg border border-stone-800 inline-block">
                {room.lastRoll
                  ? `🎲 Lambar [${room.lastRoll}] waa eber (0 dhibco) · Wareeggu wuu dhaafayaa...`
                  : 'Wareeggu wuu dhaafayaa...'}
              </p>
            )}
          </div>
        </div>

        {/* Bottom Station: Your Player Info */}
        <div className="relative z-10 p-4 bg-gradient-to-t from-stone-950 via-stone-900/90 to-transparent">
          <div
            className={`max-w-md mx-auto p-3.5 rounded-2xl bg-stone-900/95 border-2 shadow-xl flex flex-col gap-2 ${
              you?.isLocked ? 'border-red-600/80 bg-red-950/20' : 'border-amber-600/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner"
                  style={{ backgroundColor: `${you?.color}30`, border: `2px solid ${you?.color}` }}
                >
                  {you?.avatar}
                </div>
                <div>
                  <div className="font-bold text-sm text-stone-100 flex items-center gap-1.5">
                    <span>{you?.name} (Adiga)</span>
                    {you?.isLocked && (
                      <span className="text-[10px] text-red-400 bg-red-950/80 px-1.5 py-0.5 rounded border border-red-800 flex items-center gap-1 font-bold">
                        <span>🔒 Xiran tahay ({you.lockPoints} pts)</span>
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-stone-400">
                    {you?.isLocked ? 'Xabsiga ayaad ku jirtaa, wareeggaaga waa la mootinayaa' : isMyTurn ? 'Waa wareeggaaga!' : 'Wareeggaaga sug'}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] text-stone-400 font-medium">Dhibcahaaga</div>
                <div className="text-xl font-extrabold font-mono text-amber-400 tabular-nums">
                  {you?.score || 0} <span className="text-xs text-stone-500 font-normal">/ 10 max</span>
                </div>
              </div>
            </div>

            {/* Prominent Jail Notification when player is locked */}
            {you?.isLocked && (
              <div className="bg-red-950/80 border border-red-800 text-red-200 px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs animate-pulse">
                <span className="text-2xl">🔒</span>
                <div>
                  <div className="font-bold text-red-300">
                    Xabsiga ayaad ku jirtaa! Waxaa lagugu xiray{' '}
                    <strong className="text-amber-300 font-mono text-sm underline font-bold">
                      {you.lockPoints} dhibcood
                    </strong>
                    .
                  </div>
                  <p className="text-[11px] text-stone-300 mt-0.5">
                    Wareeggaaga waa la mootiyayaa ilaa qof asxaabta ka mid ahi uu bixiyo {you.lockPoints} dhibcood oo uu ku soo fasaxo.
                  </p>
                </div>
              </div>
            )}

            <MatchstickCounter
              score={you?.score || 0}
              targetScore={10}
              color={you?.color}
            />
          </div>
        </div>
      </div>

      {/* Quick Reactions Bar */}
      <div className="flex flex-wrap items-center justify-center gap-2 bg-stone-900/80 border border-stone-800 p-2.5 rounded-2xl">
        <span className="text-xs text-stone-400 font-medium mr-1">Dareen:</span>
        {QUICK_REACTIONS.map((react, i) => (
          <button
            key={i}
            onClick={() => onSendChat(react.text)}
            className="text-xs px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium transition-colors border border-stone-700/60 active:scale-95"
          >
            {react.label}
          </button>
        ))}
      </div>

      {/* Collapsible Logs Drawer */}
      {showLogs && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-xl max-h-60 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-xs text-stone-300 uppercase tracking-wider">
              Diiwaanka Ciyaarta (Game Log)
            </h3>
            <button
              onClick={() => setShowLogs(false)}
              className="text-stone-400 hover:text-stone-200 text-xs"
            >
              ✕ Xir
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {room.logs.map((log) => (
              <div
                key={log.id}
                className="text-xs text-stone-300 p-1.5 rounded bg-stone-950/70 border border-stone-800/60"
              >
                {log.textSo}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Manager Modal */}
      <ActionManagerModal
        isOpen={isMyTurn && room.phase === 'MANAGING' && room.pendingPoints > 0}
        availablePoints={room.pendingPoints}
        currentPlayer={you}
        players={room.players}
        onSubmit={onSubmitActions}
      />

      {/* Victory Modal (Last Player Standing who locked the others) */}
      {room.phase === 'GAME_OVER' && winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-stone-900 border-2 border-amber-500 w-full max-w-md rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center gap-4">
            <div className="text-5xl animate-bounce">👑</div>
            <h2 className="text-2xl font-extrabold font-serif text-amber-400">
              Guuleystaha Ciyaarta Taraq!
            </h2>
            <div className="text-lg font-bold text-stone-100">
              {winner.name} ayaa ku guuleystay!
            </div>
            <p className="text-xs text-stone-300 leading-relaxed">
              Wuxuu noqday qofka ugu dambeeyay ee xiray dhammaan asxaabtii kale!
            </p>

            <div className="w-full bg-stone-950 p-4 rounded-xl border border-stone-800 my-2">
              <div className="text-xs font-semibold text-stone-400 mb-2">
                Xaaladda Ciyaartooyda:
              </div>
              <div className="flex flex-col gap-2">
                {room.players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between text-xs p-2 rounded bg-stone-900"
                  >
                    <span className="font-medium text-stone-300 flex items-center gap-1.5">
                      <span>{p.avatar}</span>
                      <span>{p.name}</span>
                      {p.id === winner.id && (
                        <span className="text-amber-400 font-bold">🏆 GUULEYSTE</span>
                      )}
                    </span>
                    <span className="text-stone-400 font-mono text-[11px]">
                      {p.isLocked ? `🔒 Xiran (${p.lockPoints}p)` : '✓ Furan'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {room.hostId === currentPlayerId ? (
              <button
                onClick={onRestartGame}
                className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg transition-all text-sm"
              >
                🔄 Dib u bilow Ciyaarta (Play Again)
              </button>
            ) : (
              <div className="text-xs text-stone-400 italic">
                Waxaa la sugayaa marti-geliyaha inuu dib u bilaabo ciyaarta...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
