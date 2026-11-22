const db = require('../config/db');
const { runAndStoreStudentPrediction } = require('../services/mlService');

const listCourses = async (req, res) => {
  try {
    const params = [];
    let whereClause = '';

    if (req.user.role === 'LECTURER') {
      params.push(req.user.lecturerId);
      whereClause = 'WHERE c.lecturer_id = $1';
    } else if (req.user.role === 'STUDENT') {
      params.push(req.user.studentId);
      whereClause = 'WHERE c.id IN (SELECT course_id FROM enrollments WHERE student_id = $1)';
    }

    const result = await db.query(
      `SELECT
         c.id, c.code, c.name, c.department, c.credits, c.lecturer_id, c.created_at,
         l.first_name AS lecturer_first_name,
         l.last_name AS lecturer_last_name,
         COUNT(DISTINCT e.student_id)::int AS enrolled_count,
         COALESCE(ROUND(AVG(ar.attendance_percentage)::numeric, 1), 0)::float AS avg_attendance,
         COALESCE(ROUND(AVG(ar.assignment_score)::numeric, 1), 0)::float AS avg_assignment,
         COUNT(DISTINCT CASE WHEN lp.risk_level = 'HIGH' THEN e.student_id END)::int AS high_risk_count,
         COUNT(DISTINCT CASE WHEN lp.risk_level = 'MEDIUM' THEN e.student_id END)::int AS medium_risk_count
       FROM courses c
       LEFT JOIN lecturers l ON l.id = c.lecturer_id
       LEFT JOIN enrollments e ON e.course_id = c.id
       LEFT JOIN academic_records ar ON ar.enrollment_id = e.id
       LEFT JOIN LATERAL (
         SELECT risk_level FROM risk_predictions rp
         WHERE rp.student_id = e.student_id
         ORDER BY rp.generated_at DESC, rp.id DESC LIMIT 1
       ) lp ON TRUE
       ${whereClause}
       GROUP BY c.id, l.first_name, l.last_name
       ORDER BY c.code ASC`,
      params
    );

    res.json({ courses: result.rows });
  } catch (err) {
    console.error('listCourses error:', err);
    res.status(500).json({ error: 'Failed to load courses' });
  }
};

const createCourse = async (req, res) => {
  const { code, name, department, credits, lecturerId } = req.body;
  if (!code || !name) {
    return res.status(400).json({ error: 'Course code and name are required' });
  }

  try {
    const result = await db.query(
      `INSERT INTO courses (code, name, department, credits, lecturer_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [code.trim().toUpperCase(), name.trim(), department || 'Computer Science', Number(credits) || 3, lecturerId || null]
    );
    res.status(201).json({ message: 'Course created', course: result.rows[0] });
  } catch (err) {
    console.error('createCourse error:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Course code already exists' });
    }
    res.status(500).json({ error: 'Failed to create course' });
  }
};

const updateCourse = async (req, res) => {
  const courseId = Number(req.params.id);
  const { code, name, department, credits, lecturerId } = req.body;

  try {
    const result = await db.query(
      `UPDATE courses
       SET code = COALESCE($1, code),
           name = COALESCE($2, name),
           department = COALESCE($3, department),
           credits = COALESCE($4, credits),
           lecturer_id = $5
       WHERE id = $6
       RETURNING *`,
      [
        code ? code.trim().toUpperCase() : null,
        name ? name.trim() : null,
        department || null,
        credits ? Number(credits) : null,
        lecturerId === '' ? null : lecturerId ?? null,
        courseId,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json({ message: 'Course updated', course: result.rows[0] });
  } catch (err) {
    console.error('updateCourse error:', err);
    res.status(500).json({ error: 'Failed to update course' });
  }
};

const deleteCourse = async (req, res) => {
  const courseId = Number(req.params.id);
  try {
    const result = await db.query('DELETE FROM courses WHERE id = $1 RETURNING id', [courseId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json({ message: 'Course deleted' });
  } catch (err) {
    console.error('deleteCourse error:', err);
    res.status(500).json({ error: 'Failed to delete course' });
  }
};

const enrollStudent = async (req, res) => {
  const courseId = Number(req.params.id);
  const {
    studentId,
    semester,
    attendance_percentage = 0,
    assignment_score = 0,
    quiz_score = 0,
    previous_gpa = 0,
    missed_submissions = 0,
    lms_activity_score = 0,
    notes = '',
    autoPredict = false,
  } = req.body;

  if (!studentId) {
    return res.status(400).json({ error: 'studentId is required' });
  }

  const att = Number(attendance_percentage);
  const asg = Number(assignment_score);
  const quiz = Number(quiz_score);
  const gpa = Number(previous_gpa);
  const missed = Math.round(Number(missed_submissions));
  const lms = Number(lms_activity_score);

  if (
    Number.isNaN(att) || att < 0 || att > 100 ||
    Number.isNaN(asg) || asg < 0 || asg > 100 ||
    Number.isNaN(quiz) || quiz < 0 || quiz > 100 ||
    Number.isNaN(gpa) || gpa < 0 || gpa > 4 ||
    Number.isNaN(missed) || missed < 0 || missed > 50 ||
    Number.isNaN(lms) || lms < 0 || lms > 100
  ) {
    return res.status(400).json({
      error: 'Metrics out of valid range (Attendance/Assignments/Quiz/LMS: 0-100, GPA: 0-4, Missed: 0-50)',
    });
  }

  try {
    if (req.user.role === 'LECTURER') {
      const owns = await db.query('SELECT id FROM courses WHERE id = $1 AND lecturer_id = $2', [
        courseId,
        req.user.lecturerId,
      ]);
      if (owns.rows.length === 0) {
        return res.status(403).json({ error: 'You are not assigned to this course' });
      }
    }

    const settingsRes = await db.query('SELECT current_semester FROM academic_settings WHERE id = 1');
    const activeSemester = semester || settingsRes.rows[0]?.current_semester || '2026-S2';

    const enrollment = await db.withTransaction(async (tx) => {
      const enrRes = await tx.query(
        `INSERT INTO enrollments (student_id, course_id, semester)
         VALUES ($1, $2, $3) RETURNING *`,
        [Number(studentId), courseId, activeSemester]
      );
      const enr = enrRes.rows[0];

      await tx.query(
        `INSERT INTO academic_records (
           enrollment_id, attendance_percentage, assignment_score, quiz_score,
           previous_gpa, missed_submissions, lms_activity_score, notes, updated_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          enr.id,
          att,
          asg,
          quiz,
          gpa,
          missed,
          lms,
          notes || (autoPredict ? 'Academic record entered' : 'Awaiting academic record entry'),
          req.user.id,
        ]
      );
      return enr;
    });

    let prediction = null;
    if (autoPredict) {
      try {
        const predRes = await runAndStoreStudentPrediction(Number(studentId), req.user.id);
        prediction = predRes.prediction;
      } catch (predErr) {
        console.warn('Auto-predict after enroll skipped:', predErr.message);
      }
    }

    res.status(201).json({
      message: autoPredict
        ? 'Student enrolled, academic details saved, and ML risk calculated!'
        : 'Student enrolled successfully',
      enrollment,
      prediction,
    });
  } catch (err) {
    console.error('enrollStudent error:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Student is already enrolled in this course for this semester' });
    }
    res.status(500).json({ error: 'Failed to enroll student' });
  }
};

const getAvailableStudentsForCourse = async (req, res) => {
  const courseId = Number(req.params.id);
  try {
    if (req.user.role === 'LECTURER') {
      const owns = await db.query('SELECT id FROM courses WHERE id = $1 AND lecturer_id = $2', [
        courseId,
        req.user.lecturerId,
      ]);
      if (owns.rows.length === 0) {
        return res.status(403).json({ error: 'You are not assigned to this course' });
      }
    }

    const result = await db.query(
      `SELECT s.id, s.student_identifier, s.first_name, s.last_name, s.major, s.year_of_study
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE u.is_active = TRUE
         AND s.id NOT IN (SELECT student_id FROM enrollments WHERE course_id = $1)
       ORDER BY s.student_identifier ASC`,
      [courseId]
    );
    res.json({ students: result.rows });
  } catch (err) {
    console.error('getAvailableStudentsForCourse error:', err);
    res.status(500).json({ error: 'Failed to load available students' });
  }
};

const getCourseStudents = async (req, res) => {
  const courseId = Number(req.params.id);
  try {
    if (req.user.role === 'LECTURER') {
      const owns = await db.query('SELECT id FROM courses WHERE id = $1 AND lecturer_id = $2', [
        courseId,
        req.user.lecturerId,
      ]);
      if (owns.rows.length === 0) {
        return res.status(403).json({ error: 'You are not assigned to this course' });
      }
    }

    const result = await db.query(
      `SELECT
         e.id AS enrollment_id, e.semester,
         s.id AS student_id, s.student_identifier, s.first_name, s.last_name, s.major, s.year_of_study,
         u.email,
         ar.attendance_percentage::float AS attendance_percentage,
         ar.assignment_score::float AS assignment_score,
         lp.risk_level
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN academic_records ar ON ar.enrollment_id = e.id
       LEFT JOIN LATERAL (
         SELECT risk_level FROM risk_predictions rp
         WHERE rp.student_id = s.id
         ORDER BY rp.generated_at DESC, rp.id DESC LIMIT 1
       ) lp ON TRUE
       WHERE e.course_id = $1
       ORDER BY s.student_identifier ASC`,
      [courseId]
    );
    res.json({ students: result.rows });
  } catch (err) {
    console.error('getCourseStudents error:', err);
    res.status(500).json({ error: 'Failed to load enrolled students' });
  }
};

const unenrollStudent = async (req, res) => {
  const courseId = Number(req.params.courseId);
  const studentId = Number(req.params.studentId);
  try {
    const delRes = await db.query(
      'DELETE FROM enrollments WHERE course_id = $1 AND student_id = $2 RETURNING id',
      [courseId, studentId]
    );
    if (delRes.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    res.json({ message: 'Student removed from course' });
  } catch (err) {
    console.error('unenrollStudent error:', err);
    res.status(500).json({ error: 'Failed to unenroll student' });
  }
};

module.exports = {
  listCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  enrollStudent,
  getAvailableStudentsForCourse,
  getCourseStudents,
  unenrollStudent,
};
