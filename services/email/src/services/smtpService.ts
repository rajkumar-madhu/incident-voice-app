import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

interface SmtpConfig {
  host: string; port: number; secure: boolean;
  user: string; password: string;
}

interface SendOptions {
  from: string; to: string[];
  cc?: string[]; bcc?: string[];
  subject: string; text: string; html?: string;
  inReplyTo?: string;
}

export const sendEmail = async (smtpConfig: SmtpConfig, options: SendOptions): Promise<{ messageId: string }> => {
  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: { user: smtpConfig.user, pass: smtpConfig.password },
  });

  const info = await transporter.sendMail({
    from: options.from,
    to: options.to.join(', '),
    cc: options.cc?.join(', '),
    bcc: options.bcc?.join(', '),
    subject: options.subject,
    text: options.text,
    html: options.html,
    inReplyTo: options.inReplyTo,
  });

  logger.info({ messageId: info.messageId, to: options.to }, 'Email sent');
  return { messageId: info.messageId };
};
