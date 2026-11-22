const bcrypt = require('bcrypt');
const db = require('../config/db');
const { initDb } = require('./initDb');

const DEMO_COURSES = [
  { code: 'CS201', name: 'Data Structures & Algorithms', department: 'Computer Science', credits: 4, lecturerIdx: 0 },
  { code: 'CS305', name: 'Software Engineering', department: 'Computer Science', credits: 3, lecturerIdx: 0 },
  { code: 'DS202', name: 'Statistical Machine Learning', department: 'Data Science', credits: 4, lecturerIdx: 1 },
  { code: 'SE310', name: 'Database Systems', department: 'Software Engineering', credits: 3, lecturerIdx: 1 },
];

// 18 diverse synthetic demo students across HIGH, MEDIUM, and LOW risk profiles
const DEMO_STUDENTS = [
  { email: 'student@edurisk.com', id: 'STU1001', first: 'Alex', last: 'Dias', major: 'Computer Science', year: 2, courses: [0, 1], metrics: [52, 54, 48, 2.15, 5, 34] },
  { email: 'kasun.p@edurisk.com', id: 'STU1002', first: 'Kasun', last: 'Perera', major: 'Computer Science', year: 2, courses: [0, 2], metrics: [46, 44, 41, 1.95, 6, 28] },
  { email: 'nethmi.s@edurisk.com', id: 'STU1003', first: 'Nethmi', last: 'Silva', major: 'Data Science', year: 3, courses: [2, 3], metrics: [92, 91, 88, 3.78, 0, 89] },
  { email: 'dilshan.f@edurisk.com', id: 'STU1004', first: 'Dilshan', last: 'Fernando', major: 'Software Engineering', year: 3, courses: [1, 3], metrics: [67, 63, 59, 2.48, 3, 52] },
  { email: 'amaya.j@edurisk.com', id: 'STU1005', first: 'Amaya', last: 'Jayawardena', major: 'Computer Science', year: 1, courses: [0, 1], metrics: [88, 84, 82, 3.55, 0, 81] },
  { email: 'tharindu.r@edurisk.com', id: 'STU1006', first: 'Tharindu', last: 'Rathnayake', major: 'Information Systems', year: 2, courses: [0, 3], metrics: [58, 51, 55, 2.10, 4, 39] },
  { email: 'ishara.m@edurisk.com', id: 'STU1007', first: 'Ishara', last: 'Mendis', major: 'Data Science', year: 2, courses: [2, 3], metrics: [71, 68, 64, 2.68, 2, 60] },
  { email: 'sahan.b@edurisk.com', id: 'STU1008', first: 'Sahan', last: 'Bandara', major: 'Computer Science', year: 3, courses: [0, 1], metrics: [95, 93, 90, 3.89, 0, 94] },
  { email: 'hiruni.k@edurisk.com', id: 'STU1009', first: 'Hiruni', last: 'Karunaratne', major: 'Software Engineering', year: 2, courses: [1, 3], metrics: [62, 66, 58, 2.40, 3, 47] },
  { email: 'pasindu.w@edurisk.com', id: 'STU1010', first: 'Pasindu', last: 'Wijesinghe', major: 'Computer Science', year: 1, courses: [0, 2], metrics: [49, 47, 43, 1.85, 6, 31] },
  { email: 'oshadi.g@edurisk.com', id: 'STU1011', first: 'Oshadi', last: 'Gunawardena', major: 'Data Science', year: 3, courses: [2, 3], metrics: [85, 88, 80, 3.45, 1, 79] },
  { email: 'chathura.d@edurisk.com', id: 'STU1012', first: 'Chathura', last: 'De Silva', major: 'Software Engineering', year: 2, courses: [1, 3], metrics: [73, 70, 62, 2.75, 2, 58] },
  { email: 'senuri.a@edurisk.com', id: 'STU1013', first: 'Senuri', last: 'Amarasinghe', major: 'Computer Science', year: 2, courses: [0, 1], metrics: [91, 87, 85, 3.68, 0, 86] },
  { email: 'ravindu.h@edurisk.com', id: 'STU1014', first: 'Ravindu', last: 'Herath', major: 'Information Systems', year: 1, courses: [0, 3], metrics: [55, 57, 49, 2.05, 5, 36] },
  { email: 'malsha.n@edurisk.com', id: 'STU1015', first: 'Malsha', last: 'Nanayakkara', major: 'Data Science', year: 2, courses: [2, 3], metrics: [78, 76, 74, 3.12, 1, 72] },
  { email: 'kaveesha.l@edurisk.com', id: 'STU1016', first: 'Kaveesha', last: 'Liyanage', major: 'Software Engineering', year: 3, courses: [1, 2], metrics: [64, 61, 60, 2.52, 3, 49] },
  { email: 'dinithi.e@edurisk.com', id: 'STU1017', first: 'Dinithi', last: 'Ekanayake', major: 'Computer Science', year: 3, courses: [0, 1], metrics: [89, 90, 87, 3.72, 0, 85] },
  { email: 'yasiru.t@edurisk.com', id: 'STU1018', first: 'Yasiru', last: 'Tennakoon', major: 'Data Science', year: 1, courses: [2, 3], metrics: [51, 48, 46, 1.92, 5, 33] },
];

function buildBaselinePrediction(metrics) {
  const [att, asg, quiz, gpa, missed, lms] = metrics;
  const riskScore =
    0.28 * ((100 - att) / 100) +
    0.22 * ((100 - asg) / 100) +
    0.16 * ((100 - quiz) / 100) +
    0.16 * ((4.0 - gpa) / 4.0) +
    0.10 * Math.min(1, missed / 10) +
    0.08 * ((100 - lms) / 100);

  let riskLevel = 'LOW';
  if (riskScore >= 0.45) riskLevel = 'HIGH';
  else if (riskScore >= 0.28) riskLevel = 'MEDIUM';

  const probability = Number(Math.min(0.97, Math.max(0.05, riskScore * 1.45)).toFixed(4));

  const factors = [
    { feature: 'attendance_percentage', label: 'Attendance Percentage', value: att, unit: '%', benchmark: 75, model_weight: 0.28, status: att < 75 ? 'CONCERN' : 'HEALTHY', direction: att < 75 ? 'RISK_INCREASING' : 'PROTECTIVE', association_score: Number((0.28 * (0.35 + 1.4 * Math.max(0, (75 - att) / 75))).toFixed(4)), note: att < 75 ? 'Below benchmark (75%)' : 'At or above benchmark (75%)' },
    { feature: 'assignment_score', label: 'Assignment Performance', value: asg, unit: '%', benchmark: 65, model_weight: 0.22, status: asg < 65 ? 'CONCERN' : 'HEALTHY', direction: asg < 65 ? 'RISK_INCREASING' : 'PROTECTIVE', association_score: Number((0.22 * (0.35 + 1.4 * Math.max(0, (65 - asg) / 65))).toFixed(4)), note: asg < 65 ? 'Below benchmark (65%)' : 'At or above benchmark (65%)' },
    { feature: 'quiz_score', label: 'Quiz Performance', value: quiz, unit: '%', benchmark: 60, model_weight: 0.16, status: quiz < 60 ? 'CONCERN' : 'HEALTHY', direction: quiz < 60 ? 'RISK_INCREASING' : 'PROTECTIVE', association_score: Number((0.16 * (0.35 + 1.4 * Math.max(0, (60 - quiz) / 60))).toFixed(4)), note: quiz < 60 ? 'Below benchmark (60%)' : 'At or above benchmark (60%)' },
    { feature: 'previous_gpa', label: 'Previous Semester GPA', value: gpa, unit: 'GPA', benchmark: 2.5, model_weight: 0.16, status: gpa < 2.5 ? 'CONCERN' : 'HEALTHY', direction: gpa < 2.5 ? 'RISK_INCREASING' : 'PROTECTIVE', association_score: Number((0.16 * (0.35 + 1.4 * Math.max(0, (2.5 - gpa) / 2.5))).toFixed(4)), note: gpa < 2.5 ? 'Below benchmark (2.5 GPA)' : 'At or above benchmark (2.5 GPA)' },
    { feature: 'missed_submissions', label: 'Missed / Late Submissions', value: missed, unit: 'tasks', benchmark: 2, model_weight: 0.10, status: missed > 2 ? 'CONCERN' : 'HEALTHY', direction: missed > 2 ? 'RISK_INCREASING' : 'PROTECTIVE', association_score: Number((0.10 * (0.35 + 1.4 * Math.max(0, (missed - 2) / 2))).toFixed(4)), note: missed > 2 ? 'Above threshold (2 tasks)' : 'Within expected threshold (<= 2 tasks)' },
    { feature: 'lms_activity_score', label: 'LMS Engagement', value: lms, unit: '/100', benchmark: 55, model_weight: 0.08, status: lms < 55 ? 'CONCERN' : 'HEALTHY', direction: lms < 55 ? 'RISK_INCREASING' : 'PROTECTIVE', association_score: Number((0.08 * (0.35 + 1.4 * Math.max(0, (55 - lms) / 55))).toFixed(4)), note: lms < 55 ? 'Below benchmark (55/100)' : 'At or above benchmark (55/100)' },
  ].sort((a, b) => (b.status === 'CONCERN') - (a.status === 'CONCERN') || b.association_score - a.association_score);

  const actions = [];
  if (att < 75) actions.push({ indicator: 'Attendance Percentage', category: 'Attendance Support', title: 'Schedule an attendance check-in with academic advisor', description: 'Review class attendance barriers and set a weekly attendance recovery goal.', priority: 'HIGH' });
  if (asg < 65) actions.push({ indicator: 'Assignment Performance', category: 'Academic Tutoring', title: 'Enroll in course tutoring or assignment feedback clinic', description: 'Review grading rubrics and receive draft feedback before upcoming deadlines.', priority: 'HIGH' });
  if (missed > 2) actions.push({ indicator: 'Missed / Late Submissions', category: 'Time Management', title: 'Create a milestone deadline recovery plan', description: 'Break coursework into smaller checkpoints with weekly lecturer check-ins.', priority: 'HIGH' });
  if (quiz < 60) actions.push({ indicator: 'Quiz Performance', category: 'Study Strategy', title: 'Join peer study group & weekly concept drills', description: 'Practice structured concept quizzes ahead of upcoming assessments.', priority: 'MEDIUM' });
  if (gpa < 2.5) actions.push({ indicator: 'Previous Semester GPA', category: 'Academic Planning', title: 'Review semester study timetable with advisor', description: 'Balance course workload and prioritize foundational modules.', priority: 'MEDIUM' });
  if (lms < 55) actions.push({ indicator: 'LMS Engagement', category: 'Digital Engagement', title: 'Establish two weekly LMS review sessions', description: 'Review lecture slides, recordings, and forum Q&A regularly.', priority: 'LOW' });
  if (actions.length === 0) {
    actions.push({ indicator: 'Overall Progress', category: 'Positive Reinforcement', title: 'Maintain current study routine', description: 'All tracked indicators are on target. Continue steady weekly engagement.', priority: 'LOW' });
  }

  const concerns = factors.filter((f) => f.status === 'CONCERN').slice(0, 3).map((f) => f.label);
  const summary = concerns.length
    ? `Estimated ${riskLevel} risk indicator is primarily associated with: ${concerns.join(', ')}. These metrics represent statistical associations for early-support review, not causal proof.`
    : `Estimated ${riskLevel} risk indicator: all tracked academic indicators currently meet or exceed reference benchmarks.`;

  const classProbs =
    riskLevel === 'HIGH'
      ? { LOW: 0.06, MEDIUM: 0.19, HIGH: 0.75 }
      : riskLevel === 'MEDIUM'
      ? { LOW: 0.18, MEDIUM: 0.62, HIGH: 0.20 }
      : { LOW: 0.82, MEDIUM: 0.14, HIGH: 0.04 };

  return { riskLevel, probability, classProbs, factors, actions, summary };
}

async function seedDatabase({ forceIfEmpty = false } = {}) {
  await initDb();

  if (forceIfEmpty) {
    const existing = await db.query('SELECT COUNT(*)::int AS count FROM users');
    if (existing.rows[0].count > 0) {
      return { seeded: false, reason: 'Users already exist' };
    }
  }

  const passwordHash = await bcrypt.hash('password123', 10);
  const semester = '2026-S2';

  // 1. Admin
  await db.query(
    `INSERT INTO users (email, password_hash, role)
     VALUES ($1, $2, 'ADMIN') ON CONFLICT (email) DO NOTHING`,
    ['admin@edurisk.com', passwordHash]
  );

  // 2. Lecturers
  const lecturerSpecs = [
    { email: 'lecturer@edurisk.com', empId: 'LEC101', first: 'Nimal', last: 'Perera', dept: 'Computer Science' },
    { email: 'lecturer2@edurisk.com', empId: 'LEC102', first: 'Kavindi', last: 'Silva', dept: 'Data Science' },
  ];

  const lecturerIds = [];
  for (const lec of lecturerSpecs) {
    let userRes = await db.query('SELECT id FROM users WHERE email = $1', [lec.email]);
    let userId;
    if (userRes.rows.length === 0) {
      const ins = await db.query(
        `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'LECTURER') RETURNING id`,
        [lec.email, passwordHash]
      );
      userId = ins.rows[0].id;
    } else {
      userId = userRes.rows[0].id;
    }

    let lecRes = await db.query('SELECT id FROM lecturers WHERE user_id = $1', [userId]);
    if (lecRes.rows.length === 0) {
      const insLec = await db.query(
        `INSERT INTO lecturers (user_id, employee_id, first_name, last_name, department)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [userId, lec.empId, lec.first, lec.last, lec.dept]
      );
      lecturerIds.push(insLec.rows[0].id);
    } else {
      lecturerIds.push(lecRes.rows[0].id);
    }
  }

  // 3. Courses
  const courseIds = [];
  for (const c of DEMO_COURSES) {
    const existing = await db.query('SELECT id FROM courses WHERE code = $1', [c.code]);
    if (existing.rows.length === 0) {
      const ins = await db.query(
        `INSERT INTO courses (code, name, department, credits, lecturer_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [c.code, c.name, c.department, c.credits, lecturerIds[c.lecturerIdx]]
      );
      courseIds.push(ins.rows[0].id);
    } else {
      courseIds.push(existing.rows[0].id);
    }
  }

  // 4. Students, Enrollments, Academic Records & Initial Predictions
  const studentIdByCode = {};
  for (const stu of DEMO_STUDENTS) {
    let userRes = await db.query('SELECT id FROM users WHERE email = $1', [stu.email]);
    let userId;
    if (userRes.rows.length === 0) {
      const ins = await db.query(
        `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'STUDENT') RETURNING id`,
        [stu.email, passwordHash]
      );
      userId = ins.rows[0].id;
    } else {
      userId = userRes.rows[0].id;
    }

    let stuRes = await db.query('SELECT id FROM students WHERE user_id = $1', [userId]);
    let studentId;
    if (stuRes.rows.length === 0) {
      const insStu = await db.query(
        `INSERT INTO students (user_id, student_identifier, first_name, last_name, major, year_of_study)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [userId, stu.id, stu.first, stu.last, stu.major, stu.year]
      );
      studentId = insStu.rows[0].id;
    } else {
      studentId = stuRes.rows[0].id;
    }
    studentIdByCode[stu.id] = studentId;

    const [att, asg, quiz, gpa, missed, lms] = stu.metrics;
    for (let idx = 0; idx < stu.courses.length; idx++) {
      const courseId = courseIds[stu.courses[idx]];
      const offset = idx === 0 ? 0 : 3;

      let enrRes = await db.query(
        'SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 AND semester = $3',
        [studentId, courseId, semester]
      );
      let enrollmentId;
      if (enrRes.rows.length === 0) {
        const insEnr = await db.query(
          'INSERT INTO enrollments (student_id, course_id, semester) VALUES ($1, $2, $3) RETURNING id',
          [studentId, courseId, semester]
        );
        enrollmentId = insEnr.rows[0].id;
      } else {
        enrollmentId = enrRes.rows[0].id;
      }

      const recExists = await db.query(
        'SELECT id FROM academic_records WHERE enrollment_id = $1',
        [enrollmentId]
      );
      if (recExists.rows.length === 0) {
        await db.query(
          `INSERT INTO academic_records (
            enrollment_id, attendance_percentage, assignment_score, quiz_score,
            previous_gpa, missed_submissions, lms_activity_score, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            enrollmentId,
            Math.min(100, Math.max(0, att + offset)),
            Math.min(100, Math.max(0, asg - offset)),
            Math.min(100, Math.max(0, quiz + (offset - 1))),
            gpa,
            missed,
            Math.min(100, Math.max(0, lms + offset)),
            'Mid-semester academic record (demo data)',
          ]
        );
      }
    }

    const predExists = await db.query(
      'SELECT id FROM risk_predictions WHERE student_id = $1 LIMIT 1',
      [studentId]
    );
    if (predExists.rows.length === 0) {
      const pred = buildBaselinePrediction(stu.metrics);
      await db.query(
        `INSERT INTO risk_predictions (
          student_id, risk_level, probability, class_probabilities,
          contributing_factors, suggested_actions, explanation_summary,
          model_name, is_demo
        ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, TRUE)`,
        [
          studentId,
          pred.riskLevel,
          pred.probability,
          JSON.stringify(pred.classProbs),
          JSON.stringify(pred.factors),
          JSON.stringify(pred.actions),
          pred.summary,
          'Logistic Regression / Demo Baseline',
        ]
      );
    }
  }

  // 5. Sample Interventions
  const intCount = await db.query('SELECT COUNT(*)::int AS count FROM interventions');
  if (intCount.rows[0].count === 0) {
    const sampleInterventions = [
      {
        stuCode: 'STU1001',
        lecIdx: 0,
        type: 'Attendance & Study Support Meeting',
        notes: 'Met with Alex to discuss recent missed lectures in CS201. Agreed on weekly check-ins and tutoring clinic on Thursdays.',
        status: 'IN_PROGRESS',
        followUp: '2026-12-02',
      },
      {
        stuCode: 'STU1001',
        lecIdx: 0,
        type: 'Assignment Recovery Plan',
        notes: 'Provided milestone checklist for upcoming CS305 software design deliverables to avoid late penalties.',
        status: 'PENDING',
        followUp: '2026-12-08',
      },
      {
        stuCode: 'STU1002',
        lecIdx: 0,
        type: 'Academic Advising Referral',
        notes: 'Attendance dropped below 50% with multiple missed labs. Referred to faculty student support counselor.',
        status: 'FOLLOW_UP_NEEDED',
        followUp: '2026-11-28',
      },
      {
        stuCode: 'STU1004',
        lecIdx: 0,
        type: 'Peer Tutoring Enrollment',
        notes: 'Enrolled Dilshan in weekly peer-assisted study sessions for Software Engineering.',
        status: 'COMPLETED',
        followUp: '2026-11-18',
      },
      {
        stuCode: 'STU1010',
        lecIdx: 0,
        type: 'Early Warning Outreach',
        notes: 'Sent outreach email and scheduled 1-on-1 office hours to review foundational DSA topics.',
        status: 'PENDING',
        followUp: '2026-12-01',
      },
      {
        stuCode: 'STU1018',
        lecIdx: 1,
        type: 'Course Tutoring Session',
        notes: 'Paired Yasiru with a senior DS202 teaching assistant for weekly statistics problem-solving.',
        status: 'IN_PROGRESS',
        followUp: '2026-12-04',
      },
    ];

    for (const item of sampleInterventions) {
      const sid = studentIdByCode[item.stuCode];
      if (!sid) continue;
      await db.query(
        `INSERT INTO interventions (
          student_id, lecturer_id, action_type, notes, status, follow_up_date, student_visible
        ) VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
        [sid, lecturerIds[item.lecIdx], item.type, item.notes, item.status, item.followUp]
      );
    }
  }

  console.log('[Seed] EduRisk demo database seeded successfully.');
  console.log('  Admin:    admin@edurisk.com    / password123');
  console.log('  Lecturer: lecturer@edurisk.com / password123');
  console.log('  Student:  student@edurisk.com  / password123');
  return { seeded: true };
}

if (require.main === module) {
  seedDatabase({ forceIfEmpty: false })
    .then(() => db.close())
    .catch((err) => {
      console.error('[Seed] Error:', err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
