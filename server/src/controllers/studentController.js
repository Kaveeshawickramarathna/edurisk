const bcrypt = require('bcrypt');
const db = require('../config/db');
const { validateStrongPassword } = require('../utils/passwordValidator');
const { validateAndConsumeOtpToken } = require('./otpController');

async function lecturerCanAccessStudent(lecturerId, studentId) {
  const res = await db.query(
    `SELECT 1
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     WHERE c.lecturer_id = $1 AND e.student_id = $2
     LIMIT 1`,
    [lecturerId, studentId]
  );
  return res.rows.length > 0;
}

const listStudents = async (req, res) => {
  try {
    const { search, major, courseId, riskLevel } = req.query;
    const params = [];
    const conditions = [];

    if (req.user.role === 'LECTURER') {
      params.push(req.user.lecturerId);
      conditions.push(`EXISTS (
        SELECT 1 FROM enrollments e2
        JOIN courses c2 ON c2.id = e2.course_id
        WHERE e2.student_id = s.id AND c2.lecturer_id = $${params.length}
      )`);
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      const idx = params.length;
      conditions.push(`(
        LOWER(s.first_name || ' ' || s.last_name) LIKE $${idx}
        OR LOWER(s.student_identifier) LIKE $${idx}
        OR LOWER(u.email) LIKE $${idx}
      )`);
    }

    if (major && major !== 'ALL') {
      params.push(major);
      conditions.push(`s.major = $${params.length}`);
    }

    if (courseId && courseId !== 'ALL') {
      params.push(Number(courseId));
      conditions.push(`EXISTS (
        SELECT 1 FROM enrollments e3
        WHERE e3.student_id = s.id AND e3.course_id = $${params.length}
      )`);
    }

    if (riskLevel && ['LOW', 'MEDIUM', 'HIGH'].includes(riskLevel)) {
      params.push(riskLevel);
      conditions.push(`lp.risk_level = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT
         s.id, s.user_id, s.student_identifier, s.first_name, s.last_name,
         s.major, s.year_of_study, u.email, u.email_verified, u.is_active,
         COALESCE(ROUND(AVG(ar.attendance_percentage)::numeric, 1), 0)::float AS avg_attendance,
         COALESCE(ROUND(AVG(ar.assignment_score)::numeric, 1), 0)::float AS avg_assignment,
         COALESCE(ROUND(AVG(ar.quiz_score)::numeric, 1), 0)::float AS avg_quiz,
         COALESCE(ROUND(AVG(ar.previous_gpa)::numeric, 2), 0)::float AS avg_gpa,
         COALESCE(ROUND(AVG(ar.missed_submissions)::numeric, 0), 0)::int AS avg_missed,
         COALESCE(ROUND(AVG(ar.lms_activity_score)::numeric, 1), 0)::float AS avg_lms,
         COUNT(DISTINCT e.id)::int AS enrolled_courses,
         lp.risk_level,
         lp.probability::float AS risk_probability,
         lp.model_name,
         lp.is_demo,
         lp.generated_at AS last_predicted_at,
         (SELECT COUNT(*)::int FROM interventions i WHERE i.student_id = s.id) AS intervention_count
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN enrollments e ON e.student_id = s.id
       LEFT JOIN academic_records ar ON ar.enrollment_id = e.id
       LEFT JOIN LATERAL (
         SELECT risk_level, probability, model_name, is_demo, generated_at
         FROM risk_predictions rp
         WHERE rp.student_id = s.id
         ORDER BY rp.generated_at DESC, rp.id DESC
         LIMIT 1
       ) lp ON TRUE
       ${whereClause}
       GROUP BY s.id, u.email, u.email_verified, u.is_active, lp.risk_level, lp.probability, lp.model_name, lp.is_demo, lp.generated_at
       ORDER BY
         CASE lp.risk_level WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 ELSE 4 END,
         s.student_identifier ASC`,
      params
    );

    res.json({ students: result.rows });
  } catch (err) {
    console.error('listStudents error:', err);
    res.status(500).json({ error: 'Failed to load students' });
  }
};

async function fetchFullStudentDetail(studentId, { onlyStudentVisibleInterventions = false } = {}) {
  const stuRes = await db.query(
    `SELECT s.id, s.user_id, s.student_identifier, s.first_name, s.last_name,
            s.major, s.year_of_study, s.created_at, u.email, u.email_verified, u.is_active
     FROM students s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1`,
    [studentId]
  );
  if (stuRes.rows.length === 0) return null;

  const recordsRes = await db.query(
    `SELECT
       e.id AS enrollment_id, e.semester,
       c.id AS course_id, c.code AS course_code, c.name AS course_name, c.credits, c.department,
       l.first_name AS lecturer_first_name, l.last_name AS lecturer_last_name,
       ar.id AS record_id,
       ar.attendance_percentage::float AS attendance_percentage,
       ar.assignment_score::float AS assignment_score,
       ar.quiz_score::float AS quiz_score,
       ar.previous_gpa::float AS previous_gpa,
       ar.missed_submissions::int AS missed_submissions,
       ar.lms_activity_score::float AS lms_activity_score,
       ar.notes, ar.updated_at
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     LEFT JOIN lecturers l ON l.id = c.lecturer_id
     LEFT JOIN academic_records ar ON ar.enrollment_id = e.id
     WHERE e.student_id = $1
     ORDER BY c.code ASC`,
    [studentId]
  );

  const predsRes = await db.query(
    `SELECT id, risk_level, probability::float AS probability,
            class_probabilities, contributing_factors, suggested_actions,
            explanation_summary, model_name, is_demo, generated_at
     FROM risk_predictions
     WHERE student_id = $1
     ORDER BY generated_at DESC, id DESC
     LIMIT 10`,
    [studentId]
  );

  const intFilter = onlyStudentVisibleInterventions ? 'AND i.student_visible = TRUE' : '';
  const intRes = await db.query(
    `SELECT
       i.id, i.student_id, i.lecturer_id, i.action_type, i.notes, i.status,
       i.follow_up_date, i.student_visible, i.created_at, i.updated_at,
       l.first_name AS lecturer_first_name, l.last_name AS lecturer_last_name
     FROM interventions i
     LEFT JOIN lecturers l ON l.id = i.lecturer_id
     WHERE i.student_id = $1 ${intFilter}
     ORDER BY i.created_at DESC, i.id DESC`,
    [studentId]
  );

  const records = recordsRes.rows;
  const count = records.length || 1;
  const summary = {
    avg_attendance: records.length ? Number((records.reduce((s, r) => s + Number(r.attendance_percentage || 0), 0) / count).toFixed(1)) : 0,
    avg_assignment: records.length ? Number((records.reduce((s, r) => s + Number(r.assignment_score || 0), 0) / count).toFixed(1)) : 0,
    avg_quiz: records.length ? Number((records.reduce((s, r) => s + Number(r.quiz_score || 0), 0) / count).toFixed(1)) : 0,
    avg_gpa: records.length ? Number((records.reduce((s, r) => s + Number(r.previous_gpa || 0), 0) / count).toFixed(2)) : 0,
    avg_missed: records.length ? Math.round(records.reduce((s, r) => s + Number(r.missed_submissions || 0), 0) / count) : 0,
    avg_lms: records.length ? Number((records.reduce((s, r) => s + Number(r.lms_activity_score || 0), 0) / count).toFixed(1)) : 0,
    course_count: records.length,
  };

  return {
    student: stuRes.rows[0],
    summary,
    academicRecords: records,
    latestPrediction: predsRes.rows[0] || null,
    predictionHistory: predsRes.rows,
    interventions: intRes.rows,
  };
}

const getMyStudentProfile = async (req, res) => {
  try {
    if (!req.user.studentId) {
      return res.status(404).json({ error: 'Student profile not found' });
    }
    const detail = await fetchFullStudentDetail(req.user.studentId, {
      onlyStudentVisibleInterventions: true,
    });
    res.json(detail);
  } catch (err) {
    console.error('getMyStudentProfile error:', err);
    res.status(500).json({ error: 'Failed to load student dashboard data' });
  }
};

const getStudentById = async (req, res) => {
  const studentId = Number(req.params.id);
  try {
    if (req.user.role === 'LECTURER') {
      const allowed = await lecturerCanAccessStudent(req.user.lecturerId, studentId);
      if (!allowed) {
        return res.status(403).json({ error: 'You are not authorized to view this student' });
      }
    }

    const detail = await fetchFullStudentDetail(studentId);
    if (!detail) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(detail);
  } catch (err) {
    console.error('getStudentById error:', err);
    res.status(500).json({ error: 'Failed to load student detail' });
  }
};

const createStudent = async (req, res) => {
  const {
    email,
    password = 'EduRisk@2026!',
    studentIdentifier,
    firstName,
    lastName,
    verificationToken = '',
    major,
    yearOfStudy,
    courseIds = [],
  } = req.body;

  if (!email || !firstName || !lastName) {
    return res.status(400).json({ error: 'Email, firstName, and lastName are required' });
  }
  const pwCheck = validateStrongPassword(password);
  if (!pwCheck.valid) {
    return res.status(400).json({ error: pwCheck.error });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const exists = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const settingsRes = await db.query('SELECT current_semester FROM academic_settings WHERE id = 1');
    const semester = settingsRes.rows[0]?.current_semester || '2026-S2';

    const student = await db.withTransaction(async (tx) => {
      let emailVerified = false;
      if (verificationToken) {
        const verified = await validateAndConsumeOtpToken(tx, normalizedEmail, verificationToken);
        if (!verified) {
          const err = new Error('Email OTP verification token is invalid or expired');
          err.statusCode = 400;
          throw err;
        }
        emailVerified = true;
      }

      const uRes = await tx.query(
        `INSERT INTO users (email, password_hash, role, email_verified) VALUES ($1, $2, 'STUDENT', $3) RETURNING id`,
        [normalizedEmail, passwordHash, emailVerified]
      );
      const userId = uRes.rows[0].id;
      const code = (studentIdentifier && studentIdentifier.trim()) || `STU${1000 + userId}`;

      const sRes = await tx.query(
        `INSERT INTO students (user_id, student_identifier, first_name, last_name, major, year_of_study)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [userId, code, firstName.trim(), lastName.trim(), major || 'Computer Science', Number(yearOfStudy) || 1]
      );
      const stu = sRes.rows[0];

      if (Array.isArray(courseIds) && courseIds.length > 0) {
        for (const cid of courseIds) {
          const enrRes = await tx.query(
            `INSERT INTO enrollments (student_id, course_id, semester)
             VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id`,
            [stu.id, Number(cid), semester]
          );
          if (enrRes.rows[0]) {
            await tx.query(
              `INSERT INTO academic_records (
                enrollment_id, attendance_percentage, assignment_score, quiz_score,
                previous_gpa, missed_submissions, lms_activity_score, notes, updated_by
              ) VALUES ($1, 0, 0, 0, 0.00, 0, 0, 'Awaiting academic record entry', $2)`,
              [enrRes.rows[0].id, req.user.id]
            );
          }
        }
      }
      return stu;
    });

    res.status(201).json({ message: 'Student created successfully', student });
  } catch (err) {
    console.error('createStudent error:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Student email or identifier already exists' });
    }
    res.status(500).json({ error: 'Failed to create student' });
  }
};

const updateStudent = async (req, res) => {
  const studentId = Number(req.params.id);
  const { firstName, lastName, major, yearOfStudy, studentIdentifier } = req.body;

  try {
    const result = await db.query(
      `UPDATE students
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           major = COALESCE($3, major),
           year_of_study = COALESCE($4, year_of_study),
           student_identifier = COALESCE($5, student_identifier)
       WHERE id = $6
       RETURNING *`,
      [firstName || null, lastName || null, major || null, yearOfStudy ? Number(yearOfStudy) : null, studentIdentifier || null, studentId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({ message: 'Student updated', student: result.rows[0] });
  } catch (err) {
    console.error('updateStudent error:', err);
    res.status(500).json({ error: 'Failed to update student' });
  }
};

const deleteStudent = async (req, res) => {
  const studentId = Number(req.params.id);
  try {
    const stuRes = await db.query('SELECT user_id FROM students WHERE id = $1', [studentId]);
    if (stuRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    await db.query('DELETE FROM users WHERE id = $1', [stuRes.rows[0].user_id]);
    res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    console.error('deleteStudent error:', err);
    res.status(500).json({ error: 'Failed to delete student' });
  }
};

module.exports = {
  lecturerCanAccessStudent,
  listStudents,
  getMyStudentProfile,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
};
