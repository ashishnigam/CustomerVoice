# CustomerVoice Observability Runbook

CustomerVoice now supports OpenTelemetry tracing for the API and worker services.

## Local stack

Start the analytics infrastructure:

```bash
pnpm infra:analytics:up
```

Local endpoints:

- Analytics Postgres: `localhost:55433`
- Superset: `http://localhost:8088`

Default Superset credentials:

- Username: `admin`
- Password: `admin`

## OpenTelemetry env

Set these values in the workspace root `.env` or the app-local `.env` files:

```bash
OTEL_ENABLED=true
OTEL_SERVICE_NAMESPACE=customervoice
OTEL_ANALYTICS_DATABASE_URL=postgresql://analytics:analytics@localhost:55433/customervoice_observability
OTEL_EXPORTER_OTLP_ENDPOINT=
```

`OTEL_EXPORTER_OTLP_ENDPOINT` is optional. When set, traces are sent both to the OTLP endpoint and the analytics Postgres store.

## Stored telemetry

Spans are persisted into the analytics Postgres database in the `otel_spans` table. Important fields include:

- `service_name`
- `tenant_id`
- `workspace_id`
- `request_id`
- `duration_ms`
- `attributes`
- `events`

## Superset connection

After signing in to Superset, add the analytics database with:

```text
postgresql+psycopg2://analytics:analytics@analytics-postgres:5432/customervoice_observability
```

Superset runs inside Docker, so it should use the Compose service name `analytics-postgres`.

## Coverage output

Run LCOV coverage for the API test suite with:

```bash
pnpm coverage
```

DB-backed coverage:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:55432/customervoice pnpm coverage:all
```

Generated LCOV file:

- `apps/api/coverage/lcov.info`

## Future analytics backends

The current analytics storage layer is Postgres so Superset can visualize traces immediately. The data model is tenant-aware and can later be mirrored into Apache Druid or Google BigQuery with an ETL step or an OTLP collector pipeline.
