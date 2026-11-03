import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const root=process.argv[2]||process.cwd();
const input=join(root,'prisma','schema.prisma');
const output=join(root,'prisma','schema.postgres.preview.prisma');
if (!existsSync(input)) throw new Error('prisma/schema.prisma não localizado');
const original=readFileSync(input,'utf8');
if (!/provider\s*=\s*"sqlite"/.test(original)) throw new Error('Esperado schema SQLite; revise a origem antes de converter');
let result=original.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
// Keep the original intact; Prisma must validate the generated schema before any deploy.
writeFileSync(output,result);
console.log('Schema candidato gerado: '+output+'\nPróximos passos: npx prisma validate --schema '+output+'; revisar incompatibilidades e planejar migrações versionadas. NÃO execute db push em produção.');
