import { networkInterfaces } from "node:os";
import {
  defineServer,
  defineRoom,
  monitor,
  playground,
  createRouter,
  createEndpoint,
  LobbyRoom,
} from "colyseus";

/**
 * Import your Room files
 */
import { MyRoom } from "./rooms/MyRoom.js";

const server = defineServer({
  greet: false,
  /**
   * Define your room handlers:
   */
  rooms: {
    game: defineRoom(MyRoom).enableRealtimeListing(),
    my_room: defineRoom(MyRoom),
    lobby: defineRoom(LobbyRoom),
  },

  /**
   * Experimental: Define API routes. Built-in integration with the "playground" and SDK.
   *
   * Usage from SDK:
   *   client.http.get("/api/hello").then((response) => {})
   *
   */
  routes: createRouter({
    api_hello: createEndpoint("/api/hello", { method: "GET" }, async () => ({ message: "Hello World" })),
    resolve_room: createEndpoint("/api/rooms/:code", { method: "GET" }, async (ctx) => {
      const code = String(ctx.params.code ?? "").toUpperCase();
      try {
        const room = await (await import("@colyseus/core/MatchMaker")).findOneRoomAvailable("game", { code });
        return { roomId: room.roomId };
      } catch {
        return { error: "Room code not found" };
      }
    }),
  }),

  /**
   * Bind your custom express routes here:
   * Read more: https://expressjs.com/en/starter/basic-routing.html
   */
  express: (app) => {
    app.get("/api/lan", (_req, res) => {
      const addresses = Object.values(networkInterfaces()).flatMap((items) => items ?? []).filter((item) => item.family === "IPv4" && !item.internal && !item.address.startsWith("169.254.")).map((item) => item.address);
      res.json({ addresses, preferred: addresses.find((address) => address.startsWith("192.168.")) ?? addresses.find((address) => address.startsWith("10.")) ?? addresses.find((address) => address.startsWith("172.")) ?? addresses[0] ?? "" });
    });

    app.get("/hi", (req, res) => {
      res.send("It's time to kick ass and chew bubblegum!");
    });

    /**
     * Use @colyseus/monitor
     * If you expose it in production, make sure to protect it with a password:
     * https://docs.colyseus.io/tools/monitoring#password-protection
     */
    if (process.env.NODE_ENV !== "production") {
      app.use("/monitor", monitor());
    }

    /**
     * Use @colyseus/playground
     * (It is not recommended to expose this route in a production environment)
     */
    if (process.env.NODE_ENV !== "production") {
      app.use("/playground", playground());
    }
  }
});

export default server;

/** Named export read by the `colyseus/vite` plugin's `serverEntry`. */
export { server };

/** Production entry can call this to bind Colyseus explicitly on all LAN interfaces. */
export const listenOnLan = (port = Number(process.env.PORT || 2567)) => server.listen(port, '0.0.0.0');
