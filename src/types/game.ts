export type DiceValue = 1 | 2 | 3 | 4 | 5 | 6;

export interface Player {
  id: string;
  name: string;
  avatar: string;
  color: string;
  score: number; // Max 10 points
  isLocked: boolean;
  lockPoints: number; // 0 if not locked, 1-5 when locked
  isHost: boolean;
  isAi: boolean;
  connected: boolean;
}

export type GamePhase = 'LOBBY' | 'ROLLING' | 'MANAGING' | 'TURN_SKIPPED' | 'GAME_OVER';

export interface GameLog {
  id: string;
  timestamp: number;
  textSo: string;
  textEn: string;
  type: 'roll' | 'point' | 'deduct' | 'lock' | 'unlock' | 'skip' | 'win' | 'chat';
}

export interface RoomSettings {
  maxScoreCap: number; // strictly 10 points max per player
  maxPlayers: number; // 2 - 6
  turnTimeLimit: number; // seconds
}

export interface RoomState {
  id: string;
  roomCode: string;
  hostId: string;
  players: Player[];
  currentTurnIndex: number;
  phase: GamePhase;
  lastRoll: DiceValue | null;
  pendingPoints: number; // 5 or 10 when roll is 5 or 6
  turnStartTime: number;
  settings: RoomSettings;
  logs: GameLog[];
  winnerId: string | null;
}

export interface PointAllocation {
  selfPoints: number;
  deductions: { targetId: string; amount: number }[];
  locks: { targetId: string; lockPoints: number }[]; // Target must have effective score == 0, lockPoints 1..5
  unlocks: string[]; // IDs of locked players to free by paying their lockPoints
}
