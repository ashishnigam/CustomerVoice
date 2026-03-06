import { loadLocalEnv } from './load-env.js';
import nodemailer from 'nodemailer';
import { Pool, type PoolClient } from 'pg';

loadLocalEnv();

interface NotificationJob {
  id: string;
  workspace_id: string;
  board_id: string;
  idea_id: string;
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

const pool = new Pool({
  connectionString: databaseUrl,
  max: Number(process.env.DB_POOL_MAX ?? 5),
});

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: false,
  auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
});

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

async function processNextJob(): Promise<boolean> {
  const claimed = await claimNotificationJob();
  if (!claimed) {
    return false;
  }

  const { job, recipients, attemptCount } = claimed;
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
      await markRecipientFailed(recipient.id, message);
    }
  }

  await finalizeJob({
    jobId: job.id,
    attemptCount,
    maxAttempts: job.max_attempts,
    lastError,
  });

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
      console.log(`[worker] processed notification job at ${new Date().toISOString()}`);
    }
  } catch (error) {
    console.error('[worker] notification processing failed', error);
  }
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`[worker] shutdown signal=${signal}`);
  await pool.end();
  process.exit(0);
}

console.log('[worker] starting notification dispatcher');
console.log(`[worker] smtp=${smtpHost}:${smtpPort} pollIntervalMs=${pollIntervalMs}`);

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
