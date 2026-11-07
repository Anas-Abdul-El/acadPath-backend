import type { RequestHandler } from "express";
import type { UserRole } from "../generated/prisma/enums.js";
import AppErr from "../libs/appErr.js";

// Lets the request through only if the user's role is one of `roles`, e.g.
// router.delete("/courses/:id", authenticate, authorize("ADMIN"), controller).
// Must run after authenticate: no user means not logged in (401), wrong role is a 403.
const authorize =
  (...roles: UserRole[]): RequestHandler =>
  (_req, res, next) => {
    const { user } = res.locals;
    if (!user) throw new AppErr("Not authenticated", 401);
    if (!roles.includes(user.role))
      throw new AppErr("You don't have permission to do this", 403);

    next();
  };

export default authorize;
