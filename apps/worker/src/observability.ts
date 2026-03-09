import { context, SpanKind, SpanStatusCode, trace, type Attributes, type Span } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import {
  ExportResultCode,
  hrTimeToMilliseconds,
  hrTimeToTimeStamp,
  suppressTracing,
  type ExportResult,
} from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor, type ReadableSpan, type SpanExporter } from '@opentelemetry/sdk-trace-base';
import { Pool } from 'pg';

type Primitive = string | number | boolean;
type SpanAttributeInput = Primitive | null | undefined;

const serviceName = 'customervoice-worker';
let activeSdk: NodeSDK | null = null;

function isEnabled(): boolean {
  const value = (process.env.OTEL_ENABLED ?? 'false').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function resolveOtlpTraceEndpoint(): string | null {
  const configured =
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.trim() ??
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim() ??
    '';
  if (!configured) {
    return null;
  }

  try {
    const url = new URL(configured);
    if (url.pathname === '/' || url.pathname.length === 0) {
      url.pathname = '/v1/traces';
    }
    return url.toString();
  } catch {
    return configured;
  }
}

function normalizeAttributeValue(value: SpanAttributeInput): Primitive | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : undefined;
}

function normalizeAttributes(attributes: Record<string, SpanAttributeInput>): Attributes {
  return Object.fromEntries(
    Object.entries(attributes)
      .map(([key, value]) => [key, normalizeAttributeValue(value)] as const)
      .filter((entry): entry is [string, Primitive] => entry[1] !== undefined),
  );
}

function toJsonValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, toJsonValue(item)]),
    );
  }

  return String(value);
}

function getStringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

class PostgresSpanExporter implements SpanExporter {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: Number(process.env.OTEL_ANALYTICS_POOL_MAX ?? 5),
    });
  }

  async initialize(): Promise<void> {
    await this.withSuppressed(async () => {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS otel_spans (
          trace_id TEXT NOT NULL,
          span_id TEXT NOT NULL,
          parent_span_id TEXT,
          name TEXT NOT NULL,
          kind TEXT NOT NULL,
          service_name TEXT,
          service_namespace TEXT,
          service_version TEXT,
          tenant_id TEXT,
          tenant_key TEXT,
          workspace_id TEXT,
          board_id TEXT,
          user_id TEXT,
          operator_user_id TEXT,
          global_role TEXT,
          request_id TEXT,
          source TEXT,
          status_code TEXT,
          status_message TEXT,
          started_at TIMESTAMPTZ NOT NULL,
          ended_at TIMESTAMPTZ NOT NULL,
          duration_ms DOUBLE PRECISION NOT NULL,
          attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
          events JSONB NOT NULL DEFAULT '[]'::jsonb,
          resource JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (trace_id, span_id)
        );

        CREATE INDEX IF NOT EXISTS idx_otel_spans_started_at
          ON otel_spans (started_at DESC);

        CREATE INDEX IF NOT EXISTS idx_otel_spans_service_started_at
          ON otel_spans (service_name, started_at DESC);

        CREATE INDEX IF NOT EXISTS idx_otel_spans_tenant_started_at
          ON otel_spans (tenant_id, started_at DESC);

        CREATE INDEX IF NOT EXISTS idx_otel_spans_request_id
          ON otel_spans (request_id);
      `);
    });
  }

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    void this.persist(spans)
      .then(() => {
        resultCallback({ code: ExportResultCode.SUCCESS });
      })
      .catch((error) => {
        console.error('[otel] failed to persist spans to analytics database', error);
        resultCallback({ code: ExportResultCode.FAILED });
      });
  }

  async shutdown(): Promise<void> {
    await this.pool.end();
  }

  async forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  private async persist(spans: ReadableSpan[]): Promise<void> {
    if (spans.length === 0) {
      return;
    }

    await this.withSuppressed(async () => {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        for (const span of spans) {
          const spanContext = span.spanContext();
          const resource = toJsonValue(span.resource.attributes);
          const attributes = toJsonValue(span.attributes);
          const events = toJsonValue(
            span.events.map((event) => ({
              name: event.name,
              time: hrTimeToTimeStamp(event.time),
              attributes: toJsonValue(event.attributes),
            })),
          );

          await client.query(
            `
              INSERT INTO otel_spans (
                trace_id,
                span_id,
                parent_span_id,
                name,
                kind,
                service_name,
                service_namespace,
                service_version,
                tenant_id,
                tenant_key,
                workspace_id,
                board_id,
                user_id,
                operator_user_id,
                global_role,
                request_id,
                source,
                status_code,
                status_message,
                started_at,
                ended_at,
                duration_ms,
                attributes,
                events,
                resource
              )
              VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                $21, $22, $23::jsonb, $24::jsonb, $25::jsonb
              )
              ON CONFLICT (trace_id, span_id) DO UPDATE
              SET
                parent_span_id = EXCLUDED.parent_span_id,
                name = EXCLUDED.name,
                kind = EXCLUDED.kind,
                service_name = EXCLUDED.service_name,
                service_namespace = EXCLUDED.service_namespace,
                service_version = EXCLUDED.service_version,
                tenant_id = EXCLUDED.tenant_id,
                tenant_key = EXCLUDED.tenant_key,
                workspace_id = EXCLUDED.workspace_id,
                board_id = EXCLUDED.board_id,
                user_id = EXCLUDED.user_id,
                operator_user_id = EXCLUDED.operator_user_id,
                global_role = EXCLUDED.global_role,
                request_id = EXCLUDED.request_id,
                source = EXCLUDED.source,
                status_code = EXCLUDED.status_code,
                status_message = EXCLUDED.status_message,
                started_at = EXCLUDED.started_at,
                ended_at = EXCLUDED.ended_at,
                duration_ms = EXCLUDED.duration_ms,
                attributes = EXCLUDED.attributes,
                events = EXCLUDED.events,
                resource = EXCLUDED.resource
            `,
            [
              spanContext.traceId,
              spanContext.spanId,
              span.parentSpanContext?.spanId ?? null,
              span.name,
              SpanKind[span.kind] ?? String(span.kind),
              getStringValue(span.resource.attributes['service.name']),
              getStringValue(span.resource.attributes['service.namespace']),
              getStringValue(span.resource.attributes['service.version']),
              getStringValue(span.attributes['cv.tenant_id']),
              getStringValue(span.attributes['cv.tenant_key']),
              getStringValue(span.attributes['cv.workspace_id']),
              getStringValue(span.attributes['cv.board_id']),
              getStringValue(span.attributes['cv.user_id']),
              getStringValue(span.attributes['cv.operator_user_id']),
              getStringValue(span.attributes['cv.global_role']),
              getStringValue(span.attributes['cv.request_id']),
              getStringValue(span.attributes['cv.source']),
              SpanStatusCode[span.status.code] ?? String(span.status.code),
              span.status.message ?? null,
              hrTimeToTimeStamp(span.startTime),
              hrTimeToTimeStamp(span.endTime),
              hrTimeToMilliseconds(span.duration),
              JSON.stringify(attributes),
              JSON.stringify(events),
              JSON.stringify(resource),
            ],
          );
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    });
  }

  private withSuppressed<T>(fn: () => Promise<T>): Promise<T> {
    return context.with(suppressTracing(context.active()), fn);
  }
}

function setSpanAttributes(span: Span, attributes: Record<string, SpanAttributeInput>): void {
  const normalized = normalizeAttributes(attributes);
  if (Object.keys(normalized).length > 0) {
    span.setAttributes(normalized);
  }
}

export async function startObservability(): Promise<void> {
  if (activeSdk || !isEnabled()) {
    return;
  }

  const exporters: SpanExporter[] = [];
  const otlpEndpoint = resolveOtlpTraceEndpoint();
  if (otlpEndpoint) {
    exporters.push(new OTLPTraceExporter({ url: otlpEndpoint }));
  }

  const analyticsDatabaseUrl = process.env.OTEL_ANALYTICS_DATABASE_URL?.trim();
  if (analyticsDatabaseUrl) {
    try {
      const exporter = new PostgresSpanExporter(analyticsDatabaseUrl);
      await exporter.initialize();
      exporters.push(exporter);
    } catch (error) {
      console.error('[otel] failed to initialize analytics exporter', error);
    }
  }

  if (exporters.length === 0) {
    console.warn('[otel] OTEL_ENABLED is true but no trace exporters are configured');
    return;
  }

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': serviceName,
      'service.namespace': process.env.OTEL_SERVICE_NAMESPACE ?? 'customervoice',
      'service.version': process.env.npm_package_version ?? '0.1.0',
      'deployment.environment': process.env.NODE_ENV ?? 'development',
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
      }),
    ],
    spanProcessors: exporters.map((exporter) => new BatchSpanProcessor(exporter)),
  });

  sdk.start();
  activeSdk = sdk;
}

export async function shutdownObservability(): Promise<void> {
  if (!activeSdk) {
    return;
  }

  const sdk = activeSdk;
  activeSdk = null;
  await sdk.shutdown();
}

export function setActiveSpanAttributes(attributes: Record<string, SpanAttributeInput>): void {
  const span = trace.getSpan(context.active());
  if (!span) {
    return;
  }

  setSpanAttributes(span, attributes);
}

export function recordActiveSpanException(
  error: unknown,
  attributes: Record<string, SpanAttributeInput> = {},
): void {
  const span = trace.getSpan(context.active());
  if (!span) {
    return;
  }

  setSpanAttributes(span, attributes);

  if (error instanceof Error) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    return;
  }

  span.recordException({ name: 'Error', message: String(error) });
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: String(error),
  });
}

export function getActiveTraceMetadata(): { traceId?: string; spanId?: string } {
  const span = trace.getSpan(context.active());
  if (!span) {
    return {};
  }

  const spanContext = span.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
}

export async function runWithSpan<T>(
  name: string,
  attributes: Record<string, SpanAttributeInput>,
  fn: () => Promise<T>,
): Promise<T> {
  const tracer = trace.getTracer(serviceName);

  return tracer.startActiveSpan(name, async (span) => {
    setSpanAttributes(span, attributes);
    try {
      return await fn();
    } catch (error) {
      recordActiveSpanException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}
