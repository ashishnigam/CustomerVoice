import { AsyncLocalStorage } from 'node:async_hooks';
import { getActiveTraceMetadata, setActiveSpanAttributes } from './observability.js';

export interface RequestContextValue {
  requestId: string;
  source: 'api';
  method?: string;
  path?: string;
  tenantId?: string | null;
  tenantKey?: string | null;
  workspaceId?: string | null;
  boardId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  operatorUserId?: string | null;
  operatorEmail?: string | null;
  globalRole?: string | null;
  impersonationSessionId?: string | null;
  domain?: string | null;
}

const requestContextStorage = new AsyncLocalStorage<RequestContextValue>();

function toSpanAttributes(value: Partial<RequestContextValue>): Record<string, string> {
  return Object.fromEntries(
    Object.entries({
      'cv.request_id': value.requestId,
      'cv.source': value.source,
      'cv.http_method': value.method,
      'cv.path': value.path,
      'cv.tenant_id': value.tenantId,
      'cv.tenant_key': value.tenantKey,
      'cv.workspace_id': value.workspaceId,
      'cv.board_id': value.boardId,
      'cv.user_id': value.userId,
      'cv.user_email': value.userEmail,
      'cv.operator_user_id': value.operatorUserId,
      'cv.operator_email': value.operatorEmail,
      'cv.global_role': value.globalRole,
      'cv.impersonation_session_id': value.impersonationSessionId,
      'cv.domain': value.domain,
    }).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0),
  );
}

export function runRequestContext<T>(value: RequestContextValue, fn: () => T): T {
  return requestContextStorage.run(value, () => {
    setActiveSpanAttributes(toSpanAttributes(value));
    return fn();
  });
}

export function getRequestContext(): RequestContextValue | null {
  return requestContextStorage.getStore() ?? null;
}

export function assignRequestContext(value: Partial<RequestContextValue>): void {
  const current = requestContextStorage.getStore();
  if (!current) {
    return;
  }

  Object.assign(current, value);
  setActiveSpanAttributes(toSpanAttributes(current));
}

function buildLogPayload(level: 'info' | 'warn' | 'error', message: string, fields: Record<string, unknown>) {
  return JSON.stringify({
    level,
    message,
    ...getRequestContext(),
    ...getActiveTraceMetadata(),
    ...fields,
  });
}

export function logRequestInfo(message: string, fields: Record<string, unknown> = {}): void {
  console.log(buildLogPayload('info', message, fields));
}

export function logRequestWarn(message: string, fields: Record<string, unknown> = {}): void {
  console.warn(buildLogPayload('warn', message, fields));
}

export function logRequestError(message: string, fields: Record<string, unknown> = {}): void {
  console.error(buildLogPayload('error', message, fields));
}
