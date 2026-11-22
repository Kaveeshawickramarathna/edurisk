const db = require('../config/db');
const { runAndStoreStudentPrediction } = require('../services/mlService');

function validateMetric(value, min, max, name) {
  const num = Number(value);
  if (Number.isNaN(num) || num < min || num > max) {
    return `${name} must be between ${min} and ${max}`;
  }
  return null;
}

const listAcademicRecords = async (req, res) => {
  try {
    const { courseId, studentId } = req.query;
    const params = [];
    const conditions = [];

    if (req.user.role === 'LECTURER') {
      params.push(req.user.lecturerId);
      conditions.push(`c.lecturer_id = $${params.length}`);
    }
    if (courseId && courseId !== 'ALL') {
      params.push(Number(courseId));
      conditions.push(`c.id = $${params.length}`);
    }
    if (studentId) {
      params.push(Number(studentId));
      conditions.push(`s.id = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT
         e.id AS enrollment_id, e.semester,
         s.id AS student_id, s.student_identifier, s.first_name, s.last_name, s.major,
         c.id AS course_id, c.code AS course_code, c.name AS course_name,
         ar.id AS record_id,
         ar.attendance_percentage::float AS attendance_percentage,
         ar.assignment_score::float AS assignment_score,
         ar.quiz_score::float AS quiz_score,
         ar.previous_gpa::float AS previous_gpa,
         ar.missed_submissions::int AS missed_submissions,
         ar.lms_activity_score::float AS lms_activity_score,
         ar.notes, ar.updated_at
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN courses c ON c.id = e.course_id
       LEFT JOIN academic_records ar ON ar.enrollment_id = e.id
       ${whereClause}
       ORDER BY s.student_identifier ASC, c.code ASC`,
      params
    );

    res.json({ records: result.rows });
  } catch (err) {
    console.error('listAcademicRecords error:', err);
    res.status(500).json({ error: 'Failed to load academic records' });
  }
};

const updateAcademicRecord = async (req, res) => {
  const enrollmentId = Number(req.params.enrollmentId);
  const {
    attendance_percentage,
    assignment_score,
    quiz_score,
    previous_gpa,
    missed_submissions,
    lms_activity_score,
    notes = '',
    autoPredict = true,
  } = req.body;

  const errors = [
    validateMetric(attendance_percentage, 0, 100, 'Attendance percentage'),
    validateMetric(assignment_score, 0, 100, 'Assignment score'),
    validateMetric(quiz_score, 0, 100, 'Quiz score'),
    validateMetric(previous_gpa, 0, 4, 'Previous GPA'),
    validateMetric(missed_submissions, 0, 50, 'Missed submissions'),
    validateMetric(lms_activity_score, 0, 100, 'LMS activity score'),
  ].filter(Boolean);

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  try {
    const enrRes = await db.query(
      `SELECT e.id, e.student_id, c.lecturer_id
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       WHERE e.id = $1`,
      [enrollmentId]
    );
    if (enrRes.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment record not found' });
    }

    const enrollment = enrRes.rows[0];
    if (req.user.role === 'LECTURER' && enrollment.lecturer_id !== req.user.lecturerId) {
      return res.status(403).json({ error: 'You are not authorized to update records for this course' });
    }

    const upsertRes = await db.query(
      `INSERT INTO academic_records (
         enrollment_id, attendance_percentage, assignment_score, quiz_score,
         previous_gpa, missed_submissions, lms_activity_score, notes, updated_by, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
       ON CONFLICT (enrollment_id) DO UPDATE SET
         attendance_percentage = EXCLUDED.attendance_percentage,
         assignment_score = EXCLUDED.assignment_score,
         quiz_score = EXCLUDED.quiz_score,
         previous_gpa = EXCLUDED.previous_gpa,
         missed_submissions = EXCLUDED.missed_submissions,
         lms_activity_score = EXCLUDED.lms_activity_score,
         notes = EXCLUDED.notes,
         updated_by = EXCLUDED.updated_by,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        enrollmentId,
        Number(attendance_percentage),
        Number(assignment_score),
        Number(quiz_score),
        Number(previous_gpa),
        Math.round(Number(missed_submissions)),
        Number(lms_activity_score),
        notes,
        req.user.id,
      ]
    );

    let prediction = null;
    if (autoPredict) {
      try {
        const predResult = await runAndStoreStudentPrediction(enrollment.student_id, req.user.id);
        prediction = predResult.prediction;
      } catch (predErr) {
        console.warn('Auto-predict skipped:', predErr.message);
      }
    }

    res.json({
      message: 'Academic record updated successfully',
      record: upsertRes.rows[0],
      prediction,
    });
  } catch (err) {
    console.error('updateAcademicRecord error:', err);
    res.status(500).json({ error: 'Failed to update academic record' });
  }
};

const bulkUpdateAcademicRecords = async (req, res) => {
  const { records, autoPredict = true } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'records array is required' });
  }

  try {
    const affectedStudentIds = new Set();
    let updatedCount = 0;

    for (const item of records) {
      const enrollmentId = Number(item.enrollment_id || item.enrollmentId);
      const errors = [
        validateMetric(item.attendance_percentage, 0, 100, 'Attendance percentage'),
        validateMetric(item.assignment_score, 0, 100, 'Assignment score'),
        validateMetric(item.quiz_score, 0, 100, 'Quiz score'),
        validateMetric(item.previous_gpa, 0, 4, 'Previous GPA'),
        validateMetric(item.missed_submissions, 0, 50, 'Missed submissions'),
        validateMetric(item.lms_activity_score, 0, 100, 'LMS activity score'),
      ].filter(Boolean);

      if (errors.length > 0) {
        return res.status(400).json({ error: `Enrollment #${enrollmentId}: ${errors.join('; ')}` });
      }

      const enrRes = await db.query(
        `SELECT e.id, e.student_id, c.lecturer_id
         FROM enrollments e
         JOIN courses c ON c.id = e.course_id
         WHERE e.id = $1`,
        [enrollmentId]
      );
      if (enrRes.rows.length === 0) continue;

      const enrollment = enrRes.rows[0];
      if (req.user.role === 'LECTURER' && enrollment.lecturer_id !== req.user.lecturerId) {
        return res.status(403).json({ error: `Not authorized to update enrollment #${enrollmentId}` });
      }

      await db.query(
        `INSERT INTO academic_records (
           enrollment_id, attendance_percentage, assignment_score, quiz_score,
           previous_gpa, missed_submissions, lms_activity_score, notes, updated_by, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
         ON CONFLICT (enrollment_id) DO UPDATE SET
           attendance_percentage = EXCLUDED.attendance_percentage,
           assignment_score = EXCLUDED.assignment_score,
           quiz_score = EXCLUDED.quiz_score,
           previous_gpa = EXCLUDED.previous_gpa,
           missed_submissions = EXCLUDED.missed_submissions,
           lms_activity_score = EXCLUDED.lms_activity_score,
           notes = EXCLUDED.notes,
           updated_by = EXCLUDED.updated_by,
           updated_at = CURRENT_TIMESTAMP`,
        [
          enrollmentId,
          Number(item.attendance_percentage),
          Number(item.assignment_score),
          Number(item.quiz_score),
          Number(item.previous_gpa),
          Math.round(Number(item.missed_submissions)),
          Number(item.lms_activity_score),
          item.notes || '',
          req.user.id,
        ]
      );

      updatedCount += 1;
      affectedStudentIds.add(enrollment.student_id);
    }

    let predictedCount = 0;
    if (autoPredict) {
      for (const sid of affectedStudentIds) {
        try {
          await runAndStoreStudentPrediction(sid, req.user.id);
          predictedCount += 1;
        } catch (e) {
          console.warn(`Bulk auto-predict skipped for student ${sid}:`, e.message);
        }
      }
    }

    res.json({
      message: `Updated ${updatedCount} academic record(s) and refreshed ${predictedCount} ML risk estimate(s).`,
      updatedCount,
      predictedCount,
    });
  } catch (err) {
    console.error('bulkUpdateAcademicRecords error:', err);
    res.status(500).json({ error: 'Bulk academic record update failed' });
  }
};

module.exports = {
  listAcademicRecords,
  updateAcademicRecord,
  bulkUpdateAcademicRecords,
};
