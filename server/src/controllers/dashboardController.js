const db = require('../config/db');
const { checkMlHealth } = require('../services/mlService');

async function getScopedStudentsRows(user, filters = {}) {
  const params = [];
  const conditions = [];

  if (user.role === 'LECTURER') {
    params.push(user.lecturerId);
    conditions.push(`EXISTS (
      SELECT 1 FROM enrollments e2
      JOIN courses c2 ON c2.id = e2.course_id
      WHERE e2.student_id = s.id AND c2.lecturer_id = $${params.length}
    )`);
  }

  if (filters.major && filters.major !== 'ALL') {
    params.push(filters.major);
    conditions.push(`s.major = $${params.length}`);
  }
  if (filters.courseId && filters.courseId !== 'ALL') {
    params.push(Number(filters.courseId));
    conditions.push(`EXISTS (
      SELECT 1 FROM enrollments e3 WHERE e3.student_id = s.id AND e3.course_id = $${params.length}
    )`);
  }
  if (filters.riskLevel && ['LOW', 'MEDIUM', 'HIGH'].includes(filters.riskLevel)) {
    params.push(filters.riskLevel);
    conditions.push(`lp.risk_level = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const res = await db.query(
    `SELECT
       s.id, s.student_identifier, s.first_name, s.last_name, s.major, s.year_of_study, u.email,
       COALESCE(ROUND(AVG(ar.attendance_percentage)::numeric, 1), 0)::float AS avg_attendance,
       COALESCE(ROUND(AVG(ar.assignment_score)::numeric, 1), 0)::float AS avg_assignment,
       COALESCE(ROUND(AVG(ar.quiz_score)::numeric, 1), 0)::float AS avg_quiz,
       COALESCE(ROUND(AVG(ar.previous_gpa)::numeric, 2), 0)::float AS avg_gpa,
       COALESCE(ROUND(AVG(ar.missed_submissions)::numeric, 0), 0)::int AS avg_missed,
       COALESCE(ROUND(AVG(ar.lms_activity_score)::numeric, 1), 0)::float AS avg_lms,
       COALESCE(lp.risk_level::text, 'UNASSESSED') AS risk_level,
       COALESCE(lp.probability::float, 0) AS risk_probability,
       lp.model_name,
       lp.is_demo,
       lp.generated_at AS last_predicted_at,
       (SELECT COUNT(*)::int FROM interventions i WHERE i.student_id = s.id) AS intervention_count,
       (SELECT i.status FROM interventions i WHERE i.student_id = s.id ORDER BY i.updated_at DESC LIMIT 1) AS latest_intervention_status
     FROM students s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN enrollments e ON e.student_id = s.id
     LEFT JOIN academic_records ar ON ar.enrollment_id = e.id
     LEFT JOIN LATERAL (
       SELECT risk_level, probability, model_name, is_demo, generated_at
       FROM risk_predictions rp
       WHERE rp.student_id = s.id
       ORDER BY rp.generated_at DESC, rp.id DESC LIMIT 1
     ) lp ON TRUE
     ${whereClause}
     GROUP BY s.id, u.email, lp.risk_level, lp.probability, lp.model_name, lp.is_demo, lp.generated_at
     ORDER BY
       CASE lp.risk_level WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 ELSE 4 END,
       lp.probability DESC NULLS LAST,
       s.student_identifier ASC`,
    params
  );

  return res.rows;
}

const getDashboardSummary = async (req, res) => {
  try {
    const students = await getScopedStudentsRows(req.user);
    const totalStudents = students.length;

    const riskCounts = { HIGH: 0, MEDIUM: 0, LOW: 0, UNASSESSED: 0 };
    const majorMap = {};

    for (const s of students) {
      riskCounts[s.risk_level] = (riskCounts[s.risk_level] || 0) + 1;
      if (!majorMap[s.major]) {
        majorMap[s.major] = { major: s.major, HIGH: 0, MEDIUM: 0, LOW: 0, total: 0 };
      }
      majorMap[s.major].total += 1;
      if (['HIGH', 'MEDIUM', 'LOW'].includes(s.risk_level)) {
        majorMap[s.major][s.risk_level] += 1;
      }
    }

    const denom = totalStudents || 1;
    const averages = {
      attendance: Number((students.reduce((acc, s) => acc + Number(s.avg_attendance || 0), 0) / denom).toFixed(1)),
      assignment: Number((students.reduce((acc, s) => acc + Number(s.avg_assignment || 0), 0) / denom).toFixed(1)),
      quiz: Number((students.reduce((acc, s) => acc + Number(s.avg_quiz || 0), 0) / denom).toFixed(1)),
      gpa: Number((students.reduce((acc, s) => acc + Number(s.avg_gpa || 0), 0) / denom).toFixed(2)),
      lms: Number((students.reduce((acc, s) => acc + Number(s.avg_lms || 0), 0) / denom).toFixed(1)),
    };

    const courseParams = [];
    let courseWhere = '';
    if (req.user.role === 'LECTURER') {
      courseParams.push(req.user.lecturerId);
      courseWhere = 'WHERE c.lecturer_id = $1';
    }

    const coursesRes = await db.query(
      `SELECT
         c.id, c.code, c.name, c.department,
         COUNT(DISTINCT e.student_id)::int AS student_count,
         COALESCE(ROUND(AVG(ar.attendance_percentage)::numeric, 1), 0)::float AS avg_attendance,
         COALESCE(ROUND(AVG(ar.assignment_score)::numeric, 1), 0)::float AS avg_assignment
       FROM courses c
       LEFT JOIN enrollments e ON e.course_id = c.id
       LEFT JOIN academic_records ar ON ar.enrollment_id = e.id
       ${courseWhere}
       GROUP BY c.id
       ORDER BY c.code`,
      courseParams
    );

    const intParams = [];
    let intWhere = '';
    if (req.user.role === 'LECTURER') {
      intParams.push(req.user.lecturerId);
      intWhere = `WHERE i.lecturer_id = $1 OR EXISTS (
        SELECT 1 FROM enrollments e JOIN courses c ON c.id = e.course_id
        WHERE e.student_id = i.student_id AND c.lecturer_id = $1
      )`;
    }

    const intStatsRes = await db.query(
      `SELECT i.status, COUNT(*)::int AS count
       FROM interventions i
       ${intWhere}
       GROUP BY i.status`,
      intParams
    );

    const recentIntRes = await db.query(
      `SELECT i.id, i.action_type, i.status, i.follow_up_date, i.created_at,
              s.id AS student_id, s.student_identifier, s.first_name AS student_first_name, s.last_name AS student_last_name
       FROM interventions i
       JOIN students s ON s.id = i.student_id
       ${intWhere}
       ORDER BY i.created_at DESC, i.id DESC
       LIMIT 6`,
      intParams
    );

    let systemCounts = null;
    if (req.user.role === 'ADMIN') {
      const uRes = await db.query(
        `SELECT role::text AS role, COUNT(*)::int AS count FROM users GROUP BY role`
      );
      const roleMap = { ADMIN: 0, LECTURER: 0, STUDENT: 0 };
      uRes.rows.forEach((r) => { roleMap[r.role] = r.count; });
      systemCounts = {
        totalUsers: roleMap.ADMIN + roleMap.LECTURER + roleMap.STUDENT,
        admins: roleMap.ADMIN,
        lecturers: roleMap.LECTURER,
        students: roleMap.STUDENT,
        courses: coursesRes.rows.length,
      };
    }

    const mlHealth = await checkMlHealth();
    const settingsRes = await db.query('SELECT * FROM academic_settings WHERE id = 1');

    res.json({
      totalStudents,
      riskDistribution: [
        { name: 'HIGH', value: riskCounts.HIGH, color: '#ef4444' },
        { name: 'MEDIUM', value: riskCounts.MEDIUM, color: '#f59e0b' },
        { name: 'LOW', value: riskCounts.LOW, color: '#10b981' },
      ],
      riskCounts,
      averages,
      majorBreakdown: Object.values(majorMap),
      coursePerformance: coursesRes.rows,
      highRiskWatchlist: students.filter((s) => s.risk_level === 'HIGH' || s.risk_level === 'MEDIUM').slice(0, 8),
      interventionStats: intStatsRes.rows,
      recentInterventions: recentIntRes.rows,
      systemCounts,
      mlService: mlHealth,
      settings: settingsRes.rows[0] || null,
    });
  } catch (err) {
    console.error('getDashboardSummary error:', err);
    res.status(500).json({ error: 'Failed to load dashboard analytics' });
  }
};

const getReportSummary = async (req, res) => {
  try {
    const rows = await getScopedStudentsRows(req.user, req.query);
    res.json({
      generatedAt: new Date().toISOString(),
      generatedBy: req.user.email,
      role: req.user.role,
      totalRecords: rows.length,
      highRiskCount: rows.filter((r) => r.risk_level === 'HIGH').length,
      mediumRiskCount: rows.filter((r) => r.risk_level === 'MEDIUM').length,
      lowRiskCount: rows.filter((r) => r.risk_level === 'LOW').length,
      rows,
    });
  } catch (err) {
    console.error('getReportSummary error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
};

function escapeCsvCell(val) {
  const str = val === null || val === undefined ? '' : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const exportReportCsv = async (req, res) => {
  try {
    const rows = await getScopedStudentsRows(req.user, req.query);
    const headers = [
      'Student ID',
      'First Name',
      'Last Name',
      'Email',
      'Major',
      'Year',
      'Avg Attendance (%)',
      'Avg Assignment (%)',
      'Avg Quiz (%)',
      'Previous GPA',
      'Avg Missed Submissions',
      'LMS Activity',
      'Risk Category (Decision Support)',
      'Estimated Risk Score',
      'Model',
      'Demo Flag',
      'Interventions Count',
      'Latest Intervention Status',
    ];

    const lines = [headers.map(escapeCsvCell).join(',')];
    for (const r of rows) {
      lines.push(
        [
          r.student_identifier,
          r.first_name,
          r.last_name,
          r.email,
          r.major,
          r.year_of_study,
          r.avg_attendance,
          r.avg_assignment,
          r.avg_quiz,
          r.avg_gpa,
          r.avg_missed,
          r.avg_lms,
          r.risk_level,
          r.risk_probability,
          r.model_name || '',
          r.is_demo ? 'DEMO' : 'VALIDATED',
          r.intervention_count,
          r.latest_intervention_status || 'NONE',
        ]
          .map(escapeCsvCell)
          .join(',')
      );
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="edurisk-academic-report-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.status(200).send(lines.join('\r\n'));
  } catch (err) {
    console.error('exportReportCsv error:', err);
    res.status(500).json({ error: 'Failed to export CSV report' });
  }
};

const getSettings = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM academic_settings WHERE id = 1');
    res.json({ settings: result.rows[0] || null });
  } catch (err) {
    console.error('getSettings error:', err);
    res.status(500).json({ error: 'Failed to load settings' });
  }
};

const updateSettings = async (req, res) => {
  const {
    institution_name,
    current_semester,
    attendance_warning_threshold,
    gpa_warning_threshold,
    high_risk_threshold,
    medium_risk_threshold,
  } = req.body;

  try {
    const result = await db.query(
      `UPDATE academic_settings
       SET institution_name = COALESCE($1, institution_name),
           current_semester = COALESCE($2, current_semester),
           attendance_warning_threshold = COALESCE($3, attendance_warning_threshold),
           gpa_warning_threshold = COALESCE($4, gpa_warning_threshold),
           high_risk_threshold = COALESCE($5, high_risk_threshold),
           medium_risk_threshold = COALESCE($6, medium_risk_threshold),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = 1
       RETURNING *`,
      [
        institution_name || null,
        current_semester || null,
        attendance_warning_threshold !== undefined ? Number(attendance_warning_threshold) : null,
        gpa_warning_threshold !== undefined ? Number(gpa_warning_threshold) : null,
        high_risk_threshold !== undefined ? Number(high_risk_threshold) : null,
        medium_risk_threshold !== undefined ? Number(medium_risk_threshold) : null,
      ]
    );
    res.json({ message: 'Academic settings updated', settings: result.rows[0] });
  } catch (err) {
    console.error('updateSettings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

module.exports = {
  getDashboardSummary,
  getReportSummary,
  exportReportCsv,
  getSettings,
  updateSettings,
};
