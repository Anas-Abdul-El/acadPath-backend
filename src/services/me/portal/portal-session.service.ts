import {
  getPortalStatus,
  issuePortalTicket,
  startPortalSession,
  stopPortalSession,
} from "../../../libs/portal/session.js";
import { PORTAL_WS_PATH } from "../../../libs/portal/socket.js";
import type { PortalSessionDto, PortalStatusDto } from "../../../types/me.dto.js";
import { getSelection } from "../university/index.js";

/**
 * Starts (or reuses) the student's remote portal browser and returns a single-use
 * ticket for its WebSocket. Calling it again while a session runs just issues a new
 * ticket, which is how the page reconnects.
 */
export const startPortal = async (userId: string): Promise<PortalSessionDto> => {
  // The transcript is matched against the selected major, so that has to exist first.
  await getSelection(userId);

  const status = await startPortalSession(userId);
  return {
    status,
    ticket: issuePortalTicket(userId),
    socketPath: PORTAL_WS_PATH,
  };
};

export const getPortal = (userId: string): PortalStatusDto => getPortalStatus(userId);

export const stopPortal = async (userId: string): Promise<void> => {
  await stopPortalSession(userId);
};
