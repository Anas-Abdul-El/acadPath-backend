import type { UserRole } from "../generated/prisma/enums.js";

// The logged-in user that the authenticate middleware puts on res.locals.
export interface AuthUser {
  id: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Locals {
      // Set by authenticate; undefined on routes that don't use it.
      user?: AuthUser;
    }
  }
}
