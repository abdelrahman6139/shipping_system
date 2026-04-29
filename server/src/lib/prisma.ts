import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __prismaQueryLogging__: boolean | undefined;
}

const prismaLog =
  process.env.NODE_ENV !== 'production'
    ? [{ emit: 'event' as const, level: 'query' as const }]
    : [];

export const prisma = global.__prisma__ ?? new PrismaClient({ log: prismaLog });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma__ = prisma;
}

if (process.env.NODE_ENV !== 'production' && !global.__prismaQueryLogging__) {
  global.__prismaQueryLogging__ = true;
  const slowQueryMs = Number(process.env.SLOW_QUERY_MS || 75);
  (prisma as any).$on('query', (event: { duration: number; query: string }) => {
    if (event.duration >= slowQueryMs) {
      const compactQuery = event.query.replace(/\s+/g, ' ').trim();
      console.log(`[prisma] ${event.duration}ms ${compactQuery}`);
    }
  });
}
