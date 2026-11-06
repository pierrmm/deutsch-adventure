import { Room, Client, CloseCode, type StepContext } from "colyseus";
import { randomBytes } from "node:crypto";
import { GameRoomState, Player, MoveInput } from "./schema/MyRoomState.js";
import { germanQuizBank, quizCategories } from "../shared/germanQuizBank.js";
import { stepEntity } from "../shared/movement.js";
import { TICK_RATE, ARENA_WIDTH, ARENA_HEIGHT } from "../shared/constants.js";
import { allQuizQuestions } from "../shared/germanQuizBank.js";

const characters = new Set(["red", "green", "pink", "blue"]);
const safeText = (value: unknown, max: number, fallback: string) => typeof value === "string" ? value.trim().slice(0, max) || fallback : fallback;
const roomCodes = new Set<string>();
const makeRoomCode = () => { const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let code = ""; do { code = Array.from(randomBytes(8), (byte) => alphabet[byte % alphabet.length]).join("").slice(0, 4); } while (roomCodes.has(code)); roomCodes.add(code); return code; };

export class MyRoom extends Room<{ state: GameRoomState, input: MoveInput }> {
  maxClients = 9;
  state = new GameRoomState();
  private timer?: ReturnType<typeof setInterval>;
  private quizTimeout?: ReturnType<typeof setTimeout>;
  private roomCode = "";
  private activatedBlocks = new Map<string, Set<string>>();

  /**
   * Per-client input buffer. `sanitize` clamps every field as it is decoded —
   * never trust the wire — and the buffer holds ~2s of inputs at this tick rate
   * so a burst after a stall still replays in order.
   */
  inputs = this.defineInput(MoveInput, {
    bufferMaxSize: 64,
    sanitize: { moveX: [-1, 1], moveY: [-1, 1] },
  });

  messages = {
    "host:category": (client: Client, data: { category?: unknown }) => {
      const category = safeText(data?.category, 64, "Alle Kategorien");
      if (client.sessionId === this.state.hostId && this.state.status === "lobby" && (category === "Alle Kategorien" || quizCategories.includes(category as typeof quizCategories[number]))) this.state.category = category;
    },
    "player:select": (client: Client, data: { name?: unknown; character?: unknown }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || this.state.status !== "lobby") return;
      player.name = safeText(data?.name, 20, "Spieler");
      player.character = characters.has(data?.character as string) ? data.character as string : "red";
    },
    "host:start": (client: Client) => { if (client.sessionId === this.state.hostId && this.state.status === "lobby") this.state.status = "playing"; },
    "host:pause": (client: Client, data: { paused?: unknown }) => { if (client.sessionId === this.state.hostId && this.state.status !== "ended") this.state.status = data?.paused === true ? "paused" : "playing"; },
    "host:end": (client: Client) => { if (client.sessionId === this.state.hostId) this.endGame(); },
    "block:hit": (client: Client, data: { quizId?: unknown; blockId?: unknown; blockType?: unknown }) => {
      const player = this.state.players.get(client.sessionId);
      if (this.state.status !== "playing" || !player || player.quizId) return;

      const blockId = safeText(data?.blockId, 64, "");
      let playerBlocks = this.activatedBlocks.get(client.sessionId);
      if (!playerBlocks) {
        playerBlocks = new Set();
        this.activatedBlocks.set(client.sessionId, playerBlocks);
      }
      if (blockId && playerBlocks.has(blockId)) return;

      const blockType = safeText(data?.blockType, 32, "standard");
      let bank = allQuizQuestions;
      if (blockType === "vocab") bank = germanQuizBank["Wortschatz (A1)"] ?? allQuizQuestions;
      else if (blockType === "grammar") bank = germanQuizBank["Grammatik (A2)"] ?? allQuizQuestions;
      else if (blockType === "challenge") bank = germanQuizBank["Herausforderung (B1)"] ?? allQuizQuestions;
      else if (blockType === "bonus") bank = germanQuizBank["Satzbildung & Dialog (A2)"] ?? allQuizQuestions;
      else if (this.state.category !== "Alle Kategorien") bank = germanQuizBank[this.state.category as keyof typeof germanQuizBank] ?? allQuizQuestions;

      const question = bank[Math.floor(Math.random() * bank.length)];
      if (!question) return;

      player.quizId = question.id;
      this.state.activeQuizId = question.id;
      this.broadcast("quiz:opened", {
        playerId: client.sessionId,
        quizId: question.id,
        blockId,
        question: question.question,
        translation: question.translation,
        options: question.options,
        difficulty: question.difficulty,
        category: question.category,
        points: question.points,
      });

      if (this.quizTimeout) clearTimeout(this.quizTimeout);
      this.quizTimeout = setTimeout(() => this.resolveQuiz(client.sessionId, question.id, false, blockId), 15_000);
    },
    "quiz:answer": (client: Client, data: { quizId?: unknown; answer?: unknown; blockId?: unknown }) => {
      const player = this.state.players.get(client.sessionId);
      const item = allQuizQuestions.find((q) => q.id === data?.quizId);
      if (this.state.status !== "playing" || !player || !item || player.quizId !== item.id || !Number.isInteger(data?.answer) || (data.answer as number) < 0 || (data.answer as number) > 3) return;
      this.resolveQuiz(client.sessionId, item.id, data.answer === item.correctAnswer, safeText(data?.blockId, 64, ""));
    },
  };

  async onCreate() {
    this.roomCode = makeRoomCode();
    this.roomId = this.roomCode;
    this.state.status = "lobby"; this.state.remainingSeconds = 600; this.state.category = "Alle Kategorien"; this.state.roomCode = this.roomCode;
    await this.setMetadata({ code: this.roomCode });
    this.setFixedTimestep((ctx) => this.step(ctx), TICK_RATE);
    this.timer = setInterval(() => {
      if (this.state.status !== "playing") return;
      if (this.state.remainingSeconds > 0) this.state.remainingSeconds--;
      if (this.state.remainingSeconds === 0) this.endGame();
    }, 1000);
  }

  onJoin(client: Client, options: { role?: unknown; name?: unknown; character?: unknown }) {
    if (options?.role === "host") {
      if (this.state.hostId) { client.leave(4000, "Host already exists"); return; }
      this.state.hostId = client.sessionId; return;
    }
    if (this.state.status !== "lobby") { client.leave(4001, "Game already started"); return; }
    const angle = this.state.players.size * 2.399963;
    this.state.players.set(client.sessionId, new Player({ name: safeText(options?.name, 20, "Spieler"), character: characters.has(options?.character as string) ? options.character as string : "red", x: ARENA_WIDTH / 2 + Math.cos(angle) * 80, y: ARENA_HEIGHT / 2 + Math.sin(angle) * 80, vx: 0, vy: 0, direction: 1, animation: "idle", coins: 0, lives: 3, score: 0, quizId: "" }));
  }

  onLeave(client: Client, code: CloseCode) {
    const player = this.state.players.get(client.sessionId);
    if (player?.quizId) this.resolveQuiz(client.sessionId, player.quizId, false);
    this.activatedBlocks.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
    if (client.sessionId === this.state.hostId) this.endGame();
  }

  onDispose() { roomCodes.delete(this.roomCode); if (this.timer) clearInterval(this.timer); if (this.quizTimeout) clearTimeout(this.quizTimeout); }
  private resolveQuiz(playerId: string, quizId: string, correct: boolean, blockId = "") {
    const player = this.state.players.get(playerId);
    if (!player || player.quizId !== quizId) return;
    if (this.quizTimeout) clearTimeout(this.quizTimeout);

    const item = allQuizQuestions.find((q) => q.id === quizId);
    const points = item?.points || 100;

    if (blockId) {
      const playerBlocks = this.activatedBlocks.get(playerId);
      if (playerBlocks) playerBlocks.add(blockId);
    }

    if (correct) {
      player.score += points;
      player.coins += 1;
    }
    player.quizId = "";
    this.state.activeQuizId = "";

    this.broadcast("quiz:result", {
      playerId,
      quizId,
      blockId,
      correct,
      points: correct ? points : 0,
      explanation: item?.explanation || "",
      translation: item?.translation || "",
      score: player.score,
      coins: player.coins,
    });
  }
  private endGame() { this.state.status = "ended"; this.state.activeQuizId = ""; if (this.quizTimeout) clearTimeout(this.quizTimeout); }

  /**
   * One shared `stepEntity` per received input, so the set the client predicted
   * is exactly the set the server applied. A client that sends nothing simply
   * does not move — an empty tick advances no one.
   */
  private step(ctx: StepContext) {
    if (this.state.status !== "playing") return;
    for (const [sessionId, player] of this.state.players) {
      const channel = this.inputs.get(sessionId);
      if (!channel || player.quizId) { continue; }
      for (const input of channel) {
        stepEntity(player, input, ctx.dt);
        if (input.moveX !== 0) player.direction = input.moveX;
        player.animation = input.moveX === 0 && input.moveY === 0 ? "idle" : "run";
      }
    }
  }

  /**
   * Called on any disconnection the client did not ask for — a network blip, a
   * suspended tab, a tunnel change. Holding the seat lets the SDK retry into the
   * same session, so the player keeps their entity and their place in the room.
   */
  onDrop(client: Client, code: CloseCode) {
    // Deliberately not awaited: the framework routes the outcome to onReconnect()
    // or onLeave() by itself. The catch is only here because the promise also
    // rejects when the room is already disposing (server shutdown), which would
    // otherwise surface as an unhandled rejection.
    this.allowReconnection(client, 30).catch(() => {});
  }

  onReconnect(client: Client) {
    console.log(client.sessionId, "reconnected!");
  }
}
