#!/usr/bin/env python3
"""Aplica Pacote 09 sobre clone limpo do ALPHA; falha antes de gravar se estruturas mudaram."""
from pathlib import Path
import argparse, shutil, json

parser=argparse.ArgumentParser()
parser.add_argument('--root',required=True,help='Raiz local do clone ALPHA')
args=parser.parse_args()
root=Path(args.root).resolve()
overlay=Path(__file__).resolve().parents[1]
if not (root/'src/app/api/platform/route.ts').exists() or not (root/'prisma/schema.prisma').exists():
    raise SystemExit('ERRO: raiz não parece ser o repositório ALPHA. Nenhuma alteração aplicada.')

patches={}
def load(path): return (root/path).read_text(encoding='utf-8')
def setfile(path,content): patches[path]=content
def replace_once(data, old, new, name):
    if data.count(old)!=1: raise RuntimeError(f'{name}: esperado 1 ocorrência, encontrado {data.count(old)} — revisão manual necessária')
    return data.replace(old,new,1)

schema=load('prisma/schema.prisma')
schema=replace_once(schema,'provider = "sqlite"','provider = "postgresql"','provider do banco')
schema=replace_once(schema,'  memberships  Membership[]\n}', '''  memberships  Membership[]
  novaSessions NovaSession[]
  novaPasswordResets NovaPasswordReset[]
}''','relacionamentos User')
schema += '''
// P09 — sessões revogáveis e recuperação. Tokens nunca são armazenados em claro.
model NovaSession {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique
  createdAt DateTime @default(now())
  expiresAt DateTime
  revokedAt DateTime?
  @@index([userId, expiresAt])
}

model NovaPasswordReset {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())
  @@index([userId, expiresAt])
}

model NovaAuthThrottle {
  key         String   @id
  attempts    Int      @default(0)
  windowStart DateTime
}
'''
setfile('prisma/schema.prisma',schema)

service=load('src/lib/nova-service.ts')
service=replace_once(service,'  await ensureBaseWorkspaces();','  // P09: usuários e ambientes agora são criados exclusivamente pelo cadastro autenticado.','remover seed automática')
service=replace_once(service,'  userId = "usr-nova-owner",','  userId: string,','remover ator padrão')
# Bloqueia provisionamento automático de um titular fictício. Remove a função exportada do runtime.
start=service.find('export async function ensureBaseWorkspaces() {')
end=service.find('/**\n * Valida acesso RBAC',start)
if start<0 or end<0: raise RuntimeError('Não foi possível localizar seed fixa no nova-service.ts')
service=service[:start]+service[end:]
setfile('src/lib/nova-service.ts',service)

api=load('src/app/api/platform/route.ts')
api=replace_once(api,'  ensureBaseWorkspaces,\n','','remover seed da rota')
api=replace_once(api,'import { prisma } from "@/lib/prisma";','import { prisma } from "@/lib/prisma";\nimport { requireSession, requireWorkspace, requireSameOrigin, AuthError } from "@/lib/nova-auth";','import auth')
api=replace_once(api,'    const { searchParams } = new URL(req.url);','''    const session = await requireSession(req);
    const { searchParams } = new URL(req.url);''','GET session')
api=replace_once(api,'    const workspaceId = searchParams.get("workspaceId") ?? undefined;','''    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) throw new AuthError('WORKSPACE_REQUIRED', 422);
    await requireWorkspace(session.userId, workspaceId, 'VIEW');''','GET workspace')
api=replace_once(api,'      { ...state, requestId },','''      { ...state, workspaces: await prisma.workspace.findMany({ where: { memberships: { some: { userId: session.userId, status: 'ACTIVE' } } } }), requestId },''','mascarar listagem workspace')
api=replace_once(api,'    await ensureBaseWorkspaces();','''    requireSameOrigin(req);
    const session = await requireSession(req);''','POST session')
api=replace_once(api,'    const actorId = "usr-nova-owner";','''    const actorId = session.userId;
    if (['RESET_TO_ZERO','LOAD_P02_FIXTURE','LOAD_P03_FIXTURE','SWITCH_ROLE','CHANGE_MEMBER_ROLE'].includes(String(action))) {
      throw new AuthError('ACTION_DISABLED', 403, 'Operação desabilitada na versão de homologação.');
    }
    if (action !== 'CREATE_WORKSPACE' && process.env.NOVA_ENABLE_FINANCIAL_WRITES !== 'true') {
      throw new AuthError('FINANCIAL_WRITES_DISABLED', 503, 'Operações financeiras bloqueadas até homologação.');
    }
    if (action !== 'CREATE_WORKSPACE') {
      if (!workspaceId) throw new AuthError('WORKSPACE_REQUIRED', 422);
      const level = ['DELETE_OR_ARCHIVE_ACCOUNT','CLEAR_INVESTMENTS'].includes(String(action)) ? 'ADMIN' : 'EDIT';
      await requireWorkspace(actorId, workspaceId, level);
    }''','POST action guard')
# Remove imports/services antigos de autorização? Local references existentes continuam válidas com actorId explícito.
# CREATE_WORKSPACE agora usa endpoint dedicado, impede operação duplicada e evita ações com identidade fixa.
api=replace_once(api,'    if (action === "CREATE_WORKSPACE") {','''    if (action === "CREATE_WORKSPACE") {
      throw new AuthError('USE_AUTH_ENDPOINT', 409, 'Use /api/auth/create-workspace.');''','desativar criação insegura')
# Captura erros de autenticação no início de catch sem expor detalhes.
needle='    if (err instanceof NovaDomainError) {'
if api.count(needle)!=2: raise RuntimeError('GET/POST catch inesperado')
api=api.replace(needle,'''    if (err instanceof AuthError) {
      return NextResponse.json({ code: err.code, message: err.message, requestId }, { status: err.status });
    }
    if (err instanceof NovaDomainError) {''',1)
# A rota tem segundo catch com NovaDomainError, adiciona tratamento também ali.
needle='    if (err instanceof NovaDomainError) {'
idx=api.find(needle,api.find('export async function POST'))
if idx<0: raise RuntimeError('POST catch inesperado')
api=api[:idx]+'''    if (err instanceof AuthError) {
      return NextResponse.json({ code: err.code, message: err.message, requestId }, { status: err.status });
    }
'''+api[idx:]
setfile('src/app/api/platform/route.ts',api)

v1=load('src/app/v1/[...slug]/route.ts')
v1=replace_once(v1,'import { NextRequest, NextResponse } from "next/server";','import { NextRequest, NextResponse } from "next/server";\nimport { requireSession, requireWorkspace, requireSameOrigin, AuthError } from "@/lib/nova-auth";','v1 auth import')
# proteger GET e POST antes de ler dados.
needle='      const workspaceId = slug[1];'
if v1.count(needle)!=2: raise RuntimeError('v1 GET/POST workspace inesperado')
v1=v1.replace(needle,'''      const workspaceId = slug[1];
      const session = await requireSession(req);
      await requireWorkspace(session.userId, workspaceId, 'VIEW');''',1)
post_at=v1.find('export async function POST')
if post_at < 0: raise RuntimeError('v1 POST não encontrado')
post=v1[post_at:]
post=replace_once(post,'  try {\n    if (slug[0] === "workspaces" && slug[1]) {','''  try {
    requireSameOrigin(req);
    if (slug[0] === "workspaces" && slug[1]) {''','v1 POST CSRF')
v1=v1[:post_at]+post
needle='      const workspaceId = slug[1];'
idx=v1.find(needle,v1.find('export async function POST'))
if idx<0: raise RuntimeError('v1 POST workspace inesperado')
v1=v1[:idx]+v1[idx:].replace(needle,'''      const workspaceId = slug[1];
      const session = await requireSession(req);
      await requireWorkspace(session.userId, workspaceId, 'VIEW');''',1)
# Nunca entregar respostas de erro internas ao cliente.
v1=v1.replace('message: err instanceof Error ? err.message : "Erro inesperado",','message: err instanceof AuthError ? err.message : "Erro ao processar a solicitação.",')
v1=v1.replace('      { status: 500 }','      { status: err instanceof AuthError ? err.status : 500 }')
setfile('src/app/v1/[...slug]/route.ts',v1)

page=load('src/app/app/[workspaceId]/[[...slug]]/page.tsx')
page=replace_once(page,'import { NovaPlatformApp, NovaRouteKey } from "@/components/NovaPlatformApp";','''import { NovaPlatformApp, NovaRouteKey } from "@/components/NovaPlatformApp";
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { tokenHash, SESSION_COOKIE } from '@/lib/nova-auth';''','page imports')
page=replace_once(page,'  const { workspaceId, slug } = await params;','''  const { workspaceId, slug } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) redirect('/entrar');
  const session = await prisma.novaSession.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: true } });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') redirect('/entrar');
  const member = await prisma.membership.findUnique({ where: { workspaceId_userId: { workspaceId, userId: session.userId } } });
  if (!member || member.status !== 'ACTIVE') redirect('/entrar');''','page server auth')
setfile('src/app/app/[workspaceId]/[[...slug]]/page.tsx',page)

pkg=json.loads(load('package.json'))
pkg['scripts']['build']='prisma generate && next build'
pkg['scripts']['db:generate']='prisma generate'
pkg['scripts']['db:deploy']='prisma migrate deploy'
pkg['scripts']['db:dev']='prisma migrate dev'
pkg['scripts']['p09:check']='node scripts/p09-check.mjs'
setfile('package.json',json.dumps(pkg,indent=2,ensure_ascii=False)+'\n')
ignore=load('.gitignore')
if '\n.env\n' not in '\n'+ignore+'\n':ignore+='\n.env\n.env.*\n!.env.example\n'
setfile('.gitignore',ignore)

# Checa TUDO antes de alterar qualquer arquivo.
for path in patches:
    if not (root/path).exists(): raise RuntimeError(f'Arquivo esperado não encontrado: {path}')
for path,contents in patches.items():
    (root/path).write_text(contents,encoding='utf-8')
for file in overlay.rglob('*'):
    if not file.is_file() or file.name == 'apply-p09.py':continue
    rel=file.relative_to(overlay)
    target=root/rel
    allowed_replacements = {'src/app/entrar/page.tsx', 'src/app/cadastro/page.tsx', 'src/app/onboarding/page.tsx', '.env.example', 'vercel.json'}
    if target.exists() and str(rel) not in patches and str(rel) not in allowed_replacements:
        raise RuntimeError(f'Conflito no arquivo novo: {rel}')
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(file,target)
print(f'Pacote 09 aplicado em {root}. Arquivos modificados: {len(patches)}. NOVOS: {len(list(overlay.rglob("*.ts")))} TypeScript.')
print('IMPORTANTE: confira git diff, remova .env do índice, crie PostgreSQL novo e NÃO publique antes dos testes.')
