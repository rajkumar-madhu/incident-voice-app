import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/postgres.js';
import { logger } from '../utils/logger.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import type { EmailAccount, CreateEmailAccount, UpdateEmailAccount } from '../types/index.js';

export const createAccount = async (tenantId: string, data: CreateEmailAccount): Promise<Omit<EmailAccount, 'imap_password_encrypted' | 'smtp_password_encrypted'>> => {
  const id = uuidv4();
  const imapPasswordEncrypted = encrypt(data.imap_password);
  const smtpPasswordEncrypted = encrypt(data.smtp_password);

  const rows = await query<EmailAccount>(
    `INSERT INTO email_accounts (id, tenant_id, email_address, display_name, imap_host, imap_port, imap_secure, imap_username, imap_password_encrypted, smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password_encrypted, ai_enabled, ai_auto_reply)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
    [id, tenantId, data.email_address, data.display_name, data.imap_host, data.imap_port, data.imap_secure, data.imap_username, imapPasswordEncrypted, data.smtp_host, data.smtp_port, data.smtp_secure, data.smtp_username, smtpPasswordEncrypted, data.ai_enabled, data.ai_auto_reply]
  );

  logger.info({ accountId: id, tenantId, email: data.email_address }, 'Email account created');
  const { imap_password_encrypted: _imap, smtp_password_encrypted: _smtp, ...safe } = rows[0];
  return safe;
};

export const getAccounts = async (tenantId: string): Promise<Omit<EmailAccount, 'imap_password_encrypted' | 'smtp_password_encrypted'>[]> => {
  const rows = await query<EmailAccount>(
    'SELECT * FROM email_accounts WHERE tenant_id = $1 AND is_active = true ORDER BY created_at DESC',
    [tenantId]
  );
  return rows.map(({ imap_password_encrypted: _imap, smtp_password_encrypted: _smtp, ...safe }) => safe);
};

export const getAccount = async (tenantId: string, accountId: string): Promise<EmailAccount | null> => {
  const rows = await query<EmailAccount>(
    'SELECT * FROM email_accounts WHERE id = $1 AND tenant_id = $2',
    [accountId, tenantId]
  );
  return rows[0] || null;
};

export const updateAccount = async (tenantId: string, accountId: string, data: UpdateEmailAccount): Promise<Omit<EmailAccount, 'imap_password_encrypted' | 'smtp_password_encrypted'> | null> => {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 3;

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (key === 'imap_password') {
      updates.push(`imap_password_encrypted = $${paramIndex++}`);
      values.push(encrypt(value as string));
    } else if (key === 'smtp_password') {
      updates.push(`smtp_password_encrypted = $${paramIndex++}`);
      values.push(encrypt(value as string));
    } else {
      updates.push(`${key} = $${paramIndex++}`);
      values.push(value);
    }
  }

  if (updates.length === 0) return null;
  updates.push(`updated_at = NOW()`);

  const rows = await query<EmailAccount>(
    `UPDATE email_accounts SET ${updates.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`,
    [accountId, tenantId, ...values]
  );

  if (rows.length === 0) return null;
  const { imap_password_encrypted: _imap, smtp_password_encrypted: _smtp, ...safe } = rows[0];
  return safe;
};

export const deleteAccount = async (tenantId: string, accountId: string): Promise<boolean> => {
  const rows = await query<{ id: string }>(
    'UPDATE email_accounts SET is_active = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING id',
    [accountId, tenantId]
  );
  return rows.length > 0;
};

export const getAccountWithCredentials = async (tenantId: string, accountId: string) => {
  const account = await getAccount(tenantId, accountId);
  if (!account) return null;
  return {
    ...account,
    imap_password: decrypt(account.imap_password_encrypted),
    smtp_password: decrypt(account.smtp_password_encrypted),
  };
};
