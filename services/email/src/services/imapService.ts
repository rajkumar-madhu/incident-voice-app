import Imap from 'imap';
import { logger } from '../utils/logger.js';

export interface FetchedEmail {
  messageId: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  textBody: string;
  htmlBody: string | null;
  date: Date;
}

export const fetchEmails = (config: {
  host: string; port: number; tls: boolean;
  user: string; password: string;
  maxEmails: number;
}): Promise<FetchedEmail[]> => {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: config.user,
      password: config.password,
      host: config.host,
      port: config.port,
      tls: config.tls,
      tlsOptions: { rejectUnauthorized: false },
    });

    const emails: FetchedEmail[] = [];

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err, box) => {
        if (err) { imap.end(); return reject(err); }
        if (!box.messages.total) { imap.end(); return resolve([]); }

        const fetchCount = Math.min(config.maxEmails, box.messages.total);
        const start = Math.max(1, box.messages.total - fetchCount + 1);
        const f = imap.seq.fetch(`${start}:*`, { bodies: ['HEADER.FIELDS (FROM TO CC SUBJECT MESSAGE-ID DATE)', 'TEXT'], struct: true });

        f.on('message', (msg) => {
          const email: Partial<FetchedEmail> = {};
          msg.on('body', (stream, info) => {
            let buffer = '';
            stream.on('data', (chunk) => { buffer += chunk.toString('utf8'); });
            stream.once('end', () => {
              if (info.which.includes('HEADER')) {
                const headers = Imap.parseHeader(buffer);
                email.messageId = headers['message-id']?.[0] || '';
                email.from = headers.from?.[0] || '';
                email.to = headers.to || [];
                email.cc = headers.cc || [];
                email.subject = headers.subject?.[0] || '';
                email.date = headers.date?.[0] ? new Date(headers.date[0]) : new Date();
              } else {
                email.textBody = buffer;
              }
            });
          });
          msg.once('end', () => {
            emails.push({
              messageId: email.messageId || '',
              from: email.from || '',
              to: email.to || [],
              cc: email.cc || [],
              subject: email.subject || '',
              textBody: email.textBody || '',
              htmlBody: email.htmlBody || null,
              date: email.date || new Date(),
            });
          });
        });

        f.once('error', (err) => { logger.error({ err }, 'IMAP fetch error'); });
        f.once('end', () => { imap.end(); resolve(emails); });
      });
    });

    imap.once('error', (err: Error) => { reject(err); });
    imap.connect();
  });
};
