require('dotenv').config();

function normalizeEmail(raw) {
  if (!raw) return '';
  const cleaned = String(raw).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    return '';
  }
  return cleaned;
}

function buildOtpHtml({ studentName, otpCode, purpose = 'STUDENT_REGISTER' }) {
  const greeting = studentName ? `Hi ${studentName},` : 'Hello,';
  const isReset = purpose === 'PASSWORD_RESET';
  const title = isReset ? 'EduRisk Password Reset Code' : 'EduRisk Verification Code';
  const body = isReset
    ? 'Use the 6-digit code below to verify your email address and reset your EduRisk account password:'
    : 'Use the 6-digit verification code below to verify your email address and complete your EduRisk registration:';
  return `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 32px; border-radius: 16px;">
      <h2 style="margin: 0 0 8px; color: #ffffff;">${title}</h2>
      <p style="margin: 0 0 20px; color: #94a3b8; font-size: 13px;">AI-Based Academic Risk Prediction &amp; Early Support System</p>
      <p style="font-size: 14px; line-height: 1.6;">${greeting}</p>
      <p style="font-size: 14px; line-height: 1.6;">${body}</p>
      <div style="margin: 24px 0; padding: 18px; background: #1e293b; border: 1px solid #334155; border-radius: 12px; text-align: center;">
        <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #818cf8;">${otpCode}</span>
      </div>
      <p style="font-size: 12px; color: #94a3b8;">This code expires in <strong>5 minutes</strong>. If you did not request this, you can safely ignore this email.</p>
    </div>
  `;
}

async function sendOtpEmail({ email, studentName, otpCode, purpose = 'STUDENT_REGISTER' }) {
  const greeting = studentName ? `Hi ${studentName}, ` : '';
  const isReset = purpose === 'PASSWORD_RESET';
  const textMessage = isReset
    ? `${greeting}your EduRisk password reset OTP is ${otpCode}. Valid for 5 minutes. Do not share this code.`
    : `${greeting}your EduRisk email verification OTP is ${otpCode}. Valid for 5 minutes. Do not share this code.`;

  const provider = (process.env.EMAIL_PROVIDER || 'gmail').toLowerCase();
  const subject = isReset
    ? `${otpCode} is your EduRisk Password Reset Code`
    : `${otpCode} is your EduRisk Verification Code`;
  const html = buildOtpHtml({ studentName, otpCode, purpose });

  if (provider === 'demo') {
    console.log(`\n[EMAIL OTP TEST] To: ${email}\n[EMAIL OTP TEST] Message: ${textMessage}\n`);
    return {
      provider: 'demo',
      delivered: true,
      isDemo: true,
      demoOtp: otpCode,
      messagePreview: textMessage,
    };
  }

  // Option A: Google Apps Script Web App (HTTPS port 443 — bypasses ISP SMTP port blocks!)
  if (provider === 'appscript') {
    const webhookUrl = (process.env.APPSCRIPT_WEBHOOK_URL || '').trim();
    if (!webhookUrl) {
      throw new Error('APPSCRIPT_WEBHOOK_URL is missing in edurisk/server/.env');
    }
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: email, subject, text: textMessage, html }),
      redirect: 'follow',
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Google Apps Script error (HTTP ${res.status}): ${text.slice(0, 150)}`);
    }
    return { provider: 'appscript', delivered: true, isDemo: false };
  }

  // Option B: Brevo HTTPS Email API (300 free emails/day over HTTPS port 443)
  if (provider === 'brevo') {
    const apiKey = (process.env.BREVO_API_KEY || '').trim();
    const senderEmail = (process.env.SMTP_USER || '').trim();
    if (!apiKey || !senderEmail) {
      throw new Error('BREVO_API_KEY and SMTP_USER are required in edurisk/server/.env');
    }
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'EduRisk University', email: senderEmail },
        to: [{ email, name: studentName || email }],
        subject,
        htmlContent: html,
        textContent: textMessage,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Brevo API error (HTTP ${res.status})`);
    }
    return { provider: 'brevo', delivered: true, isDemo: false };
  }

  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

  if (!smtpUser || !smtpPass) {
    throw new Error(
      'Gmail SMTP not configured yet! Add your Gmail address (SMTP_USER) and 16-letter Gmail App Password (SMTP_PASS) in edurisk/server/.env'
    );
  }

  const nodemailer = require('nodemailer');
  const host = provider === 'gmail' ? 'smtp.gmail.com' : process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = provider === 'gmail' ? 587 : Number(process.env.SMTP_PORT || 587);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    family: 4, // Force IPv4 to avoid IPv6 ENETUNREACH on Windows/ISP networks
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 15000,
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `EduRisk University <${smtpUser}>`,
    to: email,
    subject,
    text: textMessage,
    html,
  });

  return {
    provider,
    delivered: true,
    isDemo: false,
  };
}

module.exports = {
  normalizeEmail,
  sendOtpEmail,
};
