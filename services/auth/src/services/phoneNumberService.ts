import { query } from '../db/postgres.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, ConflictError } from '../middleware/errorHandler.js';
import type { CreatePhoneNumber, UpdatePhoneNumber, PhoneNumber } from '../types/dashboard.js';

export const createPhoneNumber = async (
  tenantId: string,
  data: CreatePhoneNumber
): Promise<PhoneNumber> => {
  const existing = await query<{ id: string }>(
    'SELECT id FROM phone_numbers WHERE phone_number = $1',
    [data.phone_number]
  );

  if (existing.length > 0) {
    throw new ConflictError('Phone number already registered');
  }

  const numbers = await query<PhoneNumber>(
    `INSERT INTO phone_numbers (tenant_id, phone_number, friendly_name, twilio_sid, agent_id, capabilities)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [tenantId, data.phone_number, data.friendly_name || null, data.twilio_sid || null, data.agent_id || null, data.capabilities]
  );

  logger.info({ phoneId: numbers[0].id, tenantId }, 'Phone number created');
  return numbers[0];
};

export const listPhoneNumbers = async (tenantId: string): Promise<PhoneNumber[]> => {
  return query<PhoneNumber>(
    `SELECT pn.*, a.name AS agent_name
     FROM phone_numbers pn
     LEFT JOIN agents a ON a.id = pn.agent_id
     WHERE pn.tenant_id = $1
     ORDER BY pn.created_at DESC`,
    [tenantId]
  );
};

export const getPhoneNumberById = async (phoneId: string, tenantId: string): Promise<PhoneNumber> => {
  const numbers = await query<PhoneNumber>(
    'SELECT * FROM phone_numbers WHERE id = $1 AND tenant_id = $2',
    [phoneId, tenantId]
  );

  if (numbers.length === 0) {
    throw new NotFoundError('Phone number');
  }

  return numbers[0];
};

export const updatePhoneNumber = async (
  phoneId: string,
  tenantId: string,
  data: UpdatePhoneNumber
): Promise<PhoneNumber> => {
  await getPhoneNumberById(phoneId, tenantId);

  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.friendly_name !== undefined) {
    fields.push(`friendly_name = $${paramIndex}`);
    values.push(data.friendly_name);
    paramIndex++;
  }

  if (data.agent_id !== undefined) {
    fields.push(`agent_id = $${paramIndex}`);
    values.push(data.agent_id);
    paramIndex++;
  }

  if (data.status !== undefined) {
    fields.push(`status = $${paramIndex}`);
    values.push(data.status);
    paramIndex++;
  }

  if (fields.length === 0) {
    return getPhoneNumberById(phoneId, tenantId);
  }

  values.push(phoneId, tenantId);
  const numbers = await query<PhoneNumber>(
    `UPDATE phone_numbers SET ${fields.join(', ')}
     WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
     RETURNING *`,
    values
  );

  logger.info({ phoneId, tenantId }, 'Phone number updated');
  return numbers[0];
};

export const deletePhoneNumber = async (phoneId: string, tenantId: string): Promise<void> => {
  await getPhoneNumberById(phoneId, tenantId);

  await query(
    `UPDATE phone_numbers SET status = 'released' WHERE id = $1 AND tenant_id = $2`,
    [phoneId, tenantId]
  );

  logger.info({ phoneId, tenantId }, 'Phone number released');
};
