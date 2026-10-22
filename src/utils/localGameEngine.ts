import type { RoomState, Player, DiceValue, PointAllocation, GameLog } from '../types/game.js';

export const PLAYER_COLORS = [
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

export const BOT_NAMES = [
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

const BOT_AVATARS = ['👨', '👩', '🎲'];

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export type RoomUpdateListener = (room: RoomState, event?: any) => void;

export class LocalGameEngine {
  private room: RoomState;
  private listeners: Set<RoomUpdateListener> = new Set();
  private timer: any = null;
  private destroyed: boolean = false;

  constructor(hostName: string, hostAvatar: string, maxPlayers: number = 20) {
    const roomCode = generateRoomCode();
    const hostId = `player-host-${Date.now()}`;
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

    this.room = {
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
        maxScoreCap: 10,
        maxPlayers,
        turnTimeLimit: 45,
      },
      logs: [],
      winnerId: null,
    };

    this.addLog(
      `🌟 Qolka Taraq [${roomCode}] waa la abuuray (Gudaha / Local Offline).`,
      `🌟 Taraq Room [${roomCode}] created (Local Offline).`,
      'chat'
    );
  }

  public getRoom(): RoomState {
    return JSON.parse(JSON.stringify(this.room));
  }

  public getHostId(): string {
    return this.room.hostId;
  }

  public subscribe(fn: RoomUpdateListener): () => void {
    this.listeners.add(fn);
    fn(this.getRoom());
    return () => this.listeners.delete(fn);
  }

  private notify(event?: any) {
    if (this.destroyed) return;
    const snap = this.getRoom();
    this.listeners.forEach((fn) => {
      try {
        fn(snap, event);
      } catch (e) {
        console.error('Error notifying room listener', e);
      }
    });
  }

  private addLog(textSo: string, textEn: string, type: GameLog['type']) {
    const log: GameLog = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      textSo,
      textEn,
      type,
    };
    this.room.logs.unshift(log);
    if (this.room.logs.length > 80) {
      this.room.logs.pop();
    }
  }

  public addBot(count: number = 1) {
    if (this.room.phase !== 'LOBBY') return;
    const addedCount = Math.max(1, Math.min(count, 5));

    for (let c = 0; c < addedCount; c++) {
      if (this.room.players.length >= this.room.settings.maxPlayers) break;

      const botIdx = this.room.players.length;
      const botName = BOT_NAMES[botIdx % BOT_NAMES.length];
      const botAvatar = BOT_AVATARS[botIdx % BOT_AVATARS.length];
      const botColor = PLAYER_COLORS[botIdx % PLAYER_COLORS.length];

      const botPlayer: Player = {
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

      this.room.players.push(botPlayer);
      this.addLog(
        `🤖 ${botName} ayaa ku soo biiray qolka.`,
        `🤖 ${botName} joined the room.`,
        'chat'
      );
    }

    this.notify();
  }

  public removePlayer(playerId: string) {
    if (this.room.phase !== 'LOBBY') return;
    const idx = this.room.players.findIndex((p) => p.id === playerId);
    if (idx !== -1 && !this.room.players[idx].isHost) {
      const removed = this.room.players.splice(idx, 1)[0];
      this.addLog(
        `👋 ${removed.name} waa laga saaray qolka.`,
        `👋 ${removed.name} was removed from room.`,
        'chat'
      );
      this.notify();
    }
  }

  public startGame() {
    if (this.room.players.length < 2) {
      throw new Error('Ugu yaraan 2 ciyaartooy ayaa loo baahan yahay si loo bilaabo ciyaarta.');
    }

    this.room.phase = 'ROLLING';
    this.room.currentTurnIndex = 0;
    this.room.winnerId = null;
    this.room.lastRoll = null;
    this.room.pendingPoints = 0;
    this.room.turnStartTime = Date.now();

    for (const p of this.room.players) {
      p.score = 0;
      p.isLocked = false;
      p.lockPoints = 0;
    }

    this.addLog(
      `🏁 Ciyaartii waa bilaabatay! Qof kasta wuxuu bilaabayaa 0 dhibcood.`,
      `🏁 The game has begun! Everyone starts with 0 points.`,
      'roll'
    );

    this.notify();
    this.checkCurrentTurn();
  }

  public rollDice(playerId: string) {
    if (this.room.phase !== 'ROLLING') return;
    const current = this.room.players[this.room.currentTurnIndex];
    if (!current || current.id !== playerId) return;

    const roll = (Math.floor(Math.random() * 6) + 1) as DiceValue;
    this.room.lastRoll = roll;

    if (roll === 5) {
      this.room.pendingPoints = 5;
      this.room.phase = 'MANAGING';
      this.addLog(
        `🎲 ${current.name} wuxuu keenay [5]! Wuxuu helay 5 dhibcood oo uu maamuli karo.`,
        `🎲 ${current.name} rolled [5]! Has 5 points to allocate.`,
        'roll'
      );
      this.notify({ type: 'DICE_ROLLED', value: roll, points: 5 });
    } else if (roll === 6) {
      this.room.pendingPoints = 10;
      this.room.phase = 'MANAGING';
      this.addLog(
        `🎯 ${current.name} wuxuu keenay [6]! Wuxuu helay 10 dhibcood oo uu maamuli karo!`,
        `🎯 ${current.name} rolled [6]! Has 10 points to allocate!`,
        'roll'
      );
      this.notify({ type: 'DICE_ROLLED', value: roll, points: 10 });
    } else {
      this.room.pendingPoints = 0;
      this.room.phase = 'TURN_SKIPPED';
      this.addLog(
        `🎲 ${current.name} wuxuu keenay [${roll}] (Eber). Wareeggu wuu dhaafayaa.`,
        `🎲 ${current.name} rolled [${roll}] (0 points). Turn passes.`,
        'roll'
      );
      this.notify({ type: 'DICE_ROLLED', value: roll, points: 0 });

      this.timer = setTimeout(() => {
        if (!this.destroyed) this.nextTurn();
      }, 2000);
    }
  }

  public submitActions(playerId: string, allocation: PointAllocation) {
    if (this.room.phase !== 'MANAGING') return;
    const current = this.room.players[this.room.currentTurnIndex];
    if (!current || current.id !== playerId) return;

    this.executePlayerActions(current, allocation, this.room.pendingPoints);
  }

  private executePlayerActions(
    player: Player,
    allocation: PointAllocation,
    maxPointsAllowed: number
  ) {
    let totalDeductions = 0;
    for (const d of allocation.deductions || []) {
      if (d.amount > 0) totalDeductions += d.amount;
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
      const target = this.room.players.find((p) => p.id === targetId);
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

    if (totalSpent > maxPointsAllowed) {
      throw new Error(`Kama badsan kartid ${maxPointsAllowed} dhibcood oo aad keentay.`);
    }

    if (player.score + selfPoints > 10) {
      throw new Error('Dhibcahaaga kama badnaan karaan 10 dhibcood (Max score is 10).');
    }

    // 1. Deductions
    for (const d of allocation.deductions || []) {
      if (d.amount <= 0) continue;
      const target = this.room.players.find((p) => p.id === d.targetId);
      if (target) {
        const actualDeduct = Math.min(target.score, d.amount);
        target.score = Math.max(0, target.score - actualDeduct);
        this.addLog(
          `⚔️ ${player.name} wuxuu ka jaray ${actualDeduct} dhibcood ${target.name}! (Dhibcihiisa: ${target.score})`,
          `⚔️ ${player.name} deducted ${actualDeduct} points from ${target.name}! (Score: ${target.score})`,
          'deduct'
        );
      }
    }

    // 2. Locks
    for (const l of allocation.locks || []) {
      const target = this.room.players.find((p) => p.id === l.targetId);
      if (!target) continue;
      if (target.id === player.id) continue;
      if (target.isLocked) continue;
      if (target.score > 0) {
        throw new Error(`Qofka la xirayo waa inuu leeyahay 0 dhibcood! (Dhibcihiisa: ${target.score})`);
      }

      target.isLocked = true;
      target.lockPoints = Math.min(5, Math.max(1, l.lockPoints));

      this.addLog(
        `🔒 ${player.name} wuxuu xabsiga ku xiray ${target.name} isagoo ku xiray [${target.lockPoints} dhibcood]!`,
        `🔒 ${player.name} locked ${target.name} in jail with [${target.lockPoints} lock points]!`,
        'lock'
      );
    }

    // 3. Lock Adjustments (Increase burden or decrease/lighten burden)
    for (const adj of allocation.lockAdjustments || []) {
      if (adj.delta === 0) continue;
      const target = this.room.players.find((p) => p.id === adj.targetId);
      if (!target || !target.isLocked) continue;

      if (adj.delta > 0) {
        const prev = target.lockPoints;
        target.lockPoints = Math.min(5, target.lockPoints + adj.delta);
        const added = target.lockPoints - prev;
        this.addLog(
          `⛓️ ${player.name} wuxuu culeyska ku kordhiyay ${target.name} (+${added}), xabsigiisu waa [${target.lockPoints}/5 dhibcood]!`,
          `⛓️ ${player.name} added burden to ${target.name} (+${added}), jail lock is now [${target.lockPoints}/5 pts]!`,
          'lock'
        );
      } else {
        const reduceAmt = Math.abs(adj.delta);
        target.lockPoints = Math.max(0, target.lockPoints - reduceAmt);
        if (target.lockPoints === 0) {
          target.isLocked = false;
          this.addLog(
            `🗝️ ${player.name} wuxuu xabsiga ka saaray ${target.name} isagoo dhibcihii xabsiga ka dhameeyay!`,
            `🗝️ ${player.name} freed ${target.name} by clearing all jail points!`,
            'unlock'
          );
        } else {
          this.addLog(
            `🗝️ ${player.name} wuxuu xabsiga ka fududeeyay ${target.name} (-${reduceAmt}), waxaa ku haray [${target.lockPoints}/5 dhibcood]!`,
            `🗝️ ${player.name} reduced jail burden for ${target.name} (-${reduceAmt}), [${target.lockPoints}/5 pts] remaining!`,
            'unlock'
          );
        }
      }
    }

    // 4. Legacy Unlocks
    for (const targetId of allocation.unlocks || []) {
      const target = this.room.players.find((p) => p.id === targetId);
      if (target && target.isLocked) {
        target.isLocked = false;
        target.lockPoints = 0;
        this.addLog(
          `🗝️ ${player.name} wuxuu xabsiga ka saaray ${target.name}! Hadda wuu ciyaari karaa.`,
          `🗝️ ${player.name} freed ${target.name} from jail! Now active.`,
          'unlock'
        );
      }
    }

    // 5. Self points
    if (selfPoints > 0) {
      player.score = Math.min(10, player.score + selfPoints);
      this.addLog(
        `⭐ ${player.name} wuxuu helay +${selfPoints} dhibcood! (Wadar: ${player.score}/10)`,
        `⭐ ${player.name} added +${selfPoints} points to self! (Total: ${player.score}/10)`,
        'point'
      );
    }

    // 5. Check victory
    if (this.checkVictoryCondition()) {
      return;
    }

    this.nextTurn();
  }

  private checkVictoryCondition(): boolean {
    const activePlayers = this.room.players.filter((p) => !p.isLocked);

    if (activePlayers.length === 1 && this.room.players.length > 1) {
      const winner = activePlayers[0];
      this.room.phase = 'GAME_OVER';
      this.room.winnerId = winner.id;
      this.addLog(
        `👑 GUUL! Waxaa guuleystay ${winner.name}! Wuxuu ahaa qofka ugu dambeeyay ee xiray ciyaartoyda kale!`,
        `👑 VICTORY! ${winner.name} wins! Last standing player who locked others!`,
        'win'
      );
      this.notify({ type: 'GAME_OVER', winnerId: winner.id });
      return true;
    }
    return false;
  }

  private nextTurn() {
    if (this.destroyed || this.room.phase === 'GAME_OVER') return;

    this.room.pendingPoints = 0;
    this.room.lastRoll = null;
    this.room.currentTurnIndex = (this.room.currentTurnIndex + 1) % this.room.players.length;
    this.room.turnStartTime = Date.now();

    this.checkCurrentTurn();
  }

  private checkCurrentTurn() {
    if (this.destroyed || this.room.phase === 'GAME_OVER') return;

    const currentPlayer = this.room.players[this.room.currentTurnIndex];
    if (!currentPlayer) return;

    // Check if player is locked in jail
    if (currentPlayer.isLocked) {
      this.room.phase = 'TURN_SKIPPED';
      this.addLog(
        `🔒 Wareegga ${currentPlayer.name}: Wuu xiran yahay (Waxaa lagu xiray ${currentPlayer.lockPoints} dhibcood). Waa la mootiyay!`,
        `🔒 ${currentPlayer.name}'s turn: Locked in jail (${currentPlayer.lockPoints} lock pts). Skipped!`,
        'skip'
      );
      this.notify({ type: 'TURN_SKIPPED', playerId: currentPlayer.id });

      this.timer = setTimeout(() => {
        if (!this.destroyed) this.nextTurn();
      }, 1500);
      return;
    }

    // Player is unlocked and ready to roll
    this.room.phase = 'ROLLING';
    this.notify();

    // If it's an AI bot, take turn automatically
    if (currentPlayer.isAi) {
      this.timer = setTimeout(() => {
        if (!this.destroyed) this.botTakeTurn(currentPlayer);
      }, 1100);
    }
  }

  private botTakeTurn(aiPlayer: Player) {
    if (this.destroyed || this.room.phase !== 'ROLLING') return;
    const current = this.room.players[this.room.currentTurnIndex];
    if (!current || current.id !== aiPlayer.id) return;

    const roll = (Math.floor(Math.random() * 6) + 1) as DiceValue;
    this.room.lastRoll = roll;

    if (roll === 5 || roll === 6) {
      const points = roll === 5 ? 5 : 10;
      this.room.pendingPoints = points;
      this.room.phase = 'MANAGING';
      this.addLog(
        `🎲 ${aiPlayer.name} wuxuu keenay [${roll}]! Wuxuu helay ${points} dhibcood.`,
        `🎲 ${aiPlayer.name} rolled [${roll}]! Got ${points} points.`,
        'roll'
      );
      this.notify({ type: 'DICE_ROLLED', value: roll, points });

      this.timer = setTimeout(() => {
        if (!this.destroyed) this.executeBotDecisions(aiPlayer, points);
      }, 1200);
    } else {
      this.room.pendingPoints = 0;
      this.room.phase = 'TURN_SKIPPED';
      this.addLog(
        `🎲 ${aiPlayer.name} wuxuu keenay [${roll}] (Eber). Wareeggu wuu dhaafayaa.`,
        `🎲 ${aiPlayer.name} rolled [${roll}] (0 points). Turn passes.`,
        'roll'
      );
      this.notify({ type: 'DICE_ROLLED', value: roll, points: 0 });

      this.timer = setTimeout(() => {
        if (!this.destroyed) this.nextTurn();
      }, 2000);
    }
  }

  private executeBotDecisions(ai: Player, availablePoints: number) {
    if (this.destroyed || this.room.phase !== 'MANAGING') return;

    let remaining = availablePoints;
    let selfPoints = 0;
    const deductions: { targetId: string; amount: number }[] = [];
    const locks: { targetId: string; lockPoints: number }[] = [];
    const unlocks: string[] = [];

    const opponents = this.room.players.filter((p) => p.id !== ai.id);

    // 1. Check if any unlocked opponent is at 0 points -> lock them!
    for (const opp of opponents) {
      if (opp.score === 0 && !opp.isLocked && remaining >= 1) {
        const lockPts = Math.min(remaining, 5);
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

    // 3. Put remaining points into self points up to max 10
    const roomForSelf = Math.max(0, 10 - ai.score);
    selfPoints = Math.min(roomForSelf, remaining);
    remaining -= selfPoints;

    this.executePlayerActions(
      ai,
      { selfPoints, deductions, locks, unlocks },
      availablePoints
    );
  }

  public restartGame() {
    this.startGame();
  }

  public sendChat(senderId: string, message: string) {
    const sender = this.room.players.find((p) => p.id === senderId);
    if (!sender) return;

    const trimmed = message.trim().slice(0, 120);
    if (!trimmed) return;

    this.addLog(
      `💬 ${sender.name}: "${trimmed}"`,
      `💬 ${sender.name}: "${trimmed}"`,
      'chat'
    );
    this.notify();
  }

  public destroy() {
    this.destroyed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.listeners.clear();
  }
}
