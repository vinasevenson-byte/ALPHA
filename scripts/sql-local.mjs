import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const localAppData = process.env.LOCALAPPDATA || '';
const pgBin = join(localAppData, 'Programs', 'PostgreSQL', '16', 'bin');
const pgCtl = join(pgBin, process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl');
const pgBase = join(localAppData, 'PostgreSQL', '16');
const pgData = join(pgBase, 'data');
const pgLog = join(pgBase, 'postgres.log');

const cmd = (process.argv[2] || 'status').toLowerCase();

function isRunning() {
  if (!existsSync(pgCtl) || !existsSync(join(pgData, 'PG_VERSION'))) return false;
  try {
    execFileSync(pgCtl, ['-D', pgData, 'status'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

if (cmd === 'ensure') {
  if (!existsSync(pgCtl) || !existsSync(join(pgData, 'PG_VERSION'))) {
    process.exit(0);
  }
  if (!isRunning()) {
    console.log('NOVA SQL: Iniciando PostgreSQL 16 local (127.0.0.1:5432)...');
    execFileSync(pgCtl, ['-D', pgData, '-l', pgLog, '-w', 'start'], { stdio: 'inherit' });
  }
  process.exit(0);
}

if (!existsSync(pgCtl)) {
  console.error(`PostgreSQL local não encontrado em: ${pgCtl}`);
  process.exit(1);
}

if (cmd === 'start') {
  if (isRunning()) {
    console.log('PostgreSQL 16 já está em execução em 127.0.0.1:5432.');
  } else {
    execFileSync(pgCtl, ['-D', pgData, '-l', pgLog, '-w', 'start'], { stdio: 'inherit' });
  }
} else if (cmd === 'stop') {
  if (!isRunning()) {
    console.log('PostgreSQL 16 já está parado.');
  } else {
    execFileSync(pgCtl, ['-D', pgData, '-m', 'fast', '-w', 'stop'], { stdio: 'inherit' });
  }
} else if (cmd === 'status') {
  try {
    execFileSync(pgCtl, ['-D', pgData, 'status'], { stdio: 'inherit' });
  } catch {
    console.log('PostgreSQL 16 está parado.');
    process.exitCode = 1;
  }
} else if (cmd === 'check') {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const info = await prisma.$queryRawUnsafe(
      'SELECT version() AS version, current_database() AS database, current_user AS "user"'
    );
    const tables = await prisma.$queryRawUnsafe(
      "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'"
    );
    const users = await prisma.user.count();
    console.log('SQL conectado com sucesso:', {
      ...info[0],
      publicTables: tables[0]?.count ?? 0,
      usersCount: users,
    });
  } finally {
    await prisma.$disconnect();
  }
} else {
  console.error(`Uso: node scripts/sql-local.mjs [start|stop|status|ensure|check]`);
  process.exit(1);
}
