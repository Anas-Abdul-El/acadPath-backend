import winston from "winston";

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const env = process.env.NODE_ENV ?? "development";
const isProduction = env === "production";

// LOG_LEVEL overrides the default; anything that isn't an npm level falls back to it.
const levels = Object.keys(winston.config.npm.levels);
const defaultLevel = isProduction ? "info" : "debug";
const level =
  process.env.LOG_LEVEL && levels.includes(process.env.LOG_LEVEL)
    ? process.env.LOG_LEVEL
    : defaultLevel;

// Development: one readable, colored line per entry, plus the stack trace for errors.
const devFormat = combine(
  colorize(),
  timestamp({ format: "HH:mm:ss" }),
  printf(({ timestamp, level, message, stack, ...meta }) => {
    const extra =
      Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
    const trace = typeof stack === "string" ? `\n${stack}` : "";
    return `${String(timestamp)} ${level}: ${String(message)}${extra}${trace}`;
  }),
);

// Production: structured JSON on stdout so the hosting platform can collect and search it.
const prodFormat = combine(timestamp(), json());

const logger = winston.createLogger({
  level,
  // errors() copies an Error's message and stack onto the log entry.
  format: combine(
    errors({ stack: true }),
    isProduction ? prodFormat : devFormat,
  ),
  transports: [new winston.transports.Console()],
  // Keep Jest output clean; tests can still spy on the logger.
  silent: env === "test",
});

export default logger;
