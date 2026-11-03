import { describe, expect, it } from "vitest";
import {
  cents,
  money,
  balance,
  summary,
  projection,
  capacity,
} from "./canonical-core";

describe("NOVA — Pacote 05 (v5.0.0): Núcleo Financeiro Canônico (BigInt)", () => {
  it("centavos exatos sem ponto flutuante", () => {
    expect(cents("123.45")).toBe(12345n);
    expect(money(12345n)).toBe("123.45");
    expect(() => cents("1.234")).toThrow();
  });

  it("transferência interna mantém saldo consolidado e não cria receita", () => {
    const a = [
      { id: "a", workspaceId: "pessoal", openingCents: "0" },
      { id: "b", workspaceId: "pessoal", openingCents: "0" },
    ];
    const t = [
      {
        workspaceId: "pessoal",
        accountId: "a",
        status: "SETTLED",
        kind: "TRANSFER_OUT",
        signedCents: "-10000",
        dueDate: "2026-11-02",
      },
      {
        workspaceId: "pessoal",
        accountId: "b",
        status: "SETTLED",
        kind: "TRANSFER_IN",
        signedCents: "10000",
        dueDate: "2026-11-02",
      },
    ];
    expect(summary(a, t, "pessoal").balance).toBe("0.00");
    expect(summary(a, t, "pessoal").income).toBe("0.00");
    expect(balance(a[0], t)).toBe(-10000n);
    expect(balance(a[1], t)).toBe(10000n);
  });

  it("pendentes não entram em saldo realizado, apenas na projeção", () => {
    const a = [{ id: "a", workspaceId: "pessoal", openingCents: "10000" }];
    const t = [
      {
        accountId: "a",
        workspaceId: "pessoal",
        status: "PENDING",
        signedCents: "-2500",
        dueDate: "2026-11-08",
      },
    ];
    expect(summary(a, t, "pessoal").balance).toBe("100.00");
    expect(projection(a, t, "pessoal").closing).toBe("75.00");
    expect(projection(a, t, "pessoal").minimum).toBe("75.00");
  });

  it("workspaces não se misturam", () => {
    const a = [
      { id: "a", workspaceId: "pessoal", openingCents: "600" },
      { id: "b", workspaceId: "empresa", openingCents: "9500" },
    ];
    expect(summary(a, [], "pessoal").balance).toBe("6.00");
    expect(summary(a, [], "empresa").balance).toBe("95.00");
  });

  it("capacidade conservadora exige conciliação declarada", () => {
    expect(capacity("7000", "2000", "1000", true)).toBe("40.00");
    expect(capacity("7000", "2000", "1000", false)).toBeNull();
  });
});
