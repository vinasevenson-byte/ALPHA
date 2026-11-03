import {readFile} from 'node:fs/promises';
import {join,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {parseMoney,asMoney,compute,validateISODate,safeString} from './domain.mjs';
const db=new PrismaClient();const here=dirname(fileURLToPath(import.meta.url));const publicRoot=join(here,'../../web/public');
const port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const makePassword=(password,salt=crypto.randomBytes(16).toString('hex'))=>`${salt}:${crypto.scryptSync(password,salt,64).toString('hex')}`;
const verifyPassword=(password,stored)=>{const [salt,expected]=stored.split(':');const actual=makePassword(password,salt).split(':')[1];return actual.length===expected.length&&crypto.timingSafeEqual(Buffer.from(actual),Buffer.from(expected))};
const reply=(res,status,obj,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(obj))};
const bad=(message,status=400)=>{const e=Error(message);e.status=status;throw e};
async function body(req){let parts=[],size=0;for await(const c of req){size+=c.length;if(size>32768)bad('Requisição muito grande',413);parts.push(c)}try{return JSON.parse(Buffer.concat(parts).toString())}catch{bad('JSON inválido')}}
function cookie(req){return (req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('nova_session='))?.slice(13)}
function cookieHeader(token,maxAge=604800){return `nova_session=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${maxAge}${process.env.NODE_ENV==='production'?'; Secure':''}`}
async function auth(req){const token=cookie(req);if(!token)return null;const session=await db.session.findUnique({where:{tokenHash:hash(token)},include:{user:true}});return session&&session.expiresAt>new Date()?session.user:null}
async function workspace(user,id){if(!id)bad('Informe o ambiente',400);const m=await db.membership.findUnique({where:{userId_workspaceId:{userId:user.id,workspaceId:id}},include:{workspace:true}});if(!m)bad('Acesso negado',403);return m}
function requireEdit(m){if(!['OWNER','ADMIN','EDITOR'].includes(m.role))bad('Sem permissão de escrita',403)}
async function audit(tx,w,user,action,entityId,metadata){await tx.audit.create({data:{workspaceId:w,actorId:user,action,entityId,metadata}})}
function outboundState(ws,accounts,transactions,reserves,investments,audits){const calculated=compute(accounts,transactions,reserves,ws.reconciled);return {workspace:{id:ws.id,name:ws.name,type:ws.type,reconciled:ws.reconciled},accounts:accounts.map(a=>({...a,openingCents:a.openingCents.toString()})),transactions:transactions.map(t=>({...t,signedCents:t.signedCents.toString(),date:t.date.toISOString().slice(0,10),dueDate:t.dueDate.toISOString().slice(0,10)})),reserves:reserves.map(r=>({...r,amountCents:r.amountCents.toString()})),investments:investments.map(i=>({...i,amountCents:i.amountCents.toString(),asOf:i.asOf.toISOString().slice(0,10)})),...calculated,auditCount:audits}}
async function state(w){const [ws,accounts,transactions,reserves,investments,audits]=await Promise.all([db.workspace.findUniqueOrThrow({where:{id:w}}),db.account.findMany({where:{workspaceId:w},orderBy:{createdAt:'asc'}}),db.transaction.findMany({where:{workspaceId:w},orderBy:{createdAt:'asc'}}),db.reserve.findMany({where:{workspaceId:w}}),db.investment.findMany({where:{workspaceId:w}}),db.audit.count({where:{workspaceId:w}})]);return outboundState(ws,accounts,transactions,reserves,investments,audits)}
const isMutating=m=>!['GET','HEAD','OPTIONS'].includes(m);
export async function handler(req,res){try{
 const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
 if(url.pathname.startsWith('/api/')){
  if(isMutating(req.method)){const origin=req.headers.origin;if(!origin||origin!==`${process.env.NODE_ENV==='production'?'https':'http'}://${req.headers.host}`)bad('Origem não permitida',403);if(!req.headers['content-type']?.startsWith('application/json'))bad('JSON necessário',415)}
  if(req.method==='GET'&&url.pathname==='/api/health')return reply(res,200,{status:'ok'});
  if(req.method==='POST'&&url.pathname==='/api/auth/register'){
   const b=await body(req),name=safeString(b.name),email=safeString(b.email,254).toLowerCase();if(!/^\S+@\S+\.\S+$/.test(email))bad('E-mail inválido');if(typeof b.password!=='string'||b.password.length<12||b.password.length>256)bad('Senha deve ter entre 12 e 256 caracteres');
   const exists=await db.user.findUnique({where:{email}});if(exists)bad('Cadastro não permitido',409);
   const user=await db.$transaction(async tx=>{const u=await tx.user.create({data:{name,email,passwordHash:makePassword(b.password)}});for(const [type,n] of [['PERSONAL','Meu Financeiro'],['BUSINESS','Minha Empresa']]){const w=await tx.workspace.create({data:{name:n,type,ownerId:u.id}});await tx.membership.create({data:{userId:u.id,workspaceId:w.id,role:'OWNER'}})}return u});
   const token=crypto.randomBytes(32).toString('hex');await db.session.create({data:{userId:user.id,tokenHash:hash(token),expiresAt:new Date(Date.now()+7*86400000)}});return reply(res,201,{name:user.name}, {'Set-Cookie':cookieHeader(token)});
  }
  if(req.method==='POST'&&url.pathname==='/api/auth/login'){
   const b=await body(req),user=await db.user.findUnique({where:{email:String(b.email||'').toLowerCase()}});if(!user||typeof b.password!=='string'||!verifyPassword(b.password,user.passwordHash))bad('Credenciais inválidas',401);
   const token=crypto.randomBytes(32).toString('hex');await db.session.create({data:{userId:user.id,tokenHash:hash(token),expiresAt:new Date(Date.now()+7*86400000)}});return reply(res,200,{name:user.name},{'Set-Cookie':cookieHeader(token)});
  }
  const user=await auth(req);if(!user)bad('Autenticação necessária',401);
  if(req.method==='GET'&&url.pathname==='/api/auth/me'){const memberships=await db.membership.findMany({where:{userId:user.id},include:{workspace:true}});return reply(res,200,{id:user.id,name:user.name,email:user.email,workspaces:memberships.map(m=>({...m.workspace,role:m.role}))})}
  if(req.method==='POST'&&url.pathname==='/api/auth/logout'){const token=cookie(req);if(token)await db.session.deleteMany({where:{tokenHash:hash(token)}});return reply(res,200,{ok:true},{'Set-Cookie':cookieHeader('',0)})}
  const w=url.searchParams.get('workspace');const m=await workspace(user,w);if(req.method==='GET'&&url.pathname==='/api/state')return reply(res,200,await state(w));
  if(req.method!=='POST')bad('Rota não encontrada',404);requireEdit(m);
  const b=await body(req);const key=req.headers['idempotency-key'];if(typeof key!=='string'||key.length<16||key.length>128)bad('Idempotency-Key obrigatória');
  const payloadHash=hash(JSON.stringify({path:url.pathname,body:b}));
  const result=await db.$transaction(async tx=>{
   // Serializable + unique idempotency protects against duplicate financial operations.
   const previous=await tx.idempotencyKey.findUnique({where:{workspaceId_key:{workspaceId:w,key}}});if(previous){if(previous.payloadHash!==payloadHash)bad('Chave reutilizada com conteúdo diferente',409);return previous.responseJson}
   let entity=null,action='';const dt=validateISODate(b.date||new Date().toISOString().slice(0,10));
   if(url.pathname==='/api/accounts') {entity=await tx.account.create({data:{workspaceId:w,name:safeString(b.name)}});action='ACCOUNT_CREATED'}
   else if(url.pathname==='/api/transactions'){
    if(!['INCOME','EXPENSE'].includes(b.kind))bad('Tipo inválido');const acc=await tx.account.findFirst({where:{id:b.accountId,workspaceId:w}});if(!acc)bad('Conta inexistente',404);const v=parseMoney(b.amount);entity=await tx.transaction.create({data:{workspaceId:w,accountId:acc.id,kind:b.kind,status:b.pending===true?'PENDING':'SETTLED',signedCents:b.kind==='EXPENSE'?-v:v,date:dt,dueDate:dt,description:safeString(b.description,240),settledAt:b.pending===true?null:new Date()}});action='TRANSACTION_CREATED'
   }
   else if(url.pathname==='/api/transfer'){
    if(b.from===b.to)bad('Contas devem ser diferentes');const acc=await tx.account.findMany({where:{id:{in:[b.from,b.to]},workspaceId:w}});if(acc.length!==2)bad('Contas inválidas');const v=parseMoney(b.amount),group=crypto.randomUUID();await tx.transaction.createMany({data:[{workspaceId:w,accountId:b.from,kind:'TRANSFER_OUT',status:'SETTLED',signedCents:-v,date:dt,dueDate:dt,description:'Transferência interna',transferGroup:group,settledAt:new Date()},{workspaceId:w,accountId:b.to,kind:'TRANSFER_IN',status:'SETTLED',signedCents:v,date:dt,dueDate:dt,description:'Transferência interna',transferGroup:group,settledAt:new Date()}]});entity={id:group};action='TRANSFER_CREATED'
   }
   else if(url.pathname==='/api/settle'){
    const updated=await tx.transaction.updateMany({where:{id:b.id,workspaceId:w,status:'PENDING'},data:{status:'SETTLED',settledAt:new Date()}});if(updated.count!==1)bad('Compromisso não encontrado ou já liquidado',409);entity={id:b.id};action='TRANSACTION_SETTLED'
   }
   else if(url.pathname==='/api/reserves') {entity=await tx.reserve.create({data:{workspaceId:w,name:safeString(b.name),amountCents:parseMoney(b.amount)}});action='RESERVE_CREATED'}
   else if(url.pathname==='/api/investments'){entity=await tx.investment.create({data:{workspaceId:w,name:safeString(b.name),amountCents:parseMoney(b.amount),asOf:dt,source:'MANUAL'}});action='INVESTMENT_RECORDED'}
   else if(url.pathname==='/api/reconcile'){if(typeof b.reconciled!=='boolean')bad('Valor inválido');entity=await tx.workspace.update({where:{id:w},data:{reconciled:b.reconciled}});action='RECONCILIATION_DECLARED'}
   else bad('Rota não encontrada',404);
   await audit(tx,w,user.id,action,entity.id,{source:'NOVA_V6'});const response={ok:true,operation:action,entityId:entity.id};await tx.idempotencyKey.create({data:{workspaceId:w,key,operation:action,payloadHash,responseJson:response}});return response;
  },{isolationLevel:'Serializable',maxWait:5000,timeout:10000});return reply(res,200,{...result,state:await state(w)});
 }
 if(req.method!=='GET')bad('Método não permitido',405);const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/styles.css':'styles.css'};if(!files[url.pathname])bad('Não encontrado',404);const file=join(publicRoot,files[url.pathname]);const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css'}[extname(file)];res.writeHead(200,{'Content-Type':`${mime}; charset=utf-8`,'Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'"});res.end(await readFile(file));
 }catch(e){if(e?.code==='P2002')return reply(res,409,{error:'Operação duplicada ou cadastro existente'});if(e?.code==='P2034')return reply(res,409,{error:'Conflito de concorrência; repita a operação com a mesma chave'});reply(res,e.status||500,{error:e.status?e.message:'Erro inesperado; consulte os logs do servidor'});if(!e.status)console.error(e)}}

