import "dotenv/config";
import app from "./index.js";
import logger from "./config/logger.js";
import { prisma } from "./libs/prisma.js";

const PORT = Number(process.env.PORT || 3000);

const server = app.listen(PORT, (error) => {
  if (error) {
    logger.error("Failed to start server", error);
    process.exit(1);
  }
  logger.info(`Server is running on port ${PORT}`);
});

const shutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info("Server closed");
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
