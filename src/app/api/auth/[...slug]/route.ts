import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ensureBaseWorkspaces } from "@/lib/nova-service";
import {
  hashToken,
  makePassword,
  safeString,
  verifyPassword,
} from "@/domain/pacote06";

function getCookieToken(req: NextRequest): string | null {
  return req.cookies.get("nova_session")?.value ?? null;
}

function buildSessionCookieHeader(token: string, maxAge = 604800): string {
  return `nova_session=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${maxAge}${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}

async function resolveAuthenticatedUser(req: NextRequest) {
  const token = getCookieToken(req);
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date()) {
    return null;
  }
  return session.user;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  const action = slug[0];

  if (action === "me") {
    await ensureBaseWorkspaces();
    const user = await resolveAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "Autenticação necessária" },
        { status: 401 }
      );
    }
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      include: { workspace: true },
    });
    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      workspaces: memberships.map((m) => ({
        ...m.workspace,
        role: m.role,
      })),
    });
  }

  return NextResponse.json({ error: "Rota não encontrada" }, { status: 404 });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  const action = slug[0];

  try {
    await ensureBaseWorkspaces();

    if (action === "register") {
      const b = await req.json();
      const name = safeString(b.name);
      const email = safeString(b.email, 254).toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
      }
      if (
        typeof b.password !== "string" ||
        b.password.length < 12 ||
        b.password.length > 256
      ) {
        return NextResponse.json(
          { error: "Senha deve ter entre 12 e 256 caracteres" },
          { status: 400 }
        );
      }

      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists) {
        return NextResponse.json(
          { error: "Cadastro não permitido" },
          { status: 409 }
        );
      }

      const created = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            name,
            email,
            passwordHash: makePassword(b.password),
          },
        });
        const createdWorkspaces = [];
        for (const [type, wsName] of [
          ["PERSONAL", "Meu Financeiro"],
          ["BUSINESS", "Minha Empresa"],
        ] as const) {
          const w = await tx.workspace.create({
            data: { name: wsName, type, ownerId: u.id },
          });
          await tx.membership.create({
            data: { userId: u.id, workspaceId: w.id, role: "OWNER" },
          });
          createdWorkspaces.push(w);
        }
        return { user: u, workspaces: createdWorkspaces };
      });

      const token = crypto.randomBytes(32).toString("hex");
      await prisma.session.create({
        data: {
          userId: created.user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
      });

      return NextResponse.json(
        {
          name: created.user.name,
          workspaces: created.workspaces,
        },
        {
          status: 201,
          headers: { "Set-Cookie": buildSessionCookieHeader(token) },
        }
      );
    }

    if (action === "login") {
      const b = await req.json();
      const email = String(b.email || "").toLowerCase();
      const user = await prisma.user.findUnique({ where: { email } });
      if (
        !user ||
        typeof b.password !== "string" ||
        !verifyPassword(b.password, user.passwordHash)
      ) {
        return NextResponse.json(
          { error: "Credenciais inválidas" },
          { status: 401 }
        );
      }

      const token = crypto.randomBytes(32).toString("hex");
      await prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
      });

      const memberships = await prisma.membership.findMany({
        where: { userId: user.id },
        include: { workspace: true },
      });

      return NextResponse.json(
        {
          name: user.name,
          workspaces: memberships.map((m) => m.workspace),
        },
        {
          status: 200,
          headers: { "Set-Cookie": buildSessionCookieHeader(token) },
        }
      );
    }

    if (action === "logout") {
      const token = getCookieToken(req);
      if (token) {
        await prisma.session.deleteMany({
          where: { tokenHash: hashToken(token) },
        });
      }
      return NextResponse.json(
        { ok: true },
        {
          status: 200,
          headers: { "Set-Cookie": buildSessionCookieHeader("", 0) },
        }
      );
    }

    return NextResponse.json({ error: "Rota não encontrada" }, { status: 404 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
