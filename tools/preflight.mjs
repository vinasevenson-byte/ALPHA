import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const root = process.argv[2] || process.cwd();
const issues = [];
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
if (!pkg.scripts?.build) issues.push('Falta npm run build');
if (!existsSync(join(root, 'middleware.ts'))) issues.push('Falta middleware.ts de proteção Preview');
if (!existsSync(join(root, 'prisma', 'schema.prisma'))) issues.push('Falta schema Prisma');
else {
  const schema=readFileSync(join(root, 'prisma','schema.prisma'),'utf8');
  if (/provider\s*=\s*"sqlite"/.test(schema)) issues.push('Prisma ainda utiliza SQLite, incompatível com persistência confiável em Vercel Functions');
  if (!/provider\s*=\s*"postgresql"/.test(schema)) issues.push('Prisma não configurado para PostgreSQL');
}
if (existsSync(join(root,'.env'))) issues.push('Arquivo .env na raiz: confirme que foi removido do controle de versão');
if (!pkg.scripts?.['db:migrate:deploy']) issues.push('Falta script db:migrate:deploy');
if (issues.length) { console.error('NOVA P08 — Pré-implantação BLOQUEADA\n'+issues.map(x=>' - '+x).join('\n'));process.exitCode=1; }
else console.log('NOVA P08 — Verificações estáticas aprovadas. Ainda requer build e testes reais.');
