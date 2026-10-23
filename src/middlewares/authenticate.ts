import type { RequestHandler } from "express";
import z from "zod";
import { UserRole } from "../generated/prisma/enums.js";
import AppErr from "../libs/appErr.js";
import { verifyToken } from "../utils/token.js";

// The claims an access token must carry: sign it with
// generateToken({ sub: user.id, role: user.role }, "access").
const accessPayloadSchema = z.object({
  sub: z.string(),
  role: z.enum(UserRole),
});

// Reads "Authorization: Bearer <access token>", verifies it and puts the user on
// res.locals.user for the next handlers. Any problem with the token is a 401.
const authenticate: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
    throw new AppErr("Missing or malformed access token", 401);

  // verifyToken throws its own 401 for a bad signature or an expired token.
  const payload = accessPayloadSchema.safeParse(
    verifyToken(header.slice("Bearer ".length), "access"),
  );
  if (!payload.success) throw new AppErr("Invalid or expired token", 401);

  res.locals.user = { id: payload.data.sub, role: payload.data.role };
  next();
};

export default authenticate;