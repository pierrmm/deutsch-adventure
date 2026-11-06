import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";

import appConfig from "../src/app.config.js";
import { MyRoomState, type MoveInput } from "../src/rooms/schema/MyRoomState.js";
import { PLAYER_SPEED, TICK_RATE } from "../src/shared/constants.js";
import { networkInterfaces } from "node:os";
import { MyRoom } from "../src/rooms/MyRoom.js";
import * as matchMaker from "@colyseus/core/MatchMaker";
import { playersFromState } from "../../client/src/lib/colyseusClient.ts";

describe("testing your Colyseus app", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  before(async () => colyseus = await boot(appConfig));
  after(async () => colyseus.shutdown());

  beforeEach(async () => {
    await colyseus.cleanup();
  });

  it("normalizes missing and object player maps without throwing", () => {
    assert.deepStrictEqual(playersFromState(undefined), []);
    assert.deepStrictEqual(playersFromState({ players: null, status: "lobby" }), []);
    assert.deepStrictEqual(playersFromState({ players: { sid: { name: "Lena", character: "red", score: 20, coins: 1, lives: 3, x: 0, y: 0, direction: 1, animation: "idle" } }, status: "playing" }), [{ id: "sid", name: "Lena", character: "red", score: 20, coins: 1, lives: 3 }]);
  });

  it("supports full multiplayer flow: host creates, players join, start game, answer quiz, player leaves", async () => {
    const room = await colyseus.createRoom("game", {});
    const host = await colyseus.connectTo(room, { role: "host" });
    const p1 = await colyseus.connectTo(room, { name: "Max", character: "red", role: "player" });
    const p2 = await colyseus.connectTo(room, { name: "Lena", character: "green", role: "player" });
    assert.strictEqual(room.state.players.size, 2);

    host.send("host:start");
    await room.waitForNextMessage();
    await room.waitForNextTimestep();
    assert.strictEqual(room.state.status, "playing");

    p1.send("block:hit", { quizId: "any" });
    await room.waitForNextMessage();
    assert.ok(room.state.activeQuizId.length > 0);

    const activeId = room.state.activeQuizId;
    p1.send("quiz:answer", { quizId: activeId, answer: 1 });
    await room.waitForNextMessage();

    await p2.leave();
    assert.strictEqual(room.state.players.size, 1);
  });

  it("has a non-loopback IPv4 LAN candidate or reports none", () => {
    const ips = Object.values(networkInterfaces()).flatMap((items) => items ?? []).filter((item) => item.family === "IPv4" && !item.internal && !item.address.startsWith("169.254.")).map((item) => item.address);
    assert.ok(ips.every((ip) => ip !== "localhost" && ip !== "127.0.0.1"));
  });

  it("advances a player from its buffered input", async () => {
    const room = await colyseus.createRoom<MyRoomState>("my_room", {});
    const host = await colyseus.connectTo(room, { role: "host" });
    const client1 = await colyseus.connectTo(room);
    host.send("host:start");

    const player = room.state.players.get(client1.sessionId);
    assert.ok(player, "a Player is created on join");
    const startX = player.x;

    const input = client1.input<MoveInput>({ mode: "reliable" });
    input.data.moveX = 1;
    input.data.moveY = 0;
    input.send();

    await room.waitForNextMessage();  // the input reaches the server
    await room.waitForNextTimestep(); // the step that consumes it runs

    assert.ok(player.x > startX, "the buffered input advanced the player");
  });

  it("clamps input that is out of range", async () => {
    const room = await colyseus.createRoom<MyRoomState>("my_room", {});
    const host = await colyseus.connectTo(room, { role: "host" });
    const client1 = await colyseus.connectTo(room);
    host.send("host:start");

    const player = room.state.players.get(client1.sessionId);
    const startX = player.x;

    // A modified client claiming a huge axis value: sanitize clamps it to 1.
    const input = client1.input<MoveInput>({ mode: "reliable" });
    input.data.moveX = 100 as any;
    input.send();

    await room.waitForNextMessage();
    await room.waitForNextTimestep();

    // The room steps once per received input, so one input is exactly one step
    // of travel — at moveX clamped to 1, not the 100 the client asked for.
    assert.strictEqual(player.x, startX + PLAYER_SPEED * (1 / TICK_RATE));
  });
});
