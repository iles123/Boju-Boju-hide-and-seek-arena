export type Team = "seeker" | "hider" | "spectator";

export type RoundPhase = "lobby" | "hiding" | "seeking" | "ended";

export const GAME_CONSTANTS = {
  roomCapacity: 20,
  tickRateHz: 20,
  snapshotRateHz: 15,
  hidingPhaseSeconds: 45,
  seekingPhaseSeconds: 300,
} as const;

export const NOISE_CONFIG = {
  levels: {
    silent: 0,
    walking: 1,
    running: 2,
    changingProp: 3,
    speakingLow: 1,
    speakingMedium: 2,
    speakingHigh: 3,
  },
  pingThreshold: 2,
  pingCooldownSeconds: 4,
  pingRadiusMeters: { min: 8, max: 15 },
  seekerAudioCueRangeMeters: 25,
  maxPingFrequencyHz: 0.25,
  pingFadeSeconds: 3,
} as const;

export type NoiseSource = keyof typeof NOISE_CONFIG.levels;

export interface WsEnvelope<TType extends string = string, TPayload = unknown> {
  type: TType;
  roomId?: string;
  payload?: TPayload;
  ts?: number;
}

export const MESSAGE_TYPES = {
  CLIENT_HELLO: "client.hello",
  CLIENT_INPUT: "client.input",
  SERVER_WELCOME: "server.welcome",
  SERVER_SNAPSHOT: "server.snapshot",
  SERVER_NOISE_PING: "server.noise_ping",
  // Phase 2 room/lobby
  ROOM_READY: "room.ready",
  ROOM_START: "room.start",
  ROOM_LEAVE: "room.leave",
  ROOM_STATE: "room.state",
  // Phase 4+ gameplay/rounds
  ROUND_PHASE: "round.phase",
  ROUND_ENDED: "round.ended",
  PLAYER_STATE: "player.state",
  PLAYER_SNAPSHOT: "player.snapshot",
  PLAYER_TAG: "player.tag",
  PLAYER_ELIMINATED: "player.eliminated",
  PLAYER_SHOOT: "player.shoot",
  PLAYER_RELOAD: "player.reload",
  PLAYER_SPOT: "player.spot",
  GUN_FIRED: "gun.fired",
  GUN_STATE: "gun.state",
  SCORE_UPDATE: "score.update",
  HIDER_SHIMMER: "hider.shimmer",
  PAINT_UPLOAD: "paint.upload",
  PAINT_APPLIED: "paint.applied",
  ERROR: "error",
  PONG: "pong",
} as const;

export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];
