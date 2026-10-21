import type { Config } from "jest";

// ts-jest needs the TypeScript compiler API, which TypeScript 7 no longer ships.
// @swc/jest only strips types, so run `tsc --noEmit` for type checking.
const config: Config = {
  testEnvironment: "node",
  transform: {
    "^.+\\.ts$": "@swc/jest",
  },
  // Source files import siblings as "./file.js" (ESM style); point Jest at the .ts file.
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  moduleFileExtensions: ["ts", "js"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
};

export default config;
