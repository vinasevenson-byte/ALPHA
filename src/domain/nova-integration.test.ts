import { describe, expect, it } from "vitest";
import {
  authorizeWorkspaceAccess,
  getWorkspaceFullState,
} from "@/lib/nova-service";
import { hashPassword, verifyPassword, requireWorkspace } from "@/lib/nova-auth";
import { prisma } from "@/lib/prisma";

async function seedTestUserAndWorkspaces() {
  const passwordHash = await hashPassword("Nova@Segura#2026");
  const user = await prisma.user.upsert({
    where: { email: "titular@nova.fin.br" },
    update: { passwordHash, status: "ACTIVE" },
    create: {
      id: "usr-nova-owner",
      email: "titular@nova.fin.br",
      passwordHash,
      name: "Vinícius (Titular)",
      status: "ACTIVE",
    },
  });

  await prisma.workspace.upsert({
    where: { id: "ws-nova-pf" },
    update: {},
    create: {
      id: "ws-nova-pf",
      type: "PERSONAL",
      name: "Meu Financeiro Pessoal",
      baseCurrency: "BRL",
      timezone: "America/Sao_Paulo",
      safetyBufferCents: 0,
      version: 1,
    },
  });

  await prisma.workspace.upsert({
    where: { id: "ws-nova-pj" },
    update: {},
    create: {
      id: "ws-nova-pj",
      type: "BUSINESS",
      name: "NOVA Empresa Ltda",
      baseCurrency: "BRL",
      timezone: "America/Sao_Paulo",
      safetyBufferCents: 0,
      version: 1,
    },
  });

  await prisma.membership.upsert({
    where: { workspaceId_userId: { workspaceId: "ws-nova-pf", userId: user.id } },
    update: { role: "OWNER", status: "ACTIVE" },
    create: { workspaceId: "ws-nova-pf", userId: user.id, role: "OWNER", status: "ACTIVE" },
  });

  await prisma.membership.upsert({
    where: { workspaceId_userId: { workspaceId: "ws-nova-pj", userId: user.id } },
    update: { role: "OWNER", status: "ACTIVE" },
    create: { workspaceId: "ws-nova-pj", userId: user.id, role: "OWNER", status: "ACTIVE" },
  });
}

describe("NOVA P01, P02 & P09 — Integração com Banco de Dados, Auth Scrypt e RBAC", () => {
  it("Valida hash scrypt de senha e inicializa workspaces PF e PJ em estado zero (R$ 0,00) sem lançamentos fictícios", async () => {
    await seedTestUserAndWorkspaces();
    const h = await hashPassword("Nova@Segura#2026");
    expect(await verifyPassword("Nova@Segura#2026", h)).toBe(true);
    expect(await verifyPassword("SenhaErrada#2026", h)).toBe(false);

    const statePF = await getWorkspaceFullState({ workspaceId: "ws-nova-pf" });
    expect(statePF.activeWorkspace.type).toBe("PERSONAL");
    expect(statePF.kpis.eligibleBalanceCents).toBe(0);
    expect(statePF.kpis.settledIncomeCents).toBe(0);
    expect(statePF.kpis.settledExpenseCents).toBe(0);

    const statePJ = await getWorkspaceFullState({ workspaceId: "ws-nova-pj" });
    expect(statePJ.activeWorkspace.type).toBe("BUSINESS");
    expect(statePJ.kpis.eligibleBalanceCents).toBe(0);
  });

  it("Bloqueia escrita quando papel é VIEWER (403 WORKSPACE_FORBIDDEN) e bloqueia usuário sem vínculo", async () => {
    await seedTestUserAndWorkspaces();

    await expect(
      authorizeWorkspaceAccess("ws-nova-pf", "usuario-inexistente", "VIEW")
    ).rejects.toThrow("Acesso negado a este workspace.");

    await expect(
      requireWorkspace("usuario-inexistente", "ws-nova-pf", "VIEW")
    ).rejects.toThrow("Você não tem acesso a este ambiente.");

    await prisma.membership.update({
      where: {
        workspaceId_userId: {
          workspaceId: "ws-nova-pf",
          userId: "usr-nova-owner",
        },
      },
      data: { role: "VIEWER" },
    });

    await expect(
      authorizeWorkspaceAccess("ws-nova-pf", "usr-nova-owner", "EDIT")
    ).rejects.toThrow(/VIEWER/);

    await expect(
      requireWorkspace("usr-nova-owner", "ws-nova-pf", "EDIT")
    ).rejects.toThrow();

    // Restaura OWNER
    await prisma.membership.update({
      where: {
        workspaceId_userId: {
          workspaceId: "ws-nova-pf",
          userId: "usr-nova-owner",
        },
      },
      data: { role: "OWNER" },
    });
  });
});
