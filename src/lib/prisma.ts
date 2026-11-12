import { PrismaClient } from "@prisma/client";
import { getInMemoryPrisma } from "./in-memory-prisma";

const globalForPrisma = globalThis as unknown as {
  prismaClient?: PrismaClient;
  prismaFallbackForced?: boolean;
};

export function hasConfiguredDatabaseUrl(): boolean {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return false;
  if (!/^postgres(ql)?:\/\//i.test(raw)) return false;
  if (raw.includes("USUARIO:SENHA@HOST")) return false;
  return true;
}

export function isFallbackMemoryActive(): boolean {
  return !hasConfiguredDatabaseUrl() || Boolean(globalForPrisma.prismaFallbackForced);
}

function isDbUnavailableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name ?? "";
  const code = (err as { code?: string }).code ?? "";
  const msg = (err as { message?: string }).message ?? "";
  if (
    name === "PrismaClientInitializationError" ||
    name === "PrismaClientRustPanicError"
  ) {
    return true;
  }
  if (["P1000", "P1001", "P1002", "P1003", "P1008", "P1017", "P2021"].includes(code)) {
    return true;
  }
  if (/Environment variable not found:\s*DATABASE_URL/i.test(msg)) {
    return true;
  }
  if (/Can't reach database server|does not exist in the current database/i.test(msg)) {
    return true;
  }
  return false;
}

function getRealClient(): PrismaClient {
  if (!globalForPrisma.prismaClient) {
    globalForPrisma.prismaClient = new PrismaClient({ log: ["error"] });
  }
  return globalForPrisma.prismaClient;
}

function createResilientPrismaProxy(): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get(_target, prop: string | symbol) {
      if (typeof prop === "symbol") {
        return (getInMemoryPrisma() as any)[prop];
      }
      if (isFallbackMemoryActive()) {
        return getInMemoryPrisma()[prop];
      }

      const real = getRealClient() as any;
      const val = real[prop];

      if (prop === "$transaction" && typeof val === "function") {
        return async (...args: any[]) => {
          if (isFallbackMemoryActive()) {
            return getInMemoryPrisma().$transaction(...args);
          }
          try {
            return await real.$transaction(...args);
          } catch (err) {
            if (isDbUnavailableError(err)) {
              globalForPrisma.prismaFallbackForced = true;
              console.warn(
                "NOVA: Banco PostgreSQL indisponível — ativando store em memória de contingência."
              );
              return await getInMemoryPrisma().$transaction(...args);
            }
            throw err;
          }
        };
      }

      if (val && typeof val === "object") {
        return new Proxy(val, {
          get(_mTarget, method: string | symbol) {
            if (typeof method === "symbol") return val[method];
            const fn = val[method];
            if (typeof fn !== "function") return fn;
            return async (...args: any[]) => {
              if (isFallbackMemoryActive()) {
                return getInMemoryPrisma()[prop][method](...args);
              }
              try {
                return await fn.apply(val, args);
              } catch (err) {
                if (isDbUnavailableError(err)) {
                  globalForPrisma.prismaFallbackForced = true;
                  console.warn(
                    `NOVA: Falha de conexão em prisma.${String(prop)}.${String(
                      method
                    )} — ativando store em memória.`
                  );
                  return await getInMemoryPrisma()[prop][method](...args);
                }
                throw err;
              }
            };
          },
        });
      }

      return typeof val === "function" ? val.bind(real) : val;
    },
  });
}

export const prisma: PrismaClient = createResilientPrismaProxy();
