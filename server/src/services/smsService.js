require('dotenv').config();

/**
 * Normalize Sri Lankan and international phone numbers to E.164 format.
 * Examples:
 *   0771234567   -> +94771234567
 *   94771234567  -> +94771234567
 *   +94 77 123 4567 -> +94771234567
 */
function normalizePhoneNumber(raw) {
  if (!raw) return '';
  let cleaned = String(raw).trim().replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }
  // Local Sri Lankan mobile format (07XXXXXXXX -> +947XXXXXXXX)
  if (/^0\d{9}$/.test(cleaned)) {
    return '+94' + cleaned.slice(1);
  }
  if (/^94\d{9}$/.test(cleaned)) {
    return '+' + cleaned;
  }
  if (/^\+\d{9,15}$/.test(cleaned)) {
    return cleaned;
  }
  return '';
}

async function sendViaNotifyLk(phoneE164, message) {
  const userId = process.env.NOTIFYLK_USER_ID;
  const apiKey = process.env.NOTIFYLK_API_KEY;
  const senderId = process.env.NOTIFYLK_SENDER_ID || 'NotifyDEMO';
  if (!userId || !apiKey) {
    throw new Error('Notify.lk credentials (NOTIFYLK_USER_ID, NOTIFYLK_API_KEY) are missing in .env');
  }

  // Notify.lk expects digits without leading '+' (e.g. 94771234567)
  const to = phoneE164.replace(/^\+/, '');
  const params = new URLSearchParams({
    user_id: userId,
    api_key: apiKey,
    sender_id: senderId,
    to,
    message,
  });

  const res = await fetch(`https://app.notify.lk/api/v1/send?${params.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === 'error') {
    throw new Error(data.message || `Notify.lk HTTP ${res.status}`);
  }
  return { provider: 'notifylk', delivered: true, isDemo: false };
}

async function sendViaTextLk(phoneE164, message) {
  const token = process.env.TEXTLK_API_TOKEN;
  const senderId = process.env.TEXTLK_SENDER_ID || 'TextLKDemo';
  if (!token) {
    throw new Error('Text.lk API token (TEXTLK_API_TOKEN) is missing in .env');
  }

  const recipient = phoneE164.replace(/^\+/, '');
  const res = await fetch('https://app.text.lk/api/v3/sms/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      recipient,
      sender_id: senderId,
      type: 'plain',
      message,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === 'error') {
    throw new Error(data.message || `Text.lk HTTP ${res.status}`);
  }
  return { provider: 'textlk', delivered: true, isDemo: false };
}

async function sendViaTwilio(phoneE164, message) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    throw new Error('Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER) are missing in .env');
  }

  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const body = new URLSearchParams({ To: phoneE164, From: from, Body: message });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Twilio HTTP ${res.status}`);
  }
  return { provider: 'twilio', delivered: true, isDemo: false };
}

async function sendOtpSms({ phoneNumber, studentName, otpCode }) {
  const greeting = studentName ? `Hi ${studentName}, ` : '';
  const message = `${greeting}your EduRisk verification OTP is ${otpCode}. Valid for 5 minutes. Do not share this code.`;
  const provider = (process.env.SMS_PROVIDER || 'demo').toLowerCase();

  if (provider === 'notifylk') {
    return sendViaNotifyLk(phoneNumber, message);
  }
  if (provider === 'textlk') {
    return sendViaTextLk(phoneNumber, message);
  }
  if (provider === 'twilio') {
    return sendViaTwilio(phoneNumber, message);
  }

  // Demo SMS Mode (prints to server console & returns demo preview for portfolio/local testing)
  console.log(`\n[SMS DEMO] To: ${phoneNumber}\n[SMS DEMO] Message: ${message}\n`);
  return {
    provider: 'demo',
    delivered: true,
    isDemo: true,
    demoOtp: otpCode,
    messagePreview: message,
  };
}

module.exports = {
  normalizePhoneNumber,
  sendOtpSms,
};
