import "dotenv/config";
import app from "./index.js";
import { prisma } from "./libs/prisma.js";

const PORT = Number(process.env.PORT || 3000);

const server = app.listen(PORT, (error) => {
  if (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
  console.log(`Server is running on port ${PORT}`);
});

const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log("Server closed");
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
