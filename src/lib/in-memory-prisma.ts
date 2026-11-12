import { randomUUID, scryptSync } from "node:crypto";

type Row = Record<string, any>;

const ADMIN_SALT_HEX = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const ADMIN_SCRYPT_HEX = scryptSync(
  "admin",
  Buffer.from(ADMIN_SALT_HEX, "hex"),
  64
).toString("hex");
export const DEFAULT_ADMIN_PASSWORD_HASH = `scrypt$${ADMIN_SALT_HEX}$${ADMIN_SCRYPT_HEX}`;
export const DEFAULT_ADMIN_USER_ID = "usr-nova-admin";
export const DEFAULT_ADMIN_EMAIL = "admin@nova.local";
export const DEFAULT_PERSONAL_WORKSPACE_ID = "ws-admin-personal";
export const DEFAULT_BUSINESS_WORKSPACE_ID = "ws-admin-business";

const MODEL_NAMES = [
  "user",
  "session",
  "workspace",
  "membership",
  "account",
  "category",
  "counterparty",
  "transaction",
  "reserve",
  "investment",
  "audit",
  "idempotencyKey",
  "recurrence",
  "budget",
  "novaObligation",
  "novaInstallment",
  "novaSettlement",
  "novaReserve",
  "novaReserveMovement",
  "novaGoal",
  "novaPlanningScenario",
  "novaAlert",
  "auditEvent",
  "novaInvestmentPosition",
  "financialConnection",
  "importBatch",
  "importedExternalTransaction",
  "financialInsight",
  "financialNotificationPreference",
  "financialConsentAudit",
  "novaSession",
  "novaPasswordReset",
  "novaAuthThrottle",
] as const;

type ModelName = (typeof MODEL_NAMES)[number];
type StoreTables = Record<ModelName, Row[]>;

const COMPOUND_UNIQUES: Record<string, Record<string, string[]>> = {
  membership: {
    workspaceId_userId: ["workspaceId", "userId"],
    userId_workspaceId: ["userId", "workspaceId"],
  },
  transaction: {
    workspaceId_idempotencyKey: ["workspaceId", "idempotencyKey"],
  },
  idempotencyKey: {
    workspaceId_key: ["workspaceId", "key"],
  },
  novaInstallment: {
    obligationId_number: ["obligationId", "number"],
  },
  novaSettlement: {
    workspaceId_idempotencyKey: ["workspaceId", "idempotencyKey"],
  },
  novaReserveMovement: {
    workspaceId_idempotencyKey_kind: ["workspaceId", "idempotencyKey", "kind"],
  },
  novaAlert: {
    workspaceId_fingerprint: ["workspaceId", "fingerprint"],
  },
  financialConnection: {
    workspaceId_providerCode_id: ["workspaceId", "providerCode", "id"],
  },
  importedExternalTransaction: {
    workspaceId_providerId_accountExternalId_externalId: [
      "workspaceId",
      "providerId",
      "accountExternalId",
      "externalId",
    ],
  },
  financialInsight: {
    workspaceId_dedupeKey: ["workspaceId", "dedupeKey"],
  },
  financialNotificationPreference: {
    workspaceId_userId_channel_eventType: [
      "workspaceId",
      "userId",
      "channel",
      "eventType",
    ],
  },
};

function applyDefaults(model: ModelName, input: Row): Row {
  const now = new Date();
  const base: Row = { ...input };

  if (model === "novaAuthThrottle") {
    return {
      attempts: 0,
      windowStart: now,
      windowEndsAt: null,
      blockedUntil: null,
      updatedAt: now,
      ...base,
    };
  }

  if (!base.id) base.id = randomUUID();

  switch (model) {
    case "user":
      return { status: "ACTIVE", createdAt: now, ...base };
    case "session":
      return { createdAt: now, ...base };
    case "workspace":
      return {
        ownerId: DEFAULT_ADMIN_USER_ID,
        baseCurrency: "BRL",
        timezone: "America/Sao_Paulo",
        safetyBufferCents: 0,
        reconciled: false,
        version: 1,
        createdAt: now,
        updatedAt: now,
        ...base,
      };
    case "membership":
      return { role: "OWNER", status: "ACTIVE", createdAt: now, ...base };
    case "account":
      return {
        type: "CHECKING",
        institution: null,
        currency: "BRL",
        openingBalanceCents: 0,
        openingCents: BigInt(0),
        openingBalanceDate: "2026-01-01",
        status: "ACTIVE",
        createdAt: now,
        ...base,
      };
    case "category":
      return {
        isEssential: true,
        parentId: null,
        archivedAt: null,
        createdAt: now,
        ...base,
      };
    case "counterparty":
      return {
        type: "COMPANY",
        document: null,
        costCenter: null,
        createdAt: now,
        ...base,
      };
    case "transaction":
      return {
        categoryId: null,
        counterpartyId: null,
        costCenter: null,
        amountCents: 0,
        signedCents: BigInt(0),
        signedAdjustDir: 1,
        date: now,
        dueDate: now,
        occurredOn: "2026-01-01",
        dueOn: null,
        settledOn: null,
        settledAt: null,
        cancelReason: null,
        transferGroup: null,
        transferGroupId: null,
        createdBy: "system",
        version: 1,
        idempotencyKey: randomUUID(),
        createdAt: now,
        updatedAt: now,
        ...base,
      };
    case "reserve":
      return { createdAt: now, ...base };
    case "investment":
      return { source: "MANUAL", createdAt: now, ...base };
    case "audit":
      return { entityId: null, metadata: null, at: now, ...base };
    case "idempotencyKey":
      return { createdAt: now, ...base };
    case "recurrence":
      return {
        categoryId: null,
        periodicity: "MONTHLY",
        endDate: null,
        active: true,
        createdAt: now,
        ...base,
      };
    case "budget":
      return {
        categoryId: null,
        costCenter: null,
        warnOnly: true,
        carryOver: false,
        thresholdWarnPct: 70,
        thresholdCritPct: 90,
        createdAt: now,
        updatedAt: now,
        ...base,
      };
    case "novaObligation":
      return {
        categoryId: null,
        categoryName: null,
        counterpartyId: null,
        counterparty: null,
        costCenter: null,
        status: "ACTIVE",
        cancelReason: null,
        confidence: "HIGH",
        version: 1,
        createdAt: now,
        updatedAt: now,
        ...base,
      };
    case "novaInstallment":
      return {
        status: "OPEN",
        sourceTransactionId: null,
        createdAt: now,
        updatedAt: now,
        ...base,
      };
    case "novaSettlement":
      return { note: null, createdAt: now, ...base };
    case "novaReserve":
      return {
        kind: "GENERAL",
        status: "ACTIVE",
        targetAmountCents: null,
        targetOn: null,
        priority: 3,
        version: 1,
        createdAt: now,
        updatedAt: now,
        ...base,
      };
    case "novaReserveMovement":
      return {
        transferGroupId: null,
        reason: null,
        createdAt: now,
        ...base,
      };
    case "novaGoal":
      return {
        reserveId: null,
        targetOn: null,
        priority: 3,
        status: "ACTIVE",
        version: 1,
        createdAt: now,
        updatedAt: now,
        ...base,
      };
    case "novaPlanningScenario":
      return {
        contingencyBufferPct: 0,
        hypotheticalInflowCents: 0,
        hypotheticalOutflowCents: 0,
        notes: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
        ...base,
      };
    case "novaAlert":
      return {
        sourceRef: null,
        state: "NEW",
        resolvedAt: null,
        createdAt: now,
        updatedAt: now,
        ...base,
      };
    case "auditEvent":
      return { timestamp: now, ...base };
    case "novaInvestmentPosition":
      return {
        indexer: "CDI",
        daysHeld: 365,
        fgcEligible: false,
        quoteStatus: "VALID",
        createdAt: now,
        updatedAt: now,
        ...base,
      };
    case "financialConnection":
      return {
        status: "DISCONNECTED",
        consentId: null,
        consentScopes: null,
        consentExpiresAt: null,
        lastSyncAt: null,
        lastErrorCode: null,
        createdAt: now,
        updatedAt: now,
        ...base,
      };
    case "importBatch":
      return {
        connectionId: null,
        fileName: "extrato.csv",
        state: "REVIEWING",
        createdAt: now,
        committedAt: null,
        ...base,
      };
    case "importedExternalTransaction":
      return {
        state: "STAGED",
        matchedLedgerEntryId: null,
        createdAt: now,
        ...base,
      };
    case "financialInsight":
      return {
        state: "NEW",
        asOf: now,
        sourceVersion: "4.0.0",
        createdAt: now,
        ...base,
      };
    case "financialNotificationPreference":
      return { enabled: false, updatedAt: now, ...base };
    case "financialConsentAudit":
      return { eventAt: now, ...base };
    case "novaSession":
      return {
        createdAt: now,
        lastSeenAt: now,
        revokedAt: null,
        userAgent: null,
        ipHash: null,
        ...base,
      };
    case "novaPasswordReset":
      return { usedAt: null, createdAt: now, ...base };
    default:
      return base;
  }
}

function seedDefaultAdminStore(tables: StoreTables): void {
  const createdAt = new Date("2026-01-01T00:00:00.000Z");

  tables.user.push({
    id: DEFAULT_ADMIN_USER_ID,
    email: DEFAULT_ADMIN_EMAIL,
    passwordHash: DEFAULT_ADMIN_PASSWORD_HASH,
    name: "Administrador NOVA",
    status: "ACTIVE",
    createdAt,
  });

  const workspaces: Array<{ id: string; type: "PERSONAL" | "BUSINESS"; name: string }> = [
    {
      id: DEFAULT_PERSONAL_WORKSPACE_ID,
      type: "PERSONAL",
      name: "Meu Financeiro Pessoal",
    },
    {
      id: DEFAULT_BUSINESS_WORKSPACE_ID,
      type: "BUSINESS",
      name: "Minha Empresa",
    },
  ];

  for (const ws of workspaces) {
    tables.workspace.push(
      applyDefaults("workspace", {
        id: ws.id,
        type: ws.type,
        name: ws.name,
        ownerId: DEFAULT_ADMIN_USER_ID,
        createdAt,
        updatedAt: createdAt,
      })
    );

    tables.membership.push(
      applyDefaults("membership", {
        id: `mbr-${ws.id}`,
        workspaceId: ws.id,
        userId: DEFAULT_ADMIN_USER_ID,
        role: "OWNER",
        status: "ACTIVE",
        createdAt,
      })
    );

    const scenarios = [
      {
        id: `scn-base-${ws.id}`,
        workspaceId: ws.id,
        name: "Cenário Base (Confirmado)",
        kind: "BASE",
        contingencyBufferPct: 0,
        hypotheticalInflowCents: 0,
        hypotheticalOutflowCents: 0,
        notes: "Projeção oficial com compromissos registrados sem gordura extra.",
        createdBy: DEFAULT_ADMIN_USER_ID,
      },
      {
        id: `scn-cons-${ws.id}`,
        workspaceId: ws.id,
        name: "Cenário Conservador (+10% Saídas)",
        kind: "CONSERVATIVE",
        contingencyBufferPct: 10,
        hypotheticalInflowCents: 0,
        hypotheticalOutflowCents: 0,
        notes:
          "Adiciona margem de contingência sobre despesas pendentes e ignora recebíveis incertos.",
        createdBy: DEFAULT_ADMIN_USER_ID,
      },
      {
        id: `scn-opt-${ws.id}`,
        workspaceId: ws.id,
        name: "Cenário Otimista",
        kind: "OPTIMISTIC",
        contingencyBufferPct: 0,
        hypotheticalInflowCents: 0,
        hypotheticalOutflowCents: 0,
        notes: "Considera 100% dos recebíveis previstos na data original.",
        createdBy: DEFAULT_ADMIN_USER_ID,
      },
    ];
    for (const s of scenarios) {
      tables.novaPlanningScenario.push(applyDefaults("novaPlanningScenario", s));
    }

    const categories =
      ws.type === "BUSINESS"
        ? [
            { type: "INCOME", name: "Receita Operacional / Vendas", isEssential: true },
            { type: "INCOME", name: "Serviços & Contratos", isEssential: true },
            { type: "EXPENSE", name: "Folha & Pró-Labore", isEssential: true },
            { type: "EXPENSE", name: "Impostos & Tributos", isEssential: true },
            { type: "EXPENSE", name: "Infraestrutura & SaaS", isEssential: true },
            { type: "EXPENSE", name: "Marketing & Comercial", isEssential: false },
          ]
        : [
            { type: "INCOME", name: "Salário / Pró-Labore", isEssential: true },
            { type: "INCOME", name: "Renda Extra / Dividendos", isEssential: false },
            { type: "EXPENSE", name: "Moradia & Contas Fixas", isEssential: true },
            { type: "EXPENSE", name: "Alimentação & Saúde", isEssential: true },
            { type: "EXPENSE", name: "Transporte & Educação", isEssential: true },
            { type: "EXPENSE", name: "Lazer & Estilo de Vida", isEssential: false },
          ];

    categories.forEach((c, idx) => {
      tables.category.push(
        applyDefaults("category", {
          id: `cat-${ws.id}-${idx + 1}`,
          workspaceId: ws.id,
          ...c,
          createdAt,
        })
      );
    });
  }
}

function comparePrimitive(a: any, b: any): number {
  if (a === b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (a instanceof Date) return a.getTime() - new Date(b).getTime();
  if (b instanceof Date) return new Date(a).getTime() - b.getTime();
  if (typeof a === "bigint" || typeof b === "bigint") {
    const ba = BigInt(a);
    const bb = BigInt(b);
    return ba < bb ? -1 : ba > bb ? 1 : 0;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

function normalizeWhere(model: ModelName, where?: Row): Row | undefined {
  if (!where) return undefined;
  const compounds = COMPOUND_UNIQUES[model];
  if (!compounds) return where;
  const out: Row = {};
  for (const [k, v] of Object.entries(where)) {
    if (v !== undefined && compounds[k] && typeof v === "object" && v !== null) {
      for (const field of compounds[k]) {
        out[field] = v[field];
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}

function getRelatedRows(
  tables: StoreTables,
  model: ModelName,
  row: Row,
  relKey: string
): { targetModel: ModelName; many: boolean; items: Row[] | Row | null } | null {
  if (model === "novaSession" && relKey === "user") {
    return {
      targetModel: "user",
      many: false,
      items: tables.user.find((u) => u.id === row.userId) ?? null,
    };
  }
  if (model === "session" && relKey === "user") {
    return {
      targetModel: "user",
      many: false,
      items: tables.user.find((u) => u.id === row.userId) ?? null,
    };
  }
  if (model === "membership" && relKey === "user") {
    return {
      targetModel: "user",
      many: false,
      items: tables.user.find((u) => u.id === row.userId) ?? null,
    };
  }
  if (model === "membership" && relKey === "workspace") {
    return {
      targetModel: "workspace",
      many: false,
      items: tables.workspace.find((w) => w.id === row.workspaceId) ?? null,
    };
  }
  if (model === "workspace" && relKey === "memberships") {
    return {
      targetModel: "membership",
      many: true,
      items: tables.membership.filter((m) => m.workspaceId === row.id),
    };
  }
  if (model === "transaction" && relKey === "account") {
    return {
      targetModel: "account",
      many: false,
      items: tables.account.find((a) => a.id === row.accountId) ?? null,
    };
  }
  if (model === "novaObligation" && relKey === "installments") {
    return {
      targetModel: "novaInstallment",
      many: true,
      items: tables.novaInstallment.filter((i) => i.obligationId === row.id),
    };
  }
  if (model === "novaInstallment" && relKey === "settlements") {
    return {
      targetModel: "novaSettlement",
      many: true,
      items: tables.novaSettlement.filter((s) => s.installmentId === row.id),
    };
  }
  if (model === "novaInstallment" && relKey === "obligation") {
    return {
      targetModel: "novaObligation",
      many: false,
      items: tables.novaObligation.find((o) => o.id === row.obligationId) ?? null,
    };
  }
  if (model === "novaReserve" && relKey === "movements") {
    return {
      targetModel: "novaReserveMovement",
      many: true,
      items: tables.novaReserveMovement.filter((m) => m.reserveId === row.id),
    };
  }
  if (model === "novaReserve" && relKey === "goals") {
    return {
      targetModel: "novaGoal",
      many: true,
      items: tables.novaGoal.filter((g) => g.reserveId === row.id),
    };
  }
  return null;
}

function matchesWhere(
  tables: StoreTables,
  model: ModelName,
  row: Row,
  rawWhere?: Row
): boolean {
  if (!rawWhere) return true;
  const where = normalizeWhere(model, rawWhere)!;

  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (key === "AND") {
      const list = Array.isArray(cond) ? cond : [cond];
      if (!list.every((sub) => matchesWhere(tables, model, row, sub))) return false;
      continue;
    }
    if (key === "OR") {
      const list = Array.isArray(cond) ? cond : [cond];
      if (!list.some((sub) => matchesWhere(tables, model, row, sub))) return false;
      continue;
    }
    if (key === "NOT") {
      const list = Array.isArray(cond) ? cond : [cond];
      if (list.some((sub) => matchesWhere(tables, model, row, sub))) return false;
      continue;
    }

    const rel = getRelatedRows(tables, model, row, key);
    if (rel && cond && typeof cond === "object" && !(cond instanceof Date)) {
      if (rel.many && Array.isArray(rel.items)) {
        if ("some" in cond) {
          if (!rel.items.some((it) => matchesWhere(tables, rel.targetModel, it, cond.some))) {
            return false;
          }
          continue;
        }
        if ("every" in cond) {
          if (!rel.items.every((it) => matchesWhere(tables, rel.targetModel, it, cond.every))) {
            return false;
          }
          continue;
        }
        if ("none" in cond) {
          if (rel.items.some((it) => matchesWhere(tables, rel.targetModel, it, cond.none))) {
            return false;
          }
          continue;
        }
      } else if (!rel.many) {
        if (!rel.items || !matchesWhere(tables, rel.targetModel, rel.items as Row, cond)) {
          return false;
        }
        continue;
      }
    }

    const val = row[key];
    if (
      cond !== null &&
      typeof cond === "object" &&
      !(cond instanceof Date) &&
      typeof cond !== "bigint"
    ) {
      if ("equals" in cond && comparePrimitive(val, cond.equals) !== 0) return false;
      if ("not" in cond) {
        if (cond.not === null ? val === null : comparePrimitive(val, cond.not) === 0) {
          return false;
        }
      }
      if ("in" in cond && Array.isArray(cond.in)) {
        if (!cond.in.some((item: any) => comparePrimitive(val, item) === 0)) return false;
      }
      if ("notIn" in cond && Array.isArray(cond.notIn)) {
        if (cond.notIn.some((item: any) => comparePrimitive(val, item) === 0)) return false;
      }
      if ("gt" in cond && !(val != null && comparePrimitive(val, cond.gt) > 0)) return false;
      if ("gte" in cond && !(val != null && comparePrimitive(val, cond.gte) >= 0)) return false;
      if ("lt" in cond && !(val != null && comparePrimitive(val, cond.lt) < 0)) return false;
      if ("lte" in cond && !(val != null && comparePrimitive(val, cond.lte) <= 0)) return false;
      if ("contains" in cond) {
        const hay = String(val ?? "");
        const needle = String(cond.contains ?? "");
        if (cond.mode === "insensitive") {
          if (!hay.toLowerCase().includes(needle.toLowerCase())) return false;
        } else if (!hay.includes(needle)) {
          return false;
        }
      }
      continue;
    }

    if (cond === null) {
      if (val != null) return false;
    } else if (comparePrimitive(val, cond) !== 0) {
      return false;
    }
  }

  return true;
}

function sortRows(rows: Row[], orderBy?: any): Row[] {
  if (!orderBy) return [...rows];
  const specs = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const spec of specs) {
      for (const [field, dir] of Object.entries(spec)) {
        const cmp = comparePrimitive(a[field], b[field]);
        if (cmp !== 0) return dir === "desc" ? -cmp : cmp;
      }
    }
    return 0;
  });
}

function projectRow(
  tables: StoreTables,
  model: ModelName,
  row: Row,
  args?: { include?: Row; select?: Row }
): Row {
  let out: Row = { ...row };

  if (args?.include) {
    for (const [relKey, relSpec] of Object.entries(args.include)) {
      if (!relSpec) continue;
      const rel = getRelatedRows(tables, model, row, relKey);
      if (!rel) continue;
      if (rel.many && Array.isArray(rel.items)) {
        let items = rel.items;
        if (typeof relSpec === "object") {
          if (relSpec.where) {
            items = items.filter((it) =>
              matchesWhere(tables, rel.targetModel, it, relSpec.where)
            );
          }
          if (relSpec.orderBy) {
            items = sortRows(items, relSpec.orderBy);
          }
          if (typeof relSpec.take === "number") {
            items = items.slice(0, relSpec.take);
          }
          items = items.map((it) => projectRow(tables, rel.targetModel, it, relSpec));
        } else {
          items = items.map((it) => ({ ...it }));
        }
        out[relKey] = items;
      } else {
        const single = rel.items as Row | null;
        out[relKey] =
          single && typeof relSpec === "object"
            ? projectRow(tables, rel.targetModel, single, relSpec)
            : single
            ? { ...single }
            : null;
      }
    }
  }

  if (args?.select) {
    const selected: Row = {};
    for (const [selKey, selSpec] of Object.entries(args.select)) {
      if (!selSpec) continue;
      const rel = getRelatedRows(tables, model, row, selKey);
      if (rel) {
        if (rel.many && Array.isArray(rel.items)) {
          selected[selKey] = rel.items.map((it) =>
            typeof selSpec === "object" ? projectRow(tables, rel.targetModel, it, selSpec) : { ...it }
          );
        } else {
          const single = rel.items as Row | null;
          selected[selKey] =
            single && typeof selSpec === "object"
              ? projectRow(tables, rel.targetModel, single, selSpec)
              : single
              ? { ...single }
              : null;
        }
      } else {
        selected[selKey] = out[selKey];
      }
    }
    out = selected;
  }

  return out;
}

function applyUpdateData(target: Row, data: Row): void {
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (
      v !== null &&
      typeof v === "object" &&
      !(v instanceof Date) &&
      typeof v !== "bigint" &&
      !Array.isArray(v)
    ) {
      if ("increment" in v) {
        if (typeof target[k] === "bigint" || typeof v.increment === "bigint") {
          target[k] = BigInt(target[k] ?? 0) + BigInt(v.increment);
        } else {
          target[k] = Number(target[k] ?? 0) + Number(v.increment);
        }
        continue;
      }
      if ("decrement" in v) {
        if (typeof target[k] === "bigint" || typeof v.decrement === "bigint") {
          target[k] = BigInt(target[k] ?? 0) - BigInt(v.decrement);
        } else {
          target[k] = Number(target[k] ?? 0) - Number(v.decrement);
        }
        continue;
      }
      if ("set" in v) {
        target[k] = v.set;
        continue;
      }
    }
    target[k] = v;
  }
  if ("updatedAt" in target && !("updatedAt" in data)) {
    target.updatedAt = new Date();
  }
}

function makeUniqueError(): Error & { code: string } {
  const err = new Error("Unique constraint failed") as Error & { code: string };
  err.code = "P2002";
  return err;
}

function checkUniqueViolation(tables: StoreTables, model: ModelName, candidate: Row, ignoreRef?: Row) {
  const rows = tables[model];
  const primaryKey = model === "novaAuthThrottle" ? "key" : "id";

  for (const existing of rows) {
    if (existing === ignoreRef) continue;
    if (candidate[primaryKey] != null && existing[primaryKey] === candidate[primaryKey]) {
      throw makeUniqueError();
    }
    if (model === "user" && existing.email === candidate.email) {
      throw makeUniqueError();
    }
    if (
      (model === "session" || model === "novaSession" || model === "novaPasswordReset") &&
      existing.tokenHash === candidate.tokenHash
    ) {
      throw makeUniqueError();
    }
    const compounds = COMPOUND_UNIQUES[model];
    if (compounds) {
      for (const fields of Object.values(compounds)) {
        if (fields.every((f) => candidate[f] != null && existing[f] === candidate[f])) {
          throw makeUniqueError();
        }
      }
    }
  }
}

function createModelDelegate(tables: StoreTables, model: ModelName) {
  return {
    async findUnique(args?: any) {
      const row = tables[model].find((r) => matchesWhere(tables, model, r, args?.where));
      return row ? projectRow(tables, model, row, args) : null;
    },
    async findFirst(args?: any) {
      let rows = tables[model].filter((r) => matchesWhere(tables, model, r, args?.where));
      if (args?.orderBy) rows = sortRows(rows, args.orderBy);
      const row = rows[0];
      return row ? projectRow(tables, model, row, args) : null;
    },
    async findMany(args?: any) {
      let rows = tables[model].filter((r) => matchesWhere(tables, model, r, args?.where));
      if (args?.orderBy) rows = sortRows(rows, args.orderBy);
      if (typeof args?.skip === "number") rows = rows.slice(args.skip);
      if (typeof args?.take === "number") rows = rows.slice(0, args.take);
      return rows.map((r) => projectRow(tables, model, r, args));
    },
    async count(args?: any) {
      return tables[model].filter((r) => matchesWhere(tables, model, r, args?.where)).length;
    },
    async create(args: any) {
      const row = applyDefaults(model, args?.data ?? {});
      checkUniqueViolation(tables, model, row);
      tables[model].push(row);
      return projectRow(tables, model, row, args);
    },
    async createMany(args: any) {
      const items: Row[] = Array.isArray(args?.data) ? args.data : [args?.data];
      let count = 0;
      for (const item of items) {
        if (!item) continue;
        const row = applyDefaults(model, item);
        try {
          checkUniqueViolation(tables, model, row);
          tables[model].push(row);
          count++;
        } catch (err) {
          if (!args?.skipDuplicates) throw err;
        }
      }
      return { count };
    },
    async update(args: any) {
      const row = tables[model].find((r) => matchesWhere(tables, model, r, args?.where));
      if (!row) {
        const err = new Error(`Record not found in ${model}`) as Error & { code: string };
        err.code = "P2025";
        throw err;
      }
      const preview = { ...row };
      applyUpdateData(preview, args?.data ?? {});
      checkUniqueViolation(tables, model, preview, row);
      applyUpdateData(row, args?.data ?? {});
      return projectRow(tables, model, row, args);
    },
    async updateMany(args: any) {
      const matched = tables[model].filter((r) => matchesWhere(tables, model, r, args?.where));
      for (const row of matched) {
        applyUpdateData(row, args?.data ?? {});
      }
      return { count: matched.length };
    },
    async upsert(args: any) {
      const existing = tables[model].find((r) => matchesWhere(tables, model, r, args?.where));
      if (existing) {
        applyUpdateData(existing, args?.update ?? {});
        return projectRow(tables, model, existing, args);
      }
      const row = applyDefaults(model, args?.create ?? {});
      checkUniqueViolation(tables, model, row);
      tables[model].push(row);
      return projectRow(tables, model, row, args);
    },
    async delete(args: any) {
      const idx = tables[model].findIndex((r) => matchesWhere(tables, model, r, args?.where));
      if (idx === -1) {
        const err = new Error(`Record not found in ${model}`) as Error & { code: string };
        err.code = "P2025";
        throw err;
      }
      const [removed] = tables[model].splice(idx, 1);
      return projectRow(tables, model, removed, args);
    },
    async deleteMany(args?: any) {
      const keep: Row[] = [];
      let count = 0;
      for (const r of tables[model]) {
        if (matchesWhere(tables, model, r, args?.where)) {
          count++;
        } else {
          keep.push(r);
        }
      }
      tables[model] = keep;
      return { count };
    },
  };
}

export function createInMemoryPrismaClient(): any {
  const tables = {} as StoreTables;
  for (const name of MODEL_NAMES) {
    tables[name] = [];
  }
  seedDefaultAdminStore(tables);

  const client: Record<string, any> = {
    __isInMemoryFallback: true,
    async $connect() {},
    async $disconnect() {},
    async $transaction(arg: any) {
      if (typeof arg === "function") {
        return await arg(client);
      }
      if (Array.isArray(arg)) {
        return await Promise.all(arg);
      }
      return null;
    },
  };

  for (const name of MODEL_NAMES) {
    client[name] = createModelDelegate(tables, name);
  }

  return client;
}

const globalForMem = globalThis as unknown as {
  __novaInMemoryPrisma?: any;
};

export function getInMemoryPrisma(): any {
  if (!globalForMem.__novaInMemoryPrisma) {
    globalForMem.__novaInMemoryPrisma = createInMemoryPrismaClient();
  }
  return globalForMem.__novaInMemoryPrisma;
}
