/** Adapter boundary. This module intentionally does not contact providers. */
export type ConnectorStatus='DISCONNECTED'|'PENDING_CONSENT'|'ACTIVE'|'SYNCING'|'EXPIRED'|'REVOKED'|'ERROR';
export interface ConnectionContext { workspaceId:string; connectionId:string; subjectId:string; consentId:string; scopes:readonly string[] }
export interface ImportedEntry { providerId:string; accountExternalId:string; externalId:string; postedOn:string; amountMinor:string; currency:string; description:string; direction:'CREDIT'|'DEBIT'; rawHash:string }
export interface ReadonlyFinancialConnector {
 readonly providerCode:string;
 checkConsent(ctx:ConnectionContext):Promise<{valid:boolean;expiresAt:string|null}>;
 fetchTransactions(ctx:ConnectionContext,cursor?:string):Promise<{items:ImportedEntry[];nextCursor?:string}>;
 revoke(ctx:ConnectionContext):Promise<void>;
}
/** Idempotency key must be scoped to provider+workspace+account, not external ID alone. */
export function externalDedupeKey(workspaceId:string,providerId:string,accountExternalId:string,externalId:string):string {
 const parts=[workspaceId,providerId,accountExternalId,externalId];if(parts.some(s=>!s.trim()))throw new Error('Required key part missing');
 return JSON.stringify(parts);
}
