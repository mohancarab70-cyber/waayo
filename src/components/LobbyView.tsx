import React, { useState } from 'react';
import type { RoomState, Player } from '../types/game.js';
import { soundManager } from '../utils/audio.js';

interface LobbyViewProps {
  room: RoomState;
  currentPlayerId: string;
  onStartGame: () => void;
  onAddBot: (count?: number) => void;
  onRemovePlayer: (playerId: string) => void;
  onSendChat: (msg: string) => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  room,
  currentPlayerId,
  onStartGame,
  onAddBot,
  onRemovePlayer,
  onSendChat,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [chatInput, setChatInput] = useState('');

  const isHost = room.hostId === currentPlayerId;
  const canStart = room.players.length >= 2;
  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/?room=${room.roomCode}` : `/?room=${room.roomCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopiedLink(true);
    soundManager.playClick();
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.roomCode);
    setCopiedCode(true);
    soundManager.playClick();
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `Play Taraq with me online! 🎲\nJoin my room directly with this link:\n${joinUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: 'Taraq - Online Dice Game',
          text: `Play Taraq with me online! Click this link to join:`,
          url: joinUrl,
        });
        soundManager.playClick();
      } catch {
        // User cancelled share
      }
    } else {
      handleCopyLink();
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChat(chatInput);
    setChatInput('');
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 animate-fade-in">
      {/* Primary Invitation Hero Card (Link-Centric Design) */}
      <div className="bg-gradient-to-br from-stone-900 via-stone-900 to-amber-950/40 border-2 border-amber-500/50 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4">
        {/* Top Info Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800/80 pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🔗</span>
              <h1 className="text-base sm:text-lg font-black text-amber-400">
                Invite Players
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-600 text-emerald-300 text-[10px] font-bold">
                Live ⚡
              </span>
            </div>
            <p className="text-xs text-stone-300 mt-1">
              Share this link with friends so they can join instantly without entering a code.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[11px] text-stone-400 font-semibold">Room Code:</span>
            <span className="px-3 py-1 bg-stone-950 border border-stone-800 rounded-xl font-mono font-black text-amber-400 text-sm tracking-wider">
              {room.roomCode}
            </span>
            <div className="bg-stone-950 px-3 py-1 rounded-xl border border-stone-800 text-xs font-bold text-stone-300">
              👥 {room.players.length}/{room.settings.maxPlayers || 20}
            </div>
          </div>
        </div>

        {/* Link Input + Main Action Buttons */}
        <div className="flex flex-col md:flex-row items-stretch gap-2.5">
          {/* Clickable link display */}
          <div
            onClick={handleCopyLink}
            className="flex-1 bg-stone-950 border border-amber-600/40 hover:border-amber-400 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 cursor-pointer group transition-all shadow-inner"
            title="Click to copy link"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <span className="text-amber-400 text-lg">🔗</span>
              <span className="font-mono text-xs sm:text-sm text-stone-200 truncate select-all">
                {joinUrl}
              </span>
            </div>
            <span className="text-[11px] text-amber-400 font-bold whitespace-nowrap bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 group-hover:bg-amber-500/20 transition-all">
              {copiedLink ? '✓ Copied!' : 'Click to copy'}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-stretch gap-2">
            <button
              onClick={handleCopyLink}
              className={`flex-1 sm:flex-none px-5 py-3 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg whitespace-nowrap ${
                copiedLink
                  ? 'bg-emerald-500 text-stone-950 shadow-emerald-950/60 scale-102 font-extrabold'
                  : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 shadow-amber-950/50'
              }`}
            >
              <span>{copiedLink ? '✓' : '📋'}</span>
              <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
            </button>

            <button
              onClick={handleShareWhatsApp}
              className="flex-1 sm:flex-none px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/40 cursor-pointer whitespace-nowrap"
              title="Share with friends on WhatsApp"
            >
              <span>💬</span>
              <span>WhatsApp</span>
            </button>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={handleNativeShare}
                className="px-3.5 py-3 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all border border-stone-700 cursor-pointer"
                title="Share link"
              >
                <span>📤</span>
                <span className="hidden sm:inline">Share</span>
              </button>
            )}
          </div>
        </div>

        {/* Dynamic feedback notice */}
        {copiedLink && (
          <div className="bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs px-4 py-2 rounded-xl flex items-center gap-2 animate-fade-in font-medium">
            <span>✅</span>
            <span>
              Invite link copied! Send it via WhatsApp, Telegram, or SMS.
            </span>
          </div>
        )}
      </div>

      {/* Players List Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-stone-900/90 border border-stone-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="text-base font-bold text-stone-200 flex items-center gap-2">
                <span>👥</span>
                <span>Joined Players ({room.players.length}/{room.settings.maxPlayers || 20})</span>
              </h2>
              {isHost && room.players.length < (room.settings.maxPlayers || 20) && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onAddBot(1)}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-400 font-medium border border-stone-700 transition-colors flex items-center gap-1"
                  >
                    <span>🤖</span>
                    <span>+1 Bot</span>
                  </button>
                  {room.players.length <= 15 && (
                    <button
                      onClick={() => onAddBot(5)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 font-medium border border-amber-500/30 transition-colors flex items-center gap-1"
                    >
                      <span>🤖</span>
                      <span>+5 Bots</span>
                    </button>
                  )}
                  {room.players.length < 20 && (
                    <button
                      onClick={() => onAddBot(20 - room.players.length)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium border border-stone-700 transition-colors"
                      title="Fill room to 20 players"
                    >
                      Fill 20
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Scrollable grid for up to 20 players */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto pr-1">
              {room.players.map((player) => {
                const isYou = player.id === currentPlayerId;
                return (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-stone-950/80 border border-stone-800/80"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-inner"
                        style={{ backgroundColor: `${player.color}25`, border: `2px solid ${player.color}` }}
                      >
                        {player.avatar}
                      </div>
                      <div className="overflow-hidden">
                        <div className="font-bold text-xs text-stone-200 flex items-center gap-1.5 truncate">
                          <span className="truncate">{player.name}</span>
                          {isYou && (
                            <span className="text-[9px] text-emerald-400 bg-emerald-950/50 px-1 rounded border border-emerald-800 shrink-0">
                              You
                            </span>
                          )}
                          {player.isHost && (
                            <span className="text-[9px] text-amber-400 bg-amber-950/50 px-1 rounded border border-amber-800 shrink-0">
                              Host
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-stone-400">
                          {player.isAi ? '🤖 Bot' : player.connected ? '🟢 Online' : '⚪ Offline'}
                        </div>
                      </div>
                    </div>

                    {isHost && !player.isHost && (
                      <button
                        onClick={() => onRemovePlayer(player.id)}
                        className="text-stone-500 hover:text-red-400 p-1 rounded transition-colors text-xs shrink-0"
                        title="Remove player"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Host Start Button */}
          {isHost ? (
            <div className="mt-2 pt-4 border-t border-stone-800 flex flex-col gap-2">
              <button
                onClick={onStartGame}
                disabled={!canStart}
                className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-base"
              >
                <span>🔥</span>
                <span>Start Game</span>
              </button>
              {!canStart && (
                <p className="text-xs text-stone-400 text-center">
                  At least 2 players needed. Add bots or share your invite link!
                </p>
              )}
            </div>
          ) : (
            <div className="mt-2 pt-4 border-t border-stone-800 text-center text-xs text-stone-400 italic">
              Waiting for host to start the game...
            </div>
          )}
        </div>

        {/* Live Lobby Chat & Activity */}
        <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between h-[380px]">
          <div>
            <h2 className="text-base font-bold text-stone-200 flex items-center gap-2 mb-3">
              <span>💬</span>
              <span>Room Activity & Chat</span>
            </h2>
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[240px] pr-1">
              {room.logs.length === 0 ? (
                <div className="text-xs text-stone-500 italic text-center py-8">
                  Activity and messages appear here...
                </div>
              ) : (
                room.logs.slice(0, 15).map((log) => (
                  <div key={log.id} className="text-xs text-stone-300 bg-stone-950/60 p-2 rounded-lg border border-stone-800/60">
                    {log.textEn || log.textSo}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chat Form */}
          <form onSubmit={handleChatSubmit} className="flex gap-2 pt-3 border-t border-stone-800">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Send message to room..."
              className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              maxLength={100}
            />
            <button
              type="submit"
              className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-amber-400 rounded-xl text-xs font-semibold transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
