import React, { useState, useEffect, useRef } from 'react';
import type { RoomState, Player, PointAllocation, ReactionEvent } from '../types/game.js';
import { Dice3D } from './Dice3D.js';
import { MatchstickCounter } from './MatchstickCounter.js';
import { ActionManagerModal } from './ActionManagerModal.js';
import { soundManager } from '../utils/audio.js';

interface GameBoardProps {
  room: RoomState;
  currentPlayerId: string;
  onRollDice: () => void;
  onSubmitActions: (allocation: PointAllocation) => void;
  onRestartGame: () => void;
  onSendChat: (msg: string) => void;
}

const QUICK_REACTIONS = [
  { text: 'Well played! 🎉', label: 'Well played 🎉' },
  { text: 'Locked you in jail! 🔒', label: 'Locked you 🔒' },
  { text: 'Free me from jail! 🗝️', label: 'Free me 🗝️' },
  { text: 'Spare my points! 😅', label: 'Spare me 😅' },
  { text: 'Victory is near! 👑', label: 'Victory 👑' },
  { text: 'Nice roll! 🎲', label: 'Nice roll 🎲' },
  { text: 'Watch out! ⚔️', label: 'Watch out ⚔️' },
  { text: 'Taraq! 🔥', label: 'Taraq! 🔥' },
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
  const [isDiceAnimating, setIsDiceAnimating] = useState(false);
  const [visibleReactions, setVisibleReactions] = useState<ReactionEvent[]>([]);
  const [justSentReaction, setJustSentReaction] = useState<string | null>(null);
  const lastReactionIdRef = useRef<string | null>(null);
  const lastChatLogIdRef = useRef<string | null>(null);

  // Sync incoming reaction events from room.lastReaction (Firebase / Local / WS)
  useEffect(() => {
    if (room.lastReaction && room.lastReaction.id !== lastReactionIdRef.current) {
      lastReactionIdRef.current = room.lastReaction.id;
      const newReact = room.lastReaction;
      soundManager.playReactionPop();
      setVisibleReactions((prev) => {
        const filtered = prev.filter((r) => r.id !== newReact.id);
        return [...filtered.slice(-2), newReact];
      });

      const timer = setTimeout(() => {
        setVisibleReactions((prev) => prev.filter((r) => r.id !== newReact.id));
      }, 4200);

      return () => clearTimeout(timer);
    }
  }, [room.lastReaction]);

  // Robust observer: scan incoming chat logs as well to ensure 100% reaction visibility
  useEffect(() => {
    if (!room.logs || room.logs.length === 0) return;
    const latest = room.logs[0];
    if (latest.type === 'chat' && latest.id !== lastChatLogIdRef.current) {
      lastChatLogIdRef.current = latest.id;
      if (!room.lastReaction || room.lastReaction.id !== latest.id) {
        const textRaw = latest.textEn || latest.textSo;
        const match = textRaw.match(/💬\s*(.*?):\s*"?([^"]*)"?/);
        const senderName = match ? match[1].trim() : 'Player';
        const msgText = match ? match[2].trim() : textRaw.replace(/^💬\s*/, '');
        const player = room.players.find(
          (p) => p.name.toLowerCase() === senderName.toLowerCase()
        );

        const syntheticReact: ReactionEvent = {
          id: latest.id,
          senderId: player?.id || 'unknown',
          senderName: player?.name || senderName,
          senderAvatar: player?.avatar || '💬',
          senderColor: player?.color || '#F59E0B',
          text: msgText,
          timestamp: latest.timestamp,
        };

        soundManager.playReactionPop();
        setVisibleReactions((prev) => {
          const filtered = prev.filter((r) => r.id !== syntheticReact.id);
          return [...filtered.slice(-2), syntheticReact];
        });

        const timer = setTimeout(() => {
          setVisibleReactions((prev) => prev.filter((r) => r.id !== syntheticReact.id));
        }, 4200);

        return () => clearTimeout(timer);
      }
    }
  }, [room.logs]);

  const currentPlayer = room.players[room.currentTurnIndex] || room.players[0];
  const isMyTurn = currentPlayer && currentPlayer.id === currentPlayerId;
  const you = room.players.find((p) => p.id === currentPlayerId) || room.players[0];

  const opponents = room.players.filter((p) => p.id !== currentPlayerId);
  const winner = room.winnerId ? room.players.find((p) => p.id === room.winnerId) : null;
  const activePlayersCount = room.players.filter((p) => !p.isLocked).length;

  const handleRollClick = () => {
    setIsDiceAnimating(true);
    onRollDice();
    // Safety fallback so state never hangs
    setTimeout(() => {
      setIsDiceAnimating(false);
    }, 1200);
  };

  const handleSendReaction = (text: string) => {
    soundManager.playClick();
    setJustSentReaction(text);
    setTimeout(() => setJustSentReaction(null), 1000);
    onSendChat(text);
  };

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
              Room: <span className="font-mono text-stone-200 font-bold">{room.roomCode}</span>
            </div>
            <div className="text-sm font-bold text-amber-400 flex items-center gap-2">
              <span>Last standing player wins</span>
              <span className="text-xs text-stone-400 font-normal">
                ({activePlayersCount}/{room.players.length} active)
              </span>
            </div>
          </div>
        </div>

        {/* Turn & Round Status Banners */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Round Badge */}
          {(room.roundNumber || 1) === 1 ? (
            <div className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 shadow-md">
              <span className="text-sm">🛡️</span>
              <span>Round 1: Safe Round</span>
              <span className="hidden sm:inline text-[10px] text-emerald-400 font-normal">· Auto-points (No Attacks)</span>
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-stone-950/90 border border-amber-600/60 text-amber-300 shadow-md">
              <span className="text-sm">⚔️</span>
              <span>Round {room.roundNumber}</span>
              <span className="hidden sm:inline text-[10px] text-amber-400 font-normal">· Combat Active</span>
            </div>
          )}

          {room.phase === 'TURN_SKIPPED' ? (
            <div className="px-3 py-1.5 bg-red-950/80 border border-red-700 text-red-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 animate-pulse shadow-md">
              <span className="text-base">🔒</span>
              <span>
                {currentPlayer?.name} is locked ({currentPlayer?.lockPoints || 0} pts) · Turn skipped!
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
                {isMyTurn ? 'Your Turn' : `${currentPlayer?.name}'s Turn`}
              </span>
            </div>
          )}

          <button
            onClick={() => setShowLogs(!showLogs)}
            className="text-xs px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium border border-stone-700 transition-colors"
          >
            📜 Logs ({room.logs.length})
          </button>
        </div>
      </div>

      {/* Main Table Arena */}
      <div className="relative w-full rounded-3xl overflow-hidden border-4 border-amber-950/80 shadow-[0_20px_50px_rgba(0,0,0,0.6)] min-h-[500px] flex flex-col justify-between bg-stone-950">
        {/* Table Felt Background image with dark overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-25"
          style={{
            backgroundImage: `url('/assets/aistudio/banner_789cc07a.png')`,
            backgroundColor: '#0F2B1D',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-stone-950/70 via-emerald-950/30 to-stone-950/80 pointer-events-none" />

        {/* Top/Side Opponents Bar (Supports up to 20 players) */}
        <div className="relative z-10 p-3 sm:p-4 bg-stone-950/70 border-b border-stone-800/80">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="text-xs font-semibold text-stone-300 flex items-center gap-2">
              <span>👥 Opponents ({opponents.length})</span>
              <span className="text-[10px] text-stone-400">
                · {room.players.filter((p) => !p.isLocked).length} active · {room.players.filter((p) => p.isLocked).length} locked
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-[210px] overflow-y-auto pr-1">
            {opponents.map((opp) => {
              const isTurn = opp.id === currentPlayer?.id;
              const oppReaction = visibleReactions.find((r) => r.senderId === opp.id);
              return (
                <div
                  key={opp.id}
                  className={`relative flex flex-col gap-1 p-2 rounded-xl border transition-all ${
                    opp.isLocked
                      ? 'bg-red-950/40 border-red-900/80'
                      : isTurn
                      ? 'bg-stone-900 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)] ring-1 ring-amber-500'
                      : 'bg-stone-900/80 border-stone-800'
                  }`}
                >
                  {/* Floating speech bubble above opponent card if they reacted */}
                  {oppReaction && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 px-2 py-0.5 rounded-full bg-amber-400 text-stone-950 text-[10px] font-black shadow-lg animate-bounce whitespace-nowrap flex items-center gap-1 border border-amber-300">
                      <span>💬</span>
                      <span className="truncate max-w-[110px]">{oppReaction.text}</span>
                    </div>
                  )}

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
                        title={`Locked in jail (${opp.lockPoints} pts)`}
                        className="text-[9px] px-1 py-0.5 bg-red-950 border border-red-800 text-red-300 rounded font-bold shrink-0 animate-pulse"
                      >
                        🔒 {opp.lockPoints}p
                      </span>
                    ) : isTurn ? (
                      <span className="text-[9px] text-amber-400 font-bold shrink-0 animate-pulse">
                        Turn
                      </span>
                    ) : null}
                  </div>

                  {/* Compact score and matchstick representation */}
                  <div className="flex items-center justify-between text-[10px] pt-0.5 border-t border-stone-800/60">
                    <span className="text-stone-400">Score:</span>
                    <span className="font-mono font-bold text-amber-400 tabular-nums">
                      {opp.score}/30
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* On-Screen Live Floating Reactions Feed (Visible to all players on screen) */}
        {visibleReactions.length > 0 && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex flex-col items-center gap-2.5 w-full max-w-sm px-4">
            {visibleReactions.map((react) => (
              <div
                key={react.id}
                className="animate-reaction-pop w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-stone-950/95 border-2 shadow-[0_12px_40px_rgba(0,0,0,0.85)] backdrop-blur-md"
                style={{
                  borderColor: react.senderColor || '#F59E0B',
                  boxShadow: `0 8px 30px ${react.senderColor || '#F59E0B'}45`,
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-inner"
                  style={{ backgroundColor: `${react.senderColor || '#F59E0B'}25` }}
                >
                  {react.senderAvatar}
                </div>
                <div className="flex flex-col text-left overflow-hidden min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[11px] font-black truncate"
                      style={{ color: react.senderColor || '#F59E0B' }}
                    >
                      {react.senderName}
                    </span>
                    <span className="text-[10px] text-stone-400 font-medium">💬 Reaction:</span>
                  </div>
                  <span className="text-sm font-extrabold text-white tracking-wide truncate">
                    {react.text}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Center Table: 3D Dice */}
        <div className="relative z-10 flex flex-col items-center justify-center my-6">
          <Dice3D
            value={room.lastRoll}
            isRolling={(room.phase === 'ROLLING' && currentPlayer?.isAi) || isDiceAnimating}
            canRoll={isMyTurn && room.phase === 'ROLLING' && !isDiceAnimating}
            onRoll={handleRollClick}
            onRollComplete={() => setIsDiceAnimating(false)}
            pendingPoints={room.pendingPoints}
          />

          <div className="text-center mt-1">
            {isMyTurn && room.phase === 'ROLLING' && (
              <p className="text-xs text-amber-300/90 font-medium animate-pulse">
                Click the dice or button to roll!
              </p>
            )}
            {!isMyTurn && room.phase === 'ROLLING' && (
              <p className="text-xs text-stone-400">
                Waiting for <strong className="text-stone-300">{currentPlayer?.name}</strong> to roll...
              </p>
            )}
            {room.phase === 'MANAGING' && (
              <p className="text-xs text-amber-400 font-semibold">
                {isMyTurn
                  ? 'Allocate your points below!'
                  : `${currentPlayer?.name} is allocating points...`}
              </p>
            )}
            {room.phase === 'TURN_SKIPPED' && (
              <p className="text-xs text-stone-300 font-medium bg-stone-900/80 px-3 py-1 rounded-lg border border-stone-800 inline-block">
                {room.lastRoll
                  ? (room.roundNumber || 1) === 1 && (room.lastRoll === 5 || room.lastRoll === 6)
                    ? `🛡️ Rolled [${room.lastRoll}] (+${room.lastRoll === 5 ? 5 : 10} pts claimed automatically!)`
                    : `🎲 Rolled [${room.lastRoll}] (0 pts) · Turn passes...`
                  : 'Turn passes...'}
              </p>
            )}
          </div>
        </div>

        {/* Bottom Station: Your Player Info */}
        <div className="relative z-10 p-4 bg-gradient-to-t from-stone-950 via-stone-900/90 to-transparent">
          {(() => {
            const yourReaction = visibleReactions.find((r) => r.senderId === you?.id);
            return (
              <div
                className={`relative max-w-md mx-auto p-3.5 rounded-2xl bg-stone-900/95 border-2 shadow-xl flex flex-col gap-2 ${
                  you?.isLocked ? 'border-red-600/80 bg-red-950/20' : 'border-amber-600/60'
                }`}
              >
                {/* Floating speech bubble above your card if you reacted */}
                {yourReaction && (
                  <div className="absolute -top-3.5 left-6 z-30 px-2.5 py-1 rounded-full bg-amber-400 text-stone-950 text-xs font-black shadow-lg animate-bounce whitespace-nowrap flex items-center gap-1 border border-amber-300">
                    <span>💬</span>
                    <span>{yourReaction.text}</span>
                  </div>
                )}
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
                    <span>{you?.name} (You)</span>
                    {you?.isLocked && (
                      <span className="text-[10px] text-red-400 bg-red-950/80 px-1.5 py-0.5 rounded border border-red-800 flex items-center gap-1 font-bold">
                        <span>🔒 Locked ({you.lockPoints} pts)</span>
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-stone-400">
                    {you?.isLocked ? 'In jail · Turn is skipped' : isMyTurn ? 'Your turn to roll!' : 'Waiting for turn'}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] text-stone-400 font-medium">Your Score</div>
                <div className="text-xl font-extrabold font-mono text-amber-400 tabular-nums">
                  {you?.score || 0} <span className="text-xs text-stone-500 font-normal">/ 30 max</span>
                </div>
              </div>
            </div>

            {/* Prominent Jail Notification when player is locked */}
            {you?.isLocked && (
              <div className="bg-red-950/80 border border-red-800 text-red-200 px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs animate-pulse">
                <span className="text-2xl">🔒</span>
                <div>
                  <div className="font-bold text-red-300">
                    You are in Jail! Locked with{' '}
                    <strong className="text-amber-300 font-mono text-sm underline font-bold">
                      {you.lockPoints} pts
                    </strong>
                    .
                  </div>
                  <p className="text-[11px] text-stone-300 mt-0.5">
                    Your turns are skipped until a player spends {you.lockPoints} points to release you.
                  </p>
                </div>
              </div>
            )}

            <MatchstickCounter
              score={you?.score || 0}
              targetScore={30}
              color={you?.color}
            />
          </div>
            );
          })()}
        </div>
      </div>

      {/* Quick Reactions Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-stone-900/90 border border-stone-800 p-3 rounded-2xl shadow-lg">
        <div className="flex items-center gap-2 text-xs font-bold text-amber-400 shrink-0">
          <span className="text-base animate-pulse">💬</span>
          <span>Live Reactions:</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5 w-full sm:w-auto">
          {QUICK_REACTIONS.map((react, i) => (
            <button
              key={i}
              onClick={() => handleSendReaction(react.text)}
              className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all border active:scale-90 shadow-sm flex items-center gap-1.5 cursor-pointer ${
                justSentReaction === react.text
                  ? 'bg-amber-400 text-stone-950 border-amber-300 scale-105 shadow-amber-400/40'
                  : 'bg-stone-800 hover:bg-stone-700 hover:border-amber-500/50 text-stone-200 border-stone-700/70'
              }`}
            >
              <span>{react.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Collapsible Logs Drawer */}
      {showLogs && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-xl max-h-60 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-xs text-stone-300 uppercase tracking-wider">
              Game Log
            </h3>
            <button
              onClick={() => setShowLogs(false)}
              className="text-stone-400 hover:text-stone-200 text-xs"
            >
              ✕ Close
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {room.logs.map((log) => (
              <div
                key={log.id}
                className="text-xs text-stone-300 p-1.5 rounded bg-stone-950/70 border border-stone-800/60"
              >
                {log.textEn || log.textSo}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Manager Modal */}
      <ActionManagerModal
        isOpen={isMyTurn && room.phase === 'MANAGING' && room.pendingPoints > 0 && !isDiceAnimating && (room.roundNumber || 1) > 1}
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
              Taraq Champion!
            </h2>
            <div className="text-lg font-bold text-stone-100">
              {winner.name} wins the match!
            </div>
            <p className="text-xs text-stone-300 leading-relaxed">
              Last standing player after locking all opponents in jail!
            </p>

            <div className="w-full bg-stone-950 p-4 rounded-xl border border-stone-800 my-2">
              <div className="text-xs font-semibold text-stone-400 mb-2">
                Player Standings:
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
                        <span className="text-amber-400 font-bold">🏆 WINNER</span>
                      )}
                    </span>
                    <span className="text-stone-400 font-mono text-[11px]">
                      {p.isLocked ? `🔒 Locked (${p.lockPoints}p)` : '✓ Free'}
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
                🔄 Play Again
              </button>
            ) : (
              <div className="text-xs text-stone-400 italic">
                Waiting for host to restart match...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
