import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendTrackingLink(input: {
    to: string;
    customerName: string;
    ticketNumber: string;
    trackingUrl: string;
  }): Promise<boolean> {
    const host = this.config.get<string>('smtp.host');
    const from = this.config.get<string>('smtp.from');
    if (!host || !from) {
      this.logger.warn('SMTP is not configured. Tracking email was not sent.');
      return false;
    }

    const port = this.config.get<number>('smtp.port') || 587;
    const user = this.config.get<string>('smtp.user');
    const pass = this.config.get<string>('smtp.pass');
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
    });

    const name = escapeHtml(input.customerName);
    const ticket = escapeHtml(input.ticketNumber);
    const url = escapeHtml(input.trackingUrl);

    await transporter.sendMail({
      from,
      to: input.to,
      subject: `Track your repair ${input.ticketNumber}`,
      text: [
        `Hello ${input.customerName},`,
        '',
        `Your repair ticket is ${input.ticketNumber}.`,
        'Open this link to see your device status:',
        input.trackingUrl,
      ].join('\n'),
      html: `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f7f8;font-family:Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f8;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:#0f766e;padding:28px 32px;">
              <div style="color:#ccfbf1;font-size:12px;letter-spacing:2px;font-weight:700;">FIXFLOW</div>
              <div style="color:#ffffff;font-size:22px;font-weight:700;margin-top:8px;">Your device is in the shop</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;color:#134e4a;">
              <p style="margin:0 0 12px;font-size:16px;">Hello ${name},</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#475569;">Your repair ticket is ready to track.</p>
              <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:14px 16px;margin-bottom:24px;">
                <div style="font-size:12px;color:#0f766e;letter-spacing:1px;">TICKET</div>
                <div style="font-size:18px;font-weight:700;margin-top:4px;">${ticket}</div>
              </div>
              <a href="${url}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:10px;">Track your device</a>
              <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#64748b;">Or copy this link:<br><a href="${url}" style="color:#0f766e;word-break:break-all;">${url}</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });
    return true;
  }
}
