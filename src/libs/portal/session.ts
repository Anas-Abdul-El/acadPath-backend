import { randomUUID } from "node:crypto";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type CDPSession,
  type Page,
} from "playwright";
import type { WebSocket } from "ws";
import { portalConfig } from "../../config/portal.js";
import logger from "../../config/logger.js";
import AppErr from "../appErr.js";
import parsePdf from "../../utils/pdfParser.js";
import { htmlToText } from "../../utils/htmlToText.js";
import {
  detectTranscript,
  transcriptPdfFrom,
  type DetectionResult,
} from "../../utils/transcriptDetector.js";
import { guardContext, isAllowedPortalHost } from "./network-guard.js";
import type { PortalInput } from "./input.js";

/**
 * Remote portal browser sessions.
 *
 * One headless Chromium process is shared; each student gets their own browser
 * *context* (separate cookies, storage and pages), so students never see each
 * other's portal. A session:
 *   1. opens the university portal's login page,
 *   2. streams JPEG frames of the page to the student's WebSocket (Chrome's screencast),
 *   3. replays the student's clicks and key presses,
 *   4. runs the transcript detector on every navigation and every 1.5 s,
 *   5. when the transcript is on screen, captures the page's HTML and parses it to text.
 *
 * Everything lives in memory only. The student's password is typed straight into the
 * remote page; we never read or store it. Sessions close on stop, after the import,
 * when nobody has watched them for a while, and after a maximum lifetime.
 */

/** The transcript as captured from the portal. */
export interface PortalCapture {
  url: string;
  title: string;
  capturedAt: string;
  /** Plain text sent to the AI. */
  text: string;
  /** The original document, kept so it can be stored like an uploaded file. */
  file: { buffer: Buffer; mimeType: "text/html" | "application/pdf" };
}

/** What the frontend shows: pushed over the WebSocket and returned by GET /me/portal. */
export interface PortalStatus {
  running: boolean;
  url: string | null;
  title: string | null;
  loggedIn: boolean;
  onTranscript: boolean;
  score: number;
  threshold: number;
  reasons: string[];
  captured: { url: string; title: string; capturedAt: string; length: number } | null;
}

type ViewerMessage =
  | { type: "frame"; data: string }
  | ({ type: "status" } & PortalStatus)
  | { type: "stopped"; reason: string };

interface Session {
  userId: string;
  context: BrowserContext;
  page: Page;
  cdp: CDPSession | null;
  viewers: Set<WebSocket>;
  lastFrame: string | null;
  viewport: { width: number; height: number };
  detection: (DetectionResult & { url: string; title: string }) | null;
  pdf: { name: string; buffer: Buffer } | null;
  capture: PortalCapture | null;
  detecting: boolean;
  detectTimer: NodeJS.Timeout | null;
  pollTimer: NodeJS.Timeout;
  idleTimer: NodeJS.Timeout | null;
  lifetimeTimer: NodeJS.Timeout;
  closed: boolean;
}

const sessions = new Map<string, Session>();
const starting = new Map<string, Promise<Session>>();
let browserPromise: Promise<Browser> | null = null;

// ── Browser ──────────────────────────────────────────────────────────────────

const getBrowser = (): Promise<Browser> => {
  browserPromise ??= chromium.launch({ headless: true }).then((browser) => {
    browser.on("disconnected", () => {
      browserPromise = null;
      for (const userId of [...sessions.keys()])
        void stopPortalSession(userId, "The remote browser stopped");
    });
    return browser;
  });
  // A failed launch must not stay cached.
  browserPromise.catch(() => (browserPromise = null));
  return browserPromise;
};

const closeBrowserIfUnused = async () => {
  if (sessions.size > 0 || starting.size > 0 || !browserPromise) return;
  const browser = await browserPromise.catch(() => null);
  browserPromise = null;
  await browser?.close().catch(() => {});
};

// ── Viewers ──────────────────────────────────────────────────────────────────

const send = (ws: WebSocket, message: ViewerMessage) => {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
};

const broadcast = (session: Session, message: ViewerMessage) => {
  for (const ws of session.viewers) send(ws, message);
};

const toStatus = (session: Session): PortalStatus => {
  const url = session.page.isClosed() ? null : session.page.url();
  const detection = session.detection;
  const capture = session.capture;
  return {
    running: true,
    url,
    title: detection?.title ?? null,
    // Signed in = on the portal and no password field on screen.
    loggedIn: Boolean(
      url && detection && !detection.loginForm && isOnPortal(url) && !/\/login/i.test(url),
    ),
    onTranscript: detection?.onTranscript ?? false,
    score: detection?.score ?? 0,
    threshold: detection?.threshold ?? 5,
    reasons: detection?.reasons ?? [],
    captured: capture
      ? {
          url: capture.url,
          title: capture.title,
          capturedAt: capture.capturedAt,
          length: capture.text.length,
        }
      : null,
  };
};

const isOnPortal = (url: string) => {
  try {
    return isAllowedPortalHost(new URL(url).hostname);
  } catch {
    return false;
  }
};

const pushStatus = (session: Session) =>
  broadcast(session, { type: "status", ...toStatus(session) });

// A session nobody watches is closed after a while; watching again cancels that.
const armIdleTimer = (session: Session) => {
  if (session.idleTimer) clearTimeout(session.idleTimer);
  session.idleTimer = setTimeout(
    () => void stopPortalSession(session.userId, "Closed after being idle"),
    portalConfig.idleMs,
  );
};

export const addViewer = (userId: string, ws: WebSocket): boolean => {
  const session = sessions.get(userId);
  if (!session) return false;

  session.viewers.add(ws);
  if (session.idleTimer) clearTimeout(session.idleTimer);
  session.idleTimer = null;

  // A new view would stay blank until the page repaints, so send the last frame now.
  if (session.lastFrame) send(ws, { type: "frame", data: session.lastFrame });
  send(ws, { type: "status", ...toStatus(session) });

  ws.on("close", () => {
    session.viewers.delete(ws);
    if (session.viewers.size === 0 && !session.closed) armIdleTimer(session);
  });
  return true;
};

// ── Screencast ───────────────────────────────────────────────────────────────

// Streams a page: Chrome pushes a JPEG on every repaint.
const attachPage = async (session: Session, page: Page) => {
  if (session.cdp) await session.cdp.detach().catch(() => {});
  session.page = page;
  session.lastFrame = null;
  watchPage(session, page);
  scheduleDetection(session);

  const cdp = await page.context().newCDPSession(page);
  session.cdp = cdp;
  cdp.on("Page.screencastFrame", ({ data, sessionId }) => {
    if (session.cdp !== cdp) return; // an old tab
    session.lastFrame = data;
    broadcast(session, { type: "frame", data });
    void cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 70,
    maxWidth: session.viewport.width,
    maxHeight: session.viewport.height,
  });
};

// ── Transcript detection and capture ─────────────────────────────────────────

const watched = new WeakSet<Page>();

const watchPage = (session: Session, page: Page) => {
  if (watched.has(page)) return;
  watched.add(page);

  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) session.pdf = null; // new page: forget the old PDF
    scheduleDetection(session);
  });
  page.on("load", () => scheduleDetection(session));

  // A transcript delivered as a PDF: keep its bytes, so its text can be parsed.
  page.on("response", (response) => {
    const name = transcriptPdfFrom(response);
    if (!name) return;
    response
      .body()
      .then((buffer) => {
        session.pdf = { name, buffer };
        scheduleDetection(session);
      })
      .catch(() => {});
  });
};

const scheduleDetection = (session: Session, delay = 300) => {
  if (session.detectTimer) clearTimeout(session.detectTimer);
  session.detectTimer = setTimeout(() => void runDetection(session), delay);
};

/** Grabs the HTML of the page and every iframe in it, and parses it to text. */
export const capturePage = async (page: Page): Promise<PortalCapture> => {
  const frames: { url: string; isMain: boolean; html: string; text: string }[] = [];
  for (const frame of page.frames()) {
    const html = await frame.content().catch(() => null); // frames can vanish mid-navigation
    if (!html) continue;
    frames.push({ url: frame.url(), isMain: frame === page.mainFrame(), html, text: htmlToText(html) });
  }
  const main = frames.find((f) => f.isMain) ?? frames[0];
  const children = frames.filter((f) => f !== main && f.text);

  // Main page text, then the text of any iframes (transcripts are sometimes inside one).
  const text = [main?.text ?? "", ...children.map((f) => `--- frame ---\n${f.text}`)]
    .filter(Boolean)
    .join("\n\n");

  return {
    url: page.url(),
    title: await page.title().catch(() => ""),
    capturedAt: new Date().toISOString(),
    text,
    file: { buffer: Buffer.from(main?.html ?? "", "utf8"), mimeType: "text/html" },
  };
};

const capturePdf = async (
  page: Page,
  pdf: { name: string; buffer: Buffer },
): Promise<PortalCapture | null> => {
  const text = await parsePdf({ type: "buffer", buffer: pdf.buffer }).catch(() => "");
  if (!text) return null;
  return {
    url: page.url(),
    title: pdf.name,
    capturedAt: new Date().toISOString(),
    text,
    file: { buffer: pdf.buffer, mimeType: "application/pdf" },
  };
};

const capture = async (session: Session): Promise<PortalCapture> =>
  (session.pdf && (await capturePdf(session.page, session.pdf))) ||
  (await capturePage(session.page));

const runDetection = async (session: Session) => {
  if (session.closed || session.detecting || session.page.isClosed()) return;
  session.detecting = true;
  try {
    const previous = session.detection;
    const result = await detectTranscript(session.page, { pdf: session.pdf?.name ?? null });
    const changed =
      !previous ||
      result.onTranscript !== previous.onTranscript ||
      result.score !== previous.score ||
      result.url !== previous.url ||
      result.loginForm !== previous.loginForm;
    session.detection = result;

    // On the transcript: capture it. Again when the score changes too, because
    // portals often fill the table in after the page has loaded.
    if (result.onTranscript && (changed || session.capture?.url !== result.url)) {
      session.capture = await capture(session);
      logger.info("Portal transcript captured", { length: session.capture.text.length });
    }
    if (changed) pushStatus(session);
  } catch {
    // The page was navigating or closed; the next run catches up.
  } finally {
    session.detecting = false;
  }
};

// ── Lifecycle ────────────────────────────────────────────────────────────────

const launchSession = async (userId: string): Promise<Session> => {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: portalConfig.defaultViewport,
    acceptDownloads: false,
    serviceWorkers: "block", // a service worker could bypass the request guard
  });

  try {
    await guardContext(context);
    const page = await context.newPage();

    const session: Session = {
      userId,
      context,
      page,
      cdp: null,
      viewers: new Set(),
      lastFrame: null,
      viewport: { ...portalConfig.defaultViewport },
      detection: null,
      pdf: null,
      capture: null,
      detecting: false,
      detectTimer: null,
      pollTimer: setInterval(() => void runDetection(session), 1500),
      idleTimer: null,
      lifetimeTimer: setTimeout(
        () => void stopPortalSession(userId, "The session reached its time limit"),
        portalConfig.maxLifetimeMs,
      ),
      closed: false,
    };
    sessions.set(userId, session);
    armIdleTimer(session); // closed if the student never connects

    // The portal may open the transcript in a new tab: stream that tab instead,
    // and go back to the previous one when it closes.
    context.on("page", (newPage) => {
      if (context.pages().length > 5) return void newPage.close().catch(() => {});
      const previous = session.page;
      void attachPage(session, newPage)
        .then(() => newPage.setViewportSize(session.viewport))
        .catch(() => {});
      newPage.on("close", () => {
        if (session.page === newPage && !previous.isClosed() && !session.closed)
          void attachPage(session, previous).catch(() => {});
      });
    });

    await attachPage(session, page);
    // A slow portal shouldn't fail the start: the student can press reload.
    await page
      .goto(portalConfig.startUrl, { waitUntil: "domcontentloaded", timeout: 30_000 })
      .catch((err: unknown) => logger.warn("Portal start page failed to load", { err }));
    return session;
  } catch (err) {
    sessions.delete(userId);
    await context.close().catch(() => {});
    throw err;
  }
};

/** Starts the student's portal browser, or returns the one already running. */
export const startPortalSession = async (userId: string): Promise<PortalStatus> => {
  const existing = sessions.get(userId);
  if (existing) return toStatus(existing);

  let pending = starting.get(userId);
  if (!pending) {
    if (sessions.size + starting.size >= portalConfig.maxSessions)
      throw new AppErr("All remote browsers are busy. Try again in a few minutes.", 503);
    pending = launchSession(userId).finally(() => starting.delete(userId));
    starting.set(userId, pending);
  }

  try {
    return toStatus(await pending);
  } catch (err) {
    void closeBrowserIfUnused();
    throw new AppErr("Could not start the remote browser", 503, { cause: err });
  }
};

export const getPortalStatus = (userId: string): PortalStatus => {
  const session = sessions.get(userId);
  if (session) return toStatus(session);
  return {
    running: false,
    url: null,
    title: null,
    loggedIn: false,
    onTranscript: false,
    score: 0,
    threshold: 5,
    reasons: [],
    captured: null,
  };
};

/**
 * The transcript to import: a fresh capture of the page on screen (it may have loaded
 * more rows since detection), or the last capture if the page can't be read now.
 */
export const getPortalTranscript = async (userId: string): Promise<PortalCapture> => {
  const session = sessions.get(userId);
  if (!session) throw new AppErr("Open the portal browser first", 409);

  const fresh = await capture(session).catch(() => null);
  const result = fresh?.text ? fresh : session.capture;
  if (!result?.text)
    throw new AppErr("Open your transcript page in the portal first", 409);
  return result;
};

export const stopPortalSession = async (userId: string, reason = "Stopped"): Promise<void> => {
  const session = sessions.get(userId);
  if (!session || session.closed) return;
  session.closed = true;
  sessions.delete(userId);

  clearInterval(session.pollTimer);
  clearTimeout(session.lifetimeTimer);
  if (session.idleTimer) clearTimeout(session.idleTimer);
  if (session.detectTimer) clearTimeout(session.detectTimer);

  broadcast(session, { type: "stopped", reason });
  for (const ws of session.viewers) ws.close(1000, "stopped");
  session.viewers.clear();
  session.capture = null;
  session.pdf = null;

  await session.context.close().catch(() => {});
  await closeBrowserIfUnused();
};

export const stopAllPortalSessions = async (): Promise<void> => {
  await Promise.all([...sessions.keys()].map((userId) => stopPortalSession(userId, "Server shutting down")));
  await closeBrowserIfUnused();
};

// ── Input from the viewer ────────────────────────────────────────────────────

export const handlePortalInput = async (userId: string, input: PortalInput): Promise<void> => {
  const session = sessions.get(userId);
  if (!session || session.page.isClosed()) return;
  const { page } = session;

  switch (input.type) {
    case "resize": {
      // The remote page is exactly as big as the student's view.
      session.viewport = { width: input.width, height: input.height };
      await page.setViewportSize(session.viewport);
      // Restart the screencast so frames come at the new size.
      await session.cdp?.send("Page.stopScreencast").catch(() => {});
      await session.cdp?.send("Page.startScreencast", {
        format: "jpeg",
        quality: 70,
        maxWidth: input.width,
        maxHeight: input.height,
      });
      return;
    }
    case "click":
      return page.mouse.click(input.x, input.y);
    case "scroll":
      return page.mouse.wheel(0, input.deltaY);
    case "key":
      return page.keyboard.press(input.key);
    case "text":
      return page.keyboard.insertText(input.text);
    case "back":
      await page.goBack({ timeout: 15_000 });
      return;
    case "reload":
      await page.reload({ timeout: 30_000 });
      return;
  }
};

// ── WebSocket tickets ────────────────────────────────────────────────────────

/**
 * A browser can't send an Authorization header when opening a WebSocket, and an access
 * token in the URL could end up in logs. So the authenticated REST call hands out a
 * random single-use ticket that's valid for a minute, and the WebSocket redeems it.
 */
const tickets = new Map<string, { userId: string; expires: number }>();

export const issuePortalTicket = (userId: string): string => {
  const now = Date.now();
  for (const [key, ticket] of tickets) if (ticket.expires <= now) tickets.delete(key);

  const ticket = randomUUID();
  tickets.set(ticket, { userId, expires: now + portalConfig.ticketTtlMs });
  return ticket;
};

export const redeemPortalTicket = (ticket: string | null): string | null => {
  if (!ticket) return null;
  const entry = tickets.get(ticket);
  tickets.delete(ticket);
  if (!entry || entry.expires <= Date.now()) return null;
  return entry.userId;
};
