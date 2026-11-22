const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function initDb() {
  await db.initConnection();
  const schemaPath = path.resolve(__dirname, '../../../database/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  await db.exec(schemaSql);

  // Idempotent column migrations for existing databases
  await db.exec(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS email VARCHAR(255);
    DO $$ BEGIN
      ALTER TABLE otp_verifications ALTER COLUMN phone_number DROP NOT NULL;
    EXCEPTION WHEN undefined_column THEN null;
    END $$;
    CREATE INDEX IF NOT EXISTS idx_otp_email_created ON otp_verifications(email, created_at DESC);
  `);

  // Ensure default academic_settings singleton row exists
  await db.query(
    `INSERT INTO academic_settings (
      id, institution_name, current_semester,
      attendance_warning_threshold, gpa_warning_threshold,
      high_risk_threshold, medium_risk_threshold
    ) VALUES (1, 'EduRisk University', '2026-S2', 75.00, 2.50, 0.65, 0.35)
    ON CONFLICT (id) DO NOTHING`
  );
}

if (require.main === module) {
  initDb()
    .then(() => {
      console.log('[InitDB] Schema initialized successfully.');
      return db.close();
    })
    .catch((err) => {
      console.error('[InitDB] Failed:', err);
      process.exit(1);
    });
}

module.exports = { initDb };
