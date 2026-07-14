const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let transporter = null;

/**
 * Detect environment
 */
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Create transporter (lazy init)
 */
const getTransporter = () => {
  if (transporter) return transporter;

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_SERVICE
  } = process.env;

  // =========================
  // 1. Gmail shortcut
  // =========================
  if (SMTP_SERVICE === 'gmail') {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    return transporter;
  }

  // =========================
  // 2. Generic SMTP (SendGrid, Mailgun, custom SMTP)
  // =========================
  if (SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT) || 587,
      secure: parseInt(SMTP_PORT) === 465,

      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },

      // 🔥 FIX: prevent self-signed cert failure in dev
      tls: {
  rejectUnauthorized: false
}
    });

    return transporter;
  }

  // =========================
  // 3. No SMTP config → fallback to Ethereal
  // =========================
  logger.warn('[Email] No SMTP config found. Using Ethereal fallback mode.');
  return null;
};

/**
 * Build HTML email body for alert
 */
const buildAlertEmail = (alert) => {
  const SEVERITY_COLORS = {
    critical: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
  };

  const color = SEVERITY_COLORS[alert.severity] || '#3b82f6';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
</head>

<body style="margin:0;padding:0;background:#0f172a;font-family:Segoe UI,Arial,sans-serif;">

  <div style="max-width:560px;margin:40px auto;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">

    <!-- Header -->
    <div style="background:${color};padding:20px 28px;">
      <div style="color:#fff;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;opacity:0.8;">
        NetraX Alert — ${alert.severity.toUpperCase()}
      </div>
      <div style="color:#fff;font-size:20px;font-weight:800;margin-top:6px;">
        ${alert.title}
      </div>
    </div>

    <!-- Body -->
    <div style="padding:24px 28px;">
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 20px;">
        ${alert.message}
      </p>

      <table style="width:100%;border-collapse:collapse;">

        ${alert.deviceName ? `
        <tr>
          <td style="color:#475569;font-size:12px;padding:8px 0;border-bottom:1px solid #334155;width:130px;">Device</td>
          <td style="color:#f1f5f9;font-size:12px;padding:8px 0;border-bottom:1px solid #334155;">${alert.deviceName}</td>
        </tr>` : ''}

        ${alert.ipAddress ? `
        <tr>
          <td style="color:#475569;font-size:12px;padding:8px 0;border-bottom:1px solid #334155;">IP Address</td>
          <td style="color:#f1f5f9;font-size:12px;padding:8px 0;border-bottom:1px solid #334155;font-family:monospace;">${alert.ipAddress}</td>
        </tr>` : ''}

        ${alert.metric?.name ? `
        <tr>
          <td style="color:#475569;font-size:12px;padding:8px 0;border-bottom:1px solid #334155;">Metric</td>
          <td style="color:#f1f5f9;font-size:12px;padding:8px 0;border-bottom:1px solid #334155;">
            ${alert.metric.name}: 
            <strong style="color:${color};">${alert.metric.value}</strong>
            (threshold: ${alert.metric.threshold})
          </td>
        </tr>` : ''}

        <tr>
          <td style="color:#475569;font-size:12px;padding:8px 0;border-bottom:1px solid #334155;">Category</td>
          <td style="color:#f1f5f9;font-size:12px;padding:8px 0;border-bottom:1px solid #334155;">
            ${alert.category}
          </td>
        </tr>

        <tr>
          <td style="color:#475569;font-size:12px;padding:8px 0;">Time</td>
          <td style="color:#f1f5f9;font-size:12px;padding:8px 0;">
            ${new Date(alert.firedAt).toLocaleString()}
          </td>
        </tr>

      </table>
    </div>

    <!-- CTA -->
    <div style="padding:0 28px 24px;">
      <a href="http://localhost:5173/alerts"
         style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:10px 22px;border-radius:6px;font-size:13px;font-weight:600;">
        View in NetraX Dashboard →
      </a>
    </div>

    <!-- Footer -->
    <div style="padding:14px 28px;border-top:1px solid #334155;background:#0f172a;">
      <p style="color:#334155;font-size:11px;margin:0;">
        NetraX Intelligent Network Management System
      </p>
    </div>

  </div>
</body>
</html>
`;
};

/**
 * Send alert email
 */
const sendAlertEmail = async (alert, recipients = []) => {
  if (!recipients.length) {
    logger.debug('[Email] No recipients — skipping email');
    return { sent: false, reason: 'no_recipients' };
  }

  const t = getTransporter();

  // =========================
  // DEV MODE (Ethereal fallback)
  // =========================
  if (!t) {
    try {
      const testAccount = await nodemailer.createTestAccount();

      const devTransporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },

        // 🔥 safety fix
        tls: {
          rejectUnauthorized: false,
        },
      });

      const info = await devTransporter.sendMail({
        from: `"NetraX Alerts" <netrax@monitor.local>`,
        to: recipients.join(', '),
        subject: `[NetraX ${alert.severity.toUpperCase()}] ${alert.title}`,
        html: buildAlertEmail(alert),
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);

      logger.info(`[Email] Dev preview URL: ${previewUrl}`);

      return {
        sent: true,
        preview: previewUrl,
        messageId: info.messageId,
      };
    } catch (err) {
      logger.error(`[Email] Ethereal fallback failed: ${err.message}`);
      return { sent: false, reason: err.message };
    }
  }

  // =========================
  // PRODUCTION / SMTP MODE
  // =========================
  try {
    const info = await t.sendMail({
      from: `"NetraX Alerts" <${process.env.SMTP_USER || 'netrax@monitor.local'}>`,
      to: recipients.join(', '),
      subject: `[NetraX ${alert.severity.toUpperCase()}] ${alert.title}`,
      html: buildAlertEmail(alert),
    });

    logger.info(`[Email] Sent successfully — ${info.messageId}`);

    return {
      sent: true,
      messageId: info.messageId,
    };
  } catch (err) {
    logger.error(`[Email] Send failed: ${err.message}`);
    return {
      sent: false,
      reason: err.message,
    };
  }
};

/**
 * Verify SMTP connection
 */
const verifyConnection = async () => {
  const t = getTransporter();

  if (!t) {
    return {
      ok: false,
      message: 'No SMTP config — running in Ethereal dev mode',
    };
  }

  try {
    await t.verify();
    return {
      ok: true,
      message: 'SMTP connection verified',
    };
  } catch (err) {
    return {
      ok: false,
      message: err.message,
    };
  }
};

module.exports = {
  sendAlertEmail,
  verifyConnection,
  buildAlertEmail,
};