import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

/**
 * @name getMailTransporter
 * @description [Infrastructure]: Singleton transporter provider for Gmail SMTP delivery via Nodemailer.
 * Automatically sanitizes whitespace in 16-character Google App Passwords (e.g. 'abcd efgh ijkl mnop').
 * Returns null if required environment credentials (GMAIL_USER, GMAIL_APP_PASSWORD) are unset.
 */
let _transporter: Transporter<SMTPTransport.SentMessageInfo> | null = null;

export function getMailTransporter(): Transporter<SMTPTransport.SentMessageInfo> | null {
  const user = process.env.GMAIL_USER?.trim();
  const rawPass = process.env.GMAIL_APP_PASSWORD?.trim();

  if (!user || !rawPass) {
    return null;
  }

  // Sanitize 16-character app password by removing any chunk spacing provided by Google UI
  const pass = rawPass.replace(/\s+/g, '');

  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });
  }

  return _transporter;
}
