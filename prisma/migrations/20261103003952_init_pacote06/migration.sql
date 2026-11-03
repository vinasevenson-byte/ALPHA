-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL DEFAULT 'usr-nova-owner',
    "baseCurrency" TEXT NOT NULL DEFAULT 'BRL',
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "safetyBufferCents" INTEGER NOT NULL DEFAULT 0,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OWNER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CHECKING',
    "institution" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "openingBalanceCents" INTEGER NOT NULL DEFAULT 0,
    "openingCents" BIGINT NOT NULL DEFAULT 0,
    "openingBalanceDate" TEXT NOT NULL DEFAULT '2026-01-01',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Account_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isEssential" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Category_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Counterparty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'COMPANY',
    "name" TEXT NOT NULL,
    "document" TEXT,
    "costCenter" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Counterparty_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "categoryId" TEXT,
    "counterpartyId" TEXT,
    "costCenter" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "signedCents" BIGINT NOT NULL DEFAULT 0,
    "signedAdjustDir" INTEGER NOT NULL DEFAULT 1,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "occurredOn" TEXT NOT NULL DEFAULT '2026-01-01',
    "dueOn" TEXT,
    "settledOn" TEXT,
    "settledAt" DATETIME,
    "description" TEXT NOT NULL,
    "cancelReason" TEXT,
    "transferGroup" TEXT,
    "transferGroupId" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "version" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reserve" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reserve_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Investment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "asOf" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Investment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Audit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "responseJson" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdempotencyKey_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recurrence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "categoryId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "periodicity" TEXT NOT NULL DEFAULT 'MONTHLY',
    "nextDate" TEXT NOT NULL,
    "endDate" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Recurrence_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "categoryId" TEXT,
    "categoryName" TEXT NOT NULL,
    "costCenter" TEXT,
    "period" TEXT NOT NULL,
    "limitCents" INTEGER NOT NULL,
    "warnOnly" BOOLEAN NOT NULL DEFAULT true,
    "carryOver" BOOLEAN NOT NULL DEFAULT false,
    "thresholdWarnPct" INTEGER NOT NULL DEFAULT 70,
    "thresholdCritPct" INTEGER NOT NULL DEFAULT 90,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Budget_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NovaObligation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "categoryId" TEXT,
    "categoryName" TEXT,
    "counterpartyId" TEXT,
    "counterparty" TEXT,
    "costCenter" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "cancelReason" TEXT,
    "confidence" TEXT NOT NULL DEFAULT 'HIGH',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NovaObligation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NovaInstallment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "dueOn" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "sourceTransactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NovaInstallment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NovaInstallment_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "NovaObligation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NovaSettlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "settledOn" TEXT NOT NULL,
    "note" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NovaSettlement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NovaSettlement_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "NovaInstallment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NovaReserve" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'GENERAL',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "targetAmountCents" INTEGER,
    "targetOn" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NovaReserve_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NovaReserveMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "reserveId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "transferGroupId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NovaReserveMovement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NovaReserveMovement_reserveId_fkey" FOREIGN KEY ("reserveId") REFERENCES "NovaReserve" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NovaGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "reserveId" TEXT,
    "name" TEXT NOT NULL,
    "targetAmountCents" INTEGER NOT NULL,
    "targetOn" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NovaGoal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NovaGoal_reserveId_fkey" FOREIGN KEY ("reserveId") REFERENCES "NovaReserve" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NovaPlanningScenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "contingencyBufferPct" INTEGER NOT NULL DEFAULT 0,
    "hypotheticalInflowCents" INTEGER NOT NULL DEFAULT 0,
    "hypotheticalOutflowCents" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NovaPlanningScenario_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NovaAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "sourceRef" TEXT,
    "state" TEXT NOT NULL DEFAULT 'NEW',
    "occurrenceOn" TEXT NOT NULL,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NovaAlert_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "metadataJson" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NovaInvestmentPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "indexer" TEXT NOT NULL DEFAULT 'CDI',
    "rateLabel" TEXT NOT NULL,
    "costBasisCents" INTEGER NOT NULL,
    "currentGrossCents" INTEGER NOT NULL,
    "daysHeld" INTEGER NOT NULL DEFAULT 365,
    "redemptionAvailableAt" TEXT NOT NULL,
    "maturityDate" TEXT NOT NULL,
    "fgcEligible" BOOLEAN NOT NULL DEFAULT false,
    "quoteStatus" TEXT NOT NULL DEFAULT 'VALID',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NovaInvestmentPosition_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinancialConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "providerCode" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "consentId" TEXT,
    "consentScopes" TEXT,
    "consentExpiresAt" DATETIME,
    "lastSyncAt" DATETIME,
    "lastErrorCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinancialConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "connectionId" TEXT,
    "sourceType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL DEFAULT 'extrato.csv',
    "state" TEXT NOT NULL DEFAULT 'REVIEWING',
    "inputChecksum" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" DATETIME,
    CONSTRAINT "ImportBatch_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportedExternalTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accountExternalId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "postedOn" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rawHash" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'STAGED',
    "matchedLedgerEntryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportedExternalTransaction_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinancialInsight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'NEW',
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "evidenceJson" TEXT NOT NULL,
    "asOf" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceVersion" TEXT NOT NULL DEFAULT '4.0.0',
    "dedupeKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancialInsight_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinancialNotificationPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinancialNotificationPreference_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinancialConsentAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scopesJson" TEXT NOT NULL,
    "eventAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT NOT NULL,
    CONSTRAINT "FinancialConsentAudit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_workspaceId_userId_key" ON "Membership"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_workspaceId_key" ON "Membership"("userId", "workspaceId");

-- CreateIndex
CREATE INDEX "Account_workspaceId_idx" ON "Account"("workspaceId");

-- CreateIndex
CREATE INDEX "Transaction_workspaceId_occurredOn_idx" ON "Transaction"("workspaceId", "occurredOn");

-- CreateIndex
CREATE INDEX "Transaction_workspaceId_status_dueOn_idx" ON "Transaction"("workspaceId", "status", "dueOn");

-- CreateIndex
CREATE INDEX "Transaction_workspaceId_status_dueDate_idx" ON "Transaction"("workspaceId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Transaction_workspaceId_accountId_settledOn_idx" ON "Transaction"("workspaceId", "accountId", "settledOn");

-- CreateIndex
CREATE INDEX "Transaction_accountId_status_idx" ON "Transaction"("accountId", "status");

-- CreateIndex
CREATE INDEX "Transaction_transferGroup_idx" ON "Transaction"("transferGroup");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_workspaceId_idempotencyKey_key" ON "Transaction"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Reserve_workspaceId_idx" ON "Reserve"("workspaceId");

-- CreateIndex
CREATE INDEX "Investment_workspaceId_idx" ON "Investment"("workspaceId");

-- CreateIndex
CREATE INDEX "Audit_workspaceId_at_idx" ON "Audit"("workspaceId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_workspaceId_key_key" ON "IdempotencyKey"("workspaceId", "key");

-- CreateIndex
CREATE INDEX "Budget_workspaceId_period_idx" ON "Budget"("workspaceId", "period");

-- CreateIndex
CREATE INDEX "NovaObligation_workspaceId_direction_status_idx" ON "NovaObligation"("workspaceId", "direction", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NovaInstallment_sourceTransactionId_key" ON "NovaInstallment"("sourceTransactionId");

-- CreateIndex
CREATE INDEX "NovaInstallment_workspaceId_dueOn_status_idx" ON "NovaInstallment"("workspaceId", "dueOn", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NovaInstallment_obligationId_number_key" ON "NovaInstallment"("obligationId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "NovaSettlement_transactionId_key" ON "NovaSettlement"("transactionId");

-- CreateIndex
CREATE INDEX "NovaSettlement_workspaceId_installmentId_idx" ON "NovaSettlement"("workspaceId", "installmentId");

-- CreateIndex
CREATE UNIQUE INDEX "NovaSettlement_workspaceId_idempotencyKey_key" ON "NovaSettlement"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "NovaReserve_workspaceId_status_idx" ON "NovaReserve"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "NovaReserveMovement_workspaceId_reserveId_createdAt_idx" ON "NovaReserveMovement"("workspaceId", "reserveId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NovaReserveMovement_workspaceId_idempotencyKey_kind_key" ON "NovaReserveMovement"("workspaceId", "idempotencyKey", "kind");

-- CreateIndex
CREATE INDEX "NovaGoal_workspaceId_status_idx" ON "NovaGoal"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "NovaPlanningScenario_workspaceId_kind_idx" ON "NovaPlanningScenario"("workspaceId", "kind");

-- CreateIndex
CREATE INDEX "NovaAlert_workspaceId_state_occurrenceOn_idx" ON "NovaAlert"("workspaceId", "state", "occurrenceOn");

-- CreateIndex
CREATE UNIQUE INDEX "NovaAlert_workspaceId_fingerprint_key" ON "NovaAlert"("workspaceId", "fingerprint");

-- CreateIndex
CREATE INDEX "AuditEvent_workspaceId_timestamp_idx" ON "AuditEvent"("workspaceId", "timestamp");

-- CreateIndex
CREATE INDEX "NovaInvestmentPosition_workspaceId_kind_idx" ON "NovaInvestmentPosition"("workspaceId", "kind");

-- CreateIndex
CREATE INDEX "FinancialConnection_workspaceId_status_idx" ON "FinancialConnection"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialConnection_workspaceId_providerCode_id_key" ON "FinancialConnection"("workspaceId", "providerCode", "id");

-- CreateIndex
CREATE INDEX "ImportBatch_workspaceId_state_createdAt_idx" ON "ImportBatch"("workspaceId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "ImportedExternalTransaction_workspaceId_importBatchId_idx" ON "ImportedExternalTransaction"("workspaceId", "importBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedExternalTransaction_workspaceId_providerId_accountExternalId_externalId_key" ON "ImportedExternalTransaction"("workspaceId", "providerId", "accountExternalId", "externalId");

-- CreateIndex
CREATE INDEX "FinancialInsight_workspaceId_state_createdAt_idx" ON "FinancialInsight"("workspaceId", "state", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialInsight_workspaceId_dedupeKey_key" ON "FinancialInsight"("workspaceId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialNotificationPreference_workspaceId_userId_channel_eventType_key" ON "FinancialNotificationPreference"("workspaceId", "userId", "channel", "eventType");

-- CreateIndex
CREATE INDEX "FinancialConsentAudit_workspaceId_connectionId_eventAt_idx" ON "FinancialConsentAudit"("workspaceId", "connectionId", "eventAt");
