import React, { useState, useEffect, useRef } from 'react';
import type { RoomState, PointAllocation } from './types/game.js';
import { LobbyView } from './components/LobbyView.js';
import { GameBoard } from './components/GameBoard.js';
import { RulesModal } from './components/RulesModal.js';
import { VercelNoticeModal } from './components/VercelNoticeModal.js';
import { soundManager } from './utils/audio.js';
import { LocalGameEngine } from './utils/localGameEngine.js';
import {
  FirebaseRoomSync,
  createFirestoreRoom,
  joinFirestoreRoom,
} from './utils/firebaseGameSync.js';

const AVATARS = [
  { id: 'nin', emoji: '👨', label: 'Male' },
  { id: 'naag', emoji: '👩', label: 'Female' },
  { id: 'dice', emoji: '🎲', label: 'Dice' },
];

export default function App() {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [selectedAvatar, setSelectedAvatar] = useState<string>('🎲');
  const [joinCode, setJoinCode] = useState<string>('');
  const [invitedRoomCode, setInvitedRoomCode] = useState<string>('');
  const [targetScore, setTargetScore] = useState<number>(50);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successNotice, setSuccessNotice] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(false);
  const [showRules, setShowRules] = useState<boolean>(false);
  const [showVercelModal, setShowVercelModal] = useState<boolean>(false);
  const [customServerUrl, setCustomServerUrl] = useState<string>(() => {
    return localStorage.getItem('taraq_custom_server') || '';
  });

  // Active runtime mode: 'local' | 'firebase' | 'ws'
  const modeRef = useRef<'local' | 'firebase' | 'ws'>('local');
  const localEngineRef = useRef<LocalGameEngine | null>(null);
  const firebaseSessionRef = useRef<FirebaseRoomSync | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Initialize player name & avatar from localStorage or defaults
  useEffect(() => {
    const savedName = localStorage.getItem('taraq_player_name');
    if (savedName) {
      setPlayerName(savedName);
    } else {
      setPlayerName(`Player ${Math.floor(10 + Math.random() * 90)}`);
    }

    const savedAvatar = localStorage.getItem('taraq_avatar');
    if (savedAvatar && AVATARS.some((a) => a.emoji === savedAvatar)) {
      setSelectedAvatar(savedAvatar);
    }

    // Check URL params for room code (e.g. ?room=ABCD)
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      const code = roomParam.trim().toUpperCase();
      setJoinCode(code);
      setInvitedRoomCode(code);
    }
  }, []);

  const savePlayerName = (name: string) => {
    setPlayerName(name);
    localStorage.setItem('taraq_player_name', name);
  };

  const savePlayerAvatar = (avatarEmoji: string) => {
    setSelectedAvatar(avatarEmoji);
    localStorage.setItem('taraq_avatar', avatarEmoji);
  };

  const handleSaveCustomServer = (url: string) => {
    setCustomServerUrl(url);
    localStorage.setItem('taraq_custom_server', url);
  };

  // Cleanup helper
  const cleanupAllConnections = () => {
    if (localEngineRef.current) {
      localEngineRef.current.destroy();
      localEngineRef.current = null;
    }
    if (firebaseSessionRef.current) {
      firebaseSessionRef.current.destroy();
      firebaseSessionRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  // Play audio triggers on events
  const handleGameEvent = (event: any) => {
    if (!event) return;
    if (event.type === 'DICE_ROLLED') {
      soundManager.playDiceLand(event.points > 0);
    } else if (event.type === 'TURN_SKIPPED') {
      soundManager.playSkipSound();
    } else if (event.type === 'GAME_OVER') {
      soundManager.playVictorySound();
    }
  };

  // 1. FAST LOCAL BOT GAME (100% Client-side, never fails anywhere)
  const handleStartLocalBotGame = () => {
    cleanupAllConnections();
    setIsConnecting(true);
    setErrorMsg('');

    try {
      const engine = new LocalGameEngine(playerName, selectedAvatar, 20);
      localEngineRef.current = engine;
      modeRef.current = 'local';

      // Automatically add 2 bots for immediate fun
      engine.addBot(2);

      const hostId = engine.getHostId();
      setMyPlayerId(hostId);

      engine.subscribe((updatedRoom, event) => {
        setRoom(updatedRoom);
        handleGameEvent(event);
      });

      // Start the game right away
      engine.startGame();
      soundManager.playClick();
      setSuccessNotice('🎮 Match started vs Bots!');
      setTimeout(() => setSuccessNotice(''), 4000);
    } catch (err: any) {
      console.error('Local bot game error', err);
      setErrorMsg('Failed to start local bot match.');
    } finally {
      setIsConnecting(false);
    }
  };

  // 2. CREATE ROOM (Firebase Firestore Real-Time, 100% Reliable on Mobile & Vercel)
  const handleCreateRoom = async (autoStartWithBots: boolean = false) => {
    cleanupAllConnections();
    setIsConnecting(true);
    setErrorMsg('');

    try {
      const { session, roomCode, hostId } = await createFirestoreRoom(
        playerName,
        selectedAvatar,
        20,
        {
          onUpdate: (updatedRoom, event) => {
            setRoom(updatedRoom);
            handleGameEvent(event);
          },
          onError: (errMsg) => {
            setErrorMsg(errMsg);
          },
        }
      );

      firebaseSessionRef.current = session;
      modeRef.current = 'firebase';
      setMyPlayerId(hostId);
      setJoinCode(roomCode);

      // Keep room code in URL so sharing from address bar or WhatsApp links works
      try {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('room', roomCode);
        window.history.replaceState({}, '', newUrl.toString());
      } catch (e) {
        // Safe ignore
      }

      if (autoStartWithBots) {
        await session.addBot(2);
        await session.startGame();
      }

      setIsConnecting(false);
      setSuccessNotice(`🎉 Room created! Copy the invite link to invite friends.`);
      setTimeout(() => setSuccessNotice(''), 6000);
    } catch (err: any) {
      console.error('Failed to create Firebase room', err);
      // Pure local bot fallback
      const engine = new LocalGameEngine(playerName, selectedAvatar, 20);
      localEngineRef.current = engine;
      modeRef.current = 'local';
      setMyPlayerId(engine.getHostId());
      engine.subscribe((r, ev) => {
        setRoom(r);
        handleGameEvent(ev);
      });
      setRoom(engine.getRoom());
      setIsConnecting(false);
      setErrorMsg('Could not reach online server. Switched to offline Bot mode.');
    }
  };

  const handleJoinCodeChange = (val: string) => {
    let clean = val.trim();
    if (clean.includes('room=')) {
      const match = clean.match(/room=([A-Za-z0-9]+)/i);
      if (match && match[1]) {
        setJoinCode(match[1].toUpperCase());
        return;
      }
    }
    clean = clean.replace(/.*[\?&]room=/i, '');
    setJoinCode(clean.toUpperCase().slice(0, 10));
  };

  // 3. JOIN ROOM (Firebase Firestore Real-Time over HTTPS Port 443)
  const handleJoinRoom = async (overrideCode?: string) => {
    let rawInput = (overrideCode || joinCode).trim();
    if (rawInput.includes('room=')) {
      const match = rawInput.match(/room=([A-Za-z0-9]+)/i);
      if (match && match[1]) {
        rawInput = match[1];
      }
    }
    const targetCode = rawInput.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!targetCode) {
      setErrorMsg('Please enter or paste an invite link or room code.');
      return;
    }

    cleanupAllConnections();
    setIsConnecting(true);
    setErrorMsg('');

    try {
      const { session, playerId } = await joinFirestoreRoom(
        targetCode,
        playerName.trim() || 'Player',
        selectedAvatar,
        {
          onUpdate: (updatedRoom, event) => {
            setRoom(updatedRoom);
            handleGameEvent(event);
            setIsConnecting(false);
          },
          onError: (msg) => {
            setIsConnecting(false);
            setErrorMsg(msg);
          },
        }
      );

      firebaseSessionRef.current = session;
      modeRef.current = 'firebase';
      setMyPlayerId(playerId);
      setJoinCode(targetCode);

      try {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('room', targetCode);
        window.history.replaceState({}, '', newUrl.toString());
      } catch (e) {
        // Safe ignore
      }

      soundManager.playPointsScored();
      setSuccessNotice('🚀 Joined room successfully!');
      setTimeout(() => setSuccessNotice(''), 4000);
    } catch (err: any) {
      setIsConnecting(false);
      console.error('Join room error', err);
      setErrorMsg(err.message || 'Failed to join room. Please check the code.');
    }
  };

  // Universal actions dispatching to active mode
  const handleStartGame = () => {
    soundManager.playClick();
    if (modeRef.current === 'local') {
      localEngineRef.current?.startGame();
    } else if (modeRef.current === 'firebase') {
      firebaseSessionRef.current?.startGame();
    } else if (modeRef.current === 'ws') {
      wsRef.current?.send(JSON.stringify({ type: 'START_GAME' }));
    }
  };

  const handleAddBot = (count: number = 1) => {
    soundManager.playClick();
    if (modeRef.current === 'local') {
      localEngineRef.current?.addBot(count);
    } else if (modeRef.current === 'firebase') {
      firebaseSessionRef.current?.addBot(count);
    } else if (modeRef.current === 'ws') {
      wsRef.current?.send(JSON.stringify({ type: 'ADD_BOT', count }));
    }
  };

  const handleRemovePlayer = (playerId: string) => {
    soundManager.playClick();
    if (modeRef.current === 'local') {
      localEngineRef.current?.removePlayer(playerId);
    } else if (modeRef.current === 'firebase') {
      firebaseSessionRef.current?.removePlayer(playerId);
    } else if (modeRef.current === 'ws') {
      wsRef.current?.send(JSON.stringify({ type: 'REMOVE_PLAYER', playerId }));
    }
  };

  const handleRollDice = () => {
    if (modeRef.current === 'local') {
      localEngineRef.current?.rollDice(myPlayerId);
    } else if (modeRef.current === 'firebase') {
      firebaseSessionRef.current?.rollDice();
    } else if (modeRef.current === 'ws') {
      wsRef.current?.send(JSON.stringify({ type: 'ROLL_DICE' }));
    }
  };

  const handleSubmitActions = (allocation: PointAllocation) => {
    soundManager.playPointsScored();
    if (modeRef.current === 'local') {
      localEngineRef.current?.submitActions(myPlayerId, allocation);
    } else if (modeRef.current === 'firebase') {
      firebaseSessionRef.current?.submitActions(allocation);
    } else if (modeRef.current === 'ws') {
      wsRef.current?.send(JSON.stringify({ type: 'SUBMIT_ACTIONS', allocation }));
    }
  };

  const handleRestartGame = () => {
    soundManager.playClick();
    if (modeRef.current === 'local') {
      localEngineRef.current?.restartGame();
    } else if (modeRef.current === 'firebase') {
      firebaseSessionRef.current?.restartGame();
    } else if (modeRef.current === 'ws') {
      wsRef.current?.send(JSON.stringify({ type: 'RESTART_GAME' }));
    }
  };

  const handleSendChat = (message: string) => {
    if (modeRef.current === 'local') {
      localEngineRef.current?.sendChat(myPlayerId, message);
    } else if (modeRef.current === 'firebase') {
      firebaseSessionRef.current?.sendChat(message);
    } else if (modeRef.current === 'ws') {
      wsRef.current?.send(JSON.stringify({ type: 'SEND_CHAT', message }));
    }
  };

  const handleLeaveRoom = () => {
    cleanupAllConnections();
    setRoom(null);
    setMyPlayerId('');
    setErrorMsg('');
    setSuccessNotice('');
  };

  const toggleSound = () => {
    const nextState = !isSoundMuted;
    setIsSoundMuted(nextState);
    soundManager.enabled = !nextState;
    if (!nextState) soundManager.playClick();
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans selection:bg-amber-500 selection:text-stone-950">
      {/* Top Header with authentic Somali game artwork banner and minimal controls */}
      <header className="relative w-full border-b border-stone-800/90 bg-stone-950 shadow-2xl overflow-hidden sticky top-0 z-40">
        {/* Banner image embedded in header */}
        <div className="relative w-full h-28 sm:h-36 md:h-44 overflow-hidden">
          <img
            src="/assets/aistudio/banner_789cc07a.png"
            alt="Taraq Somali Board Game Banner"
            className="w-full h-full object-cover object-center select-none"
          />
          {/* Subtle gradient vignette to blend cleanly into the app without obscuring the artwork */}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/20 to-black/30 pointer-events-none" />

          {/* Minimal header controls floating over banner */}
          <div className="absolute inset-0 px-4 sm:px-8 py-3 flex items-center justify-between gap-4 pointer-events-auto">
            {/* Left: Minimal badge showing app identity */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-950/75 border border-white/15 backdrop-blur-md shadow-lg">
              <span className="text-xl">🎲</span>
              <span className="font-serif font-black tracking-wider text-amber-400 text-sm sm:text-base uppercase">
                Taraq
              </span>
            </div>

            {/* Right: Sleek quick actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={toggleSound}
                className="px-3 py-1.5 rounded-xl bg-stone-950/75 hover:bg-stone-900 border border-white/15 text-stone-200 text-xs font-semibold backdrop-blur-md transition-all shadow-md flex items-center gap-1.5"
                title={isSoundMuted ? 'Unmute Sound' : 'Mute Sound'}
              >
                <span>{isSoundMuted ? '🔇' : '🔊'}</span>
              </button>

              {room ? (
                <button
                  onClick={handleLeaveRoom}
                  className="px-3.5 py-1.5 text-xs font-bold text-red-200 bg-red-950/80 hover:bg-red-900 border border-red-700/60 rounded-xl backdrop-blur-md transition-all shadow-md flex items-center gap-1.5"
                >
                  <span>🚪</span>
                  <span>Leave</span>
                </button>
              ) : (
                <button
                  onClick={handleStartLocalBotGame}
                  className="px-3 py-1.5 rounded-xl bg-amber-600/90 hover:bg-amber-500 border border-amber-400/30 text-white text-xs font-bold backdrop-blur-md transition-all shadow-md flex items-center gap-1.5"
                  title="Play vs Bots Offline"
                >
                  <span>🤖</span>
                  <span className="hidden sm:inline">Play Bots</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col p-4 sm:p-6 max-w-6xl mx-auto w-full">
        {/* Global Success Notice */}
        {successNotice && (
          <div className="mb-4 p-3 bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs rounded-xl flex items-center justify-between animate-fade-in shadow-lg">
            <span>{successNotice}</span>
            <button onClick={() => setSuccessNotice('')} className="font-bold text-stone-400 hover:text-white p-1">✕</button>
          </div>
        )}

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-950/80 border border-red-800 text-red-200 text-xs rounded-xl flex items-center justify-between animate-fade-in shadow-lg">
            <span>⚠️ {errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="font-bold text-stone-400 hover:text-white p-1">✕</button>
          </div>
        )}

        {/* View 1: Welcome & Setup Screen (When not inside a room) */}
        {!room && (
          <div className="flex-1 flex flex-col justify-center items-center py-4 sm:py-8 animate-fade-in">
            <div className="w-full max-w-3xl flex flex-col gap-6">

              {/* FLOW 1: When arriving via an invitation link (?room=CODE) */}
              {invitedRoomCode ? (
                <div className="bg-gradient-to-br from-emerald-950/70 via-stone-900 to-amber-950/30 border-2 border-emerald-500/60 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col gap-6 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-800 pb-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-3xl shadow-inner">
                        💌
                      </div>
                      <div>
                        <div className="text-xs uppercase font-extrabold text-emerald-400 tracking-wider">
                          Room Invitation
                        </div>
                        <h2 className="text-base sm:text-xl font-black text-white mt-0.5">
                          You&apos;ve been invited to Taraq!
                        </h2>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-stone-950 px-4 py-2 rounded-2xl border border-amber-500/40 self-start sm:self-auto shadow-inner">
                      <span className="text-xs text-stone-400">Room:</span>
                      <span className="font-mono font-black text-amber-400 text-lg tracking-widest">{invitedRoomCode}</span>
                    </div>
                  </div>

                  <p className="text-xs text-stone-300">
                    Enter your name, choose an avatar, and join the match.
                  </p>

                  {/* Profile Setup */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="text-xs text-stone-200 block mb-1.5 font-bold">
                        Player Name:
                      </label>
                      <input
                        type="text"
                        value={playerName}
                        onChange={(e) => savePlayerName(e.target.value)}
                        placeholder="e.g. Alex, Maya, Sam..."
                        className="w-full bg-stone-950 border border-stone-700/80 rounded-xl px-4 py-3 text-sm text-stone-100 font-semibold focus:outline-none focus:border-emerald-500 shadow-inner"
                        maxLength={18}
                      />
                      <p className="text-[11px] text-stone-400 mt-1">
                        Visible to other players on the game board.
                      </p>
                    </div>

                    <div>
                      <label className="text-xs text-stone-200 block mb-1.5 font-bold">
                        Choose Avatar:
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {AVATARS.map((av) => (
                          <button
                            key={av.id}
                            type="button"
                            onClick={() => savePlayerAvatar(av.emoji)}
                            className={`h-12 rounded-xl flex items-center justify-center gap-1.5 px-2 transition-all cursor-pointer ${
                              selectedAvatar === av.emoji
                                ? 'bg-emerald-600/30 border-2 border-emerald-500 scale-102 shadow-md shadow-emerald-950/40 text-emerald-300 font-bold'
                                : 'bg-stone-950 border border-stone-800 hover:bg-stone-800 text-stone-300'
                            }`}
                          >
                            <span className="text-2xl">{av.emoji}</span>
                            <span className="text-xs font-semibold truncate">{av.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Direct 1-Click Join Button */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleJoinRoom(invitedRoomCode)}
                      disabled={isConnecting}
                      className="w-full sm:flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-stone-950 font-black rounded-2xl shadow-xl shadow-emerald-950/70 transition-all text-base flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                    >
                      <span>🚀</span>
                      <span>{isConnecting ? 'Joining room...' : 'Join Game'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setInvitedRoomCode('');
                        if (typeof window !== 'undefined') {
                          window.history.replaceState({}, document.title, window.location.pathname);
                        }
                      }}
                      className="text-xs text-stone-400 hover:text-stone-200 underline py-2 px-3 whitespace-nowrap"
                    >
                      ✕ Cancel / Create new room
                    </button>
                  </div>
                </div>
              ) : (
                /* FLOW 2: Standard Welcome Screen when not arriving via an invite link */
                <>
                  {/* 1. Name & Avatar Selection Card */}
                  <div className="bg-stone-900/90 border border-stone-800 rounded-3xl p-5 sm:p-7 shadow-xl flex flex-col gap-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-3">
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-stone-100 flex items-center gap-2">
                          <span>👤</span>
                          <span>Player Profile</span>
                        </h2>
                        <p className="text-xs text-stone-400 mt-0.5">
                          Set your display name and avatar for the game.
                        </p>
                      </div>

                      {/* Live Name Preview */}
                      <div className="flex items-center gap-2 bg-stone-950 px-3.5 py-1.5 rounded-xl border border-amber-500/40 self-start sm:self-auto shadow-inner">
                        <span className="text-xl">{selectedAvatar}</span>
                        <span className="font-bold text-sm text-amber-400 truncate max-w-[140px]">
                          {playerName.trim() || 'Anonymous'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="text-xs text-stone-300 block mb-1.5 font-bold">
                          Player Name:
                        </label>
                        <input
                          type="text"
                          value={playerName}
                          onChange={(e) => savePlayerName(e.target.value)}
                          placeholder="e.g. Player, Alex, Maya..."
                          className="w-full bg-stone-950 border border-stone-700/80 rounded-xl px-4 py-3 text-sm text-stone-100 font-semibold focus:outline-none focus:border-amber-500 shadow-inner"
                          maxLength={18}
                        />
                        <p className="text-[11px] text-stone-500 mt-1">
                          Displayed on the board and scoreboard.
                        </p>
                      </div>

                      <div>
                        <label className="text-xs text-stone-300 block mb-1.5 font-bold">
                          Choose Avatar:
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {AVATARS.map((av) => (
                            <button
                              key={av.id}
                              type="button"
                              onClick={() => savePlayerAvatar(av.emoji)}
                              className={`h-12 rounded-xl flex items-center justify-center gap-1.5 px-2 transition-all cursor-pointer ${
                                selectedAvatar === av.emoji
                                  ? 'bg-amber-600/30 border-2 border-amber-500 scale-102 shadow-md shadow-amber-950/40 text-amber-300 font-bold'
                                  : 'bg-stone-950 border border-stone-800 hover:bg-stone-800 text-stone-300'
                              }`}
                            >
                              <span className="text-2xl">{av.emoji}</span>
                              <span className="text-xs font-semibold truncate">{av.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Instant Bot Play Banner */}
                  <div className="bg-gradient-to-r from-amber-950/40 via-stone-900 to-amber-950/40 border border-amber-500/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-2xl">
                        🤖
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm sm:text-base font-bold text-amber-300">
                            Play Offline vs Bots
                          </h3>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-600 text-emerald-300 text-[10px] font-bold">
                            Instant ⚡
                          </span>
                        </div>
                        <p className="text-xs text-stone-400 mt-0.5">
                          Practice and play directly in browser with AI opponents.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleStartLocalBotGame}
                      className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold rounded-xl text-xs shadow-md shadow-amber-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      <span>▶️</span>
                      <span>Play Bots</span>
                    </button>
                  </div>

                  {/* 2. Online Multiplayer Actions: Create Room OR Join Room */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Option A: Create Room (Link-focused) */}
                    <div className="bg-stone-900/90 border border-amber-600/30 rounded-3xl p-5 sm:p-7 shadow-xl flex flex-col justify-between gap-5 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-8 h-8 rounded-xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-lg">
                            🎲
                          </span>
                          <h3 className="text-base sm:text-lg font-bold text-stone-100">
                            Create Room
                          </h3>
                        </div>
                        <p className="text-xs text-stone-400 leading-relaxed">
                          Host an online multiplayer match. Generate an instant <strong className="text-amber-400">invite link</strong> to share with friends (up to 20 players).
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCreateRoom(false)}
                        disabled={isConnecting}
                        className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 text-white font-bold rounded-2xl shadow-xl shadow-amber-950/60 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>🔗</span>
                        <span>{isConnecting ? 'Creating room...' : 'Create Room & Get Link'}</span>
                      </button>
                    </div>

                    {/* Option B: Join Room via Link or Key */}
                    <div className="bg-stone-900/90 border border-emerald-600/30 rounded-3xl p-5 sm:p-7 shadow-xl flex flex-col justify-between gap-5 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-8 h-8 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-lg">
                            🔑
                          </span>
                          <h3 className="text-base sm:text-lg font-bold text-stone-100">
                            Join Room
                          </h3>
                        </div>
                        <p className="text-xs text-stone-400 leading-relaxed mb-3">
                          Paste an invite link or room code to join an ongoing match.
                        </p>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
                            Room Code or Link:
                          </label>
                          <input
                            type="text"
                            value={joinCode}
                            onChange={(e) => handleJoinCodeChange(e.target.value)}
                            placeholder="PASTE LINK OR CODE"
                            className="w-full bg-stone-950 border-2 border-stone-700/80 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-mono text-amber-400 font-bold focus:outline-none focus:border-emerald-500 shadow-inner"
                          />
                          <span className="text-[10px] text-stone-500">
                            Paste a full invite URL (e.g. https://.../?room=ABCD) or room code.
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleJoinRoom()}
                        disabled={isConnecting || !joinCode.trim()}
                        className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold rounded-2xl shadow-xl shadow-emerald-950/50 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>🚀</span>
                        <span>{isConnecting ? 'Connecting...' : 'Join Room'}</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* View 2: Inside Room Lobby */}
        {room && room.phase === 'LOBBY' && (
          <LobbyView
            room={room}
            currentPlayerId={myPlayerId}
            onStartGame={handleStartGame}
            onAddBot={handleAddBot}
            onRemovePlayer={handleRemovePlayer}
            onSendChat={handleSendChat}
          />
        )}

        {/* View 3: Active Playing Game Board */}
        {room && room.phase !== 'LOBBY' && (
          <GameBoard
            room={room}
            currentPlayerId={myPlayerId}
            onRollDice={handleRollDice}
            onSubmitActions={handleSubmitActions}
            onRestartGame={handleRestartGame}
            onSendChat={handleSendChat}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-800/80 bg-stone-950/90 py-4 px-6 text-center mt-auto">
        <p className="text-xs text-stone-400 font-medium tracking-wide">
          created by <span className="text-amber-400 font-semibold">baxaroos</span>
        </p>
      </footer>

      {/* Rules Modal */}
      <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />

      {/* Vercel & Network Info Modal */}
      <VercelNoticeModal
        isOpen={showVercelModal}
        onClose={() => setShowVercelModal(false)}
        serverUrl={customServerUrl}
        onSaveServerUrl={handleSaveCustomServer}
      />
    </div>
  );
}
