import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { emailsSent } from '../utils/metrics.js';
import { sendEmail } from './smtpService.js';
import { getAccountWithCredentials } from './accountService.js';

const connection = { url: config.redisUrl };

export const smtpQueue = new Queue('smtp-send', { connection });

interface SendJobData {
  tenantId: string;
  accountId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  inReplyTo?: string;
}

export const addSendJob = async (data: SendJobData): Promise<string> => {
  const job = await smtpQueue.add('send-email', data, {
    attempts: config.smtpMaxRetries,
    backoff: { type: 'exponential', delay: config.smtpRetryDelaySeconds * 1000 },
  });
  logger.info({ jobId: job.id, to: data.to }, 'Email send job queued');
  return job.id!;
};

export const createSmtpWorker = (): Worker => {
  const worker = new Worker('smtp-send', async (job: Job<SendJobData>) => {
    const { tenantId, accountId, to, cc, bcc, subject, body, inReplyTo } = job.data;

    const account = await getAccountWithCredentials(tenantId, accountId);
    if (!account) throw new Error('Email account not found');

    await sendEmail(
      {
        host: account.smtp_host,
        port: account.smtp_port,
        secure: account.smtp_secure,
        user: account.smtp_username,
        password: account.smtp_password,
      },
      {
        from: `${account.display_name} <${account.email_address}>`,
        to, cc, bcc, subject, text: body, inReplyTo,
      }
    );

    emailsSent.inc({ tenant_id: tenantId, status: 'success' });
  }, {
    connection,
    concurrency: config.smtpQueueConcurrency,
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Email send job failed');
    emailsSent.inc({ tenant_id: job?.data?.tenantId || 'unknown', status: 'failure' });
  });

  return worker;
};
