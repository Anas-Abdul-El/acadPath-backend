import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer } from "ws";
import { allowedOrigins } from "../../config/cors.js";
import logger from "../../config/logger.js";
import { portalInputSchema } from "./input.js";
import { addViewer, handlePortalInput, redeemPortalTicket } from "./session.js";

export const PORTAL_WS_PATH = "/api/me/portal/ws";

/**
 * The WebSocket between the onboarding page and the student's remote browser.
 *   server → client: { type: "frame" | "status" | "stopped", … }
 *   client → server: clicks, scrolls, keys, text, back, reload, resize (see input.ts)
 *
 * Express doesn't handle WebSocket upgrades, so this hooks into the HTTP server.
 * The connection is authenticated by the single-use ticket from POST /me/portal.
 */
export const attachPortalSocket = (server: Server): WebSocketServer => {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

  const reject = (socket: Duplex, status: string) => {
    socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
  };

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== PORTAL_WS_PATH) return reject(socket, "404 Not Found");

    // Browsers always send Origin on WebSockets, and CORS doesn't apply to them,
    // so check it here: only our frontend may open the stream.
    const origin = req.headers.origin;
    if (!origin || !allowedOrigins.includes(origin)) return reject(socket, "403 Forbidden");

    const userId = redeemPortalTicket(url.searchParams.get("ticket"));
    if (!userId) return reject(socket, "401 Unauthorized");

    wss.handleUpgrade(req, socket, head, (ws) => {
      if (!addViewer(userId, ws)) return ws.close(4404, "No portal session");

      ws.on("message", (raw) => {
        let json: unknown;
        try {
          json = JSON.parse(raw.toString());
        } catch {
          return;
        }
        const input = portalInputSchema.safeParse(json);
        if (!input.success) return;
        handlePortalInput(userId, input.data).catch((err: unknown) =>
          logger.debug("Portal input failed", { type: input.data.type, err }),
        );
      });
    });
  });

  return wss;
};
