import type { User } from "../generated/prisma/client.js";

export interface SigninOutput {
  data: {
    user: User;
    accessToken: string;
  };
}
