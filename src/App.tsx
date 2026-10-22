import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { RoomState, PointAllocation } from './types/game.js';
import { LobbyView } from './components/LobbyView.js';
import { GameBoard } from './components/GameBoard.js';
import { RulesModal } from './components/RulesModal.js';
import { VercelNoticeModal } from './components/VercelNoticeModal.js';
import { soundManager } from './utils/audio.js';
import { LocalGameEngine } from './utils/localGameEngine.js';
import { P2PHostManager, P2PClientManager } from './utils/p2pNetwork.js';

const AVATARS = [
  { id: 'nin', emoji: '👨', label: 'Nin (Man)' },
  { id: 'naag', emoji: '👩', label: 'Naag (Woman)' },
  { id: 'dice', emoji: '🎲', label: 'Dice' },
];

export default function App() {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [selectedAvatar, setSelectedAvatar] = useState<string>('🎲');
  const [joinCode, setJoinCode] = useState<string>('');
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

  // Active runtime mode: 'local' | 'p2p-host' | 'p2p-client' | 'ws'
  const modeRef = useRef<'local' | 'p2p-host' | 'p2p-client' | 'ws'>('local');
  const localEngineRef = useRef<LocalGameEngine | null>(null);
  const p2pHostRef = useRef<P2PHostManager | null>(null);
  const p2pClientRef = useRef<P2PClientManager | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Initialize player name & avatar from localStorage or defaults
  useEffect(() => {
    const savedName = localStorage.getItem('taraq_player_name');
    if (savedName) {
      setPlayerName(savedName);
    } else {
      setPlayerName(`Ciyaaryahan ${Math.floor(10 + Math.random() * 90)}`);
    }

    const savedAvatar = localStorage.getItem('taraq_avatar');
    if (savedAvatar && AVATARS.some((a) => a.emoji === savedAvatar)) {
      setSelectedAvatar(savedAvatar);
    }

    // Check URL params for room code (e.g. ?room=ABCD)
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      setJoinCode(roomParam.toUpperCase());
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
    if (p2pHostRef.current) {
      p2pHostRef.current.destroy();
      p2pHostRef.current = null;
    }
    if (p2pClientRef.current) {
      p2pClientRef.current.destroy();
      p2pClientRef.current = null;
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

  // 1. FAST LOCAL BOT GAME (100% Client-side, never fails on Vercel)
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
      setSuccessNotice('🎮 Ciyaartii waa bilaabatay! Waxaad la dheeleysaa Bots (Vercel Ready).');
      setTimeout(() => setSuccessNotice(''), 4000);
    } catch (err: any) {
      console.error('Local bot game error', err);
      setErrorMsg('Khalad ayaa dhacay markii la bilaabayay ciyaarta bot-ka.');
    } finally {
      setIsConnecting(false);
    }
  };

  // 2. CREATE ROOM (P2P Mesh or WebSocket fallback)
  const handleCreateRoom = async (autoStartWithBots: boolean = false) => {
    cleanupAllConnections();
    setIsConnecting(true);
    setErrorMsg('');

    // Check if custom WebSocket URL is configured or if we should try WebSocket first
    const isVercelHost = window.location.hostname.endsWith('vercel.app');
    const wsTarget = customServerUrl.trim();

    if (wsTarget && !autoStartWithBots) {
      // Connect to user's dedicated WebSocket server
      try {
        const ws = new WebSocket(wsTarget);
        wsRef.current = ws;
        modeRef.current = 'ws';

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: 'CREATE_ROOM',
              playerName: playerName.trim() || 'Ciyaaryahan 1',
              avatar: selectedAvatar,
              targetScore,
              maxPlayers: 20,
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'ROOM_CREATED' || data.type === 'ROOM_JOINED') {
              setRoom(data.room);
              setMyPlayerId(data.yourPlayerId);
              setIsConnecting(false);
            } else if (data.type === 'ROOM_UPDATE') {
              setRoom(data.room);
              handleGameEvent(data.event);
            } else if (data.type === 'ERROR') {
              setErrorMsg(data.message || 'Khalad ayaa dhacay');
            }
          } catch (e) {
            console.error('Parse WS msg err', e);
          }
        };

        ws.onerror = () => {
          // Fall back to P2P Host seamlessly!
          startP2PHostRoom(autoStartWithBots);
        };
        return;
      } catch {
        startP2PHostRoom(autoStartWithBots);
        return;
      }
    }

    // Default for Vercel: P2PHostManager which allows sharing room code with friends without Node server!
    startP2PHostRoom(autoStartWithBots);
  };

  const startP2PHostRoom = (autoStartWithBots: boolean = false) => {
    try {
      const hostMgr = new P2PHostManager(
        playerName,
        selectedAvatar,
        20,
        (updatedRoom, event) => {
          setRoom(updatedRoom);
          handleGameEvent(event);
        },
        (errMsg) => {
          console.warn('P2P Host warning:', errMsg);
        },
        (roomCode) => {
          setIsConnecting(false);
          setSuccessNotice(`✅ Qolka [${roomCode}] waa diyaar! Koodhka u dir asxaabtaada.`);
          setTimeout(() => setSuccessNotice(''), 5000);
        }
      );

      p2pHostRef.current = hostMgr;
      modeRef.current = 'p2p-host';
      const hostId = hostMgr.engine.getHostId();
      setMyPlayerId(hostId);
      setRoom(hostMgr.engine.getRoom());
      setIsConnecting(false);

      if (autoStartWithBots) {
        hostMgr.engine.addBot(2);
        hostMgr.engine.startGame();
      }
    } catch (err: any) {
      console.error('Failed to create P2P room, falling back to local engine', err);
      // Pure local fallback guarantees it never fails!
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
    }
  };

  // 3. JOIN ROOM (P2P Client or WebSocket)
  const handleJoinRoom = async () => {
    if (!joinCode.trim()) {
      setErrorMsg('Fadlan geli furiha ama koodhka qolka');
      return;
    }

    cleanupAllConnections();
    setIsConnecting(true);
    setErrorMsg('');

    const trimmedCode = joinCode.trim().toUpperCase();

    // If custom WS server is configured, try WS first
    if (customServerUrl.trim()) {
      try {
        const ws = new WebSocket(customServerUrl.trim());
        wsRef.current = ws;
        modeRef.current = 'ws';

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: 'JOIN_ROOM',
              roomCode: trimmedCode,
              playerName: playerName.trim() || 'Ciyaaryahan',
              avatar: selectedAvatar,
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'ROOM_JOINED') {
              setRoom(data.room);
              setMyPlayerId(data.yourPlayerId);
              setIsConnecting(false);
            } else if (data.type === 'ROOM_UPDATE') {
              setRoom(data.room);
              handleGameEvent(data.event);
            } else if (data.type === 'ERROR') {
              setErrorMsg(data.message || 'Khalad ayaa dhacay');
              setIsConnecting(false);
            }
          } catch (e) {
            console.error('Parse WS error', e);
          }
        };

        ws.onerror = () => {
          connectP2PClient(trimmedCode);
        };
        return;
      } catch {
        connectP2PClient(trimmedCode);
        return;
      }
    }

    // Default: Connect via WebRTC P2P
    connectP2PClient(trimmedCode);
  };

  const connectP2PClient = (code: string) => {
    try {
      const client = new P2PClientManager(
        code,
        playerName.trim() || 'Ciyaaryahan',
        selectedAvatar,
        {
          onRoomUpdate: (updatedRoom, event) => {
            setRoom(updatedRoom);
            if (client.myPlayerId) {
              setMyPlayerId(client.myPlayerId);
            }
            setIsConnecting(false);
            handleGameEvent(event);
          },
          onError: (msg) => {
            setIsConnecting(false);
            setErrorMsg(msg);
          },
          onConnected: () => {
            soundManager.playPointsScored();
          },
        }
      );

      p2pClientRef.current = client;
      modeRef.current = 'p2p-client';

      // Timeout safety
      setTimeout(() => {
        if (!room && isConnecting) {
          setIsConnecting(false);
          setErrorMsg(`Lama xiriiri karin qolka [${code}]. Hubi in qofka sameeyay uu qolka ku jiro.`);
        }
      }, 7000);
    } catch (err: any) {
      setIsConnecting(false);
      setErrorMsg('Khalad ayaa ku yimid ku biirista qolka.');
    }
  };

  // Universal actions dispatching to active mode
  const handleStartGame = () => {
    soundManager.playClick();
    if (modeRef.current === 'local') {
      localEngineRef.current?.startGame();
    } else if (modeRef.current === 'p2p-host') {
      p2pHostRef.current?.engine.startGame();
    } else if (modeRef.current === 'ws') {
      wsRef.current?.send(JSON.stringify({ type: 'START_GAME' }));
    }
  };

  const handleAddBot = (count: number = 1) => {
    soundManager.playClick();
    if (modeRef.current === 'local') {
      localEngineRef.current?.addBot(count);
    } else if (modeRef.current === 'p2p-host') {
      p2pHostRef.current?.engine.addBot(count);
    } else if (modeRef.current === 'ws') {
      wsRef.current?.send(JSON.stringify({ type: 'ADD_BOT', count }));
    }
  };

  const handleRemovePlayer = (playerId: string) => {
    soundManager.playClick();
    if (modeRef.current === 'local') {
      localEngineRef.current?.removePlayer(playerId);
    } else if (modeRef.current === 'p2p-host') {
      p2pHostRef.current?.engine.removePlayer(playerId);
    } else if (modeRef.current === 'ws') {
      wsRef.current?.send(JSON.stringify({ type: 'REMOVE_PLAYER', playerId }));
    }
  };

  const handleRollDice = () => {
    if (modeRef.current === 'local') {
      localEngineRef.current?.rollDice(myPlayerId);
    } else if (modeRef.current === 'p2p-host') {
      p2pHostRef.current?.engine.rollDice(myPlayerId);
    } else if (modeRef.current === 'p2p-client') {
      p2pClientRef.current?.send({ type: 'ROLL_DICE' });
    } else if (modeRef.current === 'ws') {
      wsRef.current?.send(JSON.stringify({ type: 'ROLL_DICE' }));
    }
  };

  const handleSubmitActions = (allocation: PointAllocation) => {
    soundManager.playPointsScored();
    if (modeRef.current === 'local') {
      localEngineRef.current?.submitActions(myPlayerId, allocation);
    } else if (modeRef.current === 'p2p-host') {
      p2pHostRef.current?.engine.submitActions(myPlayerId, allocation);
    } else if (modeRef.current === 'p2p-client') {
      p2pClientRef.current?.send({ type: 'SUBMIT_ACTIONS', allocation });
    } else if (modeRef.current === 'ws') {
      wsRef.current?.send(JSON.stringify({ type: 'SUBMIT_ACTIONS', allocation }));
    }
  };

  const handleRestartGame = () => {
    soundManager.playClick();
    if (modeRef.current === 'local') {
      localEngineRef.current?.restartGame();
    } else if (modeRef.current === 'p2p-host') {
      p2pHostRef.current?.engine.restartGame();
    } else if (modeRef.current === 'ws') {
      wsRef.current?.send(JSON.stringify({ type: 'RESTART_GAME' }));
    }
  };

  const handleSendChat = (message: string) => {
    if (modeRef.current === 'local') {
      localEngineRef.current?.sendChat(myPlayerId, message);
    } else if (modeRef.current === 'p2p-host') {
      p2pHostRef.current?.engine.sendChat(myPlayerId, message);
    } else if (modeRef.current === 'p2p-client') {
      p2pClientRef.current?.send({ type: 'SEND_CHAT', message });
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
        <div className="relative w-full h-24 sm:h-32 md:h-36 overflow-hidden">
          <img
            src="/assets/aistudio/Gemini_Generated_Image_at8xcdat8xcdat8x_c8c14675.jpg"
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
                onClick={() => setShowVercelModal(true)}
                className="px-2.5 py-1.5 rounded-xl bg-stone-950/75 hover:bg-stone-900 border border-white/15 text-stone-300 text-xs font-semibold backdrop-blur-md transition-all shadow-md flex items-center gap-1.5"
                title="Xogta Vercel & Shabakadda"
              >
                <span>▲</span>
                <span className="hidden md:inline">Vercel Status</span>
              </button>

              <button
                onClick={() => setShowRules(true)}
                className="px-3 py-1.5 rounded-xl bg-stone-950/75 hover:bg-stone-900 border border-white/15 text-stone-200 text-xs font-semibold backdrop-blur-md transition-all shadow-md flex items-center gap-1.5"
                title="Shuruucda Ciyaarta"
              >
                <span>📖</span>
                <span className="hidden sm:inline">Shuruucda</span>
              </button>

              <button
                onClick={toggleSound}
                className="px-3 py-1.5 rounded-xl bg-stone-950/75 hover:bg-stone-900 border border-white/15 text-stone-200 text-xs font-semibold backdrop-blur-md transition-all shadow-md flex items-center gap-1.5"
                title={isSoundMuted ? 'Shid Codka' : 'Dami Codka'}
              >
                <span>{isSoundMuted ? '🔇' : '🔊'}</span>
              </button>

              {room ? (
                <button
                  onClick={handleLeaveRoom}
                  className="px-3.5 py-1.5 text-xs font-bold text-red-200 bg-red-950/80 hover:bg-red-900 border border-red-700/60 rounded-xl backdrop-blur-md transition-all shadow-md flex items-center gap-1.5"
                >
                  <span>🚪</span>
                  <span>Ka Bax</span>
                </button>
              ) : (
                <button
                  onClick={handleStartLocalBotGame}
                  className="px-3 py-1.5 rounded-xl bg-amber-600/90 hover:bg-amber-500 border border-amber-400/30 text-white text-xs font-bold backdrop-blur-md transition-all shadow-md flex items-center gap-1.5"
                  title="Toos ugu ciyaar Bots (Vercel Ready)"
                >
                  <span>🤖</span>
                  <span className="hidden sm:inline">Ciyaar Bot</span>
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

              {/* 1. Name & Avatar Selection Card */}
              <div className="bg-stone-900/90 border border-stone-800 rounded-3xl p-5 sm:p-7 shadow-xl flex flex-col gap-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-stone-100 flex items-center gap-2">
                      <span>👤</span>
                      <span>Magacaaga & Sawirkaaga (Your Profile)</span>
                    </h2>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Magaca aad halkan ku qorato waxaa toos u arki doona dhammaan asxaabta kula dheeleysa!
                    </p>
                  </div>

                  {/* Live Name Preview */}
                  <div className="flex items-center gap-2 bg-stone-950 px-3.5 py-1.5 rounded-xl border border-amber-500/40 self-start sm:self-auto shadow-inner">
                    <span className="text-xl">{selectedAvatar}</span>
                    <span className="font-bold text-sm text-amber-400 truncate max-w-[140px]">
                      {playerName.trim() || 'Magac la\'aan'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="text-xs text-stone-300 block mb-1.5 font-bold">
                      Qor Magacaaga:
                    </label>
                    <input
                      type="text"
                      value={playerName}
                      onChange={(e) => savePlayerName(e.target.value)}
                      placeholder="Tusaale: Baxaroos, Axmed, Sahra..."
                      className="w-full bg-stone-950 border border-stone-700/80 rounded-xl px-4 py-3 text-sm text-stone-100 font-semibold focus:outline-none focus:border-amber-500 shadow-inner"
                      maxLength={18}
                    />
                    <p className="text-[11px] text-stone-500 mt-1">
                      Magacan ayaa ka muuqan doona miiska ciyaarta iyo dhibcahaaga.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-stone-300 block mb-1.5 font-bold">
                      Dooro Astaantaada (Avatar):
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

              {/* Instant Bot Play Banner (1-Click, Zero Network Lag) */}
              <div className="bg-gradient-to-r from-amber-950/40 via-stone-900 to-amber-950/40 border border-amber-500/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-2xl">
                    🤖
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-amber-300">
                        Ku Ciyaar Bots (Offline & Vercel Ready)
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-600 text-emerald-300 text-[10px] font-bold">
                        Degdeg ah ⚡
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Toos ugu ciyaar browser-kaaga adigoon u baahnayn xiriir server ama network lag.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStartLocalBotGame}
                  className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold rounded-xl text-xs shadow-md shadow-amber-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <span>▶️</span>
                  <span>Bilaab Hadda (Play with Bots)</span>
                </button>
              </div>

              {/* 2. Online Multiplayer Actions: Create Room OR Join Room */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Option A: Create Room */}
                <div className="bg-stone-900/90 border border-amber-600/30 rounded-3xl p-5 sm:p-7 shadow-xl flex flex-col justify-between gap-5 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-8 h-8 rounded-xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-lg">
                        🎲
                      </span>
                      <h3 className="text-base sm:text-lg font-bold text-stone-100">
                        Abuur Qol (Create Room)
                      </h3>
                    </div>
                    <p className="text-xs text-stone-400 leading-relaxed">
                      Fur qol cusub online ah. Waxaad helaysaa <strong className="text-amber-400">Fure gaar ah (Room Key)</strong> oo aad asxaabtaada siiso si ay kuugu soo galaan (ilaa 20 qof)!
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCreateRoom(false)}
                    disabled={isConnecting}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 text-white font-bold rounded-2xl shadow-xl shadow-amber-950/60 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>🎲</span>
                    <span>{isConnecting ? 'Qolka ayaa la furayaa...' : 'Abuur Qolkaaga Hadda'}</span>
                  </button>
                </div>

                {/* Option B: Join Room */}
                <div className="bg-stone-900/90 border border-emerald-600/30 rounded-3xl p-5 sm:p-7 shadow-xl flex flex-col justify-between gap-5 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-8 h-8 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-lg">
                        🔑
                      </span>
                      <h3 className="text-base sm:text-lg font-bold text-stone-100">
                        Qol Ku Biir (Join Room)
                      </h3>
                    </div>
                    <p className="text-xs text-stone-400 leading-relaxed mb-3">
                      Saaxiibkaa ma kuu soo diray Fure qol? Geli halkan si aad toos ugu biirto qolkiisa!
                    </p>

                    {joinCode && (
                      <div className="mb-2 p-2.5 bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                        <span>👋</span>
                        <span>Furihii lagugu soo casuumay: <strong className="font-mono font-bold text-amber-300">{joinCode}</strong></span>
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
                        Furiha Qolka (Room Key):
                      </label>
                      <input
                        type="text"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="GELI FURIHA (TUS. K9W4P)"
                        className="w-full bg-stone-950 border-2 border-stone-700/80 rounded-xl px-4 py-2.5 text-base font-mono uppercase tracking-widest text-amber-400 font-bold focus:outline-none focus:border-emerald-500 shadow-inner"
                        maxLength={6}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleJoinRoom}
                    disabled={isConnecting || !joinCode.trim()}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold rounded-2xl shadow-xl shadow-emerald-950/50 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>🔑</span>
                    <span>{isConnecting ? 'Khadka ayaa lala xiriirayaa...' : 'Gal Qolka Asxaabta (Join)'}</span>
                  </button>
                </div>
              </div>
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
