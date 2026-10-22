import { Peer, DataConnection } from 'peerjs';
import type { RoomState, PointAllocation } from '../types/game.js';
import { LocalGameEngine, generateRoomCode } from './localGameEngine.js';

export interface P2PClientHandler {
  onRoomUpdate: (room: RoomState, event?: any) => void;
  onError: (msg: string) => void;
  onConnected?: () => void;
}

export class P2PHostManager {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  public engine: LocalGameEngine;
  public roomCode: string;

  constructor(
    hostName: string,
    hostAvatar: string,
    maxPlayers: number = 20,
    onUpdate: (room: RoomState, event?: any) => void,
    onError: (err: string) => void,
    onReady: (code: string) => void
  ) {
    this.roomCode = generateRoomCode();
    this.engine = new LocalGameEngine(hostName, hostAvatar, maxPlayers);

    // Subscribe engine updates to broadcast to all peer connections and local host
    this.engine.subscribe((room, event) => {
      onUpdate(room, event);
      this.broadcast({
        type: 'ROOM_UPDATE',
        room,
        event,
      });
    });

    const peerId = `taraq-room-${this.roomCode.toLowerCase()}`;
    try {
      this.peer = new Peer(peerId, {
        debug: 1,
      });

      this.peer.on('open', (id) => {
        onReady(this.roomCode);
      });

      this.peer.on('connection', (conn) => {
        this.setupConnection(conn);
      });

      this.peer.on('error', (err: any) => {
        console.warn('P2P Host error:', err);
        if (err.type === 'unavailable-id') {
          // Retry with new code if collision
          this.roomCode = generateRoomCode();
          onReady(this.roomCode);
        } else {
          onError(`P2P Network: ${err.message || 'Khalad ayaa dhacay'}`);
        }
      });
    } catch (err: any) {
      console.error('Failed to init PeerJS host', err);
      onError('Lama bilaabi karin Shabakadda P2P');
    }
  }

  private setupConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
    });

    conn.on('data', (data: any) => {
      try {
        this.handlePeerMessage(conn, data);
      } catch (err: any) {
        conn.send({ type: 'ERROR', message: err.message || 'Khalad ayaa dhacay' });
      }
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
    });

    conn.on('error', (err) => {
      console.warn('Peer conn error:', err);
      this.connections.delete(conn.peer);
    });
  }

  private handlePeerMessage(conn: DataConnection, msg: any) {
    const room = this.engine.getRoom();

    switch (msg.type) {
      case 'JOIN_ROOM': {
        const playerId = `player-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        // Check if player name exists
        const name = (msg.playerName || 'Ciyaaryahan').trim().slice(0, 18);
        const avatar = msg.avatar || '🎲';

        if (room.players.length >= room.settings.maxPlayers) {
          conn.send({ type: 'ERROR', message: 'Qolka wuu buuxsamaa (Max players reached).' });
          return;
        }

        // Add player to engine
        const playerObj = {
          id: playerId,
          name,
          avatar,
          color: '#2563EB',
          score: 0,
          isLocked: false,
          lockPoints: 0,
          isHost: false,
          isAi: false,
          connected: true,
        };

        (this.engine as any).room.players.push(playerObj);
        (this.engine as any).addLog(
          `👋 ${name} ayaa ku soo biiray qolka.`,
          `👋 ${name} joined the room.`,
          'chat'
        );
        (this.engine as any).notify();

        conn.send({
          type: 'ROOM_JOINED',
          room: this.engine.getRoom(),
          yourPlayerId: playerId,
        });
        break;
      }

      case 'ROLL_DICE': {
        this.engine.rollDice(msg.playerId);
        break;
      }

      case 'SUBMIT_ACTIONS': {
        this.engine.submitActions(msg.playerId, msg.allocation);
        break;
      }

      case 'SEND_CHAT': {
        this.engine.sendChat(msg.playerId, msg.message);
        break;
      }
    }
  }

  private broadcast(data: any) {
    const payload = data;
    this.connections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(payload);
        } catch (e) {
          console.error('Failed to send to peer', e);
        }
      }
    });
  }

  public destroy() {
    this.engine.destroy();
    this.connections.forEach((c) => c.close());
    this.connections.clear();
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}

export class P2PClientManager {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  public myPlayerId: string = '';

  constructor(
    roomCode: string,
    playerName: string,
    avatar: string,
    handlers: P2PClientHandler
  ) {
    const hostPeerId = `taraq-room-${roomCode.trim().toLowerCase()}`;

    try {
      this.peer = new Peer({ debug: 1 });

      this.peer.on('open', () => {
        if (!this.peer) return;
        const connection = this.peer.connect(hostPeerId, { reliable: true });
        this.conn = connection;

        connection.on('open', () => {
          handlers.onConnected?.();
          connection.send({
            type: 'JOIN_ROOM',
            playerName,
            avatar,
          });
        });

        connection.on('data', (data: any) => {
          if (data.type === 'ROOM_JOINED') {
            this.myPlayerId = data.yourPlayerId;
            handlers.onRoomUpdate(data.room);
          } else if (data.type === 'ROOM_UPDATE') {
            handlers.onRoomUpdate(data.room, data.event);
          } else if (data.type === 'ERROR') {
            handlers.onError(data.message || 'Khalad ayaa dhacay');
          }
        });

        connection.on('close', () => {
          handlers.onError('Xidhiidhkii qolka wuu go’ay (Host disconnected)');
        });

        connection.on('error', (err) => {
          handlers.onError('Lama xiriiri karin qolka (Room not found)');
        });
      });

      this.peer.on('error', (err: any) => {
        handlers.onError(`Koodhka qolka lama helin ama qolku ma jiro (${roomCode})`);
      });
    } catch (e: any) {
      handlers.onError('Lama xiriiri karin Shabakadda P2P');
    }
  }

  public send(msg: any) {
    if (this.conn && this.conn.open) {
      this.conn.send({ ...msg, playerId: this.myPlayerId });
    }
  }

  public destroy() {
    if (this.conn) {
      this.conn.close();
      this.conn = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}
