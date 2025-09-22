'use strict';

const nodemailer = require('nodemailer');

/**
 * EmailService
 * Wraps nodemailer for sending report emails with attachments.
 * Uses environment variables for SMTP configuration.
 * Required env:
 *  - SMTP_HOST
 *  - SMTP_PORT
 *  - SMTP_SECURE (true/false)
 *  - SMTP_USER
 *  - SMTP_PASS
 *  - EMAIL_FROM (e.g., "Reports <no-reply@yourdomain.com>")
 */
class EmailService {
  constructor() {
    // Lazy init transporter
    this.transporter = null;
  }

  _getTransporter() {
    if (this.transporter) return this.transporter;
    const {
      SMTP_HOST,
      SMTP_PORT,
      SMTP_SECURE,
      SMTP_USER,
      SMTP_PASS,
    } = process.env;

    if (!SMTP_HOST || !SMTP_PORT) {
      throw new Error('SMTP configuration missing. Please set SMTP_HOST and SMTP_PORT in environment variables.');
    }

    this.transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: String(SMTP_SECURE || '').toLowerCase() === 'true',
      auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });

    return this.transporter;
  }

  // PUBLIC_INTERFACE
  /**
   * sendReportEmail
   * Sends an email with a single report attachment buffer.
   * @param {Object} params
   * @param {string[]} params.to Recipient email array
   * @param {string} params.subject Email subject
   * @param {string} params.text Plain text body
   * @param {string} [params.html] Optional HTML body
   * @param {Buffer} params.attachment Buffer for attachment
   * @param {string} params.filename Filename for attachment
   * @param {string} params.mimeType Attachment MIME type
   * @returns {Promise<any>}
   */
  async sendReportEmail({ to, subject, text, html, attachment, filename, mimeType }) {
    const from = process.env.EMAIL_FROM || 'Reports <no-reply@example.com>';
    const transporter = this._getTransporter();

    const info = await transporter.sendMail({
      from,
      to: (to || []).join(','),
      subject,
      text,
      html,
      attachments: [
        {
          filename,
          content: attachment,
          contentType: mimeType,
        },
      ],
    });

    return info;
  }
}

module.exports = new EmailService();
