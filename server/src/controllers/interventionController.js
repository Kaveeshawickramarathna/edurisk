const db = require('../config/db');
const { lecturerCanAccessStudent } = require('./studentController');

const VALID_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FOLLOW_UP_NEEDED'];

const listInterventions = async (req, res) => {
  try {
    const { status, studentId } = req.query;
    const params = [];
    const conditions = [];

    if (req.user.role === 'STUDENT') {
      params.push(req.user.studentId);
      conditions.push(`i.student_id = $${params.length} AND i.student_visible = TRUE`);
    } else if (req.user.role === 'LECTURER') {
      params.push(req.user.lecturerId);
      conditions.push(`(
        i.lecturer_id = $${params.length}
        OR EXISTS (
          SELECT 1 FROM enrollments e
          JOIN courses c ON c.id = e.course_id
          WHERE e.student_id = i.student_id AND c.lecturer_id = $${params.length}
        )
      )`);
    }

    if (status && VALID_STATUSES.includes(status)) {
      params.push(status);
      conditions.push(`i.status = $${params.length}`);
    }
    if (studentId) {
      params.push(Number(studentId));
      conditions.push(`i.student_id = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT
         i.id, i.student_id, i.lecturer_id, i.action_type, i.notes, i.status,
         i.follow_up_date, i.student_visible, i.created_at, i.updated_at,
         s.student_identifier, s.first_name AS student_first_name, s.last_name AS student_last_name, s.major,
         l.first_name AS lecturer_first_name, l.last_name AS lecturer_last_name,
         lp.risk_level AS current_risk_level
       FROM interventions i
       JOIN students s ON s.id = i.student_id
       LEFT JOIN lecturers l ON l.id = i.lecturer_id
       LEFT JOIN LATERAL (
         SELECT risk_level FROM risk_predictions rp
         WHERE rp.student_id = s.id
         ORDER BY rp.generated_at DESC, rp.id DESC LIMIT 1
       ) lp ON TRUE
       ${whereClause}
       ORDER BY i.created_at DESC, i.id DESC`,
      params
    );

    res.json({ interventions: result.rows });
  } catch (err) {
    console.error('listInterventions error:', err);
    res.status(500).json({ error: 'Failed to load interventions' });
  }
};

const createIntervention = async (req, res) => {
  const {
    studentId,
    actionType = 'Academic Advising',
    notes,
    status = 'PENDING',
    followUpDate = null,
    studentVisible = true,
  } = req.body;

  if (!studentId || !notes || !notes.trim()) {
    return res.status(400).json({ error: 'studentId and notes are required' });
  }
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    if (req.user.role === 'LECTURER') {
      const allowed = await lecturerCanAccessStudent(req.user.lecturerId, Number(studentId));
      if (!allowed) {
        return res.status(403).json({ error: 'Not authorized to record interventions for this student' });
      }
    }

    const lecturerId = req.user.lecturerId || null;
    const result = await db.query(
      `INSERT INTO interventions (
         student_id, lecturer_id, action_type, notes, status, follow_up_date, student_visible
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        Number(studentId),
        lecturerId,
        actionType.trim(),
        notes.trim(),
        status,
        followUpDate || null,
        Boolean(studentVisible),
      ]
    );

    res.status(201).json({
      message: 'Intervention recorded successfully',
      intervention: result.rows[0],
    });
  } catch (err) {
    console.error('createIntervention error:', err);
    res.status(500).json({ error: 'Failed to record intervention' });
  }
};

const updateIntervention = async (req, res) => {
  const id = Number(req.params.id);
  const { actionType, notes, status, followUpDate, studentVisible } = req.body;

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid intervention status' });
  }

  try {
    const existing = await db.query('SELECT * FROM interventions WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Intervention not found' });
    }

    if (req.user.role === 'LECTURER') {
      const allowed = await lecturerCanAccessStudent(req.user.lecturerId, existing.rows[0].student_id);
      if (!allowed && existing.rows[0].lecturer_id !== req.user.lecturerId) {
        return res.status(403).json({ error: 'Not authorized to modify this intervention' });
      }
    }

    const result = await db.query(
      `UPDATE interventions
       SET action_type = COALESCE($1, action_type),
           notes = COALESCE($2, notes),
           status = COALESCE($3, status),
           follow_up_date = COALESCE($4, follow_up_date),
           student_visible = COALESCE($5, student_visible),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [
        actionType || null,
        notes || null,
        status || null,
        followUpDate === '' ? null : followUpDate ?? null,
        typeof studentVisible === 'boolean' ? studentVisible : null,
        id,
      ]
    );

    res.json({ message: 'Intervention updated', intervention: result.rows[0] });
  } catch (err) {
    console.error('updateIntervention error:', err);
    res.status(500).json({ error: 'Failed to update intervention' });
  }
};

const deleteIntervention = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const resDel = await db.query('DELETE FROM interventions WHERE id = $1 RETURNING id', [id]);
    if (resDel.rows.length === 0) {
      return res.status(404).json({ error: 'Intervention not found' });
    }
    res.json({ message: 'Intervention deleted' });
  } catch (err) {
    console.error('deleteIntervention error:', err);
    res.status(500).json({ error: 'Failed to delete intervention' });
  }
};

const requestStudentSupport = async (req, res) => {
  const { topic = 'Academic Advising Request', notes, preferredDate = null, courseId = null } = req.body;

  if (!req.user.studentId) {
    return res.status(404).json({ error: 'Student profile not found' });
  }
  if (!notes || !notes.trim()) {
    return res.status(400).json({ error: 'Please describe how we can support you' });
  }

  try {
    let lecturerId = null;
    if (courseId) {
      const cRes = await db.query('SELECT lecturer_id FROM courses WHERE id = $1', [Number(courseId)]);
      lecturerId = cRes.rows[0]?.lecturer_id || null;
    }
    if (!lecturerId) {
      const eRes = await db.query(
        `SELECT c.lecturer_id FROM enrollments e
         JOIN courses c ON c.id = e.course_id
         WHERE e.student_id = $1 AND c.lecturer_id IS NOT NULL
         LIMIT 1`,
        [req.user.studentId]
      );
      lecturerId = eRes.rows[0]?.lecturer_id || null;
    }

    const result = await db.query(
      `INSERT INTO interventions (
         student_id, lecturer_id, action_type, notes, status, follow_up_date, student_visible
       ) VALUES ($1, $2, $3, $4, 'PENDING', $5, TRUE)
       RETURNING *`,
      [
        req.user.studentId,
        lecturerId,
        `Student Request: ${topic.trim()}`,
        notes.trim(),
        preferredDate || null,
      ]
    );

    res.status(201).json({
      message: 'Support request sent to your academic advisor',
      intervention: result.rows[0],
    });
  } catch (err) {
    console.error('requestStudentSupport error:', err);
    res.status(500).json({ error: 'Failed to submit support request' });
  }
};

module.exports = {
  listInterventions,
  createIntervention,
  updateIntervention,
  deleteIntervention,
  requestStudentSupport,
};
