const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { normalizeEmail, sendOtpEmail } = require('../services/emailService');

const OTP_EXPIRY_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 30;
const MAX_ATTEMPTS = 5;

const sendOtp = async (req, res) => {
  const { email, studentName = '', purpose = 'STUDENT_REGISTER' } = req.body;
  const normalized = normalizeEmail(email);

  if (!normalized) {
    return res.status(400).json({
      error: 'Please enter a valid email address (e.g. name@gmail.com)',
    });
  }

  try {
    let resolvedName = studentName.trim();
    if (purpose === 'STUDENT_REGISTER') {
      const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [normalized]);
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'An account with this email already exists' });
      }
    } else if (purpose === 'PASSWORD_RESET') {
      const existingUser = await db.query(
        `SELECT u.id, u.is_active,
                COALESCE(s.first_name, l.first_name, 'User') AS first_name
         FROM users u
         LEFT JOIN students s ON s.user_id = u.id
         LEFT JOIN lecturers l ON l.user_id = u.id
         WHERE u.email = $1`,
        [normalized]
      );
      if (existingUser.rows.length === 0) {
        return res.status(404).json({ error: 'No account found with this email address' });
      }
      if (!existingUser.rows[0].is_active) {
        return res.status(403).json({ error: 'This account is deactivated. Contact your administrator.' });
      }
      if (!resolvedName) resolvedName = existingUser.rows[0].first_name;
    }

    // Cooldown rate limit (30 seconds between OTP requests for same email)
    const recent = await db.query(
      `SELECT EXTRACT(EPOCH FROM (NOW() - created_at))::float AS elapsed_sec
       FROM otp_verifications
       WHERE email = $1
       ORDER BY created_at DESC LIMIT 1`,
      [normalized]
    );
    if (recent.rows.length > 0) {
      const diffSec = Number(recent.rows[0].elapsed_sec);
      if (diffSec >= 0 && diffSec < RESEND_COOLDOWN_SECONDS) {
        const waitSec = Math.ceil(RESEND_COOLDOWN_SECONDS - diffSec);
        return res.status(429).json({
          error: `Please wait ${waitSec}s before requesting another OTP`,
          retryAfter: waitSec,
        });
      }
    }

    const otpCode = String(crypto.randomInt(100000, 1000000));
    const otpHash = await bcrypt.hash(otpCode, 8);

    // Send email FIRST so a failed SMTP delivery never triggers the cooldown
    const mailResult = await sendOtpEmail({
      email: normalized,
      studentName: resolvedName,
      otpCode,
      purpose,
    });

    await db.query(
      `INSERT INTO otp_verifications (email, student_name, otp_hash, purpose, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '${OTP_EXPIRY_MINUTES} minutes')`,
      [normalized, resolvedName, otpHash, purpose]
    );

    res.status(200).json({
      message: mailResult.isDemo
        ? `Demo Email OTP generated for ${normalized}`
        : `Verification OTP sent to ${normalized}! Check your inbox.`,
      email: normalized,
      expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
      provider: mailResult.provider,
      isDemo: mailResult.isDemo,
      ...(mailResult.isDemo
        ? { demoOtp: mailResult.demoOtp, messagePreview: mailResult.messagePreview }
        : {}),
    });
  } catch (err) {
    console.error('sendOtp error:', err);
    res.status(500).json({ error: err.message || 'Failed to send email OTP' });
  }
};

const verifyOtp = async (req, res) => {
  const { email, otpCode } = req.body;
  const normalized = normalizeEmail(email);

  if (!normalized || !otpCode || !/^\d{6}$/.test(String(otpCode).trim())) {
    return res.status(400).json({ error: 'Valid email address and 6-digit OTP code are required' });
  }

  try {
    const latestRes = await db.query(
      `SELECT *, (expires_at < NOW()) AS is_expired FROM otp_verifications
       WHERE email = $1 AND consumed = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [normalized]
    );

    if (latestRes.rows.length === 0) {
      return res.status(400).json({ error: 'No active OTP found for this email. Please request a new OTP.' });
    }

    const record = latestRes.rows[0];
    if (record.attempts >= MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'Maximum OTP attempts exceeded. Please request a new OTP.' });
    }
    if (record.is_expired) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new code.' });
    }

    const isMatch = await bcrypt.compare(String(otpCode).trim(), record.otp_hash);
    if (!isMatch) {
      await db.query('UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1', [record.id]);
      const remaining = MAX_ATTEMPTS - (record.attempts + 1);
      return res.status(400).json({
        error: `Invalid OTP code. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : 'Please request a new OTP.'}`,
      });
    }

    const verificationToken = crypto.randomBytes(24).toString('hex');
    await db.query(
      `UPDATE otp_verifications
       SET verified = TRUE, verification_token = $1
       WHERE id = $2`,
      [verificationToken, record.id]
    );

    res.json({
      verified: true,
      message: 'Email address verified successfully',
      email: normalized,
      verificationToken,
    });
  } catch (err) {
    console.error('verifyOtp error:', err);
    res.status(500).json({ error: 'OTP verification failed' });
  }
};

async function validateAndConsumeOtpToken(tx, email, verificationToken) {
  const normalized = normalizeEmail(email);
  if (!normalized || !verificationToken) return null;

  const res = await tx.query(
    `SELECT id, email FROM otp_verifications
     WHERE email = $1
       AND verification_token = $2
       AND verified = TRUE
       AND consumed = FALSE
       AND expires_at > NOW() - INTERVAL '15 minutes'
     ORDER BY created_at DESC LIMIT 1`,
    [normalized, verificationToken]
  );

  if (res.rows.length === 0) return null;
  await tx.query('UPDATE otp_verifications SET consumed = TRUE WHERE id = $1', [res.rows[0].id]);
  return normalized;
}

module.exports = {
  sendOtp,
  verifyOtp,
  validateAndConsumeOtpToken,
};
