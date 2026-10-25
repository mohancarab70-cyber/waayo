import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase.js';
import type {
  RoomState,
  Player,
  DiceValue,
  PointAllocation,
  GameLog,
} from '../types/game.js';
import {
  PLAYER_COLORS,
  BOT_NAMES,
  generateRoomCode,
} from './localGameEngine.js';

export interface RoomSyncListener {
  onUpdate: (room: RoomState, event?: any) => void;
  onError: (errorMsg: string) => void;
}

const BOT_AVATARS = ['👨', '👩', '🎲'];

export class FirebaseRoomSync {
  public roomCode: string;
  public myPlayerId: string;
  public isHost: boolean;
  private unsubscribe: Unsubscribe | null = null;
  private currentRoom: RoomState | null = null;
  private listener: RoomSyncListener;
  private botTimer: any = null;
  private destroyed: boolean = false;

  constructor(
    roomCode: string,
    myPlayerId: string,
    isHost: boolean,
    listener: RoomSyncListener
  ) {
    this.roomCode = roomCode;
    this.myPlayerId = myPlayerId;
    this.isHost = isHost;
    this.listener = listener;

    this.startListening();
  }

  private startListening() {
    const roomRef = doc(db, 'rooms', this.roomCode);
    this.unsubscribe = onSnapshot(
      roomRef,
      (snapshot) => {
        if (this.destroyed) return;
        if (!snapshot.exists()) {
          this.listener.onError('Qolkaan lama helin ama waa la xiray.');
          return;
        }

        const data = snapshot.data() as any;
        // Transform or validate to RoomState
        const room: RoomState = {
          id: data.roomId || this.roomCode,
          roomCode: data.roomId || this.roomCode,
          hostId: data.hostId,
          players: data.players || [],
          currentTurnIndex: data.currentTurnIndex || 0,
          phase: data.phase || (data.status === 'playing' ? 'ROLLING' : 'LOBBY'),
          lastRoll: data.lastRoll || null,
          pendingPoints: data.pendingPoints || 0,
          turnStartTime: data.updatedAt || Date.now(),
          settings: {
            maxScoreCap: 30,
            maxPlayers: data.maxPlayers || 20,
            turnTimeLimit: 45,
          },
          logs: data.logs || [],
          winnerId: data.winnerId || null,
          roundNumber: data.roundNumber || 1,
        };

        const prevRoom = this.currentRoom;
        this.currentRoom = room;

        // Detect event
        let event: any = undefined;
        if (prevRoom && room.lastRoll && prevRoom.lastRoll !== room.lastRoll) {
          event = { type: 'DICE_ROLLED', value: room.lastRoll, points: room.pendingPoints };
        } else if (room.phase === 'GAME_OVER' && prevRoom?.phase !== 'GAME_OVER') {
          event = { type: 'GAME_OVER', winnerId: room.winnerId };
        } else if (room.phase === 'TURN_SKIPPED' && prevRoom?.phase !== 'TURN_SKIPPED') {
          event = { type: 'TURN_SKIPPED' };
        }

        this.listener.onUpdate(room, event);

        // If host, check if it's bot turn
        if (this.isHost && room.phase === 'ROLLING') {
          const current = room.players[room.currentTurnIndex];
          if (current?.isAi) {
            clearTimeout(this.botTimer);
            this.botTimer = setTimeout(() => {
              if (!this.destroyed) this.botTakeTurn(current);
            }, 1200);
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `rooms/${this.roomCode}`);
      }
    );
  }

  public getRoom(): RoomState | null {
    return this.currentRoom;
  }

  private async saveRoomState(updatedRoom: RoomState, eventType?: string) {
    if (this.destroyed) return;
    const roomRef = doc(db, 'rooms', this.roomCode);

    const firestorePayload = {
      roomId: this.roomCode,
      hostId: updatedRoom.hostId,
      hostName: updatedRoom.players.find((p) => p.isHost)?.name || 'Host',
      status: updatedRoom.phase === 'LOBBY' ? 'waiting' : (updatedRoom.phase === 'GAME_OVER' ? 'finished' : 'playing'),
      phase: updatedRoom.phase,
      players: updatedRoom.players,
      currentTurnIndex: updatedRoom.currentTurnIndex,
      lastRoll: updatedRoom.lastRoll,
      pendingPoints: updatedRoom.pendingPoints,
      winnerId: updatedRoom.winnerId,
      roundNumber: updatedRoom.roundNumber || 1,
      logs: updatedRoom.logs.slice(-50), // keep last 50 logs
      updatedAt: Date.now(),
      createdAt: updatedRoom.turnStartTime || Date.now(),
    };

    try {
      await updateDoc(roomRef, firestorePayload);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `rooms/${this.roomCode}`);
    }
  }

  // --- Actions ---

  public async startGame() {
    if (!this.currentRoom) return;
    if (this.currentRoom.players.length < 2) {
      throw new Error('Ugu yaraan 2 ciyaartooy ayaa loo baahan yahay si loo bilaabo ciyaarta.');
    }

    const room: RoomState = {
      ...this.currentRoom,
      phase: 'ROLLING',
      roundNumber: 1,
      currentTurnIndex: 0,
      winnerId: null,
      lastRoll: null,
      pendingPoints: 0,
      turnStartTime: Date.now(),
      players: this.currentRoom.players.map((p) => ({
        ...p,
        score: 0,
        isLocked: false,
        lockPoints: 0,
      })),
      logs: [
        ...this.currentRoom.logs,
        {
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          textSo: '🏁 Ciyaartii waa bilaabatay! Wareegga 1-aad waa badbaado: lama is dili karo, dhibcaha toos (automatic) ayaa loo qaadanayaa.',
          textEn: '🏁 Game started! Round 1 is a Safe Round: no attacks/jail, all points rolled are auto-claimed!',
          type: 'roll',
        },
      ],
    };

    await this.saveRoomState(room);
  }

  public async addBot(count: number = 1) {
    if (!this.currentRoom || this.currentRoom.phase !== 'LOBBY') return;
    const addedCount = Math.max(1, Math.min(count, 5));
    const players = [...this.currentRoom.players];
    const newLogs: GameLog[] = [];

    for (let i = 0; i < addedCount; i++) {
      if (players.length >= 20) break;
      const botIdx = players.length;
      const botName = BOT_NAMES[botIdx % BOT_NAMES.length];
      const botAvatar = BOT_AVATARS[botIdx % BOT_AVATARS.length];
      const botColor = PLAYER_COLORS[botIdx % PLAYER_COLORS.length];

      const bot: Player = {
        id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: botName,
        avatar: botAvatar,
        color: botColor,
        score: 0,
        isLocked: false,
        lockPoints: 0,
        isHost: false,
        isAi: true,
        connected: true,
      };

      players.push(bot);
      newLogs.push({
        id: `log-${Date.now()}-${i}`,
        timestamp: Date.now(),
        textSo: `🤖 ${botName} ayaa ku soo biiray qolka.`,
        textEn: `🤖 ${botName} joined the room.`,
        type: 'chat',
      });
    }

    const updatedRoom: RoomState = {
      ...this.currentRoom,
      players,
      logs: [...this.currentRoom.logs, ...newLogs],
    };

    await this.saveRoomState(updatedRoom);
  }

  public async removePlayer(playerId: string) {
    if (!this.currentRoom || this.currentRoom.phase !== 'LOBBY') return;
    const target = this.currentRoom.players.find((p) => p.id === playerId);
    if (!target || target.isHost) return;

    const players = this.currentRoom.players.filter((p) => p.id !== playerId);
    const updatedRoom: RoomState = {
      ...this.currentRoom,
      players,
      logs: [
        ...this.currentRoom.logs,
        {
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          textSo: `👋 ${target.name} waa laga saaray qolka.`,
          textEn: `👋 ${target.name} was removed from the room.`,
          type: 'chat',
        },
      ],
    };

    await this.saveRoomState(updatedRoom);
  }

  public async rollDice() {
    if (!this.currentRoom || this.currentRoom.phase !== 'ROLLING') return;
    const current = this.currentRoom.players[this.currentRoom.currentTurnIndex];
    if (!current || current.id !== this.myPlayerId) return;

    const roll = (Math.floor(Math.random() * 6) + 1) as DiceValue;
    const newLogs = [...this.currentRoom.logs];
    const isRound1 = (this.currentRoom.roundNumber || 1) === 1;

    let pending = 0;
    let nextPhase: RoomState['phase'] = 'MANAGING';
    const players = this.currentRoom.players.map((p) => ({ ...p }));
    const pCurrent = players.find((p) => p.id === current.id)!;

    if (roll === 5 || roll === 6) {
      const points = roll === 5 ? 5 : 10;
      if (isRound1) {
        // Round 1: Attacks strictly disabled, auto-credit rolled points to self
        pCurrent.score = Math.min(30, pCurrent.score + points);
        pending = 0;
        nextPhase = 'TURN_SKIPPED';
        newLogs.push({
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          textSo: `🛡️ Wareegga 1 (Badbaado): ${current.name} wuxuu keenay [${roll}] waxaana si toos ah loogu daray +${points} dhibcood! (${pCurrent.score}/30). Lama is dili karo.`,
          textEn: `🛡️ Round 1 (Safe): ${current.name} rolled [${roll}] and auto-claimed +${points} pts! (${pCurrent.score}/30). Attacks disabled in Round 1.`,
          type: 'point',
        });
      } else {
        pending = points;
        nextPhase = 'MANAGING';
        newLogs.push({
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          textSo: roll === 5
            ? `🎲 ${current.name} wuxuu keenay [5]! Wuxuu helay 5 dhibcood.`
            : `🎯 ${current.name} wuxuu keenay [6]! Wuxuu helay 10 dhibcood!`,
          textEn: roll === 5
            ? `🎲 ${current.name} rolled [5]! 5 points.`
            : `🎯 ${current.name} rolled [6]! 10 points!`,
          type: 'roll',
        });
      }
    } else {
      pending = 0;
      nextPhase = 'TURN_SKIPPED';
      newLogs.push({
        id: `log-${Date.now()}`,
        timestamp: Date.now(),
        textSo: `🎲 ${current.name} wuxuu keenay [${roll}] (Eber). Wareeggu wuu dhaafayaa.`,
        textEn: `🎲 ${current.name} rolled [${roll}] (0 points). Turn passes.`,
        type: 'roll',
      });
    }

    const updatedRoom: RoomState = {
      ...this.currentRoom,
      players,
      lastRoll: roll,
      pendingPoints: pending,
      phase: nextPhase,
      logs: newLogs,
    };

    await this.saveRoomState(updatedRoom);

    if (nextPhase === 'TURN_SKIPPED') {
      // Allow players to see the rolled face (1..6) and 3D roll animation
      setTimeout(async () => {
        if (this.destroyed) return;
        if (this.currentRoom && this.currentRoom.phase === 'TURN_SKIPPED' && this.currentRoom.lastRoll === roll) {
          const nextRoom = this.advanceTurn(this.currentRoom);
          await this.saveRoomState(nextRoom);
        }
      }, 2000);
    }
  }

  public async submitActions(allocation: PointAllocation) {
    if (!this.currentRoom || this.currentRoom.phase !== 'MANAGING') return;
    const current = this.currentRoom.players[this.currentRoom.currentTurnIndex];
    if (!current || current.id !== this.myPlayerId) return;

    const updatedRoom = this.applyPointAllocation(this.currentRoom, current, allocation);
    await this.saveRoomState(updatedRoom);
  }

  private applyPointAllocation(
    room: RoomState,
    player: Player,
    allocation: PointAllocation
  ): RoomState {
    const players = room.players.map((p) => ({ ...p }));
    const pCurrent = players.find((p) => p.id === player.id)!;
    const logs = [...room.logs];

    let totalDeductions = 0;
    for (const d of allocation.deductions || []) {
      if (d.amount > 0) totalDeductions += d.amount;
    }

    let totalLockCost = 0;
    for (const l of allocation.locks || []) {
      totalLockCost += l.lockPoints;
    }

    let totalUnlockCost = 0;
    for (const targetId of allocation.unlocks || []) {
      const target = players.find((p) => p.id === targetId);
      if (target && target.isLocked) {
        totalUnlockCost += target.lockPoints;
      }
    }

    let totalAdjustmentCost = 0;
    for (const adj of allocation.lockAdjustments || []) {
      if (adj.delta !== 0) {
        totalAdjustmentCost += Math.abs(adj.delta);
      }
    }

    const selfPoints = allocation.selfPoints || 0;
    const totalSpent = selfPoints + totalDeductions + totalLockCost + totalUnlockCost + totalAdjustmentCost;

    if (totalSpent > room.pendingPoints) {
      throw new Error(`Kama badsan kartid ${room.pendingPoints} dhibcood.`);
    }

    if ((room.roundNumber || 1) === 1) {
      if ((allocation.deductions?.length || 0) > 0 || (allocation.locks?.length || 0) > 0 || (allocation.lockAdjustments?.some((a) => a.delta > 0))) {
        throw new Error('Weerarka iyo xabsiga lama ogola wareegga 1-aad (Attacks not allowed in Round 1).');
      }
    }

    // 1. Deductions
    for (const d of allocation.deductions || []) {
      if (d.amount <= 0) continue;
      const target = players.find((p) => p.id === d.targetId);
      if (target) {
        const actual = Math.min(target.score, d.amount);
        target.score = Math.max(0, target.score - actual);
        logs.push({
          id: `log-${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          textSo: `⚔️ ${player.name} wuxuu ka jaray ${actual} dhibcood ${target.name}! (Dhibcihiisa: ${target.score})`,
          textEn: `⚔️ ${player.name} deducted ${actual} points from ${target.name}!`,
          type: 'deduct',
        });
      }
    }

    // 2. Locks
    for (const l of allocation.locks || []) {
      const target = players.find((p) => p.id === l.targetId);
      if (target && !target.isLocked && target.score === 0) {
        target.isLocked = true;
        target.lockPoints = Math.min(5, Math.max(1, l.lockPoints));
        logs.push({
          id: `log-${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          textSo: `🔒 ${player.name} wuxuu xabsiga ku xiray ${target.name} [${target.lockPoints} dhibcood]!`,
          textEn: `🔒 ${player.name} locked ${target.name} [${target.lockPoints} pts]!`,
          type: 'lock',
        });
      }
    }

    // 3. Lock Adjustments (Increase burden or decrease/lighten burden)
    for (const adj of allocation.lockAdjustments || []) {
      if (adj.delta === 0) continue;
      const target = players.find((p) => p.id === adj.targetId);
      if (!target || !target.isLocked) continue;

      if (adj.delta > 0) {
        const prev = target.lockPoints;
        target.lockPoints = Math.min(5, target.lockPoints + adj.delta);
        const added = target.lockPoints - prev;
        logs.push({
          id: `log-${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          textSo: `⛓️ ${player.name} wuxuu culeyska ku kordhiyay ${target.name} (+${added}), xabsigiisu waa [${target.lockPoints}/5 dhibcood]!`,
          textEn: `⛓️ ${player.name} added burden to ${target.name} (+${added}), jail is now [${target.lockPoints}/5 pts]!`,
          type: 'lock',
        });
      } else {
        const reduceAmt = Math.abs(adj.delta);
        target.lockPoints = Math.max(0, target.lockPoints - reduceAmt);
        if (target.lockPoints === 0) {
          target.isLocked = false;
          logs.push({
            id: `log-${Date.now()}-${Math.random()}`,
            timestamp: Date.now(),
            textSo: `🗝️ ${player.name} wuxuu xabsiga ka saaray ${target.name} isagoo dhibcihii xabsiga ka dhameeyay!`,
            textEn: `🗝️ ${player.name} freed ${target.name} by clearing jail points!`,
            type: 'unlock',
          });
        } else {
          logs.push({
            id: `log-${Date.now()}-${Math.random()}`,
            timestamp: Date.now(),
            textSo: `🗝️ ${player.name} wuxuu xabsiga ka fududeeyay ${target.name} (-${reduceAmt}), waxaa ku haray [${target.lockPoints}/5 dhibcood]!`,
            textEn: `🗝️ ${player.name} reduced jail burden for ${target.name} (-${reduceAmt}), [${target.lockPoints}/5 pts] remaining!`,
            type: 'unlock',
          });
        }
      }
    }

    // 4. Legacy Unlocks
    for (const targetId of allocation.unlocks || []) {
      const target = players.find((p) => p.id === targetId);
      if (target && target.isLocked) {
        target.isLocked = false;
        target.lockPoints = 0;
        logs.push({
          id: `log-${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          textSo: `🗝️ ${player.name} wuxuu xabsiga ka saaray ${target.name}!`,
          textEn: `🗝️ ${player.name} freed ${target.name} from jail!`,
          type: 'unlock',
        });
      }
    }

    // 5. Self points
    if (selfPoints > 0) {
      pCurrent.score = Math.min(30, pCurrent.score + selfPoints);
      logs.push({
        id: `log-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        textSo: `⭐ ${player.name} wuxuu helay +${selfPoints} dhibcood! (${pCurrent.score}/30)`,
        textEn: `⭐ ${player.name} +${selfPoints} pts! (${pCurrent.score}/30)`,
        type: 'point',
      });
    }

    // 5. Check victory
    const activeRemaining = players.filter((p) => !p.isLocked);
    if (activeRemaining.length === 1 && players.length > 1) {
      const winner = activeRemaining[0];
      logs.push({
        id: `log-${Date.now()}`,
        timestamp: Date.now(),
        textSo: `👑 GUUL! Waxaa guuleystay ${winner.name}! Wuxuu xiray ciyaartoyda kale oo dhan!`,
        textEn: `👑 VICTORY! ${winner.name} wins!`,
        type: 'win',
      });

      return {
        ...room,
        players,
        phase: 'GAME_OVER',
        winnerId: winner.id,
        logs,
      };
    }

    // Advance turn
    return this.advanceTurn({
      ...room,
      players,
      logs,
    });
  }

  private advanceTurn(room: RoomState): RoomState {
    let nextIdx = (room.currentTurnIndex + 1) % room.players.length;
    let attempts = 0;
    const logs = [...room.logs];

    let roundNumber = room.roundNumber || 1;
    // Check if full cycle around the table has completed to advance round
    if (nextIdx === 0) {
      roundNumber += 1;
      if (roundNumber === 2) {
        logs.push({
          id: `log-${Date.now()}-r2`,
          timestamp: Date.now(),
          textSo: `⚔️ Wareegii 1-aad wuu dhammaaday! Wareegga 2-aad ayaa bilaabmay — hadda weerarka, dhibco jarista, iyo xabsiga waa furan yihiin!`,
          textEn: `⚔️ Round 1 complete! Round 2 has begun — attacks, deductions, and jail locks are now active!`,
          type: 'roll',
        });
      }
    }

    // Skip locked players
    while (attempts < room.players.length) {
      const candidate = room.players[nextIdx];
      if (!candidate.isLocked) {
        break;
      }
      logs.push({
        id: `log-${Date.now()}-${attempts}`,
        timestamp: Date.now(),
        textSo: `🔒 ${candidate.name} wuu xiran yahay. Wareegga wuu dhaafay!`,
        textEn: `🔒 ${candidate.name} is locked in jail. Turn skipped!`,
        type: 'skip',
      });
      nextIdx = (nextIdx + 1) % room.players.length;
      attempts++;
    }

    return {
      ...room,
      roundNumber,
      currentTurnIndex: nextIdx,
      phase: 'ROLLING',
      lastRoll: null,
      pendingPoints: 0,
      turnStartTime: Date.now(),
      logs,
    };
  }

  private async botTakeTurn(bot: Player) {
    if (!this.currentRoom || this.currentRoom.phase !== 'ROLLING') return;
    const current = this.currentRoom.players[this.currentRoom.currentTurnIndex];
    if (!current || current.id !== bot.id) return;

    const roll = (Math.floor(Math.random() * 6) + 1) as DiceValue;
    const logs = [...this.currentRoom.logs];
    const isRound1 = (this.currentRoom.roundNumber || 1) === 1;

    if (roll === 5 || roll === 6) {
      const pts = roll === 5 ? 5 : 10;
      if (isRound1) {
        const players = this.currentRoom.players.map((p) => ({ ...p }));
        const pBot = players.find((p) => p.id === bot.id)!;
        pBot.score = Math.min(30, pBot.score + pts);

        logs.push({
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          textSo: `🛡️ Wareegga 1 (Badbaado): ${bot.name} wuxuu keenay [${roll}] waxaana si toos ah loogu daray +${pts} dhibcood! (${pBot.score}/30).`,
          textEn: `🛡️ Round 1 (Safe): ${bot.name} rolled [${roll}] and auto-claimed +${pts} pts! (${pBot.score}/30).`,
          type: 'point',
        });

        const updatedRoom: RoomState = {
          ...this.currentRoom,
          players,
          lastRoll: roll,
          pendingPoints: 0,
          phase: 'TURN_SKIPPED',
          logs,
        };

        await this.saveRoomState(updatedRoom);

        setTimeout(async () => {
          if (this.destroyed) return;
          if (this.currentRoom && this.currentRoom.phase === 'TURN_SKIPPED' && this.currentRoom.lastRoll === roll) {
            const next = this.advanceTurn(this.currentRoom);
            await this.saveRoomState(next);
          }
        }, 2000);
      } else {
        logs.push({
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          textSo: `🎲 ${bot.name} wuxuu keenay [${roll}]! Wuxuu helay ${pts} dhibcood.`,
          textEn: `🎲 ${bot.name} rolled [${roll}]! Got ${pts} points.`,
          type: 'roll',
        });

        // Simple smart bot allocation
        const roomWithRoll: RoomState = {
          ...this.currentRoom,
          lastRoll: roll,
          pendingPoints: pts,
          phase: 'MANAGING',
          logs,
        };

        const allocation = this.calculateBotAllocation(roomWithRoll, bot, pts);
        const updated = this.applyPointAllocation(roomWithRoll, bot, allocation);
        await this.saveRoomState(updated);
      }
    } else {
      logs.push({
        id: `log-${Date.now()}`,
        timestamp: Date.now(),
        textSo: `🎲 ${bot.name} wuxuu keenay [${roll}] (Eber).`,
        textEn: `🎲 ${bot.name} rolled [${roll}] (0 points).`,
        type: 'roll',
      });

      const updatedRoom: RoomState = {
        ...this.currentRoom,
        lastRoll: roll,
        pendingPoints: 0,
        phase: 'TURN_SKIPPED',
        logs,
      };

      await this.saveRoomState(updatedRoom);

      setTimeout(async () => {
        if (this.destroyed) return;
        if (this.currentRoom && this.currentRoom.phase === 'TURN_SKIPPED' && this.currentRoom.lastRoll === roll) {
          const next = this.advanceTurn(this.currentRoom);
          await this.saveRoomState(next);
        }
      }, 2000);
    }
  }

  private calculateBotAllocation(
    room: RoomState,
    bot: Player,
    points: number
  ): PointAllocation {
    let remaining = points;
    const allocation: PointAllocation = {
      selfPoints: 0,
      deductions: [],
      locks: [],
      unlocks: [],
    };

    // 1. Lock opponents with 0 points
    const lockable = room.players.filter(
      (p) => p.id !== bot.id && !p.isLocked && p.score === 0
    );
    for (const target of lockable) {
      if (remaining <= 0) break;
      const lockCost = Math.min(remaining, 3);
      if (lockCost >= 1) {
        allocation.locks.push({ targetId: target.id, lockPoints: lockCost });
        remaining -= lockCost;
      }
    }

    // 2. Deduct points from leaders
    const opponentsWithPoints = room.players
      .filter((p) => p.id !== bot.id && !p.isLocked && p.score > 0)
      .sort((a, b) => b.score - a.score);

    for (const opp of opponentsWithPoints) {
      if (remaining <= 0) break;
      const deductAmt = Math.min(opp.score, remaining);
      if (deductAmt > 0) {
        allocation.deductions.push({ targetId: opp.id, amount: deductAmt });
        remaining -= deductAmt;
      }
    }

    // 3. Keep remaining for self (max 30)
    const neededTo30 = Math.max(0, 30 - bot.score);
    allocation.selfPoints = Math.min(remaining, neededTo30);
    remaining -= allocation.selfPoints;

    // 4. If bot still has points, increase lock burden on locked opponents (up to 5 max)
    if (remaining > 0) {
      allocation.lockAdjustments = [];
      const lockedOpponents = room.players.filter((p) => p.id !== bot.id && p.isLocked && p.lockPoints < 5);
      for (const lockedOpp of lockedOpponents) {
        if (remaining <= 0) break;
        const addBurden = Math.min(remaining, 5 - lockedOpp.lockPoints);
        if (addBurden > 0) {
          allocation.lockAdjustments.push({ targetId: lockedOpp.id, delta: addBurden });
          remaining -= addBurden;
        }
      }
    }

    return allocation;
  }

  public async sendChat(message: string) {
    if (!this.currentRoom) return;
    const clean = message.trim();
    if (!clean) return;

    const sender = this.currentRoom.players.find((p) => p.id === this.myPlayerId);
    const updatedRoom: RoomState = {
      ...this.currentRoom,
      logs: [
        ...this.currentRoom.logs,
        {
          id: `chat-${Date.now()}`,
          timestamp: Date.now(),
          textSo: `💬 ${sender ? sender.name : 'Ciyaaryahan'}: ${clean}`,
          textEn: `💬 ${sender ? sender.name : 'Player'}: ${clean}`,
          type: 'chat',
        },
      ],
    };

    await this.saveRoomState(updatedRoom);
  }

  public async restartGame() {
    if (!this.currentRoom) return;
    const room: RoomState = {
      ...this.currentRoom,
      phase: 'LOBBY',
      winnerId: null,
      lastRoll: null,
      pendingPoints: 0,
      currentTurnIndex: 0,
      players: this.currentRoom.players.map((p) => ({
        ...p,
        score: 0,
        isLocked: false,
        lockPoints: 0,
      })),
      logs: [
        ...this.currentRoom.logs,
        {
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          textSo: '🔄 Ciyaarta dib baa loo bilaabay.',
          textEn: '🔄 Game reset to lobby.',
          type: 'chat',
        },
      ],
    };

    await this.saveRoomState(room);
  }

  public destroy() {
    this.destroyed = true;
    clearTimeout(this.botTimer);
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}

/**
 * Creates a brand new room in Firestore and starts syncing.
 */
export async function createFirestoreRoom(
  hostName: string,
  hostAvatar: string,
  maxPlayers: number = 20,
  listener: RoomSyncListener
): Promise<{ session: FirebaseRoomSync; roomCode: string; hostId: string }> {
  const roomCode = generateRoomCode();
  const hostId = `player-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const hostPlayer: Player = {
    id: hostId,
    name: hostName.trim() || 'Ciyaaryahan 1',
    avatar: hostAvatar || '🎲',
    color: PLAYER_COLORS[0],
    score: 0,
    isLocked: false,
    lockPoints: 0,
    isHost: true,
    isAi: false,
    connected: true,
  };

  const initialPayload = {
    roomId: roomCode,
    hostId: hostId,
    hostName: hostPlayer.name,
    status: 'waiting',
    phase: 'LOBBY',
    players: [hostPlayer],
    currentTurnIndex: 0,
    lastRoll: null,
    pendingPoints: 0,
    winnerId: null,
    maxPlayers,
    logs: [
      {
        id: `log-${Date.now()}`,
        timestamp: Date.now(),
        textSo: `👑 ${hostPlayer.name} ayaa qolka abuuray.`,
        textEn: `👑 ${hostPlayer.name} created the room.`,
        type: 'chat',
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const roomRef = doc(db, 'rooms', roomCode);
  try {
    await setDoc(roomRef, initialPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `rooms/${roomCode}`);
  }

  const session = new FirebaseRoomSync(roomCode, hostId, true, listener);
  return { session, roomCode, hostId };
}

/**
 * Joins an existing room in Firestore and starts syncing.
 */
export async function joinFirestoreRoom(
  roomCode: string,
  playerName: string,
  playerAvatar: string,
  listener: RoomSyncListener
): Promise<{ session: FirebaseRoomSync; playerId: string }> {
  const cleanCode = roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleanCode) {
    throw new Error('Fadlan geli furaha qolka ama link-ga casuumaadda.');
  }

  const roomRef = doc(db, 'rooms', cleanCode);
  let snapshot;
  try {
    snapshot = await getDoc(roomRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `rooms/${cleanCode}`);
  }

  if (!snapshot || !snapshot.exists()) {
    throw new Error(`Qolka lambarkiisu yahay "${cleanCode}" lama helin. Hubi furiha ama link-ga qofka kuu soo diray.`);
  }

  const data = snapshot.data();
  const existingPlayers: Player[] = data.players || [];

  // Check if player is already in room by name or generated session
  let playerId = `player-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const existingPlayer = existingPlayers.find(
    (p) => p.name.toLowerCase() === playerName.trim().toLowerCase()
  );

  let updatedPlayers: Player[];
  const newLogs = [...(data.logs || [])];

  if (existingPlayer) {
    // Reconnection
    playerId = existingPlayer.id;
    updatedPlayers = existingPlayers.map((p) =>
      p.id === existingPlayer.id ? { ...p, connected: true, avatar: playerAvatar } : p
    );
  } else {
    // New player joining
    if (existingPlayers.length >= (data.maxPlayers || 20)) {
      throw new Error('Qolkaan wuu buuxaa (ugu badnaan 20 ciyaartooy).');
    }

    const colorIdx = existingPlayers.length % PLAYER_COLORS.length;
    const newPlayer: Player = {
      id: playerId,
      name: playerName.trim() || `Ciyaaryahan ${existingPlayers.length + 1}`,
      avatar: playerAvatar || '🎲',
      color: PLAYER_COLORS[colorIdx],
      score: 0,
      isLocked: false,
      lockPoints: 0,
      isHost: false,
      isAi: false,
      connected: true,
    };

    updatedPlayers = [...existingPlayers, newPlayer];
    newLogs.push({
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      textSo: `👋 ${newPlayer.name} ayaa toos ugu soo biiray qolka!`,
      textEn: `👋 ${newPlayer.name} joined the room!`,
      type: 'chat',
    });
  }

  try {
    await updateDoc(roomRef, {
      players: updatedPlayers,
      logs: newLogs.slice(-50),
      updatedAt: Date.now(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${cleanCode}`);
  }

  const session = new FirebaseRoomSync(cleanCode, playerId, false, listener);
  return { session, playerId };
}
