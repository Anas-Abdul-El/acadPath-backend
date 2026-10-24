import type { Request, Response } from "express";
import AppErr from "../libs/appErr.js";
import * as meService from "../services/me.service.js";
import type { MeOutput } from "../types/me.dto.js";

export const getMe = async (req: Request, res: Response<MeOutput>) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await meService.getMe(authUser.id);

  res.send({ data });
};
