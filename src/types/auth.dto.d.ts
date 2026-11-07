import type { User } from "../generated/prisma/client.js";

/** A user as it is sent to the client: UserDto in dto.md. */
export type PublicUser = Pick<User, "id" | "name" | "email" | "role">;

export interface SigninOutput {
  data: {
    user: PublicUser;
    accessToken: string;
  };
}

export type LoginOutput = SigninOutput;

export interface RefreshOutput {
  data: {
    accessToken: string;
  };
}
