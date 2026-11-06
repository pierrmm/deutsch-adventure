import { schema, t, type SchemaType } from "@colyseus/schema";

/**
 * One input frame, consumed by `Room.defineInput()`. Flat primitives only, and
 * deliberately minimal:
 *   - no `seq`  — the engine's input counter is the sequence
 *   - no `dt`   — fixed timestep: one input advances exactly one step
 *   - no time   — the SDK stamps lag-comp timing on the wire envelope
 *
 * `int8<-1 | 0 | 1>` narrows the type for your code; the room's `sanitize`
 * clamp is what actually enforces it against a modified client.
 */
export const MoveInput = schema({
  moveX: t.int8<-1 | 0 | 1>(),
  moveY: t.int8<-1 | 0 | 1>(),
});
export type MoveInput = SchemaType<typeof MoveInput>;

export const Player = schema({
  name: t.string(),
  character: t.string(),
  x: t.number(),
  y: t.number(),
  vx: t.number(),
  vy: t.number(),
  direction: t.int8(),
  animation: t.string(),
  coins: t.uint16(),
  lives: t.uint8(),
  score: t.uint32(),
  quizId: t.string(),
});

export const GameRoomState = schema({
  players: t.map(Player),
  hostId: t.string(),
  status: t.string(),
  activeQuizId: t.string(),
  remainingSeconds: t.uint16(),
  category: t.string(),
  roomCode: t.string(),
});
export type GameRoomState = SchemaType<typeof GameRoomState>;
export type Player = SchemaType<typeof Player>;

export const MyRoomState = schema({

  players: t.map(Player),

});
export type MyRoomState = SchemaType<typeof MyRoomState>;
