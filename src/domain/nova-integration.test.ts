import { describe, expect, it } from "vitest";
import {
  authorizeWorkspaceAccess,
  ensureBaseWorkspaces,
  getWorkspaceFullState,
} from "@/lib/nova-service";
import { prisma } from "@/lib/prisma";

describe("NOVA P01 & P02 — Integração com Banco de Dados e RBAC", () => {
  it("Inicializa workspaces PF e PJ em estado zero (R$ 0,00) sem lançamentos fictícios", async () => {
    await ensureBaseWorkspaces();
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
    await ensureBaseWorkspaces();

    await expect(
      authorizeWorkspaceAccess("ws-nova-pf", "usuario-inexistente", "VIEW")
    ).rejects.toThrow("Acesso negado a este workspace.");

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
