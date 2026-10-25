import express from 'express';
import http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import type { RoomState, Player, DiceValue, PointAllocation, GameLog, ReactionEvent } from './src/types/game.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// In-memory rooms
const rooms = new Map<string, RoomState>();
// Map ws connection to { roomId, playerId }
const clientMeta = new Map<WebSocket, { roomId: string; playerId: string }>();

const PLAYER_COLORS = [
  '#DC2626', // Red
  '#2563EB', // Blue
  '#16A34A', // Green
  '#D97706', // Amber
  '#9333EA', // Purple
  '#0891B2', // Cyan
  '#E11D48', // Rose
  '#4F46E5', // Indigo
  '#059669', // Emerald
  '#CA8A04', // Yellow
  '#7C3AED', // Violet
  '#0284C7', // Sky
  '#DB2777', // Pink
  '#65A30D', // Lime
  '#EA580C', // Orange
  '#0D9488', // Teal
  '#38BDF8', // Light Sky
  '#F59E0B', // Gold
  '#A855F7', // Bright Purple
  '#FB7185', // Soft Rose
];

const BOT_NAMES = [
  'Khadar (Bot)',
  'Sahra (Bot)',
  'Guuleed (Bot)',
  'Ayaan (Bot)',
  'Warsame (Bot)',
  'Hibaaq (Bot)',
  'Sharmaarke (Bot)',
  'Fartuun (Bot)',
  'Farxaan (Bot)',
  'Caasha (Bot)',
  'Liibaan (Bot)',
  'Deeqa (Bot)',
  'Nuur (Bot)',
  'Hodan (Bot)',
  'Jaamac (Bot)',
  'Maryan (Bot)',
  'Xasan (Bot)',
  'Shamso (Bot)',
  'Cabdi (Bot)',
  'Fadumo (Bot)',
];

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function broadcastRoom(roomId: string, extraEvent?: any) {
  const room = rooms.get(roomId);
  if (!room) return;

  const payload = JSON.stringify({
    type: 'ROOM_UPDATE',
    room,
    event: extraEvent || null,
  });

  for (const [ws, meta] of clientMeta.entries()) {
    if (meta.roomId === roomId && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function addLog(room: RoomState, textSo: string, textEn: string, type: GameLog['type']) {
  const log: GameLog = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    textSo,
    textEn,
    type,
  };
  room.logs.unshift(log);
  if (room.logs.length > 50) {
    room.logs.pop();
  }
}

function checkVictoryCondition(room: RoomState): boolean {
  if (room.players.length < 2) return false;

  const activePlayers = room.players.filter((p) => !p.isLocked);
  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    room.phase = 'GAME_OVER';
    room.winnerId = winner.id;
    addLog(
      room,
      `🏆 GUUL! ${winner.name} ayaa ku guuleystay ciyaarta maadaama uu xiray dhammaan asxaabtii kale!`,
      `🏆 VICTORY! ${winner.name} won as the last standing player who locked all opponents!`,
      'win'
    );
    broadcastRoom(room.id, { type: 'GAME_OVER', winner });
    return true;
  }
  return false;
}

function nextTurn(room: RoomState) {
  if (room.phase === 'GAME_OVER') return;

  if (checkVictoryCondition(room)) return;

  // Move turn index to next player
  let nextIndex = (room.currentTurnIndex + 1) % room.players.length;
  if (nextIndex === 0) {
    room.roundNumber = (room.roundNumber || 1) + 1;
    if (room.roundNumber === 2) {
      addLog(
        room,
        `⚔️ Wareegii 1-aad wuu dhammaaday! Wareegga 2-aad ayaa bilaabmay — hadda weerarka, dhibco jarista, iyo xabsiga waa furan yihiin!`,
        `⚔️ Round 1 complete! Round 2 has begun — attacks, deductions, and jail locks are now active!`,
        'roll'
      );
    }
  }
  room.currentTurnIndex = nextIndex;
  room.lastRoll = null;
  room.pendingPoints = 0;
  room.turnStartTime = Date.now();

  const nextPlayer = room.players[nextIndex];

  // If next player is locked: skip turn and keep them locked!
  if (nextPlayer.isLocked) {
    room.phase = 'TURN_SKIPPED';
    addLog(
      room,
      `🔒 ${nextPlayer.name} wuu xiran yahay (${nextPlayer.lockPoints} pts)! Waa la mootiyay, ma dheeli karo ilaa la furo.`,
      `🔒 ${nextPlayer.name} is locked in jail (${nextPlayer.lockPoints} pts)! Turn skipped, cannot play until unlocked.`,
      'skip'
    );
    broadcastRoom(room.id, { type: 'TURN_SKIPPED', playerId: nextPlayer.id });

    // Transition to the following player after 1.8 seconds
    setTimeout(() => {
      const currentRoom = rooms.get(room.id);
      if (currentRoom && currentRoom.phase === 'TURN_SKIPPED') {
        nextTurn(currentRoom);
      }
    }, 1800);
    return;
  }

  room.phase = 'ROLLING';
  broadcastRoom(room.id);

  // If next player is AI, trigger automatic AI roll
  if (nextPlayer.isAi) {
    handleAiTurn(room);
  }
}

function handleAiTurn(room: RoomState) {
  const currentAi = room.players[room.currentTurnIndex];
  if (!currentAi || !currentAi.isAi || room.phase !== 'ROLLING') return;

  setTimeout(() => {
    const liveRoom = rooms.get(room.id);
    if (!liveRoom || liveRoom.phase !== 'ROLLING') return;
    const aiPlayer = liveRoom.players[liveRoom.currentTurnIndex];
    if (!aiPlayer || !aiPlayer.isAi) return;

    // Roll dice
    const roll = (Math.floor(Math.random() * 6) + 1) as DiceValue;
    liveRoom.lastRoll = roll;

    const isRound1 = (liveRoom.roundNumber || 1) === 1;

    if (roll === 5 || roll === 6) {
      const points = roll === 5 ? 5 : 10;
      if (isRound1) {
        aiPlayer.score = Math.min(30, aiPlayer.score + points);
        liveRoom.pendingPoints = 0;
        liveRoom.phase = 'TURN_SKIPPED';
        addLog(
          liveRoom,
          `🛡️ Wareegga 1 (Badbaado): ${aiPlayer.name} wuxuu keenay [${roll}] waxaana si toos ah loogu daray +${points} dhibcood! (${aiPlayer.score}/30).`,
          `🛡️ Round 1 (Safe): ${aiPlayer.name} rolled [${roll}] and auto-claimed +${points} pts! (${aiPlayer.score}/30).`,
          'point'
        );
        broadcastRoom(liveRoom.id, { type: 'DICE_ROLLED', value: roll, points });

        setTimeout(() => {
          const afterRoom = rooms.get(room.id);
          if (afterRoom) nextTurn(afterRoom);
        }, 1800);
      } else {
        liveRoom.pendingPoints = points;
        liveRoom.phase = 'MANAGING';

        addLog(
          liveRoom,
          `🎲 ${aiPlayer.name} wuxuu keenay [${roll}]! Wuxuu helay ${points} dhibcood oo uu maamulo.`,
          `🎲 ${aiPlayer.name} rolled [${roll}]! Earned ${points} action points to manage.`,
          'roll'
        );
        broadcastRoom(liveRoom.id, { type: 'DICE_ROLLED', value: roll, points });

        // After 1.4s, AI makes strategic moves
        setTimeout(() => {
          executeAiDecisions(liveRoom, aiPlayer, points);
        }, 1400);
      }
    } else {
      liveRoom.pendingPoints = 0;
      liveRoom.phase = 'TURN_SKIPPED';
      addLog(
        liveRoom,
        `🎲 ${aiPlayer.name} wuxuu keenay [${roll}] (Eber). Wareeggu wuu dhaafayaa.`,
        `🎲 ${aiPlayer.name} rolled [${roll}] (0 points). Turn passes.`,
        'roll'
      );
      broadcastRoom(liveRoom.id, { type: 'DICE_ROLLED', value: roll, points: 0 });

      setTimeout(() => {
        const afterRoom = rooms.get(room.id);
        if (afterRoom) nextTurn(afterRoom);
      }, 1600);
    }
  }, 1200);
}

function executeAiDecisions(room: RoomState, ai: Player, availablePoints: number) {
  const liveRoom = rooms.get(room.id);
  if (!liveRoom || liveRoom.phase !== 'MANAGING') return;

  let remaining = availablePoints;
  let selfPoints = 0;
  const deductions: { targetId: string; amount: number }[] = [];
  const locks: { targetId: string; lockPoints: number }[] = [];
  const unlocks: string[] = [];

  const opponents = liveRoom.players.filter((p) => p.id !== ai.id);

  // 1. Check if any opponent is at 0 points and unlocked -> lock them!
  for (const opp of opponents) {
    if (opp.score === 0 && !opp.isLocked && remaining >= 1) {
      const lockPts = Math.min(remaining, Math.min(5, 3));
      locks.push({ targetId: opp.id, lockPoints: lockPts });
      remaining -= lockPts;
      break;
    }
  }

  // 2. Deduct from opponent with highest score to bring them down to 0
  const oppWithPoints = opponents
    .filter((p) => !p.isLocked && p.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const opp of oppWithPoints) {
    if (remaining <= 0) break;
    const deductAmt = Math.min(opp.score, remaining);
    deductions.push({ targetId: opp.id, amount: deductAmt });
    remaining -= deductAmt;

    // If opponent score now becomes 0 and we still have points, lock them!
    if (opp.score - deductAmt === 0 && remaining >= 1 && locks.every((l) => l.targetId !== opp.id)) {
      const lockPts = Math.min(remaining, 5);
      locks.push({ targetId: opp.id, lockPoints: lockPts });
      remaining -= lockPts;
    }
  }

  // 3. Put remaining points into self points up to max 30
  const roomForSelf = Math.max(0, 30 - ai.score);
  selfPoints = Math.min(roomForSelf, remaining);
  remaining -= selfPoints;

  executePlayerActions(
    liveRoom,
    ai,
    { selfPoints, deductions, locks, unlocks },
    availablePoints
  );
}

function executePlayerActions(
  room: RoomState,
  player: Player,
  allocation: PointAllocation,
  maxPointsAllowed: number
) {
  // Validate points budget
  let totalDeductions = 0;
  for (const d of allocation.deductions || []) {
    if (d.amount > 0) {
      totalDeductions += d.amount;
    }
  }

  let totalLockCost = 0;
  for (const l of allocation.locks || []) {
    if (l.lockPoints < 1 || l.lockPoints > 5) {
      throw new Error('Dhibcaha xiritaanka waa in ay u dhexeeyaan 1 ilaa 5 dhibcood.');
    }
    totalLockCost += l.lockPoints;
  }

  let totalUnlockCost = 0;
  for (const targetId of allocation.unlocks || []) {
    const target = room.players.find((p) => p.id === targetId);
    if (target && target.isLocked) {
      totalUnlockCost += target.lockPoints;
    }
  }

  const selfPoints = allocation.selfPoints || 0;
  const totalSpent = selfPoints + totalDeductions + totalLockCost + totalUnlockCost;

  if (totalSpent > maxPointsAllowed) {
    throw new Error(`Kama badsan kartid ${maxPointsAllowed} dhibcood oo aad keentay.`);
  }

  // Check self score cap strictly <= 30
  if (player.score + selfPoints > 30) {
    throw new Error('Dhibcahaaga kama badnaan karaan 30 dhibcood (Max score is 30).');
  }

  if ((room.roundNumber || 1) === 1) {
    if ((allocation.deductions?.length || 0) > 0 || (allocation.locks?.length || 0) > 0) {
      throw new Error('Weerarka iyo xabsiga lama ogola wareegga 1-aad (Attacks not allowed in Round 1).');
    }
  }

  // 1. Process Deductions
  for (const d of allocation.deductions || []) {
    if (d.amount <= 0) continue;
    const target = room.players.find((p) => p.id === d.targetId);
    if (target) {
      const actualDeduct = Math.min(target.score, d.amount);
      target.score = Math.max(0, target.score - actualDeduct);
      addLog(
        room,
        `⚔️ ${player.name} wuxuu ka jaray ${actualDeduct} dhibcood ${target.name}! (Dhibcihiisa: ${target.score})`,
        `⚔️ ${player.name} deducted ${actualDeduct} points from ${target.name}! (Score: ${target.score})`,
        'deduct'
      );
    }
  }

  // 2. Process Locks (Target must have score === 0)
  for (const l of allocation.locks || []) {
    const target = room.players.find((p) => p.id === l.targetId);
    if (!target) throw new Error('Qofka la xirayo lama helin.');
    if (target.id === player.id) throw new Error('Naftaada ma xiri kartid.');
    if (target.isLocked) throw new Error(`${target.name} horay ayuu u xiran yahay.`);
    if (target.score > 0) {
      throw new Error(`Qofka la xirayo waa inuu leeyahay 0 dhibcood! (Dhibcihiisa: ${target.score})`);
    }

    target.isLocked = true;
    target.lockPoints = l.lockPoints;

    addLog(
      room,
      `🔒 ${player.name} wuxuu xabsiga ku xiray ${target.name} isagoo ku xiray [${l.lockPoints} dhibcood]!`,
      `🔒 ${player.name} locked ${target.name} in jail with [${l.lockPoints} lock points]!`,
      'lock'
    );
  }

  // 3. Process Unlocks (Free from jail by paying lockPoints)
  for (const targetId of allocation.unlocks || []) {
    const target = room.players.find((p) => p.id === targetId);
    if (target && target.isLocked) {
      target.isLocked = false;
      target.lockPoints = 0;
      addLog(
        room,
        `🗝️ ${player.name} wuxuu xabsiga ka saaray ${target.name}! Hadda wuu ciyaari karaa.`,
        `🗝️ ${player.name} freed ${target.name} from jail! Now active.`,
        'unlock'
      );
    }
  }

  // 4. Process Self Points (capped at 10)
  if (selfPoints > 0) {
    player.score = Math.min(10, player.score + selfPoints);
    addLog(
      room,
      `⭐ ${player.name} wuxuu helay +${selfPoints} dhibcood! (Wadar: ${player.score}/10)`,
      `⭐ ${player.name} added +${selfPoints} points to self! (Total: ${player.score}/10)`,
      'point'
    );
  }

  // 5. Check if all opponents are locked -> VICTORY!
  if (checkVictoryCondition(room)) {
    return;
  }

  // Move to next player
  nextTurn(room);
}

// WebSocket event handlers
wss.on('connection', (ws: WebSocket) => {
  ws.on('message', (messageRaw: string) => {
    try {
      const msg = JSON.parse(messageRaw.toString());

      switch (msg.type) {
        case 'CREATE_ROOM': {
          const roomCode = generateRoomCode();
          const hostId = `player-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const hostPlayer: Player = {
            id: hostId,
            name: (msg.playerName || 'Ciyaaryahan 1').trim().slice(0, 18),
            avatar: msg.avatar || '🎲',
            color: PLAYER_COLORS[0],
            score: 0,
            isLocked: false,
            lockPoints: 0,
            isHost: true,
            isAi: false,
            connected: true,
          };

          const newRoom: RoomState = {
            id: roomCode,
            roomCode,
            hostId,
            players: [hostPlayer],
            currentTurnIndex: 0,
            phase: 'LOBBY',
            lastRoll: null,
            pendingPoints: 0,
            turnStartTime: Date.now(),
            settings: {
              maxScoreCap: 30,
              maxPlayers: msg.maxPlayers || 20,
              turnTimeLimit: 45,
            },
            logs: [],
            winnerId: null,
            roundNumber: 1,
            lastReaction: null,
          };

          addLog(
            newRoom,
            `🌟 Qolka Taraq [${roomCode}] waa la abuuray (Ilaa 20 Ciyaartooy).`,
            `🌟 Taraq Room [${roomCode}] created (Up to 20 Players).`,
            'chat'
          );

          rooms.set(roomCode, newRoom);
          clientMeta.set(ws, { roomId: roomCode, playerId: hostId });

          ws.send(
            JSON.stringify({
              type: 'ROOM_CREATED',
              room: newRoom,
              yourPlayerId: hostId,
            })
          );
          break;
        }

        case 'JOIN_ROOM': {
          const roomCode = (msg.roomCode || '').toUpperCase().trim();
          const room = rooms.get(roomCode);
          if (!room) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Qolka lama helin (Room not found)' }));
            return;
          }

          // Check if reconnecting existing player
          if (msg.existingPlayerId) {
            const existing = room.players.find((p) => p.id === msg.existingPlayerId);
            if (existing) {
              existing.connected = true;
              clientMeta.set(ws, { roomId: roomCode, playerId: existing.id });
              ws.send(
                JSON.stringify({
                  type: 'ROOM_JOINED',
                  room,
                  yourPlayerId: existing.id,
                })
              );
              broadcastRoom(roomCode);
              return;
            }
          }

          // New player join
          if (room.phase !== 'LOBBY') {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Ciyaartu way bilaabatay horay (Game in progress)' }));
            return;
          }

          if (room.players.length >= room.settings.maxPlayers) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Qolku wuu buuxaa (Ilaa 20 qof kaliya)' }));
            return;
          }

          const newPlayerId = `player-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const colorIndex = room.players.length % PLAYER_COLORS.length;
          const newPlayer: Player = {
            id: newPlayerId,
            name: (msg.playerName || `Ciyaaryahan ${room.players.length + 1}`).trim().slice(0, 18),
            avatar: msg.avatar || '🎲',
            color: PLAYER_COLORS[colorIndex],
            score: 0,
            isLocked: false,
            lockPoints: 0,
            isHost: false,
            isAi: false,
            connected: true,
          };

          room.players.push(newPlayer);
          clientMeta.set(ws, { roomId: roomCode, playerId: newPlayerId });

          addLog(
            room,
            `👋 ${newPlayer.name} ayaa ku soo biiray qolka (${room.players.length}/20)!`,
            `👋 ${newPlayer.name} joined the room (${room.players.length}/20)!`,
            'chat'
          );

          ws.send(
            JSON.stringify({
              type: 'ROOM_JOINED',
              room,
              yourPlayerId: newPlayerId,
            })
          );
          broadcastRoom(roomCode);
          break;
        }

        case 'ADD_BOT': {
          const meta = clientMeta.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room || room.hostId !== meta.playerId || room.phase !== 'LOBBY') return;

          const countToAdd = Math.min(
            msg.count || 1,
            room.settings.maxPlayers - room.players.length
          );
          if (countToAdd <= 0) return;

          for (let i = 0; i < countToAdd; i++) {
            const botIndex = room.players.filter((p) => p.isAi).length;
            const botName = BOT_NAMES[botIndex % BOT_NAMES.length];
            const botId = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${i}`;
            const colorIndex = room.players.length % PLAYER_COLORS.length;

            const botPlayer: Player = {
              id: botId,
              name: botName,
              avatar: '🤖',
              color: PLAYER_COLORS[colorIndex],
              score: 0,
              isLocked: false,
              lockPoints: 0,
              isHost: false,
              isAi: true,
              connected: true,
            };

            room.players.push(botPlayer);
          }

          addLog(
            room,
            `🤖 ${countToAdd === 1 ? '1 Bot' : `${countToAdd} Bots`} ayaa lagu daray ciyaarta! (${room.players.length}/20)`,
            `🤖 ${countToAdd} bot(s) added! (${room.players.length}/20)`,
            'chat'
          );
          broadcastRoom(room.id);
          break;
        }

        case 'REMOVE_PLAYER': {
          const meta = clientMeta.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room || room.hostId !== meta.playerId || room.phase !== 'LOBBY') return;

          const targetId = msg.playerId;
          if (targetId === room.hostId) return;

          const idx = room.players.findIndex((p) => p.id === targetId);
          if (idx !== -1) {
            const removed = room.players.splice(idx, 1)[0];
            addLog(room, `🚪 ${removed.name} waa laga saaray qolka.`, `🚪 ${removed.name} was removed.`, 'chat');
            broadcastRoom(room.id);
          }
          break;
        }

        case 'START_GAME': {
          const meta = clientMeta.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room || room.hostId !== meta.playerId || room.phase !== 'LOBBY') return;

          if (room.players.length < 2) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Ugu yaraan 2 qof ayaa loo baahan yahay (At least 2 players needed)' }));
            return;
          }

          room.phase = 'ROLLING';
          room.roundNumber = 1;
          room.currentTurnIndex = 0;
          room.lastRoll = null;
          room.pendingPoints = 0;
          room.turnStartTime = Date.now();
          room.winnerId = null;

          for (const p of room.players) {
            p.score = 0;
            p.isLocked = false;
            p.lockPoints = 0;
          }

          addLog(
            room,
            `🔥 Ciyaarta Taraq ayaa bilaabatay! Wareegga 1-aad waa badbaado: lama is dili karo, qof kasta wuxuu keeno toos ayuu u qaadanayaa.`,
            `🔥 Taraq game has started! Round 1 is a Safe Round: attacks/jail disabled, all rolled points are auto-claimed!`,
            'chat'
          );

          broadcastRoom(room.id);

          if (room.players[0].isAi) {
            handleAiTurn(room);
          }
          break;
        }

        case 'ROLL_DICE': {
          const meta = clientMeta.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room || room.phase !== 'ROLLING') return;

          const currentPlayer = room.players[room.currentTurnIndex];
          if (!currentPlayer || currentPlayer.id !== meta.playerId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Hadda ma aha wareegaaga (Not your turn)' }));
            return;
          }

          // Authentic fair random roll: 1 - 6
          const roll = (Math.floor(Math.random() * 6) + 1) as DiceValue;
          room.lastRoll = roll;

          const isRound1 = (room.roundNumber || 1) === 1;

          if (roll === 5 || roll === 6) {
            const points = roll === 5 ? 5 : 10;
            if (isRound1) {
              currentPlayer.score = Math.min(30, currentPlayer.score + points);
              room.pendingPoints = 0;
              room.phase = 'TURN_SKIPPED';

              addLog(
                room,
                `🛡️ Wareegga 1 (Badbaado): ${currentPlayer.name} wuxuu keenay [${roll}] waxaana si toos ah loogu daray +${points} dhibcood! (${currentPlayer.score}/30). Lama is dili karo wareeggan.`,
                `🛡️ Round 1 (Safe): ${currentPlayer.name} rolled [${roll}] and auto-claimed +${points} pts! (${currentPlayer.score}/30). Attacks disabled in Round 1.`,
                'point'
              );

              broadcastRoom(room.id, { type: 'DICE_ROLLED', value: roll, points });

              setTimeout(() => {
                const liveRoom = rooms.get(room.id);
                if (liveRoom && liveRoom.phase === 'TURN_SKIPPED') {
                  nextTurn(liveRoom);
                }
              }, 1800);
            } else {
              room.pendingPoints = points;
              room.phase = 'MANAGING';

              addLog(
                room,
                `🎲 ${currentPlayer.name} wuxuu keenay [${roll}]! Wuxuu helay ${points} dhibcood oo uu maamulo.`,
                `🎲 ${currentPlayer.name} rolled [${roll}]! Earned ${points} action points to manage.`,
                'roll'
              );

              broadcastRoom(room.id, { type: 'DICE_ROLLED', value: roll, points });
            }
          } else {
            // 1, 2, 3, 4 gives 0 points
            room.pendingPoints = 0;
            room.phase = 'TURN_SKIPPED';

            addLog(
              room,
              `🎲 ${currentPlayer.name} wuxuu keenay [${roll}] (Eber). Wareeggu wuu dhaafayaa.`,
              `🎲 ${currentPlayer.name} rolled [${roll}] (0 points). Passing turn.`,
              'roll'
            );

            broadcastRoom(room.id, { type: 'DICE_ROLLED', value: roll, points: 0 });

            setTimeout(() => {
              const liveRoom = rooms.get(room.id);
              if (liveRoom && liveRoom.phase === 'TURN_SKIPPED') {
                nextTurn(liveRoom);
              }
            }, 1800);
          }
          break;
        }

        case 'SUBMIT_ACTIONS': {
          const meta = clientMeta.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room || room.phase !== 'MANAGING') return;

          const currentPlayer = room.players[room.currentTurnIndex];
          if (!currentPlayer || currentPlayer.id !== meta.playerId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Hadda ma aha wareegaaga' }));
            return;
          }

          const allocation: PointAllocation = msg.allocation;
          try {
            executePlayerActions(room, currentPlayer, allocation, room.pendingPoints);
            broadcastRoom(room.id);
          } catch (err: any) {
            ws.send(JSON.stringify({ type: 'ERROR', message: err.message || 'Khalad ayaa dhacay' }));
          }
          break;
        }

        case 'RESTART_GAME': {
          const meta = clientMeta.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room || room.hostId !== meta.playerId) return;

          // Reset all scores and locks
          for (const p of room.players) {
            p.score = 0;
            p.isLocked = false;
            p.lockPoints = 0;
          }
          room.currentTurnIndex = 0;
          room.phase = 'LOBBY';
          room.lastRoll = null;
          room.pendingPoints = 0;
          room.winnerId = null;

          addLog(room, `🔄 Ciyaarta dib ayaa loo bilaabay!`, `🔄 Game was reset!`, 'chat');
          broadcastRoom(room.id);
          break;
        }

        case 'SEND_CHAT': {
          const meta = clientMeta.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room) return;

          const player = room.players.find((p) => p.id === meta.playerId);
          const author = player ? player.name : 'Unknown';
          const cleanText = (msg.message || '').trim().slice(0, 100);
          if (!cleanText) return;

          const reaction: ReactionEvent = {
            id: `react-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            senderId: meta.playerId,
            senderName: author,
            senderAvatar: player ? player.avatar : '🎲',
            senderColor: player ? player.color : '#F59E0B',
            text: cleanText,
            timestamp: Date.now(),
          };
          room.lastReaction = reaction;

          addLog(room, `💬 ${author}: ${cleanText}`, `💬 ${author}: ${cleanText}`, 'chat');
          broadcastRoom(room.id, { type: 'REACTION', reaction });
          break;
        }

        case 'PING': {
          ws.send(JSON.stringify({ type: 'PONG' }));
          break;
        }
      }
    } catch (err) {
      console.error('Error handling WS message:', err);
    }
  });

  ws.on('close', () => {
    const meta = clientMeta.get(ws);
    if (meta) {
      const room = rooms.get(meta.roomId);
      if (room) {
        const player = room.players.find((p) => p.id === meta.playerId);
        if (player) {
          player.connected = false;
          broadcastRoom(meta.roomId);
        }
      }
      clientMeta.delete(ws);
    }
  });
});

// Setup Vite middlewares or static files
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT} (dev: ${isDev})`);
  });
}

startServer();
