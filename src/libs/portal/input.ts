import { z } from "zod";

// Keys the viewer may press. Anything typed as a character is sent as "text" instead.
export const PORTAL_KEYS = [
  "Enter", "Backspace", "Tab", "Escape", "Delete",
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End",
] as const;

const coordinate = z.number().finite().min(0).max(4000);

/** portalInputSchema validates one message from the viewer's WebSocket. */
export const portalInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("click"), x: coordinate, y: coordinate }),
  z.object({
    type: z.literal("scroll"),
    deltaY: z.number().finite().transform((n) => Math.max(-3000, Math.min(3000, n))),
  }),
  z.object({ type: z.literal("key"), key: z.enum(PORTAL_KEYS) }),
  z.object({ type: z.literal("text"), text: z.string().min(1).max(500) }),
  z.object({ type: z.literal("back") }),
  z.object({ type: z.literal("reload") }),
  z.object({
    type: z.literal("resize"),
    width: z.number().finite().transform((n) => Math.round(Math.max(320, Math.min(1920, n)))),
    height: z.number().finite().transform((n) => Math.round(Math.max(240, Math.min(1200, n)))),
  }),
]);

export type PortalInput = z.infer<typeof portalInputSchema>;
