import nodemailer from 'nodemailer';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, type PoolClient } from 'pg';
import {
  getActiveTraceMetadata,
  recordActiveSpanException,
  runWithSpan,
  setActiveSpanAttributes,
  shutdownObservability,
} from './observability.js';

interface NotificationJob {
  id: string;
  tenant_id: string | null;
  workspace_id: string | null;
  board_id: string | null;
  idea_id: string | null;
  event_type: string;
  template_id: string;
  payload: Record<string, unknown>;
  attempt_count: number;
  max_attempts: number;
}

interface NotificationRecipient {
  id: string;
  email: string;
  status: 'pending' | 'sent' | 'failed';
}

interface Webhook {
  id: string;
  url: string;
  secret: string;
}

interface WorkerContext {
  source: 'worker';
  tenantId: string | null;
  workspaceId: string | null;
  jobId: string | null;
  eventType: string | null;
}

interface FixedWindowBucket {
  count: number;
  resetAt: number;
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for worker notifications');
}

const pollIntervalMs = Number(process.env.NOTIFICATION_POLL_INTERVAL_MS ?? 5000);
const smtpHost = process.env.SMTP_HOST ?? 'localhost';
const smtpPort = Number(process.env.SMTP_PORT ?? 1025);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const fromEmail = process.env.WORKER_FROM_EMAIL ?? 'notifications@customervoice.local';
const webhookDispatchLimit = Number(process.env.WORKER_WEBHOOK_DISPATCH_LIMIT ?? 120);

const pool = new Pool({
  connectionString: databaseUrl,
  max: Number(process.env.DB_POOL_MAX ?? 5),
});

const workerContextStorage = new AsyncLocalStorage<WorkerContext>();
const fixedWindowBuckets = new Map<string, FixedWindowBucket>();

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: false,
  auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
});

function withWorkerContext<T>(value: WorkerContext, fn: () => Promise<T>): Promise<T> {
  return workerContextStorage.run(value, fn);
}

function getWorkerContext(): WorkerContext | null {
  return workerContextStorage.getStore() ?? null;
}

function buildLogPayload(level: 'info' | 'warn' | 'error', message: string, fields: Record<string, unknown> = {}) {
  return JSON.stringify({
    level,
    message,
    ...getWorkerContext(),
    ...getActiveTraceMetadata(),
    ...fields,
  });
}

function logInfo(message: string, fields: Record<string, unknown> = {}): void {
  console.log(buildLogPayload('info', message, fields));
}

function logWarn(message: string, fields: Record<string, unknown> = {}): void {
  console.warn(buildLogPayload('warn', message, fields));
}

function logError(message: string, fields: Record<string, unknown> = {}): void {
  console.error(buildLogPayload('error', message, fields));
}

function workerContextSpanAttributes(value: WorkerContext | null): Record<string, string | number | boolean> {
  if (!value) {
    return { 'cv.source': 'worker' };
  }

  const attributes: Record<string, string | number | boolean> = {
    'cv.source': value.source,
  };

  if (value.tenantId) {
    attributes['cv.tenant_id'] = value.tenantId;
  }
  if (value.workspaceId) {
    attributes['cv.workspace_id'] = value.workspaceId;
  }
  if (value.jobId) {
    attributes['cv.job_id'] = value.jobId;
  }
  if (value.eventType) {
    attributes['cv.event_type'] = value.eventType;
  }

  return attributes;
}

function consumeWorkerRateLimit(bucket: string, limit: number, windowMs: number): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const current = fixedWindowBuckets.get(bucket);
  if (!current || current.resetAt <= now) {
    fixedWindowBuckets.set(bucket, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterMs: Math.max(0, current.resetAt - now),
    };
  }

  current.count += 1;
  fixedWindowBuckets.set(bucket, current);
  return { allowed: true, retryAfterMs: 0 };
}

async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function claimNotificationJob(): Promise<
  | {
    job: NotificationJob;
    recipients: NotificationRecipient[];
    attemptCount: number;
  }
  | null
> {
  return withTransaction(async (client) => {
    const jobResult = await client.query<NotificationJob>(
      `
        SELECT
          id,
          tenant_id,
          workspace_id,
          board_id,
          idea_id,
          event_type,
          template_id,
          payload,
          attempt_count,
          max_attempts
        FROM notification_jobs
        WHERE status IN ('pending', 'failed')
          AND attempt_count < max_attempts
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `,
    );

    if ((jobResult.rowCount ?? 0) === 0) {
      return null;
    }

    const job = jobResult.rows[0];

    const nextAttemptCount = job.attempt_count + 1;
    await client.query(
      `
        UPDATE notification_jobs
        SET
          status = 'processing',
          attempt_count = $2,
          updated_at = NOW()
        WHERE id = $1
      `,
      [job.id, nextAttemptCount],
    );

    const recipientResult = await client.query<NotificationRecipient>(
      `
        SELECT id, email, status
        FROM notification_job_recipients
        WHERE job_id = $1
          AND status != 'sent'
        ORDER BY created_at ASC
      `,
      [job.id],
    );

    return {
      job,
      recipients: recipientResult.rows,
      attemptCount: nextAttemptCount,
    };
  });
}

function buildMailContent(job: NotificationJob): { subject: string; text: string } {
  const payload = job.payload ?? {};
  const ideaTitle = typeof payload.ideaTitle === 'string' ? payload.ideaTitle : `Idea ${job.idea_id}`;

  if (job.event_type === 'auth.reset_password') {
    const resetLink = typeof payload.resetLink === 'string' ? payload.resetLink : '';
    return {
      subject: 'Reset your CustomerVoice password',
      text: `Hello,\n\nYou requested a password reset. Please click the link below to reset your password:\n\n${resetLink}\n\nIf you did not request this, you can safely ignore this email.`,
    };
  }

  if (job.event_type === 'analytics.outreach') {
    const outreachSubject = typeof payload.subject === 'string' ? payload.subject : `Update on ${ideaTitle}`;
    const outreachMessage =
      typeof payload.message === 'string'
        ? payload.message
        : `You are receiving this outreach update for ${ideaTitle}.`;
    return {
      subject: outreachSubject,
      text: `${outreachMessage}\n\nIdea: ${ideaTitle}\nBoard: ${job.board_id}`,
    };
  }

  return {
    subject: `Feature update: ${ideaTitle} is now completed`,
    text: `The idea "${ideaTitle}" has moved to completed status.\n\nBoard: ${job.board_id}\nIdea ID: ${job.idea_id}`,
  };
}

async function markRecipientSent(recipientId: string): Promise<void> {
  await pool.query(
    `
      UPDATE notification_job_recipients
      SET
        status = 'sent',
        attempts = attempts + 1,
        sent_at = NOW(),
        last_error = NULL
      WHERE id = $1
    `,
    [recipientId],
  );
}

async function markRecipientFailed(recipientId: string, message: string): Promise<void> {
  await pool.query(
    `
      UPDATE notification_job_recipients
      SET
        status = 'failed',
        attempts = attempts + 1,
        last_error = $2
      WHERE id = $1
    `,
    [recipientId, message.slice(0, 2000)],
  );
}

async function finalizeJob(params: {
  jobId: string;
  attemptCount: number;
  maxAttempts: number;
  lastError?: string;
}): Promise<void> {
  const remaining = await pool.query<{ remaining: number }>(
    `
      SELECT COUNT(*)::int AS remaining
      FROM notification_job_recipients
      WHERE job_id = $1
        AND status != 'sent'
    `,
    [params.jobId],
  );

  const remainingCount = Number(remaining.rows[0]?.remaining ?? 0);

  if (remainingCount === 0) {
    await pool.query(
      `
        UPDATE notification_jobs
        SET
          status = 'sent',
          last_error = NULL,
          updated_at = NOW(),
          processed_at = NOW()
        WHERE id = $1
      `,
      [params.jobId],
    );
    return;
  }

  const status = params.attemptCount >= params.maxAttempts ? 'dead' : 'failed';
  await pool.query(
    `
      UPDATE notification_jobs
      SET
        status = $2,
        last_error = $3,
        updated_at = NOW(),
        processed_at = CASE WHEN $2 = 'dead' THEN NOW() ELSE processed_at END
      WHERE id = $1
    `,
    [params.jobId, status, params.lastError?.slice(0, 2000) ?? 'delivery_incomplete'],
  );
}

async function dispatchWebhooks(job: NotificationJob): Promise<void> {
  await runWithSpan(
    'worker.webhook_dispatch',
    {
      ...workerContextSpanAttributes(getWorkerContext()),
      'cv.board_id': job.board_id ?? '',
    },
    async () => {
      try {
        const tenantId = job.tenant_id;
        if (tenantId) {
          const rateLimit = consumeWorkerRateLimit(`webhooks:${tenantId}`, webhookDispatchLimit, 60_000);
          if (!rateLimit.allowed) {
            logWarn('webhook_dispatch_throttled', {
              tenantId,
              retryAfterMs: rateLimit.retryAfterMs,
              eventType: job.event_type,
            });
            setActiveSpanAttributes({
              'cv.webhook_throttled': true,
              'cv.webhook_retry_after_ms': rateLimit.retryAfterMs,
            });
            return;
          }
        }

        const hw = await pool.query<Webhook>(
          `
            SELECT id, url, secret
            FROM webhooks
            WHERE tenant_id = $1
              AND ($2::text IS NULL OR workspace_id = $2)
              AND active = true
              AND $3 = ANY(events)
          `,
          [job.tenant_id, job.workspace_id, job.event_type],
        );

        if (hw.rows.length === 0) return;

        const promises = hw.rows.map(async (wh) => {
          try {
            const res = await fetch(wh.url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-cv-webhook-secret': wh.secret,
              },
              body: JSON.stringify({
                event: job.event_type,
                payload: job.payload,
                timestamp: new Date().toISOString(),
              }),
            });
            if (!res.ok) {
              logWarn('webhook_dispatch_failed', { url: wh.url, status: res.status });
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'webhook_dispatch_failed';
            recordActiveSpanException(error, { 'cv.webhook_url': wh.url });
            logError('webhook_dispatch_error', { url: wh.url, error: message });
          }
        });

        await Promise.allSettled(promises);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'webhook_fetch_failed';
        recordActiveSpanException(error);
        logError('webhook_fetch_failed', { error: message });
      }
    },
  );
}

async function processNextJob(): Promise<boolean> {
  const claimed = await claimNotificationJob();
  if (!claimed) {
    return false;
  }

  const { job, recipients, attemptCount } = claimed;
  await withWorkerContext(
    {
      source: 'worker',
      tenantId: job.tenant_id,
      workspaceId: job.workspace_id,
      jobId: job.id,
      eventType: job.event_type,
    },
    async () => {
      await runWithSpan(
        'worker.notification_job',
        {
          ...workerContextSpanAttributes(getWorkerContext()),
          'cv.board_id': job.board_id ?? '',
          'cv.idea_id': job.idea_id ?? '',
          'cv.attempt_count': attemptCount,
          'cv.recipient_count': recipients.length,
        },
        async () => {
          logInfo('notification_job_claimed', {
            attemptCount,
            recipientCount: recipients.length,
          });

          const content = buildMailContent(job);
          let lastError: string | undefined;

          for (const recipient of recipients) {
            try {
              await transporter.sendMail({
                from: fromEmail,
                to: recipient.email,
                subject: content.subject,
                text: content.text,
              });
              await markRecipientSent(recipient.id);
            } catch (error) {
              const message = error instanceof Error ? error.message : 'smtp_send_failed';
              lastError = message;
              recordActiveSpanException(error, { 'cv.recipient_email': recipient.email });
              await markRecipientFailed(recipient.id, message);
            }
          }

          if (attemptCount === 1) {
            await dispatchWebhooks(job);
          }

          await finalizeJob({
            jobId: job.id,
            attemptCount,
            maxAttempts: job.max_attempts,
            lastError,
          });
        },
      );
    },
  );

  return true;
}

let shuttingDown = false;

async function tick(): Promise<void> {
  if (shuttingDown) {
    return;
  }

  try {
    const processed = await processNextJob();
    if (processed) {
      logInfo('notification_job_processed', { processedAt: new Date().toISOString() });
    }
  } catch (error) {
    recordActiveSpanException(error);
    logError('notification_processing_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logInfo('worker_shutdown', { signal });
  await shutdownObservability();
  await pool.end();
  process.exit(0);
}

logInfo('worker_start', { smtp: `${smtpHost}:${smtpPort}`, pollIntervalMs });

const interval = setInterval(() => {
  void tick();
}, pollIntervalMs);

void tick();

process.on('SIGINT', () => {
  clearInterval(interval);
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  clearInterval(interval);
  void shutdown('SIGTERM');
});
