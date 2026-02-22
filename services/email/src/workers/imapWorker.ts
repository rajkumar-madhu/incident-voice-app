import { query } from '../db/postgres.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import { decrypt } from '../utils/encryption.js';
import { fetchEmails } from '../services/imapService.js';
import { generateAIResponse } from '../services/aiService.js';
import { emailsReceived, imapPolls } from '../utils/metrics.js';
import type { EmailAccount } from '../types/index.js';

let pollInterval: ReturnType<typeof setInterval> | null = null;

const pollAccount = async (account: EmailAccount): Promise<void> => {
  try {
    const imapPassword = decrypt(account.imap_password_encrypted);

    const emails = await fetchEmails({
      host: account.imap_host,
      port: account.imap_port,
      tls: account.imap_secure,
      user: account.imap_username,
      password: imapPassword,
      maxEmails: config.imapMaxEmailsPerPoll,
    });

    for (const email of emails) {
      // Check if already stored
      const existing = await query<{ id: string }>(
        'SELECT id FROM emails WHERE message_id = $1 AND account_id = $2',
        [email.messageId, account.id]
      );
      if (existing.length > 0) continue;

      // Store email
      await query(
        `INSERT INTO emails (tenant_id, account_id, message_id, direction, from_address, to_addresses, cc_addresses, subject, body_text, body_html)
         VALUES ($1, $2, $3, 'inbound', $4, $5, $6, $7, $8, $9)`,
        [account.tenant_id, account.id, email.messageId, email.from, JSON.stringify(email.to), JSON.stringify(email.cc), email.subject, email.textBody, email.htmlBody]
      );

      emailsReceived.inc({ tenant_id: account.tenant_id });

      // AI processing
      if (account.ai_enabled && email.textBody) {
        const aiResponse = await generateAIResponse(email.textBody, email.subject, account.tenant_id);
        if (aiResponse) {
          await query(
            'UPDATE emails SET ai_processed = true, ai_draft_response = $1 WHERE message_id = $2 AND account_id = $3',
            [aiResponse, email.messageId, account.id]
          );
        }
      }
    }

    // Update last sync
    await query('UPDATE email_accounts SET last_sync_at = NOW() WHERE id = $1', [account.id]);
    imapPolls.inc({ status: 'success' });
  } catch (err) {
    imapPolls.inc({ status: 'error' });
    logger.error({ err: (err as Error).message, accountId: account.id }, 'IMAP poll failed for account');
  }
};

const pollAllAccounts = async (): Promise<void> => {
  try {
    const accounts = await query<EmailAccount>(
      'SELECT * FROM email_accounts WHERE is_active = true'
    );

    logger.info({ accounts: accounts.length }, 'IMAP poll cycle started');

    for (const account of accounts) {
      await pollAccount(account);
    }
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'IMAP poll cycle failed');
  }
};

export const startImapPoller = (): void => {
  logger.info({ intervalSeconds: config.imapPollIntervalSeconds }, 'Starting IMAP poller');
  pollInterval = setInterval(pollAllAccounts, config.imapPollIntervalSeconds * 1000);
  // Run immediately on start
  pollAllAccounts();
};

export const stopImapPoller = (): void => {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    logger.info('IMAP poller stopped');
  }
};
