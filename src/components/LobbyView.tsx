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

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.roomCode);
    setCopiedCode(true);
    soundManager.playClick();
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    const joinUrl = `${window.location.origin}/?room=${room.roomCode}`;
    navigator.clipboard.writeText(joinUrl);
    setCopiedLink(true);
    soundManager.playClick();
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const joinUrl = `${window.location.origin}/?room=${room.roomCode}`;
    const text = encodeURIComponent(
      `Kaalay ila ciyaar Taraq Online! 🎲\nFuriha Qolka waa: ${room.roomCode}\nRiix xiriirkan si aad toos ugu soo gasho:\n${joinUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChat(chatInput);
    setChatInput('');
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 animate-fade-in">
      {/* Room Header Card */}
      <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-amber-500 font-bold">
              🔑 Furiha Qolka (Room Key)
            </span>
            <span className="text-[10px] text-stone-400">· U dir asxaabtaada si ay kuugu soo galaan</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            <h1 className="text-3xl sm:text-4xl font-extrabold font-mono tracking-widest text-amber-400 bg-stone-950 px-3.5 py-1 rounded-xl border border-amber-600/40">
              {room.roomCode}
            </h1>

            {/* Quick Share Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleCopyCode}
                className="text-xs px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold border border-stone-700 transition-colors flex items-center gap-1.5"
                title="Nuqul Furaha"
              >
                <span>{copiedCode ? '✓ Nuqul!' : '📋 Nuqul Furaha'}</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="text-xs px-3 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 font-semibold border border-amber-500/30 transition-colors flex items-center gap-1.5"
                title="Nuqul Xiriirka Qolka"
              >
                <span>{copiedLink ? '✓ Xiriirkii waa la koobiyay!' : '🔗 Nuqul Link-ga'}</span>
              </button>

              <button
                onClick={handleShareWhatsApp}
                className="text-xs px-3 py-2 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 text-white font-semibold transition-colors flex items-center gap-1.5"
                title="Ku wadaag WhatsApp"
              >
                <span>💬 WhatsApp</span>
              </button>
            </div>
          </div>
          <p className="text-xs text-stone-400 mt-2">
            Asxaabtaadu waxay gelin karaan furiha <strong className="text-amber-400 font-mono">{room.roomCode}</strong> ama riixi karaan link-ga tooska ah!
          </p>
        </div>

        {/* Room Info */}
        <div className="flex items-center gap-3 text-xs text-stone-400">
          <div className="bg-stone-950 px-4 py-2 rounded-xl border border-stone-800 text-center">
            <div className="text-[10px] text-stone-500 uppercase">Ciyaartooy</div>
            <div className="text-base font-bold text-amber-400 font-mono">
              {room.players.length} / {room.settings.maxPlayers || 20}
            </div>
          </div>
          <div className="bg-stone-950 px-4 py-2 rounded-xl border border-stone-800 text-center">
            <div className="text-[10px] text-stone-500 uppercase">Guusha</div>
            <div className="text-xs font-bold text-emerald-400">
              Kan Ugu Dambeeya ee Xira
            </div>
          </div>
        </div>
      </div>

      {/* Players List Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-stone-900/90 border border-stone-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="text-base font-bold text-stone-200 flex items-center gap-2">
                <span>👥</span>
                <span>Asxaabta Qolka ku Jirta ({room.players.length}/{room.settings.maxPlayers || 20})</span>
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
                      title="Ka dhig 20 ciyaartooy"
                    >
                      Buuxi 20
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
                              Adiga
                            </span>
                          )}
                          {player.isHost && (
                            <span className="text-[9px] text-amber-400 bg-amber-950/50 px-1 rounded border border-amber-800 shrink-0">
                              Host
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-stone-400">
                          {player.isAi ? '🤖 Kumbuyuutar (Bot)' : player.connected ? '🟢 Khadka ku jira' : '⚪ Khadka ka maqan'}
                        </div>
                      </div>
                    </div>

                    {isHost && !player.isHost && (
                      <button
                        onClick={() => onRemovePlayer(player.id)}
                        className="text-stone-500 hover:text-red-400 p-1 rounded transition-colors text-xs shrink-0"
                        title="Ka saar"
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
                <span>Bilow Ciyaarta (Start Game)</span>
              </button>
              {!canStart && (
                <p className="text-xs text-stone-400 text-center">
                  Ugu yaraan 2 ciyaaryahan ayaa loo baahan yahay. Ku dar Bot ama la wadaag koodhka saaxiib!
                </p>
              )}
            </div>
          ) : (
            <div className="mt-2 pt-4 border-t border-stone-800 text-center text-xs text-stone-400 italic">
              Waxaa la sugayaa marti-geliyaha inuu bilaabo ciyaarta...
            </div>
          )}
        </div>

        {/* Live Lobby Chat & Activity */}
        <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between h-[380px]">
          <div>
            <h2 className="text-base font-bold text-stone-200 flex items-center gap-2 mb-3">
              <span>💬</span>
              <span>Diiwaanka Qolka & Wadahadalka</span>
            </h2>
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[240px] pr-1">
              {room.logs.length === 0 ? (
                <div className="text-xs text-stone-500 italic text-center py-8">
                  Qoraallada halkan ayey ka soo muuqan doonaan...
                </div>
              ) : (
                room.logs.slice(0, 15).map((log) => (
                  <div key={log.id} className="text-xs text-stone-300 bg-stone-950/60 p-2 rounded-lg border border-stone-800/60">
                    {log.textSo}
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
              placeholder="Fariin u dir asxaabta..."
              className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              maxLength={100}
            />
            <button
              type="submit"
              className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-amber-400 rounded-xl text-xs font-semibold transition-colors"
            >
              Dir
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
