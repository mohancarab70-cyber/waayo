import mqtt, { type MqttClient } from 'mqtt';
import type { RoomState, PointAllocation, Player } from '../types/game.js';
import { LocalGameEngine, generateRoomCode, PLAYER_COLORS } from './localGameEngine.js';

const BROKER_SERVERS = [
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://broker.emqx.io:8084/mqtt',
];

export interface CloudClientHandlers {
  onRoomUpdate: (room: RoomState, event?: any) => void;
  onError: (msg: string) => void;
  onConnected?: () => void;
}

export class CloudRoomHost {
  private client: MqttClient | null = null;
  public engine: LocalGameEngine;
  public roomCode: string;
  private stateTopic: string;
  private actionTopic: string;
  private destroyed: boolean = false;

  constructor(
    hostName: string,
    hostAvatar: string,
    maxPlayers: number = 20,
    onUpdate: (room: RoomState, event?: any) => void,
    onError: (err: string) => void,
    onReady: (code: string) => void
  ) {
    this.roomCode = generateRoomCode();
    this.stateTopic = `taraq/v1/rooms/${this.roomCode}/state`;
    this.actionTopic = `taraq/v1/rooms/${this.roomCode}/actions`;

    this.engine = new LocalGameEngine(hostName, hostAvatar, maxPlayers);

    // Subscribe to engine changes to broadcast to subscribers
    this.engine.subscribe((room, event) => {
      onUpdate(room, event);
      this.publishState(room, event);
    });

    this.connectBroker(0, onReady, onError);
  }

  private connectBroker(brokerIndex: number, onReady: (code: string) => void, onError: (err: string) => void) {
    if (this.destroyed) return;
    const brokerUrl = BROKER_SERVERS[brokerIndex % BROKER_SERVERS.length];
    const clientId = `taraq_host_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    try {
      this.client = mqtt.connect(brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 2000,
        keepalive: 30,
      });

      this.client.on('connect', () => {
        if (this.destroyed || !this.client) return;

        this.client.subscribe(this.actionTopic, { qos: 1 }, (err) => {
          if (err) {
            console.error('Failed to subscribe to action topic', err);
          }
        });

        // Publish initial room state with retain: true so any client immediately gets it
        this.publishState(this.engine.getRoom());
        onReady(this.roomCode);
      });

      this.client.on('message', (topic, payload) => {
        if (topic === this.actionTopic) {
          try {
            const data = JSON.parse(payload.toString());
            this.handleClientAction(data);
          } catch (e) {
            console.error('Failed to parse client action', e);
          }
        }
      });

      this.client.on('error', (err) => {
        console.warn(`Host broker error (${brokerUrl}):`, err);
        // Try fallback broker if not connected
        if (brokerIndex + 1 < BROKER_SERVERS.length) {
          this.client?.end(true);
          this.connectBroker(brokerIndex + 1, onReady, onError);
        } else {
          onError('Khalad ayaa ku yimid shabakadda qolalka.');
        }
      });
    } catch (e: any) {
      console.error('MQTT connect error', e);
      onError('Lama xiriiri karin server-ka qolalka.');
    }
  }

  private publishState(room: RoomState, event?: any) {
    if (!this.client || !this.client.connected) return;
    try {
      const payload = JSON.stringify({ room, event: event || null });
      this.client.publish(this.stateTopic, payload, { retain: true, qos: 1 });
    } catch (e) {
      console.error('Failed to publish state', e);
    }
  }

  private handleClientAction(action: any) {
    const room = this.engine.getRoom();

    switch (action.type) {
      case 'JOIN_ROOM': {
        const playerId = action.playerId;
        const name = (action.playerName || 'Ciyaaryahan').trim().slice(0, 18);
        const avatar = action.avatar || '🎲';

        // Check if player already in room (reconnect)
        const existing = room.players.find((p) => p.id === playerId);
        if (existing) {
          existing.connected = true;
          this.publishState(this.engine.getRoom());
          return;
        }

        if (room.players.length >= room.settings.maxPlayers) {
          return;
        }

        const colorIndex = room.players.length % PLAYER_COLORS.length;
        const newPlayer: Player = {
          id: playerId,
          name,
          avatar,
          color: PLAYER_COLORS[colorIndex],
          score: 0,
          isLocked: false,
          lockPoints: 0,
          isHost: false,
          isAi: false,
          connected: true,
        };

        const liveEngine = this.engine as any;
        liveEngine.room.players.push(newPlayer);
        liveEngine.addLog(
          `👋 ${name} ayaa ku soo biiray qolka.`,
          `👋 ${name} joined the room.`,
          'chat'
        );
        liveEngine.notify();
        break;
      }

      case 'START_GAME': {
        this.engine.startGame();
        break;
      }

      case 'ADD_BOT': {
        this.engine.addBot(action.count || 1);
        break;
      }

      case 'REMOVE_PLAYER': {
        this.engine.removePlayer(action.playerId);
        break;
      }

      case 'ROLL_DICE': {
        this.engine.rollDice(action.playerId);
        break;
      }

      case 'SUBMIT_ACTIONS': {
        this.engine.submitActions(action.playerId, action.allocation);
        break;
      }

      case 'RESTART_GAME': {
        this.engine.restartGame();
        break;
      }

      case 'SEND_CHAT': {
        this.engine.sendChat(action.playerId, action.message);
        break;
      }
    }
  }

  public destroy() {
    this.destroyed = true;
    if (this.client) {
      // Clear retained state so room doesn't linger forever
      try {
        if (this.client.connected) {
          this.client.publish(this.stateTopic, '', { retain: true, qos: 1 });
        }
      } catch {}
      this.client.end(true);
      this.client = null;
    }
    this.engine.destroy();
  }
}

export class CloudRoomClient {
  private client: MqttClient | null = null;
  public myPlayerId: string;
  public roomCode: string;
  private stateTopic: string;
  private actionTopic: string;
  private joined: boolean = false;
  private destroyed: boolean = false;
  private joinTimeout: any = null;

  constructor(
    roomCode: string,
    playerName: string,
    avatar: string,
    handlers: CloudClientHandlers
  ) {
    this.roomCode = roomCode.trim().toUpperCase();
    this.stateTopic = `taraq/v1/rooms/${this.roomCode}/state`;
    this.actionTopic = `taraq/v1/rooms/${this.roomCode}/actions`;
    this.myPlayerId = `player-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Set 6-second timeout: if no room state received, room does not exist
    this.joinTimeout = setTimeout(() => {
      if (!this.joined && !this.destroyed) {
        handlers.onError(`Koodhka qolka lama helin ama qolku ma jiro (${this.roomCode})`);
      }
    }, 6000);

    this.connectBroker(0, playerName, avatar, handlers);
  }

  private connectBroker(
    brokerIndex: number,
    playerName: string,
    avatar: string,
    handlers: CloudClientHandlers
  ) {
    if (this.destroyed) return;
    const brokerUrl = BROKER_SERVERS[brokerIndex % BROKER_SERVERS.length];
    const clientId = `taraq_client_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    try {
      this.client = mqtt.connect(brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 2000,
        keepalive: 30,
      });

      this.client.on('connect', () => {
        if (this.destroyed || !this.client) return;

        // Subscribe to room state topic
        this.client.subscribe(this.stateTopic, { qos: 1 });
      });

      this.client.on('message', (topic, payload) => {
        if (topic === this.stateTopic) {
          const raw = payload.toString().trim();
          if (!raw) {
            // Room empty or closed
            return;
          }

          try {
            const data = JSON.parse(raw);
            if (data && data.room) {
              if (!this.joined) {
                this.joined = true;
                if (this.joinTimeout) {
                  clearTimeout(this.joinTimeout);
                  this.joinTimeout = null;
                }
                handlers.onConnected?.();

                // Send JOIN_ROOM action to host
                this.sendAction({
                  type: 'JOIN_ROOM',
                  playerName,
                  avatar,
                });
              }

              handlers.onRoomUpdate(data.room, data.event);
            }
          } catch (e) {
            console.error('Failed to parse room state', e);
          }
        }
      });

      this.client.on('error', (err) => {
        console.warn(`Client broker error (${brokerUrl}):`, err);
        if (!this.joined && brokerIndex + 1 < BROKER_SERVERS.length) {
          this.client?.end(true);
          this.connectBroker(brokerIndex + 1, playerName, avatar, handlers);
        } else if (!this.joined) {
          handlers.onError('Lama xiriiri karin server-ka qolka.');
        }
      });
    } catch (e: any) {
      console.error('MQTT client connect error', e);
      handlers.onError('Lama xiriiri karin shabakadda.');
    }
  }

  public sendAction(action: any) {
    if (!this.client || !this.client.connected) return;
    try {
      const payload = JSON.stringify({
        ...action,
        playerId: this.myPlayerId,
      });
      this.client.publish(this.actionTopic, payload, { qos: 1 });
    } catch (e) {
      console.error('Failed to send action', e);
    }
  }

  public destroy() {
    this.destroyed = true;
    if (this.joinTimeout) {
      clearTimeout(this.joinTimeout);
      this.joinTimeout = null;
    }
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
  }
}
