import { describe, expect, it } from "vitest";
import {
  asMoney,
  compute,
  hashToken,
  makePassword,
  parseMoney,
  safeString,
  validateISODate,
  verifyPassword,
} from "./pacote06";

describe("NOVA Pacote 06 — Consolidação Operacional e Domínio", () => {
  it("precisão decimal estrita em centavos BigInt", () => {
    expect(parseMoney("100.05")).toBe(10005n);
    expect(asMoney(10005n)).toBe("100.05");
    expect(asMoney(-5000n)).toBe("-50.00");
    expect(() => parseMoney("0.001")).toThrow();
    expect(() => parseMoney("1e5")).toThrow();
    expect(() => parseMoney("0.00")).toThrow();
  });

  it("transferência interna não aumenta receitas nem despesas", () => {
    const accounts = [{ openingCents: 10000n }, { openingCents: 0n }];
    const txs = [
      { status: "SETTLED", kind: "TRANSFER_OUT", signedCents: -5000n, dueDate: "2026-11-02" },
      { status: "SETTLED", kind: "TRANSFER_IN", signedCents: 5000n, dueDate: "2026-11-02" },
    ];
    const r = compute(accounts, txs);
    expect(r.summary.balance).toBe("100.00");
    expect(r.summary.income).toBe("0.00");
    expect(r.summary.expense).toBe("0.00");
  });

  it("pendências não alteram saldo liquidado, apenas projeção", () => {
    const r = compute(
      [{ openingCents: 10000n }],
      [
        {
          status: "PENDING",
          kind: "EXPENSE",
          signedCents: -15000n,
          dueDate: "2026-12-01",
        },
      ]
    );
    expect(r.summary.balance).toBe("100.00");
    expect(r.projection.minimum).toBe("-50.00");
    expect(r.projection.closing).toBe("-50.00");
  });

  it("reserva é alocação virtual, não despesa, e exige conciliação", () => {
    const blocked = compute(
      [{ openingCents: 10000n }],
      [],
      [{ amountCents: 3000n }],
      false
    );
    expect(blocked.capacity).toBeNull();

    const released = compute(
      [{ openingCents: 10000n }],
      [],
      [{ amountCents: 3000n }],
      true
    );
    expect(released.summary.balance).toBe("100.00");
    expect(released.capacity).toBe("70.00");
  });

  it("validação de data ISO e string segura", () => {
    expect(() => validateISODate("2026-02-30")).toThrow();
    expect(validateISODate("2026-11-02").toISOString().slice(0, 10)).toBe(
      "2026-11-02"
    );
    expect(safeString("  Conta Principal  ")).toBe("Conta Principal");
    expect(() => safeString("   ")).toThrow();
  });

  it("hash scrypt com salt e verificação timingSafeEqual", () => {
    const hash = makePassword("Nova@Segura#2026!orte");
    expect(verifyPassword("Nova@Segura#2026!orte", hash)).toBe(true);
    expect(verifyPassword("SenhaIncorreta123", hash)).toBe(false);
    expect(hashToken("abc").length).toBe(64);
  });
});
