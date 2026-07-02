/**
 * V11.13 — Optional Prisma persistence adapter.
 *
 * Current storage: JSON file (data/physics_states.json).
 * Prisma is configured as an optional future relational DB adapter.
 * It is NOT the current production storage — API routes use JSON file storage.
 * To activate Prisma: set up DATABASE_URL, run prisma migrate, swap repository.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
