import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { serverEnvironment } from "@/server/config/env";

import { PrismaClient } from "./generated/client";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const adapter = new PrismaPg({ connectionString: serverEnvironment.DATABASE_URL });

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
