import type { UserRole, YearOfStudy } from "../../generated/prisma/enums.js";

// The user as the client sees it: never includes passwordHash.
export interface AuthUserDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  yearOfStudy: YearOfStudy | null;
}

// What the service hands the controller. The controller puts refreshToken in a
// cookie and the rest in the JSON body.
export interface AuthResult {
  user: AuthUserDto;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}
