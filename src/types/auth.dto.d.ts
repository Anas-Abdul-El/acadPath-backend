import type { User } from "../generated/prisma/client.js";

/** A user as it is safe to send to the client: never includes the password hash. */
export type PublicUser = Omit<User, "passwordHash">;

export interface SigninOutput {
  data: {
    user: PublicUser;
    accessToken: string;
  };
}

export type LoginOutput = SigninOutput;

export type RefreshOutput = SigninOutput;
